import { OrderStatus, PrismaClient } from "../../generated/prisma";
import { PaymentService } from "../payment/payment.service";
import { randomBytes } from "crypto";
import { sendOrderStatusEmail } from "../utils/mailer";
import { sendPushNotification } from "../utils/notification";
import { getSocketIO } from "../utils/socket";
import { calculateDistance, calculateDeliveryFee } from "../utils/haversine";
import { OrderStateMachine } from "../utils/order-state-machine";
import { PRICING } from "../config/pricing";

const prisma = new PrismaClient();

// 💰 PRICING CONSTANTS (Source of Truth)
const PLATFORM_FEE = 350;

function generateReference(): string {
  return randomBytes(12).toString("hex");
}

export class OrderService {
  // =================================================================
  // 1. GET QUOTE (New Endpoint for Frontend)
  // =================================================================
  static async getOrderQuote(
    restaurantId: string,
    deliveryLatitude: number,
    deliveryLongitude: number,
    items: { price: number; quantity: number }[]
  ) {
    // A. Verify Restaurant Location
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { latitude: true, longitude: true },
    });

    if (!restaurant || !restaurant.latitude || !restaurant.longitude) {
      throw new Error("Restaurant location not available for calculation.");
    }

    // B. Calculate Distance & Delivery Fee (Backend Logic)
    const distance = calculateDistance(
      restaurant.latitude,
      restaurant.longitude,
      deliveryLatitude,
      deliveryLongitude
    );
    const deliveryFee = calculateDeliveryFee(distance);

    // C. Calculate Subtotal
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // D. Final Total
    const totalAmount = subtotal + deliveryFee + PLATFORM_FEE;

    return {
      subtotal,
      deliveryFee,
      platformFee: PLATFORM_FEE,
      totalAmount,
      distanceKm: parseFloat(distance.toFixed(2)),
    };
  }

  // =================================================================
  // 2. CREATE ORDER (Existing - slightly refactored to match logic)
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
    // 🛡️ 1. Idempotency Check
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
          checkoutUrl: existingOrder.checkoutUrl,
        };
      }
    }

    // A. Verify Restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: true },
    });

    if (!restaurant) throw new Error("Restaurant not found");

    // B. Calculate Delivery Fee (Backend Logic)
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
      deliveryFee = 500; // Fallback (should be rare with enforced coords)
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

    // F. Initialize Payment
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
        idempotencyKey,
        checkoutUrl,
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

  // =================================================================
  // 3. GET ORDERS (Updated to include checkoutUrl)
  // =================================================================
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
        checkoutUrl: true, // ✅ ADDED: Needed for re-payment
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
            // latitude/longitude not needed for frontend display usually
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
        // checkoutUrl is included by default with 'findUnique' unless select is used,
        // but 'include' combines with default scalar selection.
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

    // ✅ Post-process the data to add 'vendorFoodTotal'
    return orders.map((order) => {
        return {
            ...order,
            // Calculate it here once. 
            // If you change the fee in config, this updates automatically.
            vendorFoodTotal: order.totalAmount - ((order.deliveryFee + PRICING.PLATFORM_FEE) * 0.85 )
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

    // LOGIC: Total - Delivery - Platform Fee = Food Money
    const foodRevenue = order.totalAmount - (order.deliveryFee - PRICING.PLATFORM_FEE);
    const vendorShare = foodRevenue * 0.85; // 85% for Vendor

    // Create the Transaction Record
    await prisma.transaction.create({
      data: {
        userId: order.restaurant.ownerId, // Vendor gets the money
        amount: vendorShare,
        type: "CREDIT",
        category: "ORDER_EARNING",
        status: "SUCCESS",
        orderId: order.id,
        description: `Earnings for Order #${order.reference}`,
      },
    });
  }

  static async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include:{restaurant:true} });
    if (!order) throw new Error("Order not found");

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

    // ============================================================
    // ✅ NEW AUTOMATIC DISPATCH LOGIC
    // ============================================================
    try {
        const io = getSocketIO();
        
        // As soon as Vendor says "CONFIRMED" (Accepts), we notify Dispatchers
        if (status === "PREPARING") {
            
            // Broadcast to the global "dispatchers" room
            io.to("dispatchers").emit("new_dispatcher_request", {
                orderId: order.id,
                status: status,
                restaurantName: order.restaurant.name,
                restaurantAddress: order.restaurant.address || "Warri", 
                customerAddress: order.deliveryAddress,
                totalAmount: order.totalAmount,
                time: new Date().toISOString()
            });
            
            console.log(`🚀 Auto-Dispatched Order #${order.reference} to Riders`);
        }
    } catch (error) {
        console.log("Socket emit failed", error);
    }

    if (status === "DELIVERED" && order.paymentStatus === "PAID") {
        try {
            await OrderService.distributeVendorEarnings(order.id);
        } catch (error) {
            console.error("CRITICAL: Failed to distribute earnings", error);
            // In a real app, you'd send an alert to Admin here
        }
    }

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
