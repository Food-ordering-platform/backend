"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorService = void 0;
const client_1 = require("@prisma/client");
const email_service_1 = require("../utils/email/email.service");
const notification_1 = require("../utils/notification");
const rider_service_1 = require("../rider/rider.service");
const pricing_1 = require("../config/pricing");
const restaurant_validator_1 = require("../restuarant/restaurant.validator");
const order_state_machine_1 = require("../utils/order-state-machine");
const prisma = new client_1.PrismaClient();
class VendorService {
    /**
     * 1. Get Vendor Orders (Dashboard)
     */
    static async getVendorOrders(restaurantId) {
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            select: { id: true },
        });
        if (!restaurant)
            throw new Error("Restaurant not found");
        const orders = await prisma.order.findMany({
            where: {
                restaurantId: restaurant.id,
                paymentStatus: { in: ["PAID", "REFUNDED"] },
            },
            include: {
                items: true,
                customer: {
                    select: { name: true, phone: true, address: true, pushToken: true },
                },
                rider: { select: { name: true, phone: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        return orders.map((order) => {
            const foodSubtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            // 2. Use the central BPS logic to get the vendor's 85%
            const vendorEarning = (0, pricing_1.calculateVendorShare)(foodSubtotal);
            // 3. Derive the commission (15%)
            const platformCommission = foodSubtotal - vendorEarning;
            return {
                ...order,
                riderName: order.riderName,
                riderPhone: order.riderPhone,
                foodSubtotal,
                platformCommission,
                vendorEarning,
            };
        });
    }
    // =========================================================================
    // VENDOR ORDER ACTIONS (Replacing updateOrderStatus)
    // =========================================================================
    /**
     * Action A: Accept Order (Kitchen starts cooking)
     * Changes status from PENDING -> PREPARING
     */
    static async acceptOrder(vendorId, orderId) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { restaurant: true, customer: true },
        });
        if (!order)
            throw new Error("Order not found");
        if (order.restaurant.ownerId !== vendorId)
            throw new Error("Unauthorized to access this order");
        order_state_machine_1.OrderStateMachine.validateTransition(order.status, client_1.OrderStatus.PREPARING);
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { status: client_1.OrderStatus.PREPARING },
            include: { customer: true },
        });
        // 📡 Notifications
        if (updatedOrder.customer?.pushToken) {
            (0, notification_1.sendPushNotification)(updatedOrder.customer.pushToken, "Order Accepted!", "The vendor is preparing your food.");
        }
        if (updatedOrder.customer?.email && updatedOrder.deliveryCode) {
            (0, email_service_1.sendDeliveryCode)(updatedOrder.customer.email, updatedOrder.deliveryCode, updatedOrder.reference).catch(e => console.error(e));
        }
        if (updatedOrder.customer?.email) {
            (0, email_service_1.sendOrderStatusEmail)(updatedOrder.customer.email, updatedOrder.customer.name, updatedOrder.reference, client_1.OrderStatus.PREPARING);
        }
        return updatedOrder;
    }
    /**
     * Action B: Request Rider (Food is Ready)
     * Changes status from PREPARING -> READY_FOR_PICKUP and creates Vendor Earning Record
     */
    static async requestRider(vendorId, orderId) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { restaurant: true },
        });
        if (!order)
            throw new Error("Order not found");
        if (order.restaurant.ownerId !== vendorId)
            throw new Error("Unauthorized");
        order_state_machine_1.OrderStateMachine.validateTransition(order.status, client_1.OrderStatus.READY_FOR_PICKUP);
        // Atomic Transaction to update status AND log the earnings
        const updatedOrder = await prisma.$transaction(async (tx) => {
            const updated = await tx.order.update({
                where: { id: orderId },
                data: { status: client_1.OrderStatus.READY_FOR_PICKUP },
                include: { restaurant: true, customer: true, items: true },
            });
            const trueSubtotal = updated.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const vendorShare = (0, pricing_1.calculateVendorShare)(trueSubtotal); //  Use the true subtotal
            const existingTx = await tx.transaction.findFirst({
                where: { orderId: updated.id, category: client_1.TransactionCategory.ORDER_EARNING },
            });
            if (!existingTx && vendorShare > 0) {
                await tx.transaction.create({
                    data: {
                        userId: updated.restaurant.ownerId,
                        amount: vendorShare,
                        type: client_1.TransactionType.CREDIT,
                        category: client_1.TransactionCategory.ORDER_EARNING,
                        status: client_1.TransactionStatus.SUCCESS,
                        description: `Earnings for Order #${updated.reference}`,
                        orderId: updated.id,
                        reference: `EARN-${updated.reference}-${Date.now()}`,
                    },
                });
            }
            return updated;
        });
        // 📡 Notifications
        rider_service_1.RiderService.notifyRidersOfNewOrder(updatedOrder.id).catch(e => console.error("Rider push failed", e));
        if (updatedOrder.customer?.email) {
            (0, email_service_1.sendOrderStatusEmail)(updatedOrder.customer.email, updatedOrder.customer.name, updatedOrder.reference, client_1.OrderStatus.READY_FOR_PICKUP);
        }
        return updatedOrder;
    }
    /**
     * Action C: Cancel Order (Vendor unable to fulfill)
     * Changes status to CANCELLED and handles refund
     */
    static async cancelOrder(vendorId, orderId) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { restaurant: true, customer: true },
        });
        if (!order)
            throw new Error("Order not found");
        if (order.restaurant.ownerId !== vendorId)
            throw new Error("Unauthorized");
        order_state_machine_1.OrderStateMachine.validateTransition(order.status, client_1.OrderStatus.CANCELLED);
        let newPaymentStatus = order.paymentStatus;
        if (order.paymentStatus === "PAID") {
            try {
                console.log(`Initiating Paystack refund for reference: ${order.reference}`);
                // const refundResponse = await PaymentService.refund(order.reference);
                // If we reach here, the API call was successful
                newPaymentStatus = "REFUNDED";
                // console.log("Paystack refund successful:", refundResponse.data?.status);
            }
            catch (e) {
                // If the refund fails, we do NOT set it to "REFUNDED"
                console.error("CRITICAL: Paystack Refund Failed:", e.message);
                // throw an error here to stop the whole cancellation,
                throw new Error(`Refund failed: ${e.message}. Order not cancelled.`);
            }
        }
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { status: client_1.OrderStatus.CANCELLED, paymentStatus: newPaymentStatus },
            include: { customer: true },
        });
        // 📡 Notifications
        if (updatedOrder.customer?.email) {
            (0, email_service_1.sendOrderStatusEmail)(updatedOrder.customer.email, updatedOrder.customer.name, updatedOrder.reference, client_1.OrderStatus.CANCELLED);
        }
        return updatedOrder;
    }
    /**
     * 2. Get Vendor Earnings
     */
    static async getVendorEarnings(userId, db = prisma) {
        const transactions = await db.transaction.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        const totalCredits = transactions
            .filter((t) => t.type === client_1.TransactionType.CREDIT && t.status === client_1.TransactionStatus.SUCCESS)
            .reduce((sum, t) => sum + t.amount, 0);
        const totalDebits = transactions
            .filter((t) => t.type === client_1.TransactionType.DEBIT &&
            (t.status === client_1.TransactionStatus.SUCCESS || t.status === client_1.TransactionStatus.PENDING))
            .reduce((sum, t) => sum + t.amount, 0);
        const availableBalance = totalCredits - totalDebits;
        const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: userId } });
        let pendingBalance = 0;
        if (restaurant) {
            const activeOrders = await prisma.order.findMany({
                where: {
                    restaurantId: restaurant.id,
                    status: { in: ["PREPARING"] },
                    paymentStatus: "PAID",
                },
                include: {
                    items: true
                }
            });
            pendingBalance = activeOrders.reduce((sum, order) => {
                //  Calculate the exact food total
                const trueSubtotal = order.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                return sum + (0, pricing_1.calculateVendorShare)(trueSubtotal); //  Use the true subtotal
            }, 0);
        }
        return {
            availableBalance,
            pendingBalance,
            totalEarnings: totalCredits,
            withdrawn: totalDebits,
            currency: "NGN",
        };
    }
    /**
    * 4. Request Payout (Manual Workflow)
    */
    static async requestPayout(userId, amount, bankDetails) {
        const validData = restaurant_validator_1.payoutSchema.parse({ amount, bankDetails });
        if (validData.amount < 1000) {
            throw new Error("Minimum withdrawal is ₦1000");
        }
        return await prisma.$transaction(async (tx) => {
            // 🔒 1. Lock the USER row (vendor payouts)
            await tx.$queryRaw `
      SELECT id FROM "User"
      WHERE id = ${userId}
      FOR UPDATE
    `;
            // 🔒 2. Recalculate balance INSIDE transaction (VERY IMPORTANT)
            const { availableBalance } = await this.getVendorEarnings(userId, tx);
            if (validData.amount > availableBalance) {
                throw new Error(`Insufficient funds. Available: ₦${availableBalance.toLocaleString()}`);
            }
            // 🔒 3. Fetch restaurant + owner INSIDE transaction
            const restaurant = await tx.restaurant.findUnique({
                where: { ownerId: userId },
                include: {
                    owner: {
                        select: {
                            name: true,
                            email: true,
                        },
                    },
                },
            });
            if (!restaurant || !restaurant.owner) {
                throw new Error("Restaurant or Owner Not Found");
            }
            // 🔒 4. Create DEBIT (this reserves funds)
            const transaction = await tx.transaction.create({
                data: {
                    userId,
                    amount: validData.amount,
                    type: client_1.TransactionType.DEBIT,
                    category: client_1.TransactionCategory.WITHDRAWAL,
                    status: client_1.TransactionStatus.PENDING,
                    description: `Manual Payout Request to ${validData.bankDetails.bankName} (${validData.bankDetails.accountNumber})`,
                    reference: `MAN-PAY-${Date.now()}`,
                },
            });
            return {
                transaction,
                restaurantName: restaurant.name,
                ownerName: restaurant.owner.name,
                ownerEmail: restaurant.owner.email,
            };
        }).then(async ({ transaction, restaurantName, ownerName, ownerEmail }) => {
            // 🚀 Notifications OUTSIDE transaction (non-blocking)
            try {
                await (0, email_service_1.sendAdminPayoutAlert)(restaurantName, validData.amount, bankDetails);
                if (ownerEmail) {
                    await (0, email_service_1.sendPayoutRequestEmail)({
                        email: ownerEmail,
                        ownerName: ownerName,
                        restaurantName: restaurantName,
                        amount: validData.amount,
                        bankName: bankDetails.bankName,
                        accountNumber: bankDetails.accountNumber,
                    });
                }
                console.log(`Payout request logged for ${restaurantName}. Reference: ${transaction.reference}`);
            }
            catch (e) {
                console.error("Notification failed but transaction recorded:", e.message);
            }
            return transaction;
        });
    }
    // Get Vendor Transactions   
    static async getTransactions(userId) {
        return await prisma.transaction.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
    }
}
exports.VendorService = VendorService;
//# sourceMappingURL=vendor.service.js.map