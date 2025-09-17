import axios from "axios";

const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY as string;

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
        redirect_url: "http://localhost:3000/orders",
        notification_url: "http://localhost:5000/api/payment/webhook",
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

}
