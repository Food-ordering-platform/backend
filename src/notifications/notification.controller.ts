import { Request, Response } from "express";
import { NotificationService } from "./notification.service";

export class NotificationController {
  
  static async subscribe(req: Request, res: Response) {
    try {
      // 🟢 CHANGE: Get userId from body instead of req.user
      const { subscription, userId } = req.body;

      if (!userId || !subscription) {
        return res.status(400).json({ success: false, message: "Missing userId or subscription" });
      }

      await NotificationService.subscribe(userId, subscription);

      return res.status(201).json({ success: true, message: "Subscribed successfully" });
    } catch (err: any) {
      console.error("Subscribe Error:", err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}