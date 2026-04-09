"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
// Connects to your remote Redis instance (e.g., Upstash, Render, AWS)
exports.redisClient = new ioredis_1.default(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null, // Required by BullMQ
});
exports.redisClient.on('connect', () => console.log('🟢 Redis Connected'));
exports.redisClient.on('error', (err) => console.error('🔴 Redis Error:', err));
//# sourceMappingURL=redis.js.map