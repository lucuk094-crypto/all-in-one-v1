// api/index.js — Backend All-in-One Downloader (yt-dlp edition, LENGKAP)
// Mendukung: video multi-resolusi, audio, gambar, carousel/album, playlist,
// MP3 & HD-merge (ditangani server.js), semua sosmed via yt-dlp.
import { spawn, execFile, execFileSync } from 'child_process';
import { existsSync, createReadStream, createWriteStream, readdirSync } from 'fs';
import { promises as fsp } from 'fs';
import { Readable } from 'stream';
import os from 'os';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.HOME || '/home/user';

// PATH: binary lokal (persisten) + deno (format YouTube lengkap)
for (const p of [`${HOME}/bin`, `${HOME}/.deno/bin`]) {
  if (!process.env.PATH.includes(p)) process.env.PATH = `${p}:${process.env.PATH}`;
}

function resolveBin(envName, names) {
  if (process.env[envName] && existsSync(process.env[envName])) return process.env[envName];
  for (const n of names) {
    if (n.includes('/')) { if (existsSync(n)) return n; continue; }
    try {
      const found = execFileSync('which', [n], { timeout: 5000 }).toString().trim().split('\n')[0];
      if (found) return found;
    } catch { /* lanjut */ }
  }
  return names[names.length - 1];
}

const VERCEL_YTDLP = path.join(__dirname, 'bin', 'yt-dlp');
export const YTDLP_BIN = (process.env.VERCEL && existsSync(VERCEL_YTDLP))
  ? VERCEL_YTDLP
  : resolveBin('YTDLP_BIN', [`${HOME}/bin/yt-dlp`, 'yt-dlp', '/usr/local/bin/yt-dlp']);
export const FFMPEG_BIN = resolveBin('FFMPEG_BIN', [`${HOME}/bin/ffmpeg`, 'ffmpeg', '/usr/local/bin/ffmpeg']);

// Deteksi ffmpeg sekali saat load (berlaku lokal & Vercel)
let FFMPEG_VER = null;
try { FFMPEG_VER = execFileSync(FFMPEG_BIN, ['-version'], { timeout: 8000 }).toString().split('\n')[0].trim(); } catch {}
export const HAS_FFMPEG = !!FFMPEG_VER;

// Cookies opsional (Netscape cookies.txt) — sangat membantu untuk IG/FB/X.
// Sumber (urutan prioritas): COOKIES_FILE, COOKIE_DIR/*.txt, cookies.txt, cookies2..5.txt.
// Multi-file = rotasi otomatis: gagal login/rate-limit di file ke-N -> coba file berikutnya.
function resolveCookieFiles() {
  const list = [];
  const push = (p) => { if (p && existsSync(p) && !list.includes(p)) list.push(p); };
  push(process.env.COOKIES_FILE);
  try {
    const dir = process.env.COOKIE_DIR;
    if (dir && existsSync(dir)) {
      for (const f of readdirSync(dir).filter((x) => /\.txt$/i.test(x)).sort()) push(path.join(dir, f));
    }
  } catch {}
  const proj = (n) => path.join(__dirname, '..', n);
  push(proj('cookies.txt'));
  for (let i = 2; i <= 5; i++) push(proj(`cookies${i}.txt`));
  return list;
}
const COOKIE_FILES = resolveCookieFiles();
export let COOKIES_FILE = COOKIE_FILES[0] || null;
export let HAS_COOKIES = !!COOKIES_FILE;
export function cookiesStatus() {
  return COOKIE_FILES.map((f) => ({ file: path.basename(f) }));
}
function refreshCookieFiles() {
  COOKIE_FILES.length = 0;
  COOKIE_FILES.push(...resolveCookieFiles());
  COOKIES_FILE = COOKIE_FILES[0] || null;
  HAS_COOKIES = !!COOKIES_FILE;
}
// Proxy opsional untuk yt-dlp (lawan rate-limit IP datacenter). Format: http://user:pass@host:port
const YTDLP_PROXY = process.env.YTDLP_PROXY || '';
function cookieArgs(idx = 0) { const f = COOKIE_FILES[idx]; return f ? ['--cookies', f] : []; }
function proxyArgs() { return YTDLP_PROXY ? ['--proxy', YTDLP_PROXY] : []; }

const YTDLP_TIMEOUT_MS = 60000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 100;
const MULTI_AUTO_MAX = 12;   // album/carousel <= N item langsung diekstrak semua
const PLAYLIST_CAP = 30;     // playlist besar: tampilkan N item pertama

const memCache = new Map();
const inflight = new Map();

/* ================= Infra: Redis opsional, rate-limit, cache, stats ================= */
// Jika UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN diset -> pakai Redis (lintas instance).
// Jika tidak -> fallback memori (mode server tunggal).
const UP_URL = process.env.UPSTASH_REDIS_REST_URL;
const UP_TOK = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_UPSTASH = !!(UP_URL && UP_TOK);

async function upstash(...args) {
  const r = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 32); }

export function getClientIp(req) {
  if (req.ip) return req.ip;
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

const rlMem = new Map();
export async function apiRateLimit(req, res, { max = 30, windowSec = 60 } = {}) {
  const ip = getClientIp(req);
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  let n = 1;
  if (USE_UPSTASH) {
    try {
      const k = `rl:${ip}:${bucket}`;
      n = await upstash('INCR', k);
      if (n === 1) await upstash('EXPIRE', k, windowSec + 10);
    } catch { n = memBump(); }
  } else {
    n = memBump();
  }
  function memBump() {
    const k = `${ip}:${bucket}`;
    const v = (rlMem.get(k) || 0) + 1;
    rlMem.set(k, v);
    if (rlMem.size > 5000) {
      for (const kk of rlMem.keys()) {
        if (+String(kk).split(':').pop() < bucket - 1) rlMem.delete(kk);
      }
    }
    return v;
  }
  try {
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - n)));
    res.setHeader('RateLimit-Reset', String((bucket + 1) * windowSec));
  } catch {}
  if (n > max) {
    res.status(429).json({ success: false, error: 'Terlalu banyak request. Tunggu sebentar lalu coba lagi.' });
    return false;
  }
  return true;
}

async function cacheGet(url) {
  const m = memCache.get(url);
  if (m && Date.now() - m.time < CACHE_TTL_MS) return { data: m.data, mem: true };
  if (USE_UPSTASH) {
    try {
      const r = await upstash('GET', `ac:${sha(url)}`);
      if (r) return { data: JSON.parse(r), mem: false };
    } catch {}
  }
  return null;
}
async function cacheSet(url, payload) {
  if (memCache.size >= CACHE_MAX) memCache.delete(memCache.keys().next().value);
  memCache.set(url, { data: payload, time: Date.now() });
  if (USE_UPSTASH) {
    try {
      const s = JSON.stringify(payload);
      if (s.length < 200000) await upstash('SET', `ac:${sha(url)}`, s, 'EX', 600);
    } catch {}
  }
}

// Statistik ringan (memori) untuk halaman admin
export const stats = {
  startedAt: Date.now(), total: 0, ok: 0, err: 0,
  byPlatform: {}, byEndpoint: {},
  jobs: { created: 0, done: 0, error: 0, cancelled: 0 },
  recent: [], errors: [], clientErrors: [],
};
export function logReq(endpoint, platform, ok, ms, err) {
  stats.total++;
  if (ok) stats.ok++; else stats.err++;
  const p = platform || '?';
  stats.byPlatform[p] = (stats.byPlatform[p] || 0) + 1;
  stats.byEndpoint[endpoint] = (stats.byEndpoint[endpoint] || 0) + 1;
  stats.recent.unshift({ t: Date.now(), ep: endpoint, p, ok: !!ok, ms: Math.round(ms || 0) });
  if (stats.recent.length > 100) stats.recent.pop();
  if (!ok && err) {
    stats.errors.unshift({ t: Date.now(), ep: endpoint, p, err: String(err).slice(0, 200) });
    if (stats.errors.length > 50) stats.errors.pop();
  }
}
export function getStats() {
  return {
    ...stats,
    uptimeSec: Math.round((Date.now() - stats.startedAt) / 1000),
    redis: USE_UPSTASH, jobsActive: jobsActiveCount(),
    recent: stats.recent.slice(0, 30), errors: stats.errors.slice(0, 20),
    clientErrors: stats.clientErrors.slice(0, 20),
  };
}

// Pelaporan error opsional via webhook (Discord/Slack/ntfy) — env ERROR_WEBHOOK
const ERR_WEBHOOK = process.env.ERROR_WEBHOOK;
export function reportError(context, err) {
  const msg = `[aio-downloader] ${context}: ${err?.message || err}`;
  console.error(msg);
  if (!ERR_WEBHOOK) return;
  fetch(ERR_WEBHOOK, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: String(msg).slice(0, 1800) }),
  }).catch(() => {});
}
if (!globalThis.__aio_err_hook) {
  globalThis.__aio_err_hook = true;
  process.on('uncaughtException', (e) => reportError('uncaughtException', e));
  process.on('unhandledRejection', (e) => reportError('unhandledRejection', e));
}

/* ================= Helpers ================= */

export function humanSize(bytes) {
  if (!bytes || bytes <= 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`;
}

export function humanDuration(sec) {
  if (!sec || sec <= 0) return '-';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Nama file aman tapi tetap mendukung huruf unicode (Indonesia/Arab/CJK/dll)
export function sanitizeFilename(name, fallback = 'media') {
  const base = String(name || '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || fallback;
  return base;
}

export function platformName(extractor) {
  const e = String(extractor || '').toLowerCase();
  const map = {
    youtube: 'YouTube', youtubetab: 'YouTube', youtubemix: 'YouTube Mix', youtubesearch: 'YouTube',
    tiktok: 'TikTok', instagram: 'Instagram', twitter: 'X (Twitter)', facebook: 'Facebook',
    soundcloud: 'SoundCloud', threads: 'Threads', pinterest: 'Pinterest', reddit: 'Reddit',
    vimeo: 'Vimeo', dailymotion: 'Dailymotion', twitch: 'Twitch', generic: 'Direct Link',
    youtubeplaylist: 'YouTube Playlist',
  };
  if (map[e]) return map[e];
  if (e.includes('youtube')) return 'YouTube';
  if (e.includes('tiktok')) return 'TikTok';
  if (e.includes('instagram')) return 'Instagram';
  if (e.includes('twitter')) return 'X (Twitter)';
  if (e.includes('facebook')) return 'Facebook';
  return extractor || 'Unknown';
}

function isBlockedHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.local') || h === '[::1]' || h === '::1') return true;
  if (!h.includes('.') && !h.includes(':')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0) return true;
  }
  if (h.startsWith('[')) return true;
  return false;
}

export function sanitizeInputUrl(raw) {
  return String(raw || '')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0*39;|&#x27;/gi, "'")
    .replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').trim();
}

export function validateTargetUrl(raw) {
  const str = sanitizeInputUrl(raw);
  if (!str) return { ok: false, error: 'URL tidak boleh kosong.' };
  if (str.length > 8192) return { ok: false, error: 'URL terlalu panjang.' };
  let u;
  try { u = new URL(str); } catch { return { ok: false, error: 'Format URL tidak valid. Contoh: https://www.tiktok.com/...' }; }
  if (!['http:', 'https:'].includes(u.protocol)) return { ok: false, error: 'URL harus diawali http:// atau https://' };
  if (isBlockedHost(u.hostname)) return { ok: false, error: 'URL internal / localhost tidak diizinkan.' };
  return { ok: true, url: u.toString() };
}

export function friendlyYtDlpError(stderr) {
  const s = String(stderr || '');
  if (/unsupported url/i.test(s)) return { status: 400, error: 'Link tidak didukung. Pastikan itu link video/foto/audio publik (TikTok, IG, YouTube, X, FB, dll).' };
  if (/private|login required|log in to|cookies.*(required|expired)|not logged/i.test(s)) return { status: 403, error: 'Konten private / butuh login (sering terjadi di IG Story & akun dikunci). Coba link publik, atau pasang cookies.txt di server.', hint: HAS_COOKIES ? 'cookies_maybe_expired' : 'need_cookies' };
  if (/not available|removed|deleted|this .* (is private|has been removed)|not found|no video could be found|no media found/i.test(s)) return { status: 404, error: 'Media tidak ditemukan. Mungkin sudah dihapus, link salah, atau postingan teks tanpa media.' };
  if (/this content is unreachable/i.test(s)) return { status: 404, error: 'Konten IG tidak bisa dijangkau (Story kedaluwarsa >24 jam / dihapus / akun private). Cek link di aplikasi IG: kalau di sana juga tidak ada, berarti sudah hilang.', hint: HAS_COOKIES ? 'cookies_maybe_expired' : 'need_cookies' };
  if (/timed out|timeout|network is unreachable|temporary failure in name resolution/i.test(s)) return { status: 504, error: 'Koneksi ke server sumber timeout. Coba lagi sebentar.' };
  if (/\[instagram\][\s\S]{0,400}no video formats found/i.test(s)) return { status: 403, error: 'Instagram menolak akses tanpa login (biasanya foto/carousel/story). Admin: pasang cookies.txt IG di server lalu coba lagi (panduan: README, cek: Admin → Cek Cookies).', hint: HAS_COOKIES ? 'cookies_maybe_expired' : 'need_cookies' };
  if (/rate-limit|too many requests|429|not granting access/i.test(s)) {
    const ig = /\[instagram\]/i.test(s);
    return { status: 429, error: ig ? 'Instagram membatasi request dari server ini (rate limit / butuh login). Tunggu ±1 menit; jika sering terjadi, admin perlu pasang cookies.txt IG di server.' : 'Platform sumber membatasi request (rate limit, sering dari IG). Tunggu ±1 menit lalu coba lagi.', hint: ig ? (HAS_COOKIES ? 'cookies_maybe_expired' : 'need_cookies') : null };
  }
  if (/empty media response/i.test(s)) return { status: 404, error: 'Instagram tidak mengembalikan media (postingan private / dihapus / ID salah). Coba link publik lain, atau pasang cookies.txt bila itu konten akun yang Anda follow.', hint: HAS_COOKIES ? 'cookies_maybe_expired' : 'need_cookies' };
  if (/ip.*block/i.test(s)) return { status: 502, error: 'IP server diblokir oleh platform sumber. Coba lagi nanti.' };
  if (/not a bot/i.test(s)) return { status: 429, error: 'YouTube meminta verifikasi bot dari IP server ini (bukan salah videonya). Tunggu 1-2 menit lalu coba lagi; bila sering, admin perlu pasang cookies YouTube / proxy.', hint: HAS_COOKIES ? 'cookies_maybe_expired' : 'need_cookies' };
  if (/confirm your age|age-gated|age.restricted/i.test(s)) return { status: 403, error: 'Video dibatasi umur. Butuh cookies YouTube dari akun yang sudah verifikasi umur (lihat Panduan).', hint: HAS_COOKIES ? 'cookies_maybe_expired' : 'need_cookies' };
  if (/premiere|upcoming|live.*(scheduled|upcoming)/i.test(s)) return { status: 400, error: 'Video belum tayang / masih premiere. Tunggu sampai rilis.' };
  const firstErr = s.split('\n').map((l) => l.replace(/^ERROR:\s*/i, '').trim()).find((l) => l && !l.startsWith('WARNING'));
  return { status: 500, error: firstErr ? `Gagal mengambil media: ${firstErr.slice(0, 220)}` : 'Gagal mengambil media dari link tersebut.' };
}

/* ================= yt-dlp runner ================= */

function baseArgs(idx = 0) {
  return ['--no-warnings', '--no-cache-dir', '--socket-timeout', '20', '--retries', '2', '--fragment-retries', '2', ...cookieArgs(idx), ...proxyArgs()];
}

function runYtDlpJson(args, timeoutMs = YTDLP_TIMEOUT_MS, cookiesIdx = 0) {
  return new Promise((resolve) => {
    const child = spawn(YTDLP_BIN, args, { timeout: timeoutMs });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; if (stdout.length > 12 * 1024 * 1024) child.kill(); });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      if (err?.code === 'ENOENT' && XRINA_ENABLED) {
        return resolve({ ok: false, status: 404, error: 'Media tidak ditemukan, akun private, atau link tidak valid.' });
      }
      resolve({ ok: false, status: 500, error: `yt-dlp tidak bisa dijalankan: ${err.message}` });
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const fr = friendlyYtDlpError(stderr);
        // Rotasi cookies: gagal karena login/rate-limit + masih ada file lain -> coba file berikut
        if ((fr.hint === 'need_cookies' || fr.hint === 'cookies_maybe_expired') && cookiesIdx + 1 < COOKIE_FILES.length) {
          const next = [...args];
          const ci = next.indexOf('--cookies');
          if (ci >= 0) next[ci + 1] = COOKIE_FILES[cookiesIdx + 1];
          else next.push('--cookies', COOKIE_FILES[cookiesIdx + 1]);
          return resolve(runYtDlpJson(next, timeoutMs, cookiesIdx + 1));
        }
        return resolve({ ok: false, ...fr, _retryable: /429|too many requests|timed out|timeout|not granting access|not a bot/i.test(stderr) });
      }
      try { resolve({ ok: true, info: JSON.parse(stdout) }); }
      catch { resolve({ ok: false, status: 500, error: 'Respon yt-dlp tidak valid.' }); }
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Full extract 1 URL (single). Retry 1x kalau rate-limit/timeout.
async function extractSingle(url) {
  let r = await runYtDlpJson([...baseArgs(), '--no-playlist', '--skip-download', '-J', url]);
  if (!r.ok && r._retryable) {
    await sleep(3000);
    r = await runYtDlpJson([...baseArgs(), '--no-playlist', '--skip-download', '-J', url]);
  }
  return r;
}

// Deteksi playlist/album: flat = cepat, tanpa unduh info tiap item
async function probeMulti(url) {
  return runYtDlpJson([...baseArgs(), '--flat-playlist', '--playlist-end', String(PLAYLIST_CAP), '--skip-download', '-J', url]);
}

function isTikTokUrl(url) {
  return /(^|\.)(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)$/i.test(safeHost(url)) || /tiktok\.com\//i.test(url);
}
function isInstagramUrl(url) {
  const h = safeHost(url);
  return /(^|\.)(instagram\.com|instagr\.am|ig\.me)$/i.test(h) || /instagram\.com\//i.test(url);
}
function isYouTubeUrl(url) {
  const h = safeHost(url);
  return /(^|\.)(youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com)$/i.test(h) || /(youtube\.com|youtu\.be)\//i.test(url);
}
function isYouTubePlaylistOnlyUrl(url) {
  return isYouTubeUrl(url) && /[?&]list=/i.test(url) && !/[?&]v=|youtu\.be\/|\/shorts\/|\/live\//i.test(url);
}
function isFacebookUrl(url) {
  const h = safeHost(url);
  return /(^|\.)(facebook\.com|fb\.com|fb\.watch|m\.facebook\.com|web\.facebook\.com)$/i.test(h) || /(facebook\.com|fb\.watch|fb\.com)\//i.test(url);
}
function isTwitterUrl(url) {
  const h = safeHost(url);
  return /(^|\.)(x\.com|twitter\.com|mobile\.twitter\.com|t\.co|fxtwitter\.com|vxtwitter\.com)$/i.test(h) || /(x\.com|twitter\.com)\//i.test(url);
}
function safeHost(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

/* ================= Mapping format -> downloads ================= */

function bestThumb(info) {
  if (info.thumbnail) return info.thumbnail;
  const t = info.thumbnails;
  if (Array.isArray(t) && t.length) return t[t.length - 1]?.url || t[0]?.url || null;
  return null;
}

const shortSide = (f) => (f.width && f.height ? Math.min(f.width, f.height) : (f.height || f.width || 0));

const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'mkv', '3gp', 'flv', 'm4v']);
const AUDIO_EXTS = new Set(['mp3', 'm4a', 'aac', 'opus', 'ogg', 'wav', 'weba', 'flac', 'wma']);

function qualityLabel(f) {
  const ss = shortSide(f);
  if (ss) return `${ss}p`;
  if (f.resolution && !/audio only/i.test(f.resolution)) return f.resolution;
  const tbr = f.tbr || f.abr || 0;
  if (tbr >= 1500) return 'HD';
  if (tbr >= 600) return 'SD';
  if (tbr > 0) return 'LD';
  if (f.format_note) return f.format_note;
  return 'Original';
}

function pickDownloads(info) {
  const all = (info.formats || []).filter((f) =>
    f?.url && typeof f.url === 'string' && f.url.startsWith('http') && !['mhtml', 'none'].includes(f.ext)
  );
  const progressive = all.filter((f) => ['https', 'http'].includes(f.protocol));
  const formats = progressive.length ? progressive : all;
  const thumb = bestThumb(info);
  const isTikTok = /tiktok/i.test(String(info.extractor || ''));

  const hasV = (f) => f.vcodec && f.vcodec !== 'none';
  const hasA = (f) => f.acodec && f.acodec !== 'none';
  const unknownCodecs = (f) => !f.vcodec && !f.acodec;

  const combined = formats
    .filter((f) => (hasV(f) && hasA(f)) || (unknownCodecs(f) && VIDEO_EXTS.has(f.ext)))
    .sort((a, b) => (shortSide(b) - shortSide(a)) || (b.tbr || 0) - (a.tbr || 0) || (b.filesize_approx || b.filesize || 0) - (a.filesize_approx || a.filesize || 0));
  const videoOnly = formats
    .filter((f) => hasV(f) && !hasA(f) && !unknownCodecs(f))
    .sort((a, b) => (shortSide(b) - shortSide(a)) || (b.tbr || 0) - (a.tbr || 0));
  const audioOnly = formats
    .filter((f) => (!hasV(f) && hasA(f)) || (unknownCodecs(f) && AUDIO_EXTS.has(f.ext)))
    .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));

  const wmTag = (label) => {
    if (!isTikTok) return label;
    if (/no[\s_-]?wm|no[\s_-]?watermark/i.test(label)) return label;
    if (/watermark/i.test(label)) return 'With Watermark';
    return `${label} • No WM`;
  };

  const video = [];
  const seenRes = new Set();
  const labelCount = {};
  const ordered = [...combined.filter((f) => f.ext === 'mp4'), ...combined.filter((f) => f.ext !== 'mp4')];
  for (const f of ordered) {
    let label = wmTag(qualityLabel(f));
    const key = label + '|' + (f.ext || '') + '|' + Math.round((f.tbr || 0) / 100);
    if (seenRes.has(key)) continue;
    seenRes.add(key);
    // Label kembar (encode beda, misal h264 vs h265): bedakan dengan codec
    labelCount[label] = (labelCount[label] || 0) + 1;
    if (labelCount[label] > 1 && f.vcodec) {
      const short = /h265|hevc|hvc1|bytevc1/i.test(f.vcodec) ? 'H265' : (/vp9|av01/i.test(f.vcodec) ? f.vcodec.split('.')[0].toUpperCase() : 'ALT');
      label = `${label} (${short})`;
    }
    video.push({
      type: 'video', url: f.url, quality: label,
      extension: f.ext || 'mp4', filesize: f.filesize_approx || f.filesize || null,
      filesize_label: humanSize(f.filesize_approx || f.filesize),
      thumbnail: thumb, has_audio: true,
    });
    if (video.length >= 5) break;
  }

  // Video tanpa suara (khas YouTube/IG/FB): kelompokkan per tinggi, utamakan mp4
  const byHeight = new Map();
  for (const f of videoOnly) {
    const ss = shortSide(f);
    if (!ss) continue;
    if (!byHeight.has(ss)) byHeight.set(ss, []);
    byHeight.get(ss).push(f);
  }
  const heights = [...byHeight.keys()].sort((a, b) => b - a);
  const combinedMax = Math.max(0, ...video.filter((v) => v.has_audio).map((v) => parseInt(v.quality) || 0));
  const pickedSilent = [];
  for (const h of heights) {
    if (h <= combinedMax) continue;
    const group = byHeight.get(h).sort((a, b) => (a.ext === 'mp4' ? 0 : 1) - (b.ext === 'mp4' ? 0 : 1) || (b.tbr || 0) - (a.tbr || 0));
    pickedSilent.push(group[0]);
    if (pickedSilent.length >= 2) break;
  }
  // Pastikan ada opsi <=1080p (2160p doang kegedean & tanpa suara)
  if (pickedSilent.length && Math.min(...pickedSilent.map(shortSide)) > 1080) {
    const under = heights.filter((h) => h <= 1080 && h > combinedMax);
    if (under.length) {
      const group = byHeight.get(under[0]).sort((a, b) => (a.ext === 'mp4' ? 0 : 1) - (b.ext === 'mp4' ? 0 : 1));
      pickedSilent.push(group[0]);
    }
  }
  for (const f of pickedSilent) {
    video.push({
      type: 'video', url: f.url, quality: `${shortSide(f)}p (tanpa suara)`,
      extension: f.ext || 'mp4', filesize: f.filesize_approx || f.filesize || null,
      filesize_label: humanSize(f.filesize_approx || f.filesize),
      thumbnail: thumb, has_audio: false,
    });
  }

  const audio = [];
  const seenA = new Set();
  for (const f of audioOnly) {
    const q = (f.abr || f.tbr) ? `Audio ${Math.round(f.abr || f.tbr)}kbps` : 'Audio';
    const key = q + '|' + (f.ext || '');
    if (seenA.has(key)) continue;
    seenA.add(key);
    audio.push({
      type: 'audio', url: f.url, quality: q,
      extension: f.ext === 'webm' ? 'weba' : (f.ext || 'm4a'),
      filesize: f.filesize_approx || f.filesize || null,
      filesize_label: humanSize(f.filesize_approx || f.filesize),
      thumbnail: thumb, has_audio: true,
    });
    if (audio.length >= 2) break;
  }

  const image = [];
  const seenImg = new Set();
  for (const f of formats.filter((x) => ['jpg', 'jpeg', 'png', 'webp'].includes(x.ext))) {
    if (seenImg.has(f.url)) continue;
    seenImg.add(f.url);
    image.push({
      type: 'image', url: f.url, quality: f.resolution || `${f.width || ''}${f.width ? 'px' : 'Foto'}`,
      extension: f.ext === 'jpeg' ? 'jpg' : f.ext, filesize: f.filesize || null,
      filesize_label: humanSize(f.filesize), thumbnail: f.url, has_audio: false,
    });
    if (image.length >= 10) break;
  }

  if (!video.length && !audio.length && !image.length && formats.length) {
    const f = formats[0];
    video.push({
      type: 'video', url: f.url, quality: 'Original', extension: f.ext || 'mp4',
      filesize: f.filesize || null, filesize_label: humanSize(f.filesize),
      thumbnail: thumb, has_audio: true,
    });
  }

  const maxSplit = videoOnly.length ? Math.max(...videoOnly.map(shortSide)) : 0;
  return { video, audio, image, has_split: maxSplit > 0, max_split_height: maxSplit };
}

function buildInfo(info, originalUrl, extra = {}) {
  return {
    title: info.title || 'Tanpa Judul',
    thumbnail: bestThumb(info),
    duration: info.duration || null,
    duration_label: humanDuration(info.duration),
    uploader: info.uploader || info.channel || info.artist || info.owner || null,
    platform: platformName(info.extractor),
    webpage_url: info.webpage_url || originalUrl,
    ...extra,
  };
}

// Fallback khusus TikTok via API publik tikwm
async function fetchTikWmFallback(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
    clearTimeout(t);
    const json = await res.json();
    if (json?.code !== 0 || !json?.data) return null;
    const d = json.data;
    const video = [], audio = [], image = [];
    const cover = d.cover || d.origin_cover || d.ai_dynamic_cover || null;
    if (d.play) video.push({ type: 'video', url: d.play, quality: 'HD • No WM', extension: 'mp4', filesize: d.size || null, filesize_label: humanSize(d.size), thumbnail: cover, has_audio: true });
    if (d.hdplay && d.hdplay !== d.play) video.push({ type: 'video', url: d.hdplay, quality: 'Full HD • No WM', extension: 'mp4', filesize: null, filesize_label: 'Unknown', thumbnail: cover, has_audio: true });
    if (d.wmplay) video.push({ type: 'video', url: d.wmplay, quality: 'With Watermark', extension: 'mp4', filesize: null, filesize_label: 'Unknown', thumbnail: cover, has_audio: true });
    if (d.music) audio.push({ type: 'audio', url: d.music, quality: 'Original Sound', extension: 'mp3', filesize: null, filesize_label: 'Unknown', thumbnail: cover, has_audio: true });
    // TikTok photo-mode: images[]
    if (Array.isArray(d.images)) {
      d.images.slice(0, 10).forEach((src, i) => {
        if (typeof src === 'string') image.push({ type: 'image', url: src, quality: `Foto ${i + 1} • No WM`, extension: 'jpg', filesize: null, filesize_label: 'Unknown', thumbnail: src, has_audio: false });
      });
    }
    if (!video.length && !audio.length && !image.length) return null;
    return {
      downloads: { video, audio, image, subtitles: [] },
      info: {
        title: d.title || 'TikTok Video',
        thumbnail: cover,
        duration: d.duration || null,
        duration_label: humanDuration(d.duration),
        uploader: d.author?.nickname || d.author?.unique_id || 'TikTok',
        platform: 'TikTok',
        webpage_url: url,
      },
    };
  } catch { return null; }
}

// Ekstrak banyak URL anak (carousel/album) dengan batas konkurensi
async function extractChildren(urls, limit = 4) {
  const results = [];
  const queue = [...urls];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const u = queue.shift();
      try {
        const r = await extractSingle(u);
        results.push({ url: u, ...r });
      } catch (e) {
        results.push({ url: u, ok: false, error: String(e?.message || e) });
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/* ================= Orkestrasi utama ================= */

const DIRECT_EXT = {
  mp4: 'video', m4v: 'video', webm: 'video', mov: 'video', mkv: 'video',
  mp3: 'audio', m4a: 'audio', aac: 'audio', wav: 'audio', ogg: 'audio', opus: 'audio', flac: 'audio',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image', svg: 'image',
};
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Link file media langsung (https://.../video.mp4): tanpa yt-dlp, verifikasi via HEAD/Range
async function tryDirectFile(url) {
  let ext = '';
  try {
    const m = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (!m) return null;
    ext = m[1].toLowerCase();
  } catch { return null; }
  const kind = DIRECT_EXT[ext];
  if (!kind) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': BROWSER_UA, Accept: '*/*' } });
    if (!r.ok) {
      r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': BROWSER_UA, Range: 'bytes=0-0', Accept: '*/*' } });
    }
    clearTimeout(timer);
    if (!r.ok && r.status !== 206) return null;
    const ct = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (ct.startsWith('text/html') || !ct) return null;
    let len = +r.headers.get('content-length') || 0;
    if (!len && r.status === 206) {
      const cr = r.headers.get('content-range') || '';
      const tm = cr.match(/\/(\d+)$/);
      if (tm) len = +tm[1];
    }
    let fname = 'media';
    try { fname = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'media').slice(0, 80); } catch {}
    const item = {
      type: kind, url, quality: 'Original', extension: ext,
      filesize: len || null, filesize_label: humanSize(len),
      thumbnail: kind === 'image' ? url : null,
      has_audio: kind !== 'image',
    };
    const downloads = { video: [], audio: [], image: [], subtitles: [] };
    downloads[kind].push(item);
    const known = platformFromUrl(url);
    return {
      source: 'direct', downloads,
      data: [item],
      info: {
        title: fname, thumbnail: item.thumbnail, duration: null, duration_label: '-',
        uploader: null, platform: known === 'Direct Link' ? 'Direct File' : known,
        webpage_url: url,
      },
      original_url: url,
    };
  } catch { return null; }
}

export async function extractMedia(rawUrl) {
  const v = validateTargetUrl(rawUrl);
  if (!v.ok) return { ok: false, status: 400, error: v.error };
  const url = v.url;

  const hit = await cacheGet(url);
  if (hit) return { ok: true, cached: true, ...hit.data };
  const direct = await tryDirectFile(url);
  if (direct) { await cacheSet(url, direct); return { ok: true, ...direct }; }
  if (inflight.has(url)) {
    try { return await inflight.get(url); } catch { /* lanjut */ }
  }

  const job = (async () => {
    // 0) Utama: API Xrina (apiii-xrina.my.id) untuk TikTok, Instagram, YouTube (+MP3), Facebook, Twitter/X
    if (XRINA_ENABLED && !isYouTubePlaylistOnlyUrl(url)) {
      const xr = await fetchXrina(url);
      if (xr) {
        const payload = {
          source: xr.source || 'xrina',
          downloads: xr.downloads,
          data: [...xr.downloads.video, ...xr.downloads.audio, ...xr.downloads.image],
          info: xr.info,
          original_url: url,
        };
        await cacheSet(url, payload);
        return { ok: true, ...payload };
      }
    }

    if (NEXA_FIRST && (isInstagramUrl(url) || isFacebookUrl(url))) {
      const nx = await fetchNexa(url);
      if (nx) {
        const payload = { source: 'nexa', downloads: nx.downloads, info: nx.info, original_url: url };
        payload.data = [...nx.downloads.video, ...nx.downloads.audio, ...nx.downloads.image];
        await cacheSet(url, payload);
        return { ok: true, ...payload };
      }
    }

    // 1) Probe dulu: single atau multi (playlist/album/carousel)?
    let probe = await probeMulti(url);
    if (!probe.ok && probe._retryable) {
      await sleep(3000);
      probe = await probeMulti(url);
    }

    // 1a) Multi-entry (playlist / album / carousel / highlights)
    if (probe.ok && Array.isArray(probe.info?.entries) && probe.info.entries.length > 1) {
      const entries = probe.info.entries.filter((e) => e && (e.url || e.webpage_url));
      const parentTitle = probe.info.title || 'Album / Playlist';

      // Album kecil (carousel IG, photo dump, dsb): ekstrak semua otomatis
      if (entries.length <= MULTI_AUTO_MAX) {
        const childUrls = entries.map((e) => e.webpage_url || e.url);
        const kids = await extractChildren(childUrls);
        const okKids = kids.filter((k) => k.ok);
        if (!okKids.length) {
          return { ok: false, status: 404, error: 'Semua item di album ini gagal diambil (kemungkinan private / butuh login).' };
        }
        const video = [], audio = [], image = [];
        const items = [];
        okKids.forEach((k, i) => {
          const d = pickDownloads(k.info);
          const th = bestThumb(k.info);
          const label = k.info.title || `Item ${i + 1}`;
          d.video.slice(0, 1).forEach((m) => video.push({ ...m, quality: `${m.quality} — ${label.slice(0, 40)}` }));
          if (!d.video.length && d.image.length) d.image.slice(0, 2).forEach((m) => image.push(m));
          if (d.image.length && d.video.length) d.image.slice(0, 1).forEach((m) => image.push(m));
          items.push({ title: label, thumbnail: th, duration: k.info.duration || null, duration_label: humanDuration(k.info.duration), url: k.info.webpage_url || childUrls[i] });
        });
        const payload = {
          source: 'yt-dlp', is_album: true,
          downloads: { video: video.slice(0, 12), audio: [], image: image.slice(0, 12), subtitles: [] },
          info: buildInfo({ ...probe.info, title: `${parentTitle} (${okKids.length} item)` }, url),
          items, original_url: url,
        };
        payload.data = [...payload.downloads.video, ...payload.downloads.image];
        await cacheSet(url, payload);
        return { ok: true, ...payload };
      }

      // Playlist besar: kembalikan daftar item (2 langkah: pilih -> proses)
      const items = entries.slice(0, PLAYLIST_CAP).map((e) => ({
        title: e.title || 'Tanpa judul',
        thumbnail: e.thumbnail || (Array.isArray(e.thumbnails) && e.thumbnails.length ? e.thumbnails[e.thumbnails.length - 1]?.url : null),
        duration: e.duration || null,
        duration_label: humanDuration(e.duration),
        url: e.webpage_url || e.url,
      })).filter((i) => i.url);
      const payload = {
        source: 'yt-dlp', is_playlist: true,
        playlist: { title: probe.info.title || 'Playlist', total: probe.info.playlist_count || entries.length, shown: items.length },
        items, downloads: { video: [], audio: [], image: [], subtitles: [] }, data: [],
        info: buildInfo({ ...probe.info, title: probe.info.title || 'Playlist' }, url),
        original_url: url,
      };
      await cacheSet(url, payload);
      return { ok: true, ...payload };
    }

    // 2) Single: pakai hasil probe kalau sudah ada formats, kalau tidak full-extract
    let info = probe.ok && !probe.info?.entries ? probe.info : null;
    if (!info || !Array.isArray(info.formats) || !info.formats.length) {
      const single = await extractSingle(url);
      if (!single.ok) {
        if (XRINA_ENABLED) {
          const xrAio = await fetchXrinaAio(url);
          if (xrAio) {
            const payload = { source: xrAio.source || 'xrina-aio', downloads: xrAio.downloads, info: xrAio.info, original_url: url };
            payload.data = [...xrAio.downloads.video, ...xrAio.downloads.audio, ...xrAio.downloads.image];
            await cacheSet(url, payload);
            return { ok: true, ...payload };
          }
        }
        if (isTikTokUrl(url)) {
          const fb = await fetchTikWmFallback(url);
          if (fb) {
            const payload = { source: 'tikwm-fallback', downloads: fb.downloads, info: fb.info, original_url: url };
            payload.data = [...fb.downloads.video, ...fb.downloads.audio, ...fb.downloads.image];
            await cacheSet(url, payload);
            return { ok: true, ...payload };
          }
        }
        if (isInstagramUrl(url) || isFacebookUrl(url)) {
          const nx = await fetchNexa(url);
          if (nx) {
            const payload = { source: 'nexa-fallback', downloads: nx.downloads, info: nx.info, original_url: url };
            payload.data = [...nx.downloads.video, ...nx.downloads.audio, ...nx.downloads.image];
            await cacheSet(url, payload);
            return { ok: true, ...payload };
          }
        }
        const cb = await fetchCobalt(url);
        if (cb) {
          const payload = { source: 'cobalt-fallback', downloads: cb.downloads, info: cb.info, original_url: url };
          payload.data = [...cb.downloads.video, ...cb.downloads.audio, ...cb.downloads.image];
          await cacheSet(url, payload);
          return { ok: true, ...payload };
        }
        return single;
      }
      info = single.info;
    }

    const picked = pickDownloads(info);
    const downloads = { video: picked.video, audio: picked.audio, image: picked.image, subtitles: pickSubtitles(info) };
    if (!downloads.video.length && !downloads.audio.length && !downloads.image.length) {
      if (XRINA_ENABLED) {
        const xrAio = await fetchXrinaAio(url);
        if (xrAio) {
          const payload = { source: xrAio.source || 'xrina-aio', downloads: xrAio.downloads, info: xrAio.info, original_url: url };
          payload.data = [...xrAio.downloads.video, ...xrAio.downloads.audio, ...xrAio.downloads.image];
          await cacheSet(url, payload);
          return { ok: true, ...payload };
        }
      }
      if (isTikTokUrl(url)) {
        const fb = await fetchTikWmFallback(url);
        if (fb) {
          const payload = { source: 'tikwm-fallback', downloads: fb.downloads, info: fb.info, original_url: url };
          payload.data = [...fb.downloads.video, ...fb.downloads.audio, ...fb.downloads.image];
          await cacheSet(url, payload);
          return { ok: true, ...payload };
        }
      }
      if (isInstagramUrl(url) || isFacebookUrl(url)) {
        const nx = await fetchNexa(url);
        if (nx) {
          const payload = { source: 'nexa-fallback', downloads: nx.downloads, info: nx.info, original_url: url };
          payload.data = [...nx.downloads.video, ...nx.downloads.audio, ...nx.downloads.image];
          await cacheSet(url, payload);
          return { ok: true, ...payload };
        }
      }
      const cb2 = await fetchCobalt(url);
      if (cb2) {
        const payload = { source: 'cobalt-fallback', downloads: cb2.downloads, info: cb2.info, original_url: url };
        payload.data = [...cb2.downloads.video, ...cb2.downloads.audio, ...cb2.downloads.image];
        await cacheSet(url, payload);
        return { ok: true, ...payload };
      }
      return { ok: false, status: 404, error: 'Tidak ada file yang bisa diunduh dari link ini.' };
    }

    const payload = {
      source: 'yt-dlp', downloads,
      data: [...downloads.video, ...downloads.audio, ...downloads.image], // kompatibel frontend lama
      info: buildInfo(info, url, {
        has_split: picked.has_split,
        merge_heights: picked.has_split
          ? [...new Set([720, 1080].filter((h) => picked.max_split_height >= h))].sort((a, b) => b - a)
          : [],
      }),
      original_url: url,
    };
    await cacheSet(url, payload);
    return { ok: true, ...payload };
  })();

  inflight.set(url, job);
  try { return await job; } finally { inflight.delete(url); }
}

/* ================= Fitur: subtitle, search, cobalt, jobs ================= */

function platformFromUrl(url) {
  const h = safeHost(url);
  if (h.includes('tiktok')) return 'TikTok';
  if (h.includes('instagram')) return 'Instagram';
  if (h.includes('youtube') || h.includes('youtu.be')) return 'YouTube';
  if (h.includes('facebook') || h.includes('fb.')) return 'Facebook';
  if (h === 'x.com' || h.includes('twitter')) return 'X (Twitter)';
  if (h.includes('soundcloud')) return 'SoundCloud';
  if (h.includes('threads')) return 'Threads';
  if (h.includes('pinterest') || h === 'pin.it') return 'Pinterest';
  if (h.includes('reddit') || h === 'redd.it') return 'Reddit';
  if (h.includes('vimeo')) return 'Vimeo';
  if (h.includes('dailymotion') || h === 'dai.ly') return 'Dailymotion';
  if (h.includes('twitch')) return 'Twitch';
  if (h.includes('kick.com')) return 'Kick';
  if (h.includes('likee') || h.includes('l.likee')) return 'Likee';
  if (h.includes('snackvideo') || h.includes('snack-video')) return 'SnackVideo';
  if (h.includes('capcut')) return 'CapCut';
  if (h.includes('bilibili') || h === 'b23.tv') return 'Bilibili';
  if (h.includes('douyin')) return 'Douyin';
  if (h.includes('xiaohongshu') || h.includes('xhslink')) return 'Xiaohongshu';
  if (h.includes('vk.com') || h.includes('vkontakte')) return 'VK';
  if (h.includes('ok.ru') || h.includes('odnoklassniki')) return 'OK.ru';
  if (h.includes('rutube')) return 'Rutube';
  if (h.includes('t.me') || h.includes('telegram')) return 'Telegram';
  if (h.includes('snapchat')) return 'Snapchat';
  if (h.includes('spotify')) return 'Spotify';
  if (h === 't.co') return 'X (Twitter)';
  if (h.includes('streamable')) return 'Streamable';
  if (h.includes('rumble')) return 'Rumble';
  if (h.includes('odysee')) return 'Odysee';
  if (h.includes('bandcamp')) return 'Bandcamp';
  if (h.includes('mixcloud')) return 'Mixcloud';
  if (h.includes('audiomack')) return 'Audiomack';
  if (h.includes('tumblr')) return 'Tumblr';
  if (h.includes('flickr')) return 'Flickr';
  if (h.includes('imgur')) return 'Imgur';
  if (h.includes('giphy')) return 'Giphy';
  if (h.includes('tenor')) return 'Tenor';
  if (h.includes('drive.google') || h.includes('docs.google')) return 'Google Drive';
  if (h.includes('dropbox')) return 'Dropbox';
  if (h.includes('mediafire')) return 'MediaFire';
  return 'Direct Link';
}

function pickSubtitles(info) {
  const out = [];
  const seen = new Set();
  const pushGroup = (dict, auto) => {
    if (!dict) return;
    const langs = Object.keys(dict).sort((a, b) =>
      ((b === 'id') - (a === 'id')) || ((b === 'en') - (a === 'en')));
    for (const lang of langs) {
      if (out.length >= 10) break;
      const arr = dict[lang] || [];
      const pref = arr.find((f) => ['vtt', 'srv1', 'srv2', 'srv3', 'ttml'].includes(f.ext)) || arr[0];
      if (!pref?.url) continue;
      const key = `${lang}|${auto ? 'a' : 'm'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ lang, name: pref.name || lang, ext: pref.ext || 'vtt', url: pref.url, auto: !!auto });
    }
  };
  pushGroup(info.subtitles, false);
  if (out.length < 10) pushGroup(info.automatic_captions, true);
  return out;
}

function mapFlatItem(e) {
  return {
    title: e.title || 'Tanpa judul',
    thumbnail: e.thumbnail || (Array.isArray(e.thumbnails) && e.thumbnails.length ? e.thumbnails[e.thumbnails.length - 1]?.url : null),
    duration: e.duration || null,
    duration_label: humanDuration(e.duration),
    url: e.webpage_url || e.url,
    channel: e.channel || e.uploader || null,
  };
}

export async function searchVideos(q, max = 10) {
  q = String(q || '').trim().slice(0, 100);
  if (!q) return { ok: false, status: 400, error: 'Kata kunci pencarian kosong.' };
  max = Math.min(Math.max(parseInt(max) || 10, 1), 20);
  if (XRINA_ENABLED) {
    try {
      const j = await xrinaFetchJson(`/search/ytsearch?q=${encodeURIComponent(q)}`, 30000);
      if (j && j.status === true && Array.isArray(j.data) && j.data.length) {
        const items = j.data.slice(0, max).map((e) => ({
          title: e.title || 'Tanpa judul',
          thumbnail: e.thumbnail || null,
          duration: null,
          duration_label: e.duration || '-',
          url: e.url || (e.video_id ? `https://www.youtube.com/watch?v=${e.video_id}` : null),
          channel: e.author || e.channel || null,
        })).filter((i) => i.url);
        if (items.length) return { ok: true, items };
      }
    } catch {}
  }
  const r = await runYtDlpJson([...baseArgs(), '--flat-playlist', '--playlist-end', String(max), '--skip-download', '-J', `ytsearch${max}:${q}`], 90000);
  if (!r.ok) return r;
  const items = (r.info?.entries || []).map(mapFlatItem).filter((i) => i.url);
  if (!items.length) return { ok: false, status: 404, error: 'Tidak ada hasil untuk kata kunci itu.' };
  return { ok: true, items };
}

/* ============ API Utama Xrina (https://apiii-xrina.my.id) ============
   1. TikTok    : GET /download/tt-dl2?url=...
   2. Instagram : GET /download/instagram?url=...
   3. YouTube   : GET /download/youtube-dl?url=...
   4. YT MP3    : GET /download/ytmp3?url=...
   5. Facebook  : GET /download/facebook?url=...
   6. Twitter/X : GET /download/twitterdl?url=... */
export const XRINA_API_BASE = (process.env.XRINA_API_BASE || 'https://apiii-xrina.my.id').replace(/\/$/, '');
const XRINA_ENABLED = process.env.XRINA_ENABLED !== '0';

async function xrinaFetchJson(endpointPath, timeoutMs = 45000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${XRINA_API_BASE}${endpointPath}`, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      });
      clearTimeout(t);
      const j = await res.json().catch(() => null);
      if (j && typeof j === 'object') return j;
    } catch {
      clearTimeout(t);
    }
    if (attempt === 0) await sleep(1500);
  }
  return null;
}

function isSnapinstaErrorUrl(u) {
  try {
    const parsed = new URL(u);
    const tok = parsed.searchParams.get('token');
    if (tok) {
      const dec = Buffer.from(tok, 'base64').toString('utf8');
      if (/snapinsta-app-error|promo\/snapinsta/i.test(dec)) return true;
    }
  } catch {}
  return /snapinsta-app-error/i.test(String(u || ''));
}

// 1. TikTok: /download/tt-dl2?url=...
export async function fetchXrinaTikTok(url) {
  try {
    const j = await xrinaFetchJson(`/download/tt-dl2?url=${encodeURIComponent(url)}`);
    if (!j || j.status !== true || !j.data) return null;
    const d = j.data;
    const rawMedia = Array.isArray(d.media) ? d.media : (typeof d.media === 'string' ? [d.media] : []);
    const validMedia = rawMedia.filter((u) => typeof u === 'string' && u.startsWith('http')).slice(0, 12);
    const musicUrl = (typeof d.music === 'string' && d.music.startsWith('http')) ? d.music : null;
    if (!validMedia.length && !musicUrl) return null;

    const isPhotoMode = /image|photo|slide/i.test(String(d.type || ''));
    const rawCover = d.thumbnail || d.cover || d.origin_cover || null;
    const [mediaSizes, musicSize, oembedCover] = await Promise.all([
      Promise.all(validMedia.map((u) => probeSize(u, 6000))),
      musicUrl ? probeSize(musicUrl, 6000) : Promise.resolve(0),
      rawCover ? Promise.resolve(null) : (async () => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 3500);
          const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: ctrl.signal, headers: { 'User-Agent': BROWSER_UA } });
          clearTimeout(t);
          if (!r.ok) return null;
          const oj = await r.json();
          return oj?.thumbnail_url || null;
        } catch { return null; }
      })(),
    ]);

    const video = [], audio = [], image = [];
    const cover = rawCover || oembedCover || null;

    validMedia.forEach((src, i) => {
      const sz = mediaSizes[i] || null;
      const looksImg = isPhotoMode || /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(src) || /mime_type=image/i.test(src);
      if (looksImg) {
        image.push({
          type: 'image', url: src,
          quality: `Foto ${i + 1} • No WM`,
          extension: 'jpg',
          filesize: sz, filesize_label: humanSize(sz),
          thumbnail: src, has_audio: false,
        });
      } else {
        video.push({
          type: 'video', url: src,
          quality: validMedia.length > 1 ? `HD ${i + 1} • No WM` : 'HD • No WM',
          extension: 'mp4',
          filesize: sz, filesize_label: humanSize(sz),
          thumbnail: cover, has_audio: true,
        });
      }
    });

    if (musicUrl) {
      audio.push({
        type: 'audio', url: musicUrl,
        quality: 'Original Sound (MP3)',
        extension: 'mp3',
        filesize: musicSize || null, filesize_label: humanSize(musicSize),
        thumbnail: cover || image[0]?.url || null,
        has_audio: true,
      });
    }

    return {
      source: 'xrina-tiktok',
      downloads: { video, audio, image, subtitles: [] },
      info: {
        title: d.title || 'TikTok Media',
        thumbnail: cover || image[0]?.url || null,
        duration: d.duration || null,
        duration_label: humanDuration(d.duration),
        uploader: d.author?.nickname || d.author?.username || d.author?.unique_id || 'TikTok',
        platform: 'TikTok',
        webpage_url: url,
      },
    };
  } catch { return null; }
}

// 2. Instagram: /download/instagram?url=...
export async function fetchXrinaInstagram(url) {
  try {
    const j = await xrinaFetchJson(`/download/instagram?url=${encodeURIComponent(url)}`);
    if (j && j.status === true && j.data) {
      const d = j.data;
      const rawList = Array.isArray(d.media) ? d.media : (Array.isArray(d) ? d : []);
      const items = [];
      const seen = new Set();
      rawList.slice(0, 12).forEach((it, i) => {
        const src = typeof it === 'string' ? it : (it?.url || it?.downloadUrl || it?.download_url);
        if (!src || typeof src !== 'string' || !src.startsWith('http') || seen.has(src)) return;
        if (isSnapinstaErrorUrl(src)) return;
        seen.add(src);
        let decUrl = '';
        try {
          const tok = new URL(src).searchParams.get('token');
          if (tok) decUrl = Buffer.from(tok, 'base64').toString('utf8');
        } catch {}
        const ty = String(it?.type || (src.includes('type=jpg') || src.includes('type=image') ? 'image' : '')).toLowerCase();
        const looksImg = /jpe?g|png|webp|gif|image|photo/.test(ty)
          || /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(src)
          || /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(decUrl);
        items.push({
          type: looksImg ? 'image' : 'video',
          url: src,
          quality: looksImg ? `Foto ${i + 1}` : (items.filter((x) => x.type === 'video').length === 0 ? 'HD' : `Video ${i + 1}`),
          extension: looksImg ? 'jpg' : 'mp4',
          has_audio: !looksImg,
        });
      });

      if (items.length) {
        const sizes = await Promise.all(items.map((m) => probeSize(m.url, 6000)));
        const video = [], audio = [], image = [];
        items.forEach((m, i) => {
          const sz = sizes[i] || null;
          const full = {
            ...m,
            filesize: sz, filesize_label: humanSize(sz),
            thumbnail: m.type === 'image' ? m.url : (d.thumbnail || null),
          };
          (m.type === 'image' ? image : video).push(full);
        });
        return {
          source: 'xrina-instagram',
          downloads: { video, audio, image, subtitles: [] },
          info: {
            title: d.title || 'Instagram Media',
            thumbnail: d.thumbnail || image[0]?.url || null,
            duration: d.duration || null,
            duration_label: humanDuration(d.duration),
            uploader: d.owner || d.author || 'Instagram',
            platform: 'Instagram',
            webpage_url: url,
          },
        };
      }
    }
    // Jika /download/instagram terkena limit snapinsta-app-error, gunakan /download/aio di apiii-xrina.my.id
    return await fetchXrinaAio(url, 'Instagram');
  } catch { return null; }
}

// 4. YouTube MP3: /download/ytmp3?url=...
export async function fetchXrinaYouTubeMp3(url) {
  try {
    const j = await xrinaFetchJson(`/download/ytmp3?url=${encodeURIComponent(url)}`);
    if (!j || j.status !== true || !j.data) return null;
    const d = j.data;
    const audioUrl = d.audio_url || d.url || d.download_url;
    if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.startsWith('http')) return null;
    const sz = await probeSize(audioUrl, 6000);
    return {
      title: d.title || 'YouTube Audio',
      audio_url: audioUrl,
      filesize: sz || null,
      filesize_label: humanSize(sz),
    };
  } catch { return null; }
}

// 3. YouTube Video (+ 4. ytdl mp3): /download/youtube-dl?url=... & /download/ytmp3?url=...
export async function fetchXrinaYouTube(url) {
  try {
    const [ytJson, mp3Res] = await Promise.all([
      xrinaFetchJson(`/download/youtube-dl?url=${encodeURIComponent(url)}`),
      fetchXrinaYouTubeMp3(url),
    ]);

    const inner = ytJson?.data?.data || ytJson?.data || {};
    const medias = Array.isArray(inner.medias) ? inner.medias : [];
    const title = inner.title || mp3Res?.title || 'YouTube Video';
    const thumb = inner.imageUrl || inner.thumbnail || null;
    const dur = parseInt(inner.duration, 10) || null;

    const progVideos = [];
    const silentVideos = [];
    const rawAudios = [];
    const seenVideoRes = new Set();
    const seenAudioKey = new Set();

    for (const m of medias) {
      const src = m?.url;
      if (!src || typeof src !== 'string' || !src.startsWith('http')) continue;
      let itag = '', mime = '', hasAitags = false;
      try {
        const u = new URL(src);
        itag = u.searchParams.get('itag') || '';
        mime = decodeURIComponent(u.searchParams.get('mime') || '').toLowerCase();
        hasAitags = !!u.searchParams.get('aitags');
      } catch {}

      const fmtStr = String(m.format || m.quality || '').trim();
      const extMatch = fmtStr.match(/\[\.([a-z0-9]+)\]/i);
      const ext = (extMatch && extMatch[1].toLowerCase())
        || (mime.includes('webm') ? (mime.startsWith('audio/') ? 'weba' : 'webm') : (mime.startsWith('audio/') ? 'm4a' : 'mp4'));
      const resMatch = fmtStr.match(/(\d{3,4}p|[248]K)/i);
      const resLabel = resMatch ? resMatch[1] : (itag === '18' ? '360p' : itag === '22' ? '720p' : '');
      const fsize = +m.fileSize || null;

      const isAudio = mime.startsWith('audio/') || ['m4a', 'mp3', 'weba', 'opus', 'ogg', 'aac'].includes(ext) || ['140', '251', '250', '249', '139'].includes(itag);
      if (isAudio) {
        const aKey = `${itag || ext}|${fsize || ''}`;
        if (seenAudioKey.has(aKey)) continue;
        seenAudioKey.add(aKey);
        rawAudios.push({
          type: 'audio', url: src,
          quality: `Audio (${ext.toUpperCase()})`,
          extension: ext,
          filesize: fsize, filesize_label: humanSize(fsize),
          thumbnail: thumb, has_audio: true,
        });
        continue;
      }

      // Progressive video (itag 18/22 atau tanpa aitags) memiliki audio langsung
      const hasAudio = ['18', '22', '37', '38', '43'].includes(itag) || (!hasAitags && mime.startsWith('video/'));
      const vKey = `${resLabel || fmtStr}|${hasAudio ? 'A' : 'S'}`;
      if (seenVideoRes.has(vKey)) continue;
      seenVideoRes.add(vKey);

      if (hasAudio) {
        progVideos.push({
          type: 'video', url: src,
          quality: resLabel || '360p',
          extension: ext,
          filesize: fsize, filesize_label: humanSize(fsize),
          thumbnail: thumb, has_audio: true,
        });
      } else {
        silentVideos.push({
          type: 'video', url: src,
          quality: `${resLabel || 'HD'} (tanpa suara)`,
          extension: ext,
          filesize: fsize, filesize_label: humanSize(fsize),
          thumbnail: thumb, has_audio: false,
          _h: resLabel === '4K' ? 2160 : resLabel === '2K' ? 1440 : (parseInt(resLabel, 10) || 0),
        });
      }
    }

    await Promise.all(progVideos.map(async (pv) => {
      if (!pv.filesize) {
        const sz = await probeSize(pv.url, 5000);
        if (sz) {
          pv.filesize = sz;
          pv.filesize_label = humanSize(sz);
        }
      }
    }));

    const video = [...progVideos, ...silentVideos.slice(0, 6)];
    const audio = [];
    if (mp3Res?.audio_url) {
      audio.push({
        type: 'audio', url: mp3Res.audio_url,
        quality: 'MP3 • 128kbps',
        extension: 'mp3',
        filesize: mp3Res.filesize, filesize_label: mp3Res.filesize_label,
        thumbnail: thumb, has_audio: true,
      });
    }
    audio.push(...rawAudios.slice(0, 2));

    if (!video.length && !audio.length) return null;
    const maxSplit = silentVideos.length ? Math.max(...silentVideos.map((v) => v._h || 0)) : 0;

    return {
      source: 'xrina-youtube',
      downloads: { video, audio, image: [], subtitles: [] },
      info: {
        title,
        thumbnail: thumb,
        duration: dur,
        duration_label: humanDuration(dur),
        uploader: inner.author || inner.channel || 'YouTube',
        platform: 'YouTube',
        webpage_url: url,
        has_split: maxSplit > 0,
        merge_heights: maxSplit > 0 ? [...new Set([720, 1080].filter((h) => maxSplit >= h))].sort((a, b) => b - a) : [],
      },
    };
  } catch { return null; }
}

// 5. Facebook: /download/facebook?url=...
export async function fetchXrinaFacebook(url) {
  try {
    const j = await xrinaFetchJson(`/download/facebook?url=${encodeURIComponent(url)}`);
    if (!j || j.status !== true || !j.data) return null;
    const d = j.data;
    const rawItems = [];
    if (typeof d.hd === 'string' && d.hd.startsWith('http')) {
      rawItems.push({ type: 'video', url: d.hd, quality: 'HD 720p', extension: 'mp4', has_audio: true });
    }
    if (typeof d.sd === 'string' && d.sd.startsWith('http') && d.sd !== d.hd) {
      rawItems.push({ type: 'video', url: d.sd, quality: 'SD 360p', extension: 'mp4', has_audio: true });
    }
    if (typeof d.mp3 === 'string' && d.mp3.startsWith('http')) {
      rawItems.push({ type: 'audio', url: d.mp3, quality: 'Audio MP3', extension: 'mp3', has_audio: true });
    }
    if (!rawItems.length && Array.isArray(d)) {
      d.slice(0, 6).forEach((it, i) => {
        if (it?.url && String(it.url).startsWith('http')) {
          rawItems.push({ type: 'video', url: it.url, quality: it.quality || `Video ${i + 1}`, extension: 'mp4', has_audio: true });
        }
      });
    }
    if (!rawItems.length) return null;

    const sizes = await Promise.all(rawItems.map((m) => probeSize(m.url, 6000)));
    const video = [], audio = [], image = [];
    const thumb = (typeof d.thumbnail === 'string' && d.thumbnail.startsWith('http')) ? d.thumbnail : null;
    rawItems.forEach((m, i) => {
      const sz = sizes[i] || null;
      const full = { ...m, filesize: sz, filesize_label: humanSize(sz), thumbnail: thumb };
      (m.type === 'audio' ? audio : video).push(full);
    });

    const cleanTitle = (d.title && d.title !== 'Facebook...') ? d.title : 'Facebook Video';
    return {
      source: 'xrina-facebook',
      downloads: { video, audio, image, subtitles: [] },
      info: {
        title: cleanTitle,
        thumbnail: thumb,
        duration: d.duration || null,
        duration_label: humanDuration(d.duration),
        uploader: d.author || d.uploader || 'Facebook',
        platform: 'Facebook',
        webpage_url: url,
      },
    };
  } catch { return null; }
}

// 6. Twitter / X: /download/twitterdl?url=...
export async function fetchXrinaTwitter(url) {
  try {
    const idMatch = String(url).match(/\/status\/(\d+)/i);
    const tweetId = idMatch ? idMatch[1] : null;
    const [j, fxMeta] = await Promise.all([
      xrinaFetchJson(`/download/twitterdl?url=${encodeURIComponent(url)}`),
      tweetId ? (async () => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 4500);
          const r = await fetch(`https://api.fxtwitter.com/i/status/${tweetId}`, { signal: ctrl.signal, headers: { 'User-Agent': BROWSER_UA } });
          clearTimeout(t);
          if (!r.ok) return null;
          const fj = await r.json();
          return fj?.tweet || null;
        } catch { return null; }
      })() : Promise.resolve(null),
    ]);

    const d = (j && j.status === true && j.data) ? j.data : {};
    const results = Array.isArray(d.results) ? d.results : (Array.isArray(d.media) ? d.media : []);

    const items = [];
    const seen = new Set();
    results.slice(0, 10).forEach((it, i) => {
      const src = typeof it === 'string' ? it : (it?.downloadLink || it?.url || it?.download_url);
      if (!src || typeof src !== 'string' || !src.startsWith('http') || seen.has(src)) return;
      seen.add(src);
      const ty = String(it?.type || '').toLowerCase();
      const looksImg = /jpe?g|png|webp|gif|image|photo/.test(ty) || /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(src);
      items.push({
        type: looksImg ? 'image' : 'video',
        url: src,
        quality: it?.quality || (looksImg ? `Foto ${i + 1}` : 'HD'),
        extension: looksImg ? 'jpg' : 'mp4',
        has_audio: !looksImg,
      });
    });

    // Jika /download/twitterdl kosong untuk tweet foto, ambil dari fxtwitter
    if (!items.length && fxMeta?.media) {
      const fxVids = Array.isArray(fxMeta.media.videos) ? fxMeta.media.videos : [];
      const fxPhotos = Array.isArray(fxMeta.media.photos) ? fxMeta.media.photos : [];
      fxVids.forEach((v) => {
        if (v?.url && !seen.has(v.url)) {
          seen.add(v.url);
          items.push({ type: 'video', url: v.url, quality: v.width && v.height ? `${v.width}x${v.height}` : 'HD', extension: 'mp4', has_audio: true });
        }
      });
      fxPhotos.forEach((p, i) => {
        if (p?.url && !seen.has(p.url)) {
          seen.add(p.url);
          items.push({ type: 'image', url: p.url, quality: `Foto ${i + 1}`, extension: 'jpg', has_audio: false });
        }
      });
    }
    if (!items.length) return null;

    const fxThumb = fxMeta?.media?.videos?.[0]?.thumbnail_url || fxMeta?.media?.photos?.[0]?.url || null;
    const fxDur = fxMeta?.media?.videos?.[0]?.duration ? Math.round(fxMeta.media.videos[0].duration) : null;
    const thumb = d.thumbnail || fxThumb || null;

    const sizes = await Promise.all(items.map((m) => probeSize(m.url, 6000)));
    const video = [], audio = [], image = [];
    items.forEach((m, i) => {
      const sz = sizes[i] || null;
      const full = {
        ...m,
        filesize: sz, filesize_label: humanSize(sz),
        thumbnail: m.type === 'image' ? m.url : thumb,
      };
      (m.type === 'image' ? image : video).push(full);
    });

    const userMatch = String(url).match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/status\//i);
    const uploader = d.author
      || (fxMeta?.author?.name ? `${fxMeta.author.name} (@${fxMeta.author.screen_name || ''})` : null)
      || (userMatch ? `@${userMatch[1]}` : 'X (Twitter)');
    const dur = d.duration || fxDur || null;
    const cleanText = fxMeta?.text ? String(fxMeta.text).replace(/\s+/g, ' ').trim() : '';

    return {
      source: 'xrina-twitter',
      downloads: { video, audio, image, subtitles: [] },
      info: {
        title: d.title || cleanText || `X (Twitter) Video ${userMatch ? '@' + userMatch[1] : ''}`.trim(),
        thumbnail: thumb || image[0]?.url || null,
        duration: dur,
        duration_label: humanDuration(dur),
        uploader,
        platform: 'X (Twitter)',
        webpage_url: url,
      },
    };
  } catch { return null; }
}

// Fallback All-in-One via apiii-xrina.my.id (/download/aio & /download/aio2)
export async function fetchXrinaAio(url, forcedPlatform = null) {
  try {
    const j = await xrinaFetchJson(`/download/aio?url=${encodeURIComponent(url)}`);
    if (j && j.status === true && j.data) {
      const d = j.data;
      const medias = Array.isArray(d.medias) ? d.medias : [];
      const items = [];
      const seen = new Set();
      medias.slice(0, 10).forEach((m, i) => {
        const src = m?.url;
        if (!src || typeof src !== 'string' || !src.startsWith('http') || seen.has(src)) return;
        seen.add(src);
        const ty = String(m.type || '').toLowerCase();
        const ext = String(m.ext || '').toLowerCase();
        const lbl = String(m.label || m.quality || '').trim();
        const isAudio = ty === 'audio' || /audio|mp3/i.test(lbl) || ['mp3', 'm4a', 'ogg', 'opus'].includes(ext) || /sf=mp3/i.test(src);
        const isImg = !isAudio && (ty === 'image' || ty === 'photo' || ['jpg', 'jpeg', 'png', 'webp'].includes(ext));
        items.push({
          type: isAudio ? 'audio' : isImg ? 'image' : 'video',
          url: src,
          quality: lbl.replace(/^Download\s*/i, '').replace(/^\((.*)\)$/, '$1').trim() || (isAudio ? 'Audio MP3' : isImg ? `Foto ${i + 1}` : 'HD'),
          extension: isAudio ? 'mp3' : isImg ? 'jpg' : (ext || 'mp4'),
          has_audio: !isImg,
        });
      });
      if (items.length) {
        const sizes = await Promise.all(items.map((m) => probeSize(m.url, 6000)));
        const video = [], audio = [], image = [];
        const thumb = (typeof d.thumbnail === 'string' && d.thumbnail.startsWith('http')) ? d.thumbnail : null;
        items.forEach((m, i) => {
          const sz = sizes[i] || null;
          const full = { ...m, filesize: sz, filesize_label: humanSize(sz), thumbnail: m.type === 'image' ? m.url : thumb };
          if (m.type === 'audio') audio.push(full);
          else if (m.type === 'image') image.push(full);
          else video.push(full);
        });
        return {
          source: 'xrina-aio',
          downloads: { video, audio, image, subtitles: [] },
          info: {
            title: d.title || 'Media',
            thumbnail: thumb || image[0]?.url || null,
            duration: d.duration || null,
            duration_label: humanDuration(d.duration),
            uploader: d.owner || d.author || null,
            platform: forcedPlatform || d.platform || platformFromUrl(url),
            webpage_url: url,
          },
        };
      }
    }
  } catch {}
  return null;
}

// Dispatcher utama ke 6 endpoint apiii-xrina.my.id
export async function fetchXrina(url) {
  if (!XRINA_ENABLED) return null;
  if (isTikTokUrl(url)) return fetchXrinaTikTok(url);
  if (isInstagramUrl(url)) return fetchXrinaInstagram(url);
  if (isYouTubeUrl(url) && !isYouTubePlaylistOnlyUrl(url)) return fetchXrinaYouTube(url);
  if (isFacebookUrl(url)) return fetchXrinaFacebook(url);
  if (isTwitterUrl(url)) return fetchXrinaTwitter(url);
  return fetchXrinaAio(url);
}

// Ambil URL MP3 langsung via Xrina API (utamakan /download/ytmp3 untuk YouTube)
export async function resolveXrinaMp3Url(url) {
  if (!XRINA_ENABLED) return null;
  if (isYouTubeUrl(url)) {
    const ytMp3 = await fetchXrinaYouTubeMp3(url);
    if (ytMp3?.audio_url) return ytMp3;
  }
  const xr = await fetchXrina(url);
  if (xr?.downloads?.audio?.length) {
    return {
      title: xr.info?.title || 'audio',
      audio_url: xr.downloads.audio[0].url,
      filesize: xr.downloads.audio[0].filesize || null,
      filesize_label: xr.downloads.audio[0].filesize_label || 'Unknown',
    };
  }
  return null;
}

// Ambil URL MP4 HD YouTube via Xrina API (/download/ytmp4)
export async function resolveXrinaYtMp4Url(url, height = 720) {
  if (!XRINA_ENABLED || !isYouTubeUrl(url)) return null;
  const q = [144, 240, 360, 480, 720, 1080].includes(+height) ? String(+height) : '720';
  const j = await xrinaFetchJson(`/download/ytmp4?url=${encodeURIComponent(url)}&quality=${q}`);
  const dlUrl = j?.data?.download_url || j?.data?.url;
  if (j?.status === true && dlUrl && String(dlUrl).startsWith('http')) {
    return { title: j.data.title || 'video', video_url: dlUrl, quality: `${q}p` };
  }
  return null;
}

// Fallback via instance Cobalt pribadi (env COBALT_API + opsional COBALT_KEY).
// Instance publik umumnya butuh auth — jalankan instance sendiri untuk memakai ini.
const COBALT_API = (process.env.COBALT_API || '').replace(/\/$/, '');
const COBALT_KEY = process.env.COBALT_KEY || '';
export async function fetchCobalt(url) {
  if (!COBALT_API) return null;
  try {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (COBALT_KEY) headers.Authorization = `Api-Key ${COBALT_KEY}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(COBALT_API, {
      method: 'POST', headers, signal: ctrl.signal,
      body: JSON.stringify({ url, videoQuality: '1080', audioFormat: 'mp3', filenameStyle: 'pretty' }),
    });
    clearTimeout(t);
    const j = await r.json();
    const video = [], audio = [], image = [];
    if (j.status === 'tunnel' && j.url) {
      const name = String(j.filename || j.url).toLowerCase();
      const isAudio = /\.(mp3|m4a|ogg|wav|opus|weba|flac)(\?|$)/.test(name);
      const m = name.match(/\.([a-z0-9]{2,4})(\?|$)/);
      (isAudio ? audio : video).push({
        type: isAudio ? 'audio' : 'video', url: j.url, quality: 'Via Cobalt',
        extension: (m && m[1]) || (isAudio ? 'mp3' : 'mp4'),
        filesize: null, filesize_label: 'Unknown', thumbnail: null, has_audio: true,
      });
    } else if (j.status === 'picker' && Array.isArray(j.picker)) {
      j.picker.slice(0, 10).forEach((p, i) => {
        if (!p?.url) return;
        if (p.type === 'photo') {
          image.push({ type: 'image', url: p.url, quality: `Foto ${i + 1}`, extension: 'jpg', filesize: null, filesize_label: 'Unknown', thumbnail: p.url, has_audio: false });
        } else {
          video.push({ type: 'video', url: p.url, quality: 'Via Cobalt', extension: 'mp4', filesize: null, filesize_label: 'Unknown', thumbnail: p.thumb || null, has_audio: true });
        }
      });
    } else {
      return null;
    }
    if (!video.length && !audio.length && !image.length) return null;
    return {
      downloads: { video, audio, image, subtitles: [] },
      info: {
        title: j.filename || 'Hasil via Cobalt', thumbnail: image[0]?.url || video[0]?.thumbnail || null,
        duration: null, duration_label: '-', uploader: null,
        platform: platformFromUrl(url), webpage_url: url,
      },
    };
  } catch { return null; }
}

/* ============ API Nexa (fallback khusus Instagram & Facebook) ============
   Endpoint: GET {NEXA_API_BASE}/api/ig?url=... & /api/fb?url=...
   - WAJIB header User-Agent browser (tanpa itu Cloudflare balas 403).
   - Dipakai otomatis saat yt-dlp gagal untuk URL IG/FB; set NEXA_FIRST=1
     untuk mencoba Nexa duluan, NEXA_ENABLED=0 untuk mematikan. */
const NEXA_API_BASE = (process.env.NEXA_API_BASE || 'https://api.nexadev.my.id').replace(/\/$/, '');
const NEXA_ENABLED = process.env.NEXA_ENABLED !== '0';
const NEXA_FIRST = process.env.NEXA_FIRST === '1';

function extFromUrl(u, fallback) {
  const m = String(u || '').match(/\.([a-z0-9]{2,4})(?:[?#]|$)/i);
  return (m && m[1].toLowerCase()) || fallback;
}

async function probeSize(u, ms = 8000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const H = (extra) => ({ 'User-Agent': BROWSER_UA, Accept: '*/*', ...extra });
    const total = (r) => {
      let len = +r.headers.get('content-length') || 0;
      if (r.status === 206) {
        const m = (r.headers.get('content-range') || '').match(/\/(\d+)$/);
        if (m) len = +m[1];
      }
      return len;
    };
    let r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: H() });
    let len = (r.ok || r.status === 206) ? total(r) : 0;
    if (!len) {
      r = await fetch(u, { redirect: 'follow', signal: ctrl.signal, headers: H({ Range: 'bytes=0-0' }) });
      if (r.ok || r.status === 206) len = total(r);
      try { r.body?.cancel?.(); } catch {}
    }
    clearTimeout(t);
    return len;
  } catch { return 0; }
}

export async function fetchNexa(url) {
  if (!NEXA_ENABLED) return null;
  const isIG = isInstagramUrl(url);
  const isFB = !isIG && isFacebookUrl(url);
  if (!isIG && !isFB) return null;
  try {
    let j = null;
    for (let attempt = 0; attempt < 2 && !j; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45000);
      try {
        const res = await fetch(`${NEXA_API_BASE}${isIG ? '/api/ig?url=' : '/api/fb?url='}${encodeURIComponent(url)}`, {
          signal: ctrl.signal, redirect: 'follow',
          headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
        });
        clearTimeout(t);
        j = await res.json().catch(() => null);
      } catch { clearTimeout(t); }
      if (!j && attempt === 0) await sleep(2000);
    }
    if (!j || j.status !== true || !Array.isArray(j.data) || !j.data.length) return null;
    const items = [];
    const seen = new Set();
    j.data.slice(0, 10).forEach((it, i) => {
      const src = it?.url;
      if (!src || typeof src !== 'string' || !src.startsWith('http') || seen.has(src)) return;
      seen.add(src);
      if (isFB) {
        const q = String(it.quality || '').toUpperCase();
        items.push({ type: 'video', url: src, quality: q === 'HD' ? 'HD 720p' : q === 'SD' ? 'SD 360p' : (it.quality || `Video ${i + 1}`), extension: extFromUrl(src, 'mp4'), has_audio: true });
      } else {
        const ty = String(it.type || '').toLowerCase();
        const looksImg = /jpe?g|png|webp|gif|bmp|image|photo|picture/.test(ty) || /\.(jpe?g|png|webp|gif|bmp)(\?|#|$)/i.test(src);
        items.push({ type: looksImg ? 'image' : 'video', url: src, quality: looksImg ? `Foto ${i + 1}` : 'HD', extension: extFromUrl(src, looksImg ? 'jpg' : 'mp4'), has_audio: !looksImg });
      }
    });
    if (!items.length) return null;
    const sizes = await Promise.all(items.map((m) => probeSize(m.url)));
    const video = [], audio = [], image = [];
    items.forEach((m, i) => {
      const sz = sizes[i] || null;
      const full = { ...m, filesize: sz, filesize_label: humanSize(sz), thumbnail: m.type === 'image' ? m.url : null };
      (m.type === 'image' ? image : video).push(full);
    });
    return {
      downloads: { video, audio, image, subtitles: [] },
      info: {
        title: isIG ? 'Instagram Media' : 'Facebook Video',
        thumbnail: image[0]?.url || null,
        duration: null, duration_label: '-',
        uploader: isIG ? 'Instagram' : 'Facebook',
        platform: isIG ? 'Instagram' : 'Facebook',
        webpage_url: url,
      },
    };
  } catch { return null; }
}

export async function probeDuration(url) {
  return new Promise((resolve) => {
    const child = spawn(YTDLP_BIN, [...baseArgs(), '--no-playlist', '--skip-download', '--print', '%(duration)s', url], { timeout: 30000 });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const n = parseFloat(String(out).trim().split('\n')[0]);
      resolve(Number.isFinite(n) ? n : null);
    });
  });
}

/* ---------- Job engine: MP3 / HD-merge / trim dengan progress ---------- */
const jobs = new Map();
const MAX_JOBS = 2;
let runningCount = 0;
const jobQueue = [];
export function jobsActiveCount() { return runningCount + jobQueue.length; }
const DUR_CAP = { merge: 1800, trim: 1800, mp3: 3600 }; // detik

function pruneJobs() {
  if (jobs.size < 200) return;
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (['done', 'error', 'cancelled'].includes(j.status) && now - j.createdAt > 60 * 60 * 1000) {
      jobs.delete(id);
      cleanupJobFiles(id);
    }
  }
}
async function cleanupJobFiles(id) {
  try {
    for (const f of await fsp.readdir(TMP_DIR)) {
      if (f.startsWith(id)) await fsp.unlink(path.join(TMP_DIR, f)).catch(() => {});
    }
  } catch {}
}

export async function createJob({ kind, url, height, start, end, filename }) {
  if (!['mp3', 'merge', 'trim'].includes(kind)) return { ok: false, status: 400, error: 'Jenis job tidak dikenal.' };
  const v = validateTargetUrl(url);
  if (!v.ok) return { ok: false, status: 400, error: v.error };
  const canUseXrina = XRINA_ENABLED && (kind === 'mp3' || (kind === 'merge' && isYouTubeUrl(v.url)));
  if (!HAS_FFMPEG && !canUseXrina) {
    return { ok: false, status: 501, error: 'Fitur konversi ini butuh ffmpeg yang tidak tersedia di server ini.' };
  }
  const h = [360, 480, 720, 1080].includes(+height) ? +height : 720;
  const s = +start || 0, e = +end || 0;
  if (kind === 'trim') {
    if (!(s >= 0 && e > s)) return { ok: false, status: 400, error: 'Waktu trim tidak valid (butuh 0 <= mulai < selesai).' };
    if (e - s > 600) return { ok: false, status: 400, error: 'Hasil trim maksimal 10 menit.' };
  }
  const dur = HAS_FFMPEG ? await probeDuration(v.url) : null;
  if (dur && dur > (DUR_CAP[kind] || 1800)) {
    return { ok: false, status: 400, error: `Video ${humanDuration(dur)} melebihi batas ${humanDuration(DUR_CAP[kind])} untuk ${kind === 'mp3' ? 'MP3' : kind === 'trim' ? 'trim' : 'HD'}.` };
  }
  pruneJobs();
  const id = crypto.randomBytes(16).toString('hex');
  const job = {
    id, kind, url: v.url, height: h, start: s, end: e,
    filename: sanitizeFilename(filename, kind === 'mp3' ? 'audio' : 'video'),
    status: 'queued', progress: 0, phase: 'Antre...', speed: '-', eta: '-',
    createdAt: Date.now(), error: null, file: null, child: null,
  };
  jobs.set(id, job);
  jobQueue.push(id);
  stats.jobs.created++;
  pumpQueue();
  return { ok: true, jobId: id };
}

export function getJob(id) {
  const j = jobs.get(String(id || ''));
  if (!j) return null;
  return {
    id: j.id, kind: j.kind, status: j.status, progress: Math.round(j.progress),
    phase: j.phase, speed: j.speed, eta: j.eta, error: j.error,
    file: j.file ? { size: j.file.size, size_label: humanSize(j.file.size), filename: j.file.filename } : null,
    fileUrl: j.status === 'done' ? `/api/file/${j.id}` : null,
  };
}

export function cancelJob(id) {
  const j = jobs.get(String(id || ''));
  if (!j || ['done', 'error', 'cancelled'].includes(j.status)) return false;
  const qi = jobQueue.indexOf(j.id);
  if (qi >= 0) jobQueue.splice(qi, 1);
  try { j.child?.kill('SIGKILL'); } catch {}
  j.status = 'cancelled';
  j.error = 'Dibatalkan pengguna.';
  stats.jobs.cancelled++;
  cleanupJobFiles(j.id);
  return true;
}

function pumpQueue() {
  while (runningCount < MAX_JOBS && jobQueue.length) {
    const id = jobQueue.shift();
    const j = jobs.get(id);
    if (j && j.status === 'queued') runJob(j);
  }
}

function parseProgress(j, line, scale = 1, base = 0) {
  const m = String(line).match(/\[download\]\s+([\d.]+)%.*?at\s+(\S+).*?ETA\s+(\S+)/);
  if (m) {
    j.progress = Math.min(99, base + parseFloat(m[1]) * scale);
    j.speed = m[2];
    j.eta = m[3];
    if (!j.phase || j.phase === 'Antre...') j.phase = 'Mengunduh...';
    return;
  }
  if (/\[Merger\]/.test(line)) { j.phase = 'Menggabungkan gambar+suara...'; j.progress = Math.max(j.progress, 96); }
  if (/\[ExtractAudio\]/.test(line)) { j.phase = 'Konversi MP3...'; j.progress = Math.max(j.progress, 96); }
  if (/\[download\] Destination/.test(line)) j.phase = 'Mengunduh...';
}

function finishJobFile(j, id, contentType, ext) {
  return (async () => {
    const files = (await fsp.readdir(TMP_DIR)).filter((f) => f.startsWith(`${id}__out`) && !f.endsWith('.part') && !f.endsWith('.ytdl'));
    if (!files.length) throw new Error('empty');
    const fp = path.join(TMP_DIR, files.sort((a, b) => b.length - a.length)[0]);
    const st = await fsp.stat(fp);
    if (!st.size) throw new Error('empty');
    j.file = { path: fp, size: st.size, filename: `${j.filename}.${ext}`, contentType };
  })();
}

async function downloadUrlToFile(j, targetUrl, destPath) {
  j.phase = 'Mengunduh...';
  j.progress = Math.max(j.progress, 20);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 300000);
  try {
    const res = await fetch(targetUrl, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA, Referer: 'https://www.google.com/', Accept: '*/*' },
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = +res.headers.get('content-length') || 0;
    let received = 0;
    const t0 = Date.now();
    const out = createWriteStream(destPath);
    const reader = res.body.getReader();
    while (true) {
      if (j.status === 'cancelled') {
        try { await reader.cancel(); } catch {}
        out.destroy();
        throw new Error('cancelled');
      }
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (!out.write(Buffer.from(value))) {
        await new Promise((r) => out.once('drain', r));
      }
      const elapsedSec = Math.max(0.1, (Date.now() - t0) / 1000);
      const bps = received / elapsedSec;
      j.speed = `${humanSize(bps)}/s`;
      if (total > 0) {
        j.progress = Math.min(98, 20 + Math.round((received / total) * 78));
        const remSec = Math.max(0, Math.round((total - received) / Math.max(1, bps)));
        j.eta = `${remSec}s`;
      } else {
        j.progress = Math.min(95, j.progress + 5);
      }
    }
    await new Promise((resolve, reject) => {
      out.end();
      out.on('finish', resolve);
      out.on('error', reject);
    });
  } finally {
    clearTimeout(timer);
  }
}

async function runJob(j) {
  j.status = 'working';
  runningCount++;
  const outTpl = path.join(TMP_DIR, `${j.id}__out.%(ext)s`);
  try {
    if (j.kind === 'trim') {
      await runTrim(j, outTpl);
    } else if (j.kind === 'mp3') {
      let handledByXrina = false;
      if (XRINA_ENABLED) {
        j.phase = 'Mengambil MP3 via API...';
        j.progress = 10;
        const mp3Info = await resolveXrinaMp3Url(j.url);
        if (mp3Info?.audio_url) {
          if ((!j.filename || j.filename === 'audio') && mp3Info.title) {
            j.filename = sanitizeFilename(mp3Info.title, 'audio');
          }
          const outFp = path.join(TMP_DIR, `${j.id}__out.mp3`);
          await downloadUrlToFile(j, mp3Info.audio_url, outFp);
          await finishJobFile(j, j.id, 'audio/mpeg', 'mp3');
          handledByXrina = true;
        }
      }
      if (!handledByXrina) {
        if (!HAS_FFMPEG) throw new Error('Gagal mengambil MP3 dari API dan ffmpeg tidak tersedia.');
        const args = ['-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '192K'];
        await spawnYtDlp(j, [...cookieArgs(), ...proxyArgs(), ...args, '--ffmpeg-location', FFMPEG_BIN, '--no-playlist', '--no-warnings', '--no-cache-dir', '--progress', '--newline', '--socket-timeout', '20', '--retries', '2', '-o', outTpl, j.url], 1, 0);
        await finishJobFile(j, j.id, 'audio/mpeg', 'mp3');
      }
    } else {
      let handledByXrina = false;
      if (XRINA_ENABLED && (!HAS_FFMPEG || isYouTubeUrl(j.url))) {
        j.phase = `Mengambil HD ${j.height}p via API...`;
        j.progress = 10;
        const mp4Info = await resolveXrinaYtMp4Url(j.url, j.height);
        if (mp4Info?.video_url) {
          const outFp = path.join(TMP_DIR, `${j.id}__out.mp4`);
          await downloadUrlToFile(j, mp4Info.video_url, outFp);
          await finishJobFile(j, j.id, 'video/mp4', 'mp4');
          handledByXrina = true;
        }
      }
      if (!handledByXrina) {
        if (!HAS_FFMPEG) throw new Error('Fitur merge HD butuh ffmpeg di server ini.');
        const args = ['-f', `bv[height<=${j.height}][vcodec^=avc]+ba[acodec^=mp4a]/bv[height<=${j.height}]+ba/b[height<=${j.height}]/bv*+ba/b`, '--merge-output-format', 'mp4'];
        await spawnYtDlp(j, [...cookieArgs(), ...proxyArgs(), ...args, '--ffmpeg-location', FFMPEG_BIN, '--no-playlist', '--no-warnings', '--no-cache-dir', '--progress', '--newline', '--socket-timeout', '20', '--retries', '2', '-o', outTpl, j.url], 1, 0);
        await finishJobFile(j, j.id, 'video/mp4', 'mp4');
      }
    }
    j.status = 'done';
    j.progress = 100;
    j.phase = 'Selesai';
    stats.jobs.done++;
  } catch (err) {
    if (j.status === 'cancelled') { /* sudah ditangani */ }
    else {
      j.status = 'error';
      j.error = jobFriendlyError(err?.stderr || err?.message || '');
      stats.jobs.error++;
      reportError(`job ${j.kind}`, new Error(j.error));
      cleanupJobFiles(j.id);
    }
  } finally {
    runningCount = Math.max(0, runningCount - 1);
    pumpQueue();
  }
}

function jobFriendlyError(stderr) {
  const s = String(stderr || '');
  if (/unsupported url/i.test(s)) return 'Link tidak didukung.';
  if (/private|login|cookies/i.test(s)) return 'Konten private / butuh login.';
  if (/not available|removed|deleted|not found|no video/i.test(s)) return 'Media tidak ditemukan / sudah dihapus.';
  if (/timed out|timeout/i.test(s)) return 'Timeout saat mengunduh. Coba lagi.';
  return 'Gagal memproses. Coba lagi atau pilih kualitas lain.';
}

function spawnYtDlp(j, args, scale, base, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, { timeout: timeoutMs });
    j.child = child;
    let stderr = '';
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const ln of lines) parseProgress(j, ln, scale, base);
    });
    child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 4000) stderr = stderr.slice(-4000); });
    child.on('error', (err) => reject(Object.assign(new Error(err.message), { stderr })));
    child.on('close', (code) => {
      j.child = null;
      if (j.status === 'cancelled') return reject(new Error('cancelled'));
      if (code !== 0) return reject(Object.assign(new Error('yt-dlp failed'), { stderr }));
      resolve();
    });
  });
}

async function runTrim(j, outTpl) {
  const srcTpl = path.join(TMP_DIR, `${j.id}__src.%(ext)s`);
  j.phase = 'Mengunduh video...';
  await spawnYtDlp(j, [...cookieArgs(), ...proxyArgs(), '-f', `bv[height<=720]+ba/b[height<=720]/b`, '--merge-output-format', 'mp4',
    '--ffmpeg-location', FFMPEG_BIN, '--no-playlist', '--no-warnings', '--no-cache-dir',
    '--progress', '--newline', '--socket-timeout', '20', '--retries', '2', '-o', srcTpl, j.url], 0.8, 0);
  const srcs = (await fsp.readdir(TMP_DIR)).filter((f) => f.startsWith(`${j.id}__src`) && !f.endsWith('.part'));
  if (!srcs.length) throw new Error('download empty');
  const srcFp = path.join(TMP_DIR, srcs[0]);
  j.phase = 'Memotong...';
  j.progress = 85;
  const outFp = path.join(TMP_DIR, `${j.id}__out.mp4`);
  const segLen = Math.max(1, j.end - j.start);
  // start=0 -> stream-copy (cepat & akurat); start>0 -> re-encode (copy memberi
  // durasi salah karena keyframe sebelum titik potong ikut terbawa).
  const ffArgs = j.start > 0
    ? ['-y', '-ss', String(j.start), '-i', srcFp, '-t', String(segLen), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', outFp]
    : ['-y', '-i', srcFp, '-t', String(segLen), '-c', 'copy', '-movflags', '+faststart', '-avoid_negative_ts', 'make_zero', outFp];
  await new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, ffArgs, { timeout: 600000 });
    j.child = ff;
    let err = '';
    ff.stderr.on('data', (d) => { err += d; if (err.length > 2000) err = err.slice(-2000); });
    ff.on('error', (e) => reject(e));
    ff.on('close', (code) => {
      j.child = null;
      if (j.status === 'cancelled') return reject(new Error('cancelled'));
      if (code !== 0) return reject(Object.assign(new Error('ffmpeg gagal memotong'), { stderr: err }));
      resolve();
    });
  });
  j.progress = 98;
  await fsp.unlink(srcFp).catch(() => {});
  await finishJobFile(j, j.id, 'video/mp4', 'mp4');
}

export async function serveJobFile(id, req, res) {
  if (!(await apiRateLimit(req, res))) return;
  const j = jobs.get(String(id || ''));
  if (!j || j.status !== 'done' || !j.file) {
    return res.status(404).json({ success: false, error: 'File tidak ditemukan / sudah kedaluwarsa. Buat ulang prosesnya.' });
  }
  const st = await fsp.stat(j.file.path).catch(() => null);
  if (!st) {
    return res.status(410).json({ success: false, error: 'File sudah dihapus server (kedaluwarsa). Buat ulang prosesnya.' });
  }
  res.setHeader('Content-Type', j.file.contentType);
  res.setHeader('Content-Length', st.size);
  res.setHeader('Content-Disposition', `attachment; filename="${j.file.filename}"; filename*=UTF-8''${encodeURIComponent(j.file.filename)}`);
  const stream = createReadStream(j.file.path);
  stream.on('error', () => { try { res.end(); } catch {} });
  stream.pipe(res);
}

// Log error dari browser (ringan, dibatasi)
export async function clientLog(req, res) {
  if (!(await apiRateLimit(req, res, { max: 10 }))) return;
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  stats.clientErrors.unshift({
    t: Date.now(),
    msg: String(b.msg || '').slice(0, 300),
    url: String(b.url || '').slice(0, 200),
  });
  if (stats.clientErrors.length > 30) stats.clientErrors.pop();
  res.json({ success: true });
}

export function envConfig() {
  return {
    umamiUrl: process.env.UMAMI_URL || null,
    umamiId: process.env.UMAMI_WEBSITE_ID || null,
    turnstileSite: process.env.TURNSTILE_SITE_KEY || null,
    trim: HAS_FFMPEG,
    mp3: HAS_FFMPEG || XRINA_ENABLED,
    merge: HAS_FFMPEG || XRINA_ENABLED,
    search: true, batch: true, maxBatch: 10,
    cookies: HAS_COOKIES,
    runtime: process.env.VERCEL ? 'vercel' : 'vps',
  };
}

/* ============ Kebijakan akses: Turnstile CAPTCHA / API key (#1) ============
   - Jika TURNSTILE_SECRET diset: endpoint berat wajib token captcha valid.
   - Jika API_KEY diset: request dengan header x-api-key valid bisa lewatkan captcha;
     kalau captcha mati, API key jadi wajib untuk endpoint berat.
   - Token captcha yang sudah terverifikasi di-cache 10 menit (per IP) supaya
     alur batch/polling tidak minta captcha berulang. */
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || '';
const API_KEY = process.env.API_KEY || '';
const verifiedTokens = new Map(); // tokenHash -> { exp, ip }
function tokenKey(tok, ip) { return crypto.createHash('sha256').update(String(tok) + '|' + String(ip || '')).digest('hex'); }
export async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET) return { ok: true };
  if (!token) return { ok: false, error: 'Verifikasi CAPTCHA wajib diselesaikan dulu.' };
  const k = tokenKey(token, ip);
  const hit = verifiedTokens.get(k);
  if (hit && hit.exp > Date.now()) return { ok: true };
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: String(token), remoteip: String(ip || '') }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.success) {
      verifiedTokens.set(k, { exp: Date.now() + 600000, ip });
      if (verifiedTokens.size > 2000) { const first = verifiedTokens.keys().next().value; verifiedTokens.delete(first); }
      return { ok: true };
    }
    return { ok: false, error: 'Verifikasi CAPTCHA gagal. Muat ulang widget lalu coba lagi.' };
  } catch {
    return { ok: false, error: 'Verifikasi CAPTCHA gagal (jaringan). Coba lagi.' };
  }
}
function reqIp(req) {
  return (req.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim() || req.socket?.remoteAddress || '';
}
export async function policyGuard(req, res) {
  if (API_KEY) {
    const k = req.headers?.['x-api-key'] || req.query?.key || req.body?.key;
    if (k && k === API_KEY) return true;
    if (!TURNSTILE_SECRET) { res.status(403).json({ success: false, error: 'Butuh API key (header x-api-key).' }); return false; }
  }
  if (TURNSTILE_SECRET) {
    const tok = req.body?.['cf-turnstile-response'] || req.headers?.['x-turnstile-token'] || req.query?.token;
    const v = await verifyTurnstile(tok, reqIp(req));
    if (!v.ok) { res.status(403).json({ success: false, error: v.error }); return false; }
  }
  return true;
}

/* ============ Kesehatan cookies publik (ringan, tanpa bocor isi) ============ */
export async function cookiesHealthHandler(req, res) {
  if (!(await apiRateLimit(req, res, { max: 30 }))) return;
  res.json({ success: true, ok: HAS_COOKIES, detail: HAS_COOKIES ? 'Cookies terpasang.' : 'Cookies belum dipasang di server.' });
}

// Upload/refresh cookies.txt via admin (VPS saja; Vercel read-only). Slot 1..5.
export async function saveCookies(req, res) {
  if (!(await apiRateLimit(req, res, { max: 10 }))) return;
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const admin = process.env.ADMIN_KEY || 'van313-admin';
  if (b.key !== admin) return res.status(403).json({ success: false, error: 'Kunci admin salah.' });
  if (process.env.VERCEL) return res.status(501).json({ success: false, error: 'Upload cookies hanya didukung di VPS/server penuh (Vercel read-only).' });
  const slot = Math.min(Math.max(parseInt(b.slot) || 1, 1), 5);
  const content = String(b.content || '');
  if (content.length < 50 || content.length > 300000) return res.status(400).json({ success: false, error: 'Isi cookies tidak valid (kosong / terlalu besar).' });
  const head = content.split('\n').slice(0, 30).join('\n');
  if (!/netscape http cookie file/i.test(head) && !/\t(\.)?(instagram\.com|facebook\.com|youtube\.com|google\.com)/i.test(head)) {
    return res.status(400).json({ success: false, error: 'Format bukan Netscape cookies.txt (export via ekstensi "Get cookies.txt LOCALLY").' });
  }
  if (!/(instagram\.com|facebook\.com|youtube\.com|google\.com)/i.test(content)) return res.status(400).json({ success: false, error: 'Tidak ada cookie Instagram/Facebook/YouTube di file ini.' });
  const fname = slot === 1 ? 'cookies.txt' : `cookies${slot}.txt`;
  try {
    await fsp.writeFile(path.join(__dirname, '..', fname), content.replace(/\r\n/g, '\n'), { mode: 0o600 });
  } catch { return res.status(500).json({ success: false, error: 'Gagal menyimpan file cookies.' }); }
  refreshCookieFiles();
  return res.json({ success: true, file: fname, files: cookiesStatus() });
}

// Cek kesehatan cookies IG dengan request live per file (khusus admin, agak lambat)
function testOneCookie(idx) {
  return new Promise((resolve) => {
    const child = spawn(YTDLP_BIN, [...baseArgs(idx), '--no-playlist', '--skip-download', '--print', '%(id)s', 'https://www.instagram.com/reel/DdA4TuFJrbh/'], { timeout: 45000 });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => resolve({ ok: false, detail: String(e.message) }));
    child.on('close', (code) => {
      if (code === 0 && out.trim()) resolve({ ok: true, detail: 'Valid (tes reel IG sukses).' });
      else resolve({ ok: false, detail: `Tes gagal: ${err.split('\n').map((l) => l.replace(/^ERROR:\s*/i, '')).find((l) => l.trim()) || 'unknown'}`.slice(0, 200) });
    });
  });
}
export async function checkCookies() {
  if (!COOKIE_FILES.length) return { ok: false, detail: 'Tidak ada file cookies di server.' };
  const files = [];
  for (let i = 0; i < COOKIE_FILES.length; i++) {
    const r = await testOneCookie(i);
    files.push({ file: path.basename(COOKIE_FILES[i]), ok: r.ok, detail: r.detail });
  }
  const good = files.filter((f) => f.ok).length;
  return { ok: good > 0, detail: good ? `${good}/${files.length} cookies valid.` : 'Semua cookies gagal (lihat per file).', files };
}

export async function statsHandler(req, res) {
  const key = req.query?.key || req.body?.key;
  const admin = process.env.ADMIN_KEY || 'van313-admin';
  if (key !== admin) return res.status(403).json({ success: false, error: 'Kunci admin salah.' });
  const out = { success: true, ...getStats() };
  if (req.query?.action === 'cookies') out.cookiesCheck = await checkCookies();
  res.json(out);
}

/* ================= Shared: proxy download, konversi, health ================= */
// Dipakai oleh server.js (Express/VPS) DAN api/*.js (Vercel serverless).

let activeJobs = 0;
export function tryStartJob(max = 2) {
  if (activeJobs >= max) return false;
  activeJobs++;
  return true;
}
export function endJob() { activeJobs = Math.max(0, activeJobs - 1); }

/* ============ Auto-update yt-dlp (#5): maks 1x/24 jam, background ============ */
let lastYtUpdate = 0, lastYtUpdateResult = 'belum pernah';
export function maybeUpdateYtDlp(force = false) {
  if (process.env.VERCEL || process.env.YTDLP_AUTO_UPDATE === '0') return false;
  if (!force && Date.now() - lastYtUpdate < 86400000) return false;
  lastYtUpdate = Date.now();
  try {
    const child = spawn(YTDLP_BIN, ['--update'], { timeout: 180000 });
    let err = '';
    child.stderr?.on('data', (d) => { err += d; });
    child.on('error', (e) => { lastYtUpdateResult = `gagal: ${e.message}`; });
    child.on('close', (code) => {
      lastYtUpdateResult = code === 0 ? `sukses ${new Date().toISOString()}` : `exit ${code}: ${err.slice(0, 120)}`;
    });
  } catch (e) { lastYtUpdateResult = `gagal: ${e.message}`; return false; }
  return true;
}

export function getHealth() {
  return new Promise((resolve) => {
    execFile(YTDLP_BIN, ['--version'], { timeout: 15000 }, (e1, v1) => {
      resolve({
        ok: !e1 || XRINA_ENABLED,
        xrina: XRINA_ENABLED ? XRINA_API_BASE : null,
        ytdlp: e1 ? null : String(v1).trim(),
        ytdlpUpdated: lastYtUpdateResult,
        ffmpeg: FFMPEG_VER,
        cookies: HAS_COOKIES,
        activeJobs,
        runtime: process.env.VERCEL ? 'vercel' : 'node',
        time: new Date().toISOString(),
      });
    });
  });
}

// Proxy download langsung (bebas CORS) — pakai fetch bawaan Node
export async function proxyDownload(req, res) {
  if (!(await apiRateLimit(req, res))) return;
  const t0 = Date.now();
  const v = validateTargetUrl(req.query?.url);
  if (!v.ok) { logReq('download', 'cdn', false, Date.now() - t0, v.error); return res.status(400).json({ success: false, error: v.error }); }

  let filename = sanitizeFilename(req.query?.filename, 'download');
  if (!/\.\w{2,5}$/.test(filename)) {
    const ext = String(req.query?.ext || 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'mp4';
    filename += `.${ext}`;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    const upHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Referer: 'https://www.google.com/',
      Accept: '*/*',
    };
    if (req.headers?.range) upHeaders.Range = req.headers.range;
    const up = await fetch(v.url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: upHeaders,
    });
    clearTimeout(timer);
    if (!up.ok || !up.body) {
      if (up.status === 403 || up.status === 401) return res.status(502).json({ success: false, error: 'Link CDN kedaluwarsa / ditolak. Ulangi proses dari awal untuk link baru.' });
      if (up.status === 404) return res.status(502).json({ success: false, error: 'File sumber sudah tidak tersedia (404).' });
      return res.status(502).json({ success: false, error: 'Gagal mengambil file dari server sumber.' });
    }
    const isInline = req.query?.inline === '1';
    if (up.status === 206) res.status(206);
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    const ct = up.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    const cl = up.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);
    const cr = up.headers.get('content-range');
    if (cr) res.setHeader('Content-Range', cr);
    const ar = up.headers.get('accept-ranges');
    if (ar) res.setHeader('Accept-Ranges', ar);
    const stream = Readable.fromWeb(up.body);
    stream.on('error', () => { try { res.end(); } catch {} });
    if (typeof req.on === 'function') req.on('close', () => { try { stream.destroy(); } catch {} });
    logReq('download', 'cdn', true, Date.now() - t0);
    stream.pipe(res);
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ success: false, error: 'Gagal mengambil file dari server sumber.' });
    else { try { res.end(); } catch {} }
  }
}

// Konversi yt-dlp -> file sementara -> stream ke client (MP3 & HD-merge)
const TMP_DIR = path.join(os.tmpdir(), 'aio-dl');
try { await fsp.mkdir(TMP_DIR, { recursive: true }); } catch {}
if (!process.env.VERCEL) {
  // Sapu file sisa >10 menit (hanya mode server penuh; serverless /tmp fana)
  setInterval(async () => {
    try {
      const now = Date.now();
      for (const f of await fsp.readdir(TMP_DIR)) {
        const fp = path.join(TMP_DIR, f);
        const st = await fsp.stat(fp).catch(() => null);
        if (st && now - st.mtimeMs > 10 * 60 * 1000) await fsp.unlink(fp).catch(() => {});
      }
    } catch {}
  }, 5 * 60 * 1000).unref?.();
}

async function cleanupJob(id) {
  try {
    for (const f of await fsp.readdir(TMP_DIR)) {
      if (f.startsWith(id)) await fsp.unlink(path.join(TMP_DIR, f)).catch(() => {});
    }
  } catch {}
}

export async function convertToFile({ title, contentType, ext, ytdlpArgs, timeoutMs, req, res }) {
  if (!(await apiRateLimit(req, res))) return;
  const v = validateTargetUrl(req.query?.url);
  if (!v.ok) return res.status(400).json({ success: false, error: v.error });

  // Utamakan Xrina API (apiii-xrina.my.id) untuk MP3 (/download/ytmp3 dll.) & YouTube HD (/download/ytmp4)
  if (XRINA_ENABLED) {
    try {
      let directUrl = null;
      let resolvedTitle = req.query?.filename || title;
      if (ext === 'mp3') {
        const mp3Res = await resolveXrinaMp3Url(v.url);
        if (mp3Res?.audio_url) {
          directUrl = mp3Res.audio_url;
          if (!req.query?.filename && mp3Res.title) resolvedTitle = mp3Res.title;
        }
      } else if (ext === 'mp4' && isYouTubeUrl(v.url)) {
        const h = [360, 480, 720, 1080].includes(+req.query?.height) ? +req.query.height : 720;
        const mp4Res = await resolveXrinaYtMp4Url(v.url, h);
        if (mp4Res?.video_url) {
          directUrl = mp4Res.video_url;
          if (!req.query?.filename && mp4Res.title) resolvedTitle = mp4Res.title;
        }
      }
      if (directUrl) {
        const fname = sanitizeFilename(resolvedTitle, 'media') + `.${ext}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 120000);
        const up = await fetch(directUrl, {
          signal: ctrl.signal,
          redirect: 'follow',
          headers: { 'User-Agent': BROWSER_UA, Referer: 'https://www.google.com/', Accept: '*/*' },
        });
        clearTimeout(timer);
        if (up.ok && up.body) {
          res.setHeader('Content-Type', contentType);
          const cl = up.headers.get('content-length');
          if (cl) res.setHeader('Content-Length', cl);
          res.setHeader('Content-Disposition', `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent(fname)}`);
          const stream = Readable.fromWeb(up.body);
          stream.on('error', () => { try { res.end(); } catch {} });
          if (typeof req.on === 'function') req.on('close', () => { try { stream.destroy(); } catch {} });
          stream.pipe(res);
          return;
        }
      }
    } catch {}
  }

  if (!HAS_FFMPEG) {
    return res.status(501).json({ success: false, error: 'Fitur konversi butuh ffmpeg yang tidak tersedia di server ini. Deploy ke VPS/server penuh untuk MP3 & HD.' });
  }

  const filename = sanitizeFilename(req.query?.filename || title, 'media') + `.${ext}`;
  const id = crypto.randomBytes(8).toString('hex');
  const outTpl = path.join(TMP_DIR, `${id}.%(ext)s`);
  const args = [...cookieArgs(), ...proxyArgs(), ...ytdlpArgs, '--ffmpeg-location', FFMPEG_BIN, '--no-playlist', '--no-warnings',
    '--no-cache-dir', '--socket-timeout', '20', '--retries', '2', '-o', outTpl, v.url];

  const child = spawn(YTDLP_BIN, args, { timeout: timeoutMs });
  let stderr = '';
  let done = false;
  child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 4000) stderr = stderr.slice(-4000); });
  child.on('error', async (err) => {
    if (done) return; done = true;
    try { child.kill('SIGKILL'); } catch {}
    await cleanupJob(id);
    if (!res.headersSent) res.status(500).json({ success: false, error: `Gagal konversi: ${err.message}` });
  });
  if (typeof req.on === 'function') req.on('close', async () => {
    if (done) return; done = true;
    try { child.kill('SIGKILL'); } catch {}
    await cleanupJob(id);
  });
  child.on('close', async (code) => {
    if (done) return; done = true;
    if (code !== 0) {
      await cleanupJob(id);
      const msg = /unsupported url/i.test(stderr) ? 'Link tidak didukung.'
        : /private|login|cookies/i.test(stderr) ? 'Konten private / butuh login.'
        : /not available|removed|deleted|not found|no video/i.test(stderr) ? 'Media tidak ditemukan / sudah dihapus.'
        : 'Gagal konversi. Coba kualitas lain atau ulangi.';
      if (!res.headersSent) res.status(502).json({ success: false, error: msg });
      return;
    }
    try {
      const files = (await fsp.readdir(TMP_DIR)).filter((f) => f.startsWith(id) && !f.endsWith('.part') && !f.endsWith('.ytdl'));
      if (!files.length) throw new Error('empty');
      const fp = path.join(TMP_DIR, files.sort((a, b) => b.length - a.length)[0]);
      const st = await fsp.stat(fp);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', st.size);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      const stream = createReadStream(fp);
      stream.on('close', () => cleanupJob(id));
      stream.on('error', () => { try { res.end(); } catch {} cleanupJob(id); });
      stream.pipe(res);
    } catch {
      await cleanupJob(id);
      if (!res.headersSent) res.status(502).json({ success: false, error: 'Gagal konversi (file kosong).' });
    }
  });
}


/* ================= Vercel Handler (dipakai juga oleh Express) ================= */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (!(await apiRateLimit(req, res))) return;
  if (!(await policyGuard(req, res))) return;

  const t0 = Date.now();
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const url = body.url ?? req.query?.url;

  const result = await extractMedia(url);
  if (!result.ok) {
    // IG 403/429 hampir selalu soal login: beri hint cookies meski pesannya generik
    if (!result.hint && [403, 429].includes(result.status) && /instagram\.com/i.test(String(url || ''))) {
      result.hint = HAS_COOKIES ? 'cookies_maybe_expired' : 'need_cookies';
    }
    logReq('extract', platformFromUrl(url), false, Date.now() - t0, result.error);
    if ((result.status || 500) >= 500) reportError('extract 5xx', new Error(String(result.error).slice(0, 200)));
    return res.status(result.status || 500).json({ success: false, error: result.error, hint: result.hint || null });
  }
  logReq('extract', result.info?.platform || '?', true, Date.now() - t0);
  return res.status(200).json({
    success: true,
    source: result.source,
    cached: !!result.cached,
    is_playlist: !!result.is_playlist,
    is_album: !!result.is_album,
    playlist: result.playlist,
    items: result.items,
    downloads: result.downloads,
    data: result.data,
    info: result.info,
    original_url: result.original_url,
  });
}
