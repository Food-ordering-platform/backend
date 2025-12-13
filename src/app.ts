import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRouter from "./auth/auth.route";
import restaurantRouter from "./restuarant/restaurant.route";
import orderRouter from "./order/order.routes";
import paymentRouter from "./payment/payment.route";

const app = express();

// [FIX] Explicit CORS to prevent "Network Error" on preflight requests
app.use(cors({
  origin: "*", // Allow all origins (Mobile apps often need this)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(morgan("dev"));

// Apply express.json() 
// We keep your logic to skip it for webhooks
app.use((req, res, next) => {
  if (req.path.startsWith("/api/payment/webhook")) {
    next(); 
  } else {
    express.json()(req, res, next); 
  }
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/restaurant", restaurantRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payment", paymentRouter);

// [CRITICAL FIX] Global Error Handler
// This catches backend crashes (like Multer errors) and sends a JSON response
// preventing the "Network Error" on the frontend.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("🔥 Global Backend Error:", err); // Check your Railway logs for this!
  
  // Handle Multer File Size Error specifically
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File is too large. Max limit is 5MB.",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;