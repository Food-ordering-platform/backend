// food-ordering-platform/backend/backend-main/src/cloudinary/upload.ts
import cloudinary from "./index"; // [FIX] Import the CONFIGURED instance
import { Readable } from "stream";

export async function uploadToCloudinary(file: Express.Multer.File, folder = "restaurant-menu"): Promise<any> {
  return new Promise((resolve, reject) => {
    // Use the imported 'cloudinary' which we know has the config
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: "auto",
        // No transformations here (Best Practice)
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary Upload Error:", error);
          return reject(error);
        }
        resolve(result);
      }
    );

    const stream = Readable.from(file.buffer);
    stream.pipe(uploadStream);
  });
}