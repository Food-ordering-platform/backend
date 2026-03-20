import { Request, Response } from "express";
import { RiderService } from "./rider.service";
import { OrderStatus } from "@prisma/client";
import { success } from "zod";

export class RiderController {
  // 1. Get Available Orders
  static async getAvailableOrders(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId)
        return res
          .status(400)
          .json({ success: false, message: "Unauthorized" });
      // Typically no input needed, just fetches the pool
      const orders = await RiderService.getAvailableOrders(userId);
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
      if (!riderId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });

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

      if (!riderId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });

      const order = await RiderService.acceptOrder(riderId, id);
      return res
        .status(200)
        .json({ success: true, message: "Order accepted", data: order });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // 2b. Reject Order (Unassign)
  // static async rejectOrder(req: Request, res: Response) {
  //   try {
  //     const { id } = req.params; // Order ID
  //     const { reason } = req.body;
  //     const riderId = req.user?.id;

  //     if (!riderId) return res.status(401).json({ success: false, message: "Unauthorized" });

  //     const order = await RiderService.rejectOrder(riderId, id, reason);
  //     return res.status(200).json({ success: true, message: "Order rejected/unassigned", data: order });
  //   } catch (err: any) {
  //     return res.status(400).json({ success: false, message: err.message });
  //   }
  // }
  static async confirmPickup(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const riderId = req.user?.id;

      if (!riderId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      // The service method expects a status, even though it hardcodes the update logic.
      // We pass OUT_FOR_DELIVERY to match the intent.
      const order = await RiderService.comfirmPickup(riderId, id);

      return res.status(200).json({
        success: true,
        message: "Pickup confirmed. Status updated to OUT_FOR_DELIVERY.",
        data: order,
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
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!code) {
        return res.status(400).json({
          success: false,
          message: "Delivery confirmation code is required.",
        });
      }

      const order = await RiderService.confirmDelivery(riderId, id, code);

      return res.status(200).json({
        success: true,
        message: "Delivery confirmed. Earnings credited to wallet.",
        data: order,
      });
    } catch (err: any) {
      console.error("Delivery Error:", err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async requestPayout(req: Request, res: Response) {
    try {
      // 1. Get User ID from the Auth Middleware
      const riderId = req.user?.id;
      if (!riderId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized: User not found" });
      }

      const { amount, bankDetails } = req.body;

      // 2. Basic payload check before hitting the service
      if (!amount || !bankDetails) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: amount and bankDetails are mandatory.",
        });
      }

      // 3. Call the refactored Service
      const result = await RiderService.requestPayout(
        riderId,
        Number(amount),
        bankDetails,
      );

      // 4. Return 201 Created (The professional standard for new records)
      return res.status(201).json({
        success: true,
        message: "Withdrawal request submitted successfully",
        data: result,
      });
    } catch (error: any) {
      // 5. Handle Zod validation errors
      console.error(`[PayoutController] Error: ${error.message}`);
      return res
        .status(error.message.includes("Insufficient") ? 402 : 400)
        .json({
          success: false,
          message: error.message,
        });
    }
  }

  // 3. Get Earnings & History
  static async getEarnings(req: Request, res: Response) {
    try {
      const riderId = req.user?.id;
      if (!riderId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });

      const earnings = await RiderService.getRiderEarnings(riderId);
      return res.status(200).json({ success: true, data: earnings });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

   static async getTransactions(req: Request, res: Response) {
      try {
        const riderId = req.user!.id;
        const transactions = await RiderService.getTransactions(riderId);
        return res.status(200).json({ success: true, data: transactions });
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

  // Add to RiderController class
  static async getHistory(req: Request, res: Response) {
    try {
      const riderId = req.user?.id;
      if (!riderId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      const history = await RiderService.getDeliveryHistory(riderId);
      return res.status(200).json({ success: true, data: history });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      // 1. Get User ID from the authenticated token
      const userId = req.user?.id; // Ensure your auth middleware sets this

      if (!userId)
        return res
          .status(400)
          .json({ success: false, message: "Unauthroized" });

      // 2. Get status from body (force boolean)
      const { isOnline } = req.body;

      if (typeof isOnline !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isOnline must be a boolean (true/false)",
        });
      }

      // 3. Call Service
      const updatedUser = await RiderService.updateRiderStatus(
        userId,
        isOnline,
      );

      // 4. Send Response
      return res.status(200).json({
        success: true,
        message: isOnline ? "You are now Online" : "You are now Offline ",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Update Status Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update status",
      });
    }
  }
}
