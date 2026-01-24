"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutSchema = exports.menuItemSchema = exports.createRestaurantSchema = void 0;
const zod_1 = require("zod");
exports.createRestaurantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name is too short"),
    address: zod_1.z.string().min(5, "Address is too short"),
    phone: zod_1.z.string().min(10, "Phone number is invalid"),
    email: zod_1.z.string().email("Invalid email address"),
    prepTime: zod_1.z.coerce.number().min(5).max(120).default(20), // "20" string -> 20 number
    minimumOrder: zod_1.z.coerce.number().min(0).default(0),
    isOpen: zod_1.z.enum(["true", "false"]).transform((val) => val === "true").optional(),
    latitude: zod_1.z.coerce.number().optional(),
    longitude: zod_1.z.coerce.number().optional(),
});
exports.menuItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    description: zod_1.z.string().optional(),
    price: zod_1.z.coerce.number().min(0, "Price cannot be negative"),
    categoryId: zod_1.z.string().optional(),
    categoryName: zod_1.z.string().optional(),
});
exports.payoutSchema = zod_1.z.object({
    amount: zod_1.z.number().min(1000, "Minimum withdrawal is ₦1,000"),
    bankDetails: zod_1.z.object({
        bankName: zod_1.z.string().min(1, "Bank name is required"),
        accountNumber: zod_1.z.string().min(10, "Account number is required"),
        accountName: zod_1.z.string().min(1, "Account name is required"),
    }),
});
//# sourceMappingURL=restaurant.validator.js.map