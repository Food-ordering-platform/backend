import { Request, Response } from "express";
import { DispatchService } from "./dispatch.service";

export class DispatchController {
  static async getDispatcherDashboard(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = await DispatchService.getDispatcherDashboard(userId);
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async acceptOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { orderId } = req.body;
      const order = await DispatchService.acceptOrder(userId, orderId);
      return res
        .status(200)
        .json({ success: true, message: "Order Accepted", data: order });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // ✅ PUBLIC: Get Task Details
  static async getRiderTask(req: Request, res: Response) {
    try {
      const { trackingId } = req.params;
      const data = await DispatchService.getRiderTask(trackingId);
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      return res.status(404).json({ success: false, message: err.message });
    }
  }

  // ✅ PUBLIC: Rider Picked Up
  static async pickupOrder(req: Request, res: Response) {
    try {
      const { trackingId } = req.body;
      if (!trackingId)
        return res.status(400).json({ message: "Tracking ID required" });

      const result = await DispatchService.pickupOrder(trackingId);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // Add this method inside DispatchController class
  static async assignLinkRider(req: Request, res: Response) {
    try {
      const { trackingId, name, phone } = req.body;
      if (!trackingId || !name || !phone) {
        return res.status(400).json({ message: "Name and Phone required" });
      }

      const result = await DispatchService.assignLinkRider(
        trackingId,
        name,
        phone
      );
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // ✅ PUBLIC: Complete Delivery
  static async completeDelivery(req: Request, res: Response) {
    try {
      const { trackingId, otp } = req.body;
      const result = await DispatchService.completeDelivery(trackingId, otp);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getPartnerWallet(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = await DispatchService.getPartnerWallet(userId);
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async requestWithdrawal(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { amount, bankDetails } = req.body; // Extract bankDetails

      if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });
      if (!bankDetails) return res.status(400).json({ message: "Bank details required" });

      const result = await DispatchService.requestWithdrawal(userId, Number(amount), bankDetails);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
