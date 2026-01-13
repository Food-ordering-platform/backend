import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { AdminService } from "./admin.service";

const router = Router();

// Middleware to check if user is ADMIN
const adminCheck = (req: any, res: any, next: any) => {
  if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admin only" });
  next();
};

router.get("/withdrawals", authMiddleware, adminCheck, async (req, res) => {
  try {
    const withdrawals = await AdminService.getPendingWithdrawals();
    res.json({ success: true, data: withdrawals });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/withdrawals/:id", authMiddleware, adminCheck, async (req, res) => {
  try {
    const { action } = req.body; // "APPROVE" or "REJECT"
    const result = await AdminService.processWithdrawal(req.params.id, action);
    res.json({ success: true, data: result });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

export default router;