import { io, Socket } from 'socket.io-client';
import { getSocketBaseUrl } from './runtime';

let socket: Socket | null = null;

const getStoredToken = () => {
  const directToken = localStorage.getItem('venueflow-token');
  if (directToken) return directToken;

  const persistedAuth = localStorage.getItem('venueflow-auth');
  if (!persistedAuth) return null;

  try {
    const parsed = JSON.parse(persistedAuth);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
};

export const initSocket = (): Socket => {
  if (!socket) {
    const URL = getSocketBaseUrl();
    const token = getStoredToken();
    
    socket = io(URL, {
      auth: { token },
      autoConnect: false, // Connect explicitly when needed
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'], // Fallback to polling if websocket fails
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected');
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    socket.on('connect_error', (err) => {
      console.error(`[Socket] Connect error: ${err.message}`);
    });
  }
  
  if (!socket.connected) {
    socket.connect();
  }
  
  return socket;
};

export const getSocket = (): Socket => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket && socket.connected) {
    socket.disconnect();
    socket = null;
  }
};
