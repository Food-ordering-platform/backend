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
} from "../utils/email/email.service";
import { sendPushNotification } from "../utils/notification";
import { RiderService } from "../rider/rider.service";
import { calculateVendorShare } from "../config/pricing";
import { payoutSchema } from "../restuarant/restaurant.validator";

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
   * 3. Get Vendor Transactions
   */
  static async getTransactions(userId: string) {
    return await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  /**
   * 4. Request Payout
   */
  static async requestPayout(userId: string, amount: number, bankDetails: any) {
    const validData = payoutSchema.parse({ amount, bankDetails });
    const { availableBalance } = await this.getVendorEarnings(userId);
    
    if (validData.amount < 100) throw new Error("Minimum withdrawal is ₦100");
    if (validData.amount > availableBalance) {
      throw new Error(`Insufficient funds. Available: ₦${availableBalance.toLocaleString()}`);
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { ownerId: userId },
      select: { name: true },
    });

    if (!restaurant) throw new Error("Restaurant Not Found");

    const accountInfo = await PaymentService.resolveAccount(
      validData.bankDetails.accountNumber,
      validData.bankDetails.bankName
    );

    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: validData.amount,
          type: TransactionType.DEBIT,
          category: TransactionCategory.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          description: `Payout to ${accountInfo.account_name}`,
          reference: `PAYOUT-${Date.now()}`,
        },
      });

      try {
        const recipient = await PaymentService.createTransferRecipient(
          accountInfo.account_name,
          validData.bankDetails.accountNumber,
          validData.bankDetails.bankName
        );
        await PaymentService.initiateTransfer(validData.amount, recipient, transaction.reference);
      } catch (e: any) {
        console.error("Payout API failed:", e.message);
        throw new Error(`Payout failed: ${e.message}`);
      }

      sendAdminPayoutAlert(restaurant.name, validData.amount, validData.bankDetails);
      return transaction;
    });
  }

  // =========================================================================
  // 🚀 REFACTORED VENDOR ORDER ACTIONS (Replacing updateOrderStatus)
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
    if (order.status !== "PENDING") throw new Error("Order has already been processed");

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
    if (order.status !== "PREPARING") throw new Error("Order must be preparing before it can be marked ready");

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
    if (["DELIVERED", "OUT_FOR_DELIVERY"].includes(order.status)) throw new Error("Cannot cancel an order that is already on the way");

    let newPaymentStatus = order.paymentStatus;

    if (order.paymentStatus === "PAID") {
      await PaymentService.refund(order.reference).catch((e) => console.error("Refund failed", e));
      newPaymentStatus = "REFUNDED";
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
}