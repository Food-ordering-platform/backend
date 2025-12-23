import axios from "axios";

// --- 1. SHARED EMAIL TEMPLATE GENERATOR ---
const generateEmailHTML = (title: string, bodyContent: string, accentColor: string = "#FF4B3A") => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; margin-top: 40px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <div style="background-color: ${accentColor}; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px;">CHOWEAZY</h1>
        </div>

        <div style="padding: 40px 30px; text-align: center;">
          <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 700;">${title}</h2>
          
          <div style="color: #4B5563; font-size: 16px; line-height: 24px; margin-top: 16px;">
            ${bodyContent}
          </div>
        </div>

        <div style="background-color: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} ChowEazy. Good Food, Delivered.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// --- 2. BEAUTIFUL OTP EMAIL ---
export async function sendOtPEmail(email: string, otp: string) {
  try {
    const htmlContent = generateEmailHTML(
      "Verify Your Login",
      `
        <p>Use the code below to complete your login. This code expires in 10 minutes.</p>
        
        <div style="margin: 30px 0;">
          <span style="background-color: #FFF1F0; color: #FF4B3A; font-size: 32px; font-weight: bold; padding: 12px 24px; border-radius: 8px; letter-spacing: 5px;">
            ${otp}
          </span>
        </div>
        
        <p>If you didn't request this, please ignore this email.</p>
      `
    );

    const response = await axios.post(
      process.env.EMAIL_SERVICE_URL!, 
      {
        to: email,
        subject: "Your ChowEazy OTP",
        html: htmlContent,
      }
    );

    console.log("OTP email sent successfully");
    return response.data;
  } catch (err: any) {
    console.error("Error sending OTP email:", err.message);
    throw new Error("OTP email failed");
  }
}

// --- 3. BEAUTIFUL ORDER STATUS EMAIL ---
export async function sendOrderStatusEmail(email: string, name: string, orderId: string, status: string) {
  try {
    const shortId = orderId.slice(0, 6).toUpperCase();
    let title = "";
    let message = "";
    let color = "#FF4B3A"; // Default Primary

    switch (status) {
      case "PREPARING":
        title = "Order Accepted! 🔥";
        message = `Hi <b>${name}</b>, great news! The restaurant has accepted your order <b>#${shortId}</b> and is cooking it right now.`;
        color = "#F59E0B"; // Amber/Orange
        break;

      case "OUT_FOR_DELIVERY":
        title = "Rider is on the way! 🚴";
        message = `Hi <b>${name}</b>, your food is on the move! Our rider has picked up order <b>#${shortId}</b> and is heading to you.`;
        color = "#10B981"; // Emerald Green
        break;

      case "DELIVERED":
        title = "Order Delivered 😋";
        message = `Hi <b>${name}</b>, your order <b>#${shortId}</b> has been delivered. Enjoy your meal!`;
        color = "#10B981"; // Emerald Green
        break;

      case "CANCELLED":
        title = "Order Cancelled ❌";
        message = `Hi <b>${name}</b>, we're sorry. Your order <b>#${shortId}</b> was cancelled by the restaurant. A full refund has been processed.`;
        color = "#EF4444"; // Red
        break;

      default:
        title = "Order Update";
        message = `Hi <b>${name}</b>, the status of order <b>#${shortId}</b> is now: <b>${status}</b>.`;
    }

    const htmlContent = generateEmailHTML(title, message, color);

    await axios.post(
      process.env.EMAIL_SERVICE_URL!, 
      {
        to: email,
        subject: `Order Update: #${shortId}`,
        html: htmlContent,
      }
    );
    console.log(`Order email sent to ${email} for status ${status}`);
  } catch (err: any) {
    console.error("Failed to send order email:", err.message);
  }
}