// src/utils/email/templates.ts

const BRAND_COLORS = {
  wine: "#7b1e3a",
  wineDark: "#5a162b",
  text: "#374151",
  bg: "#F9FAFB",
};

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://choweazy.vercel.app";

const LOGO_URL = `${FRONTEND_URL}/official_logo.png`;

export function generateEmailHTML(
  title: string,
  bodyContent: string,
  emoji: string = ""
) {
  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:${BRAND_COLORS.bg};font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden">
      
      <div style="background:${BRAND_COLORS.wine};padding:30px;text-align:center">
        <img src="${LOGO_URL}" width="150" alt="ChowEazy"/>
      </div>

      <div style="padding:40px;text-align:center;color:${BRAND_COLORS.text}">
        ${emoji ? `<div style="font-size:48px">${emoji}</div>` : ""}
        <h2 style="color:${BRAND_COLORS.wine}">${title}</h2>
        ${bodyContent}
      </div>

      <div style="padding:20px;text-align:center;font-size:12px;color:#9CA3AF">
        © ${new Date().getFullYear()} ChowEazy
      </div>
    </div>
  </body>
  </html>
  `;
}
