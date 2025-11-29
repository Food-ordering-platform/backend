"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestaurantController = void 0;
const restaurant_service_1 = require("./restaurant.service");
class RestaurantController {
    // GET /restaurant
    static async getAllRestaurants(req, res) {
        try {
            const restaurant = await restaurant_service_1.RestaurantService.getAllRestaurant();
            res.status(200).json({
                success: true,
                data: restaurant,
            });
        }
        catch (err) {
            console.error("Error fetching Restaurants", err);
            res.status(500).json({
                success: false,
                message: "Failed to fetch restaurants",
            });
        }
    }
    // GET /restaurant/:id
    static async getRestaurantById(req, res) {
        try {
            const { id } = req.params;
            const restaurant = await restaurant_service_1.RestaurantService.getRestaurantById(id);
            if (!restaurant) {
                return res.status(404).json({
                    success: false,
                    message: "Restaurant not found",
                });
            }
            res.status(200).json({
                success: true,
                data: restaurant,
            });
        }
        catch (err) {
            console.error("Error fetching restaurant:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch restaurant",
            });
        }
    }
    // PUT /restaurant/:id
    static async updateRestaurant(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const updated = await restaurant_service_1.RestaurantService.updateRestaurant(id, data);
            res.status(200).json({
                success: true,
                data: updated,
            });
        }
        catch (err) {
            console.error("Error updating restaurant:", err);
            res.status(500).json({
                success: false,
                message: "Failed to update restaurant",
            });
        }
    }
    // ===== Menu Management =====
    // GET /restaurant/:id/menu
    static async getMenuItems(req, res) {
        try {
            const { id } = req.params;
            const items = await restaurant_service_1.RestaurantService.getMenuItems(id);
            res.status(200).json({
                success: true,
                data: items,
            });
        }
        catch (err) {
            console.error("Error fetching menu:", err);
            res.status(500).json({
                success: false,
                message: "Failed to fetch menu items",
            });
        }
    }
    // POST /restaurant/:id/menu
    static async addMenuItem(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const item = await restaurant_service_1.RestaurantService.addMenuItem(id, data);
            res.status(201).json({
                success: true,
                data: item,
            });
        }
        catch (err) {
            console.error("Error adding menu item:", err);
            res.status(500).json({
                success: false,
                message: "Failed to add menu item",
            });
        }
    }
    // PUT /menu/:id
    static async updateMenuItem(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const updated = await restaurant_service_1.RestaurantService.updateMenuItem(id, data);
            res.status(200).json({
                success: true,
                data: updated,
            });
        }
        catch (err) {
            console.error("Error updating menu item:", err);
            res.status(500).json({
                success: false,
                message: "Failed to update menu item",
            });
        }
    }
    // DELETE /menu/:id
    static async deleteMenuItem(req, res) {
        try {
            const { id } = req.params;
            await restaurant_service_1.RestaurantService.deleteMenuItem(id);
            res.status(200).json({
                success: true,
                message: "Menu item deleted",
            });
        }
        catch (err) {
            console.error("Error deleting menu item:", err);
            res.status(500).json({
                success: false,
                message: "Failed to delete menu item",
            });
        }
    }
    // PATCH /menu/:id/toggle
    static async toggleMenuItemAvailability(req, res) {
        try {
            const { id } = req.params;
            const updated = await restaurant_service_1.RestaurantService.toggleMenuItemAvailability(id);
            res.status(200).json({
                success: true,
                data: updated,
            });
        }
        catch (err) {
            console.error("Error toggling availability:", err);
            res.status(500).json({
                success: false,
                message: "Failed to toggle menu item availability",
            });
        }
    }
}
exports.RestaurantController = RestaurantController;
//# sourceMappingURL=restaurant.controller.js.map