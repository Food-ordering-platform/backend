// file: food-ordering-platform/backend/backend-main/src/logistics/logistics.service.ts

import { PrismaClient } from "../../generated/prisma";
const prisma = new PrismaClient();

export class LogisticsService {
  
  // 1. GET DASHBOARD (For Manager App - Requires Login)
  static async getDashboardData(userId: string) {
    const partner = await prisma.logisticsPartner.findUnique({
      where: { ownerId: userId },
      include: { 
        orders: { 
          where: { status: { in: ['PREPARING', 'OUT_FOR_DELIVERY'] } }, 
          orderBy: { createdAt: 'desc' },
          include: { restaurant: true, customer: true, items: true }
        } 
      }
    });

    if (!partner) throw new Error("User is not a Logistics Partner");

    // Calculate Pending Balance
    const pendingStats = await prisma.order.aggregate({
      _sum: { deliveryFee: true },
      where: {
        logisticsPartnerId: partner.id,
        status: { in: ["PREPARING", "OUT_FOR_DELIVERY"] }
      }
    });

    const stats = {
      totalJobs: await prisma.order.count({ where: { logisticsPartnerId: partner.id, status: 'DELIVERED' } }),
      hoursOnline: 8.5, // Mock data
      rating: 4.9       // Mock data
    };

    return {
      partnerName: partner.name,
      availableBalance: partner.walletBalance,
      pendingBalance: pendingStats._sum.deliveryFee || 0,
      stats,
      activeOrders: partner.orders.map(order => ({
        id: order.id,
        status: order.status,
        deliveryFee: order.deliveryFee, // Manager sees this
        trackingId: order.trackingId,
        vendor: { name: order.restaurant.name, address: order.restaurant.address, phone: order.restaurant.phone },
        customer: { name: order.customer.name, address: order.customer.address, phone: order.customer.phone }
      }))
    };
  }

  // 2. GET RIDER TASK (For Web Link - Public/No Login)
  static async getRiderTask(trackingId: string) {
    const order = await prisma.order.findUnique({
      where: { trackingId },
      include: { restaurant: true, customer: true, items: true }
    });
    
    if (!order) throw new Error("Task not found");

    return {
      id: order.id,
      status: order.status,
      // REMOVED: deliveryFee (Rider doesn't need to know)
      deliveryCode: order.deliveryCode,
      distance: "4.2 km", // Placeholder
      estTime: "15 mins", // Placeholder
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
        quantity: item.quantity,
        menuItemName: item.menuItemName
        // REMOVED: price (Rider doesn't need to know item costs either)
      }))
    };
  }

  // 3. COMPLETE DELIVERY
  static async completeDelivery(trackingId: string, otp: string) {
    const order = await prisma.order.findUnique({ where: { trackingId } });
    if (!order) throw new Error("Order not found");
    if (order.deliveryCode !== otp) throw new Error("Incorrect Delivery Code!");

    // 1. Mark Order Delivered
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED" }
    });

    // 2. Credit Logistics Company Wallet
    if (order.logisticsPartnerId && order.deliveryFee > 0) {
      await prisma.logisticsPartner.update({
        where: { id: order.logisticsPartnerId },
        data: { walletBalance: { increment: order.deliveryFee } }
      });

      // Create Transaction Record (Best Practice)
      if (order.logisticsPartnerId) {
         // You'd fetch the ownerId first to link the transaction, 
         // but for now, the wallet update is sufficient.
      }
    }

    return { success: true };
  }
}