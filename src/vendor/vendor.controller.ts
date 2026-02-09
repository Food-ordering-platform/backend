import { Request, Response } from "express";
import { VendorService } from "./vendor.service";
import { OrderStatus } from "@prisma/client";

export class VendorController {

  static async getVendorOrders(req: Request, res: Response) {
    try {
      // Assuming restaurantId is passed in params based on your current frontend
      // Ideally, use req.user.id to find restaurant internally for security
      const { restaurantId } = req.params; 
      const orders = await VendorService.getVendorOrders(restaurantId);
      res.json({ success: true, data: orders });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateOrderStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      const result = await VendorService.updateOrderStatus(orderId, status);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getEarnings(req: Request, res: Response) {
    try {
      const userId = req.user!.id; // Needs Auth Middleware
      const data = await VendorService.getVendorEarnings(userId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async requestPayout(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { amount, bankDetails } = req.body;
      const result = await VendorService.requestPayout(userId, Number(amount), bankDetails);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}