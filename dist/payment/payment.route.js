"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("./payment.controller");
const body_parser_1 = __importDefault(require("body-parser"));
const router = (0, express_1.Router)();
// Webhook route with raw body parser
router.post("/webhook", body_parser_1.default.raw({ type: "application/json" }), // Matches Korapay's content-type
payment_controller_1.PaymentController.webhook);
router.get("/verify/:reference", payment_controller_1.PaymentController.verify);
exports.default = router;
//# sourceMappingURL=payment.route.js.map