"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const prisma_1 = require("../../generated/prisma");
const payment_service_1 = require("../payment/payment.service");
const crypto_1 = require("crypto");
const mailer_1 = require("../utils/mailer");
const notification_1 = require("../utils/notification");
const socket_1 = require("../utils/socket");
const haversine_1 = require("../utils/haversine");
const pricing_1 = require("../config/pricing");
const web_push_1 = require("../utils/web-push");
const prisma = new prisma_1.PrismaClient();
function generateReference() {
    return (0, crypto_1.randomBytes)(12).toString("hex");
}
class OrderService {
    static calculateVendorShare(totalAmount, deliveryFee) {
        const foodRevenue = totalAmount - (deliveryFee + pricing_1.PRICING.PLATFORM_FEE);
        const vendorShare = foodRevenue * 0.85;
        return Math.max(0, vendorShare);
    }
    // ... (getOrderQuote and createOrderWithPayment remain unchanged) ...
    static async getOrderQuote(restaurantId, deliveryLatitude, deliveryLongitude, items) {
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            select: { latitude: true, longitude: true },
        });
        if (!restaurant || !restaurant.latitude || !restaurant.longitude) {
            throw new Error("Restaurant location not available for calculation.");
        }
        const distance = (0, haversine_1.calculateDistance)(restaurant.latitude, restaurant.longitude, deliveryLatitude, deliveryLongitude);
        const deliveryFee = (0, haversine_1.calculateDeliveryFee)(distance);
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const totalAmount = subtotal + deliveryFee + pricing_1.PRICING.PLATFORM_FEE;
        return {
            subtotal,
            deliveryFee,
            platformFee: pricing_1.PRICING.PLATFORM_FEE,
            totalAmount,
            distanceKm: parseFloat(distance.toFixed(2)),
        };
    }
    static async createOrderWithPayment(customerId, restaurantId, deliveryAddress, deliveryNotes, deliveryLatitude, deliveryLongitude, items, customerName, customerEmail, idempotencyKey) {
        if (idempotencyKey) {
            const existingOrder = await prisma.order.findUnique({
                where: { idempotencyKey },
            });
            if (existingOrder) {
                console.log(`🛡️ Idempotency Hit: Returning existing order ${existingOrder.reference}`);
                return {
                    order: existingOrder,
                    checkoutUrl: existingOrder.checkoutUrl,
                };
            }
        }
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            include: { owner: true },
        });
        if (!restaurant)
            throw new Error("Restaurant not found");
        let deliveryFee = 0;
        if (restaurant.latitude &&
            restaurant.longitude &&
            deliveryLatitude &&
            deliveryLongitude) {
            const distance = (0, haversine_1.calculateDistance)(restaurant.latitude, restaurant.longitude, deliveryLatitude, deliveryLongitude);
            deliveryFee = (0, haversine_1.calculateDeliveryFee)(distance);
        }
        else {
            deliveryFee = 500;
        }
        const menuItemIds = items.map((item) => item.menuItemId);
        const dbMenuItems = await prisma.menuItem.findMany({
            where: { id: { in: menuItemIds } },
        });
        const itemsMap = new Map(dbMenuItems.map((item) => [item.id, item]));
        let subtotal = 0;
        const validItems = items.map((i) => {
            const originalItem = itemsMap.get(i.menuItemId);
            if (!originalItem)
                throw new Error(`Menu item ${i.menuItemId} not found`);
            const itemTotal = originalItem.price * i.quantity;
            subtotal += itemTotal;
            return {
                menuItemId: i.menuItemId,
                menuItemName: originalItem.name,
                quantity: i.quantity,
                price: originalItem.price,
            };
        });
        const finalTotal = subtotal + deliveryFee + pricing_1.PRICING.PLATFORM_FEE;
        let reference = generateReference();
        let referenceExists = true;
        while (referenceExists) {
            const existing = await prisma.order.findUnique({ where: { reference } });
            if (!existing)
                referenceExists = false;
            else
                reference = generateReference();
        }
        const checkoutUrl = await payment_service_1.PaymentService.initiatePayment(finalTotal, customerName, customerEmail, reference);
        const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
        const order = await prisma.order.create({
            data: {
                customerId,
                restaurantId,
                totalAmount: finalTotal,
                deliveryFee: deliveryFee,
                paymentStatus: "PENDING",
                status: "PENDING",
                deliveryAddress,
                deliveryNotes: deliveryNotes || null,
                deliveryLatitude,
                deliveryLongitude,
                reference,
                idempotencyKey,
                checkoutUrl,
                deliveryCode: deliveryCode,
                items: {
                    create: validItems,
                },
            },
            include: { items: true },
        });
        return { order, checkoutUrl };
    }
    // ✅ UPDATED: Sends email with REAL DB reference
    static async processSuccessfulPayment(reference) {
        const order = await prisma.order.findUnique({
            where: { reference },
            include: {
                restaurant: { include: { owner: true } },
                customer: true,
            },
        });
        if (!order)
            return null;
        if (order.paymentStatus === "PAID")
            return order;
        const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: "PAID" },
        });
        if (order.customer && order.customer.email) {
            // ✅ FIX: Use order.reference
            (0, mailer_1.sendOrderStatusEmail)(order.customer.email, order.customer.name, order.reference, // <--- THE FIX
            "PENDING").catch((e) => console.log("Payment success email failed", e));
        }
        if (order.restaurant?.owner?.pushToken) {
            (0, notification_1.sendPushNotification)(order.restaurant.owner.pushToken, "New Order Paid! 💰", `Order #${order.reference.slice(0, 4).toUpperCase()} confirmed. ₦${order.totalAmount}`, { orderId: order.id });
        }
        try {
            const io = (0, socket_1.getSocketIO)();
            io.to(`restaurant_${order.restaurantId}`).emit("new_order", {
                message: "New Order Paid! 🔔",
                orderId: order.id,
                totalAmount: order.totalAmount,
            });
        }
        catch (error) {
            console.log("Socket emit failed", error);
        }
        return updatedOrder;
    }
    static async getOrdersByCustomer(customerId) {
        return prisma.order.findMany({
            where: { customerId },
            select: {
                id: true,
                reference: true,
                totalAmount: true,
                deliveryFee: true,
                paymentStatus: true,
                status: true,
                checkoutUrl: true,
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
    static async getOrderByReference(reference) {
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
    static async getVendorOrders(restaurantId) {
        const orders = await prisma.order.findMany({
            where: { restaurantId, paymentStatus: { in: ["PAID", "REFUNDED"] } },
            include: {
                items: true,
                customer: { select: { name: true, phone: true, address: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        return orders.map((order) => {
            return {
                ...order,
                riderName: order.riderName,
                riderPhone: order.riderPhone,
                vendorFoodTotal: OrderService.calculateVendorShare(order.totalAmount, order.deliveryFee),
            };
        });
    }
    static async distributeVendorEarnings(orderId) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { restaurant: true },
        });
        if (!order) {
            throw new Error(`Order with ID ${orderId} not found`);
        }
        const vendorShare = OrderService.calculateVendorShare(order.totalAmount, order.deliveryFee);
        await prisma.transaction.create({
            data: {
                userId: order.restaurant.ownerId,
                amount: vendorShare,
                type: "CREDIT",
                category: "ORDER_EARNING",
                status: "SUCCESS",
                orderId: order.id,
                description: `Earnings for Order #${order.reference}`,
            },
        });
    }
    // ✅ UPDATED: Sends delivery code using REAL DB reference
    static async updateOrderStatus(orderId, status) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { restaurant: true },
        });
        if (!order)
            throw new Error("Order not found");
        let newPaymentStatus = order.paymentStatus;
        if (status === "CANCELLED" && order.paymentStatus === "PAID") {
            await payment_service_1.PaymentService.refund(order.reference).catch(e => console.error("Refund failed", e));
            newPaymentStatus = "REFUNDED";
        }
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { status, paymentStatus: newPaymentStatus },
            include: { customer: true },
        });
        try {
            const io = (0, socket_1.getSocketIO)();
            io.to(`restaurant_${order.restaurantId}`).emit("order_updated", {
                orderId: order.id,
                status: status
            });
        }
        catch (e) {
            console.error("Socket emit failed", e);
        }
        if (status === "PREPARING") {
            if (updatedOrder.customer?.pushToken) {
                (0, notification_1.sendPushNotification)(updatedOrder.customer.pushToken, "Order Accepted!", "The vendor is preparing your food.");
            }
            if (updatedOrder.customer?.email && updatedOrder.deliveryCode) {
                (0, mailer_1.sendDeliveryCode)(updatedOrder.customer.email, updatedOrder.deliveryCode, updatedOrder.reference).catch(err => console.error("Failed to send delivery code:", err));
            }
        }
        // 🟢 UPDATED: Notify ALL Logistics Partners
        if (status === "READY_FOR_PICKUP") {
            try {
                // 1. Fetch ALL Logistics Partners (with their Owner details for the User ID)
                const allPartners = await prisma.logisticsPartner.findMany({
                    include: { owner: true }
                });
                console.log(`🔔 Broadcasting 'Ready for Pickup' to ${allPartners.length} Dispatchers`);
                // 2. Send Push Notification to EACH Partner's Owner
                const pushPromises = allPartners.map(partner => {
                    if (partner.owner?.id) {
                        return (0, web_push_1.sendWebPushNotification)(partner.owner.id, {
                            title: "New Job Alert! 🚨",
                            body: `Order #${order.reference} is ready at ${order.restaurant.name}`,
                            url: `/dashboard/orders`, // Opens the dispatch dashboard
                            data: {
                                orderId: order.id,
                                status: 'READY_FOR_PICKUP',
                                trackingId: order.trackingId,
                                type: 'DISPATCH_BROADCAST'
                            }
                        }).catch(err => console.error(`Failed to push to ${partner.name}:`, err));
                    }
                });
                await Promise.all(pushPromises);
                // 3. Socket Emit (This naturally goes to all dispatchers listening)
                const io = (0, socket_1.getSocketIO)();
                io.to("dispatchers").emit("new_dispatcher_request", {
                    orderId: order.id,
                    status: status,
                    restaurantName: order.restaurant.name,
                    restaurantAddress: order.restaurant.address,
                    customerAddress: order.deliveryAddress,
                    totalAmount: order.totalAmount,
                    deliveryFee: order.deliveryFee,
                    pickupTime: new Date().toISOString(),
                });
                console.log(`🚚 Riders Requested for Order #${order.reference}`);
            }
            catch (error) {
                console.error("Broadcast error:", error);
            }
        }
        // Standard Status Email
        if (updatedOrder.customer?.email) {
            (0, mailer_1.sendOrderStatusEmail)(updatedOrder.customer.email, updatedOrder.customer.name, updatedOrder.reference, status);
        }
        return updatedOrder;
    }
}
exports.OrderService = OrderService;
//# sourceMappingURL=order.service.js.map