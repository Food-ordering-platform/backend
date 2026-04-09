"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtPEmail = sendOtPEmail;
exports.sendLoginAlertEmail = sendLoginAlertEmail;
exports.sendOrderStatusEmail = sendOrderStatusEmail;
exports.sendDeliveryCode = sendDeliveryCode;
exports.sendAdminPayoutAlert = sendAdminPayoutAlert;
exports.sendPayoutRequestEmail = sendPayoutRequestEmail;
exports.sendRestaurantVerificationPendingEmail = sendRestaurantVerificationPendingEmail;
exports.sendRiderVerificationPendingEmail = sendRiderVerificationPendingEmail;
const mailer_1 = require("./mailer");
const templates_1 = require("./templates");
// --- OTP EMAIL ---
async function sendOtPEmail(email, otp) {
    console.log(`[EmailService] Preparing OTP email for: ${email}`); // <--- LOG
    try {
        const html = (0, templates_1.generateEmailHTML)("Your Login Code", `
        <p>Use the code below to complete your login or verification.</p>
        <div style="margin: 30px 0;">
          <span style="background:#FFF1F0;color:#7b1e3a;font-size:32px;font-weight:bold;padding:12px 24px;border-radius:8px;letter-spacing:5px;border:2px dashed #7b1e3a;">
            ${otp}
          </span>
        </div>
        <p>This code expires in 10 minutes. If you didn’t request this, ignore this email.</p>
      `, "🔐");
        await (0, mailer_1.sendEmail)({
            to: email,
            subject: "🔐 Your ChowEazy Code",
            html,
        });
    }
    catch (err) {
        console.error("❌ OTP Email Failed in Service:", err.message);
    }
}
// --- LOGIN ALERT ---
async function sendLoginAlertEmail(email, name) {
    console.log(`[EmailService] Preparing Login Alert for: ${email}`); // <--- LOG
    try {
        const html = (0, templates_1.generateEmailHTML)("New Login Detected", `
        <p>Hi <b>${name}</b>,</p>
        <p>We noticed a new login to your ChowEazy account.</p>

        <div style="background:#F3F4F6;padding:20px;border-radius:8px;margin:20px 0;text-align:left;display:inline-block;">
          <div>⏰ <b>Time:</b> ${new Date().toLocaleString()}</div>
        </div>

        <p>If this was you, you can safely ignore this email.</p>
        <p style="color:#EF4444;font-weight:bold;">If this wasn’t you, please contact support immediately.</p>
      `, "🛡️");
        await (0, mailer_1.sendEmail)({
            to: email,
            subject: "⚠️ New Login to ChowEazy",
            html,
        });
    }
    catch (err) {
        console.error("❌ Login Alert Email Failed:", err.message);
    }
}
// --- ORDER STATUS EMAIL ---
// --- ORDER STATUS EMAIL ---
async function sendOrderStatusEmail(email, name, orderReference, status) {
    console.log(`[EmailService] Preparing Order Status (${status}) for: ${email}`);
    try {
        const displayRef = orderReference.toUpperCase();
        let title = "";
        let message = "";
        let emoji = "📦";
        switch (status) {
            case "PENDING":
                title = "Order Placed";
                message = `Hi <b>${name}</b>, we’ve received your order <b>#${displayRef}</b>. We’re waiting for the restaurant to confirm it.`;
                emoji = "📝";
                break;
            case "PREPARING":
                title = "Order Accepted";
                message = `Great news <b>${name}</b>! The restaurant has accepted order <b>#${displayRef}</b> and is cooking your food.`;
                emoji = "👨‍🍳";
                break;
            case "READY_FOR_PICKUP":
                title = "Food is Ready";
                message = `Your order <b>#${displayRef}</b> is packed and ready at the restaurant. We are assigning a rider right now.`;
                emoji = "🛍️";
                break;
            // ✅ 1. Rider has accepted the order
            case "RIDER_ACCEPTED":
                title = "Rider Assigned 🛵";
                message = `Good news! A rider has accepted your order <b>#${displayRef}</b> and is heading to the restaurant to pick it up.`;
                emoji = "🛵";
                break;
            // ✅ 2. Rider has picked up the food from the vendor
            case "OUT_FOR_DELIVERY":
                title = "Out for Delivery 🚴";
                message = `Your rider has picked up your food from the restaurant! Order <b>#${displayRef}</b> is now on its way to your location.`;
                emoji = "🚴";
                break;
            // ✅ 3. Order has been delivered to the customer
            case "DELIVERED":
                title = "Order Delivered 🎉";
                message = `Yay! Your order <b>#${displayRef}</b> has been delivered successfully. Enjoy your meal, <b>${name}</b>!`;
                emoji = "😋";
                break;
            case "CANCELLED":
                title = "Order Cancelled";
                message = `Hi <b>${name}</b>, order <b>#${displayRef}</b> was cancelled. If you paid online, a refund is being processed.`;
                emoji = "❌";
                break;
            case "REFUNDED":
                title = "Refund Processed";
                message = `We’ve processed a refund for order <b>#${displayRef}</b>. It should reflect in your account shortly.`;
                emoji = "💸";
                break;
            default:
                console.warn(`[EmailService] Unknown status skipped: ${status}`);
                return;
        }
        const html = (0, templates_1.generateEmailHTML)(title, message, emoji);
        await (0, mailer_1.sendEmail)({
            to: email,
            subject: `Order #${displayRef}: ${title}`,
            html,
        });
    }
    catch (err) {
        console.error(`❌ Order Email Failed (${status}):`, err.message);
    }
}
// --- DELIVERY CODE ---
async function sendDeliveryCode(email, code, orderReference) {
    console.log(`[EmailService] Sending Delivery Code to: ${email}`); // <--- LOG
    try {
        const displayRef = orderReference.toUpperCase();
        const html = (0, templates_1.generateEmailHTML)("Your Delivery Code", `
        <p>Your order <b>#${displayRef}</b> is on track.</p>
        <p>Please give this code to the rider <b>ONLY</b> when you receive your food.</p>

        <div style="background:#F9FAFB;border:1px solid #E5E7EB;padding:25px;border-radius:12px;margin:25px 0;">
          <div style="font-size:12px;text-transform:uppercase;font-weight:bold;letter-spacing:1px;margin-bottom:8px;">Delivery Code</div>
          <div style="font-size:42px;font-weight:800;letter-spacing:8px;color:#7b1e3a;">${code}</div>
        </div>
      `, "🔑");
        await (0, mailer_1.sendEmail)({
            to: email,
            subject: `🔑 Delivery Code: ${code}`,
            html,
        });
    }
    catch (err) {
        console.error("❌ Delivery Code Email Failed:", err.message);
    }
}
// --- ADMIN PAYOUT ALERT ---
// --- ADMIN PAYOUT ALERT ---
async function sendAdminPayoutAlert(requesterName, // Changed from vendorName to be generic (Vendor or Rider)
amount, bankDetails) {
    // 🟢 Fix: Fallback directly to admin@choweazy.com if env var is missing
    const adminEmail = process.env.ADMIN_EMAIL || "admin@choweazy.com";
    console.log(`[EmailService] Sending Admin Payout Alert. Admin Email: ${adminEmail}`);
    try {
        const html = (0, templates_1.generateEmailHTML)("New Payout Request", `
        <p><b>Requester:</b> ${requesterName}</p>

        <div style="background:#FFF1F0;padding:15px;border-radius:8px;border:1px solid #7b1e3a;margin:20px 0;">
          <div style="font-size:24px;font-weight:bold;color:#7b1e3a;">
            ₦${amount.toLocaleString()}
          </div>
        </div>

        <p>
          <b>Bank:</b> ${bankDetails.bankName}<br/>
          <b>Acct:</b> ${bankDetails.accountNumber}<br/>
          <b>Name:</b> ${bankDetails.accountName || "Not Provided"}
        </p>

        <p style="margin-top: 20px;">
          Please log in to your <a href="https://admin.choweazy.com" style="color:#7b1e3a; font-weight:bold;">Admin Dashboard</a> to manually transfer the funds and mark the request as Paid.
        </p>
      `, "💰");
        await (0, mailer_1.sendEmail)({
            to: adminEmail,
            subject: `💰 Action Required: Payout Request from ${requesterName}`,
            html,
        });
        console.log(`✅ Admin Payout Alert sent to ${adminEmail}`);
    }
    catch (err) {
        console.error("❌ Admin Alert Failed:", err.message);
    }
}
// --- PAYOUT REQUEST (VENDOR/RIDER) ---
/**
 * Notifies the user that their manual withdrawal request is being processed.
 */
async function sendPayoutRequestEmail({ email, ownerName, restaurantName, amount, bankName, accountNumber }) {
    console.log(`[EmailService] Sending Withdrawal Processing Email to: ${email}`);
    try {
        const html = (0, templates_1.generateEmailHTML)("Withdrawal Processing", `
        <p>Hi <b>${ownerName}</b> (${restaurantName}),</p>
        <p>Your request to withdraw funds from your ChowEazy wallet has been received and is currently being processed.</p>

        <div style="background:#F9FAFB; border: 1px solid #E5E7EB; padding:20px; border-radius:12px; margin:20px 0;">
          <div style="font-size:12px; text-transform:uppercase; font-weight:bold; color:#6B7280; margin-bottom:4px;">Amount Requested</div>
          <div style="font-size:28px; font-weight:bold; color:#7b1e3a;">₦${amount.toLocaleString()}</div>
          <hr style="border:0; border-top:1px solid #E5E7EB; margin:15px 0;" />
          <div style="font-size:14px; color:#374151; margin-bottom:5px;"><b>Bank:</b> ${bankName}</div>
          <div style="font-size:14px; color:#374151;"><b>Account:</b> ${accountNumber}</div>
          <div style="font-size:12px; color:#6B7280; margin-top:10px;">Status: <span style="color:#D97706; font-weight:bold;">Pending Verification</span></div>
        </div>

        <p>Our finance team will verify the details and complete the transfer within 24-48 business hours.</p>
        <p>Thank you for choosing ChowEazy!</p>
      `, "🏦");
        await (0, mailer_1.sendEmail)({
            to: email,
            subject: "🏦 Withdrawal Request in Progress - ChowEazy",
            html,
        });
    }
    catch (err) {
        console.error("❌ Payout Processing Email Failed:", err.message);
    }
}
// --- RESTAURANT VERIFICATION PENDING ---
async function sendRestaurantVerificationPendingEmail(email, restaurantName) {
    console.log(`[EmailService] Sending Verification Pending Email to: ${email}`);
    try {
        const html = (0, templates_1.generateEmailHTML)("Verification Pending ⏳", `
        <p>Thanks, <b>${restaurantName}</b>! We've received your application.</p>
        
        <div style="background:#FFFBEB; border: 1px solid #FEF3C7; padding:20px; border-radius:12px; margin:20px 0;">
          <div style="font-size:16px; color:#92400E; line-height: 1.5;">
            To ensure quality on ChowEazy, our team manually reviews every new vendor. 
            This usually takes <b style="color:#B45309;">24-48 hours</b>.
          </div>
        </div>

        <p>You will receive an email once your restaurant is approved and live on the platform.</p>
        <p>If you have any questions in the meantime, feel free to reply to this email or contact support.</p>
      `, "🏪");
        await (0, mailer_1.sendEmail)({
            to: email,
            subject: "⏳ Application Received - Under Review",
            html,
        });
    }
    catch (err) {
        console.error("❌ Verification Pending Email Failed:", err.message);
    }
}
// --- RIDER VERIFICATION PENDING ---
async function sendRiderVerificationPendingEmail(email, riderName) {
    console.log(`[EmailService] Sending Rider Verification Pending Email to: ${email}`);
    try {
        const html = (0, templates_1.generateEmailHTML)("Application Under Review ⏳", `
        <p>Welcome to the ChowEazy fleet, <b>${riderName}</b>!</p>
        
        <div style="background:#FFFBEB; border: 1px solid #FEF3C7; padding:20px; border-radius:12px; margin:20px 0;">
          <div style="font-size:16px; color:#92400E; line-height: 1.5;">
            To ensure the safety of our customers, our admin team must manually verify all rider applications. 
            This process usually takes <b style="color:#B45309;">24-48 hours</b>.
          </div>
        </div>

        <p>In the meantime, please complete your email verification using the OTP sent to you.</p>
        <p>You will receive another email as soon as your account is approved and activated!</p>
      `, "🛵");
        await (0, mailer_1.sendEmail)({
            to: email,
            subject: "⏳ Rider Application Received",
            html,
        });
    }
    catch (err) {
        console.error("❌ Rider Verification Pending Email Failed:", err.message);
    }
}
//# sourceMappingURL=email.service.js.map