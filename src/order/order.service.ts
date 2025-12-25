import { OrderStatus, PrismaClient } from "../../generated/prisma";
import { PaymentService } from "../payment/payment.service";
import { randomBytes } from "crypto";
import { sendOrderStatusEmail } from "../utils/mailer";
import { sendPushNotification } from "../utils/notification";
import { getSocketIO } from "../utils/socket";

const prisma = new PrismaClient();

// Platform Settings
const PLATFORM_DELIVERY_FEE = 500;

// Helper to generate a unique reference
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
    deliveryNotes: string | undefined, // <--- ✅ ADDED PARAMETER
    items: { menuItemId: string; quantity: number; price: number }[],
    customerName: string,
    customerEmail: string
  ) {
    // 1. Fetch Restaurant (Just to ensure it exists)
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include:{owner:true}
    });

    if (!restaurant) {
      throw new Error("Restaurant not found");
    }

    // 2. Fetch Menu Items to get names for the Snapshot
    const menuItemIds = items.map((item) => item.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });

    // Create a map for quick lookup: ID -> Item Data
    const itemsMap = new Map(dbMenuItems.map((item) => [item.id, item]));

    // 3. Generate a Unique Reference
    let reference = generateReference();
    let referenceExists = true;
    while (referenceExists) {
      const existing = await prisma.order.findUnique({ where: { reference } });
      if (!existing) referenceExists = false;
      else reference = generateReference();
    }

    // 4. Create order in DB with Snapshots and Reference
    const order = await prisma.order.create({
      data: {
        customerId,
        restaurantId,
        totalAmount,
        deliveryFee: PLATFORM_DELIVERY_FEE,
        paymentStatus: "PENDING",
        status: "PENDING",
        deliveryAddress,
        deliveryNotes: deliveryNotes || null, // <--- ✅ SAVED TO DB
        reference,
        items: {
          create: items.map((i) => {
            const originalItem = itemsMap.get(i.menuItemId);
            if (!originalItem)
              throw new Error(`Menu item ${i.menuItemId} not found`);

            return {
              // We only store the ID loosely now, no relation constraint
              menuItemId: i.menuItemId,
              menuItemName: originalItem.name, // <--- SNAPSHOT: Name
              quantity: i.quantity,
              price: i.price,
            };
          }),
        },
      },
      include: { items: true },
    });

    if (restaurant.owner?.pushToken) {
      console.log("🔔 Sending Push to Vendor...");
      sendPushNotification(
        restaurant.owner.pushToken,
        "New Order Received! 📝",
        `Order #${order.reference.slice(0, 4).toUpperCase()} worth ₦${totalAmount}`,
        { orderId: order.id }
      );
    }

    // Send "Order Received" Email immediately
    if(customerEmail){
      sendOrderStatusEmail(
        customerEmail, customerName, order.id, "PENDING"
      ).catch(e => console.log("Initial order email failed", e));
    }
    try {
      const io = getSocketIO();
      // Send to the Restaurant's specific room
      io.to(`restaurant_${restaurantId}`).emit("new_order", {
        message: "New Order Received! 🔔",
        orderId: order.id,
        totalAmount
      });
      console.log(`Socket emitted to restaurant_${restaurantId}`);
    } catch (error) {
      console.log("Socket emit failed", error); 
    }

    // 5. Initialize payment
    const checkoutUrl = await PaymentService.initiatePayment(
      totalAmount,
      customerName,
      customerEmail,
      order.reference
    );

    return { order, checkoutUrl };
  }

  // Get all orders for a customer
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
        // We can still get the restaurant details via relation
        restaurant: { select: { name: true, imageUrl: true } },
        items: {
          select: {
            quantity: true,
            price: true,
            menuItemName: true, // <--- Retrieve Snapshot Name
            // No menuItem relation
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

  //---------------------LOGIC FOR MOBILE VENDOR APP -------------------------------//

  // 1️⃣ VENDOR DASHBOARD: Get all orders for the restaurant
  static async getVendorOrders(restaurantId: string) {
    return await prisma.order.findMany({
      // Only show orders that are PAID or REFUNDED (History)
      where: { restaurantId, paymentStatus: { in : ["PAID", "REFUNDED"] } },
      include: {
        items: true,
        customer: { select: { name: true, phone: true, address: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // 2. UPDATE ORDER STATUS BASED ON VENDOR ACTIONS
  static async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Order not found");

    let newPaymentStatus = order.paymentStatus;

    // SAFETY NET: If Vendor Rejects (CANCELLED) & User Paid -> Auto Refund
    if (status === "CANCELLED" && order.paymentStatus === "PAID") {
      try {
        console.log(`Auto-refunding Order ${order.reference}...`);
        await PaymentService.refund(order.reference);
        newPaymentStatus = "REFUNDED";
      } catch (error) {
        console.error("Refund failed. Admin intervention required.");
      }
    }
    
    // 3. Update Database AND Return Customer Info
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status, paymentStatus: newPaymentStatus },
      include: { customer: true }, // <--- CRITICAL: Get customer email
    });

    // 4. [NEW] Send Notification
    if (updatedOrder.customer && updatedOrder.customer.email) {
      // We don't await this so it runs in background (optional)
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