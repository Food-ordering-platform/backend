"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("./payment.controller");
const auth_middleware_1 = require("../auth/auth.middleware"); // Import
const body_parser_1 = __importDefault(require("body-parser"));
const router = (0, express_1.Router)();
// ✅ PUBLIC: Do NOT add authMiddleware here. 
// Korapay servers do not have your JWT token.
router.post("/webhook", body_parser_1.default.raw({ type: "application/json" }), payment_controller_1.PaymentController.webhook);
// 🔒 PRIVATE: Only the user who paid should verify
router.get("/verify/:reference", auth_middleware_1.authMiddleware, payment_controller_1.PaymentController.verify);
exports.default = router;
//# sourceMappingURL=payment.route.js.map