import {
  OrderStatus,
  PrismaClient,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  PaymentStatus
} from "@prisma/client";
import { PaymentService } from "../payment/payment.service";
import { randomBytes } from "crypto";
import {
  sendDeliveryCode,
  sendOrderStatusEmail,
} from "../utils/email/email.service";
import { sendPushNotification } from "../utils/notification";
import { calculateDistance, calculateDeliveryFee } from "../utils/haversine";
import { PRICING, calculateVendorShare } from "../config/pricing";
import { OrderStateMachine } from "../utils/order-state-machine";
import { sendPushToRiders, sendPushToVendor } from "../utils/push-notification";

const prisma = new PrismaClient();

function generateReference(): string {
  return randomBytes(12).toString("hex");
}

export class OrderService {
 

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
    // 1. Idempotency Check (With Restaurant Status Validation)
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey },
        // Fetch the restaurant's current open status dynamically
        include: { restaurant: { select: { isOpen: true } } } 
      });

      if (existingOrder) {
        console.log(
          `🛡️ Idempotency Hit: Returning existing order ${existingOrder.reference}`,
        );

        // 🟢 THE FIX: Block the checkout URL if they are trying to pay after the restaurant closed!
        if (existingOrder.paymentStatus === PaymentStatus.PENDING && !existingOrder.restaurant.isOpen) {
          throw new Error("Checkout failed: This restaurant has closed since you initiated this order. You can no longer complete this payment.");
        }

        return {
          order: existingOrder,
          checkoutUrl: existingOrder.checkoutUrl,
        };
      }
    }

    // 2. Fetch Restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: true },
    });

    if (!restaurant) throw new Error("Restaurant not found");

    // 🟢 EDGE CASE FIX: Block brand new checkouts if the restaurant is closed!
    if (!restaurant.isOpen) {
      throw new Error("Checkout failed: This restaurant is currently closed. Please check back later.");
    }

    // 3. Calculate Distance and Delivery Fee
    let deliveryFee = 0;
    let deliveryDistance = 0
    if (
      restaurant.latitude &&
      restaurant.longitude &&
      deliveryLatitude &&
      deliveryLongitude
    ) {
      deliveryDistance = calculateDistance(
        restaurant.latitude,
        restaurant.longitude,
        deliveryLatitude,
        deliveryLongitude,
      );
      deliveryFee = calculateDeliveryFee(deliveryDistance);
    } else {
      deliveryFee = 800;
      deliveryDistance = 2
    }

    // 4. Validate Menu Items and Subtotal
    const menuItemIds = items.map((item) => item.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });
    const itemsMap = new Map(dbMenuItems.map((item) => [item.id, item]));

    let subtotal = 0;

    const validItems = items.map((i) => {
      const originalItem = itemsMap.get(i.menuItemId);
      if (!originalItem) throw new Error(`Menu item not found`);

      //  EDGE CASE FIX: Check if the specific item is still available!
      if (!originalItem.available) {
         throw new Error(`Checkout failed: ${originalItem.name} is no longer available.`);
      }

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

    // 5. Generate unique reference
    let reference = generateReference();
    let referenceExists = true;
    while (referenceExists) {
      const existing = await prisma.order.findUnique({ where: { reference } });
      if (!existing) referenceExists = false;
      else reference = generateReference();
    }

    // 6. Initiate Payment Gateway
    const checkoutUrl = await PaymentService.initiatePayment(
      finalTotal,
      customerName,
      customerEmail,
      reference,
    );

    // 7. Generate Delivery Code
    const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();

    // 8. Create Order in Database
    const order = await prisma.order.create({
      data: {
        customerId,
        restaurantId,
        totalAmount: finalTotal,
        deliveryFee: deliveryFee,
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.PENDING,
        deliveryDistance:parseFloat(deliveryDistance.toFixed(2)),
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
 // The rewritten, bulletproof processor
static async processSuccessfulPayment(reference: string, paystackAmountInKobo: number) {
  
  // 1. Fetch the order details first (No lock needed yet)
  const order = await prisma.order.findUnique({
    where: { reference },
    include: {
      restaurant: { include: { owner: true } },
      customer: true,
    },
  });

  if (!order) return null;

  // 2. THE UNDERPAYMENT CHECK
  // Paystack sends kobo, so divide by 100.
  const amountPaidInNaira = paystackAmountInKobo / 100;
  if (amountPaidInNaira < order.totalAmount) {
    console.error(`Underpayment on ${reference}! Paid: ${amountPaidInNaira}, Expected: ${order.totalAmount}`);
    // Update to FAILED_UNDERPAID safely
    await prisma.order.update({
       where: { id: order.id },
       data: { status: OrderStatus.UNDERPAID }
    });
    return null; 
  }

  // 3. THE OPTIMISTIC LOCK (The Ultimate Idempotency Check)
  // Instead of checking the status in Node.js, we force Postgres to check it.
  const updatedOrderResult = await prisma.order.updateMany({
    where: { 
      id: order.id,
      paymentStatus: "PENDING" // <--- CRITICAL: Fails instantly if already PAID
    },
    data: { paymentStatus: "PAID" },
  });

  // If count is 0, it means Webhook B arrived late and the status was already PAID.
  // We silently drop Webhook B. Idempotency successful!
  if (updatedOrderResult.count === 0) {
    console.log(`Duplicate webhook ignored. Order ${reference} is already processed.`);
    return order;
  }

  // 4. NOTIFICATIONS (100% Safe)
  // We only reach this line if count === 1 (meaning THIS specific webhook won the race)
  if (order.customer && order.customer.email) {
    sendOrderStatusEmail(
      order.customer.email,
      order.customer.name,
      order.reference,
      "PAID" // Changed from PENDING to PAID
    ).catch((e) => console.log("Payment success email failed", e));
  }

  if (order.restaurant?.owner?.pushToken) {
    sendPushToVendor(
      order.restaurant.owner.pushToken,
      "New Order Paid! 💰",
      `Order #${order.reference.slice(0, 4).toUpperCase()}`
    ).catch((e) => console.log("Push failed", e)); // Always catch floating promises!
  }

  return order;
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
