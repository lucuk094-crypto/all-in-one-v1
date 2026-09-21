// server.js — Mode server penuh (VPS / lokal). Di Vercel file ini TIDAK dipakai;
// Vercel memakai api/*.js sebagai serverless functions.
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import handler, {
  proxyDownload, convertToFile, getHealth,
  tryStartJob, endJob, YTDLP_BIN, FFMPEG_BIN, HAS_COOKIES, HAS_FFMPEG,
} from './api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', true);

app.use(express.json({ limit: '64kb' }));

/* ---------- Rate limit: 30 req/menit per IP untuk /api ---------- */
const hits = new Map();
setInterval(() => hits.clear(), 60 * 1000).unref?.();
function rateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const n = (hits.get(ip) || 0) + 1;
  hits.set(ip, n);
  if (n > 30) return res.status(429).json({ success: false, error: 'Terlalu banyak request. Tunggu sebentar lalu coba lagi.' });
  next();
}

/* ---------- Batas konversi bersamaan (MP3/HD berat, maks 2) ---------- */
function jobGuardOnce(req, res, next) {
  if (!tryStartJob(2)) {
    return res.status(429).json({ success: false, error: 'Server sedang sibuk konversi. Tunggu ±1 menit lalu coba lagi.' });
  }
  let released = false;
  const release = () => { if (!released) { released = true; endJob(); } };
  res.on('finish', release);
  res.on('close', release);
  next();
}

/* ---------- Routes ---------- */
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', async (req, res) => {
  res.json(await getHealth());
});

// Ekstrak info media
app.all('/api/index', rateLimit, async (req, res) => { await handler(req, res); });
app.all('/api', rateLimit, async (req, res) => { await handler(req, res); });

// Proxy download langsung (bebas CORS)
app.get('/api/download', rateLimit, async (req, res) => { await proxyDownload(req, res); });

// MP3 192kbps
app.get('/api/mp3', rateLimit, jobGuardOnce, (req, res) => {
  convertToFile({
    title: req.query.filename || 'audio',
    contentType: 'audio/mpeg', ext: 'mp3', req, res, timeoutMs: 300000,
    ytdlpArgs: ['-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '192K'],
  });
});

// HD merge: gabung video+suara (H.264 + AAC biar kompatibel)
app.get('/api/merge', rateLimit, jobGuardOnce, (req, res) => {
  const h = [360, 480, 720, 1080].includes(+req.query.height) ? +req.query.height : 720;
  convertToFile({
    title: req.query.filename || `video_${h}p`,
    contentType: 'video/mp4', ext: 'mp4', req, res, timeoutMs: 600000,
    ytdlpArgs: ['-f', `bv[height<=${h}][vcodec^=avc]+ba[acodec^=mp4a]/bv[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`, '--merge-output-format', 'mp4'],
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server jalan di http://0.0.0.0:${PORT}`);
  console.log(`   yt-dlp: ${YTDLP_BIN} | ffmpeg: ${HAS_FFMPEG ? FFMPEG_BIN : 'TIDAK ADA'} | cookies: ${HAS_COOKIES ? 'YA' : 'tidak'}`);
});
