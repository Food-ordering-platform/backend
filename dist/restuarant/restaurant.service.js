"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestaurantService = void 0;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
class RestaurantService {
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
    //Get a single restaurant by ID
    static async getRestuarantbyId(id) {
        return await prisma.restaurant.findUnique({
            where: { id },
            include: {
                menuItems: true
            }
        });
    }
}
exports.RestaurantService = RestaurantService;
//# sourceMappingURL=restaurant.service.js.map