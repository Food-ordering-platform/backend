import { OrderStatus, PrismaClient } from "../../generated/prisma";
import { PaymentService } from "../payment/payment.service";
import { randomBytes } from "crypto";
import { sendOrderStatusEmail } from "../utils/mailer";
import { sendPushNotification } from "../utils/notification";
import { getSocketIO } from "../utils/socket";

const prisma = new PrismaClient();
const PLATFORM_DELIVERY_FEE = 500;

function generateReference(): string {
  return randomBytes(12).toString("hex");
}

export class OrderService {
  // Create order AND initialize payment
  static async createOrderWithPayment(
    customerId: string,
    restaurantId: string,
    totalAmount: number,
    deliveryAddress: string,
    deliveryNotes: string | undefined,
    deliveryLatitude : number | undefined,
    deliveryLongitude : number | undefined,
    items: { menuItemId: string; quantity: number; price: number }[],
    customerName: string,
    customerEmail: string
  ) {
    // 1. Fetch Restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: true }
    });

    if (!restaurant) throw new Error("Restaurant not found");

    // 2. Fetch Menu Items
    const menuItemIds = items.map((item) => item.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });
    const itemsMap = new Map(dbMenuItems.map((item) => [item.id, item]));

    // 3. Unique Reference
    let reference = generateReference();
    let referenceExists = true;
    while (referenceExists) {
      const existing = await prisma.order.findUnique({ where: { reference } });
      if (!existing) referenceExists = false;
      else reference = generateReference();
    }

    // 4. Create Order (Status: PENDING)
    const order = await prisma.order.create({
      data: {
        customerId,
        restaurantId,
        totalAmount,
        deliveryFee: PLATFORM_DELIVERY_FEE,
        paymentStatus: "PENDING",
        status: "PENDING",
        deliveryAddress,
        deliveryNotes: deliveryNotes || null,
        deliveryLatitude,
        deliveryLongitude,
        reference,
        items: {
          create: items.map((i) => {
            const originalItem = itemsMap.get(i.menuItemId);
            if (!originalItem) throw new Error(`Menu item ${i.menuItemId} not found`);
            return {
              menuItemId: i.menuItemId,
              menuItemName: originalItem.name,
              quantity: i.quantity,
              price: i.price,
            };
          }),
        },
      },
      include: { items: true },
    });

    // ❌ ALL NOTIFICATIONS REMOVED FROM HERE
    // No Push, No Socket, No Email. Silence until payment.

    // 5. Initialize payment
    const checkoutUrl = await PaymentService.initiatePayment(
      totalAmount,
      customerName,
      customerEmail,
      order.reference
    );

    return { order, checkoutUrl };
  }

  // 👇 ✅ EVERYTHING HAPPENS HERE NOW
  static async processSuccessfulPayment(reference: string) {
    // 1. Fetch order with Restaurant Owner AND Customer info
    const order = await prisma.order.findUnique({
      where: { reference },
      include: { 
        restaurant: { include: { owner: true } },
        customer: true // <--- ✅ Need this to email the customer
      }
    });

    if (!order) return null;
    if (order.paymentStatus === "PAID") return order; // Idempotency check

    // 2. Update Status to PAID
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID" }
    });

    // 3. 📧 Send "Order Placed" Email to Customer
    if (order.customer && order.customer.email) {
      console.log(`📧 Sending 'Order Placed' email to ${order.customer.email}`);
      sendOrderStatusEmail(
        order.customer.email, 
        order.customer.name, 
        order.id, 
        "PENDING" // This triggers the "Order Placed" template in your mailer
      ).catch(e => console.log("Payment success email failed", e));
    }

    // 4. 🔔 Send Push Notification to Vendor
    if (order.restaurant?.owner?.pushToken) {
      console.log("🔔 Payment Confirmed! Sending Push to Vendor...");
      sendPushNotification(
        order.restaurant.owner.pushToken,
        "New Order Paid! 💰",
        `Order #${order.reference.slice(0, 4).toUpperCase()} confirmed. ₦${order.totalAmount}`,
        { orderId: order.id }
      );
    }

    // 5. 🔌 Emit Socket Event to Vendor Dashboard
    try {
      const io = getSocketIO();
      io.to(`restaurant_${order.restaurantId}`).emit("new_order", {
        message: "New Order Paid! 🔔",
        orderId: order.id,
        totalAmount: order.totalAmount
      });
      console.log(`Socket emitted to restaurant_${order.restaurantId}`);
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
      where: { restaurantId, paymentStatus: { in : ["PAID", "REFUNDED"] } },
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