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
} from "../utils/email/email.service";
import { sendPushNotification } from "../utils/notification";
import { PRICING } from "../config/pricing";
import { RiderService } from "../rider/rider.service";

const prisma = new PrismaClient();

export class VendorService {
  
  // --- Helper: Calculate Vendor Share (85% of Food Cost) ---
  static calculateVendorShare(totalAmount: number, deliveryFee: number): number {
    const foodRevenue = totalAmount - (deliveryFee + PRICING.PLATFORM_FEE);
    const vendorShare = foodRevenue * 0.85;
    return Math.max(0, vendorShare);
  }

  /**
   * 1. Get Vendor Orders (Dashboard)
   */
  static async getVendorOrders(restaurantId: string) {
    // Find Restaurant First
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
        vendorFoodTotal: this.calculateVendorShare(
          order.totalAmount,
          order.deliveryFee,
        ),
      };
    });
  }

  /**
   * 2. Get Vendor Earnings (Pending calculated from Orders, Available from Transactions)
   */
  static async getVendorEarnings(userId: string) {
    // A. Available Balance (From Transactions Table)
    // This is money that has already been successfully credited (Post-Pickup)
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    const totalCredits = transactions
      .filter(t => t.type === TransactionType.CREDIT && t.status === TransactionStatus.SUCCESS)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = transactions
      .filter(t => t.type === TransactionType.DEBIT && (t.status === TransactionStatus.SUCCESS || t.status === TransactionStatus.PENDING))
      .reduce((sum, t) => sum + t.amount, 0);

    const availableBalance = totalCredits - totalDebits;

    // B. Pending Balance (From Active Orders Table)
    // We calculate this "On the Fly". It is NOT in the transaction table yet.
    // Logic: Any order that is NOT yet picked up, but is valid.
    const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: userId } });
    
    let pendingBalance = 0;

    if (restaurant) {
        const activeOrders = await prisma.order.findMany({
            where: {
                restaurantId: restaurant.id,
                // Statuses where the vendor has accepted but rider hasn't picked up/delivered yet
                status: { in: ['PREPARING', 'READY_FOR_PICKUP', 'RIDER_ACCEPTED'] },
                paymentStatus: 'PAID'
            }
        });

        pendingBalance = activeOrders.reduce((sum, order) => {
            return sum + this.calculateVendorShare(order.totalAmount, order.deliveryFee);
        }, 0);
    }

    return {
      availableBalance,
      pendingBalance, 
      totalEarnings: totalCredits,
      withdrawn: totalDebits,
      transactions
    };
  }

  /**
   * 3. Update Status & Handle Money Flow
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

    // Handle Refunds if Cancelled
    if (status === "CANCELLED" && order.paymentStatus === "PAID") {
      await PaymentService.refund(order.reference).catch((e) =>
        console.error("Refund failed", e),
      );
      newPaymentStatus = "REFUNDED";
    }

    // Update Database
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status, paymentStatus: newPaymentStatus },
      include: {
        customer: true,
        restaurant: true,
        items: true,
      },
    });

    // ---------------------------------------------------------
    // 💰 MONEY LOGIC
    // ---------------------------------------------------------

    // A. PREPARING (Vendor Accepted) -> NO TRANSACTION CREATED YET.
    // The "Pending Balance" on the dashboard will increase automatically 
    // because getVendorEarnings() calculates it from the Order Status.

    // B. OUT_FOR_DELIVERY (Rider Picked Up) -> CREATE CREDIT TRANSACTION
    if (status === "OUT_FOR_DELIVERY") {
        
        // Calculate Share
        const vendorShare = this.calculateVendorShare(
            order.totalAmount,
            order.deliveryFee
        );

        // Idempotency Check: Ensure we haven't paid them for this order yet
        const existingTx = await prisma.transaction.findFirst({
            where: { 
                orderId: order.id, 
                category: TransactionCategory.ORDER_EARNING 
            }
        });

        if (!existingTx) {
            // Create SUCCESS Transaction immediately
            await prisma.transaction.create({
                data: {
                    userId: order.restaurant.ownerId,
                    amount: vendorShare,
                    type: TransactionType.CREDIT,
                    category: TransactionCategory.ORDER_EARNING,
                    status: TransactionStatus.SUCCESS, // <--- Available immediately upon pickup
                    description: `Earnings for Order #${order.reference}`,
                    orderId: order.id,
                    reference: `EARN-${order.reference}-${Date.now()}`
                }
            });
        }
    }

    // C. CANCELLED -> NO ACTION NEEDED
    // Since we never created a transaction, we don't need to mark it FAILED.
    // The Pending Balance will automatically drop because the order status is now CANCELLED 
    // (which is excluded from the getVendorEarnings query).

    // ---------------------------------------------------------
    // 📡 NOTIFICATIONS & TRIGGERS
    // ---------------------------------------------------------

    // 1. Notify Rider Service if Ready
    if (status === "READY_FOR_PICKUP") {
       RiderService.notifyRidersOfNewOrder(updatedOrder.id)
         .catch(err => console.error("Failed to notify riders", err));
    }

    // 2. Standard Notifications (Email/Push to Customer)
    if (status === "PREPARING") {
      if (updatedOrder.customer?.pushToken) {
        sendPushNotification(
          updatedOrder.customer.pushToken,
          "Order Accepted!",
          "The vendor is preparing your food.",
        );
      }
      if (updatedOrder.customer?.email && updatedOrder.deliveryCode) {
        sendDeliveryCode(
          updatedOrder.customer.email,
          updatedOrder.deliveryCode,
          updatedOrder.reference,
        ).catch((err: any) =>
          console.error("Failed to send delivery code:", err),
        );
      }
    }

    if (updatedOrder.customer?.email) {
      sendOrderStatusEmail(
        updatedOrder.customer.email,
        updatedOrder.customer.name,
        updatedOrder.reference,
        status,
      );
    }

    return updatedOrder;
  }
}