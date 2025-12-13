// food-ordering-platform/backend/backend-main/src/restuarant/upload.middleware.ts
import multer from "multer";

// Ticketer Strategy: Use MemoryStorage. 
// We don't upload here; we pass the raw buffer to the Service layer.
const storage = multer.memoryStorage();

export const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit to 5MB (Optional safety)
  }
});