"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestaurantController = void 0;
const restaurant_service_1 = require("./restaurant.service");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class RestaurantController {
    static parseRestaurantBody(body) {
        return {
            name: body.name,
            address: body.address,
            phone: body.phone,
            email: body.email,
            prepTime: body.prepTime ? parseInt(body.prepTime, 10) : undefined,
            latitude: body.latitude ? parseFloat(body.latitude) : undefined,
            longitude: body.longitude ? parseFloat(body.longitude) : undefined,
            minimumOrder: body.minimumOrder ? parseFloat(body.minimumOrder) : undefined,
            isOpen: body.isOpen !== undefined
                ? body.isOpen === "true" || body.isOpen === true
                : undefined,
        };
    }
    // ===== Restaurant Profile Management =====
    static async createRestaurant(req, res) {
        try {
            // 🟢 Middleware already verified the token! 
            // It usually attaches the data to req.user
            const ownerId = req.user?.id;
            if (!ownerId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
            // Process the body
            const restaurantData = RestaurantController.parseRestaurantBody(req.body);
            // Call the service
            const restaurant = await restaurant_service_1.RestaurantService.createRestaurant(ownerId, restaurantData, req.file);
            res.status(201).json({
                success: true,
                message: "Restaurant Profile Created Successfully",
                data: restaurant,
            });
        }
        catch (err) {
            console.error("Error Creating Restaurant:", err);
            res.status(err.status || 400).json({
                success: false,
                message: err.message || "Failed to create restaurant",
            });
        }
    }
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
    static async getRestaurantBySlug(req, res) {
        try {
            const { slug } = req.params;
            const restaurant = await restaurant_service_1.RestaurantService.getRestaurantBySlug(slug);
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
            console.error("Error fetching restaurant by slug:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch restaurant",
            });
        }
    }
    static async updateRestaurant(req, res) {
        try {
            const { id } = req.params;
            const authHeader = req.headers.authorization;
            if (!authHeader)
                return res.status(401).json({ message: "No token provided" });
            const token = authHeader.split(" ")[1];
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId;
            const existingRestaurant = await restaurant_service_1.RestaurantService.getRestaurantById(id);
            if (!existingRestaurant) {
                return res
                    .status(404)
                    .json({ success: false, message: "Restaurant not found" });
            }
            if (existingRestaurant.ownerId !== userId) {
                return res
                    .status(403)
                    .json({ success: false, message: "Unauthorized" });
            }
            const restaurantData = RestaurantController.parseRestaurantBody(req.body);
            const updated = await restaurant_service_1.RestaurantService.updateRestaurant(id, restaurantData, req.file);
            res.status(200).json({ success: true, data: updated });
        }
        catch (err) {
            console.error("Error Updating Restaurant:", err);
            res.status(500).json({
                success: false,
                message: err.message || "Failed to update restaurant",
            });
        }
    }
    // ===== Menu Management =====
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
    static async addMenuItem(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            if (data.price) {
                data.price = parseFloat(data.price);
            }
            const item = await restaurant_service_1.RestaurantService.addMenuItem(id, data, req.file);
            res.status(201).json({
                success: true,
                message: "Item added successfully",
                data: item,
            });
        }
        catch (err) {
            console.error("Error adding menu item:", err);
            res.status(500).json({
                success: false,
                message: err.message || "Failed to add menu item",
            });
        }
    }
    static async updateMenuItem(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            if (req.file) {
                data.imageUrl = req.file.path;
            }
            if (data.price) {
                data.price = parseFloat(data.price);
            }
            const updated = await restaurant_service_1.RestaurantService.updateMenuItem(id, data);
            res.status(200).json({ success: true, data: updated });
        }
        catch (err) {
            res
                .status(500)
                .json({ success: false, message: "Failed to update item" });
        }
    }
    static async deleteMenuItem(req, res) {
        try {
            const { id } = req.params;
            await restaurant_service_1.RestaurantService.deleteMenuItem(id);
            res.status(200).json({ success: true, message: "Deleted successfully" });
        }
        catch (err) {
            res
                .status(500)
                .json({ success: false, message: "Failed to delete item" });
        }
    }
    static async toggleMenuItemAvailability(req, res) {
        try {
            const { id } = req.params;
            const updated = await restaurant_service_1.RestaurantService.toggleMenuItemAvailability(id);
            res.status(200).json({ success: true, data: updated });
        }
        catch (err) {
            res
                .status(500)
                .json({ success: false, message: "Failed to toggle status" });
        }
    }
}
exports.RestaurantController = RestaurantController;
//# sourceMappingURL=restaurant.controller.js.map