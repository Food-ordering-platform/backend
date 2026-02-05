import nodemailer from "nodemailer";

// 1. Debug Logs
console.log("📧 Initializing Mailer (Gmail Service Mode)...");
console.log("📧 GMAIL_USER defined:", !!process.env.GMAIL_USER);

export const mailer = nodemailer.createTransport({
  service: "gmail",
  family: 4, // Forces IPv4 (Crucial for Railway)
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
} as nodemailer.TransportOptions); // <--- 🛠️ THIS FIXES THE TS ERROR

// 2. Verify
mailer.verify((error, success) => {
  if (error) {
    console.error("❌ Mailer Connection Error:", error);
  } else {
    console.log("✅ Mailer Connected Successfully (Gmail/IPv4).");
  }
});

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    console.log(`📨 Attempting to send email to: ${to}`);
    const info = await mailer.sendMail({
      from: `"ChowEazy" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent! ID: ${info.messageId}`);
    return info;
  } catch (error: any) {
    console.error(`❌ FATAL EMAIL ERROR:`, error.message);
    throw error;
  }
}