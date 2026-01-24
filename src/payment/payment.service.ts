import axios from "axios";
import { randomBytes } from "crypto";

// Use PAYSTACK_SECRET_KEY instead of KORAPAY
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export class PaymentService {
  /**
   * Initialize a payment with Paystack
   * Paystack requires amount in KOBO (multiply Naira by 100)
   */
  static async initiatePayment(
    amount: number,
    name: string,
    email: string,
    reference: string 
  ): Promise<string> {
    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          // Convert Naira to Kobo (Paystack requirement)
          amount: Math.round(amount * 100), 
          reference,
          // Where Paystack redirects the user AFTER payment (Frontend)
          callback_url: `https://choweazy.vercel.app/orders/details`, 
          metadata: {
            custom_fields: [
              {
                display_name: "Customer Name",
                variable_name: "customer_name",
                value: name,
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Paystack returns the URL in data.data.authorization_url
      return response.data.data.authorization_url;
    } catch (error: any) {
      console.error("Paystack Init Error:", error.response?.data || error.message);
      throw new Error("Payment gateway is temporarily unavailable");
    }
  }

  /**
   * Verify payment status
   */
  static async verifyPayment(reference: string) {
    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        }
      );

      return response.data.data; // Contains status: 'success', 'failed', etc.
    } catch (error: any) {
      console.error("Paystack Verify Error:", error.response?.data || error.message);
      throw new Error("Could not verify payment status");
    }
  }

  /**
   * Refund payment
   */
  static async refund(paymentReference: string, amount?: number) {
    try {
      const payload: any = {
        transaction: paymentReference, // Paystack uses the original transaction reference
      };

      // If amount is provided, convert to Kobo. If not, it does a full refund.
      if (amount) {
        payload.amount = Math.round(amount * 100);
      }

      const response = await axios.post(
        "https://api.paystack.co/refund",
        payload,
        {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        }
      );

      console.log("Refund initiated successfully:", response.data);
      return response.data;
    } catch (err: any) {
      console.error("Refund failed:", err.response?.data || err.message);
      throw new Error("Failed to process refund via Paystack");
    }
  }
}