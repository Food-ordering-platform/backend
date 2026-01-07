import { PrismaClient } from "../../generated/prisma";
const prisma = new PrismaClient();

export class DispatchService {
  
  // 1. GET DASHBOARD
  static async getDispatcherDashboard(userId: string) {
    // A. Find the Partner Profile
    const partner = await prisma.logisticsPartner.findUnique({
      where: { ownerId: userId },
    });

    if (!partner) throw new Error("User is not a Logistics Partner");

    // B. Get "My Active Orders"
    // Since OrderService AUTO-ASSIGNS them to you, we just fetch your orders.
    const myOrders = await prisma.order.findMany({
      where: {
        logisticsPartnerId: partner.id, // Only my orders
        status: { in: ['PREPARING', 'OUT_FOR_DELIVERY'] } // Active work
      },
      include: { restaurant: true, customer: true },
      orderBy: { createdAt: 'desc' }
    });

    // C. Calculate Stats (Optional - kept for your UI)
    const pendingStats = await prisma.order.aggregate({
      _sum: { deliveryFee: true },
      where: {
        logisticsPartnerId: partner.id,
        status: { in: ["PREPARING", "OUT_FOR_DELIVERY"] }
      }
    });

    const stats = {
      totalJobs: await prisma.order.count({ where: { logisticsPartnerId: partner.id, status: 'DELIVERED' } }),
      hoursOnline: 8.5, 
      rating: 4.9       
    };

    return {
      partnerName: partner.name,
      availableBalance: partner.walletBalance,
      pendingBalance: pendingStats._sum.deliveryFee || 0,
      stats,
      
      // D. Map to Frontend Format
      activeOrders: myOrders.map(order => ({
        id: order.id,
        status: order.status,
        deliveryFee: order.deliveryFee,
        // ✅ ALWAYS send trackingId because you own these orders now
        trackingId: order.trackingId, 
        vendor: { 
            name: order.restaurant.name, 
            address: order.restaurant.address, 
            phone: order.restaurant.phone 
        },
        customer: { 
            name: order.customer.name, 
            address: order.deliveryAddress, 
            phone: order.customer.phone 
        }
      }))
    };
  }

  // 2. MANUAL ACCEPT (Fallback/Safety)
  // Even though we auto-assign, keep this in case you add more logistics partners later 
  // and need to manually claim orders.
  static async acceptOrder(userId: string, orderId: string) {
    const partner = await prisma.logisticsPartner.findUnique({
        where: { ownerId: userId }
    });
    if (!partner) throw new Error("Unauthorized");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Order not found");
    
    if (order.logisticsPartnerId && order.logisticsPartnerId !== partner.id) {
        throw new Error("Order already taken by another company");
    }

    return await prisma.order.update({
        where: { id: orderId },
        data: { logisticsPartnerId: partner.id }
    });
  }

  // 3. GET PUBLIC TASK (For the Rider Link)
  static async getRiderTask(trackingId: string) {
    const order = await prisma.order.findUnique({
      where: { trackingId },
      include: { restaurant: true, customer: true, items: true }
    });
    
    if (!order) throw new Error("Task not found");

    return {
      id: order.id,
      status: order.status,
      deliveryCode: order.deliveryCode,
      // You can implement real distance calculation here later if you want
      distance: "4.2 km", 
      estTime: "15 mins",
      vendor: { 
        name: order.restaurant.name, 
        address: order.restaurant.address, 
        phone: order.restaurant.phone 
      },
      customer: { 
        name: order.customer.name, 
        address: order.deliveryAddress, 
        phone: order.customer.phone 
      },
      items: order.items.map(item => ({
        quantity: item.quantity,
        menuItemName: item.menuItemName
      }))
    };
  }

  // 4. COMPLETE DELIVERY (Rider enters Code)
  static async completeDelivery(trackingId: string, otp: string) {
    const order = await prisma.order.findUnique({ where: { trackingId } });
    if (!order) throw new Error("Order not found");
    
    // Validate OTP
    if (order.deliveryCode !== otp) throw new Error("Incorrect Delivery Code!");

    // Update Status
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED" }
    });

    // Credit Wallet
    if (order.logisticsPartnerId && order.deliveryFee > 0) {
      await prisma.logisticsPartner.update({
        where: { id: order.logisticsPartnerId },
        data: { walletBalance: { increment: order.deliveryFee } }
      });
    }

    return { success: true };
  }
}