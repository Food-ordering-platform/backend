"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestaurantController = void 0;
const restaurant_service_1 = require("./restaurant.service");
class RestaurantController {
    //Get /Restaurant
    static async getAllRestaurants(req, res) {
        try {
            const restaurant = await restaurant_service_1.RestaurantService.getAllRestaurant();
            res.status(200).json({
                success: true,
                data: restaurant
            });
        }
        catch (err) {
            console.error("Error fetching Restaurants", err);
            res.status(500).json({
                success: false,
                message: "Failed to fetch restaurants"
            });
        }
    }
    //Get /restaurant/id
    static async getRestaurantById(req, res) {
        try {
            const { id } = req.params;
            const restaurant = await restaurant_service_1.RestaurantService.getRestuarantbyId(id);
            if (!restaurant) {
                return res.status(401).json({
                    success: false,
                    message: "Resturant not found"
                });
            }
            res.status(200).json({
                success: true,
                data: restaurant
            });
        }
        catch (err) {
            console.error("Error fetching restaurant:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch Restaurant"
            });
        }
    }
}
exports.RestaurantController = RestaurantController;
//# sourceMappingURL=restaurant.controller.js.map