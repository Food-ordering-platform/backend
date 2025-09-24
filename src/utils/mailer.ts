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
