// Vercel: POST /api/job — buat job konversi (mp3/merge/trim) dengan progress
import { createJob, apiRateLimit, policyGuard } from './index.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Gunakan POST.' });
  if (!(await apiRateLimit(req, res, { max: 60, prefix: 'job_create' }))) return;
  if (!(await policyGuard(req, res))) return;
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const r = await createJob({ kind: b.kind, url: b.url, height: b.height, start: b.start, end: b.end, filename: b.filename });
  if (!r.ok) return res.status(r.status || 500).json({ success: false, error: r.error });
  res.status(200).json({ success: true, jobId: r.jobId });
}
