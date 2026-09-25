import 'dotenv/config';

import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import http from 'http';
import { connectDB } from './config/db';
import { registerRoutes } from './routes';
import { startAutoSync, stopAutoSync, closeTestDbConnection } from './services/testDbSync';
import { startEventReminderJob, stopEventReminderJob } from './services/eventReminders';
import { startContentScheduler, stopContentScheduler } from './services/contentScheduler';
import { startNotificationScheduler, stopNotificationScheduler } from './services/notificationScheduler';
import { models } from './models/registry';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

let server: http.Server | null = null;

async function start(): Promise<void> {
  await connectDB();

  // Start auto-sync if enabled
  // startAutoSync(models);
  // startEventReminderJob(models);

  // Phase 5: scheduled content auto-publishing (separate cron task).
  startContentScheduler(models);

  // Step 6: scheduled notification dispatcher (separate cron task, every
  // minute; hands due scheduled notifications to the Step-5 sender).
  startNotificationScheduler(models);

  const app = express();
  const port = process.env.PORT || 3001;

  app.use(
    cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static('uploads'));

  registerRoutes(app);

  const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    void next;
    console.error(err);
    const errorCode = typeof err?.code === 'string' ? err.code : '';
    const statusCode = typeof err?.statusCode === 'number'
      ? err.statusCode
      : errorCode === 'LIMIT_FILE_SIZE' ? 400 : 500;
    const message = errorCode === 'LIMIT_FILE_SIZE' ? 'Image file must be 5MB or smaller.' : errorMessage(err);
    res.status(statusCode).json({ message });
  };

  app.use(errorHandler);

  server = app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('\nSIGTERM received. Shutting down gracefully...');
    stopAutoSync();
    stopEventReminderJob();
    stopContentScheduler();
    stopNotificationScheduler();
    await closeTestDbConnection();
    server?.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('\nSIGINT received. Shutting down gracefully...');
    stopAutoSync();
    stopEventReminderJob();
    stopContentScheduler();
    stopNotificationScheduler();
    await closeTestDbConnection();
    server?.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

start().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
