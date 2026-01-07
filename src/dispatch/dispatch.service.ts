import { randomBytes } from "crypto";
import { PrismaClient } from "../../generated/prisma";
import { getSocketIO } from "../utils/socket"; 
const prisma = new PrismaClient();

const generateTrackingId = () => "TRK-" + randomBytes(4).toString("hex").toUpperCase();

export class DispatchService {
  // 1. GET DASHBOARD (Greedy Version)
  static async getDispatcherDashboard(userId: string) {
    const partner = await prisma.logisticsPartner.findUnique({
      where: { ownerId: userId },
    });

    if (!partner) throw new Error("User is not a Logistics Partner");

    // Fetch Assigned OR Unassigned orders
    const allOrders = await prisma.order.findMany({
      where: {
        status: { in: ['PREPARING', 'OUT_FOR_DELIVERY'] },
        OR: [
            { logisticsPartnerId: partner.id }, 
            { logisticsPartnerId: null }        
        ]
      },
      include: { restaurant: true, customer: true },
      orderBy: { createdAt: 'desc' }
    });

    const pendingStats = await prisma.order.aggregate({
      _sum: { deliveryFee: true },
      where: {
        logisticsPartnerId: partner.id,
        status: { in: ["PREPARING", "OUT_FOR_DELIVERY"] }
      }
    });

    const stats = {
      totalJobs: await prisma.order.count({ where: { logisticsPartnerId: partner.id, status: 'DELIVERED' } }),
      hoursOnline: 12, 
      rating: 5.0       
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

  // ... (Existing acceptOrder) ...
  static async acceptOrder(userId: string, orderId: string) {
    const partner = await prisma.logisticsPartner.findUnique({ where: { ownerId: userId } });
    if (!partner) throw new Error("Unauthorized");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Order not found");
    
    if (order.logisticsPartnerId && order.logisticsPartnerId !== partner.id) {
        throw new Error("Order already taken");
    }

    const trackingId = order.trackingId || generateTrackingId();

    return await prisma.order.update({
        where: { id: orderId },
        data: { logisticsPartnerId: partner.id, trackingId }
    });
  }

  // ✅ NEW: PICKUP ORDER (Changes status to OUT_FOR_DELIVERY)
  static async pickupOrder(trackingId: string) {
    const order = await prisma.order.findUnique({ where: { trackingId } });
    if (!order) throw new Error("Task not found");

    if (order.status !== "PREPARING") {
        throw new Error("Order is not ready for pickup or already active.");
    }

    // Update Status
    const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status: "OUT_FOR_DELIVERY" }
    });

    // Notify Dispatcher Dashboard
    const io = getSocketIO();
    io.to("dispatchers").emit("order_updated", { orderId: order.id, status: "OUT_FOR_DELIVERY" });

    return { success: true, status: updatedOrder.status };
  }

  // ✅ COMPLETE DELIVERY
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
    
    const io = getSocketIO();
    io.to("dispatchers").emit("order_delivered", { orderId: order.id });

    return { success: true };
  }

  // ✅ GET PUBLIC TASK
  static async getRiderTask(trackingId: string) {
    const order = await prisma.order.findUnique({
      where: { trackingId },
      include: { restaurant: true, customer: true, items: true }
    });
    
    if (!order) throw new Error("Task not found");

    return {
      id: order.id,
      status: order.status,
      // Only send delivery code if you want rider to see it (removed for security best practice usually)
      // deliveryCode: order.deliveryCode, 
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
}