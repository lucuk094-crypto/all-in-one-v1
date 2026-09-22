// Vercel: GET /api/job/:id (status/progress) & DELETE (batalkan)
import { getJob, cancelJob, apiRateLimit } from '../index.js';

export default async function handler(req, res) {
  const id = req.query?.id;
  if (req.method === 'DELETE') {
    if (!(await apiRateLimit(req, res))) return;
    if (!cancelJob(id)) return res.status(404).json({ success: false, error: 'Job tidak ditemukan.' });
    return res.json({ success: true });
  }
  if (!(await apiRateLimit(req, res, { max: 120 }))) return;
  const j = getJob(id);
  if (!j) return res.status(404).json({ success: false, error: 'Job tidak ditemukan.' });
  res.json({ success: true, job: j });
}
