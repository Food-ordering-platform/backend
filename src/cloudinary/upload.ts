// food-ordering-platform/backend/backend-main/src/cloudinary/upload.ts
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import "./index"; // Ensure configuration is loaded

export async function uploadToCloudinary(file: Express.Multer.File, folder = "restaurant-menu"): Promise<any> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: "auto",
        // [CRITICAL FIX] Removed 'transformation' array.
        // This was causing the "Invalid Signature" error.
        // Apply optimizations (q_auto, f_auto) in your Frontend <Image /> source instead.
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );

    // Pipe the buffer to Cloudinary
    const stream = Readable.from(file.buffer);
    stream.pipe(uploadStream);
  });
}