"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
// food-ordering-platform/backend/backend-main/src/restuarant/upload.middleware.ts
const multer_1 = __importDefault(require("multer"));
// Ticketer Strategy: Use MemoryStorage. 
// We don't upload here; we pass the raw buffer to the Service layer.
const storage = multer_1.default.memoryStorage();
exports.upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // Limit to 5MB (Optional safety)
    }
});
//# sourceMappingURL=upload.middleware.js.map