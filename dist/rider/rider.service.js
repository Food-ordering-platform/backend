"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderService = void 0;
const client_1 = require("@prisma/client");
const order_state_machine_1 = require("../utils/order-state-machine");
const push_notification_1 = require("../utils/push-notification");
const pricing_1 = require("../config/pricing");
const email_service_1 = require("../utils/email/email.service");
const restaurant_validator_1 = require("../restuarant/restaurant.validator");
const prisma = new client_1.PrismaClient();
class RiderService {
    static async notifyRidersOfNewOrder(orderId) {
        await (0, push_notification_1.sendPushToRiders)("New Delivery Alert! 🚨", "A new order is ready for pickup near you.", { orderId });
    }
    //1. Fetch available orders (ONLY if rider is free)
    static async getAvailableOrders(riderId) {
        const rider = await prisma.user.findUnique({
            where: { id: riderId },
            select: { isOnline: true },
        });
        if (!rider || !rider.isOnline) {
            return [];
        }
        const activeOrder = await prisma.order.findFirst({
            where: {
                riderId: riderId,
                status: {
                    in: [client_1.OrderStatus.RIDER_ACCEPTED, client_1.OrderStatus.OUT_FOR_DELIVERY],
                },
            },
        });
        if (activeOrder) {
            return [];
        }
        const orders = await prisma.order.findMany({
            where: {
                status: client_1.OrderStatus.READY_FOR_PICKUP,
                riderId: null,
            },
            select: {
                id: true,
                reference: true,
                totalAmount: true,
                deliveryFee: true,
                createdAt: true,
                restaurant: {
                    select: {
                        name: true,
                        address: true,
                        latitude: true,
                        longitude: true,
                        imageUrl: true,
                    },
                },
                customer: {
                    select: {
                        name: true,
                        address: true,
                    },
                },
                deliveryAddress: true,
                deliveryLatitude: true,
                deliveryLongitude: true,
                items: {
                    select: {
                        quantity: true,
                        menuItemName: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        // 🟢 Map to only show the 90% share
        return orders.map((order) => ({
            ...order,
            deliveryFee: (0, pricing_1.calculateRiderShare)(order.deliveryFee),
        }));
    }
    static async getActiveOrder(riderId) {
        const order = await prisma.order.findFirst({
            where: {
                riderId: riderId,
                status: {
                    in: [client_1.OrderStatus.RIDER_ACCEPTED, client_1.OrderStatus.OUT_FOR_DELIVERY],
                },
            },
            include: {
                restaurant: {
                    select: {
                        name: true,
                        address: true,
                        latitude: true,
                        longitude: true,
                        imageUrl: true,
                        phone: true,
                    },
                },
                customer: {
                    select: {
                        name: true,
                        address: true,
                        phone: true,
                        latitude: true,
                        longitude: true,
                    },
                },
                items: true,
            },
        });
        if (!order)
            return null;
        // 🟢 Return the order with the calculated 90% share
        return {
            ...order,
            deliveryFee: (0, pricing_1.calculateRiderShare)(order.deliveryFee),
        };
    }
    // 2. Accept an Order
    //Locks the order to the specific rider and changes status to RIDER_ACCEPTED.
    static async acceptOrder(riderId, orderId) {
        return await prisma.$transaction(async (tx) => {
            // 1. Fetch Rider Details
            const rider = await tx.user.findUnique({ where: { id: riderId } });
            if (!rider)
                throw new Error("Rider profile not found");
            // 1. DFA Enforcement (Fetch order first to validate)
            const order = await tx.order.findUnique({ where: { id: orderId } });
            if (!order)
                throw new Error("Order not found");
            order_state_machine_1.OrderStateMachine.validateTransition(order.status, client_1.OrderStatus.RIDER_ACCEPTED);
            // Ensure Rider is not busy with another active order
            const existingActiveOrder = await tx.order.findFirst({
                where: {
                    riderId: riderId,
                    status: {
                        in: [client_1.OrderStatus.RIDER_ACCEPTED, client_1.OrderStatus.OUT_FOR_DELIVERY],
                    },
                },
            });
            if (existingActiveOrder) {
                throw new Error("You have an active order. Please complete it first!");
            }
            // Use fallback if name/phone missing
            const riderName = rider.name || "ChowEazy Rider";
            const riderPhone = rider.phone || "";
            // (The Race Condition Fix): Atomic Update
            // instead of "finding" then "updating", we try to update ONLY IF riderId is null.
            let updatedOrder;
            try {
                updatedOrder = await tx.order.update({
                    where: {
                        id: orderId,
                        riderId: null, // <--- CRITICAL: This fails if someone else just took it
                        status: client_1.OrderStatus.READY_FOR_PICKUP,
                    },
                    data: {
                        status: client_1.OrderStatus.RIDER_ACCEPTED,
                        riderId: riderId,
                        riderName: riderName,
                        riderPhone: riderPhone,
                    },
                    include: { restaurant: true, customer: true },
                });
            }
            catch (error) {
                // If Prisma throws an error here, it means the 'where' clause failed
                throw new Error("Too late! This order has just been accepted by another rider.");
            }
            // 4. Mark Rider Busy
            await tx.user.update({
                where: { id: riderId },
                data: { isOnline: false },
            });
            if (updatedOrder.customer?.email) {
                (0, email_service_1.sendOrderStatusEmail)(updatedOrder.customer.email, updatedOrder.customer.name, updatedOrder.reference, client_1.OrderStatus.RIDER_ACCEPTED).catch((e) => console.error("Failed to send rider accepted email", e));
            }
            return updatedOrder;
        });
    }
    //NEW METHOD: Handle Pickup & Delivery
    static async comfirmPickup(riderId, orderId) {
        return await prisma.$transaction(async (tx) => {
            // 1. Fetch Order and Verify ownership
            const order = await tx.order.findUnique({
                where: { id: orderId },
            });
            if (!order)
                throw new Error("Order not found");
            if (order.riderId !== riderId)
                throw new Error("Unauthorized: This isn't your order to pick up");
            // 2. Validate State (Ensure it's actually ready for pickup)
            order_state_machine_1.OrderStateMachine.validateTransition(order.status, client_1.OrderStatus.OUT_FOR_DELIVERY);
            // 3. Update Order Status ONLY
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: { status: client_1.OrderStatus.OUT_FOR_DELIVERY },
                include: { restaurant: true, customer: true },
            });
            // 4. Notifications (Purely informational)
            if (updatedOrder.customer?.email) {
                (0, email_service_1.sendOrderStatusEmail)(updatedOrder.customer.email, updatedOrder.customer.name, updatedOrder.reference, client_1.OrderStatus.OUT_FOR_DELIVERY).catch((e) => console.error("Failed to send out for delivery email", e));
            }
            return updatedOrder;
        });
    }
    static async confirmDelivery(riderId, orderId, code) {
        return await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: orderId } });
            if (!order)
                throw new Error("Order not found");
            if (order.riderId !== riderId)
                throw new Error("Unauthorized access to this order");
            order_state_machine_1.OrderStateMachine.validateTransition(order.status, client_1.OrderStatus.DELIVERED);
            if (!order.deliveryCode)
                throw new Error("System Error: No delivery code generated for this order.");
            if (order.deliveryCode !== code) {
                throw new Error("Invalid Delivery Code. Please ask the customer for the correct 4-digit code.");
            }
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: { status: client_1.OrderStatus.DELIVERED },
                include: { restaurant: true, customer: true },
            });
            // 🟢 Calculate 90% of the delivery fee for the rider
            const riderEarnings = (0, pricing_1.calculateRiderShare)(order.deliveryFee);
            await tx.transaction.create({
                data: {
                    userId: riderId,
                    amount: riderEarnings, // 🟢 Rider receives the 90% cut
                    type: client_1.TransactionType.CREDIT,
                    category: client_1.TransactionCategory.DELIVERY_FEE,
                    status: client_1.TransactionStatus.SUCCESS,
                    description: `Earnings for Order #${order.reference}`,
                    orderId: order.id,
                    reference: `EARN-${order.reference}-${Date.now()}`,
                },
            });
            await tx.user.update({
                where: { id: riderId },
                data: { isOnline: true },
            });
            if (updatedOrder.customer?.email) {
                (0, email_service_1.sendOrderStatusEmail)(updatedOrder.customer.email, updatedOrder.customer.name, updatedOrder.reference, client_1.OrderStatus.DELIVERED).catch((e) => console.error("Failed to send delivered email", e));
            }
            return updatedOrder;
        });
    }
    // Get Earnings & Wallet Balance
    //Calculates pending balance and returns transaction history.
    static async getRiderEarnings(riderId, db = prisma) {
        const transactions = await db.transaction.findMany({
            where: { userId: riderId },
            orderBy: { createdAt: "desc" },
        });
        const totalCredits = transactions
            .filter((t) => t.type === client_1.TransactionType.CREDIT &&
            t.status === client_1.TransactionStatus.SUCCESS)
            .reduce((sum, t) => sum + t.amount, 0);
        const totalDebits = transactions
            .filter((t) => t.type === client_1.TransactionType.DEBIT &&
            (t.status === client_1.TransactionStatus.SUCCESS ||
                t.status === client_1.TransactionStatus.PENDING))
            .reduce((sum, t) => sum + t.amount, 0);
        const availableBalance = totalCredits - totalDebits;
        const activeOrders = await prisma.order.findMany({
            where: {
                riderId: riderId,
                status: {
                    in: [client_1.OrderStatus.RIDER_ACCEPTED, client_1.OrderStatus.OUT_FOR_DELIVERY],
                },
            },
            select: { deliveryFee: true },
        });
        // 🟢 Update pending balance to reflect only the 90% they will actually earn
        const pendingBalance = activeOrders.reduce((sum, order) => sum + (0, pricing_1.calculateRiderShare)(order.deliveryFee), 0);
        return {
            availableBalance,
            pendingBalance,
            totalEarnings: totalCredits,
            withdrawn: totalDebits,
        };
    }
    // 4. Request 
    //Creates a withdrawal request (Debit Transaction).
    static async requestPayout(userId, amount, bankDetails) {
        const validData = restaurant_validator_1.payoutSchema.parse({ amount, bankDetails });
        if (validData.amount < 1000) {
            throw new Error("Minimum withdrawal is ₦1,000");
        }
        return await prisma.$transaction(async (tx) => {
            // 🔒 1. Lock the USER row (acts as financial lock)
            await tx.$queryRaw `
      SELECT id FROM "User"
      WHERE id = ${userId}
      FOR UPDATE
    `;
            // 🔒 2. Recalculate balance INSIDE the lock
            const { availableBalance } = await this.getRiderEarnings(userId, tx);
            if (validData.amount > availableBalance) {
                throw new Error(`Insufficient funds. Available: ₦${availableBalance.toLocaleString()}`);
            }
            // 🔒 3. Fetch rider (inside transaction for consistency)
            const rider = await tx.user.findUnique({
                where: { id: userId },
                select: { name: true, email: true },
            });
            if (!rider)
                throw new Error("Rider not found");
            // 🔒 4. Create the DEBIT transaction (this is your "lock" on funds)
            const transaction = await tx.transaction.create({
                data: {
                    userId,
                    amount: validData.amount,
                    type: client_1.TransactionType.DEBIT,
                    category: client_1.TransactionCategory.WITHDRAWAL,
                    status: client_1.TransactionStatus.PENDING, // funds reserved
                    description: `Manual Payout Request to ${validData.bankDetails.bankName} (${validData.bankDetails.accountNumber})`,
                    reference: `RID-PAY-${Date.now()}`,
                },
            });
            return { transaction, rider };
        }).then(async ({ transaction, rider }) => {
            // 🚀 Notifications OUTSIDE transaction
            try {
                await (0, email_service_1.sendAdminPayoutAlert)(rider.name, validData.amount, validData.bankDetails);
                if (rider.email) {
                    await (0, email_service_1.sendPayoutRequestEmail)({
                        email: rider.email,
                        ownerName: rider.name,
                        restaurantName: "Rider Wallet",
                        amount: validData.amount,
                        bankName: validData.bankDetails.bankName,
                        accountNumber: validData.bankDetails.accountNumber,
                    });
                }
            }
            catch (e) {
                console.error("Notification failed:", e.message);
            }
            return transaction;
        });
    }
    static async getDeliveryHistory(riderId) {
        const orders = await prisma.order.findMany({
            where: {
                riderId: riderId,
                status: { in: [client_1.OrderStatus.DELIVERED, client_1.OrderStatus.CANCELLED] },
            },
            include: {
                restaurant: { select: { name: true, imageUrl: true, address: true } },
                customer: { select: { name: true } },
                items: { select: { quantity: true, menuItemName: true } },
            },
            orderBy: { updatedAt: "desc" },
        });
        // 🟢 Map the history to show only the 90% share earned per order
        return orders.map((order) => ({
            ...order,
            deliveryFee: (0, pricing_1.calculateRiderShare)(order.deliveryFee),
        }));
    }
    static async updateRiderStatus(userId, isOnline) {
        // 1. Update the user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { isOnline: isOnline },
            select: {
                id: true,
                name: true,
                isOnline: true,
                email: true,
            }, // Only return what is needed
        });
        return updatedUser;
    }
    //Get rider transaction
    static async getTransactions(userId) {
        return await prisma.transaction.findMany({
            where: {
                userId,
                NOT: {
                    reference: { startsWith: "FLT-PAY" },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
    }
}
exports.RiderService = RiderService;
//# sourceMappingURL=rider.service.js.map