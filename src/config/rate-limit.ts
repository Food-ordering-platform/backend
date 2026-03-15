import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "./redis";

// 1. THE GLOBAL SHIELD (For standard routes like getting profile, viewing history)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - Known typing issue with ioredis and rate-limit-redis
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
  handler: (req, res) => {
    res.status(429).json({ success: false, message: "Too many requests. Slow down and try again later!" });
  }
});

// 2. THE FORT KNOX (For Login, Signup, OTP)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Strictly 5 attempts!
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
  handler: (req, res) => {
    res.status(429).json({ success: false, message: "Too many login attempts. Please try again in 15 minutes." });
  }
});


export const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Max 5 payment initializations per 10 mins to prevent Paystack bans
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
  handler: (req, res) => {
    res.status(429).json({ success: false, message: "Too many payment attempts. Please wait a few minutes." });
  }
});