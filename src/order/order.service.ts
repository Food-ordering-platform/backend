import {
  OrderStatus,
  PrismaClient,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { PaymentService } from "../payment/payment.service";
import { randomBytes } from "crypto";
import {
  sendDeliveryCode,
  sendOrderStatusEmail,
} from "../utils/email/email.service";
import { sendPushNotification } from "../utils/notification";
import { getSocketIO } from "../utils/socket";
import { calculateDistance, calculateDeliveryFee } from "../utils/haversine";
import { PRICING } from "../config/pricing";
import { sendWebPushNotification } from "../utils/web-push";
import { OrderStateMachine } from "../utils/order-state-machine";
import { sendPushToRiders } from "../utils/push-notification";

const prisma = new PrismaClient();

function generateReference(): string {
  return randomBytes(12).toString("hex");
}

export class OrderService {
  static calculateVendorShare(
    totalAmount: number,
    deliveryFee: number,
  ): number {
    const foodRevenue = totalAmount - (deliveryFee + PRICING.PLATFORM_FEE);
    const vendorShare = foodRevenue * 0.85;
    return Math.max(0, vendorShare);
  }

  // ... (getOrderQuote and createOrderWithPayment remain unchanged) ...
  static async getOrderQuote(
    restaurantId: string,
    deliveryLatitude: number,
    deliveryLongitude: number,
    items: { price: number; quantity: number }[],
  ) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { latitude: true, longitude: true },
    });

    if (!restaurant || !restaurant.latitude || !restaurant.longitude) {
      throw new Error("Restaurant location not available for calculation.");
    }

    const distance = calculateDistance(
      restaurant.latitude,
      restaurant.longitude,
      deliveryLatitude,
      deliveryLongitude,
    );
    const deliveryFee = calculateDeliveryFee(distance);

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const totalAmount = subtotal + deliveryFee + PRICING.PLATFORM_FEE;

    return {
      subtotal,
      deliveryFee,
      platformFee: PRICING.PLATFORM_FEE,
      totalAmount,
      distanceKm: parseFloat(distance.toFixed(2)),
    };
  }

  static async createOrderWithPayment(
    customerId: string,
    restaurantId: string,
    deliveryAddress: string,
    deliveryPhoneNumber: string,
    deliveryNotes: string | undefined,
    deliveryLatitude: number | undefined,
    deliveryLongitude: number | undefined,
    items: { menuItemId: string; quantity: number }[],
    customerName: string,
    customerEmail: string,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey },
      });

      if (existingOrder) {
        console.log(
          `🛡️ Idempotency Hit: Returning existing order ${existingOrder.reference}`,
        );
        return {
          order: existingOrder,
          checkoutUrl: existingOrder.checkoutUrl,
        };
      }
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: true },
    });

    if (!restaurant) throw new Error("Restaurant not found");

    let deliveryFee = 0;
    if (
      restaurant.latitude &&
      restaurant.longitude &&
      deliveryLatitude &&
      deliveryLongitude
    ) {
      const distance = calculateDistance(
        restaurant.latitude,
        restaurant.longitude,
        deliveryLatitude,
        deliveryLongitude,
      );
      deliveryFee = calculateDeliveryFee(distance);
    } else {
      deliveryFee = 500;
    }

    const menuItemIds = items.map((item) => item.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });
    const itemsMap = new Map(dbMenuItems.map((item) => [item.id, item]));

    let subtotal = 0;

    const validItems = items.map((i) => {
      const originalItem = itemsMap.get(i.menuItemId);
      if (!originalItem) throw new Error(`Menu item ${i.menuItemId} not found`);

      const itemTotal = originalItem.price * i.quantity;
      subtotal += itemTotal;

      return {
        menuItemId: i.menuItemId,
        menuItemName: originalItem.name,
        quantity: i.quantity,
        price: originalItem.price,
      };
    });

    const finalTotal = subtotal + deliveryFee + PRICING.PLATFORM_FEE;

    let reference = generateReference();
    let referenceExists = true;
    while (referenceExists) {
      const existing = await prisma.order.findUnique({ where: { reference } });
      if (!existing) referenceExists = false;
      else reference = generateReference();
    }

    const checkoutUrl = await PaymentService.initiatePayment(
      finalTotal,
      customerName,
      customerEmail,
      reference,
    );

    const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();

    const order = await prisma.order.create({
      data: {
        customerId,
        restaurantId,
        totalAmount: finalTotal,
        deliveryFee: deliveryFee,
        paymentStatus: "PENDING",
        status: "PENDING",
        deliveryAddress,
        deliveryPhoneNumber,
        deliveryNotes: deliveryNotes || null,
        deliveryLatitude,
        deliveryLongitude,
        reference,
        idempotencyKey,
        checkoutUrl,
        deliveryCode: deliveryCode,
        items: {
          create: validItems,
        },
      },
      include: { items: true },
    });

    return { order, checkoutUrl };
  }

  // ✅ UPDATED: Sends email with REAL DB reference
  static async processSuccessfulPayment(reference: string) {
    const order = await prisma.order.findUnique({
      where: { reference },
      include: {
        restaurant: { include: { owner: true } },
        customer: true,
      },
    });

    if (!order) return null;
    if (order.paymentStatus === "PAID") return order;

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID" },
    });

    if (order.customer && order.customer.email) {
      // ✅ FIX: Use order.reference
      sendOrderStatusEmail(
        order.customer.email,
        order.customer.name,
        order.reference, // <--- THE FIX
        "PENDING",
      ).catch((e) => console.log("Payment success email failed", e));
    }

    if (order.restaurant?.owner?.pushToken) {
      sendPushNotification(
        order.restaurant.owner.pushToken,
        "New Order Paid! 💰",
        `Order #${order.reference.slice(0, 4).toUpperCase()} confirmed. ₦${order.totalAmount}`,
        { orderId: order.id },
      );
    }

    try {
      const io = getSocketIO();
      io.to(`restaurant_${order.restaurantId}`).emit("new_order", {
        message: "New Order Paid! 🔔",
        orderId: order.id,
        totalAmount: order.totalAmount,
      });
    } catch (error) {
      console.log("Socket emit failed", error);
    }

    return updatedOrder;
  }

  static async getOrdersByCustomer(customerId: string) {
    return prisma.order.findMany({
      where: { customerId },
      select: {
        id: true,
        reference: true,
        totalAmount: true,
        deliveryFee: true,
        paymentStatus: true,
        status: true,
        checkoutUrl: true,
        restaurant: { select: { name: true, imageUrl: true } },
        items: {
          select: {
            quantity: true,
            price: true,
            menuItemName: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getOrderByReference(reference: string) {
    return prisma.order.findUnique({
      where: { reference },
      include: {
        restaurant: {
          select: {
            name: true,
            address: true,
            phone: true,
          },
        },
        items: {
          select: {
            quantity: true,
            price: true,
            menuItemName: true,
            menuItemId: true,
          },
        },
      },
    });
  }

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

  // ✅ UPDATED: Sends delivery code using REAL DB reference
  //

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

    // 5. 🟢 SOCKET BROADCASTS
    try {
      const io = getSocketIO();

      // A. Notify Vendor (Your existing logic)
      io.to(`restaurant_${order.restaurantId}`).emit("order_updated", {
        orderId: order.id,
        status: status,
      });

      // B. Notify Customer (Standard practice so their app updates live)
      io.to(`order_${orderId}`).emit("order_update", updatedOrder);

      // C. 🚀 NEW: Notify Riders if Ready for Pickup
      if (status === "READY_FOR_PICKUP") {
        console.log(`📢 Broadcasting Order ${order.reference} to Riders`);
        sendPushToRiders(
          "New Delivery Alert! 📦",
          `New order from ${updatedOrder.restaurant.name}. Tap to accept!`,
          { orderId: updatedOrder.id },
        ).catch((err) =>
          console.error("Failed to send rider push notifications:", err),
        );
      }
    } catch (e) {
      console.error("Socket emit failed", e);
    }

    // 6. Notifications (Your existing logic)
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
        ).catch((err) => console.error("Failed to send delivery code:", err));
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
}
