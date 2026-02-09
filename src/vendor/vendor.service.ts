import { PrismaClient, OrderStatus, TransactionType, TransactionStatus, TransactionCategory } from "@prisma/client";
import { PaymentService } from "../payment/payment.service"; // Ensure you import PaymentService correctly
import { OrderService } from "../order/order.service";
import { sendDeliveryCode, sendOrderStatusEmail } from "../utils/email/email.service";
import { sendPushNotification } from "../utils/notification";
import { OrderStateMachine } from "../utils/order-state-machine";
import { PRICING } from "../config/pricing";

const prisma = new PrismaClient();

export class VendorService {
  static calculateVendorShare(
    totalAmount: number,
    deliveryFee: number,
  ): number {
    const foodRevenue = totalAmount - (deliveryFee + PRICING.PLATFORM_FEE);
    const vendorShare = foodRevenue * 0.85;
    return Math.max(0, vendorShare);
  }

  /**
   * 1. Get Vendor Orders (Active vs History)
   * Moved from OrderService
   */
 static async getVendorOrders(restaurantId: string) {
    const orders = await prisma.order.findMany({
      where: { restaurantId, paymentStatus: { in: ["PAID", "REFUNDED"] } },
      include: {
        items: true,
        customer: { select: { name: true, phone: true, address: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return orders.map((order) => {
      return {
        ...order,
        riderName: order.riderName,
        riderPhone: order.riderPhone,
        vendorFoodTotal: OrderService.calculateVendorShare(
          order.totalAmount,
          order.deliveryFee,
        ),
      };
    });
  }

  static async updateOrderStatus(orderId: string, status: OrderStatus) {
      // 1. Fetch Order with all necessary relations (Customer, Restaurant, Items)
      // We need 'items' now to show the rider how many items are in the package
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          restaurant: true,
          customer: true,
          items: true,
        },
      });
  
      if (!order) throw new Error("Order not found");
  
      // 2. Validate Transition
      // This throws an error automatically if invalid, no need for if(!...)
      OrderStateMachine.validateTransition(order.status, status);
  
      let newPaymentStatus = order.paymentStatus;
  
      // 3. Handle Refunds if Cancelled
      if (status === "CANCELLED" && order.paymentStatus === "PAID") {
        await PaymentService.refund(order.reference).catch((e) =>
          console.error("Refund failed", e),
        );
        newPaymentStatus = "REFUNDED"; // Ensure this matches your PaymentStatus enum
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
  
      // 5. Notifications (Your existing logic)
      if (status === "PREPARING") {
        if (updatedOrder.customer?.pushToken) {
          sendPushNotification(
            updatedOrder.customer.pushToken,
            "Order Accepted!",
            "The vendor is preparing your food.",
          );
        }
  
        // Send Delivery Code via Email
        if (updatedOrder.customer?.email && updatedOrder.deliveryCode) {
          sendDeliveryCode(
            updatedOrder.customer.email,
            updatedOrder.deliveryCode,
            updatedOrder.reference,
          ).catch((err: any) => console.error("Failed to send delivery code:", err));
        }
      }
  
      // 7. Standard Status Email (Your existing logic)
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


    static async distributeVendorEarnings(orderId: string) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { restaurant: true },
      });
  
      if (!order) {
        throw new Error(`Order with ID ${orderId} not found`);
      }
  
      const vendorShare = OrderService.calculateVendorShare(
        order.totalAmount,
        order.deliveryFee,
      );
  
      await prisma.transaction.create({
        data: {
          userId: order.restaurant.ownerId,
          amount: vendorShare,
          type: "CREDIT",
          category: "ORDER_EARNING",
          status: "SUCCESS",
          orderId: order.id,
          description: `Earnings for Order #${order.reference}`,
        },
      });
    }
  

  
}