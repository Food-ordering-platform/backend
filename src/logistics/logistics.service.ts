import { PrismaClient } from "../../generated/prisma";
const prisma = new PrismaClient();

export class LogisticsService {
  
  // 1. GET PARTNER DASHBOARD (With Full Stats)
  static async getDashboardData(secretKey: string) {
    const partner = await prisma.logisticsPartner.findUnique({
      where: { secretKey },
      include: { 
        orders: { 
          where: { status: { in: ['PREPARING', 'OUT_FOR_DELIVERY',] } }, 
          orderBy: { createdAt: 'desc' },
          include: {
            restaurant: true, // Get Vendor Name
            customer: true,   // Get Customer Name
            items: true       // Get Food Items
          }
        } 
      }
    });

    if (!partner) throw new Error("Invalid Dashboard Link");

    // Calculate Pending Balance
    const pendingStats = await prisma.order.aggregate({
      _sum: { deliveryFee: true },
      where: {
        logisticsPartnerId: partner.id,
        status: { in: ["PREPARING", "OUT_FOR_DELIVERY", ] }
      }
    });

    // Mock Stats (You can calculate these for real later)
    const stats = {
      totalJobs: await prisma.order.count({ where: { logisticsPartnerId: partner.id, status: 'DELIVERED' } }),
      hoursOnline: 8.5, // Placeholder
      rating: 4.9       // Placeholder
    };

    return {
      partnerName: partner.name,
      initials: partner.name.substring(0, 2).toUpperCase(),
      availableBalance: partner.walletBalance,
      pendingBalance: pendingStats._sum.deliveryFee || 0,
      stats,
      activeOrders: partner.orders.map(order => ({
        id: order.id,
        status: order.status,
        deliveryFee: order.deliveryFee,
        createdAt: order.createdAt,
        // Map the details for the UI
        vendor: { name: order.restaurant.name, address: order.restaurant.address, phone: order.restaurant.phone },
        customer: { name: order.customer.name, address: order.customer.address, phone: order.customer.phone },
        // items: order.items.map(i => i.name) // Simple list of item names
      }))
    };
  }

  // 2. GET RIDER TASK (With Full Manifest)
  static async getRiderTask(trackingId: string) {
    const order = await prisma.order.findUnique({
      where: { trackingId },
      include: {
        restaurant: true,
        customer: true,
        items: true
      }
    });
    
    if (!order) throw new Error("Task not found");

    return {
      id: order.id,
      status: order.status,
      deliveryFee: order.deliveryFee,
      deliveryCode: order.deliveryCode, // (Hidden in UI until needed)
      distance: "4.2 km", // You can use Google API later for real distance
      estTime: "15 mins",
      
      vendor: { 
        name: order.restaurant.name, 
        address: order.restaurant.address, 
        phone: order.restaurant.phone 
      },
      customer: { 
        name: order.customer.name, 
        address: order.customer.address, 
        phone: order.customer.phone 
      },
      items: order.items.map(item => ({
        // name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    };
  }

  // 3. COMPLETE DELIVERY (Same as before)
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