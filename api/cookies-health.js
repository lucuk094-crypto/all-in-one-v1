// Vercel: GET /api/cookies-health — status ringan cookies server
import { cookiesHealthHandler } from './index.js';

export default async function handler(req, res) {
  return cookiesHealthHandler(req, res);
}
