"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const prisma_1 = require("../../generated/prisma");
const payment_service_1 = require("../payment/payment.service");
const crypto_1 = require("crypto");
const prisma = new prisma_1.PrismaClient();
//Temporal Code
// Generate a random 32-character token
function generateToken() {
    return (0, crypto_1.randomBytes)(16).toString("hex"); // 16 bytes = 32 hex characters
}
class OrderService {
    // Create order AND initialize payment
    static async createOrderWithPayment(customerId, restaurantId, totalAmount, deliveryAddress, items, customerName, customerEmail) {
        //Temporal COde
        // Generate unique token
        let token = generateToken();
        let tokenExists = true;
        // Ensure token is unique (retry if collision)
        while (tokenExists) {
            const existing = await prisma.order.findUnique({ where: { token } });
            if (!existing) {
                tokenExists = false;
            }
            else {
                token = generateToken();
            }
        }
        // 1️⃣ Create order in DB
        const order = await prisma.order.create({
            data: {
                customerId,
                restaurantId,
                totalAmount,
                paymentStatus: "PENDING",
                status: "PENDING",
                deliveryAddress,
                token,
                items: {
                    create: items.map((i) => ({
                        menuItemId: i.menuItemId,
                        quantity: i.quantity,
                        price: i.price,
                    })),
                },
            },
            include: { items: true },
        });
        // 2️⃣ Initialize payment
        const checkoutUrl = await payment_service_1.PaymentService.initiatePayment(totalAmount, customerName, customerEmail, order.reference);
        return { order, checkoutUrl };
    }
    // Get all orders for a customer
    static async getOrdersByCustomer(customerId) {
        return prisma.order.findMany({
            where: { customerId },
            select: {
                id: true,
                reference: true,
                token: true,
                totalAmount: true,
                paymentStatus: true,
                status: true,
                restaurant: { select: { name: true } },
                items: {
                    select: {
                        quantity: true,
                        price: true,
                        menuItem: { select: { name: true } },
                    },
                },
                // remove createdAt/updatedAt if you don't want them
            },
            orderBy: { createdAt: "desc" },
        });
    }
    static async getOrderByReference(reference) {
        return prisma.order.findUnique({
            where: { reference },
            include: {
                restaurant: { select: { name: true } },
                items: {
                    select: {
                        quantity: true,
                        price: true,
                        menuItem: { select: { name: true } },
                    },
                },
            },
        });
    }
    //Temporal COde
    // Get order by token (for restaurant dashboard and customer tracking)
    static async getOrderByToken(token) {
        return prisma.order.findUnique({
            where: { token },
            include: {
                restaurant: { select: { name: true, address: true, phone: true } },
                items: {
                    select: {
                        quantity: true,
                        price: true,
                        menuItem: { select: { name: true, description: true } },
                    },
                },
            },
        });
    }
    // Update order status by token (for restaurant dashboard)
    static async updateOrderStatusByToken(token, status) {
        return prisma.order.update({
            where: { token },
            data: { status: status },
            include: {
                restaurant: { select: { name: true } },
                items: {
                    select: {
                        quantity: true,
                        price: true,
                        menuItem: { select: { name: true } },
                    },
                },
            },
        });
    }
}
exports.OrderService = OrderService;
//# sourceMappingURL=order.service.js.map