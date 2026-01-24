"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawalSchema = exports.completeDeliverySchema = exports.pickupSchema = exports.assignRiderSchema = exports.acceptOrderSchema = void 0;
const zod_1 = require("zod");
exports.acceptOrderSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid({ message: "Invalid Order ID format" }),
});
exports.assignRiderSchema = zod_1.z.object({
    trackingId: zod_1.z.string().min(1, "Tracking ID is required"),
    name: zod_1.z.string().min(2, "Rider name is too short"),
    phone: zod_1.z.string().regex(/^[0-9]{10,11}$/, "Phone number must be 10 or 11 digits"),
});
exports.pickupSchema = zod_1.z.object({
    trackingId: zod_1.z.string().min(1, "Tracking ID is required"),
});
exports.completeDeliverySchema = zod_1.z.object({
    trackingId: zod_1.z.string().min(1, "Tracking ID is required"),
    otp: zod_1.z.string().length(4, "Delivery code must be exactly 4 digits"),
});
exports.withdrawalSchema = zod_1.z.object({
    amount: zod_1.z.number().min(1000, "Minimum withdrawal is ₦1,000"),
    bankDetails: zod_1.z.object({
        bankName: zod_1.z.string().min(2, "Bank name is required"),
        accountNumber: zod_1.z.string().regex(/^[0-9]{10}$/, "Account number must be 10 digits"),
        accountName: zod_1.z.string().min(2, "Account name is required"),
    }),
});
//# sourceMappingURL=dispatch.validator.js.map