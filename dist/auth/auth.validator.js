"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: zod_1.z.string().email({ message: "Invalid email address" }),
    password: zod_1.z.string().min(6, { message: "Password must be at least 6 characters" }),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.enum(["CUSTOMER", "VENDOR"]).default("CUSTOMER"),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email({ message: "Invalid email address" }),
    password: zod_1.z.string()
});
//# sourceMappingURL=auth.validator.js.map