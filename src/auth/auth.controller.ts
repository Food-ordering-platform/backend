// food-ordering-platform/backend/backend-main/src/auth/auth.controller.ts

import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.validator";

export class AuthController {
  
  // ------------------ REGISTER ------------------
  static async register(req: Request, res: Response) {
    try {
      const data = registerSchema.parse(req.body);
      const { user, token } = await AuthService.registerUser(
        data.name, data.email, data.password, data.phone, data.role
      );

      return res.status(201).json({
        message: "User registered. OTP sent to email",
        user,
        token, // Required for verify-otp page
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
        requireOtp: result.requireOtp
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------ GOOGLE LOGIN (PURE JWT) ------------------
  static async googleLogin(req: Request, res: Response) {
    try {
      const { token } = req.body; 
      if (!token) throw new Error("Google token is required");

      const result = await AuthService.loginWithGoogle(token);

      // UNIFIED RESPONSE: Always return the token. No sessions.
      return res.status(200).json({
        message: "Google login successful",
        token: result.token, 
        user: result.user,
      });

    } catch (err: any) {
      return res.status(400).json({ error: err.message });
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

  static async updateProfile(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error("Unauthorized");
      
      const { name, phone, address, latitude, longitude } = req.body;
      
      const updatedUser = await AuthService.updateProfile(req.user.id, {
        name,
        phone,
        address,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
      });

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------ VERIFY OTP ------------------
  static async verifyOtp(req: Request, res: Response) {
    try {
      const { token, code } = req.body;
      const result = await AuthService.verifyOtp(token, code);

      return res.status(200).json({
        message: "Account verified successfully",
        token: result.token,
        user: result.user
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------ LOGOUT ------------------
  static async logout(req: Request, res: Response) {
    // Pure JWT Logout is handled by the Client (Frontend) deleting the token.
    // We just return success.
    return res.status(200).json({ message: "Logged out successfully" });
  }

  // ... (Password reset & Push token methods remain unchanged) ...
  static async forgotPassword(req: Request, res: Response) {
      try {
        const { email } = req.body;
        if (!email) throw new Error("Email is required");
        const result = await AuthService.forgotPassword(email);
        return res.status(200).json({ message: "OTP sent to email", token: result.token });
      } catch (err: any) { return res.status(400).json({ error: err.message }); }
  }
  static async verifyResetOtp(req: Request, res: Response) {
      try {
        const { token, code } = req.body;
        const result = await AuthService.verifyForgotPasswordOtp(token, code);
        return res.status(200).json(result);
      } catch (err: any) { return res.status(400).json({ error: err.message }); }
  }
  static async resetPassword(req: Request, res: Response) {
      try {
        const { token, newPassword, confirmPassword } = req.body;
        if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
        const result = await AuthService.resetPassword(token, newPassword);
        return res.status(200).json({ message: "Password reset successful", result });
      } catch (err: any) { return res.status(400).json({ error: err.message }); }
  }
  static async updatePushToken(req: Request, res: Response) {
    try {
      const { token } = req.body;
      if (!req.user) throw new Error("Unauthorized");
      await AuthService.updatePushToken(req.user.id, token);
      return res.json({ success: true });
    } catch (err: any) { return res.status(500).json({ error: "Failed to update token" }); }
  }
}