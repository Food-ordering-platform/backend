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
            // Parse numbers safely
            prepTime: body.prepTime ? parseInt(body.prepTime, 10) : undefined,
            latitude: body.latitude ? parseFloat(body.latitude) : undefined,
            longitude: body.longitude ? parseFloat(body.longitude) : undefined,
            minimumOrder: body.minimumOrder
                ? parseFloat(body.minimumOrder)
                : undefined,
            // Parse booleans from "true"/"false" strings
            isOpen: body.isOpen !== undefined
                ? body.isOpen === "true" || body.isOpen === true
                : undefined,
        };
    }
    // Create Restaurant
    // POST /restaurant
    static async createRestaurant(req, res) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader)
                throw new Error("No token Provided");
            const token = authHeader.split(" ")[1];
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const ownerId = decoded.userId;
            // 1. Clean Parse using helper
            const restaurantData = RestaurantController.parseRestaurantBody(req.body);
            // 2. Pass Data AND File to Service (Ticketer Strategy)
            // We do not rely on middleware to populate 'path' here; the service will handle upload
            const restaurant = await restaurant_service_1.RestaurantService.createRestaurant(ownerId, restaurantData, req.file // Pass the raw file object
            );
            res.status(201).json({
                success: true,
                message: "Restaurant Profile Created Successfully",
                data: restaurant,
            });
        }
        catch (err) {
            console.error("Error Creating Restaurant:", err);
            res.status(400).json({
                success: false,
                message: err.message || "Failed to create restaurant",
            });
        }
    }
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
    // PUT /restaurant/:id
    static async updateRestaurant(req, res) {
        try {
            const { id } = req.params;
            // Auth Check
            const authHeader = req.headers.authorization;
            if (!authHeader)
                return res.status(401).json({ message: "No token provided" });
            const token = authHeader.split(" ")[1];
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId;
            // Ownership Check
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
            // 1. Clean Parse
            const restaurantData = RestaurantController.parseRestaurantBody(req.body);
            // 2. Pass Data AND File to Service
            const updated = await restaurant_service_1.RestaurantService.updateRestaurant(id, restaurantData, req.file // ✅ Pass the memory file object
            );
            res.status(200).json({ success: true, data: updated });
        }
        catch (err) {
            console.error("Error Updating Restaurant:", err); // Check Railway Logs for this!
            res.status(500).json({
                success: false,
                message: err.message || "Failed to update restaurant",
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
    // POST /restaurant/:id/menu
    static async addMenuItem(req, res) {
        try {
            const { id } = req.params; // restaurantId
            const data = req.body;
            if (data.price) {
                data.price = parseFloat(data.price);
            }
            // Pass req.file (the memory file) to the service
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
    // PUT /menu/:id
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
    // DELETE /menu/:id
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
    // PATCH /menu/:id/toggle
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
    //----------GET VENDOR EARNINGS ------------------//
    static async getEarnings(req, res) {
        try {
            const { id } = req.params; //Get restaurantId from URL
            //Call the service logic
            const earnings = await restaurant_service_1.RestaurantService.getEarnings(id);
            res.status(200).json({
                success: true,
                data: earnings,
            });
        }
        catch (err) {
            console.error("Error fetching earnings:", err);
            res.status(500).json({ success: false, message: err.message || "Failed to fetch earnings" });
        }
    }
    //----------------GET VENDOR TRANSACTIONS----------------------//
    static async getTransactions(req, res) {
        try {
            const { id } = req.params; //This is restaurantID
            const transactions = await restaurant_service_1.RestaurantService.getTransactions(id);
            return res.status(200).json({ success: true, data: transactions });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    //--------------------------VENDOR REQUEST PAYOUT ------------------------------//
    static async requestPayout(req, res) {
        try {
            const { id } = req.params;
            const { amount, bankDetails } = req.body;
            if (!amount) {
                return res.status(400).json({ success: true, message: "Amount is requiredd" });
            }
            if (!bankDetails) {
                return res.status(400).json({ success: false, message: "Invalid Bank Details" });
            }
            const result = await restaurant_service_1.RestaurantService.requestPayout(id, Number(amount), bankDetails);
            return res.status(200).json({ success: true, data: result });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
}
exports.RestaurantController = RestaurantController;
//# sourceMappingURL=restaurant.controller.js.map