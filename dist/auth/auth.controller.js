"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const auth_validator_1 = require("./auth.validator");
class AuthController {
    // Register a new user
    static async register(req, res) {
        try {
            // validate request
            const data = auth_validator_1.registerSchema.parse(req.body);
            // call service (creates user, otp, and token)
            const { user, token } = await auth_service_1.AuthService.register(data.name, data.email, data.password, data.phone);
            return res.status(201).json({
                message: "User registered. OTP sent to email/phone",
                user,
                token, // 👈 frontend needs this to redirect to verify-otp page
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // Login a user
    static async login(req, res) {
        try {
            const data = auth_validator_1.loginSchema.parse(req.body);
            const result = await auth_service_1.AuthService.login(data.email, data.password);
            return res.status(200).json({
                message: "Login successful",
                result,
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // Verify OTP
    static async verifyOtp(req, res) {
        try {
            const { token, code } = req.body;
            const result = await auth_service_1.AuthService.verifyOtp(token, code);
            return res.status(200).json(result);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map