"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchService = void 0;
const crypto_1 = require("crypto");
const prisma_1 = require("../../generated/prisma");
const socket_1 = require("../utils/socket");
const order_service_1 = require("../order/order.service");
const mailer_1 = require("../utils/mailer"); // ✅ Import Mailer
const prisma = new prisma_1.PrismaClient();
const generateTrackingId = () => "TRK-" + (0, crypto_1.randomBytes)(4).toString("hex").toUpperCase();
class DispatchService {
    // ... (getDispatcherDashboard, acceptOrder, getRiderTask, assignLinkRider remain unchanged) ...
    // Please copy those methods from your original file or let me know if you need them repeated.
    static async getDispatcherDashboard(userId) {
        const partner = await prisma.logisticsPartner.findUnique({ where: { ownerId: userId } });
        if (!partner)
            throw new Error("User is not a Logistics Partner");
        const allOrders = await prisma.order.findMany({
            where: {
                OR: [
                    { status: { in: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] }, OR: [{ logisticsPartnerId: partner.id }, { logisticsPartnerId: null }] },
                    { status: "DELIVERED", logisticsPartnerId: partner.id },
                ],
            },
            include: { restaurant: true, customer: true },
            orderBy: { updatedAt: "desc" },
            take: 50,
        });
        const pendingOrders = allOrders.filter(o => o.logisticsPartnerId === partner.id && o.status !== "DELIVERED");
        const pendingBalance = pendingOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
        const stats = {
            totalJobs: await prisma.order.count({ where: { logisticsPartnerId: partner.id, status: "DELIVERED" } }),
            activeJobs: pendingOrders.length,
        };
        return {
            partnerName: partner.name,
            availableBalance: partner.walletBalance,
            pendingBalance: pendingBalance,
            stats,
            activeOrders: allOrders.map((order) => ({
                id: order.id,
                reference: order.reference,
                status: order.status,
                deliveryFee: order.deliveryFee,
                trackingId: order.logisticsPartnerId === partner.id ? order.trackingId : null,
                postedAt: order.updatedAt,
                riderName: order.riderName,
                riderPhone: order.riderPhone,
                vendor: { name: order.restaurant.name, address: order.restaurant.address, phone: order.restaurant.phone },
                customer: { name: order.customer.name, address: order.deliveryAddress, phone: order.customer.phone },
            })),
        };
    }
    static async acceptOrder(userId, orderId) {
        const partner = await prisma.logisticsPartner.findUnique({ where: { ownerId: userId } });
        if (!partner)
            throw new Error("Unauthorized");
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new Error("Order not found");
        if (order.status !== "READY_FOR_PICKUP")
            throw new Error("Order is not ready for pickup yet.");
        if (order.logisticsPartnerId && order.logisticsPartnerId !== partner.id)
            throw new Error("Order already taken by another partner");
        const trackingId = order.trackingId || generateTrackingId();
        return await prisma.order.update({ where: { id: orderId }, data: { logisticsPartnerId: partner.id, trackingId } });
    }
    static async getRiderTask(trackingId) {
        const order = await prisma.order.findUnique({ where: { trackingId }, include: { restaurant: true, customer: true, items: true } });
        if (!order)
            throw new Error("Task not found or link expired");
        return {
            id: order.id,
            reference: order.reference,
            status: order.status,
            deliveryFee: order.deliveryFee,
            deliveryCode: order.deliveryCode,
            trackingId: order.trackingId,
            riderName: order.riderName,
            riderPhone: order.riderPhone,
            deliveryAddress: order.deliveryAddress,
            deliveryLatitude: order.deliveryLatitude,
            deliveryLongitude: order.deliveryLongitude,
            customer: { name: order.customer.name, phone: order.customer.phone },
            vendor: { name: order.restaurant.name, address: order.restaurant.address, phone: order.restaurant.phone, latitude: order.restaurant.latitude, longitude: order.restaurant.longitude },
            items: order.items,
        };
    }
    static async assignLinkRider(trackingId, name, phone) {
        const order = await prisma.order.findUnique({ where: { trackingId } });
        if (!order)
            throw new Error("Order not found");
        if (order.riderName)
            throw new Error(`This order has already been claimed by ${order.riderName}`);
        await prisma.order.update({ where: { id: order.id }, data: { riderName: name, riderPhone: phone } });
        const io = (0, socket_1.getSocketIO)();
        if (order.logisticsPartnerId) {
            io.emit(`partner_${order.logisticsPartnerId}_update`, { type: "RIDER_ASSIGNED", orderId: order.id, riderName: name });
        }
        return { success: true };
    }
    // ✅ UPDATED: Sends Email with DB Reference
    static async pickupOrder(trackingId) {
        const order = await prisma.order.findUnique({
            where: { trackingId },
            include: { customer: true } // ✅ Needed for email
        });
        if (!order)
            throw new Error("Task not found");
        const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: { status: "OUT_FOR_DELIVERY" },
        });
        if (updatedOrder.paymentStatus === "PAID") {
            console.log(`📦 Order Picked Up. Distributing Vendor Earnings for #${order.reference}`);
            await order_service_1.OrderService.distributeVendorEarnings(order.id).catch(err => {
                console.error("❌ Failed to pay vendor on pickup:", err);
            });
        }
        const io = (0, socket_1.getSocketIO)();
        io.to("dispatchers").emit("order_updated", {
            orderId: order.id,
            status: "OUT_FOR_DELIVERY",
        });
        // ✅ SEND EMAIL (Fixed to use real reference)
        if (order.customer?.email) {
            (0, mailer_1.sendOrderStatusEmail)(order.customer.email, order.customer.name, order.reference, // <--- THE FIX
            "OUT_FOR_DELIVERY").catch(console.error);
        }
        return { success: true, status: updatedOrder.status };
    }
    // ✅ UPDATED: Sends Email with DB Reference
    static async completeDelivery(trackingId, otp) {
        const order = await prisma.order.findUnique({
            where: { trackingId },
            include: {
                logisticsPartner: true,
                customer: true // ✅ Needed for email
            },
        });
        if (!order)
            throw new Error("Order not found");
        if (order.deliveryCode !== otp)
            throw new Error("Incorrect Delivery Code!");
        // 1. Update Order Status
        await prisma.order.update({
            where: { id: order.id },
            data: { status: "DELIVERED" },
        });
        // 2. Credit Logistics Partner
        if (order.logisticsPartner) {
            await prisma.logisticsPartner.update({
                where: { id: order.logisticsPartner.id },
                data: { walletBalance: { increment: order.deliveryFee } },
            });
            await prisma.transaction.create({
                data: {
                    userId: order.logisticsPartner.ownerId,
                    amount: order.deliveryFee,
                    type: prisma_1.TransactionType.CREDIT,
                    category: prisma_1.TransactionCategory.ORDER_EARNING,
                    status: prisma_1.TransactionStatus.SUCCESS,
                    orderId: order.id,
                    description: `Delivery Earnings - #${order.reference}`,
                    reference: `TXN-${(0, crypto_1.randomBytes)(4).toString("hex").toUpperCase()}`,
                },
            });
        }
        if (order.paymentStatus === "PAID") {
            await order_service_1.OrderService.distributeVendorEarnings(order.id).catch(() => { });
        }
        const io = (0, socket_1.getSocketIO)();
        io.to("dispatchers").emit("order_delivered", { orderId: order.id });
        // ✅ SEND EMAIL (Fixed to use real reference)
        if (order.customer?.email) {
            (0, mailer_1.sendOrderStatusEmail)(order.customer.email, order.customer.name, order.reference, // <--- THE FIX
            "DELIVERED").catch(console.error);
        }
        return { success: true };
    }
    // ... (getPartnerWallet, requestWithdrawal remain unchanged) ...
    static async getPartnerWallet(userId) {
        const partner = await prisma.logisticsPartner.findUnique({ where: { ownerId: userId } });
        if (!partner)
            return { availableBalance: 0, pendingBalance: 0, transactions: [] };
        const transactions = await prisma.transaction.findMany({ where: { userId: userId }, orderBy: { createdAt: "desc" }, take: 50 });
        const activeOrders = await prisma.order.findMany({
            where: { logisticsPartnerId: partner.id, status: { in: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] } },
            select: { deliveryFee: true },
        });
        const pendingBalance = activeOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
        return {
            availableBalance: partner.walletBalance,
            pendingBalance: pendingBalance,
            transactions: transactions.map((t) => ({ id: t.id, amount: t.amount, type: t.type, category: t.category, reference: t.reference, description: t.description, status: t.status, createdAt: t.createdAt })),
        };
    }
    static async requestWithdrawal(userId, amount, bankDetails) {
        const partner = await prisma.logisticsPartner.findUnique({ where: { ownerId: userId } });
        if (!partner)
            throw new Error("Logistics account not found");
        if (partner.walletBalance < amount)
            throw new Error("Insufficient funds");
        return await prisma.$transaction(async (tx) => {
            // 1. Debit Wallet
            await tx.logisticsPartner.update({
                where: { id: partner.id },
                data: { walletBalance: { decrement: amount } }
            });
            // 2. Create Transaction Record
            const transaction = await tx.transaction.create({
                data: {
                    userId,
                    amount,
                    type: prisma_1.TransactionType.DEBIT,
                    category: prisma_1.TransactionCategory.WITHDRAWAL,
                    status: prisma_1.TransactionStatus.PENDING,
                    description: `Withdrawal to ${bankDetails.bankName} (${bankDetails.accountNumber})`,
                    reference: `WD-${(0, crypto_1.randomBytes)(4).toString("hex").toUpperCase()}`
                },
            });
            // 3. 🔔 Notify Admin (New Line)
            (0, mailer_1.sendAdminPayoutAlert)(partner.name, amount, bankDetails);
            return { success: true, transaction };
        });
    }
}
exports.DispatchService = DispatchService;
//# sourceMappingURL=dispatch.service.js.map