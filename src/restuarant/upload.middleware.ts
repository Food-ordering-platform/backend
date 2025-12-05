import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../cloudinary/index"; // Import your configured cloudinary instance

const storage = new CloudinaryStorage({
  cloudinary: cloudinary as any,
  params: {
    folder: "restaurant-menu", // The folder name in Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "webp"], // Restrict file types
    // transformation: [{ width: 500, height: 500, crop: "limit" }] // Optional: Resize on upload
  } as any, // 'as any' helps avoid type conflicts with the library versions
});

export const upload = multer({ storage: storage });