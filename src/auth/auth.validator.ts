import { z } from "zod";

export const registerSchema = z.object({
    name:z.string().min(2, {message: "Name must be at least 2 characters"}),
    email:z.string().email({message: "Invalid email address"}),
    password:z.string().min(6, {message: "Password must be at least 6 characters"}),
    phone:z.string(),
    role: z.enum(["CUSTOMER", "VENDOR"]).default("CUSTOMER"),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  clientType: z.enum(["web", "mobile"]).optional() // Add this line
});