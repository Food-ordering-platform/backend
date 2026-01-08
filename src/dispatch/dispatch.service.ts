import { randomBytes } from "crypto";
import { PrismaClient } from "../../generated/prisma";
import { getSocketIO } from "../utils/socket"; 
const prisma = new PrismaClient();

const generateTrackingId = () => "TRK-" + randomBytes(4).toString("hex").toUpperCase();

export class DispatchService {
  
  static async getDispatcherDashboard(userId: string) {
    const partner = await prisma.logisticsPartner.findUnique({
      where: { ownerId: userId },
    });

    if (!partner) throw new Error("User is not a Logistics Partner");

    // 🚀 FIX: Only show orders waiting for pickup OR actively being delivered by this partner
    const allOrders = await prisma.order.findMany({
      where: {
        status: { in: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'] },
        OR: [
            { logisticsPartnerId: partner.id }, 
            { logisticsPartnerId: null }        
        ]
      },
      include: { restaurant: true, customer: true },
      orderBy: { createdAt: 'desc' }
    });

    const stats = {
      totalJobs: await prisma.order.count({ where: { logisticsPartnerId: partner.id, status: 'DELIVERED' } }),
      activeJobs: allOrders.filter(o => o.status === 'OUT_FOR_DELIVERY' && o.logisticsPartnerId === partner.id).length
    };

    return {
      partnerName: partner.name,
      availableBalance: partner.walletBalance,
      pendingBalance: 0, 
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

  static async acceptOrder(userId: string, orderId: string) {
    const partner = await prisma.logisticsPartner.findUnique({ where: { ownerId: userId } });
    if (!partner) throw new Error("Unauthorized");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Order not found");
    
    // 🚀 Check Logic
    if (order.status !== "READY_FOR_PICKUP") {
        throw new Error("Order is not ready for pickup yet.");
    }
    if (order.logisticsPartnerId && order.logisticsPartnerId !== partner.id) {
        throw new Error("Order already taken");
    }

    const trackingId = order.trackingId || generateTrackingId();

    return await prisma.order.update({
        where: { id: orderId },
        data: { logisticsPartnerId: partner.id, trackingId }
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
        deliveryFee: order.deliveryFee,
        trackingId: order.trackingId,
        deliveryAddress: order.deliveryAddress,
        deliveryLatitude: order.deliveryLatitude,
        deliveryLongitude: order.deliveryLongitude,
        customer: {
            name: order.customer.name,
            phone: order.customer.phone
        },
        vendor: {
            name: order.restaurant.name,
            address: order.restaurant.address,
            phone: order.restaurant.phone,
            latitude: order.restaurant.latitude,
            longitude: order.restaurant.longitude
        },
        items: order.items
    };
  }

  // ... (pickupOrder and completeDelivery remain largely the same, just ensure they handle status transitions)
  static async pickupOrder(trackingId: string) {
    const order = await prisma.order.findUnique({ where: { trackingId } });
    if (!order) throw new Error("Task not found");

    const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status: "OUT_FOR_DELIVERY" }
    });

    const io = getSocketIO();
    io.to("dispatchers").emit("order_updated", { orderId: order.id, status: "OUT_FOR_DELIVERY" });

    return { success: true, status: updatedOrder.status };
  }

  static async completeDelivery(trackingId: string, otp: string) {
    const order = await prisma.order.findUnique({ where: { trackingId } });
    if (!order) throw new Error("Order not found");
    
    if (order.deliveryCode !== otp) throw new Error("Incorrect Delivery Code!");

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED" }
    });

    if (order.logisticsPartnerId) {
      await prisma.logisticsPartner.update({
        where: { id: order.logisticsPartnerId },
        data: { walletBalance: { increment: order.deliveryFee } }
      });
    }
    
    const io = getSocketIO();
    io.to("dispatchers").emit("order_delivered", { orderId: order.id });

    return { success: true };
  }
}