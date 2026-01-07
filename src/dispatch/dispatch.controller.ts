import { Request, Response } from "express";
import { DispatchService } from "./dispatch.service";

export class DispatchController {
  
  static async acceptOrder(req: Request, res: Response) {
      try {
          // FIX: Use .id instead of .userId
          const userId = (req as any).user.id; 
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
        // FIX: Use .id instead of .userId
        const userId = (req as any).user.id;
        
        // Defensive check (optional but good for debugging)
        if (!userId) {
            return res.status(401).json({ success: false, message: "User ID not found in token" });
        }

        const data = await DispatchService.getDispatcherDashboard(userId);
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        console.error("Dashboard Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
  }
}