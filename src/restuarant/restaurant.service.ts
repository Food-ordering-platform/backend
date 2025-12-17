import { PrismaClient } from "../../generated/prisma";
import { uploadToCloudinary } from "../cloudinary/upload";

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

    // 2. Handle File Upload (Ticketer Strategy)
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
        orders: {
          select: {
            id: true,
            customerId: true,
            totalAmount: true,
            paymentStatus: true,
            status: true,
            deliveryAddress: true,
            createdAt: true,
            updatedAt: true,
          },
        },
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
}
