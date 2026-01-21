import express from "express";
import { NotificationController } from "./notification.controller";


const router = express.Router();

router.post("/subscribe", NotificationController.subscribe);

export default router;