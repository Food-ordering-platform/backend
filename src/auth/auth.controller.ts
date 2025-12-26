import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.validator";
import { error } from "console";

export class AuthController {
  // ------------------ REGISTER ------------------
  // (Mostly unchanged, returns a temp token for OTP flow)
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
        token, // Frontend uses this for verify-otp flow (Short-lived)
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------ LOGIN (HYBRID) ------------------
  static async login(req: Request, res: Response) {
    try {
      // Ensure your loginSchema allows 'clientType'
      const data = loginSchema.parse(req.body);
      const clientType = req.body.clientType || "mobile"; // Default to mobile

      const result = await AuthService.login(data.email, data.password);

      // A. Check if OTP is required (Account not verified)
      if (result.requireOtp) {
        return res.status(200).json({
          message: "Account not verified. OTP sent.",
          requireOtp: true,
          token: result.token, // Temp token for verification
          user: {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
          },
        });
      }

      // B. HYBRID AUTHENTICATION
      if (clientType === "web") {
        // --- WEB PATH (SESSION) ---
        // Save user to session. Server automatically sends "set-cookie" header.
        (req.session as any).user = {
          id: result.user.id,
          role: result.user.role,
          email: result.user.email,
        };

        return res.status(200).json({
          message: "Login successful (Session Active)",
          user: result.user,
          // NO TOKEN RETURNED FOR WEB
        });
      } else {
        // --- MOBILE PATH (JWT) ---
        return res.status(200).json({
          message: "Login successful (Token Issued)",
          result, // Contains token and user
        });
      }
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------ GOOGLE LOGIN ------------------
  static async googleLogin(req: Request, res: Response) {
    try {
      const { token, clientType } = req.body; // Add clientType to body
      if (!token) throw new Error("Google token is required");

      const result = await AuthService.loginWithGoogle(token);

      // HYBRID AUTH FOR GOOGLE
      if (clientType === "web") {
        (req.session as any).user = {
          id: result.user.id,
          role: result.user.role,
          email: result.user.email,
        };
        return res.status(200).json({
          message: "Google login successful (Session)",
          user: result.user,
        });
      } else {
        return res.status(200).json({
          message: "Google login successful (Token)",
          result,
        });
      }
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------ GET ME (VALIDATE SESSION/TOKEN) ------------------
  static async getMe(req: Request, res: Response) {
    try {
      // The Middleware has already done the heavy lifting!
      // It checked the Cookie OR the Header and put the user in req.user
      if (!req.user) {
        throw new Error("Unauthorized");
      }

      // Fetch fresh data from DB
      const user = await AuthService.getMe(req.user.id);

      return res.status(200).json({
        message: "User Verified",
        user,
      });
    } catch (err: any) {
      res.status(401).json({ error: "Unauthorized: " + err.message });
    }
  }

  // ------------------ VERIFY OTP (HYBRID) ------------------
  static async verifyOtp(req: Request, res: Response) {
    try {
      const { token, code, clientType } = req.body;
      const result = await AuthService.verifyOtp(token, code);

      // HYBRID LOGIC
      // If a Web user just verified their account, they should be logged in immediately (Session)
      if (clientType === "web") {
        (req.session as any).user = {
          id: result.user.id,
          role: result.user.role,
          email: result.user.email,
        };

        return res.status(200).json({
          message: "Account Verified & Logged In (Session)",
          user: result.user,
        });
      } else {
        // Mobile users get the permanent token
        return res.status(200).json(result);
      }
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------ LOGOUT (NEW) ------------------
  static async logout(req: Request, res: Response) {
    // 1. Destroy Session (Web)
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "Could not log out" });
        }
        res.clearCookie("connect.sid"); // Clear the cookie from browser
        return res.status(200).json({ message: "Logged out successfully" });
      });
    } else {
      // 2. Token Logout (Mobile)
      // Since tokens are stateless, we just tell the client "Success".
      // The client must delete the token from storage.
      return res.status(200).json({ message: "Logged out successfully" });
    }
  }

  // ------------------ PASSWORD RESET FLOW (UNCHANGED) ------------------
  // These use short-lived tokens, not sessions, so they remain the same.

  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) throw new Error("Email is required");

      const result = await AuthService.forgotPassword(email);

      return res.status(200).json({
        message: "OTP sent to email for password reset",
        token: result.token,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

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

  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword, confirmPassword } = req.body;
      if (!token || !newPassword) {
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

  // ------------------ PUSH NOTIFICATION ------------------
  static async updatePushToken(req: Request, res: Response) {
    try {
      const { token } = req.body;

      // Use req.user (attached by middleware)
      if (!req.user) throw new Error("Unauthorized");

      await AuthService.updatePushToken(req.user.id, token);

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to update token" });
    }
  }
}
