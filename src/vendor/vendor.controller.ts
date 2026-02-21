import { Request, Response } from "express";
import { VendorService } from "./vendor.service";

export class VendorController {
  // --- EXISTING ROUTES ---
  static async getVendorOrders(req: Request, res: Response) {
    try {
      const { restaurantId } = req.params;
      const orders = await VendorService.getVendorOrders(restaurantId);
      return res.status(200).json({ success: true, data: orders });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async getEarnings(req: Request, res: Response) {
    try {
      const userId = req.user!.id; 
      const data = await VendorService.getVendorEarnings(userId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getTransactions(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const transactions = await VendorService.getTransactions(userId);
      return res.status(200).json({ success: true, data: transactions });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
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

  // ==========================================
  // 🚀 NEW ORDER ACTION ROUTES
  // ==========================================

  static async acceptOrder(req: Request, res: Response) {
    try {
      const userId = req.user!.id; // Authenticated Vendor ID
      const { id } = req.params; // Order ID
      const updatedOrder = await VendorService.acceptOrder(userId, id);
      return res.status(200).json({ success: true, data: updatedOrder });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async requestRider(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params; 
      const updatedOrder = await VendorService.requestRider(userId, id);
      return res.status(200).json({ success: true, data: updatedOrder });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async cancelOrder(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params; 
      const updatedOrder = await VendorService.cancelOrder(userId, id);
      return res.status(200).json({ success: true, data: updatedOrder });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}