import { PrismaClient } from "@prisma/client";
import { uploadToCloudinary } from "../cloudinary/upload";
import { redisClient } from "../config/redis";

const prisma = new PrismaClient();

export class RestaurantService {
  // ===== Caching Keys =====
  private static CACHE_KEYS = {
    ALL_RESTAURANTS: "restaurants:all",
    RESTAURANT_BY_ID: (id: string) => `restaurant:${id}`,
    MENU_ITEMS: (id: string) => `restaurant:${id}:menu`,
  };
  
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

    const newRestaurant = await prisma.restaurant.create({
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

    // 🧹 Invalidate the "all restaurants" cache since a new one was added
    await redisClient.del(this.CACHE_KEYS.ALL_RESTAURANTS);

    return newRestaurant;
  }

  static async getAllRestaurant() {
    // 1. Check Redis Cache First
    const cachedData = await redisClient.get(this.CACHE_KEYS.ALL_RESTAURANTS);
    if (cachedData) {
      console.log("⚡ Serving restaurants from Redis Cache");
      return JSON.parse(cachedData);
    }

    // 2. If not in cache, fetch from DB
    console.log("🐌 Serving restaurants from Database");
    const restaurants = await prisma.restaurant.findMany({
      select: {
        id: true, name: true, address: true, phone: true,
        imageUrl: true, prepTime: true, minimumOrder: true, isOpen: true,
      },
    });

    // 3. Save to Cache for 1 hour (3600 seconds)
    await redisClient.setex(this.CACHE_KEYS.ALL_RESTAURANTS, 3600, JSON.stringify(restaurants));
    return restaurants;
  }

  static async getRestaurantById(id: string) {
    const cacheKey = this.CACHE_KEYS.RESTAURANT_BY_ID(id);
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: { categories: { include: { menuItems: true } } },
    });

    if (restaurant) {
      await redisClient.setex(cacheKey, 3600, JSON.stringify(restaurant));
    }
    return restaurant;
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

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: updateData,
    });

    // 🧹 Invalidate both the specific restaurant cache and the general list
    await redisClient.del(this.CACHE_KEYS.RESTAURANT_BY_ID(id));
    await redisClient.del(this.CACHE_KEYS.ALL_RESTAURANTS);

    return updatedRestaurant;
  }

  // ===== Menu Items =====
  
  static async getMenuItems(restaurantId: string) {
    const cacheKey = this.CACHE_KEYS.MENU_ITEMS(restaurantId);
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const items = await prisma.menuItem.findMany({
      where: { restaurantId },
      include: { category: true },
    });

    await redisClient.setex(cacheKey, 3600, JSON.stringify(items));
    return items;
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

    const newItem = await prisma.menuItem.create({
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

    // 🧹 Invalidate the menu cache and the restaurant cache (since it includes menu items)
    await redisClient.del(this.CACHE_KEYS.MENU_ITEMS(restaurantId));
    await redisClient.del(this.CACHE_KEYS.RESTAURANT_BY_ID(restaurantId));

    return newItem;
  }

  static async updateMenuItem(id: string, data: any) {
    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data,
    });

    // 🧹 Invalidate caches using the restaurantId from the updated item
    await redisClient.del(this.CACHE_KEYS.MENU_ITEMS(updatedItem.restaurantId));
    await redisClient.del(this.CACHE_KEYS.RESTAURANT_BY_ID(updatedItem.restaurantId));

    return updatedItem;
  }

  static async deleteMenuItem(id: string) {
    const deletedItem = await prisma.menuItem.delete({
      where: { id },
    });

    // 🧹 Invalidate caches using the restaurantId from the deleted item
    await redisClient.del(this.CACHE_KEYS.MENU_ITEMS(deletedItem.restaurantId));
    await redisClient.del(this.CACHE_KEYS.RESTAURANT_BY_ID(deletedItem.restaurantId));

    return deletedItem;
  }

  static async toggleMenuItemAvailability(id: string) {
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new Error("Menu item not found");

    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: { available: !item.available },
    });

    // 🧹 Invalidate caches using the restaurantId
    await redisClient.del(this.CACHE_KEYS.MENU_ITEMS(item.restaurantId));
    await redisClient.del(this.CACHE_KEYS.RESTAURANT_BY_ID(item.restaurantId));

    return updatedItem;
  }
}