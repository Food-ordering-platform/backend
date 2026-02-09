import { Request, Response } from "express";
import { VendorService } from "./vendor.service";

export class VendorController {
  static async getVendorOrders(req: Request, res: Response) {
    try {
      const { restaurantId } = req.params;
      if (!restaurantId) {
        return res
          .status(400)
          .json({ success: false, message: "Restaurant ID is required" });
      }
      const orders = await VendorService.getVendorOrders(restaurantId);
      return res.status(200).json({ success: true, data: orders });
    } catch (err: any) {
      console.error("Get Vendor orders error", err);
      return res
        .status(500)
        .json({ success: false, message: err.message || "Server Error" });
    }
  }

  static async updateOrderStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!id || !status) {
        return res
          .status(400)
          .json({ success: false, Message: "OrderID and status is required" });
      }
      const updateOrder = await VendorService.updateOrderStatus(id, status);
      return res.status(200).json({ success: true, data: updateOrder });
    } catch (err: any) {
      console.error("Update order status error", err);
      const statusCode = err.message.includes("Invalid State Transition")
        ? 400
        : 500;
      return res
        .status(statusCode)
        .json({ success: false, message: err.message || "Server Error" });
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
