// Vercel: GET /api/file/:id — unduh hasil job
import { serveJobFile, apiRateLimit } from '../index.js';

export default async function handler(req, res) {
  if (!(await apiRateLimit(req, res, { max: 120 }))) return;
  return serveJobFile(req.query?.id, req, res);
}
