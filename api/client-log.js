// Vercel: POST /api/client-log — terima laporan error dari browser
import { clientLog } from './index.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false });
  return clientLog(req, res);
}
