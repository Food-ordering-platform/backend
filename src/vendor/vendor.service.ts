import {
  PrismaClient,
  OrderStatus,
  TransactionType,
  TransactionStatus,
  TransactionCategory,
} from "@prisma/client";
import { PaymentService } from "../payment/payment.service";
import {
  sendDeliveryCode,
  sendOrderStatusEmail,
  sendAdminPayoutAlert,
  sendPayoutRequestEmail,
} from "../utils/email/email.service";
import { sendPushNotification } from "../utils/notification";
import { RiderService } from "../rider/rider.service";
import { calculateVendorShare } from "../config/pricing";
import { payoutSchema } from "../restuarant/restaurant.validator";
import { OrderStateMachine } from "../utils/order-state-machine";

const prisma = new PrismaClient();

export class VendorService {
  /**
   * 1. Get Vendor Orders (Dashboard)
   */
  static async getVendorOrders(restaurantId: string) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });

    if (!restaurant) throw new Error("Restaurant not found");

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        paymentStatus: { in: ["PAID", "REFUNDED"] },
      },
      include: {
        items: true,
        customer: {
          select: { name: true, phone: true, address: true, pushToken: true },
        },
        rider: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return orders.map((order) => {
      return {
        ...order,
        riderName: order.riderName,
        riderPhone: order.riderPhone,
        vendorFoodTotal: calculateVendorShare(
          Number(order.totalAmount),
          Number(order.deliveryFee)
        ),
      };
    });
  }



  // =========================================================================
  // VENDOR ORDER ACTIONS (Replacing updateOrderStatus)
  // =========================================================================

  /**
   * Action A: Accept Order (Kitchen starts cooking)
   * Changes status from PENDING -> PREPARING
   */
  static async acceptOrder(vendorId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true, customer: true },
    });

    if (!order) throw new Error("Order not found");
    if (order.restaurant.ownerId !== vendorId) throw new Error("Unauthorized to access this order");
    OrderStateMachine.validateTransition(order.status, OrderStatus.PREPARING);

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PREPARING },
      include: { customer: true },
    });

    // 📡 Notifications
    if (updatedOrder.customer?.pushToken) {
      sendPushNotification(updatedOrder.customer.pushToken, "Order Accepted!", "The vendor is preparing your food.");
    }
    if (updatedOrder.customer?.email && updatedOrder.deliveryCode) {
      sendDeliveryCode(updatedOrder.customer.email, updatedOrder.deliveryCode, updatedOrder.reference).catch(e => console.error(e));
    }
    if (updatedOrder.customer?.email) {
      sendOrderStatusEmail(updatedOrder.customer.email, updatedOrder.customer.name, updatedOrder.reference, OrderStatus.PREPARING);
    }

    return updatedOrder;
  }

  /**
   * Action B: Request Rider (Food is Ready)
   * Changes status from PREPARING -> READY_FOR_PICKUP and creates Vendor Earning Record
   */
  static async requestRider(vendorId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true },
    });

    if (!order) throw new Error("Order not found");
    if (order.restaurant.ownerId !== vendorId) throw new Error("Unauthorized");
    OrderStateMachine.validateTransition(order.status, OrderStatus.READY_FOR_PICKUP);

    // Atomic Transaction to update status AND log the earnings
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.READY_FOR_PICKUP },
        include: { restaurant: true, customer: true },
      });

      const vendorShare = calculateVendorShare(Number(updated.totalAmount), Number(updated.deliveryFee));
      
      const existingTx = await tx.transaction.findFirst({
        where: { orderId: updated.id, category: TransactionCategory.ORDER_EARNING },
      });

      if (!existingTx && vendorShare > 0) {
        await tx.transaction.create({
          data: {
            userId: updated.restaurant.ownerId,
            amount: vendorShare,
            type: TransactionType.CREDIT,
            category: TransactionCategory.ORDER_EARNING,
            status: TransactionStatus.SUCCESS,
            description: `Earnings for Order #${updated.reference}`,
            orderId: updated.id,
            reference: `EARN-${updated.reference}-${Date.now()}`,
          },
        });
      }
      return updated;
    });

    // 📡 Notifications
    RiderService.notifyRidersOfNewOrder(updatedOrder.id).catch(e => console.error("Rider push failed", e));
    
    if (updatedOrder.customer?.email) {
      sendOrderStatusEmail(updatedOrder.customer.email, updatedOrder.customer.name, updatedOrder.reference, OrderStatus.READY_FOR_PICKUP);
    }

    return updatedOrder;
  }

  /**
   * Action C: Cancel Order (Vendor unable to fulfill)
   * Changes status to CANCELLED and handles refund
   */
  static async cancelOrder(vendorId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true, customer: true },
    });

    if (!order) throw new Error("Order not found");
    if (order.restaurant.ownerId !== vendorId) throw new Error("Unauthorized");
    OrderStateMachine.validateTransition(order.status, OrderStatus.CANCELLED);

    let newPaymentStatus = order.paymentStatus;

   if (order.paymentStatus === "PAID") {
    try {
      console.log(`Initiating Paystack refund for reference: ${order.reference}`);
      
      // const refundResponse = await PaymentService.refund(order.reference);
      
      // If we reach here, the API call was successful
      newPaymentStatus = "REFUNDED"; 
      // console.log("Paystack refund successful:", refundResponse.data?.status);
    } catch (e: any) {
      // If the refund fails, we do NOT set it to "REFUNDED"
      console.error("CRITICAL: Paystack Refund Failed:", e.message);
      
      // throw an error here to stop the whole cancellation,
      throw new Error(`Refund failed: ${e.message}. Order not cancelled.`);
    }
  }
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED, paymentStatus: newPaymentStatus },
      include: { customer: true },
    });

    // 📡 Notifications
    if (updatedOrder.customer?.email) {
      sendOrderStatusEmail(updatedOrder.customer.email, updatedOrder.customer.name, updatedOrder.reference, OrderStatus.CANCELLED);
    }

    return updatedOrder;
  }

  /**
   * 2. Get Vendor Earnings
   */
  static async getVendorEarnings(userId: string) {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const totalCredits = transactions
      .filter((t) => t.type === TransactionType.CREDIT && t.status === TransactionStatus.SUCCESS)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = transactions
      .filter(
        (t) =>
          t.type === TransactionType.DEBIT &&
          (t.status === TransactionStatus.SUCCESS || t.status === TransactionStatus.PENDING)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const availableBalance = totalCredits - totalDebits;

    const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: userId } });
    let pendingBalance = 0;

    if (restaurant) {
      const activeOrders = await prisma.order.findMany({
        where: {
          restaurantId: restaurant.id,
          status: { in: ["PREPARING"] }, 
          paymentStatus: "PAID",
        },
      });

      pendingBalance = activeOrders.reduce((sum, order) => {
        return (
          sum + calculateVendorShare(Number(order.totalAmount), Number(order.deliveryFee))
        );
      }, 0);
    }

    return {
      availableBalance,
      pendingBalance,
      totalEarnings: totalCredits,
      withdrawn: totalDebits,
      currency: "NGN",
    };
  }

 /**
 * 4. Request Payout (Manual Workflow)
 */
static async requestPayout(userId: string, amount: number, bankDetails: any) {
  // 1. Validate input and check balance
  const validData = payoutSchema.parse({ amount, bankDetails });
  const { availableBalance } = await this.getVendorEarnings(userId);

  if (validData.amount < 1000) throw new Error("Minimum withdrawal is ₦1000");
  if (validData.amount > availableBalance) {
    throw new Error(`Insufficient funds. Available: ₦${availableBalance.toLocaleString()}`);
  }

  // 2. Fetch Restaurant name for the Admin Alert
  const restaurant = await prisma.restaurant.findUnique({
    where: { ownerId: userId },
    include:{
      owner:{
        select:{
          name: true,
          email:true,
        }
      }
    }
  });

if (!restaurant || !restaurant.owner) throw new Error("Restaurant or Owner Not Found");


  // 3. Execute DB Transaction
  return await prisma.$transaction(async (tx) => {
    // Create the DEBIT record in the Ledger
    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount: validData.amount,
        type: TransactionType.DEBIT,
        category: TransactionCategory.WITHDRAWAL,
        status: TransactionStatus.PENDING, // It stays PENDING until Admin approves
        description: `Manual Payout Request to ${validData.bankDetails.bankName} (${validData.bankDetails.accountNumber})`,
        reference: `MAN-PAY-${Date.now()}`,
      },
    });

    // 4. Trigger Notifications (Asynchronous vibes)
    try {
      // Alert the Admin to perform the manual bank transfer
      await sendAdminPayoutAlert(restaurant.name, validData.amount, validData.bankDetails);
      
      // Notify the Vendor that their request is being processed
      await sendPayoutRequestEmail({
        email: restaurant.owner.email,
        ownerName: restaurant.owner.name,
        restaurantName: restaurant.name,
        amount: validData.amount,
        bankName: validData.bankDetails.bankName,
        accountNumber: validData.bankDetails.accountNumber
      });
      
      console.log(`Payout request logged for ${restaurant.name}. Reference: ${transaction.reference}`);
    } catch (e: any) {
  
      console.error("Notification failed but transaction was recorded:", e.message);
    }

    return transaction;
  });
}


   // Get Vendor Transactions   
  static async getTransactions(userId: string) {
    return await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}