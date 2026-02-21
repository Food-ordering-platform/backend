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
   * 2. Get Vendor Earnings (Bug Fixed: No more double counting)
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
          // ✅ BUG FIX: Pending money ONLY includes orders currently PREPARING.
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
   * 3. Get Vendor Transactions (Moved from RestaurantService)
   */
  static async getTransactions(userId: string) {
    return await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to the last 50 for performance
    });
  }

  /**
   * 4. Request Payout (Merged with Zod Validation & Admin Alert)
   */
  static async requestPayout(userId: string, amount: number, bankDetails: any) {
    // 1. Validation
    const validData = payoutSchema.parse({ amount, bankDetails });

    // 2. Check Balance
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

    // 3. Resolve Bank
    const accountInfo = await PaymentService.resolveAccount(
      validData.bankDetails.accountNumber,
      validData.bankDetails.bankName
    );

    return await prisma.$transaction(async (tx) => {
      // 4. Create Pending Debit
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

      // 5. Initiate Transfer
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

      // 6. 🔔 Notify Admin (From your old RestaurantService)
      sendAdminPayoutAlert(restaurant.name, validData.amount, validData.bankDetails);

      return transaction;
    });
  }

  /**
   * 5. Update Status & Handle Money Flow (Atomic Transaction Bug Fix Applied)
   */
  static async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: {
        restaurant: true,
        customer: true,
        items: true,
      },
    });

    if (!order) throw new Error("Order not found");

    let newPaymentStatus = order.paymentStatus;

    if (status === "CANCELLED" && order.paymentStatus === "PAID") {
      await PaymentService.refund(order.reference).catch((e) =>
        console.error("Refund failed", e)
      );
      newPaymentStatus = "REFUNDED";
    }

    // ✅ BUG FIX: Atomic Transaction for status update + money credit
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status, paymentStatus: newPaymentStatus },
        include: {
          customer: true,
          restaurant: true,
          items: true,
        },
      });

      if (status === "READY_FOR_PICKUP" && updated.paymentStatus === "PAID") {
        const vendorShare = calculateVendorShare(
          Number(updated.totalAmount),
          Number(updated.deliveryFee)
        );

        const existingTx = await tx.transaction.findFirst({
          where: {
            orderId: updated.id,
            category: TransactionCategory.ORDER_EARNING,
          },
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
      }
      return updated;
    });

    // 📡 NOTIFICATIONS (Outside the transaction)
    if (status === "READY_FOR_PICKUP") {
      RiderService.notifyRidersOfNewOrder(updatedOrder.id).catch((err) =>
        console.error("Failed to notify riders", err)
      );
    }

    if (status === "PREPARING") {
      if (updatedOrder.customer?.pushToken) {
        sendPushNotification(
          updatedOrder.customer.pushToken,
          "Order Accepted!",
          "The vendor is preparing your food."
        );
      }
      if (updatedOrder.customer?.email && updatedOrder.deliveryCode) {
        sendDeliveryCode(
          updatedOrder.customer.email,
          updatedOrder.deliveryCode,
          updatedOrder.reference
        ).catch((err: any) => console.error("Failed to send delivery code:", err));
      }
    }

    if (updatedOrder.customer?.email) {
      sendOrderStatusEmail(
        updatedOrder.customer.email,
        updatedOrder.customer.name,
        updatedOrder.reference,
        status
      );
    }

    return updatedOrder;
  }
}