import { PrismaClient } from "../../generated/prisma";
const prisma = new PrismaClient();

export class DispatchService {
  
  // 1. GET DASHBOARD (For Logistics Partner Manager or DISPATCHER)
  static async getDispatcherDashboard(userId: string) {
    const partner = await prisma.logisticsPartner.findUnique({
      where: { ownerId: userId },
      include: { 
        orders: { 
          where: { status: { in: ['PREPARING'] } }, 
          orderBy: { createdAt: 'desc' },
          include: { restaurant: true, customer: true, items: true }
        } 
      }
    });

    if (!partner) throw new Error("User is not a Logistics Partner");

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
      activeOrders: partner.orders.map(order => ({
        id: order.id,
        status: order.status,
        deliveryFee: order.deliveryFee,
        trackingId: order.trackingId,
        vendor: { name: order.restaurant.name, address: order.restaurant.address, phone: order.restaurant.phone },
        customer: { name: order.customer.name, address: order.customer.address, phone: order.customer.phone }
      }))
    };
  }

  // 2. GET RIDER DASHBOARD (For Mobile App Rider)
  // static async getRiderDashboard(userId: string) {
  //   // A. Date Ranges
  //   const todayStart = new Date();
  //   todayStart.setHours(0, 0, 0, 0);

  //   // B. Calculate Stats
  //   const completedOrders = await prisma.order.count({
  //     where: {
  //       riderId: userId,
  //       status: "DELIVERED",
  //       updatedAt: { gte: todayStart }
  //     }
  //   });

  //   // Assume we track rider earnings in Transaction table, or calculate from Orders delivered
  //   // For now, let's sum deliveryFee of delivered orders as a proxy for revenue
  //   const earnings = await prisma.order.aggregate({
  //       _sum: { deliveryFee: true },
  //       where: {
  //           riderId: userId,
  //           status: "DELIVERED",
  //           updatedAt: { gte: todayStart }
  //       }
  //   });

  //   // C. Get Available Requests (Pool of unassigned orders)
  //   // Orders that are PREPARING (Vendor accepted) but have no rider
  //   const availableOrders = await prisma.order.findMany({
  //     where: {
  //       status: "PREPARING", 
  //       riderId: null
  //     },
  //     include: {
  //       restaurant: { select: { name: true, address: true, phone:true } },
  //       customer: { select: { name:true, address: true, phone:true } }
  //     },
  //     orderBy: { createdAt: "desc" }
  //   });

  //   return {
  //     stats: {
  //       completed: completedOrders,
  //       revenue: earnings._sum.deliveryFee || 0,
  //       active: await prisma.order.count({ where: { riderId: userId, status: { not: "DELIVERED" } } })
  //     },
  //     requests: availableOrders.map(o => ({
  //       id: o.id,
  //       vendor: o.restaurant.name,
  //       vendorAddress: o.restaurant.address,
  //       customerAddress: o.deliveryAddress,
  //       amount: o.deliveryFee, // Rider sees delivery fee
  //       time: o.createdAt,
  //       status: o.status
  //     }))
  //   };
  // }

  // 3. ACCEPT ORDER (Rider)
  static async acceptOrder(riderId: string, orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Order not found");
    if (order.riderId) throw new Error("Order already taken");

    // Assign rider
    return await prisma.order.update({
        where: { id: orderId },
        data: { riderId: riderId }
    });
  }

  // 4. GET RIDER TASK (For Web Link - Public)
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
        address: order.customer.address, 
        phone: order.customer.phone 
      },
      items: order.items.map(item => ({
        quantity: item.quantity,
        menuItemName: item.menuItemName
      }))
    };
  }

  // 5. COMPLETE DELIVERY
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