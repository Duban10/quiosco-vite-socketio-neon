// URL del servidor backend.
// En desarrollo apunta a localhost; en producción usa la variable VITE_SERVER_URL
// que configuras en Vercel con la URL de tu backend (Railway, Render, etc.)
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3007';
export const API_BASE   = `${SERVER_URL}/api`;
export const WS_URL     = SERVER_URL;
