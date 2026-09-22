// Vercel: GET /api/env.js — konfigurasi publik format JS (window.__ENV)
import { envConfig } from './index.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__ENV=${JSON.stringify(envConfig())};`);
}
