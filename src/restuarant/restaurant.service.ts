import tr from "zod/v4/locales/tr.cjs";
import { PrismaClient } from "@prisma/client";
import { uploadToCloudinary } from "../cloudinary/upload";
import { PRICING } from "../config/pricing";
import { sendAdminPayoutAlert, sendPayoutRequestEmail } from "../utils/email/email.service";
import { OrderService } from "../order/order.service";
import { payoutSchema } from "./restaurant.validator";

const prisma = new PrismaClient();

export class RestaurantService {
  // Create Restaurant
  // Create Restaurant with File Handling
  static async createRestaurant(
    ownerId: string,
    data: any,
    file?: Express.Multer.File
  ) {
    // 1. Check existence
    const existing = await prisma.restaurant.findUnique({ where: { ownerId } });
    if (existing) {
      throw new Error("You already have a restaurant");
    }

    // 2. Handle File Upload 
    let imageUrl = undefined;
    if (file) {
      // Use your Cloudinary helper here.
      // This ensures we get a secure URL back before saving to DB.
      const uploadResult = await uploadToCloudinary(file);
      imageUrl = uploadResult.secure_url || uploadResult.url;
    }

    // 3. Create in DB
    return await prisma.restaurant.create({
      data: {
        ownerId,
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        imageUrl: imageUrl, // Save the URL
        prepTime: data.prepTime || 20,
        minimumOrder: data.minimumOrder ?? 0.0,
        isOpen: data.isOpen ?? true,
        latitude: data.latitude,
        longitude: data.longitude
      },
    });
  }

  // Get all restaurants
  static async getAllRestaurant() {
    return await prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        imageUrl: true,
        prepTime: true,
        minimumOrder: true,
        isOpen: true,
      },
    });
  }

  // Get a single restaurant by ID (with menu)
  static async getRestaurantById(id: string) {
    return await prisma.restaurant.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            menuItems: true, // nested items
          },
        },
        // orders: {
        //   select: {
        //     id: true,
        //     customerId: true,
        //     totalAmount: true,
        //     paymentStatus: true,
        //     status: true,
        //     deliveryAddress: true,
        //     createdAt: true,
        //     updatedAt: true,
        //   },
        // },
      },
    });
  }

  // Update restaurant info
  // Update restaurant info
  static async updateRestaurant(
    id: string,
    data: any,
    file: Express.Multer.File | undefined
  ) {
    // 1. Handle File Upload if provided
    let imageUrl = undefined;
    if (file) {
      // ✅ Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(file);
      imageUrl = uploadResult.secure_url || uploadResult.url;
    }

    // 2. Prepare Update Data
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );

    // Only update the image URL if a new one was uploaded
    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    return await prisma.restaurant.update({
      where: { id },
      data: updateData,
    });
  }

  // ===== Menu Items =====
  // Get all menu items for a restaurant
  static async getMenuItems(restaurantId: string) {
    return await prisma.menuItem.findMany({
      where: { restaurantId },
      include: { category: true },
    });
  }

  // Add a new menu item
  // [FIX] Added 'file' parameter
  static async addMenuItem(
    restaurantId: string,
    data: any,
    file?: Express.Multer.File
  ) {
    // 1. Verify restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) throw new Error("Restaurant not found");

    // 2. Handle File Upload (Ticketer Strategy)
    let imageUrl = data.imageUrl; // Keep existing if passed, though unlikely
    if (file) {
      const uploadResult = await uploadToCloudinary(file);
      imageUrl = uploadResult.secure_url || uploadResult.url;
    }

    let categoryId = data.categoryId;

    // 3. Find or Create Category
    if (data.categoryName) {
      const cleanName = data.categoryName.trim();

      const existingCategory = await prisma.menuCategory.findFirst({
        where: {
          restaurantId,
          name: {
            equals: cleanName,
            mode: "insensitive",
          },
        },
      });
      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const newCategory = await prisma.menuCategory.create({
          data: {
            name: cleanName,
            restaurantId,
          },
        });
        categoryId = newCategory.id;
      }
    }

    if (!categoryId) {
      throw new Error("Category is required");
    }

    // 4. Create Menu Item
    return await prisma.menuItem.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: imageUrl, // Uses the Cloudinary URL
        available: true,
        restaurantId,
        categoryId,
      },
    });
  }

  // Update menu item
  static async updateMenuItem(id: string, data: any) {
    return await prisma.menuItem.update({
      where: { id },
      data,
    });
  }

  // Delete menu item
  static async deleteMenuItem(id: string) {
    return await prisma.menuItem.delete({
      where: { id },
    });
  }

  // Toggle menu item availability
  static async toggleMenuItemAvailability(id: string) {
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new Error("Menu item not found");

    return await prisma.menuItem.update({
      where: { id },
      data: { available: !item.available },
    });
  }

  //---------------GET EARNING FOR VENDOR -------------------//
  // Add this method to RestaurantService
  static async getEarnings(restaurantId: string) {
    // 1. Get the Owner (To find their Wallet)
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true }
    });

    if (!restaurant) throw new Error("Restaurant not found");

    // ============================================================
    // A. AVAILABLE BALANCE (From Transaction Table)
    // ============================================================
    // Sum of all Credits (Earnings) minus Debits (Withdrawals)
    const walletStats = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId: restaurant.ownerId,
        status: { in: ['SUCCESS', 'PENDING'] } // Count PENDING withdrawals so they can't overdraw
      },
      _sum: { amount: true }
    });

    let totalCredit = 0;
    let totalDebit = 0;

    walletStats.forEach(stat => {
      if (stat.type === 'CREDIT') totalCredit = stat._sum.amount || 0;
      if (stat.type === 'DEBIT') totalDebit = stat._sum.amount || 0;
    });

    const availableBalance = totalCredit - totalDebit;

    // ============================================================
    // B. PENDING BALANCE (From Orders Table)
    // ============================================================
    // Money currently "stuck" in active orders (Paid but not Delivered)
    const pendingOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        paymentStatus: "PAID",
        status: { in: ["PREPARING", "READY_FOR_PICKUP"] } // Cooking, Ready, or Out for Delivery
      },
      select: { totalAmount: true, deliveryFee: true }
    });

   // Use the shared helper to calculate pending money accurately
    const pendingBalance = pendingOrders.reduce((sum, order) => {
      return sum + OrderService.calculateVendorShare(order.totalAmount, order.deliveryFee);
    }, 0)
    
    return {
      availableBalance: availableBalance, // Real Money
      pendingBalance: pendingBalance,     // Future Money
      currency: "NGN",
    };
  }

  //-------------------------REQUEST VENDOR PAYOUT ------------------------------//
  // 2. REQUEST PAYOUT (MANUAL)
  static async requestPayout(
    restaurantId: string, 
    amount: number, 
    bankDetails: any
  ) {
    // 1. Validation (Strict Zod check)
    const validData = payoutSchema.parse({ amount, bankDetails });

    // 2. Check Balance
    const { availableBalance } = await RestaurantService.getEarnings(restaurantId);
    if (validData.amount > availableBalance) {
      throw new Error(`Insufficient funds. Available: ₦${availableBalance.toLocaleString()}`);
    }

    // 3. Get Owner
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { owner: true, ownerId: true, name: true }
    });
    if (!restaurant) throw new Error("Restaurant Not Found");

    // 4. Create Transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: restaurant.ownerId!,
        amount: validData.amount,
        type: "DEBIT",
        category: "WITHDRAWAL",
        status: "PENDING",
        description: `Withdrawal to ${validData.bankDetails.bankName} - ${validData.bankDetails.accountNumber}`,
        reference: `PAYOUT-${Date.now()}`
      }
    });

    // 5. 🔔 Notify Admin
    sendAdminPayoutAlert(restaurant.name, validData.amount, validData.bankDetails);

    return transaction;
  }  
//--------------------GET VENDOR TRANSACTION -----------------------------//


  static async getTransactions(restaurantId: string) {
    //1. Find owner of the restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where:{id:restaurantId},
      select:{ownerId:true}
    })

    if(!restaurant){
      throw new Error("Restaurant not found")
    }

    //2.Fetch Transaction for this owner
    //We order by createdAt desc so the the next money shows up
    const transaction = await prisma.transaction.findMany({
      where:{userId:restaurant.ownerId},
      orderBy:{createdAt:'desc'},
      take:50 //Limit to the last 50 for performance
    })
    return transaction
  }

  // Add to RestaurantService class

static async addReview(userId: string, orderId: string, rating: number, comment: string) {
  // 1. Get order to find restaurant
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { restaurant: true }
  });

  if (!order) throw new Error("Order not found");
  if (order.customerId !== userId) throw new Error("You can only rate your own orders");
  if (order.status !== "DELIVERED") throw new Error("Cannot rate undelivered order");
  
  const existingReview = await prisma.review.findUnique({
    where: { orderId }
  });

  if(existingReview) {
    throw new Error("You have already rated this order")
  }

  // 2. Create Review
  const review = await prisma.review.create({
    data: {
      userId,
      restaurantId: order.restaurantId,
      orderId,
      rating,
      comment
    }
  });

  // 3. Update Restaurant Average Rating
  const restaurantId = order.restaurantId;
  const aggregates = await prisma.review.aggregate({
    where: { restaurantId },
    _avg: { rating: true },
    _count: { rating: true }
  });

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      rating: aggregates._avg.rating || 0,
      ratingCount: aggregates._count.rating || 0
    }
  });

  return review;
}
}
