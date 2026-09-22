// Vercel: GET /api/mp3 — konversi MP3 192kbps (butuh ffmpeg; di Vercel tidak tersedia)
import { convertToFile, tryStartJob, endJob, apiRateLimit, policyGuard } from './index.js';

export default async function handler(req, res) {
  if (!(await apiRateLimit(req, res))) return;
  if (!(await policyGuard(req, res))) return;
  if (!tryStartJob(2)) {
    return res.status(429).json({ success: false, error: 'Server sedang sibuk konversi. Tunggu ±1 menit lalu coba lagi.' });
  }
  let released = false;
  const rel = () => { if (!released) { released = true; endJob(); } };
  res.on('finish', rel);
  res.on('close', rel);
  return convertToFile({
    title: req.query?.filename || 'audio',
    contentType: 'audio/mpeg', ext: 'mp3', req, res, timeoutMs: 55000,
    ytdlpArgs: ['-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '192K'],
  });
}
