import 'dotenv/config';

import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import http from 'http';
import { connectDB } from './config/db';
import { registerRoutes } from './routes';
import { startAutoSync, stopAutoSync, closeTestDbConnection } from './services/testDbSync';
import { models } from './models/registry';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

let server: http.Server | null = null;

async function start(): Promise<void> {
  await connectDB();

  // Start auto-sync if enabled
  startAutoSync(models);

  const app = express();
  const port = process.env.PORT || 3001;

  app.use(
    cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    })
  );
  app.use(express.json({ limit: '2mb' }));

  registerRoutes(app);

  const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    void next;
    console.error(err);
    res.status(500).json({ message: errorMessage(err) });
  };

  app.use(errorHandler);

  server = app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('\nSIGTERM received. Shutting down gracefully...');
    stopAutoSync();
    await closeTestDbConnection();
    server?.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('\nSIGINT received. Shutting down gracefully...');
    stopAutoSync();
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
