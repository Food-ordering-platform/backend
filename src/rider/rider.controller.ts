import { Request, Response } from "express";
import { RiderService } from "./rider.service";
import { OrderStatus } from "@prisma/client";

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

  // Get Current Active Order
  static async getActiveOrder(req: Request, res: Response) {
    try {
      const riderId = req.user?.id;
      if (!riderId) return res.status(401).json({ success: false, message: "Unauthorized" });

      const order = await RiderService.getActiveOrder(riderId);
      // Return null if no active order, that's fine
      return res.status(200).json({ success: true, data: order }); 
    } catch (err: any) {
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
  static async confirmPickup(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const riderId = req.user?.id;

      if (!riderId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      // The service method expects a status, even though it hardcodes the update logic.
      // We pass OUT_FOR_DELIVERY to match the intent.
      const order = await RiderService.comfirmPickup(riderId, id, OrderStatus.OUT_FOR_DELIVERY);

      return res.status(200).json({ 
        success: true, 
        message: "Pickup confirmed. Status updated to OUT_FOR_DELIVERY.", 
        data: order 
      });
    } catch (err: any) {
      console.error("Pickup Error:", err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }
  static async confirmDelivery(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { code } = req.body; // Expecting the 4-digit OTP
      const riderId = req.user?.id;

      if (!riderId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      if (!code) {
        return res.status(400).json({ 
          success: false, 
          message: "Delivery confirmation code is required." 
        });
      }

      const order = await RiderService.confirmDelivery(riderId, id, code);

      return res.status(200).json({ 
        success: true, 
        message: "Delivery confirmed. Earnings credited to wallet.", 
        data: order 
      });
    } catch (err: any) {
      console.error("Delivery Error:", err);
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