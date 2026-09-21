// Vercel: GET /api/merge — HD + suara (butuh ffmpeg; di Vercel tidak tersedia)
import { convertToFile, tryStartJob, endJob } from './index.js';

export default async function handler(req, res) {
  if (!tryStartJob(2)) {
    return res.status(429).json({ success: false, error: 'Server sedang sibuk konversi. Tunggu ±1 menit lalu coba lagi.' });
  }
  let released = false;
  const rel = () => { if (!released) { released = true; endJob(); } };
  res.on('finish', rel);
  res.on('close', rel);
  const h = [360, 480, 720, 1080].includes(+req.query?.height) ? +req.query.height : 720;
  return convertToFile({
    title: req.query?.filename || `video_${h}p`,
    contentType: 'video/mp4', ext: 'mp4', req, res, timeoutMs: 55000,
    ytdlpArgs: ['-f', `bv[height<=${h}][vcodec^=avc]+ba[acodec^=mp4a]/bv[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`, '--merge-output-format', 'mp4'],
  });
}
