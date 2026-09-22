// Vercel: konversi langsung dalam 1 function (hemat kuota Hobby maks 12).
// Routes via rewrites di vercel.json:
//   /api/mp3   -> /api/convert?p=mp3
//   /api/merge -> /api/convert?p=merge
// Catatan: di Vercel tanpa ffmpeg, keduanya mengembalikan 501 (by design).
import { convertToFile, tryStartJob, endJob, apiRateLimit, policyGuard } from './index.js';

function guard(req, res) {
  return new Promise((resolve) => {
    if (!tryStartJob(2)) {
      res.status(429).json({ success: false, error: 'Server sedang sibuk konversi. Tunggu ±1 menit lalu coba lagi.' });
      return resolve(false);
    }
    let released = false;
    const rel = () => { if (!released) { released = true; endJob(); } };
    res.on('finish', rel);
    res.on('close', rel);
    resolve(true);
  });
}

export default async function handler(req, res) {
  if (!(await apiRateLimit(req, res))) return;
  if (!(await policyGuard(req, res))) return;
  if (!(await guard(req, res))) return;
  const p = req.query?.p;
  if (p === 'mp3') {
    return convertToFile({
      title: req.query?.filename || 'audio',
      contentType: 'audio/mpeg', ext: 'mp3', req, res, timeoutMs: 55000,
      ytdlpArgs: ['-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '192K'],
    });
  }
  if (p === 'merge') {
    const h = [360, 480, 720, 1080].includes(+req.query?.height) ? +req.query.height : 720;
    return convertToFile({
      title: req.query?.filename || `video_${h}p`,
      contentType: 'video/mp4', ext: 'mp4', req, res, timeoutMs: 55000,
      ytdlpArgs: ['-f', `bv[height<=${h}][vcodec^=avc]+ba[acodec^=mp4a]/bv[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`, '--merge-output-format', 'mp4'],
    });
  }
  return res.status(404).json({ success: false, error: 'Unknown convert endpoint.' });
}
