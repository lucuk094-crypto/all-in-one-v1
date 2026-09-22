// Vercel: GET /api/stats?key=... — statistik admin
import { statsHandler } from './index.js';

export default async function handler(req, res) {
  return statsHandler(req, res);
}
