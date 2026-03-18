import { PrismaClient, TransactionStatus, TransactionCategory, OrderStatus, Role } from "@prisma/client";

const prisma = new PrismaClient();

export class AdminService {
  // ==========================================
  // 1. ANALYTICS DASHBOARD
  // ==========================================
  static async getDashboardAnalytics() {
    // 1. Get User Counts
    const [customers, vendors, riders] = await Promise.all([
      prisma.user.count({ where: { role: Role.CUSTOMER } }),
      prisma.user.count({ where: { role: Role.VENDOR } }),
      prisma.user.count({ where: { role: Role.RIDER } }),
    ]);

    // 2. Get Order Stats
    const totalOrders = await prisma.order.count();
    const deliveredOrders = await prisma.order.count({ 
      where: { status: OrderStatus.DELIVERED } 
    });
    const failedOrders = await prisma.order.count({ 
      where: { status: OrderStatus.CANCELLED } 
    });

    // 3. Get Financial Stats (from successful transactions)
    // Revenue: Total sum of all orders
    const revenueAggr = await prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: "PAID" }
    });

    // Profit: Sum of all platform fees collected
    const profitAggr = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { 
        status: TransactionStatus.SUCCESS, 
        category: TransactionCategory.PLATFORM_FEE 
      }
    });

    return {
      revenue: revenueAggr._sum.totalAmount || 0,
      profit: profitAggr._sum.amount || 0,
      totalOrders,
      deliveredOrders,
      failedOrders,
      customers,
      vendors,
      riders,
    };
  }

  // ==========================================
  // 2. USER MANAGEMENT
  // ==========================================
  static async getAllUsers(roleFilter?: Role) {
    const whereClause = roleFilter ? { role: roleFilter } : {};
    
    return prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" }
    });
  }

  static async approveUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
      select: { id: true, name: true, role: true, isVerified: true }
    });
  }

  static async deleteUser(userId: string) {
    return prisma.user.delete({
      where: { id: userId }
    });
  }

  // ==========================================
  // 3. PAYOUTS MANAGEMENT
  // ==========================================
  static async getPayoutRequests() {
    // Fetch all transactions that are withdrawals
    return prisma.transaction.findMany({
      where: { category: TransactionCategory.WITHDRAWAL },
      include: {
        user: {
          select: { name: true, role: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  static async markPayoutAsPaid(transactionId: string) {
    return prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.SUCCESS }
    });
  }
}