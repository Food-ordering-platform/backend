"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToCloudinary = uploadToCloudinary;
// food-ordering-platform/backend/backend-main/src/cloudinary/upload.ts
const index_1 = __importDefault(require("./index")); // [FIX] Import the CONFIGURED instance
const stream_1 = require("stream");
async function uploadToCloudinary(file, folder = "restaurant-menu") {
    return new Promise((resolve, reject) => {
        // Use the imported 'cloudinary' which we know has the config
        const uploadStream = index_1.default.uploader.upload_stream({
            folder: folder,
            resource_type: "auto",
            // No transformations here (Best Practice)
        }, (error, result) => {
            if (error) {
                console.error("❌ Cloudinary Upload Error:", error);
                return reject(error);
            }
            resolve(result);
        });
        const stream = stream_1.Readable.from(file.buffer);
        stream.pipe(uploadStream);
    });
}
//# sourceMappingURL=upload.js.map