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
    reference: string,
  ): Promise<string> {
    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          // Convert Naira to Kobo (Paystack requirement)
          amount: Math.round(amount * 100),
          reference,
          name,
          // Where Paystack redirects the user AFTER payment (Frontend)
          callback_url: `https://choweazy.vercel.app/orders/details`,
          metadata: {
            custom_fields: [
              {
                display_name: name,
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
        },
      );

      // Paystack returns the URL in data.data.authorization_url
      return response.data.data.authorization_url;
    } catch (error: any) {
      console.error(
        "Paystack Init Error:",
        error.response?.data || error.message,
      );
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
        },
      );

      return response.data.data; // Contains status: 'success', 'failed', etc.
    } catch (error: any) {
      console.error(
        "Paystack Verify Error:",
        error.response?.data || error.message,
      );
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
        },
      );

      console.log("Refund initiated successfully:", response.data);
      return response.data;
    } catch (err: any) {
      console.error("Refund failed:", err.response?.data || err.message);
      throw new Error("Failed to process refund via Paystack");
    }
  }

  /**
   * 1. Resolve Bank Account
   * Verifies that the account number is correct for the selected bank.
   */
  static async resolveAccount(accountNumber: string, bankCode: string) {
    try {
      const response = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        },
      );
      return response.data.data; // Returns { account_name, account_number, bank_id }
    } catch (error: any) {
      console.error(
        "Resolve Account Error:",
        error.response?.data || error.message,
      );
      throw new Error("Invalid bank account details");
    }
  }

  static async createTransferRecipient(
    name: string,
    accountNumber: string,
    bankCode: string,
  ) {
    try {
      const response = await axios.post(
        "https://api.paystack.co/transferrecipient",
        {
          type: "nuban",
          name: name,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: "NGN",
        },
        {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        },
      );
      return response.data.data.recipient_code; // Returns code like 'RCP_w4389...'
    } catch (error: any) {
      console.error(
        "Create Recipient Error:",
        error.response?.data || error.message,
      );
      throw new Error("Failed to create transfer recipient");
    }
  }

  static async initiateTransfer(
    amount: number,
    recipientCode: string,
    reference: string,
    reason = "Payout",
  ) {
    try {
      const response = await axios.post(
        "https://api.paystack.co/transfer",
        {
          source: "balance", // Use your Paystack Balance
          amount: Math.round(amount * 100), // Convert to Kobo
          recipient: recipientCode,
          reason: reason,
          reference: reference,
        },
        {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        },
      );
      return response.data.data;
    } catch (error: any) {
      console.error("Transfer Error:", error.response?.data || error.message);
      // Handle specific Paystack errors (like low balance)
      if (error.response?.data?.code === "transfer_balance_insufficient") {
        throw new Error(
          "System wallet balance is too low to process this payout.",
        );
      }
      throw new Error(error.response?.data?.message || "Payout failed");
    }
  }

  /**
   * Helper: Get List of Banks (Optional, if you need to send this to frontend)
   */
  static async getBankList() {
      try {
        const response = await axios.get("https://api.paystack.co/bank", {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        });
        return response.data.data;
      } catch (error) {
          return [];
      }
  }
}
