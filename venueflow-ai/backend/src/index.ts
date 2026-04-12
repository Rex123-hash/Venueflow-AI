import 'dotenv/config';
import express from 'express';
import path from 'path';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import passport from 'passport';

import { initRedis } from './lib/redis';
import { initSocketServer } from './socket/index';
import { getSimulationEngine } from './services/SimulationEngine';
import { getAlertBot } from './services/AlertBot';
import { attachSocketToEmergency } from './routes/emergency';

import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import zoneRoutes from './routes/zones';
import alertRoutes from './routes/alerts';
import ticketRoutes from './routes/tickets';
import aiRoutes from './routes/ai';
import emergencyRoutes from './routes/emergency';
import simulationRoutes from './routes/simulation';
import adminRoutes from './routes/admin';
import staffRoutes from './routes/staff';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Allow SSE
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'VenueFlow AI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);

// ─── Serve Frontend (Production Unified Build) ──────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ─── 404 Handler for API, fallback to React app for other routes ────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;

// ─── Start Server ────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // Init Redis (with in-memory fallback)
  initRedis();

  // Create HTTP server
  const httpServer = http.createServer(app);

  // Init Socket.io
  const io = initSocketServer(httpServer);

  // Wire Socket.io to emergency routes
  attachSocketToEmergency(io);

  // Demo event ID (used when DB is not available)
  const DEMO_EVENT_ID = process.env.DEMO_EVENT_ID || 'event-ipl-2025-mi-csk';

  // Start Simulation Engine
  const engine = getSimulationEngine(DEMO_EVENT_ID);
  engine.attach(io);
  engine.start();

  // Handle surge events → trigger AlertBot
  engine.on('surge', async ({ zoneId, zoneName, extraFlow }) => {
    try {
      const alertBot = getAlertBot();
      await alertBot.createSurgeAlert(zoneId, zoneName, extraFlow);
    } catch { /* alertbot not yet initialized */ }
  });

  // Start AlertBot
  try {
    const alertBot = getAlertBot(DEMO_EVENT_ID);
    alertBot.attach(io);
    alertBot.start();
  } catch (err: any) {
    console.warn('[AlertBot] Failed to start:', err.message);
  }

  // Start listening
  httpServer.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║           VenueFlow AI Backend v1.0.0                ║
║           Running on http://localhost:${PORT}           ║
║           Socket.io: Ready                           ║
║           Simulation: ACTIVE                         ║
╚══════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[Server] SIGTERM received — shutting down gracefully');
    engine.stop();
    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  });
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}
