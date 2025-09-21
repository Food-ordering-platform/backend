// mailer.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtPEmail(email: string, otp: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: "Food App <onboarding@resend.dev>", // Use your verified domain or default
      to: email,
      subject: "Your OTP Code",
      html: `<p>Your OTP code is: <b>${otp}</b></p>`,
    });

    if (error) {
      console.error("Failed to send OTP email:", error);
      throw new Error("OTP email failed");
    }

    console.log("OTP email sent successfully:", data?.id);
    return data;
  } catch (err) {
    console.error("Error sending OTP email:", err);
    throw err;
  }
}
