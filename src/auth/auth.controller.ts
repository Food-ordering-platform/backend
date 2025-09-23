import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.validator";

export class AuthController {
  // Register a new user (Customer or Vendor)
  static async register(req: Request, res: Response) {
    try {
      const data = registerSchema.parse(req.body);

      const { user, token } = await AuthService.registerUser(
        data.name,
        data.email,
        data.password,
        data.phone,
        data.role
      );

      return res.status(201).json({
        message: "User registered. OTP sent to email",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
        },
        token, // frontend uses this for verify-otp flow
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // Login a user
  static async login(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await AuthService.login(data.email, data.password);

      return res.status(200).json({
        message: "Login successful",
        result,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // Verify OTP
  static async verifyOtp(req: Request, res: Response) {
    try {
      const { token, code } = req.body;
      const result = await AuthService.verifyOtp(token, code);

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // Forgot Password (send OTP to email)
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) throw new Error("Email is required");

      const result = await AuthService.forgotPassword(email);

      return res.status(200).json({
        message: "OTP sent to email for password reset",
        token: result.token, // short-lived JWT for reset flow
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // Verify Reset OTP
  static async verifyResetOtp(req: Request, res: Response) {
    try {
      const { token, code } = req.body;
      if (!token || !code) throw new Error("Token and OTP are required");

      const result = await AuthService.verifyForgotPasswordOtp(token, code);

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // Reset Password
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword, confirmPassword } = req.body;
      if (!token || !newPassword ) {
        throw new Error("All fields are required");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const result = await AuthService.resetPassword(token, newPassword);

      return res.status(200).json({
        message: "Password reset successful, please login again",
        result,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}
