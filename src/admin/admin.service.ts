import { PrismaClient, TransactionStatus, TransactionCategory, OrderStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { calculateVendorShare, calculateRiderShare } from "../config/pricing";

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

    // 3. Get Financial Stats (from PAID orders)
    // 🟢 Fetch paid orders with items to calculate exact profit
    const paidOrders = await prisma.order.findMany({
      where: { paymentStatus: "PAID" },
      include: { items: true } // Need items to calculate food subtotal
    });

    let totalRevenue = 0;
    let totalProfit = 0;

    paidOrders.forEach(order => {
      // Revenue is the total money that entered the system
      totalRevenue += order.totalAmount;

      // Calculate the true food subtotal
      const foodSubtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Calculate what we owe others
      const vendorShare = calculateVendorShare(foodSubtotal);
      const riderShare = calculateRiderShare(order.deliveryFee);

      // 🟢 Profit is whatever is left! (Platform Fee + 15% Vendor Cut + 10% Rider Cut)
      totalProfit += (order.totalAmount - vendorShare - riderShare);
    });

    return {
      revenue: totalRevenue,
      profit: totalProfit,
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
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentDate = new Date();
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(currentDate.getMonth() - 5);
    sixMonthsAgo.setDate(1); 
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // 🟢 Fetch Orders WITH items to calculate both Revenue and Profit in one pass
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        createdAt: { gte: sixMonthsAgo }
      },
      include: { items: true } 
    });

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

    orders.forEach(order => {
      const monthName = months[order.createdAt.getMonth()];
      const year = order.createdAt.getFullYear();
      
      const bucket = chartData.find((b: { month: string; year: number; }) => b.month === monthName && b.year === year);
      
      if (bucket) {
        // Add to Revenue
        bucket.Revenue += order.totalAmount;

        // 🟢 Calculate and add to Profit
        const foodSubtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const vendorShare = calculateVendorShare(foodSubtotal);
        const riderShare = calculateRiderShare(order.deliveryFee);
        
        bucket.Profit += (order.totalAmount - vendorShare - riderShare);
      }
    });

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