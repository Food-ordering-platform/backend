import { Request, Response } from "express";
import { AdminService } from "./admin.service";
import { Role } from "@prisma/client";

export class AdminController {

    // --- Auth ---
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
      }

      const data = await AdminService.loginAdmin(email, password);
      
      return res.status(200).json({ 
        success: true, 
        message: "Admin login successful", 
        ...data 
      });
    } catch (error: any) {
      return res.status(401).json({ success: false, message: error.message || "Login failed" });
    }
  }
  
  // --- Analytics ---
  static async getAnalytics(req: Request, res: Response) {
    try {
      const analytics = await AdminService.getDashboardAnalytics();
      return res.status(200).json({ success: true, data: analytics });
    } catch (error: any) {
      console.error("Admin Analytics Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch analytics." });
    }
  }

  // --- Users ---
  static async getUsers(req: Request, res: Response) {
    try {
      const { role } = req.query;
      const users = await AdminService.getAllUsers(role as Role);
      return res.status(200).json({ success: true, data: users });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to fetch users." });
    }
  }

  static async approveUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await AdminService.approveUser(id);
      return res.status(200).json({ success: true, message: "User approved successfully.", data: user });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to approve user." });
    }
  }

  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await AdminService.deleteUser(id);
      return res.status(200).json({ success: true, message: "User deleted successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to delete user." });
    }
  }

  // --- Payouts ---
  static async getPayouts(req: Request, res: Response) {
    try {
      const payouts = await AdminService.getPayoutRequests();
      return res.status(200).json({ success: true, data: payouts });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to fetch payouts." });
    }
  }

  static async markPayoutPaid(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const transaction = await AdminService.markPayoutAsPaid(id);
      return res.status(200).json({ success: true, message: "Payout marked as paid.", data: transaction });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to update payout status." });
    }
  }
}