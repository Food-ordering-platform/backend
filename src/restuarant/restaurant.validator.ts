import { z } from "zod";

export const createRestaurantSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  address: z.string().min(5, "Address is too short"),
  phone: z.string().min(10, "Phone number is invalid"),
  email: z.string().email("Invalid email address"),
  prepTime: z.coerce.number().min(5).max(120).default(20), // "20" string -> 20 number
  minimumOrder: z.coerce.number().min(0).default(0),
  isOpen: z.enum(["true", "false"]).transform((val) => val === "true").optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export const menuItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
});

export const payoutSchema = z.object({
  amount: z.number().min(1000, "Minimum withdrawal is ₦1,000"),
  bankDetails: z.object({
    bankName: z.string().min(1, "Bank name is required"),
    accountNumber: z.string().min(10, "Account number is required"),
    accountName: z.string().min(1, "Account name is required"),
  }),
});