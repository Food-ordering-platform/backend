import { emailQueue } from '../../jobs/email.queue';
import * as Sentry from '@sentry/node';

export const mailer = {
  verify: (cb: any) => {
    console.log("✅ BullMQ/Resend Mailer Ready.");
    if (cb) cb(null, true);
  },
};

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    console.log(`📨 Queuing email to: ${to}`);

    // Add job to queue with retry logic
    const job = await emailQueue.add('sendEmailJob', { to, subject, html }, {
      attempts: 3, // Retry 3 times if it fails
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s
      },
      removeOnComplete: true, // Keep Redis clean
      removeOnFail: false, // Keep failed jobs for inspection
    });

    console.log(`✅ Email queued successfully! Job ID: ${job.id}`);
    return { id: job.id };
  } catch (error: any) {
    console.error(`❌ FATAL ERROR QUEUEING EMAIL to ${to}:`, error.message);
    Sentry.captureException(error);
    throw new Error(`Queue Failed: ${error.message}`);
  }
}