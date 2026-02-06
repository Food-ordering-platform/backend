// food-ordering-platform/backend/backend-main/src/auth/auth.service.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {OAuth2Client} from "google-auth-library"
import { randomInt } from "crypto";
import jwt from "jsonwebtoken";
import dayjs from "dayjs";
import { sendLoginAlertEmail, sendOtPEmail } from "../utils/email/email.service";

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export class AuthService {
  // ------------------ REGISTER ------------------
 static async registerUser(
    name: string,
    email: string,
    password: string,
    phone: string, 
    role: "CUSTOMER" | "VENDOR" |  "RIDER"  = "CUSTOMER",
    termsAcceptedAt: Date,
    address?: string
  ) {
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
            role: role // Update role in case they changed it
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
            termsAcceptedAt: termsAcceptedAt,
            address
          },
        });

        return user;
    });

    const code = await this.generateOtp(result.id);

    sendOtPEmail(result.email, code).catch(err => console.error("Failed to send OTP email:", err));

    return { user: result};
  }

  // ------------------ LOGIN ------------------
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: {email}, include:{restaurant: true}});
    if (!user) throw new Error("We couldn't find an account with that email.");

    if (!user.password) throw new Error("Invalid credentials. Did you sign up with Google?");
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error("Incorrect password. Please try again.");

    if (!user.isEmailVerified) {
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

    sendLoginAlertEmail(user.email, user.name)
    return { token, user };
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

    // 🛑 BLOCKER: If user doesn't exist AND they didn't accept terms (via Signup page)
    if (!user && !termsAccepted) {
        throw new Error("Account not found. Please use the Sign Up page to create an account.");
    }

    if (!user) {
      // ✅ CREATE NEW USER (With Terms Date)
      user = await prisma.user.create({
        data: {
          email,
          name: name || "Google User",
          googleId,
          avatar: picture,
          isEmailVerified: true, 
          role: "CUSTOMER",
          termsAcceptedAt: new Date(), // <--- SAVING THE DATE
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

    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    if(user.email) {
       sendLoginAlertEmail(user.email, user.name)
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
        latitude: true,  
        longitude: true,
        address: true, // Make sure address is returned
        phone:true,
        restaurant: true
      }
    })
    if (!user){
      throw new Error("User session not found. Please login again.")
    }
    return user;
  }

  // src/auth/auth.service.ts

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
  static async generateOtp(userId: string) {
    const code = randomInt(100000, 999999).toString();
    const expiresAt = dayjs().add(30, "minute").toDate();

    await prisma.otp.create({
      data: { code, userId, expiresAt },
    });

    return code;
  }

  static async verifyOtp(email: string, code: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("User not found");

    const otpRecord = await prisma.otp.findFirst({
      where: { userId: user.id, code, used: false, expiresAt: { gt: new Date() } },
    });
    if (!otpRecord) throw new Error ("Invalid or expired OTP");

    // 🟢 NEW LOGIC: 
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

  static async subscribeWebPush(userId: string, subscription: any) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error("Invalid subscription data");
    }

    return await prisma.webPushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }
}