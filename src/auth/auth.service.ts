// food-ordering-platform/backend/backend-main/src/auth/auth.service.ts

import { PrismaClient, } from "@prisma/client";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library"
import { randomInt } from "crypto";
import jwt from "jsonwebtoken";
import dayjs from "dayjs";
import { sendLoginAlertEmail, sendOtPEmail, sendRiderVerificationPendingEmail } from "../utils/email/email.service";

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export class AuthService {
  // ------------------ REGISTER ------------------
 // ------------------ REGISTER ------------------
  static async registerUser(
    name: string,
    email: string,
    password: string,
    phone: string,
    role: "CUSTOMER" | "VENDOR" | "RIDER" = "CUSTOMER",
    termsAcceptedAt: Date,
    address?: string,
    inviteCode?: string // 🟢 1. ADD THIS OPTIONAL PARAMETER
  ) {
    let logisticsCompanyId : string | null = null;

    // 🟢 2. THE FLEET ROUTER: If they are a Rider and provided a code, link them!
    if (role === "RIDER" && inviteCode) {
      // Clean up the code just in case they added spaces
      const cleanCode = inviteCode.trim().toUpperCase();
      
      const company = await prisma.logisticsCompany.findUnique({
        where: { inviteCode: cleanCode }
      });

      if (!company) {
        throw new Error("Invalid Company Invite Code. Please check with your manager and try again.");
      }
      
      logisticsCompanyId = company.id;
    }

    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        // If unverified, update details and resend OTP
        const updatedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            termsAcceptedAt: termsAcceptedAt,
            name: name,
            phone: phone,
            address: address,
            role: role, 
            isOnline: false,
            logisticsCompanyId: logisticsCompanyId // 🟢 3. Update relation here too
          }
        });

        const code = await this.generateOtp(updatedUser.id);
        await sendOtPEmail(updatedUser.email, code);

        return { user: updatedUser };
      }
      throw new Error("This email is already registered. Please login.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone,
          role,
          isEmailVerified: false,
          isVerified: false,
          isOnline: false,
          termsAcceptedAt: termsAcceptedAt,
          address,
          logisticsCompanyId: logisticsCompanyId // 🟢 4. Save relation for new users!
        },
      });

      return user;
    });

    const code = await this.generateOtp(result.id);

    sendOtPEmail(result.email, code).catch(err => console.error("Failed to send OTP email:", err));
    if (result.role === "RIDER") {
      sendRiderVerificationPendingEmail(result.email, result.name)
        .catch(err => console.error("Failed to send Rider pending email:", err));
    }
    return { user: result };
  }


  // ------------------ LOGIN ------------------
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ 
      where: { email }, 
      include: { restaurant: true } 
    });
    
    if (!user) throw new Error("We couldn't find an account with that email.");

    if (!user.password) throw new Error("Invalid credentials. Did you sign up with Google?");
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error("Incorrect password. Please try again.");

    if (!user.isEmailVerified) {
      const code = await this.generateOtp(user.id);
      await sendOtPEmail(user.email, code);

      // Temp token just for the OTP verification screen
      const tempToken = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET as string,
        { expiresIn: "30m" }
      );

      return {
        requireOtp: true,
        accessToken: tempToken, // Renamed to accessToken for frontend consistency
        user
      };
    }

    // 🟢 THE FIX: Generate the Two-Token System
    const { accessToken, refreshToken } = this.generateTokens(user);

    sendLoginAlertEmail(user.email, user.name);
    
    // Return both tokens to the controller
    return { accessToken, refreshToken, user };
  }



  // ------------------ GOOGLE LOGIN ------------------
 static async loginWithGoogle(token: string, termsAccepted: boolean) {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      throw new Error("Unable to verify Google account.");
    }

    const { email, name, sub: googleId, picture } = payload;

    let user = await prisma.user.findUnique({
      where: { email },
    });

    // If user doesn't exist AND they didn't accept terms (via Signup page)
    if (!user && !termsAccepted) {
      throw new Error("Account not found. Please use the Sign Up page to create an account.");
    }

    if (!user) {
      // CREATE NEW USER 
      user = await prisma.user.create({
        data: {
          email,
          name: name || "Google User",
          googleId,
          avatar: picture,
          isEmailVerified: true,
          role: "CUSTOMER",
          termsAcceptedAt: new Date(), 
        },
      });
    } else {
      // UPDATE EXISTING USER
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatar: picture || user.avatar },
        });
      }
    }

    // 🟢 THE FIX: Generate the Two-Token System
    const { accessToken, refreshToken } = this.generateTokens(user);

    if (user.email) {
      sendLoginAlertEmail(user.email, user.name);
    }

    // Return both tokens to the controller
    return { accessToken, refreshToken, user };
  }


  


  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
        latitude: true,
        longitude: true,
        address: true, // Make sure address is returned
        phone: true,
        restaurant: true
      }
    })
    if (!user) {
      throw new Error("User session not found. Please login again.")
    }
    return user;
  }


  static async updateProfile(userId: string, data: {
    name?: string;
    phone?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    pushToken?: string; // <--- 1. Add Type Here
  }) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        pushToken: data.pushToken, // <--- 2. Add Field Here
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        latitude: true,
        longitude: true,
        role: true,
        isVerified: true,
        pushToken: true // Optional: if you want to see it in the response
      }
    });
  }


  // ------------------ OTP UTILS ------------------


  static async verifyOtp(email: string, code: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("User not found");

    const otpRecord = await prisma.otp.findFirst({
      where: { userId: user.id, code, used: false, expiresAt: { gt: new Date() } },
    });
    if (!otpRecord) throw new Error("Invalid or expired OTP");

    // 
    // 1. Mark Email as Verified (Allows Login)
    // 2. Only Auto-Approve CUSTOMERS. Riders remain Pending.

    const updateData: any = {
      isEmailVerified: true
    };

    if (user.role === 'CUSTOMER') {
      updateData.isVerified = true; // Auto-verify customers
    }
    // If RIDER, isVerified stays false (Pending Admin)

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    await prisma.otp.update({ where: { id: otpRecord.id }, data: { used: true } });

    // Return the updated status so frontend knows where to go
    return {
      isVerified: updatedUser.isVerified,
      role: updatedUser.role
    };
  }

  // ------------------ FORGOT PASSWORD ------------------
  static async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error("We sent an OTP if this email exists.");
    }

    const code = randomInt(100000, 999999).toString();
    const expiresAt = dayjs().add(30, "minute").toDate();

    await prisma.otp.create({
      data: { code, userId: user.id, expiresAt },
    });

    await sendOtPEmail(user.email, code);

    const token = jwt.sign(
      { userId: user.id, purpose: "RESET_PASSWORD" },
      process.env.JWT_SECRET as string,
      { expiresIn: "24h" }
    );

    return { message: "OTP sent to email", token };
  }

  static async verifyForgotPasswordOtp(token: string, code: string) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string; purpose: string };

      if (payload.purpose !== "RESET_PASSWORD") throw new Error("Invalid request type");

      const otp = await prisma.otp.findFirst({
        where: { userId: payload.userId, code, used: false, expiresAt: { gt: new Date() } },
      });

      if (!otp) throw new Error("Invalid or expired code.");

      await prisma.otp.update({ where: { id: otp.id }, data: { used: true } });

      const resetToken = jwt.sign(
        { userId: payload.userId, purpose: "RESET_PASSWORD_FINAL" },
        process.env.JWT_SECRET as string,
        { expiresIn: "30m" }
      );

      return { message: "OTP Verified.", resetToken };
    } catch {
      throw new Error("Invalid or expired session.");
    }
  }

  static async resetPassword(resetToken: string, newPassword: string) {
    try {
      const payload = jwt.verify(resetToken, process.env.JWT_SECRET as string) as { userId: string; purpose: string };
      if (payload.purpose !== "RESET_PASSWORD_FINAL") throw new Error("Invalid request");

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: payload.userId },
        data: { password: hashedPassword },
      });

      return { message: "Password reset successful" };
    } catch {
      throw new Error("Your session expired. Please start the password reset process again.");
    }
  }

  static async updatePushToken(userId: string, token: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { pushToken: token }
    });
  }

    static async generateOtp(userId: string) {
    const code = randomInt(100000, 999999).toString();
    const expiresAt = dayjs().add(30, "minute").toDate();

    await prisma.otp.create({
      data: { code, userId, expiresAt },
    });

    return code;
  }

  static generateTokens(user: { id: string; role: string }) {
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" } // Short-lived Access Token
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET as string, // Make sure you add this to .env!
      { expiresIn: "30d" } // Long-lived Refresh Token
    );

    return { accessToken, refreshToken };
  }


  // ------------------ REFRESH TOKEN ------------------
  static async refreshAccessToken(refreshToken: string) {
    try {
      // 1. Verify the token signature
      const decoded = jwt.verify(
        refreshToken, 
        process.env.JWT_REFRESH_SECRET as string
      ) as { userId: string };

      // 2. Ensure the user still exists (and hasn't been deleted)
      const user = await prisma.user.findUnique({ 
        where: { id: decoded.userId } 
      });
      
      if (!user) throw new Error("User not found");

      // 3. Generate a brand new 15-minute Access Token
        const { accessToken } = this.generateTokens({ id: user.id, role: user.role });

      return accessToken;
    } catch (error) {
      // If the token is expired or tampered with, it throws here
      throw new Error("Invalid or expired refresh token.");
    }
  }
}