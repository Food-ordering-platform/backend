import express from "express";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";

import authRouter from "./auth/auth.route";
import restaurantRouter from "./restuarant/restaurant.route";
import orderRouter from "./order/order.routes";
import paymentRouter from "./payment/payment.route";

const app = express();


app.set("trust proxy", 1) //Tells express to trust the load balancer
// 1. Setup Session Store (Postgres)
const PgStore = pgSession(session);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 2. HYBRID CORS CONFIGURATION (Crucial for Mobile + Web)
// Define your web frontend URLs here. Add your production domain later.
const allowedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000", "https://choweazy.vercel.app"];

app.use(
  cors({
    origin: function (origin, callback) {
      // CASE A: Mobile Apps / Postman (Requests with no Origin header)
      // We allow these because mobile apps don't have a domain name.
      if (!origin) return callback(null, true);

      // CASE B: Web Frontend (Requests WITH Origin header)
      // We must check if they are in our whitelist to allow Cookies/Sessions.
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      } else {
        const msg = "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true, // This allows the Web Frontend to send/receive Cookies
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

// 4. Session Middleware
app.use(
  session({
    store: new PgStore({
      pool: pool,
      tableName: "session", // Make sure this matches your Prisma map
      createTableIfMissing: true,
    }),
    secret: process.env.JWT_SECRET as string, // Using JWT_SECRET as session secret
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Days
      httpOnly: true, // Security: JavaScript cannot read this cookie
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "none",
    },
  })
);

// 5. Routes
app.use("/api/auth", authRouter);
app.use("/api/restaurant", restaurantRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payment", paymentRouter);

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