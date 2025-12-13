// food-ordering-platform/backend/backend-main/src/cloudinary/index.ts
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

// [DEBUG] Check for hidden spaces in Railway
if (!cloudName || !apiKey || !apiSecret) {
  console.error("❌ FATAL: Cloudinary env vars are missing!");
} else {
  console.log("✅ Cloudinary Config Loaded:");
  console.log(`   - Cloud Name: ${cloudName} (Length: ${cloudName.length})`);
  console.log(`   - API Key: ${apiKey} (Length: ${apiKey.length})`);
  // We only show the first 4 chars for security, but check the LENGTH matches your dashboard
  console.log(`   - API Secret: ${apiSecret.substring(0, 4)}... (Length: ${apiSecret.length})`);
  
  if (apiSecret.trim().length !== apiSecret.length) {
    console.error("⚠️ CRITICAL WARNING: Your API Secret has hidden spaces! Please edit it in Railway.");
  }
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

// Export the configured instance
export default cloudinary;