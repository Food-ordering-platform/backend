import { PrismaClient } from "@prisma/client";
import { uploadToCloudinary } from "../cloudinary/upload";

const prisma = new PrismaClient();

export class RestaurantService {
  // ===== Restaurant Profile =====
  
  static async createRestaurant(
    ownerId: string,
    data: any,
    file?: Express.Multer.File
  ) {
    const existing = await prisma.restaurant.findUnique({ where: { ownerId } });
    if (existing) {
      throw new Error("You already have a restaurant");
    }

    let imageUrl = undefined;
    if (file) {
      const uploadResult = await uploadToCloudinary(file);
      imageUrl = uploadResult.secure_url || uploadResult.url;
    }

    return await prisma.restaurant.create({
      data: {
        ownerId,
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        imageUrl: imageUrl,
        prepTime: data.prepTime || 20,
        minimumOrder: data.minimumOrder ?? 0.0,
        isOpen: data.isOpen ?? true,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }

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

  static async getRestaurantById(id: string) {
    return await prisma.restaurant.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            menuItems: true,
          },
        },
      },
    });
  }

  static async updateRestaurant(
    id: string,
    data: any,
    file: Express.Multer.File | undefined
  ) {
    let imageUrl = undefined;
    if (file) {
      const uploadResult = await uploadToCloudinary(file);
      imageUrl = uploadResult.secure_url || uploadResult.url;
    }

    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );

    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    return await prisma.restaurant.update({
      where: { id },
      data: updateData,
    });
  }

  // ===== Menu Items =====
  
  static async getMenuItems(restaurantId: string) {
    return await prisma.menuItem.findMany({
      where: { restaurantId },
      include: { category: true },
    });
  }

  static async addMenuItem(
    restaurantId: string,
    data: any,
    file?: Express.Multer.File
  ) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) throw new Error("Restaurant not found");

    let imageUrl = data.imageUrl;
    if (file) {
      const uploadResult = await uploadToCloudinary(file);
      imageUrl = uploadResult.secure_url || uploadResult.url;
    }

    let categoryId = data.categoryId;

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

    return await prisma.menuItem.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: imageUrl,
        available: true,
        restaurantId,
        categoryId,
      },
    });
  }

  static async updateMenuItem(id: string, data: any) {
    return await prisma.menuItem.update({
      where: { id },
      data,
    });
  }

  static async deleteMenuItem(id: string) {
    return await prisma.menuItem.delete({
      where: { id },
    });
  }

  static async toggleMenuItemAvailability(id: string) {
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new Error("Menu item not found");

    return await prisma.menuItem.update({
      where: { id },
      data: { available: !item.available },
    });
  }

  // ===== Reviews =====

  static async addReview(userId: string, orderId: string, rating: number, comment: string) {
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
      throw new Error("You have already rated this order");
    }

    const review = await prisma.review.create({
      data: {
        userId,
        restaurantId: order.restaurantId,
        orderId,
        rating,
        comment
      }
    });

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