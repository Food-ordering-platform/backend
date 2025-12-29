// food-ordering-platform/backend/backend-main/src/order/order.service.ts

import { OrderStatus, PrismaClient } from "../../generated/prisma";
import { PaymentService } from "../payment/payment.service";
import { randomBytes } from "crypto";
import { sendOrderStatusEmail } from "../utils/mailer";
import { sendPushNotification } from "../utils/notification";
import { getSocketIO } from "../utils/socket";
import { calculateDistance, calculateDeliveryFee } from "../utils/haversine";
import { OrderStateMachine } from "../utils/order-state-machine";

const prisma = new PrismaClient();

// 💰 NEW PRICING CONSTANTS
const DELIVERY_FEE = 500; // Changed from 1500 to 500
const PLATFORM_FEE = 350; 

function generateReference(): string {
  return randomBytes(12).toString("hex");
}

export class OrderService {
  // =================================================================
  // 1. CREATE ORDER (WITH IDEMPOTENCY)
  // =================================================================
  static async createOrderWithPayment(
    customerId: string,
    restaurantId: string,
    deliveryAddress: string,
    deliveryNotes: string | undefined,
    deliveryLatitude: number | undefined,
    deliveryLongitude: number | undefined,
    items: { menuItemId: string; quantity: number }[],
    customerName: string,
    customerEmail: string,
    idempotencyKey?: string // 🛡️ Optional key
  ) {
    // 🛡️ 1. Idempotency Check
    // If we've seen this key before, return the EXISTING order and checkout URL immediately.
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey },
      });

      if (existingOrder) {
        console.log(
          `🛡️ Idempotency Hit: Returning existing order ${existingOrder.reference}`
        );
        return {
          order: existingOrder,
          checkoutUrl: existingOrder.checkoutUrl, // Return the cached URL
        };
      }
    }

    // A. Verify Restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: true },
    });

    if (!restaurant) throw new Error("Restaurant not found");

    // B. Calculate Delivery Fee
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
        deliveryLongitude
      );
      deliveryFee = calculateDeliveryFee(distance);
    } else {
      deliveryFee = 500;
    }

    // C. Verify Items & Calculate Subtotal
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

    // D. Calculate Final Total
    const finalTotal = subtotal + deliveryFee + PLATFORM_FEE;

    // E. Generate Reference
    let reference = generateReference();
    let referenceExists = true;
    while (referenceExists) {
      const existing = await prisma.order.findUnique({ where: { reference } });
      if (!existing) referenceExists = false;
      else reference = generateReference();
    }

    // F. Initialize Payment (Get URL before saving order to store it)
    // Note: We create order first usually to link reference, but to store checkoutUrl we need to init payment.
    // However, initPayment needs 'reference'.
    // Logic: 1. Init Payment with generated ref -> 2. Save Order with ref AND checkoutUrl.
    const checkoutUrl = await PaymentService.initiatePayment(
      finalTotal,
      customerName,
      customerEmail,
      reference
    );

    // G. Save Order
    const order = await prisma.order.create({
      data: {
        customerId,
        restaurantId,
        totalAmount: finalTotal,
        deliveryFee: deliveryFee,
        paymentStatus: "PENDING",
        status: "PENDING",
        deliveryAddress,
        deliveryNotes: deliveryNotes || null,
        deliveryLatitude,
        deliveryLongitude,
        reference,
        idempotencyKey, // 🛡️ Save key
        checkoutUrl, // 🛡️ Save URL
        items: {
          create: validItems,
        },
      },
      include: { items: true },
    });

    return { order, checkoutUrl };
  }
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
      sendOrderStatusEmail(
        order.customer.email,
        order.customer.name,
        order.id,
        "PENDING"
      ).catch((e) => console.log("Payment success email failed", e));
    }

    if (order.restaurant?.owner?.pushToken) {
      sendPushNotification(
        order.restaurant.owner.pushToken,
        "New Order Paid! 💰",
        `Order #${order.reference.slice(0, 4).toUpperCase()} confirmed. ₦${
          order.totalAmount
        }`,
        { orderId: order.id }
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
    return await prisma.order.findMany({
      where: { restaurantId, paymentStatus: { in: ["PAID", "REFUNDED"] } },
      include: {
        items: true,
        customer: { select: { name: true, phone: true, address: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Order not found");

    // 🛑 DFA VALIDATION LAYER
    // Ensure the transition satisfies the Finite Automata rules
    OrderStateMachine.validateTransition(order.status, status);

    let newPaymentStatus = order.paymentStatus;

    if (status === "CANCELLED" && order.paymentStatus === "PAID") {
      try {
        console.log(`Auto-refunding Order ${order.reference}...`);
        await PaymentService.refund(order.reference);
        newPaymentStatus = "REFUNDED";
      } catch (error) {
        console.error("Refund failed. Admin intervention required.");
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status, paymentStatus: newPaymentStatus },
      include: { customer: true },
    });

    if (updatedOrder.customer && updatedOrder.customer.email) {
      sendOrderStatusEmail(
        updatedOrder.customer.email,
        updatedOrder.customer.name,
        updatedOrder.id,
        status
      );
    }

    return updatedOrder;
  }
}
