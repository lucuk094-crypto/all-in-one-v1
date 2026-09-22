// Vercel: GET /api/download — proxy download (bebas CORS)
import { proxyDownload, apiRateLimit } from './index.js';

export default async function handler(req, res) {
  if (!(await apiRateLimit(req, res))) return;
  return proxyDownload(req, res);
}
