import { PrismaClient } from "../../generated/prisma";
const prisma = new PrismaClient();

export class DispatchService {
  
  // 1. GET DASHBOARD
  static async getDispatcherDashboard(userId: string) {
    const partner = await prisma.logisticsPartner.findUnique({
      where: { ownerId: userId },
    });

    if (!partner) throw new Error("User is not a Logistics Partner");

    // ✅ FIX: Removed the conflicting "logisticsPartnerId: partner.id" line
    // Now it strictly checks: Is it Mine? OR Is it Unassigned?
    const allOrders = await prisma.order.findMany({
      where: {
        status: { in: ['PREPARING', 'OUT_FOR_DELIVERY'] },
        OR: [
            { logisticsPartnerId: partner.id }, // Mine
            { logisticsPartnerId: null }        // Unassigned (Previous/New orders)
        ]
      },
      include: { restaurant: true, customer: true },
      orderBy: { createdAt: 'desc' }
    });

    // Stats Logic (Unchanged)
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
      
      activeOrders: allOrders.map(order => ({
        id: order.id,
        status: order.status,
        deliveryFee: order.deliveryFee,
        // Logic: If I own it, share link. If unassigned, accept button.
        trackingId: order.logisticsPartnerId === partner.id ? order.trackingId : null, 
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

  // ... (Keep acceptOrder, getRiderTask, completeDelivery exactly as they were)
  static async acceptOrder(userId: string, orderId: string) {
    const partner = await prisma.logisticsPartner.findUnique({ where: { ownerId: userId } });
    if (!partner) throw new Error("Unauthorized");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Order not found");
    
    if (order.logisticsPartnerId && order.logisticsPartnerId !== partner.id) {
        throw new Error("Order already taken");
    }

    return await prisma.order.update({
        where: { id: orderId },
        data: { logisticsPartnerId: partner.id }
    });
  }

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

  static async completeDelivery(trackingId: string, otp: string) {
    const order = await prisma.order.findUnique({ where: { trackingId } });
    if (!order) throw new Error("Order not found");
    if (order.deliveryCode !== otp) throw new Error("Incorrect Delivery Code!");

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED" }
    });

    if (order.logisticsPartnerId && order.deliveryFee > 0) {
      await prisma.logisticsPartner.update({
        where: { id: order.logisticsPartnerId },
        data: { walletBalance: { increment: order.deliveryFee } }
      });
    }

    return { success: true };
  }
}