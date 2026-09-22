// Vercel: endpoint admin dalam 1 function (hemat kuota Hobby maks 12).
// Routes via rewrites di vercel.json:
//   /api/stats      -> /api/admin?p=stats
//   /api/client-log -> /api/admin?p=client-log
import { statsHandler, clientLog, saveCookies } from './index.js';

export default async function handler(req, res) {
  const p = req.query?.p;
  if (p === 'stats') return statsHandler(req, res);
  if (p === 'client-log') {
    if (req.method !== 'POST') return res.status(405).json({ success: false });
    return clientLog(req, res);
  }
  if (p === 'cookies') {
    if (req.method !== 'POST') return res.status(405).json({ success: false });
    return saveCookies(req, res);
  }
  return res.status(404).json({ success: false, error: 'Unknown admin endpoint.' });
}
