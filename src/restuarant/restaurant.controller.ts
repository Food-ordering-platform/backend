import { Request, Response } from "express";
import { RestaurantService } from "./restaurant.service";
import jwt from "jsonwebtoken";

export class RestaurantController {
  private static parseRestaurantBody(body: any) {
    return {
      name: body.name,
      address: body.address,
      phone: body.phone,
      email: body.email,
      prepTime: body.prepTime ? parseInt(body.prepTime, 10) : undefined,
      latitude: body.latitude ? parseFloat(body.latitude) : undefined,
      longitude: body.longitude ? parseFloat(body.longitude) : undefined,
      minimumOrder: body.minimumOrder ? parseFloat(body.minimumOrder) : undefined,
      isOpen:
        body.isOpen !== undefined
          ? body.isOpen === "true" || body.isOpen === true
          : undefined,
    };
  }

  // ===== Restaurant Profile Management =====
  
  static async createRestaurant(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) throw new Error("No token Provided");
      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

      const ownerId = decoded.userId;
      const restaurantData = RestaurantController.parseRestaurantBody(req.body);

      const restaurant = await RestaurantService.createRestaurant(
        ownerId,
        restaurantData,
        req.file 
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

  static async updateRestaurant(req: Request, res: Response) {
    try {
      const { id } = req.params;

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
        return res
          .status(403)
          .json({ success: false, message: "Unauthorized" });
      }

      const restaurantData = RestaurantController.parseRestaurantBody(req.body);

      const updated = await RestaurantService.updateRestaurant(
        id,
        restaurantData,
        req.file 
      );

      res.status(200).json({ success: true, data: updated });
    } catch (err: any) {
      console.error("Error Updating Restaurant:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Failed to update restaurant",
      });
    }
  }

  // ===== Menu Management =====
  
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

  static async addMenuItem(req: Request, res: Response) {
    try {
      const { id } = req.params; 
      const data = req.body;
      
      if (data.price) {
        data.price = parseFloat(data.price);
      }

      const item = await RestaurantService.addMenuItem(id, data, req.file);

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