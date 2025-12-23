import axios from "axios";

// --- BRAND COLORS ---
const BRAND_COLORS = {
  wine: "#8B1538",        // Deep wine/burgundy
  wineLight: "#A91D47",   // Lighter wine
  wineDark: "#6B0F2A",    // Darker wine
  cream: "#FFF8F0",       // Warm cream
  gold: "#D4AF37",        // Gold accent
  success: "#059669",     // Emerald green
  warning: "#F59E0B",     // Amber
  danger: "#DC2626"       // Red
};

// --- ENHANCED EMAIL TEMPLATE GENERATOR ---
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
    <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; margin-top: 40px; margin-bottom: 40px; box-shadow: 0 20px 25px -5px rgba(139, 21, 56, 0.15), 0 10px 10px -5px rgba(139, 21, 56, 0.08);">
        
        <div style="background: linear-gradient(135deg, ${accentColor} 0%, ${BRAND_COLORS.wineDark} 100%); padding: 40px 30px; text-align: center; position: relative; overflow: hidden;">
          <div style="position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: rgba(255, 255, 255, 0.1); border-radius: 50%;"></div>
          <div style="position: absolute; bottom: -30px; left: -30px; width: 150px; height: 150px; background: rgba(255, 255, 255, 0.08); border-radius: 50%;"></div>
          
          <div style="position: relative; z-index: 1;">
            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: 3px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">CHOWEAZY</h1>
            <p style="color: ${BRAND_COLORS.cream}; margin: 8px 0 0 0; font-size: 13px; letter-spacing: 1px; font-weight: 500;">GOOD FOOD, DELIVERED WITH LOVE</p>
          </div>
        </div>

        <div style="padding: 50px 40px; text-align: center;">
          ${emoji ? `<div style="font-size: 48px; margin-bottom: 20px;">${emoji}</div>` : ''}
          
          <h2 style="color: ${accentColor}; margin: 0 0 24px 0; font-size: 26px; font-weight: 700;">${title}</h2>
          
          <div style="color: #374151; font-size: 16px; line-height: 26px; margin-top: 16px;">
            ${bodyContent}
          </div>
        </div>

        <div style="background: linear-gradient(to bottom, #FFFFFF 0%, #F9FAFB 100%); padding: 30px 40px; text-align: center; border-top: 2px solid ${BRAND_COLORS.cream};">
          <div style="margin-bottom: 16px;">
            <a href="#" style="display: inline-block; margin: 0 8px; color: ${BRAND_COLORS.wine}; text-decoration: none; font-size: 12px; font-weight: 600;">About</a>
            <span style="color: #D1D5DB;">•</span>
            <a href="#" style="display: inline-block; margin: 0 8px; color: ${BRAND_COLORS.wine}; text-decoration: none; font-size: 12px; font-weight: 600;">Help</a>
            <span style="color: #D1D5DB;">•</span>
            <a href="#" style="display: inline-block; margin: 0 8px; color: ${BRAND_COLORS.wine}; text-decoration: none; font-size: 12px; font-weight: 600;">Contact</a>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; margin: 0; line-height: 18px;">
            © ${new Date().getFullYear()} ChowEazy. All rights reserved.<br/>
            Making every meal memorable 🍽️
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// --- HELPER: CHECK ENV ---
const getEmailServiceUrl = () => {
  const url = process.env.EMAIL_SERVICE_URL;
  if (!url) {
    console.error("❌ EMAIL_SERVICE_URL is missing in .env file!");
    throw new Error("Email configuration error");
  }
  return url;
};

// --- BEAUTIFUL OTP EMAIL ---
export async function sendOtPEmail(email: string, otp: string) {
  try {
    const htmlContent = generateEmailHTML(
      "Verify Your Login",
      `
        <p style="font-size: 16px; margin-bottom: 12px;">Welcome back! 👋</p>
        <p style="margin-bottom: 30px;">Use the code below to complete your login. This code expires in <strong>10 minutes</strong>.</p>
        
        <div style="margin: 40px 0;">
          <div style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLORS.cream} 0%, #FFF 100%); padding: 20px 40px; border-radius: 16px; border: 3px dashed ${BRAND_COLORS.wine}; box-shadow: 0 10px 15px -3px rgba(139, 21, 56, 0.1);">
            <span style="color: ${BRAND_COLORS.wine}; font-size: 38px; font-weight: 800; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${otp}
            </span>
          </div>
        </div>
        
        <div style="background-color: #FEF3C7; border-left: 4px solid ${BRAND_COLORS.warning}; padding: 16px; border-radius: 8px; margin-top: 30px; text-align: left;">
          <p style="margin: 0; font-size: 14px; color: #92400E;">
            <strong>🔒 Security tip:</strong> Never share this code with anyone. ChowEazy will never ask for your OTP.
          </p>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #6B7280;">If you didn't request this code, please ignore this email.</p>
      `,
      BRAND_COLORS.wine,
      "🔐"
    );

    const response = await axios.post(
      getEmailServiceUrl(), 
      {
        to: email,
        subject: "🔐 Your ChowEazy Login Code",
        html: htmlContent,
      }
    );

    console.log("OTP email sent successfully");
    return response.data;
  } catch (err: any) {
    // Enhanced Error Logging
    console.error("Error sending OTP email:", err.response?.data || err.message);
    throw new Error("OTP email failed");
  }
}

// --- BEAUTIFUL ORDER STATUS EMAIL ---
export async function sendOrderStatusEmail(
  email: string, 
  name: string, 
  orderId: string, 
  status: string
) {
  try {
    const shortId = orderId ? orderId.slice(0, 6).toUpperCase() : "ORDER";
    let title = "";
    let message = "";
    let color = BRAND_COLORS.wine;
    let emoji = "";

    switch (status) {
      case "PREPARING":
        title = "We're Cooking Your Order!";
        emoji = "👨‍🍳";
        message = `
          <p style="font-size: 18px; margin-bottom: 16px;">Hey <strong style="color: ${BRAND_COLORS.wine};">${name}</strong>! 👋</p>
          <p style="margin-bottom: 20px;">Great news! The restaurant has accepted your order and our chefs are working their magic right now.</p>
          
          <div style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border-radius: 12px; padding: 20px; margin: 30px 0; border-left: 4px solid ${BRAND_COLORS.warning};">
            <p style="margin: 0; font-size: 14px; color: #78350F;">
              <strong>Order #${shortId}</strong><br/>
              Status: <span style="color: ${BRAND_COLORS.warning}; font-weight: 700;">PREPARING 🔥</span>
            </p>
          </div>
          
          <p style="font-size: 14px; color: #6B7280;">Your delicious meal will be ready soon!</p>
        `;
        color = BRAND_COLORS.warning;
        break;

      case "OUT_FOR_DELIVERY":
        title = "Your Rider is On The Way!";
        emoji = "🚴‍♂️";
        message = `
          <p style="font-size: 18px; margin-bottom: 16px;">Hey <strong style="color: ${BRAND_COLORS.wine};">${name}</strong>! 🎉</p>
          <p style="margin-bottom: 20px;">Your food is on the move! Our rider has picked up your order and is heading straight to your location.</p>
          
          <div style="background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%); border-radius: 12px; padding: 20px; margin: 30px 0; border-left: 4px solid ${BRAND_COLORS.success};">
            <p style="margin: 0; font-size: 14px; color: #064E3B;">
              <strong>Order #${shortId}</strong><br/>
              Status: <span style="color: ${BRAND_COLORS.success}; font-weight: 700;">OUT FOR DELIVERY 🛵</span>
            </p>
          </div>
          
          <p style="font-size: 14px; color: #6B7280;">Get ready to enjoy your meal! 🍽️</p>
        `;
        color = BRAND_COLORS.success;
        break;

      case "DELIVERED":
        title = "Bon Appétit!";
        emoji = "✅";
        message = `
          <p style="font-size: 18px; margin-bottom: 16px;">Hey <strong style="color: ${BRAND_COLORS.wine};">${name}</strong>! 🎊</p>
          <p style="margin-bottom: 20px;">Your order has been successfully delivered. We hope you enjoy every bite!</p>
          
          <div style="background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%); border-radius: 12px; padding: 20px; margin: 30px 0; border-left: 4px solid ${BRAND_COLORS.success};">
            <p style="margin: 0; font-size: 14px; color: #064E3B;">
              <strong>Order #${shortId}</strong><br/>
              Status: <span style="color: ${BRAND_COLORS.success}; font-weight: 700;">DELIVERED ✨</span>
            </p>
          </div>
          
          <div style="background-color: ${BRAND_COLORS.cream}; border-radius: 12px; padding: 24px; margin-top: 30px;">
            <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: ${BRAND_COLORS.wine};">How was your experience?</p>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #6B7280;">Your feedback helps us serve you better!</p>
            <a href="#" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLORS.wine} 0%, ${BRAND_COLORS.wineDark} 100%); color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(139, 21, 56, 0.3);">Rate Your Order ⭐</a>
          </div>
        `;
        color = BRAND_COLORS.success;
        break;

      case "CANCELLED":
        title = "Order Cancelled";
        emoji = "😔";
        message = `
          <p style="font-size: 18px; margin-bottom: 16px;">Hey <strong style="color: ${BRAND_COLORS.wine};">${name}</strong>,</p>
          <p style="margin-bottom: 20px;">We're sorry to inform you that your order was cancelled by the restaurant.</p>
          
          <div style="background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%); border-radius: 12px; padding: 20px; margin: 30px 0; border-left: 4px solid ${BRAND_COLORS.danger};">
            <p style="margin: 0; font-size: 14px; color: #7F1D1D;">
              <strong>Order #${shortId}</strong><br/>
              Status: <span style="color: ${BRAND_COLORS.danger}; font-weight: 700;">CANCELLED</span>
            </p>
          </div>
          
          <div style="background-color: #DBEAFE; border-radius: 12px; padding: 20px; margin-top: 30px; border-left: 4px solid #3B82F6;">
            <p style="margin: 0; font-size: 14px; color: #1E3A8A;">
              <strong>💰 Refund processed:</strong> Your full payment has been refunded and will appear in your account within 3-5 business days.
            </p>
          </div>
          
          <p style="margin-top: 30px; font-size: 14px; color: #6B7280;">We apologize for the inconvenience. Ready to try something else?</p>
          <a href="#" style="display: inline-block; margin-top: 16px; background: linear-gradient(135deg, ${BRAND_COLORS.wine} 0%, ${BRAND_COLORS.wineDark} 100%); color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(139, 21, 56, 0.3);">Browse Restaurants</a>
        `;
        color = BRAND_COLORS.danger;
        break;

      default:
        title = "Order Update";
        emoji = "📦";
        message = `
          <p style="font-size: 18px; margin-bottom: 16px;">Hey <strong style="color: ${BRAND_COLORS.wine};">${name}</strong>,</p>
          <p style="margin-bottom: 20px;">We have an update on your order.</p>
          
          <div style="background: linear-gradient(135deg, ${BRAND_COLORS.cream} 0%, #FFF 100%); border-radius: 12px; padding: 20px; margin: 30px 0; border-left: 4px solid ${BRAND_COLORS.wine};">
            <p style="margin: 0; font-size: 14px; color: #374151;">
              <strong>Order #${shortId}</strong><br/>
              Status: <span style="color: ${BRAND_COLORS.wine}; font-weight: 700;">${status}</span>
            </p>
          </div>
        `;
    }

    const htmlContent = generateEmailHTML(title, message, color, emoji);

    await axios.post(
      getEmailServiceUrl(), 
      {
        to: email,
        subject: `${emoji} Order Update: #${shortId}`,
        html: htmlContent,
      }
    );
    console.log(`Order email sent to ${email} for status ${status}`);
  } catch (err: any) {
    // Enhanced Error Logging to help debugging
    console.error("Failed to send order email:", err.response?.data || err.message);
  }
}