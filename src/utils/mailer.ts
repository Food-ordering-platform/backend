// mailer.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail", // can be "hotmail", "outlook", or use custom SMTP
  auth: {
    user: process.env.EMAIL_USER, // your Gmail address
    pass: process.env.EMAIL_PASS, // Gmail App Password if 2FA is on
  },
});

export async function sendOtPEmail(email: string, otp: string) {
  try {
    const info = await transporter.sendMail({
      from: `"Food App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      html: `<p>Your OTP code is: <b>${otp}</b></p>`,
    });

    console.log("OTP email sent successfully:", info.messageId);
    return info;
  } catch (err) {
    console.error("Error sending OTP email:", err);
    throw new Error("OTP email failed");
  }
}
