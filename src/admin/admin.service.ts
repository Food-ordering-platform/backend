import { PrismaClient, TransactionStatus, TransactionCategory, OrderStatus, Role, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { calculateVendorShare, calculateRiderShare, PRICING } from "../config/pricing";
import ExcelJS from 'exceljs';

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
    // 1. Get User Counts (Includes Online Riders)
    const [customers, vendors, riders, onlineRiders] = await Promise.all([
      prisma.user.count({ where: { role: Role.CUSTOMER } }),
      prisma.user.count({ where: { role: Role.VENDOR } }),
      prisma.user.count({ where: { role: Role.RIDER } }),
      prisma.user.count({ where: { role: Role.RIDER, isOnline: true } }),
    ]);

    // 2. Get Order Stats 
    // 🟢 FIX: ONLY count orders where the customer actually paid!
    const totalOrders = await prisma.order.count({
      where: { paymentStatus: "PAID" } 
    });
    
    const deliveredOrders = await prisma.order.count({ 
      where: { status: OrderStatus.DELIVERED } 
    });
    
    // 🟢 FIX: Only count paid orders that were later cancelled/failed
    const failedOrders = await prisma.order.count({ 
      where: { status: OrderStatus.CANCELLED, paymentStatus: "PAID" } 
    });
    
    const activeDeliveries = await prisma.order.count({
      where: { status: { in: [OrderStatus.RIDER_ACCEPTED, OrderStatus.OUT_FOR_DELIVERY] } }
    });

    // 3. Get Financial Stats (from PAID orders)
    const paidOrders = await prisma.order.findMany({
      where: { paymentStatus: "PAID" },
      include: { items: true } 
    });

    let totalRevenue = 0;
    let totalProfit = 0;

    paidOrders.forEach(order => {
      totalRevenue += order.totalAmount;
      const foodSubtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const vendorShare = calculateVendorShare(foodSubtotal);
      const riderShare = calculateRiderShare(order.deliveryFee);
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
      onlineRiders, 
      activeDeliveries, 
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

  // ==========================================
  // 4. LOGISTICS FLEET MANAGEMENT
  // ==========================================
  static async createLogisticsCompany(data: {
    name: string;
    managerEmail: string;
    bankName: string;
    accountNumber: string;
    showEarningsToRiders: boolean;
  }) {
    // Generate a unique 6-character invite code (e.g., SWIFT-9A2B)
    const randomString = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = data.name.substring(0, 3).toUpperCase();
    const inviteCode = `${prefix}-${randomString}`;

    return prisma.logisticsCompany.create({
      data: {
        ...data,
        inviteCode,
      }
    });
  }

  static async getLogisticsCompanies() {
    return prisma.logisticsCompany.findMany({
      include: {
        _count: { select: { riders: true } } // Shows how many riders joined!
      },
      orderBy: { createdAt: "desc" }
    });
  }

  static async generateCompanySettlement(companyId: string, startDate: Date, endDate: Date) {
    const company = await prisma.logisticsCompany.findUnique({
      where: { id: companyId },
      include: {
        riders: {
          include: {
            deliveries: {
              where: {
                status: 'DELIVERED',
                updatedAt: { gte: startDate, lte: endDate }
              }
            }
          }
        }
      }
    });

    if (!company) throw new Error("Logistics company not found");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Weekly Settlement');

    // 🟢 1. NEW COLUMNS: A complete breakdown of the money
    worksheet.columns = [
      { header: 'Rider Name', key: 'riderName', width: 25 },
      { header: 'Deliveries', key: 'totalDeliveries', width: 12 },
      { header: 'Distance (KM)', key: 'totalDistance', width: 15 },
      { header: 'Gross Fees (100%)', key: 'grossFees', width: 20 },      // What customer paid
      { header: 'Platform Fee (10%)', key: 'platformFee', width: 20 },  // ChowEazy's cut
      { header: 'Net Payout (90%)', key: 'netPayout', width: 20 },      // Logistics cut
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };

    // 🟢 2. TRACK GRAND TOTALS
    let grandTotalGross = 0;
    let grandTotalPlatform = 0;
    let grandTotalPayout = 0;

    for (const rider of company.riders) {
      let totalRiderDistance = 0;
      let riderGrossFees = 0;
      let riderPlatformFee = 0;
      let riderNetPayout = 0;

      for (const order of rider.deliveries) {
        // The deliveryFee in the database is the 100% amount
        const gross = order.deliveryFee;
        const net = calculateRiderShare(order.deliveryFee); // Uses your 90% logic
        const platform = gross - net; // The remaining 10%

        riderGrossFees += gross;
        riderNetPayout += net;
        riderPlatformFee += platform;
        totalRiderDistance += (order.deliveryDistance || 0); 
      }

      // Add to Grand Totals
      grandTotalGross += riderGrossFees;
      grandTotalPlatform += riderPlatformFee;
      grandTotalPayout += riderNetPayout;

      // Add Rider Row
      worksheet.addRow({
        riderName: rider.name,
        totalDeliveries: rider.deliveries.length,
        totalDistance: totalRiderDistance.toFixed(1),
        grossFees: riderGrossFees,
        platformFee: riderPlatformFee,
        netPayout: riderNetPayout
      });
    }

    // 🟢 3. ADD THE GRAND TOTAL SUMMARY ROW
    worksheet.addRow({}); // Empty row for spacing
    const totalRow = worksheet.addRow({
      riderName: 'GRAND TOTAL DUE',
      grossFees: grandTotalGross,
      platformFee: grandTotalPlatform,
      netPayout: grandTotalPayout // This is the exact amount you transfer to their bank
    });
    
    totalRow.font = { bold: true, size: 12 };
    
    // Format the currency columns nicely
    ['grossFees', 'platformFee', 'netPayout'].forEach(key => {
        worksheet.getColumn(key).numFmt = '₦#,##0.00';
    });

    return await workbook.xlsx.writeBuffer();
  }
  // ==========================================
  // LOGISTICS PAYOUT (Matches Rider/Vendor Style)
  // ==========================================
  static async recordCompanyPayout(companyId: string) {
    const company = await prisma.logisticsCompany.findUnique({
      where: { id: companyId },
      include: { riders: true }
    });
    
    if (!company) throw new Error("Company not found");

    // 1. Calculate the total available balance for ALL riders in the fleet
    let totalFleetBalance = 0;
    
    for (const rider of company.riders) {
      // Just sum up the successful credits vs debits for each rider
      const txns = await prisma.transaction.findMany({
        where: { userId: rider.id }
      });
      
      const balance = txns.reduce((sum, txn) => {
        if (txn.status !== 'SUCCESS') return sum;
        return txn.type === 'CREDIT' ? sum + txn.amount : sum - txn.amount;
      }, 0);

      totalFleetBalance += balance;
    }

    if (totalFleetBalance <= 0) {
      throw new Error("This company has no outstanding balance to pay.");
    }

    // 2. Atomic Transaction: Debit all riders at once
    return await prisma.$transaction(async (tx) => {
      const debitPromises = company.riders.map(rider => 
        tx.transaction.create({
          data: {
            userId: rider.id,
            amount: 0, // We will calculate their specific cut in a sec
            type: TransactionType.DEBIT,
            category: TransactionCategory.WITHDRAWAL,
            status: TransactionStatus.SUCCESS, //  Auto-Success because Admin triggered it
            description: `Weekly Bulk Settlement paid to ${company.name}`,
            reference: `FLT-PAY-${company.id.substring(0,5)}-${Date.now()}`
          }
        })
      );

      // We actually need to find each rider's specific balance to zero them out properly
      for (let i = 0; i < company.riders.length; i++) {
         const rider = company.riders[i];
         const txns = await tx.transaction.findMany({ where: { userId: rider.id, status: 'SUCCESS' } });
         const balance = txns.reduce((sum, t) => t.type === 'CREDIT' ? sum + t.amount : sum - t.amount, 0);
         
         if (balance > 0) {
            await tx.transaction.create({
              data: {
                userId: rider.id,
                amount: balance, // 🟢 Debits exact amount they were owed
                type: 'DEBIT',
                category: 'WITHDRAWAL',
                status: 'SUCCESS',
                description: `Weekly Bulk Settlement paid to ${company.name}`,
                reference: `FLT-PAY-${rider.id.substring(0,5)}-${Date.now()}`
              }
            });
         }
      }

      return { 
        success: true, 
        message: `Successfully recorded ₦${totalFleetBalance} payout for ${company.name}` 
      };
    });
  }
}