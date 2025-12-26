import axios from "axios";
import { randomBytes } from "crypto";
import { Webhook } from "node-mailjet";

const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY as string;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export class PaymentService {
  // Initialize payment
  static async initiatePayment(
    amount: number,
    name: string,
    email: string,
    reference: string // use Prisma-generated reference
  ): Promise<string> {
    const response = await axios.post(
      "https://api.korapay.com/merchant/api/v1/charges/initialize",
      {
        amount,
        currency: "NGN",
        reference,
        customer: { name, email },
        redirect_url: `${process.env.FRONTEND_URL}/orders/details`, // ✅ updated

        notification_url:
          "https://food-ordering-app.up.railway.app/api/payment/webhook",
      },
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Return the checkout URL for frontend redirection
    return response.data.data.checkout_url;
  }

  // Verify payment status after redirect or via API call
  static async verifyPayment(reference: string) {
    const response = await axios.get(
      `https://api.korapay.com/merchant/api/v1/charges/${reference}`,
      {
        headers: { Authorization: `Bearer ${KORAPAY_SECRET_KEY}` },
      }
    );

    return response.data.data;
  }

  //Refund payment incase vendor rejects order
  static async refund(paymentReference: string, amount?: number) {
    try {
      // 1. Generate a unique reference for this refund action (Required)
      const refundReference = `REF-${randomBytes(8).toString("hex")}`;

      const response = await axios.post(
        "https://api.korapay.com/merchant/api/v1/refunds/initiate",
        {
          // REQUIRED FIELDS
          payment_reference: paymentReference, // The original order reference
          reference: refundReference, // Unique ID for this refund

          // OPTIONAL FIELDS (Good for tracking)
          amount: amount, // Refund specific amount (or full if undefined)
          reason: "Order rejected by vendor", // Audit trail
          webhook_url:
            "https://food-ordering-app.up.railway.app/api/payment/webhook", // Track status updates
        },
        {
          headers: { Authorization: `Bearer ${KORAPAY_SECRET_KEY}` },
        }
      );

      console.log("Refund initiated successfully:", response.data);
      return response.data;
    } catch (err: any) {
      console.error("Refund failed:", err.response?.data || err.message);
      // We throw error so the Order Service knows something went wrong
      throw new Error("Failed to process refund via Korapay");
    }
  }
}
