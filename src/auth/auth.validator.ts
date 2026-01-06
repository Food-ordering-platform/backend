import { z } from "zod";

export const registerSchema = z.object({
    name:z.string().min(2, {message: "Name must be at least 2 characters"}),
    email:z.string().email({message: "Invalid email address"}),
    password:z.string().min(6, {message: "Password must be at least 6 characters"}),
    phone:z.string(),
    role: z.enum(["CUSTOMER", "VENDOR", "RIDER", "DISPATCHER"]).default("CUSTOMER"),

    address: z.string().optional(),

    terms: z.boolean().refine(val => val === true, {
        message: "You must accept the Terms and Conditions"
    })
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  clientType: z.enum(["web", "mobile"]).optional() // Add this line
});