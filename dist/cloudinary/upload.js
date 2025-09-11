"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMenuImage = uploadMenuImage;
const index_1 = __importDefault(require("./index")); // import the configured cloudinary
async function uploadMenuImage(filePath) {
    const result = await index_1.default.uploader.upload(filePath, {
        folder: "restaurant-menu",
        use_filename: true,
        unique_filename: false,
    });
    return result.secure_url; // this URL goes into MenuItem.imageUrl
}
//# sourceMappingURL=upload.js.map