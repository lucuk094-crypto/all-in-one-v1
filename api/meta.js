// Vercel: endpoint meta ringan dalam 1 function (hemat kuota Hobby maks 12).
// Routes via rewrites di vercel.json:
//   /api/health         -> /api/meta?p=health
//   /api/config         -> /api/meta?p=config
//   /api/env.js         -> /api/meta?p=env
//   /api/cookies-health -> /api/meta?p=cookies
import { getHealth, envConfig, cookiesHealthHandler } from './index.js';

export default async function handler(req, res) {
  const p = req.query?.p;
  if (p === 'health') return res.status(200).json(await getHealth());
  if (p === 'config') {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(envConfig());
  }
  if (p === 'env') {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(`window.__ENV=${JSON.stringify(envConfig())};`);
  }
  if (p === 'cookies') return cookiesHealthHandler(req, res);
  return res.status(404).json({ success: false, error: 'Unknown meta endpoint.' });
}
