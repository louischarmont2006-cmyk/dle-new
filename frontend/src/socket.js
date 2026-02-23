import { io } from 'socket.io-client';
import { getApiUrl } from './api.js';

// Obtenir l'URL du backend dynamiquement
const BACKEND_URL = getApiUrl();

console.log('🔌 Socket connecting to:', BACKEND_URL);

// Configuration du socket avec fallback sur polling si websocket échoue
export const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Log de connexion pour debug
socket.on('connect', () => {
  console.log('✅ Connected to backend:', BACKEND_URL);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('   Attempted URL:', BACKEND_URL);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

export default socket;