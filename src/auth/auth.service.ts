// src/services/auth.service.ts
import { PrismaClient } from "../../generated/prisma";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import jwt from "jsonwebtoken";
import dayjs from "dayjs";
import { sendOtPEmail } from "../utils/mailer";

const prisma = new PrismaClient();

export class AuthService {
  // ------------------ REGISTER ------------------
  static async registerUser(
    name: string,
    email: string,
    password: string,
    phone?: string,
    role: "CUSTOMER" | "VENDOR" = "CUSTOMER"
  ) {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      if (!existingUser.isVerified) {
        const code = await this.generateOtp(existingUser.id);
        await sendOtPEmail(existingUser.email, code);

        const token = jwt.sign(
          { userId: existingUser.id, role: existingUser.role },
          process.env.JWT_SECRET as string,
          { expiresIn: "15m" }
        );

        return { user: existingUser, token };
      }
      throw new Error("Email already in use");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role,
        isVerified: false,
      },
    });

    if (role === "VENDOR") {
      await prisma.restaurant.create({
        data: {
          name,
          email,
          phone,
          address: "",
          ownerId: user.id,
          deliveryTime: "30-40 mins",
          deliveryFee: 0,
          minimumOrder: 0,
          isOpen: false,
        },
      });
    }

    const code = await this.generateOtp(user.id);

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    await sendOtPEmail(user.email, code);

    return { user, token };
  }

  // ------------------ LOGIN ------------------
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Invalid email address");

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error("Invalid password");

    if (!user.isVerified) {
      throw new Error("Please verify your account with the OTP first.");
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    return { token, user };
  }

  // ------------------ OTP UTILS ------------------
  static async generateOtp(userId: string) {
    const code = randomInt(100000, 999999).toString();
    const expiresAt = dayjs().add(10, "minute").toDate();

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

      if (!otp) throw new Error("Invalid or expired OTP");

      await prisma.otp.update({
        where: { id: otp.id },
        data: { used: true },
      });

      const user = await prisma.user.update({
        where: { id: payload.userId },
        data: { isVerified: true },
      });

      return {
        message: "Account Verified Successfully",
        user: { id: user.id, email: user.email, role: user.role },
      };
    } catch {
      throw new Error("Invalid or expired token");
    }
  }

  // ------------------ FORGOT PASSWORD ------------------
  static async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error("If account exists, OTP will be sent");
    }

    const code = randomInt(100000, 999999).toString();
    const expiresAt = dayjs().add(10, "minute").toDate();

    await prisma.otp.create({
      data: { code, userId: user.id, expiresAt },
    });

    await sendOtPEmail(user.email, code);

    const token = jwt.sign(
      { userId: user.id, purpose: "RESET_PASSWORD" },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    return { message: "OTP sent to email", token };
  }

  // ------------------ VERIFY FORGOT PASSWORD OTP ------------------
  static async verifyForgotPasswordOtp(token: string, code: string) {
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as { userId: string; purpose: string };

      if (payload.purpose !== "RESET_PASSWORD") {
        throw new Error("Invalid token purpose");
      }

      const otp = await prisma.otp.findFirst({
        where: {
          userId: payload.userId,
          code,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!otp) throw new Error("Invalid or expired OTP");

      await prisma.otp.update({
        where: { id: otp.id },
        data: { used: true },
      });

      const resetToken = jwt.sign(
        { userId: payload.userId, purpose: "RESET_PASSWORD_FINAL" },
        process.env.JWT_SECRET as string,
        { expiresIn: "15m" }
      );

      return { message: "OTP Verified. Use reset token.", resetToken };
    } catch {
      throw new Error("Invalid or expired OTP");
    }
  }

  // ------------------ RESET PASSWORD ------------------
  static async resetPassword(resetToken: string, newPassword: string) {
    try {
      const payload = jwt.verify(
        resetToken,
        process.env.JWT_SECRET as string
      ) as { userId: string; purpose: string };

      if (payload.purpose !== "RESET_PASSWORD_FINAL") {
        throw new Error("Invalid token purpose");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: payload.userId },
        data: { password: hashedPassword },
      });

      return { message: "Password reset successful" };
    } catch {
      throw new Error("Invalid or expired reset token");
    }
  }
}
