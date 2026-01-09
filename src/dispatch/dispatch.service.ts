import { randomBytes } from "crypto";
import { PrismaClient } from "../../generated/prisma";
import { getSocketIO } from "../utils/socket";

const prisma = new PrismaClient();

const generateTrackingId = () =>
  "TRK-" + randomBytes(4).toString("hex").toUpperCase();

export class DispatchService {
  // =================================================================
  // 1. DASHBOARD (For Logistics Company Admin)
  // =================================================================
  static async getDispatcherDashboard(userId: string) {
    const partner = await prisma.logisticsPartner.findUnique({
      where: { ownerId: userId },
    });

    if (!partner) throw new Error("User is not a Logistics Partner");

    // Fetch relevant orders
    const allOrders = await prisma.order.findMany({
      where: {
        OR: [
          // 1. Active Orders (Available or In Progress)
          {
            status: { in: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] },
            OR: [
              { logisticsPartnerId: partner.id },
              { logisticsPartnerId: null },
            ],
          },
          // 2. Delivered Orders (History - Only mine)
          {
            status: "DELIVERED",
            logisticsPartnerId: partner.id,
          },
        ],
      },
      include: { restaurant: true, customer: true },
      orderBy: { updatedAt: "desc" }, // Show newest activity first
      take: 50, // Limit history to last 50 to keep it fast
    });
    // Calculate Pending Balance
    const pendingOrders = allOrders.filter(
      (o) => o.logisticsPartnerId === partner.id && o.status !== "DELIVERED"
    );
    const pendingBalance = pendingOrders.reduce(
      (sum, order) => sum + (order.deliveryFee || 0),
      0
    );

    const stats = {
      totalJobs: await prisma.order.count({
        where: { logisticsPartnerId: partner.id, status: "DELIVERED" },
      }),
      activeJobs: pendingOrders.length,
    };

    return {
      partnerName: partner.name,
      availableBalance: partner.walletBalance,
      pendingBalance: pendingBalance,
      stats,
      activeOrders: allOrders.map((order) => ({
        id: order.id,
        reference: order.reference, // 🚀 Added this for consistent ID
        status: order.status,
        deliveryFee: order.deliveryFee,
        trackingId:
          order.logisticsPartnerId === partner.id ? order.trackingId : null,
        postedAt: order.updatedAt, // Added for "Just Now" calculation

        riderName: order.riderName,
        riderPhone: order.riderPhone,

        vendor: {
          name: order.restaurant.name,
          address: order.restaurant.address,
          phone: order.restaurant.phone,
        },
        customer: {
          name: order.customer.name,
          address: order.deliveryAddress,
          phone: order.customer.phone,
        },
      })),
    };
  }

  // ... (acceptOrder remains unchanged) ...
  static async acceptOrder(userId: string, orderId: string) {
    const partner = await prisma.logisticsPartner.findUnique({
      where: { ownerId: userId },
    });
    if (!partner) throw new Error("Unauthorized");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Order not found");

    if (order.status !== "READY_FOR_PICKUP") {
      throw new Error("Order is not ready for pickup yet.");
    }
    if (order.logisticsPartnerId && order.logisticsPartnerId !== partner.id) {
      throw new Error("Order already taken by another partner");
    }

    const trackingId = order.trackingId || generateTrackingId();

    return await prisma.order.update({
      where: { id: orderId },
      data: { logisticsPartnerId: partner.id, trackingId },
    });
  }

  // =================================================================
  // 3. GET TASK DETAILS (For Rider Link)
  // =================================================================
  static async getRiderTask(trackingId: string) {
    const order = await prisma.order.findUnique({
      where: { trackingId },
      include: { restaurant: true, customer: true, items: true },
    });

    if (!order) throw new Error("Task not found or link expired");

    return {
      id: order.id,
      reference: order.reference, // 🚀 Added for consistent ID
      status: order.status,
      deliveryFee: order.deliveryFee,
      deliveryCode: order.deliveryCode,
      trackingId: order.trackingId,

      riderName: order.riderName,
      riderPhone: order.riderPhone,

      deliveryAddress: order.deliveryAddress,
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,

      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
      },
      vendor: {
        name: order.restaurant.name,
        address: order.restaurant.address,
        phone: order.restaurant.phone,
        latitude: order.restaurant.latitude,
        longitude: order.restaurant.longitude,
      },
      items: order.items,
    };
  }

  // ... (assignLinkRider, pickupOrder, completeDelivery unchanged) ...
  static async assignLinkRider(
    trackingId: string,
    name: string,
    phone: string
  ) {
    const order = await prisma.order.findUnique({ where: { trackingId } });
    if (!order) throw new Error("Order not found");

    if (order.riderName) {
      throw new Error(
        `This order has already been claimed by ${order.riderName}`
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        riderName: name,
        riderPhone: phone,
      },
    });

    const io = getSocketIO();
    if (order.logisticsPartnerId) {
      io.emit(`partner_${order.logisticsPartnerId}_update`, {
        type: "RIDER_ASSIGNED",
        orderId: order.id,
        riderName: name,
      });
    }

    return { success: true };
  }

  static async pickupOrder(trackingId: string) {
    const order = await prisma.order.findUnique({ where: { trackingId } });
    if (!order) throw new Error("Task not found");

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: "OUT_FOR_DELIVERY" },
    });

    const io = getSocketIO();
    io.to("dispatchers").emit("order_updated", {
      orderId: order.id,
      status: "OUT_FOR_DELIVERY",
    });

    return { success: true, status: updatedOrder.status };
  }

  static async completeDelivery(trackingId: string, otp: string) {
    const order = await prisma.order.findUnique({ where: { trackingId } });
    if (!order) throw new Error("Order not found");

    if (order.deliveryCode !== otp) throw new Error("Incorrect Delivery Code!");

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED" },
    });

    if (order.logisticsPartnerId) {
      await prisma.logisticsPartner.update({
        where: { id: order.logisticsPartnerId },
        data: { walletBalance: { increment: order.deliveryFee } },
      });
    }

    const io = getSocketIO();
    io.to("dispatchers").emit("order_delivered", { orderId: order.id });

    return { success: true };
  }
}
