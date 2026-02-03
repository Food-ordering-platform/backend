import { Request, Response } from "express";
import { RiderService } from "./rider.service";

export class RiderController {
  
  // 1. Get Available Orders
  static async getAvailableOrders(req: Request, res: Response) {
    try {
      // Typically no input needed, just fetches the pool
      const orders = await RiderService.getAvailableOrders();
      return res.status(200).json({ success: true, data: orders });
    } catch (err: any) {
      console.error("Fetch available orders error", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 2. Accept Order
  static async acceptOrder(req: Request, res: Response) {
    try {
      const { id } = req.params; // Order ID
      const riderId = req.user?.id;

      if (!riderId) return res.status(401).json({ success: false, message: "Unauthorized" });

      const order = await RiderService.acceptOrder(riderId, id);
      return res.status(200).json({ success: true, message: "Order accepted", data: order });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // 2b. Reject Order (Unassign)
  static async rejectOrder(req: Request, res: Response) {
    try {
      const { id } = req.params; // Order ID
      const { reason } = req.body;
      const riderId = req.user?.id;

      if (!riderId) return res.status(401).json({ success: false, message: "Unauthorized" });

      const order = await RiderService.rejectOrder(riderId, id, reason);
      return res.status(200).json({ success: true, message: "Order rejected/unassigned", data: order });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // 3. Get Earnings & History
  static async getEarnings(req: Request, res: Response) {
    try {
      const riderId = req.user?.id;
      if (!riderId) return res.status(401).json({ success: false, message: "Unauthorized" });

      const earnings = await RiderService.getRiderEarnings(riderId);
      return res.status(200).json({ success: true, data: earnings });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 4. Request Payout
  static async requestPayout(req: Request, res: Response) {
    try {
      const riderId = req.user?.id;
      const { amount } = req.body;

      if (!riderId) return res.status(401).json({ success: false, message: "Unauthorized" });
      if (!amount) return res.status(400).json({ success: false, message: "Amount is required" });

      const payout = await RiderService.requestPayout(riderId, Number(amount));
      return res.status(201).json({ success: true, message: "Payout request submitted", data: payout });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}