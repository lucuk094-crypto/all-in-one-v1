// Vercel: GET /api/config — konfigurasi publik JSON untuk frontend
import { envConfig } from './index.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json(envConfig());
}
