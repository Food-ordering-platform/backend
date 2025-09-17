import { Request, Response } from "express";
import { RestaurantService } from "./restaurant.service";

export class RestaurantController {
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
  static async updateRestaurant(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const updated = await RestaurantService.updateRestaurant(id, data);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error("Error updating restaurant:", err);
      res.status(500).json({
        success: false,
        message: "Failed to update restaurant",
      });
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
      const { id } = req.params;
      const data = req.body;

      const item = await RestaurantService.addMenuItem(id, data);
      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (err: any) {
      console.error("Error adding menu item:", err);
      res.status(500).json({
        success: false,
        message: "Failed to add menu item",
      });
    }
  }

  // PUT /menu/:id
  static async updateMenuItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const updated = await RestaurantService.updateMenuItem(id, data);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error("Error updating menu item:", err);
      res.status(500).json({
        success: false,
        message: "Failed to update menu item",
      });
    }
  }

  // DELETE /menu/:id
  static async deleteMenuItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await RestaurantService.deleteMenuItem(id);

      res.status(200).json({
        success: true,
        message: "Menu item deleted",
      });
    } catch (err: any) {
      console.error("Error deleting menu item:", err);
      res.status(500).json({
        success: false,
        message: "Failed to delete menu item",
      });
    }
  }

  // PATCH /menu/:id/toggle
  static async toggleMenuItemAvailability(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const updated = await RestaurantService.toggleMenuItemAvailability(id);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error("Error toggling availability:", err);
      res.status(500).json({
        success: false,
        message: "Failed to toggle menu item availability",
      });
    }
  }
}
