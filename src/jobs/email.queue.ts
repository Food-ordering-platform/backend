import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { Resend } from 'resend';
import * as Sentry from '@sentry/node';

// Initialize Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Create the Queue
export const emailQueue = new Queue('emailQueue', { connection: redisConnection as any });

// Create the Worker that processes the queue
const emailWorker = new Worker('emailQueue', async (job) => {
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
}, { connection: redisConnection as any });

// Error handling for the worker
emailWorker.on('failed', (job, err) => {
  console.error(`❌ Email Job ${job?.id} failed for ${job?.data.to}:`, err.message);
  Sentry.captureException(err, { extra: { jobData: job?.data } }); // Log failed jobs to Sentry
});

emailWorker.on('completed', (job) => {
  console.log(`✅ Email sent successfully to ${job.data.to}`);
});