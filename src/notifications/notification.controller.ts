import { Request, Response } from "express";
import { NotificationService } from "./notification.service";

export class NotificationController {
  
  static async subscribe(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const subscription = req.body;

      await NotificationService.subscribe(userId, subscription);

      return res.status(201).json({ success: true, message: "Subscribed successfully" });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}