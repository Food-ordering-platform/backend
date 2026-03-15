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
import { calculateDistance, calculateDeliveryFee } from "../utils/haversine";
import { PRICING } from "../config/pricing";
import { OrderStateMachine } from "../utils/order-state-machine";
import { sendPushToRiders, sendPushToVendor } from "../utils/push-notification";

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
  return await prisma.$transaction(async (tx) => {
    // 1️⃣ Lock the order row by using `findUnique` inside the transaction
    const order = await tx.order.findUnique({
      where: { reference },
      include: {
        restaurant: { include: { owner: true } },
        customer: true,
      },
    });

    if (!order) return null;

    // 2️⃣ Idempotency check
    if (order.paymentStatus === "PAID") return order;

    // 3️⃣ Update order status inside transaction
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID" },
    });

    // 4️⃣ Send notifications (outside DB update, but still part of transaction logic)
    if (order.customer && order.customer.email) {
      sendOrderStatusEmail(
        order.customer.email,
        order.customer.name,
        order.reference,
        "PENDING",
      ).catch((e) => console.log("Payment success email failed", e));
    }

    if (order.restaurant?.owner?.pushToken) {
      sendPushToVendor(
        order.restaurant.owner.pushToken,
        "New Order Paid! 💰",
        `Order #${order.reference.slice(0, 4).toUpperCase()}`,
      );
    }

    return updatedOrder;
  });
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
}
