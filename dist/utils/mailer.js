"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtPEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});
const sendOtPEmail = async (to, otp) => {
    const mailOption = {
        from: `"Food APP" <${process.env.EMAIL_USER}`,
        to,
        subject: "Your OTP code",
        text: `Your OTP code is ${otp}. It will expire in 10 minutes.`,
        html: `<p>Your OTP code is <b>${otp}</b>. It will expire in 10 minutes.</p>`,
    };
    await transporter.sendMail(mailOption);
};
exports.sendOtPEmail = sendOtPEmail;
//# sourceMappingURL=mailer.js.map