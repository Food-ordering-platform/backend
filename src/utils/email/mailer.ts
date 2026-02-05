import nodemailer from "nodemailer";

// 1. Debug: Check if Environment Variables exist
console.log("📧 Initializing Mailer...");
console.log("📧 GMAIL_USER defined:", !!process.env.GMAIL_USER);
console.log("📧 GMAIL_APP_PASSWORD defined:", !!process.env.GMAIL_APP_PASSWORD);

export const mailer = nodemailer.createTransport({
  service:"gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// 2. Debug: Verify Connection on Startup
mailer.verify((error, success) => {
  if (error) {
    console.error("❌ Mailer Connection Error:", error);
  } else {
    console.log("✅ Mailer Connected Successfully. Ready to send emails.");
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

    console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
    return info;
  } catch (error: any) {
    // 3. Debug: Catch the actual Nodemailer error
    console.error(`❌ FATAL EMAIL ERROR to ${to}:`, error.message);
    if (error.response) console.error("SMTP Response:", error.response);
    throw error; // Re-throw so the service catches it too
  }
}