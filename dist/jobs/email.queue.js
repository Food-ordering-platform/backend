"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const resend_1 = require("resend");
const Sentry = __importStar(require("@sentry/node"));
// Initialize Redis connection
const redisConnection = new ioredis_1.default(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null, // Required by BullMQ
});
// Initialize Resend
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
// Create the Queue
exports.emailQueue = new bullmq_1.Queue('emailQueue', { connection: redisConnection });
// Create the Worker that processes the queue
const emailWorker = new bullmq_1.Worker('emailQueue', async (job) => {
    const { to, subject, html } = job.data;
    const { data, error } = await resend.emails.send({
        from: 'ChowEazy <no-reply@choweazy.com>', // Update with your verified domain
        to,
        subject,
        html,
    });
    if (error) {
        throw new Error(`Resend API Error: ${error.message}`);
    }
    return data;
}, { connection: redisConnection });
// Error handling for the worker
emailWorker.on('failed', (job, err) => {
    console.error(`❌ Email Job ${job?.id} failed for ${job?.data.to}:`, err.message);
    Sentry.captureException(err, { extra: { jobData: job?.data } }); // Log failed jobs to Sentry
});
emailWorker.on('completed', (job) => {
    console.log(`✅ Email sent successfully to ${job.data.to}`);
});
//# sourceMappingURL=email.queue.js.map