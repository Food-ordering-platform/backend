import { Request, Response } from "express";
import { DispatchService } from "./dispatch.service";

export class DispatchController {
  
  // For the Rider Mobile App
//   static async getRiderDashboard(req: Request, res: Response) {
//     try {
//         const userId = (req as any).user.userId; // From AuthMiddleware
//         const data = await LogisticsService.getRiderDashboard(userId);
//         return res.status(200).json({ success: true, data });
//     } catch (err: any) {
//         console.error("Rider Dashboard Error:", err);
//         return res.status(500).json({ success: false, message: err.message });
//     }
//   }

  static async acceptOrder(req: Request, res: Response) {
      try {
          const userId = (req as any).user.userId;
          const { orderId } = req.body;
          
          if(!orderId) return res.status(400).json({ success: false, message: "Order ID required"});

          const order = await DispatchService.acceptOrder(userId, orderId);
          return res.status(200).json({ success: true, message: "Order Accepted", data: order });
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message });
      }
  }

  // For the Logistics Company Manager
  static async getDispatcherDashboard(req: Request, res: Response) {
    try {
        const userId = (req as any).user.userId;
        const data = await DispatchService.getDispatcherDashboard(userId);
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
  }
}