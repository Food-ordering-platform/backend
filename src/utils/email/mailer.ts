import axios from "axios";

// Debug check
console.log("📧 Initializing Remote Mailer (Vercel Proxy)...");
const EMAIL_URL = process.env.EMAIL_API_URL;

if (!EMAIL_URL) {
  console.warn("⚠️ VERCEL_EMAIL_API_URL is missing in .env! Emails will fail.");
}

// We mock the 'mailer' object just in case some other file tries to import it directly.
// But mostly we rely on the sendEmail function below.
export const mailer = {
  verify: (cb: any) => {
    console.log("✅ Remote Mailer Ready (No local connection needed).");
    if (cb) cb(null, true);
  },
};

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!EMAIL_URL) {
    throw new Error("Cannot send email: VERCEL_EMAIL_API_URL is undefined");
  }

  try {
    console.log(`📨 Proxying email to Vercel: ${to}`);

    const response = await axios.post(EMAIL_URL, {
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent via Vercel! ID: ${response.data.id}`);
    return response.data;
  } catch (error: any) {
    // Better error logging
    const errorMsg = error.response?.data?.error || error.message;
    console.error(`❌ FATAL EMAIL PROXY ERROR to ${to}:`, errorMsg);
    throw new Error(`Email Proxy Failed: ${errorMsg}`);
  }
}