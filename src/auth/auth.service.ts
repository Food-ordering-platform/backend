import { PrismaClient } from "../../generated/prisma";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import jwt from "jsonwebtoken";
import dayjs from "dayjs";
import { sendOtPEmail } from "../utils/mailer";

const prisma = new PrismaClient();

export class AuthService {
  // Register a new User
  static async register(name: string, email: string, password: string, phone?: string) {
    // check if the user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error("Email already in use");
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create new user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: "CUSTOMER",
        isVerified:false
      },
    });

    //generate otp
    const code = await this.generateOtp(user.id)

    //Generate short-lived JWT 
    const token = jwt.sign({userId: user.id}, process.env.JWT_SECRET as string, {
      expiresIn :"15m"
    });

    //Log the token to the broswer for now
    await sendOtPEmail(user.email, code)

    return {user, token}
  }

  //Login User
  static async login(email:string, password:string){
    const user = await prisma.user.findUnique({where: {email}});
    if(!user){
        throw new Error("Invalid email address")
    }

    const isValid = await bcrypt.compare(password, user.password)
    if(!isValid){
        throw new Error("Invalid Password")
    }

    //Generate JWT
    const token = jwt.sign(
        {userId: user.id, role: user.role}, 
        process.env.JWT_SECRET as string, 
        {expiresIn: "7d"}
    )
    return {token, user}
  }

  //Generate OTP
  static async generateOtp (userId: string){
    const code = randomInt(100000, 999999).toString();
    const expiresAt = dayjs().add(10, "minute").toDate();

    await prisma.otp.create({
      data: {code, userId, expiresAt}
    })
    return code
  }

  //Verify OTP
  static async verifyOtp(token: string, code: string) {
  try {
    // decode token
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };

    const otp = await prisma.otp.findFirst({
      where: { userId: payload.userId, code, used: false, expiresAt: { gt: new Date() } },
    });

    if (!otp) throw new Error("Invalid or expired OTP");

    // mark otp as used
    await prisma.otp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // mark user as verified
    await prisma.user.update({
      where: { id: payload.userId },
      data: { isVerified: true },
    });

    return { message: "Account Verified Successfully" };
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
}

}
