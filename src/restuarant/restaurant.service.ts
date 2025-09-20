import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

export class RestaurantService {
  // Get all restaurants
  static async getAllRestaurant() {
    return await prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        imageUrl: true,
        deliveryTime: true,
        deliveryFee: true,
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
  static async updateRestaurant(id: string, data: any) {
    return await prisma.restaurant.update({
      where: { id },
      data,
    });
  }

  // ===== Menu Items =====
  // Get all menu items for a restaurant
  static async getMenuItems(restaurantId: string) {
    return await prisma.menuItem.findMany({
      where: { restaurantId },
    });
  }

  // Add a new menu item
  static async addMenuItem(restaurantId: string, data: any) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new Error("Restaurant not found");

  return await prisma.menuItem.create({
    data: {
      ...data,
      restaurantId,
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
