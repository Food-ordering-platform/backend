import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRouter from "./auth/auth.route";
import restaurantRouter from "./restuarant/restaurant.route";
import orderRouter from "./order/order.routes";

const app = express();

//middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/restaurant", restaurantRouter);
app.use("/api/orders", orderRouter); 

export default app;
