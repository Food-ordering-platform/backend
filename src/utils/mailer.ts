import axios from "axios";

// --- BRAND COLORS ---
const BRAND_COLORS = {
  wine: "#8B1538",        // Deep wine/burgundy
  wineDark: "#6B0F2A",    // Darker wine
  cream: "#FFF8F0",       // Warm cream
  success: "#059669",     // Emerald green
  warning: "#F59E0B",     // Amber
  danger: "#DC2626",      // Red
  info: "#3B82F6",        // Blue
  indigo: "#6366F1"       // Indigo (For Delivery Code)
};

// --- HELPER: CHECK ENV ---
const getEmailServiceUrl = () => {
  const url = process.env.EMAIL_SERVICE_URL;
  if (!url) {
    console.error("❌ CRITICAL: EMAIL_SERVICE_URL is missing in .env file!");
    return null; 
  }
  return url;
};

// --- TEMPLATE GENERATOR ---
const generateEmailHTML = (
  title: string, 
  bodyContent: string, 
  accentColor: string = BRAND_COLORS.wine,
  emoji: string = ""
) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background: #F3F4F6; font-family: sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <div style="background: ${accentColor}; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 2px;">CHOWEAZY</h1>
        </div>

        <div style="padding: 40px 30px; text-align: center; color: #374151;">
          ${emoji ? `<div style="font-size: 48px; margin-bottom: 20px;">${emoji}</div>` : ''}
          <h2 style="color: ${accentColor}; margin-top: 0;">${title}</h2>
          <div style="font-size: 16px; line-height: 1.6; margin-top: 20px;">
            ${bodyContent}
          </div>
        </div>

        <div style="background: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB; font-size: 12px; color: #9CA3AF;">
          <p>© ${new Date().getFullYear()} ChowEazy. Good Food, Delivered.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ... (Keep existing sendOtPEmail, sendLoginAlertEmail, sendOrderStatusEmail, sendPayoutRequestEmail) ...

export async function sendOtPEmail(email: string, otp: string) {
  const url = getEmailServiceUrl();
  if (!url) return;

  try {
    const html = generateEmailHTML("Your Login Code", `
      <p>Use the code below to complete your login/verification.</p>
      <div style="margin: 30px 0;">
        <span style="background: #FFF1F0; color: ${BRAND_COLORS.wine}; font-size: 32px; font-weight: bold; padding: 12px 24px; border-radius: 8px; letter-spacing: 5px;">
          ${otp}
        </span>
      </div>
      <p>This code expires in 10 minutes.</p>
    `, BRAND_COLORS.wine, "🔐");

    await axios.post(url, { to: email, subject: "🔐 Your ChowEazy Code", html });
    console.log(`✅ OTP sent to ${email}`);
  } catch (err: any) {
    console.error("❌ OTP Email Failed:", err.message);
  }
}

export async function sendLoginAlertEmail(email: string, name: string) {
  const url = getEmailServiceUrl();
  if (!url) return;

  try {
    const html = generateEmailHTML("New Login Detected", `
      <p>Hi <b>${name}</b>,</p>
      <p>We noticed a new login to your ChowEazy account just now.</p>
      <div style="background: #EFF6FF; padding: 15px; border-radius: 8px; margin: 20px 0; color: #1E40AF; font-size: 14px;">
        <strong>Device:</strong> Web/Mobile App<br/>
        <strong>Time:</strong> ${new Date().toLocaleString()}
      </div>
      <p>If this was you, you can ignore this email. If not, please reset your password immediately.</p>
    `, BRAND_COLORS.info, "🛡️");

    await axios.post(url, { to: email, subject: "New Login to ChowEazy", html });
    console.log(`✅ Login Alert sent to ${email}`);
  } catch (err: any) {
    console.error("❌ Login Email Failed:", err.message);
  }
}

export async function sendOrderStatusEmail(email: string, name: string, orderId: string, status: string) {
  const url = getEmailServiceUrl();
  if (!url) return;

  try {
    const shortId = orderId.slice(0, 6).toUpperCase();
    let title = "", message = "", color = BRAND_COLORS.wine, emoji = "📦";

    switch (status) {
      case "PENDING":
        title = "Order Placed! 📝";
        message = `Hi <b>${name}</b>, thanks for ordering! We've received order <b>#${shortId}</b>. Once verified, the restaurant will start cooking.`;
        color = BRAND_COLORS.wine;
        break;
      case "PREPARING":
        title = "Order Accepted! 🔥";
        message = `Good news <b>${name}</b>! The restaurant has accepted order <b>#${shortId}</b> and is cooking it right now.`;
        color = BRAND_COLORS.warning;
        emoji = "👨‍🍳";
        break;
      case "OUT_FOR_DELIVERY":
        title = "Rider is on the way! 🚴";
        message = `Your food is moving! A rider has picked up order <b>#${shortId}</b> and is heading to you.`;
        color = BRAND_COLORS.success;
        emoji = "🚀";
        break;
      case "DELIVERED":
        title = "Order Delivered 😋";
        message = `Enjoy your meal, <b>${name}</b>! Your order <b>#${shortId}</b> has been delivered.`;
        color = BRAND_COLORS.success;
        emoji = "✅";
        break;
      case "CANCELLED":
        title = "Order Cancelled ❌";
        message = `Hi <b>${name}</b>, we're sorry. Order <b>#${shortId}</b> was cancelled. A refund has been processed if you paid online.`;
        color = BRAND_COLORS.danger;
        emoji = "😔";
        break;
    }

    const html = generateEmailHTML(title, message, color, emoji);
    await axios.post(url, { to: email, subject: `Order #${shortId}: ${title}`, html });
    console.log(`✅ Order Email (${status}) sent to ${email}`);
  } catch (err: any) {
    console.error(`❌ Order Email Failed (${status}):`, err.message);
  }
}

export async function sendPayoutRequestEmail(email: string, name: string, amount: number, bankName: string) {
  const url = getEmailServiceUrl();
  if (!url) return;

  try {
    const title = "Withdrawal Request Received 💸";
    const body = `
      <p>Hi <b>${name}</b>,</p>
      <p>We have received your request to withdraw funds.</p>
      
      <div style="background: #FFFBEB; border: 1px solid #FCD34D; padding: 20px; border-radius: 8px; margin: 20px 0; color: #92400E;">
        <div style="font-size: 14px; margin-bottom: 5px;">Amount Requested:</div>
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">₦${amount.toLocaleString()}</div>
        <div style="font-size: 14px;">Destination: <b>${bankName}</b></div>
      </div>

      <p><b>What happens next?</b><br/>
      Our team will review your request. Funds are typically processed within 24 hours.</p>
    `;

    const html = generateEmailHTML(title, body, BRAND_COLORS.warning, "🏦"); 

    await axios.post(url, { to: email, subject: "Withdrawal Request Received", html });
    console.log(`✅ Payout Email sent to ${email}`);
  } catch (err: any) {
    console.error("❌ Payout Email Failed:", err.message);
  }
}

// ✅ NEW: SEND DELIVERY CODE (CONSISTENT STYLE)
export async function sendDeliveryCode(email: string, code: string, orderId: string) {
  const url = getEmailServiceUrl();
  if (!url) return;

  try {
    const title = "Your Secret Delivery Code 🤫";
    const body = `
      <p>Your order <b>#${orderId.slice(-4)}</b> is confirmed!</p>
      <p>When the rider arrives, they will ask for this code. Do NOT share it until you have your food.</p>
      
      <div style="background: #EEF2FF; border: 1px solid #C7D2FE; padding: 25px; border-radius: 12px; margin: 25px 0; color: #3730A3;">
        <div style="font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; margin-bottom: 8px;">Delivery Code</div>
        <div style="font-size: 42px; font-weight: 800; letter-spacing: 8px;">${code}</div>
      </div>

      <p style="font-size: 13px; color: #6B7280;">Only the correct rider can complete the order with this code.</p>
    `;

    const html = generateEmailHTML(title, body, BRAND_COLORS.indigo, "🔑");

    await axios.post(url, { to: email, subject: `🔑 Delivery Code: ${code}`, html });
    console.log(`✅ Delivery Code sent to ${email}`);
  } catch (err: any) {
    console.error("❌ Delivery Code Email Failed:", err.message);
  }
}