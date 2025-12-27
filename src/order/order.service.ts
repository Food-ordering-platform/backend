// food-ordering-platform/backend/backend-main/src/order/order.service.ts

import { OrderStatus, PrismaClient } from "../../generated/prisma";
import { PaymentService } from "../payment/payment.service";
import { randomBytes } from "crypto";
import { sendOrderStatusEmail } from "../utils/mailer";
import { sendPushNotification } from "../utils/notification";
import { getSocketIO } from "../utils/socket";

const prisma = new PrismaClient();

// 💰 NEW PRICING CONSTANTS
const DELIVERY_FEE = 500;   // Changed from 1500 to 500
const PLATFORM_FEE = 350;   // Kept as 350
// Removed TAX_RATE

function generateReference(): string {
  return randomBytes(12).toString("hex");
}

export class OrderService {
  
  // =================================================================
  // 1. CREATE ORDER
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
    customerEmail: string
  ) {
    // A. Verify Restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: true }
    });

    if (!restaurant) throw new Error("Restaurant not found");

    // B. Verify Items & Calculate Subtotal
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

    // C. Calculate Final Total (No Tax, just fees)
    const finalTotal = subtotal + DELIVERY_FEE + PLATFORM_FEE;

    // D. Generate Reference
    let reference = generateReference();
    let referenceExists = true;
    while (referenceExists) {
      const existing = await prisma.order.findUnique({ where: { reference } });
      if (!existing) referenceExists = false;
      else reference = generateReference();
    }

    // E. Save Order
    const order = await prisma.order.create({
      data: {
        customerId,
        restaurantId,
        totalAmount: finalTotal,      
        deliveryFee: DELIVERY_FEE,
        paymentStatus: "PENDING",
        status: "PENDING",
        deliveryAddress,
        deliveryNotes: deliveryNotes || null,
        deliveryLatitude,             
        deliveryLongitude,            
        reference,
        items: {
          create: validItems,
        },
      },
      include: { items: true },
    });

    // F. Initialize Payment
    const checkoutUrl = await PaymentService.initiatePayment(
      finalTotal,
      customerName,
      customerEmail,
      order.reference
    );

    return { order, checkoutUrl };
  }

  // ... (Keep the rest of the methods exactly the same: processSuccessfulPayment, getOrdersByCustomer, etc.)
  
  static async processSuccessfulPayment(reference: string) {
    const order = await prisma.order.findUnique({
      where: { reference },
      include: { 
        restaurant: { include: { owner: true } },
        customer: true 
      }
    });

    if (!order) return null;
    if (order.paymentStatus === "PAID") return order; 

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID" }
    });

    if (order.customer && order.customer.email) {
      sendOrderStatusEmail(order.customer.email, order.customer.name, order.id, "PENDING")
        .catch(e => console.log("Payment success email failed", e));
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
        totalAmount: order.totalAmount
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