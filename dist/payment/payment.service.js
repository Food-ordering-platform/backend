"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const axios_1 = __importDefault(require("axios"));
const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;
class PaymentService {
    // Initialize payment
    static async initiatePayment(amount, name, email, reference // use Prisma-generated reference
    ) {
        const response = await axios_1.default.post("https://api.korapay.com/merchant/api/v1/charges/initialize", {
            amount,
            currency: "NGN",
            reference,
            customer: { name, email },
            redirect_url: "https://food-ordering-appp.vercel.app/orders/details", // ✅ updated
            notification_url: "https://food-ordering-app.up.railway.app/api/payment/webhook",
        }, {
            headers: {
                Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
                "Content-Type": "application/json",
            },
        });
        // Return the checkout URL for frontend redirection
        return response.data.data.checkout_url;
    }
    // Verify payment status after redirect or via API call
    static async verifyPayment(reference) {
        const response = await axios_1.default.get(`https://api.korapay.com/merchant/api/v1/charges/${reference}`, {
            headers: { Authorization: `Bearer ${KORAPAY_SECRET_KEY}` },
        });
        return response.data.data;
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=payment.service.js.map