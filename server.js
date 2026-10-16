// server.js — Mode server penuh (VPS / lokal). Di Vercel file ini TIDAK dipakai;
// Vercel memakai api/*.js sebagai serverless functions.
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import handler, {
  proxyDownload, convertToFile, getHealth, getJob, createJob, cancelJob, serveJobFile,
  searchVideos, statsHandler, clientLog, envConfig, logReq, apiRateLimit, policyGuard, cookiesHealthHandler, saveCookies, maybeUpdateYtDlp,
  tryStartJob, endJob, YTDLP_BIN, FFMPEG_BIN, HAS_COOKIES, HAS_FFMPEG,
} from './api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', true);

app.use((req, res, next) => {
  if (req.path === '/api/admin/cookies') return express.json({ limit: '512kb' })(req, res, next);
  return express.json({ limit: '64kb' })(req, res, next);
});

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
app.all('/api/index', async (req, res) => { await handler(req, res); });
app.all('/api', async (req, res) => { await handler(req, res); });

// Proxy download langsung (bebas CORS)
app.get('/api/download', async (req, res) => { if (!(await apiRateLimit(req, res))) return; await proxyDownload(req, res); });

// MP3 192kbps
app.get('/api/mp3', jobGuardOnce, async (req, res, next) => { if (!(await apiRateLimit(req, res))) return; if (!(await policyGuard(req, res))) return; next(); }, (req, res) => {
  convertToFile({
    title: req.query.filename || 'audio',
    contentType: 'audio/mpeg', ext: 'mp3', req, res, timeoutMs: 300000,
    ytdlpArgs: ['-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '192K'],
  });
});

// HD merge: gabung video+suara (H.264 + AAC biar kompatibel)
app.get('/api/merge', jobGuardOnce, async (req, res, next) => { if (!(await apiRateLimit(req, res))) return; if (!(await policyGuard(req, res))) return; next(); }, (req, res) => {
  const h = [360, 480, 720, 1080].includes(+req.query.height) ? +req.query.height : 720;
  convertToFile({
    title: req.query.filename || `video_${h}p`,
    contentType: 'video/mp4', ext: 'mp4', req, res, timeoutMs: 600000,
    ytdlpArgs: ['-f', `bv[height<=${h}][vcodec^=avc]+ba[acodec^=mp4a]/bv[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`, '--merge-output-format', 'mp4'],
  });
});

// Jobs ber-progress: MP3 / HD-merge / trim
app.post('/api/job', async (req, res) => {
  if (!(await apiRateLimit(req, res, { max: 60, prefix: 'job_create' }))) return;
  if (!(await policyGuard(req, res))) return;
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const r = await createJob({ kind: b.kind, url: b.url, height: b.height, start: b.start, end: b.end, filename: b.filename });
  if (!r.ok) return res.status(r.status || 500).json({ success: false, error: r.error });
  res.status(200).json({ success: true, jobId: r.jobId });
});
app.get('/api/job/:id', async (req, res) => {
  if (!(await apiRateLimit(req, res, { max: 120 }))) return;
  const j = getJob(req.params.id);
  if (!j) return res.status(404).json({ success: false, error: 'Job tidak ditemukan.' });
  res.json({ success: true, job: j });
});
app.delete('/api/job/:id', async (req, res) => {
  if (!(await apiRateLimit(req, res))) return;
  if (!cancelJob(req.params.id)) return res.status(404).json({ success: false, error: 'Job tidak ditemukan.' });
  res.json({ success: true });
});
app.get('/api/file/:id', async (req, res) => { if (!(await apiRateLimit(req, res, { max: 120 }))) return; await serveJobFile(req.params.id, req, res); });

// Cari video YouTube
app.get('/api/search', async (req, res) => {
  if (!(await apiRateLimit(req, res))) return;
  if (!(await policyGuard(req, res))) return;
  const t0 = Date.now();
  const r = await searchVideos(req.query.q, req.query.max);
  if (!r.ok) {
    logReq('search', 'YouTube', false, Date.now() - t0, r.error);
    return res.status(r.status || 500).json({ success: false, error: r.error });
  }
  logReq('search', 'YouTube', true, Date.now() - t0);
  res.json({ success: true, results: r.items, items: r.items });
});

// Statistik admin + log error client + config publik
app.get('/api/stats', async (req, res) => { await statsHandler(req, res); });
app.post('/api/client-log', async (req, res) => { await clientLog(req, res); });
app.get('/api/config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(envConfig());
});
app.get('/api/env.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__ENV=${JSON.stringify(envConfig())};`);
});
app.get('/api/cookies/health', async (req, res) => { await cookiesHealthHandler(req, res); });
app.get('/api/cookies-health', async (req, res) => { await cookiesHealthHandler(req, res); });
app.post('/api/admin/cookies', async (req, res) => { await saveCookies(req, res); });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  maybeUpdateYtDlp();
  setInterval(() => maybeUpdateYtDlp(), 6 * 3600 * 1000);
  console.log(`🚀 Server jalan di http://0.0.0.0:${PORT}`);
  console.log(`   yt-dlp: ${YTDLP_BIN} | ffmpeg: ${HAS_FFMPEG ? FFMPEG_BIN : 'TIDAK ADA'} | cookies: ${HAS_COOKIES ? 'YA' : 'tidak'}`);
});
