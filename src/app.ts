import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRouter from "./auth/auth.route";
import restaurantRouter from "./restuarant/restaurant.route";
import orderRouter from "./order/order.routes";
import paymentRouter from "./payment/payment.route";

const app = express();

// Middlewares
app.use(cors());
app.use(morgan("dev"));

// Apply express.json() only to specific routes (excluding /api/payment/webhook)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/payment/webhook")) {
    next(); // Skip JSON parsing for webhook
  } else {
    express.json()(req, res, next); // Apply JSON parsing for other routes
  }
});

app.use("/api/auth", authRouter);
app.use("/api/restaurant", restaurantRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payment", paymentRouter);

export default app;