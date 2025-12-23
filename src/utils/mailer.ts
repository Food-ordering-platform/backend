import axios from "axios";

export async function sendOtPEmail(email: string, otp: string) {
  try {
    const response = await axios.post(
      process.env.EMAIL_SERVICE_URL!, // from .env
      {
        to: email,
        subject: "Your OTP Code",
        html: `<p>Your OTP code is: <b>${otp}</b></p>`,
      }
    );

    console.log("OTP email sent successfully:", response.data);
    return response.data;
  } catch (err: any) {
    console.error(
      "Error sending OTP email:",
      err.response?.data || err.message
    );
    throw new Error("OTP email failed");
  }
}

// [NEW] Generic Email Sender for Order Updates
export async function sendOrderStatusEmail(email: string, name: string, orderId: string, status: string) {
  try {
    const subject = `Order Update: #${orderId.slice(0, 6).toUpperCase()}`;
    let message = "";

    switch (status) {
      case "PREPARING":
        message = `Hi ${name}, your order has been <b>accepted</b> and is currently being prepared!`;
        break;
      case "READY_FOR_PICKUP":
        message = `Hi ${name}, your order is <b>ready</b>! A rider will pick it up soon (or you can pick it up).`;
        break;
      case "COMPLETED":
        message = `Hi ${name}, your order has been <b>delivered</b>. Enjoy your meal!`;
        break;
      case "CANCELLED":
        message = `Hi ${name}, unfortunately your order was <b>cancelled</b>. A refund has been processed.`;
        break;
      default:
        message = `Hi ${name}, your order status is now: <b>${status}</b>`;
    }

    await axios.post(
      process.env.EMAIL_SERVICE_URL!, 
      {
        to: email,
        subject: subject,
        html: `<p>${message}</p>`,
      }
    );
    console.log(`Order email sent to ${email} for status ${status}`);
  } catch (err: any) {
    console.error("Failed to send order email:", err.message);
    // Don't throw error here to prevent blocking the actual order update
  }
}
