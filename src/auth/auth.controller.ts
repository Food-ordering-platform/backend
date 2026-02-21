// food-ordering-platform/backend/backend-main/src/auth/auth.controller.ts

import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.validator";
import { success } from "zod";

export class AuthController {
  // ------------------ REGISTER ------------------
  static async register(req: Request, res: Response) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await AuthService.registerUser(
        data.name,
        data.email,
        data.password,
        data.phone,
        data.role,
        new Date(),
        data.address,
      );

      return res.status(201).json({
        message: "User registered. OTP sent to email",
        data: result,
        // Required for verify-otp page
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------ LOGIN ------------------
  static async login(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await AuthService.login(data.email, data.password);

      return res.status(200).json({
        message: "Login successful",
        token: result.token,
        user: result.user,
        requireOtp: result.requireOtp,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------ GOOGLE LOGIN (STRICT) ------------------
  static async googleLogin(req: Request, res: Response) {
    try {
      // Extract termsAccepted flag (defaults to false if missing)
      const { token, termsAccepted } = req.body;

      if (!token) throw new Error("Google token is required");

      const result = await AuthService.loginWithGoogle(token, !!termsAccepted);

      return res.status(200).json({
        message: "Google login successful",
        token: result.token,
        user: result.user,
      });
    } catch (err: any) {
      // 404 for "User not found" prompts the frontend to redirect to signup
      const status = err.message.includes("Sign Up") ? 404 : 400;
      return res.status(status).json({ error: err.message });
    }
  }

  // ------------------ GET ME ------------------
  static async getMe(req: Request, res: Response) {
    try {
      // Middleware ensures req.user exists from the JWT
      if (!req.user) throw new Error("Unauthorized");

      const user = await AuthService.getMe(req.user.id);

      return res.status(200).json({
        message: "User Verified",
        user,
      });
    } catch (err: any) {
      res.status(401).json({ error: "Unauthorized: " + err.message });
    }
  }

// src/auth/auth.controller.ts

  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

      // Extract pushToken from body
      const { name, phone, address, latitude, longitude, pushToken } = req.body; 

      const updatedUser = await AuthService.updateProfile(userId, { 
        name, 
        phone, 
        address, 
        latitude, 
        longitude,
        pushToken // <--- Pass it to service
      });

      return res.status(200).json({ success: true, message: "Profile updated", data: updatedUser });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  
  // ------------------ VERIFY OTP ------------------
  static async verifyOtp(req: Request, res: Response) {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        throw new Error("Email and OTP code are required");
      }
      const result = await AuthService.verifyOtp(email, code);

      return res.status(200).json({
        success: true,
        message: "Account verified successfully",
        data: result,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------ LOGOUT ------------------
  static async logout(req: Request, res: Response) {
    return res.status(200).json({ message: "Logged out successfully" });
  }

  // ... (Password reset & Push token methods)
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) throw new Error("Email is required");
      const result = await AuthService.forgotPassword(email);
      return res
        .status(200)
        .json({ message: "OTP sent to email", token: result.token });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
  static async verifyResetOtp(req: Request, res: Response) {
    try {
      const { token, code } = req.body;
      const result = await AuthService.verifyForgotPasswordOtp(token, code);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword, confirmPassword } = req.body;
      if (newPassword !== confirmPassword)
        throw new Error("Passwords do not match");
      const result = await AuthService.resetPassword(token, newPassword);
      return res
        .status(200)
        .json({ message: "Password reset successful", result });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async updatePushToken(req: Request, res: Response) {
    try {
      const { token } = req.body;
      if (!req.user) throw new Error("Unauthorized");
      await AuthService.updatePushToken(req.user.id, token);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to update token" });
    }
  }


}
