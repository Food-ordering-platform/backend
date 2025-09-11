"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const router = (0, express_1.Router)();
//POST request /api/auth/register => calls authcontroller.register
router.post("/register", auth_controller_1.AuthController.register);
//POST request /api/auth/login => calls authcontroller.login
router.post("/login", auth_controller_1.AuthController.login);
router.post("/verify-otp", auth_controller_1.AuthController.verifyOtp);
exports.default = router;
//# sourceMappingURL=auth.route.js.map