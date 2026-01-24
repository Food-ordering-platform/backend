"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
class AdminService {
    static async getPendingWithdrawals() {
        return prisma.transaction.findMany({
            where: {
                category: "WITHDRAWAL",
                status: "PENDING"
            },
            include: {
                user: { select: { name: true, email: true, phone: true } }
            },
            orderBy: { createdAt: "desc" }
        });
    }
    static async processWithdrawal(transactionId, action) {
        const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
        if (!transaction)
            throw new Error("Transaction not found");
        if (transaction.status !== "PENDING")
            throw new Error("Transaction already processed");
        const newStatus = action === "APPROVE" ? "SUCCESS" : "FAILED";
        // If REJECTED, the money effectively "returns" to their balance because 
        // getEarnings() calculates (Credits - Debits). 
        // However, for strict accounting, we usually create a "REFUND" credit or just mark this debit as FAILED.
        // In your logic, marking it FAILED removes it from the "Total Debit" sum, refunding the user.
        return prisma.transaction.update({
            where: { id: transactionId },
            data: { status: newStatus }
        });
    }
}
exports.AdminService = AdminService;
//# sourceMappingURL=admin.service.js.map