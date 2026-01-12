import { OrderStatus, PrismaClient } from "../../generated/prisma";
import { PaymentService } from "../payment/payment.service";
import { randomBytes } from "crypto";
import { sendDeliveryCode, sendOrderStatusEmail } from "../utils/mailer";
import { sendPushNotification } from "../utils/notification";
import { getSocketIO } from "../utils/socket";
import { calculateDistance, calculateDeliveryFee } from "../utils/haversine";
import { PRICING } from "../config/pricing";

const prisma = new PrismaClient();

function generateReference(): string {
  return randomBytes(12).toString("hex");
}

export class OrderService {
  
  // ✅ HELPER: Centralized Calculation Logic
  // Formula: (Total - Delivery - PlatformFee) * 0.85
   static calculateVendorShare(totalAmount: number, deliveryFee: number): number {
    const foodRevenue = totalAmount - (deliveryFee + PRICING.PLATFORM_FEE);
    const vendorShare = foodRevenue * 0.85; // Vendor gets 85% of the food value
    return Math.max(0, vendorShare); // Prevent negative earnings
  }

  // =================================================================
  // 1. GET QUOTE
  // =================================================================
  static async getOrderQuote(
    restaurantId: string,
    deliveryLatitude: number,
    deliveryLongitude: number,
    items: { price: number; quantity: number }[]
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
      deliveryLongitude
    );
    const deliveryFee = calculateDeliveryFee(distance);

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // ✅ FIX: Use Config Constant
    const totalAmount = subtotal + deliveryFee + PRICING.PLATFORM_FEE;

    return {
      subtotal,
      deliveryFee,
      platformFee: PRICING.PLATFORM_FEE,
      totalAmount,
      distanceKm: parseFloat(distance.toFixed(2)),
    };
  }

  // =================================================================
  // 2. CREATE ORDER
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
    idempotencyKey?: string
  ) {
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey },
      });

      if (existingOrder) {
        console.log(`🛡️ Idempotency Hit: Returning existing order ${existingOrder.reference}`);
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
        deliveryLongitude
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

    // ✅ FIX: Use Config Constant
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
      reference
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

      if (order.deliveryCode) {
        sendDeliveryCode(
            order.customer.email, 
            order.deliveryCode, 
            order.id
        ).catch((e: any) => console.error("Delivery code email failed", e));
      }
    }

    if (order.restaurant?.owner?.pushToken) {
      sendPushNotification(
        order.restaurant.owner.pushToken,
        "New Order Paid! 💰",
        `Order #${order.reference.slice(0, 4).toUpperCase()} confirmed. ₦${order.totalAmount}`,
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

  // ✅ 3. GET VENDOR ORDERS (Now uses Helper)
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
        // ✅ Uses the centralized helper (Fixes duplication)
        riderName:order.riderName,
        riderPhone:order.riderPhone,
        vendorFoodTotal: OrderService.calculateVendorShare(order.totalAmount, order.deliveryFee),
      };
    });
  }

  // ✅ 4. DISTRIBUTE EARNINGS (Now uses Helper)
  static async distributeVendorEarnings(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true },
    });

    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }

    // ✅ Uses the centralized helper (Fixes duplication)
    const vendorShare = OrderService.calculateVendorShare(order.totalAmount, order.deliveryFee);

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

  // ... (updateOrderStatus unchanged) ...
  static async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true },
    });
    if (!order) throw new Error("Order not found");

    let newPaymentStatus = order.paymentStatus;

    if (status === "CANCELLED" && order.paymentStatus === "PAID") {
        await PaymentService.refund(order.reference).catch(e => console.error("Refund failed", e));
        newPaymentStatus = "REFUNDED";
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status, paymentStatus: newPaymentStatus },
      include: { customer: true },
    });

    try {
        const io = getSocketIO();
        io.to(`restaurant_${order.restaurantId}`).emit("order_updated", { 
            orderId: order.id,
            status: status 
        });
    } catch (e) {
        console.error("Socket emit failed", e);
    }

    if (status === "PREPARING") {
        if (updatedOrder.customer?.pushToken) {
            sendPushNotification(updatedOrder.customer.pushToken, "Order Accepted!", "The vendor is preparing your food.");
        }
    }

    if (status === "READY_FOR_PICKUP") {
      try {
        const defaultPartner = await prisma.logisticsPartner.findFirst();
        if (defaultPartner) {
          await prisma.order.update({
            where: { id: orderId },
            data: { logisticsPartnerId: defaultPartner.id },
          });
        }

        const io = getSocketIO();
        io.to("dispatchers").emit("new_dispatcher_request", {
          orderId: order.id,
          status: status,
          restaurantName: order.restaurant.name,
          restaurantAddress: order.restaurant.address,
          customerAddress: order.deliveryAddress,
          totalAmount: order.totalAmount,
          deliveryFee: order.deliveryFee,
          pickupTime: new Date().toISOString(),
        });
        
        console.log(`🚚 Rider Requested for Order #${order.reference}`);

      } catch (error) {
        console.error("Auto-assign error:", error);
      }
    }
    
  //  if (status === "DELIVERED") {
  //       // We use 'updatedOrder' to get the latest payment status (in case it changed recently)
  //       if (updatedOrder.paymentStatus === "PAID") {
  //           console.log("✅ Order Delivered & Paid. Distributing...");
  //           await OrderService.distributeVendorEarnings(order.id).catch(console.error);
  //       } else {
  //           console.warn("⚠️ Order Delivered but NOT PAID yet. Earnings will be distributed upon payment.");
  //       }
  //   }

    if (updatedOrder.customer?.email) {
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