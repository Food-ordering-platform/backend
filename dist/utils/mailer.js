"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtPEmail = sendOtPEmail;
exports.sendLoginAlertEmail = sendLoginAlertEmail;
exports.sendOrderStatusEmail = sendOrderStatusEmail;
exports.sendDeliveryCode = sendDeliveryCode;
exports.sendPayoutRequestEmail = sendPayoutRequestEmail;
exports.sendAdminPayoutAlert = sendAdminPayoutAlert;
const axios_1 = __importDefault(require("axios"));
// --- BRAND COLORS ---
const BRAND_COLORS = {
    wine: "#7b1e3a",
    wineDark: "#5a162b",
    text: "#374151",
    bg: "#F9FAFB"
};
// --- CONFIG ---
const FRONTEND_URL = process.env.FRONTEND_URL || "https://choweazy.vercel.app";
// Use PNG for best email client support
const LOGO_URL = `${FRONTEND_URL}/official_logo.png`;
const getEmailServiceUrl = () => {
    const url = process.env.EMAIL_SERVICE_URL;
    if (!url) {
        console.error("❌ CRITICAL: EMAIL_SERVICE_URL is missing in .env file!");
        return null;
    }
    return url;
};
// --- TEMPLATE GENERATOR ---
const generateEmailHTML = (title, bodyContent, emoji = "") => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background: ${BRAND_COLORS.bg}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        
        <div style="background: ${BRAND_COLORS.wine}; padding: 30px; text-align: center;">
          <img 
            src="${LOGO_URL}" 
            alt="ChowEazy" 
            width="150" 
            height="auto"
            style="display: block; width: 150px; max-width: 100%; height: auto; margin: 0 auto; border: 0;" 
          />
        </div>

        <div style="padding: 40px 30px; text-align: center; color: ${BRAND_COLORS.text};">
          ${emoji ? `<div style="font-size: 48px; margin-bottom: 20px;">${emoji}</div>` : ''}
          <h2 style="color: ${BRAND_COLORS.wine}; margin-top: 0; font-size: 24px; font-weight: 800;">${title}</h2>
          <div style="font-size: 16px; line-height: 1.6; margin-top: 20px;">
            ${bodyContent}
          </div>
        </div>

        <div style="background: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB; font-size: 12px; color: #9CA3AF;">
          <p style="margin: 0;">© ${new Date().getFullYear()} ChowEazy. Good Food, Delivered.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
// --- EMAIL FUNCTIONS ---
async function sendOtPEmail(email, otp) {
    const url = getEmailServiceUrl();
    if (!url)
        return;
    try {
        const html = generateEmailHTML("Your Login Code", `
      <p>Use the code below to complete your login or verification.</p>
      <div style="margin: 30px 0;">
        <span style="background: #FFF1F0; color: ${BRAND_COLORS.wine}; font-size: 32px; font-weight: bold; padding: 12px 24px; border-radius: 8px; letter-spacing: 5px; border: 2px dashed ${BRAND_COLORS.wine};">
          ${otp}
        </span>
      </div>
      <p>This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
    `, "🔐");
        await axios_1.default.post(url, { to: email, subject: "🔐 Your ChowEazy Code", html });
    }
    catch (err) {
        console.error("❌ OTP Email Failed:", err.message);
    }
}
async function sendLoginAlertEmail(email, name) {
    const url = getEmailServiceUrl();
    if (!url)
        return;
    try {
        const title = "New Login Detected";
        const body = `
      <p>Hi <b>${name}</b>,</p>
      <p>We noticed a new login to your ChowEazy account.</p>
      
      <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; display: inline-block;">
        <div>⏰ <b>Time:</b> ${new Date().toLocaleString()}</div>
      </div>

      <p>If this was you, you can safely ignore this email.</p>
      <p style="color: #EF4444; font-weight: bold;">If this wasn't you, please contact support immediately.</p>
    `;
        const html = generateEmailHTML(title, body, "🛡️");
        await axios_1.default.post(url, { to: email, subject: "⚠️ New Login to ChowEazy", html });
    }
    catch (err) {
        console.error("❌ Login Alert Email Failed:", err.message);
    }
}
// ✅ FIX: Now accepts 'orderReference' specifically
async function sendOrderStatusEmail(email, name, orderReference, status) {
    const url = getEmailServiceUrl();
    if (!url)
        return;
    try {
        // We use the ACTUAL database reference here
        const displayRef = orderReference.toUpperCase();
        let title = "";
        let message = "";
        let emoji = "📦";
        switch (status) {
            case "PENDING":
                title = "Order Placed";
                message = `Hi <b>${name}</b>, we've received your order <b>#${displayRef}</b>. We are waiting for the restaurant to confirm it.`;
                emoji = "📝";
                break;
            case "PREPARING":
                title = "Order Accepted";
                message = `Great news <b>${name}</b>! The restaurant has accepted order <b>#${displayRef}</b> and is cooking your food now.`;
                emoji = "👨‍🍳";
                break;
            case "READY_FOR_PICKUP":
                title = "Food is Ready";
                message = `Your order <b>#${displayRef}</b> is packed and ready! We are assigning a rider to pick it up shortly.`;
                emoji = "🛍️";
                break;
            case "OUT_FOR_DELIVERY":
                title = "Rider is on the way";
                message = `Your food is moving! A rider has picked up order <b>#${displayRef}</b> and is heading to your location.`;
                emoji = "🚴";
                break;
            case "DELIVERED":
                title = "Order Delivered";
                message = `Enjoy your meal, <b>${name}</b>! Your order <b>#${displayRef}</b> has been delivered. Thanks for using ChowEazy!`;
                emoji = "😋";
                break;
            case "CANCELLED":
                title = "Order Cancelled";
                message = `Hi <b>${name}</b>, we're sorry. Order <b>#${displayRef}</b> was cancelled. If you paid online, a refund is being processed.`;
                emoji = "❌";
                break;
            case "REFUNDED":
                title = "Refund Processed";
                message = `We have processed a refund for order <b>#${displayRef}</b>. It should appear in your account shortly.`;
                emoji = "💸";
                break;
            default:
                return;
        }
        const html = generateEmailHTML(title, message, emoji);
        await axios_1.default.post(url, { to: email, subject: `Order #${displayRef}: ${title}`, html });
        console.log(`✅ Order Email (${status}) sent to ${email}`);
    }
    catch (err) {
        console.error(`❌ Order Email Failed (${status}):`, err.message);
    }
}
// ✅ FIX: Now accepts 'orderReference'
async function sendDeliveryCode(email, code, orderReference) {
    const url = getEmailServiceUrl();
    if (!url)
        return;
    try {
        const displayRef = orderReference.toUpperCase();
        const title = "Your Delivery Code";
        const body = `
      <p>Your order <b>#${displayRef}</b> is on track!</p>
      <p>Please give this code to the rider <b>ONLY</b> when you receive your food.</p>
      
      <div style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 25px; border-radius: 12px; margin: 25px 0;">
        <div style="font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; margin-bottom: 8px; color: ${BRAND_COLORS.text};">Delivery Code</div>
        <div style="font-size: 42px; font-weight: 800; letter-spacing: 8px; color: ${BRAND_COLORS.wine};">${code}</div>
      </div>
    `;
        const html = generateEmailHTML(title, body, "🔑");
        await axios_1.default.post(url, { to: email, subject: `🔑 Delivery Code: ${code}`, html });
    }
    catch (err) {
        console.error("❌ Delivery Code Email Failed:", err.message);
    }
}
async function sendPayoutRequestEmail(email, name, amount, bankName) {
    const url = getEmailServiceUrl();
    if (!url)
        return;
    try {
        const title = "Withdrawal Request";
        const body = `
        <p>Hi <b>${name}</b>,</p>
        <p>We have received your request to withdraw funds.</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="font-size: 14px; margin-bottom: 5px;">Amount Requested:</div>
          <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px; color: ${BRAND_COLORS.wine};">₦${amount.toLocaleString()}</div>
          <div style="font-size: 14px;">Destination: <b>${bankName}</b></div>
        </div>
  
        <p>Our team will review your request shortly.</p>
      `;
        const html = generateEmailHTML(title, body, "🏦");
        await axios_1.default.post(url, { to: email, subject: "Withdrawal Request Received", html });
    }
    catch (err) {
        console.error("❌ Payout Email Failed:", err.message);
    }
}
// ... existing imports
async function sendAdminPayoutAlert(vendorName, amount, bankDetails) {
    const url = process.env.EMAIL_SERVICE_URL; // Or use strict getEmailServiceUrl()
    const adminEmail = process.env.ADMIN_EMAIL; // Add this to your .env
    if (!url || !adminEmail)
        return;
    try {
        const title = "🔔 New Payout Request";
        const body = `
      <p><b>Vendor:</b> ${vendorName}</p>
      <div style="background: #FFF1F0; padding: 15px; border-radius: 8px; border: 1px solid #7b1e3a;">
        <div style="font-size: 20px; font-weight: bold; color: #7b1e3a;">₦${amount.toLocaleString()}</div>
      </div>
      <p><b>Bank:</b> ${bankDetails.bankName}<br/>
      <b>Acct:</b> ${bankDetails.accountNumber}<br/>
      <b>Name:</b> ${bankDetails.accountName}</p>
      
      <p>Please log in to the admin dashboard to approve/reject.</p>
    `;
        const html = generateEmailHTML(title, body, "💰");
        await axios_1.default.post(url, { to: adminEmail, subject: `Payout Request: ${vendorName}`, html });
        console.log(`✅ Admin Alert sent to ${adminEmail}`);
    }
    catch (err) {
        console.error("❌ Admin Alert Failed:", err.message);
    }
}
//# sourceMappingURL=mailer.js.map