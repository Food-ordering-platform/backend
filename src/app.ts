import express from "express";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";
import compression from "compression"

import authRouter from "./auth/auth.route";
import restaurantRouter from "./restuarant/restaurant.route";
import orderRouter from "./order/order.routes";
import paymentRouter from "./payment/payment.route";
import dispatchRouter from "./dispatch/dispatch.route"

const app = express();


app.set("trust proxy", 1) //Tells express to trust the load balancer
// 1. Setup Session Store (Postgres)
const PgStore = pgSession(session);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(compression())

// 2. HYBRID CORS CONFIGURATION (Crucial for Mobile + Web)
// Define your web frontend URLs here. Add your production domain later.

app.use(
  cors({
    origin: ["http://localhost:3000", "https://choweazy.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
    credentials:true,
    optionsSuccessStatus: 204, // This matches the 204 you see in logs
  })
);
app.use(morgan("dev"));

// 3. JSON Parsing (Skip for Webhooks)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/payment/webhook")) {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));


// 5. Routes
app.use("/api/auth", authRouter);
app.use("/api/restaurant", restaurantRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/dispatch", dispatchRouter)

// 6. Global Error Handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("🔥 Global Backend Error:", err); // Log error for debugging

    // Handle Multer File Size Error
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File is too large. Max limit is 5MB.",
      });
    }

    // Handle CORS Errors
    if (err.message && err.message.includes("CORS")) {
      return res.status(403).json({
        success: false,
        message: "CORS Error: Origin not allowed",
      });
    }

    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
);

export default app;