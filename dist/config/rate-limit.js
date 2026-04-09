"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentLimiter = exports.authLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = require("rate-limit-redis");
const redis_1 = require("./redis");
// 1. THE GLOBAL SHIELD (For standard routes like getting profile, viewing history)
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 100 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,
    store: new rate_limit_redis_1.RedisStore({
        // @ts-expect-error - Known typing issue with ioredis and rate-limit-redis
        sendCommand: (...args) => redis_1.redisClient.call(...args),
    }),
    handler: (req, res) => {
        res.status(429).json({ success: false, message: "Too many requests. Slow down and try again later!" });
    }
});
// 2. THE FORT KNOX (For Login, Signup, OTP)
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // Strictly 5 attempts!
    standardHeaders: true,
    legacyHeaders: false,
    store: new rate_limit_redis_1.RedisStore({
        // @ts-expect-error
        sendCommand: (...args) => redis_1.redisClient.call(...args),
    }),
    handler: (req, res) => {
        res.status(429).json({ success: false, message: "Too many login attempts. Please try again in 15 minutes." });
    }
});
exports.paymentLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // Max 5 payment initializations per 10 mins to prevent Paystack bans
    standardHeaders: true,
    legacyHeaders: false,
    store: new rate_limit_redis_1.RedisStore({
        // @ts-expect-error
        sendCommand: (...args) => redis_1.redisClient.call(...args),
    }),
    handler: (req, res) => {
        res.status(429).json({ success: false, message: "Too many payment attempts. Please wait a few minutes." });
    }
});
//# sourceMappingURL=rate-limit.js.map