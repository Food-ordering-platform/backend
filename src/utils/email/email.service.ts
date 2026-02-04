import { sendEmail } from "./mailer";
import { generateEmailHTML } from "./templates";

// --- OTP EMAIL ---
export async function sendOtPEmail(email: string, otp: string) {
  try {
    const html = generateEmailHTML(
      "Your Login Code",
      `
        <p>Use the code below to complete your login or verification.</p>
        <div style="margin: 30px 0;">
          <span style="background:#FFF1F0;color:#7b1e3a;font-size:32px;font-weight:bold;padding:12px 24px;border-radius:8px;letter-spacing:5px;border:2px dashed #7b1e3a;">
            ${otp}
          </span>
        </div>
        <p>This code expires in 10 minutes. If you didn’t request this, ignore this email.</p>
      `,
      "🔐"
    );

    await sendEmail({
      to: email,
      subject: "🔐 Your ChowEazy Code",
      html,
    });
  } catch (err: any) {
    console.error("❌ OTP Email Failed:", err.message);
  }
}

// --- LOGIN ALERT ---
export async function sendLoginAlertEmail(email: string, name: string) {
  try {
    const html = generateEmailHTML(
      "New Login Detected",
      `
        <p>Hi <b>${name}</b>,</p>
        <p>We noticed a new login to your ChowEazy account.</p>

        <div style="background:#F3F4F6;padding:20px;border-radius:8px;margin:20px 0;text-align:left;display:inline-block;">
          <div>⏰ <b>Time:</b> ${new Date().toLocaleString()}</div>
        </div>

        <p>If this was you, you can safely ignore this email.</p>
        <p style="color:#EF4444;font-weight:bold;">If this wasn’t you, please contact support immediately.</p>
      `,
      "🛡️"
    );

    await sendEmail({
      to: email,
      subject: "⚠️ New Login to ChowEazy",
      html,
    });
  } catch (err: any) {
    console.error("❌ Login Alert Email Failed:", err.message);
  }
}

// --- ORDER STATUS EMAIL ---
export async function sendOrderStatusEmail(
  email: string,
  name: string,
  orderReference: string,
  status: string
) {
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
        message = `Your order <b>#${displayRef}</b> is packed and ready. A rider will be notified shortly.`;
        emoji = "🛍️";
        break;

      case "RIDER_ACCEPTED":
        title = "Food is Ready";
        message = `Your order <b>#${displayRef}</b> has been accepted by a rider and will soon be out for delivery.`;
        emoji = "🛍️";
        break;

      case "OUT_FOR_DELIVERY":
        title = "Rider is on the way";
        message = `Your food is on the move! Order <b>#${displayRef}</b> is heading to you.`;
        emoji = "🚴";
        break;

      case "DELIVERED":
        title = "Order Delivered";
        message = `Enjoy your meal <b>${name}</b>! Order <b>#${displayRef}</b> has been delivered.`;
        emoji = "😋";
        break;

      case "CANCELLED":
        title = "Order Cancelled";
        message = `Hi <b>${name}</b>, order <b>#${displayRef}</b> was cancelled. If you paid online, a refund is being processed.`;
        emoji = "❌";
        break;

      case "REFUNDED":
        title = "Refund Processed";
        message = `We’ve processed a refund for order <b>#${displayRef}</b>. It should reflect shortly.`;
        emoji = "💸";
        break;

      default:
        return;
    }

    const html = generateEmailHTML(title, message, emoji);

    await sendEmail({
      to: email,
      subject: `Order #${displayRef}: ${title}`,
      html,
    });

    console.log(`✅ Order Email (${status}) sent to ${email}`);
  } catch (err: any) {
    console.error(`❌ Order Email Failed (${status}):`, err.message);
  }
}

// --- DELIVERY CODE ---
export async function sendDeliveryCode(
  email: string,
  code: string,
  orderReference: string
) {
  try {
    const displayRef = orderReference.toUpperCase();

    const html = generateEmailHTML(
      "Your Delivery Code",
      `
        <p>Your order <b>#${displayRef}</b> is on track.</p>
        <p>Please give this code to the rider <b>ONLY</b> when you receive your food.</p>

        <div style="background:#F9FAFB;border:1px solid #E5E7EB;padding:25px;border-radius:12px;margin:25px 0;">
          <div style="font-size:12px;text-transform:uppercase;font-weight:bold;letter-spacing:1px;margin-bottom:8px;">Delivery Code</div>
          <div style="font-size:42px;font-weight:800;letter-spacing:8px;color:#7b1e3a;">${code}</div>
        </div>
      `,
      "🔑"
    );

    await sendEmail({
      to: email,
      subject: `🔑 Delivery Code: ${code}`,
      html,
    });
  } catch (err: any) {
    console.error("❌ Delivery Code Email Failed:", err.message);
  }
}

// --- PAYOUT REQUEST (USER) ---
export async function sendPayoutRequestEmail(
  email: string,
  name: string,
  amount: number,
  bankName: string
) {
  try {
    const html = generateEmailHTML(
      "Withdrawal Request",
      `
        <p>Hi <b>${name}</b>,</p>
        <p>We have received your request to withdraw funds.</p>

        <div style="background:#F3F4F6;padding:20px;border-radius:8px;margin:20px 0;">
          <div>Amount Requested:</div>
          <div style="font-size:24px;font-weight:bold;color:#7b1e3a;">₦${amount.toLocaleString()}</div>
          <div>Destination: <b>${bankName}</b></div>
        </div>

        <p>Our team will review your request shortly.</p>
      `,
      "🏦"
    );

    await sendEmail({
      to: email,
      subject: "Withdrawal Request Received",
      html,
    });
  } catch (err: any) {
    console.error("❌ Payout Email Failed:", err.message);
  }
}

// --- ADMIN PAYOUT ALERT ---
export async function sendAdminPayoutAlert(
  vendorName: string,
  amount: number,
  bankDetails: any
) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  try {
    const html = generateEmailHTML(
      "New Payout Request",
      `
        <p><b>Vendor:</b> ${vendorName}</p>

        <div style="background:#FFF1F0;padding:15px;border-radius:8px;border:1px solid #7b1e3a;">
          <div style="font-size:20px;font-weight:bold;color:#7b1e3a;">
            ₦${amount.toLocaleString()}
          </div>
        </div>

        <p>
          <b>Bank:</b> ${bankDetails.bankName}<br/>
          <b>Acct:</b> ${bankDetails.accountNumber}<br/>
          <b>Name:</b> ${bankDetails.accountName}
        </p>

        <p>Please log in to the admin dashboard to approve or reject.</p>
      `,
      "💰"
    );

    await sendEmail({
      to: adminEmail,
      subject: `Payout Request: ${vendorName}`,
      html,
    });

    console.log(`✅ Admin Payout Alert sent`);
  } catch (err: any) {
    console.error("❌ Admin Alert Failed:", err.message);
  }
}
