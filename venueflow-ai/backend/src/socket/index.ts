import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

interface ConnectedUser {
  socketId: string;
  userId?: string;
  role?: string;
  eventId?: string;
  room?: string;
  connectedAt: number;
}

// Track connections per IP (max 3)
const ipConnections: Map<string, Set<string>> = new Map();
const connectedUsers: Map<string, ConnectedUser> = new Map();

export function initSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Auth middleware for Socket.io
  io.use((socket, next) => {
    const clientIp = socket.handshake.headers['x-forwarded-for'] as string
      || socket.handshake.address;

    // IP connection limit (max 3)
    if (!ipConnections.has(clientIp)) {
      ipConnections.set(clientIp, new Set());
    }
    const ipSockets = ipConnections.get(clientIp)!;
    if (ipSockets.size >= 3) {
      return next(new Error('Too many connections from this IP'));
    }
    ipSockets.add(socket.id);

    // Try to authenticate (optional — public demo rooms work without auth)
    const token = socket.handshake.auth.token || socket.handshake.query.token as string;
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || 'venueflow-fallback-secret-change-in-prod';
        const decoded = jwt.verify(token, secret) as { id: string; role: string; email: string };
        (socket as any).userId = decoded.id;
        (socket as any).role = decoded.role;
      } catch {
        // Token invalid — continue as guest
      }
    }

    next();
  });

  io.on('connection', (socket: Socket) => {
    const clientIp = socket.handshake.headers['x-forwarded-for'] as string
      || socket.handshake.address;
    const userId = (socket as any).userId;
    const role = (socket as any).role || 'GUEST';

    connectedUsers.set(socket.id, {
      socketId: socket.id,
      userId,
      role,
      connectedAt: Date.now(),
    });

    console.log(`[Socket.io] Connected: ${socket.id} | IP: ${clientIp} | Role: ${role}`);

    // Join event room
    socket.on('join_event', (data: { event_id: string; role?: string }) => {
      const { event_id, role: joinRole } = data;
      const effectiveRole = (socket as any).role || joinRole || 'FAN';
      const roomSuffix = effectiveRole === 'MANAGER' || effectiveRole === 'ADMIN' || effectiveRole === 'STAFF'
        ? 'manager'
        : 'fan';

      const room = `event:${event_id}:${roomSuffix}`;
      socket.join(room);

      const user = connectedUsers.get(socket.id);
      if (user) {
        user.eventId = event_id;
        user.room = room;
      }

      socket.emit('joined', { room, event_id, role: effectiveRole });
      console.log(`[Socket.io] ${socket.id} joined room: ${room}`);
    });

    // Leave event room
    socket.on('leave_event', (data: { event_id: string }) => {
      const user = connectedUsers.get(socket.id);
      if (user?.room) {
        socket.leave(user.room);
        console.log(`[Socket.io] ${socket.id} left room: ${user.room}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      const ipSockets = ipConnections.get(clientIp);
      if (ipSockets) {
        ipSockets.delete(socket.id);
        if (ipSockets.size === 0) ipConnections.delete(clientIp);
      }
      connectedUsers.delete(socket.id);
      console.log(`[Socket.io] Disconnected: ${socket.id} | Reason: ${reason}`);
    });

    // Ping-pong for health check
    socket.on('ping', () => socket.emit('pong', { time: Date.now() }));
  });

  return io;
}

export function getConnectedStats(): { total: number; fans: number; managers: number } {
  const users = Array.from(connectedUsers.values());
  return {
    total: users.length,
    fans: users.filter(u => !u.role || u.role === 'FAN' || u.role === 'GUEST').length,
    managers: users.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN' || u.role === 'STAFF').length,
  };
}
