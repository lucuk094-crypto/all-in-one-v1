// Vercel: GET /api/download — proxy download (bebas CORS)
import { proxyDownload } from './index.js';

export default async function handler(req, res) {
  return proxyDownload(req, res);
}
