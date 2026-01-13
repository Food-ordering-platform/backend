import { Request, Response } from "express";
import { DispatchService } from "./dispatch.service";
// 1. Import the schemas
import { 
  acceptOrderSchema, 
  assignRiderSchema, 
  pickupSchema, 
  completeDeliverySchema, 
  withdrawalSchema 
} from "./dispatch.validator";

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
      // 2. Validate Input
      const { orderId } = acceptOrderSchema.parse(req.body);
      
      const order = await DispatchService.acceptOrder(userId, orderId);
      return res.status(200).json({ success: true, message: "Order Accepted", data: order });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message, errors: err.errors });
    }
  }

  static async getRiderTask(req: Request, res: Response) {
    try {
      const { trackingId } = req.params;
      const data = await DispatchService.getRiderTask(trackingId);
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      return res.status(404).json({ success: false, message: err.message });
    }
  }

  static async pickupOrder(req: Request, res: Response) {
    try {
      // 3. Validate Input
      const { trackingId } = pickupSchema.parse(req.body);

      const result = await DispatchService.pickupOrder(trackingId);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async assignLinkRider(req: Request, res: Response) {
    try {
      // 4. Validate Input
      const { trackingId, name, phone } = assignRiderSchema.parse(req.body);

      const result = await DispatchService.assignLinkRider(trackingId, name, phone);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message, errors: err.errors });
    }
  }

  static async completeDelivery(req: Request, res: Response) {
    try {
      // 5. Validate Input
      const { trackingId, otp } = completeDeliverySchema.parse(req.body);

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
      
      // 6. Validate Input (Amount & Bank Details)
      const { amount, bankDetails } = withdrawalSchema.parse(req.body);

      const result = await DispatchService.requestWithdrawal(userId, amount, bankDetails);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message, errors: err.errors });
    }
  }
}