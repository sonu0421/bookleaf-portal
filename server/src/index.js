import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

import { env, validateEnv } from './config/env.js';
import { connectDb } from './config/db.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import bookRoutes from './routes/books.js';
import ticketRoutes from './routes/tickets.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ---- API routes ----
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'bookleaf-portal' }));
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', notFound);
app.use(errorHandler);

// ---- Real-time: authors join their ticket rooms, admins join the admin room ----
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: env.clientUrl, credentials: true },
});
app.set('io', io);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('auth required'));
    const payload = jwt.verify(token, env.jwtSecret);
    socket.user = payload;
    next();
  } catch {
    next(new Error('invalid token'));
  }
});

io.on('connection', (socket) => {
  if (socket.user.role === 'admin') socket.join('admins');
  socket.on('ticket:join', (ticketId) => {
    if (typeof ticketId === 'string') socket.join(`ticket-${ticketId}`);
  });
  socket.on('ticket:leave', (ticketId) => {
    if (typeof ticketId === 'string') socket.leave(`ticket-${ticketId}`);
  });
});

async function main() {
  const errors = validateEnv();
  if (errors.length) {
    console.error('[env]', errors.join(' '));
    process.exit(1);
  }
  await connectDb();
  server.listen(env.port, () => {
    console.log(`[server] listening on :${env.port}`);
  });
}

main().catch((e) => {
  console.error('[server] fatal:', e.message);
  process.exit(1);
});
