// Vercel: GET /api/search?q=... — cari video YouTube
import { searchVideos, apiRateLimit, policyGuard, logReq } from './index.js';

export default async function handler(req, res) {
  if (!(await apiRateLimit(req, res))) return;
  if (!(await policyGuard(req, res))) return;
  const t0 = Date.now();
  const r = await searchVideos(req.query?.q ?? req.body?.q, req.query?.max ?? req.body?.max);
  if (!r.ok) {
    logReq('search', 'YouTube', false, Date.now() - t0, r.error);
    return res.status(r.status || 500).json({ success: false, error: r.error });
  }
  logReq('search', 'YouTube', true, Date.now() - t0);
  res.json({ success: true, results: r.items, items: r.items });
}
