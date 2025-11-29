"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtPEmail = sendOtPEmail;
const axios_1 = __importDefault(require("axios"));
async function sendOtPEmail(email, otp) {
    try {
        const response = await axios_1.default.post(process.env.EMAIL_SERVICE_URL, // from .env
        {
            to: email,
            subject: "Your OTP Code",
            html: `<p>Your OTP code is: <b>${otp}</b></p>`,
        });
        console.log("OTP email sent successfully:", response.data);
        return response.data;
    }
    catch (err) {
        console.error("Error sending OTP email:", err.response?.data || err.message);
        throw new Error("OTP email failed");
    }
}
//# sourceMappingURL=mailer.js.map