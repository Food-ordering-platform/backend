import { Request, Response } from "express";
import { RestaurantService } from "./restaurant.service";
import jwt from "jsonwebtoken";

export class RestaurantController {
  // Create Restaurant
  static async createRestaurant(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) throw new Error("No token Provided");
      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

      const ownerId = decoded.userId;
      const data = req.body;

      // [FIX] Handle Image
      if (req.file) {
        data.imageUrl = (req.file as any).path;
      }

      // [FIX] Convert FormData strings to correct types securely
      if (data.prepTime !== undefined && data.prepTime !== "") {
        const parsed = parseInt(data.prepTime);
        if (!isNaN(parsed)) data.prepTime = parsed;
        else delete data.prepTime;
      }

      if (data.minimumOrder !== undefined && data.minimumOrder !== "") {
        const parsed = parseFloat(data.minimumOrder);
        if (!isNaN(parsed)) data.minimumOrder = parsed;
        else delete data.minimumOrder;
      }

      // Handle "true"/"false" strings from FormData
      if (data.isOpen === "true") data.isOpen = true;
      if (data.isOpen === "false") data.isOpen = false;

      const restaurant = await RestaurantService.createRestaurant(
        ownerId,
        data
      );

      res.status(201).json({
        success: true,
        message: "Restaurant Profile Created Successfully",
        data: restaurant,
      });
    } catch (err: any) {
      console.error("Error Creating Restaurant:", err);
      res.status(400).json({
        success: false,
        message: err.message || "Failed to create restaurant",
      });
    }
  }

  // GET /restaurant
  static async getAllRestaurants(req: Request, res: Response) {
    try {
      const restaurant = await RestaurantService.getAllRestaurant();
      res.status(200).json({
        success: true,
        data: restaurant,
      });
    } catch (err: any) {
      console.error("Error fetching Restaurants", err);
      res.status(500).json({
        success: false,
        message: "Failed to fetch restaurants",
      });
    }
  }

  // GET /restaurant/:id
  static async getRestaurantById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const restaurant = await RestaurantService.getRestaurantById(id);

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
    } catch (err: any) {
      console.error("Error fetching restaurant:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch restaurant",
      });
    }
  }

  // PUT /restaurant/:id
  // Update restaurant
  static async updateRestaurant(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      // 1. [SECURITY] Verify Ownership
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ message: "No token provided" });
      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
      const userId = decoded.userId;

      const existingRestaurant = await RestaurantService.getRestaurantById(id);
      if (!existingRestaurant) {
        return res
          .status(404)
          .json({ success: false, message: "Restaurant not found" });
      }

      if (existingRestaurant.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: You do not own this restaurant",
        });
      }

      // 2. Handle Image
      if (req.file) {
        data.imageUrl = (req.file as any).path;
      }

      // [FIX] DELETE THE RAW IMAGE FIELD SO PRISMA DOESN'T COMPLAIN
      delete data.image;

      // 3. [FIX] PARSE DATA ROBUSTLY
      // Handle prepTime
      if (data.prepTime !== undefined && data.prepTime !== null) {
        const parsed = parseInt(data.prepTime);
        if (isNaN(parsed)) {
          delete data.prepTime;
        } else {
          data.prepTime = parsed;
        }
      }

      // ... (rest of your existing logic for minimumOrder and isOpen) ...

      const updated = await RestaurantService.updateRestaurant(id, data);
      res.status(200).json({ success: true, data: updated });
    } catch (err: any) {
      // ... (rest of your error handling) ...
    }
  }

  // ===== Menu Management =====
  // GET /restaurant/:id/menu
  static async getMenuItems(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const items = await RestaurantService.getMenuItems(id);
      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (err: any) {
      console.error("Error fetching menu:", err);
      res.status(500).json({
        success: false,
        message: "Failed to fetch menu items",
      });
    }
  }

  // POST /restaurant/:id/menu
  static async addMenuItem(req: Request, res: Response) {
    try {
      const { id } = req.params; // restaurantId
      const data = req.body;

      if (req.file) {
        data.imageUrl = (req.file as any).path;
      }

      if (data.price) {
        data.price = parseFloat(data.price);
      }

      const item = await RestaurantService.addMenuItem(id, data);

      res.status(201).json({
        success: true,
        message: "Item added successfully",
        data: item,
      });
    } catch (err: any) {
      console.error("Error adding menu item:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Failed to add menu item",
      });
    }
  }

  // PUT /menu/:id
  static async updateMenuItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      if (req.file) {
        data.imageUrl = (req.file as any).path;
      }
      if (data.price) {
        data.price = parseFloat(data.price);
      }

      const updated = await RestaurantService.updateMenuItem(id, data);
      res.status(200).json({ success: true, data: updated });
    } catch (err: any) {
      res
        .status(500)
        .json({ success: false, message: "Failed to update item" });
    }
  }

  // DELETE /menu/:id
  static async deleteMenuItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await RestaurantService.deleteMenuItem(id);
      res.status(200).json({ success: true, message: "Deleted successfully" });
    } catch (err: any) {
      res
        .status(500)
        .json({ success: false, message: "Failed to delete item" });
    }
  }

  // PATCH /menu/:id/toggle
  static async toggleMenuItemAvailability(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updated = await RestaurantService.toggleMenuItemAvailability(id);
      res.status(200).json({ success: true, data: updated });
    } catch (err: any) {
      res
        .status(500)
        .json({ success: false, message: "Failed to toggle status" });
    }
  }
}
