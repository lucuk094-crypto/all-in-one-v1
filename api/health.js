// Vercel: GET /api/health — status backend
import { getHealth } from './index.js';

export default async function handler(req, res) {
  res.status(200).json(await getHealth());
}
