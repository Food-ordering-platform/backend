import { z } from "zod";

export const acceptOrderSchema = z.object({
  orderId: z.string().uuid({ message: "Invalid Order ID format" }),
});

export const assignRiderSchema = z.object({
  trackingId: z.string().min(1, "Tracking ID is required"),
  name: z.string().min(2, "Rider name is too short"),
  phone: z.string().regex(/^[0-9]{10,11}$/, "Phone number must be 10 or 11 digits"),
});

export const pickupSchema = z.object({
  trackingId: z.string().min(1, "Tracking ID is required"),
});

export const completeDeliverySchema = z.object({
  trackingId: z.string().min(1, "Tracking ID is required"),
  otp: z.string().length(4, "Delivery code must be exactly 4 digits"),
});

export const withdrawalSchema = z.object({
  amount: z.number().min(1000, "Minimum withdrawal is ₦1,000"),
  bankDetails: z.object({
    bankName: z.string().min(2, "Bank name is required"),
    accountNumber: z.string().regex(/^[0-9]{10}$/, "Account number must be 10 digits"),
    accountName: z.string().min(2, "Account name is required"),
  }),
});