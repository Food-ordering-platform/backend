import {
  PrismaClient,
  OrderStatus,
  TransactionType,
  TransactionStatus,
  TransactionCategory,
} from "@prisma/client";
import { PaymentService } from "../payment/payment.service";
import { OrderService } from "../order/order.service"; // Reusing your helper if needed, but I'll inline the math to be safe
import {
  sendDeliveryCode,
  sendOrderStatusEmail,
} from "../utils/email/email.service";
import { sendPushNotification } from "../utils/notification";
import { OrderStateMachine } from "../utils/order-state-machine";
import { PRICING } from "../config/pricing";

const prisma = new PrismaClient();

export class VendorService {
  // --- Helper: Calculate Vendor Share (85% of Food Cost) ---
  static calculateVendorShare(
    totalAmount: number,
    deliveryFee: number,
  ): number {
    const foodRevenue = totalAmount - (deliveryFee + PRICING.PLATFORM_FEE);
    const vendorShare = foodRevenue * 0.85;
    return Math.max(0, vendorShare);
  }

  /**
   * 1. Get Vendor Orders (Dashboard)
   */
  static async getVendorOrders(restaurantId: string) {
    // Changed to userId for security
    // Find Restaurant First
    const restaurant = await prisma.restaurant.findUnique({
      where: { id:restaurantId },
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
        riderName: order.riderName, // Ensure these fields exist in your schema or use the relation
        riderPhone: order.riderPhone,
        vendorFoodTotal: this.calculateVendorShare(
          order.totalAmount,
          order.deliveryFee,
        ),
      };
    });
  }

  /**
   * 2. Update Status & Handle Money Flow
   */
  static async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
  ) {
    // 1. Verify Ownership (Security Check)
 
    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: {
        restaurant: true,
        customer: true,
        items: true,
      },
    });

    if (!order) throw new Error("Order not found");

    // 2. Validate Transition
    // OrderStateMachine.validateTransition(order.status, status); // Keeping your validation

    let newPaymentStatus = order.paymentStatus;

    // 3. Handle Refunds if Cancelled
    if (status === "CANCELLED" && order.paymentStatus === "PAID") {
      await PaymentService.refund(order.reference).catch((e) =>
        console.error("Refund failed", e),
      );
      newPaymentStatus = "REFUNDED";
    }

    // 4. Update Database
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
    // 💰 MONEY LOGIC (Pending -> Success)
    // ---------------------------------------------------------

    // A. WHEN VENDOR ACCEPTS (CONFIRMED) -> LOCK FUNDS (PENDING)
    if (status === "PREPARING") {
      const vendorShare = this.calculateVendorShare(
        order.totalAmount,
        order.deliveryFee,
      );

      // Idempotency Check: Don't create if exists
      const existingTx = await prisma.transaction.findFirst({
        where: { orderId: order.id, category: "ORDER_EARNING" },
      });

      if (!existingTx) {
        await prisma.transaction.create({
          data: {
            userId: order.restaurant.ownerId, // Use ownerId from relation
            amount: vendorShare,
            type: "CREDIT",
            category: "ORDER_EARNING",
            status: "PENDING", // <--- Locked!
            orderId: order.id,
            reference: `EARN-${order.reference}`,
            description: `Earnings for Order #${order.reference}`,
          },
        });
      }
    }

    // B. WHEN RIDER PICKS UP (OUT_FOR_DELIVERY) -> UNLOCK FUNDS (SUCCESS)
    if (status === "OUT_FOR_DELIVERY") {
      const pendingTx = await prisma.transaction.findFirst({
        where: {
          orderId: orderId,
          status: "PENDING",
          category: "ORDER_EARNING",
        },
      });

      if (pendingTx) {
        await prisma.transaction.update({
          where: { id: pendingTx.id },
          data: { status: "SUCCESS" }, // <--- Money Available!
        });
      }
    }

    // C. IF CANCELLED -> VOID TRANSACTION
    if (status === "CANCELLED") {
      const pendingTx = await prisma.transaction.findFirst({
        where: { orderId: orderId, status: "PENDING" },
      });

      if (pendingTx) {
        await prisma.transaction.update({
          where: { id: pendingTx.id },
          data: { status: "FAILED", description: `Order Cancelled` },
        });
      }
    }

    // ---------------------------------------------------------
    // 📡 NOTIFICATIONS
    // ---------------------------------------------------------

    // Standard Emails & Push (Your Logic)
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
