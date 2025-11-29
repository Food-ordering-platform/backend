"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestaurantService = void 0;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
class RestaurantService {
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
    static async getRestaurantById(id) {
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
    static async updateRestaurant(id, data) {
        return await prisma.restaurant.update({
            where: { id },
            data,
        });
    }
    // ===== Menu Items =====
    // Get all menu items for a restaurant
    static async getMenuItems(restaurantId) {
        return await prisma.menuItem.findMany({
            where: { restaurantId },
        });
    }
    // Add a new menu item
    static async addMenuItem(restaurantId, data) {
        const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
        if (!restaurant)
            throw new Error("Restaurant not found");
        return await prisma.menuItem.create({
            data: {
                ...data,
                restaurantId,
            },
        });
    }
    // Update menu item
    static async updateMenuItem(id, data) {
        return await prisma.menuItem.update({
            where: { id },
            data,
        });
    }
    // Delete menu item
    static async deleteMenuItem(id) {
        return await prisma.menuItem.delete({
            where: { id },
        });
    }
    // Toggle menu item availability
    static async toggleMenuItemAvailability(id) {
        const item = await prisma.menuItem.findUnique({ where: { id } });
        if (!item)
            throw new Error("Menu item not found");
        return await prisma.menuItem.update({
            where: { id },
            data: { available: !item.available },
        });
    }
}
exports.RestaurantService = RestaurantService;
//# sourceMappingURL=restaurant.service.js.map