// food-ordering-platform/backend/backend-main/src/auth/auth.service.ts

import { PrismaClient } from "../../generated/prisma";
import bcrypt from "bcryptjs";
import {OAuth2Client} from "google-auth-library"
import { randomInt } from "crypto";
import jwt from "jsonwebtoken";
import dayjs from "dayjs";
import { sendLoginAlertEmail, sendOtPEmail } from "../utils/mailer";

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export class AuthService {
  // ------------------ REGISTER ------------------
 static async registerUser(
    name: string,
    email: string,
    password: string,
    phone: string, 
    role: "CUSTOMER" | "VENDOR" | "DISPATCHER" | "RIDER"  = "CUSTOMER",
    termsAcceptedAt: Date,
    address?: string
  ) {
    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      if (!existingUser.isVerified) {
        // If unverified, update details and resend OTP
        const updatedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            termsAcceptedAt: termsAcceptedAt, 
            name: name,
            phone: phone, 
            address: address,
            role: role // Update role in case they changed it
          }
        });
        
        // Regenerate OTP
        const code = await this.generateOtp(updatedUser.id);
        await sendOtPEmail(updatedUser.email, code);

        const token = jwt.sign(
          { userId: updatedUser.id, role: updatedUser.role },
          process.env.JWT_SECRET as string,
          { expiresIn: "30m" } 
        );

        return { user: updatedUser, token };
      }
      throw new Error("This email is already registered. Please login.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. ATOMIC TRANSACTION: Create User + (Optional) LogisticsPartner
    const result = await prisma.$transaction(async (tx) => {
        // A. Create the base User
        const user = await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            phone,
            role,
            isVerified: false,
            termsAcceptedAt: termsAcceptedAt,
            address
          },
        });

        // B. If DISPATCHER, automatically create the LogisticsPartner profile
        if (role === "DISPATCHER") {
            // Validate required fields for Logistics Partner
            if (!address) {
                // You can either throw an error or use a placeholder
                // throw new Error("Address is required for Logistics Companies."); 
            }

            await tx.logisticsPartner.create({
                data: {
                    name: `${name}'s Logistics`, // Default business name
                    email: email, // Use owner's email
                    phone: phone, // Use owner's phone
                    address: address || "Update Your Office Address",
                    ownerId: user.id
                }
            });
        }

        return user;
    });

    // 3. Generate OTP & Token (Outside transaction to keep it fast)
    const code = await this.generateOtp(result.id);

    const token = jwt.sign(
      { userId: result.id, role: result.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "30m" } 
    );

    // 4. Send Email (Non-blocking)
    sendOtPEmail(result.email, code).catch(err => console.error("Failed to send OTP email:", err));

    return { user: result, token };
  }

  // ------------------ LOGIN ------------------
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: {email}, include:{restaurant: true}});
    if (!user) throw new Error("We couldn't find an account with that email.");

    if (!user.password) throw new Error("Invalid credentials. Did you sign up with Google?");
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error("Incorrect password. Please try again.");

    // Handle Unverified Users
    if (!user.isVerified) {
      const code = await this.generateOtp(user.id);
      await sendOtPEmail(user.email, code);

      const tempToken = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET as string,
        { expiresIn: "30m" } 
      );

      return { 
        requireOtp: true,
        token: tempToken,
        user 
      };
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    sendLoginAlertEmail(user.email, user.name).catch(e => console.log("Login Email Error", e))
    return { token, user };
  }

  static async loginWithGoogle(token: string) {
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

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || "Google User",
          googleId,
          avatar: picture,
          isVerified: true, 
          role: "CUSTOMER", 
        },
      });
    } else {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatar: picture || user.avatar },
        });
      }
    }

    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    if(user.email) {
       sendLoginAlertEmail(user.email, user.name).catch(e => console.log("Login email error", e));
    }

    return { token: jwtToken, user };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where:{id:userId},
      select:{
        id: true,
        name:true,
        email:true,
        role:true,
        isVerified:true,
        latitude: true,  // 👈 Added
        longitude: true,
        phone:true,
        // [FIX] Included restaurant relation here so frontend receives the ID
        restaurant: true
      }
    })
    if (!user){
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
  }) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
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
        isVerified: true
      }
    });
  }

  // ------------------ OTP UTILS ------------------
  static async generateOtp(userId: string) {
    const code = randomInt(100000, 999999).toString();
    const expiresAt = dayjs().add(30, "minute").toDate();

    await prisma.otp.create({
      data: { code, userId, expiresAt },
    });

    return code;
  }

  // ------------------ VERIFY OTP (SIGNUP) ------------------
  static async verifyOtp(token: string, code: string) {
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as { userId: string };

      const otp = await prisma.otp.findFirst({
        where: {
          userId: payload.userId,
          code,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });
 
      if (!otp) throw new Error("The code you entered is invalid or has expired.");

      await prisma.otp.update({
        where: { id: otp.id },
        data: { used: true },
      });

      const user = await prisma.user.update({
        where: { id: payload.userId },
        data: { isVerified: true },
      });

      const sessionToken = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET as string,
        { expiresIn: "24h" }
      );

      return {
        message: "Account Verified Successfully",
        user: { id: user.id, email: user.email, role: user.role },
        token: sessionToken, 
      };
    } catch (error: any) {
        if(error.message === "The code you entered is invalid or has expired."){
            throw error;
        }
        throw new Error("Your session has expired. Please login again to get a new code.");
    }
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

  
  //------------------PUSH NOTIFICATION FOR VENDORS ---------------------------//
  // ... inside AuthService class
  static async updatePushToken(userId: string, token: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { pushToken: token }
    });
  }
}