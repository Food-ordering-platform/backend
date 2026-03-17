import { PrismaClient } from "@prisma/client";
import { uploadToCloudinary } from "../cloudinary/upload";
import { redisClient } from "../config/redis";
import slugify from "slugify";
import { sendRestaurantVerificationPendingEmail } from "../utils/email/email.service";

const prisma = new PrismaClient();

export class RestaurantService {
  // ===== Caching Keys =====
  private static CACHE_KEYS = {
    ALL_RESTAURANTS: "restaurants:all",
    RESTAURANT_BY_ID: (id: string) => `restaurant:${id}`,
    RESTAURANT_BY_SLUG: (slug: string) => `restaurant:slug:${slug}`,
    MENU_ITEMS: (id: string) => `restaurant:${id}:menu`,
  };

  /**
   * 🟢 The Master Cache Clearer
   * Wipes ALL relevant caches (ID, Slug, Menu, and Global List) instantly.
   * Accepts string | null to prevent TypeScript errors.
   */
  private static async clearRestaurantCache(id: string, slug?: string | null) {
    const keys = [
      this.CACHE_KEYS.RESTAURANT_BY_ID(id),
      this.CACHE_KEYS.ALL_RESTAURANTS,
      this.CACHE_KEYS.MENU_ITEMS(id)
    ];

    if (slug) {
      keys.push(this.CACHE_KEYS.RESTAURANT_BY_SLUG(slug));
    }

    await Promise.all(keys.map(key => redisClient.del(key)));
    console.log(`🧹 Cache cleared for restaurant: ${id} | slug: ${slug}`);
  }

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

    // Generate base slug from the restaurant name
    let baseSlug = slugify(data.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    // Ensure the slug is unique in the database
    while (await prisma.restaurant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    let imageUrl = undefined;
    if (file) {
      const uploadResult = await uploadToCloudinary(file);
      imageUrl = uploadResult.secure_url || uploadResult.url;
    }

    const newRestaurant = await prisma.restaurant.create({
      data: {
        ownerId,
        slug,
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

    // 🧹 Clear caches
    await this.clearRestaurantCache(newRestaurant.id, newRestaurant.slug);

    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    const recipientEmail = owner?.email || data.email;
    
    if (recipientEmail) {
      sendRestaurantVerificationPendingEmail(recipientEmail, newRestaurant.name).catch(console.error);
    }

    return newRestaurant;
  }

  static async getAllRestaurant() {
    const cachedData = await redisClient.get(this.CACHE_KEYS.ALL_RESTAURANTS);
    if (cachedData) {
      console.log("⚡ Serving restaurants from Redis Cache");
      return JSON.parse(cachedData);
    }

    console.log("🐌 Serving restaurants from Database");
    const restaurants = await prisma.restaurant.findMany({
      select: {
        id: true, name: true, address: true, phone: true,
        imageUrl: true, prepTime: true, minimumOrder: true, isOpen: true, slug: true
      },
    });

    await redisClient.setex(this.CACHE_KEYS.ALL_RESTAURANTS, 3600, JSON.stringify(restaurants));
    return restaurants;
  }

  static async getRestaurantBySlug(slug: string) {
    const cacheKey = this.CACHE_KEYS.RESTAURANT_BY_SLUG(slug);
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true, 
        slug: true,
        name: true,
        address: true,
        imageUrl: true,
        prepTime: true,
        minimumOrder: true,
        isOpen: true,
        categories: { include: { menuItems: true } }
      }
    });

    if (restaurant) {
      await redisClient.setex(cacheKey, 3600, JSON.stringify(restaurant));
    }
    return restaurant;
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

    // 🧹 Fix: Clear specific ID, Slug, and List cache so open/close toggles show immediately
    await this.clearRestaurantCache(id, updatedRestaurant.slug);

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
          name: { equals: cleanName, mode: "insensitive" },
        },
      });
      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const newCategory = await prisma.menuCategory.create({
          data: { name: cleanName, restaurantId },
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

    // 🧹 Fix: Pass the restaurant slug to clear the frontend cache
    await this.clearRestaurantCache(restaurantId, restaurant.slug);

    return newItem;
  }

  static async updateMenuItem(id: string, data: any) {
    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data,
      // 🟢 Fetch the restaurant slug at the same time so we know what cache to clear
      include: { restaurant: { select: { slug: true } } }
    });

    // 🧹 Fix: Instantly clear frontend slug cache
    await this.clearRestaurantCache(updatedItem.restaurantId, updatedItem.restaurant.slug);

    return updatedItem;
  }

  static async deleteMenuItem(id: string) {
    const deletedItem = await prisma.menuItem.delete({
      where: { id },
      // 🟢 Fetch the restaurant slug so we know what cache to clear
      include: { restaurant: { select: { slug: true } } }
    });

    // 🧹 Fix: Instantly clear frontend slug cache
    await this.clearRestaurantCache(deletedItem.restaurantId, deletedItem.restaurant.slug);

    return deletedItem;
  }

  static async toggleMenuItemAvailability(id: string) {
    const item = await prisma.menuItem.findUnique({ 
      where: { id },
      // 🟢 Grab the slug right away
      include: { restaurant: { select: { slug: true } } }
    });
    
    if (!item) throw new Error("Menu item not found");

    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: { available: !item.available },
    });

    // 🧹 Fix: Instantly clear frontend slug cache so users see "Sold Out"
    await this.clearRestaurantCache(item.restaurantId, item.restaurant.slug);

    return updatedItem;
  }
}