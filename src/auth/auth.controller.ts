import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.validator";

export class AuthController {
  // Register a new user
  static async register(req: Request, res: Response) {
    try {
      // validate request
      const data = registerSchema.parse(req.body);

      // call service (creates user, otp, and token)
      const { user, token } = await AuthService.register(
        data.name,
        data.email,
        data.password,
        data.phone
      );

      return res.status(201).json({
        message: "User registered. OTP sent to email/phone",
        user,
        token, // 👈 frontend needs this to redirect to verify-otp page
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
}
