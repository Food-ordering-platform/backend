import { PrismaClient, TransactionStatus, TransactionCategory, OrderStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export class AdminService {
  // ==========================================
  // 1. ANALYTICS DASHBOARD
  // ==========================================
  static async loginAdmin(email: string, password: string) {
    // 1. Find the user and ensure they are an ADMIN
    const admin = await prisma.user.findUnique({
      where: { email }
    });

    if (!admin || admin.role !== "ADMIN") {
      throw new Error("Invalid admin credentials");
    }

    if (!admin.password) {
      throw new Error("Invalid admin credentials");
    }

    // 2. Verify Password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw new Error("Invalid admin credentials");
    }

    // 3. Generate Token (Valid for 24 hours)
    const token = jwt.sign(
      { id: admin.id, role: admin.role, email: admin.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "24h" }
    );

    // Remove password from the returned object
    const { password: _, ...adminWithoutPassword } = admin;

    return {
      user: adminWithoutPassword,
      token,
    };
  }
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

  // Inside your AdminService class...

  // ==========================================
  // 1.5 CHART ANALYTICS
  // ==========================================
  static async getChartData() {
    // Generate buckets for the last 6 months (e.g., ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"])
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentDate = new Date();
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(currentDate.getMonth() - 5);
    sixMonthsAgo.setDate(1); // Start of that month
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Fetch Orders for Revenue within the last 6 months
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        createdAt: { gte: sixMonthsAgo }
      },
      select: { totalAmount: true, createdAt: true }
    });

    // Fetch Transactions for Profit within the last 6 months
    const profits = await prisma.transaction.findMany({
      where: {
        status: TransactionStatus.SUCCESS,
        category: TransactionCategory.PLATFORM_FEE,
        createdAt: { gte: sixMonthsAgo }
      },
      select: { amount: true, createdAt: true }
    });

    // Initialize our 6-month array structure
    const chartData: any = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(currentDate.getMonth() - i);
      chartData.push({ 
        month: months[d.getMonth()], 
        year: d.getFullYear(), 
        Revenue: 0, 
        Profit: 0 
      });
    }

    // Populate the buckets with real data
    orders.forEach(order => {
      const monthName = months[order.createdAt.getMonth()];
      const year = order.createdAt.getFullYear();
      
      const bucket = chartData.find((b: { month: string; year: number; }) => b.month === monthName && b.year === year);
      if (bucket) {
        bucket.Revenue += order.totalAmount;
      }
    });

    profits.forEach(profit => {
      const monthName = months[profit.createdAt.getMonth()];
      const year = profit.createdAt.getFullYear();
      
      const bucket = chartData.find((b: { month: string; year: number; }) => b.month === monthName && b.year === year);
      if (bucket) {
        bucket.Profit += profit.amount;
      }
    });

    // Remove the 'year' field before sending to the frontend to keep it clean for the chart
    return chartData.map(({ year: {}, ...rest }) => rest);
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