import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRouter from "./auth/auth.route"

const app = express();

//middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/auth", authRouter)

export default app