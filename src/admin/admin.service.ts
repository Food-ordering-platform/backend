import { PrismaClient, TransactionStatus, Role } from "@prisma/client";
const prisma = new PrismaClient();

export class AdminService {
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

  static async processWithdrawal(transactionId: string, action: "APPROVE" | "REJECT") {
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new Error("Transaction not found");

    if (transaction.status !== "PENDING") throw new Error("Transaction already processed");

    const newStatus: TransactionStatus = action === "APPROVE" ? "SUCCESS" : "FAILED";

    // If REJECTED, the money effectively "returns" to their balance because 
    // getEarnings() calculates (Credits - Debits). 
    // However, for strict accounting, we usually create a "REFUND" credit or just mark this debit as FAILED.
    // In your logic, marking it FAILED removes it from the "Total Debit" sum, refunding the user.

    return prisma.transaction.update({
      where: { id: transactionId },
      data: { status: newStatus }
    });
  }

  /**
   * Approve a rider account.
   * - Sets isVerified = true (admin approval)
   * - Sets isOnline  = true so they immediately start receiving jobs
   */
  static async approveRider(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.role !== "RIDER") {
      throw new Error("User is not a rider");
    }

    if (!user.isEmailVerified) {
      throw new Error("Rider email not verified yet");
    }

    // Mark rider as approved and online by default
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        isOnline: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
        isOnline: true,
      },
    });

    return updated;
  }
}