// api/index.js — Backend All-in-One Downloader (yt-dlp edition, LENGKAP)
// Mendukung: video multi-resolusi, audio, gambar, carousel/album, playlist,
// MP3 & HD-merge (ditangani server.js), semua sosmed via yt-dlp.
import { spawn, execFile, execFileSync } from 'child_process';
import { existsSync, createReadStream } from 'fs';
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
// Cara buat: install ekstensi "Get cookies.txt LOCALLY", export saat login, simpan sebagai cookies.txt
const COOKIES_FILE = process.env.COOKIES_FILE ||
  (existsSync(path.join(__dirname, '..', 'cookies.txt')) ? path.join(__dirname, '..', 'cookies.txt') : null);
export const HAS_COOKIES = !!COOKIES_FILE;

const YTDLP_TIMEOUT_MS = 60000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 100;
const MULTI_AUTO_MAX = 12;   // album/carousel <= N item langsung diekstrak semua
const PLAYLIST_CAP = 30;     // playlist besar: tampilkan N item pertama

const cache = new Map();
const inflight = new Map();

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

export function validateTargetUrl(raw) {
  const str = String(raw || '').trim();
  if (!str) return { ok: false, error: 'URL tidak boleh kosong.' };
  if (str.length > 2048) return { ok: false, error: 'URL terlalu panjang.' };
  let u;
  try { u = new URL(str); } catch { return { ok: false, error: 'Format URL tidak valid. Contoh: https://www.tiktok.com/...' }; }
  if (!['http:', 'https:'].includes(u.protocol)) return { ok: false, error: 'URL harus diawali http:// atau https://' };
  if (isBlockedHost(u.hostname)) return { ok: false, error: 'URL internal / localhost tidak diizinkan.' };
  return { ok: true, url: u.toString() };
}

function friendlyYtDlpError(stderr) {
  const s = String(stderr || '');
  if (/unsupported url/i.test(s)) return { status: 400, error: 'Link tidak didukung. Pastikan itu link video/foto/audio publik (TikTok, IG, YouTube, X, FB, dll).' };
  if (/private|login required|log in to|cookies.*(required|expired)|not logged/i.test(s)) return { status: 403, error: 'Konten private / butuh login (sering terjadi di IG Story & akun dikunci). Coba link publik, atau pasang cookies.txt di server.' };
  if (/not available|removed|deleted|this .* (is private|has been removed)|not found|no video could be found|no media found/i.test(s)) return { status: 404, error: 'Media tidak ditemukan. Mungkin sudah dihapus, link salah, atau postingan teks tanpa media.' };
  if (/timed out|timeout|network is unreachable|temporary failure in name resolution/i.test(s)) return { status: 504, error: 'Koneksi ke server sumber timeout. Coba lagi sebentar.' };
  if (/rate-limit|too many requests|429|not granting access/i.test(s)) return { status: 429, error: 'Platform sumber membatasi request (rate limit, sering dari IG). Tunggu ±1 menit lalu coba lagi.' };
  if (/ip.*block/i.test(s)) return { status: 502, error: 'IP server diblokir oleh platform sumber. Coba lagi nanti.' };
  if (/sign in to confirm|confirm your age|age-gated/i.test(s)) return { status: 403, error: 'Video dibatasi umur / butuh login, tidak bisa diambil.' };
  if (/premiere|upcoming|live.*(scheduled|upcoming)/i.test(s)) return { status: 400, error: 'Video belum tayang / masih premiere. Tunggu sampai rilis.' };
  const firstErr = s.split('\n').map((l) => l.replace(/^ERROR:\s*/i, '').trim()).find((l) => l && !l.startsWith('WARNING'));
  return { status: 500, error: firstErr ? `Gagal mengambil media: ${firstErr.slice(0, 220)}` : 'Gagal mengambil media dari link tersebut.' };
}

/* ================= yt-dlp runner ================= */

function baseArgs() {
  const a = ['--no-warnings', '--no-cache-dir', '--socket-timeout', '20', '--retries', '2', '--fragment-retries', '2'];
  if (COOKIES_FILE) a.push('--cookies', COOKIES_FILE);
  return a;
}

function runYtDlpJson(args, timeoutMs = YTDLP_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const child = spawn(YTDLP_BIN, args, { timeout: timeoutMs });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; if (stdout.length > 12 * 1024 * 1024) child.kill(); });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => resolve({ ok: false, status: 500, error: `yt-dlp tidak bisa dijalankan: ${err.message}` }));
    child.on('close', (code) => {
      if (code !== 0) return resolve({ ok: false, ...friendlyYtDlpError(stderr), _retryable: /429|too many requests|timed out|timeout|not granting access/i.test(stderr) });
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
  return /(^|\.)(tiktok\.com|vt\.tiktok\.com)$/i.test(safeHost(url)) || /tiktok\.com\//i.test(url);
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
      downloads: { video, audio, image },
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

export async function extractMedia(rawUrl) {
  const v = validateTargetUrl(rawUrl);
  if (!v.ok) return { ok: false, status: 400, error: v.error };
  const url = v.url;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < CACHE_TTL_MS) return { ok: true, cached: true, ...hit.data };
  if (inflight.has(url)) {
    try { return await inflight.get(url); } catch { /* lanjut */ }
  }

  const job = (async () => {
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
          downloads: { video: video.slice(0, 12), audio: [], image: image.slice(0, 12) },
          info: buildInfo({ ...probe.info, title: `${parentTitle} (${okKids.length} item)` }, url),
          items, original_url: url,
        };
        payload.data = [...payload.downloads.video, ...payload.downloads.image];
        saveCache(url, payload);
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
        items, downloads: { video: [], audio: [], image: [] }, data: [],
        info: buildInfo({ ...probe.info, title: probe.info.title || 'Playlist' }, url),
        original_url: url,
      };
      saveCache(url, payload);
      return { ok: true, ...payload };
    }

    // 2) Single: pakai hasil probe kalau sudah ada formats, kalau tidak full-extract
    let info = probe.ok && !probe.info?.entries ? probe.info : null;
    if (!info || !Array.isArray(info.formats) || !info.formats.length) {
      const single = await extractSingle(url);
      if (!single.ok) {
        if (isTikTokUrl(url)) {
          const fb = await fetchTikWmFallback(url);
          if (fb) {
            const payload = { source: 'tikwm-fallback', downloads: fb.downloads, info: fb.info, original_url: url };
            payload.data = [...fb.downloads.video, ...fb.downloads.audio, ...fb.downloads.image];
            saveCache(url, payload);
            return { ok: true, ...payload };
          }
        }
        return single;
      }
      info = single.info;
    }

    const picked = pickDownloads(info);
    const downloads = { video: picked.video, audio: picked.audio, image: picked.image };
    if (!downloads.video.length && !downloads.audio.length && !downloads.image.length) {
      if (isTikTokUrl(url)) {
        const fb = await fetchTikWmFallback(url);
        if (fb) {
          const payload = { source: 'tikwm-fallback', downloads: fb.downloads, info: fb.info, original_url: url };
          payload.data = [...fb.downloads.video, ...fb.downloads.audio, ...fb.downloads.image];
          saveCache(url, payload);
          return { ok: true, ...payload };
        }
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
    saveCache(url, payload);
    return { ok: true, ...payload };
  })();

  inflight.set(url, job);
  try { return await job; } finally { inflight.delete(url); }
}

function saveCache(url, payload) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(url, { data: payload, time: Date.now() });
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

export function getHealth() {
  return new Promise((resolve) => {
    execFile(YTDLP_BIN, ['--version'], { timeout: 15000 }, (e1, v1) => {
      resolve({
        ok: !e1,
        ytdlp: e1 ? null : String(v1).trim(),
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
  const v = validateTargetUrl(req.query?.url);
  if (!v.ok) return res.status(400).json({ success: false, error: v.error });

  let filename = sanitizeFilename(req.query?.filename, 'download');
  if (!/\.\w{2,5}$/.test(filename)) {
    const ext = String(req.query?.ext || 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'mp4';
    filename += `.${ext}`;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    const up = await fetch(v.url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Referer: 'https://www.google.com/',
        Accept: '*/*',
      },
    });
    clearTimeout(timer);
    if (!up.ok || !up.body) {
      if (up.status === 403 || up.status === 401) return res.status(502).json({ success: false, error: 'Link CDN kedaluwarsa / ditolak. Ulangi proses dari awal untuk link baru.' });
      if (up.status === 404) return res.status(502).json({ success: false, error: 'File sumber sudah tidak tersedia (404).' });
      return res.status(502).json({ success: false, error: 'Gagal mengambil file dari server sumber.' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    const ct = up.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    const cl = up.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);
    const stream = Readable.fromWeb(up.body);
    stream.on('error', () => { try { res.end(); } catch {} });
    if (typeof req.on === 'function') req.on('close', () => { try { stream.destroy(); } catch {} });
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

export function convertToFile({ title, contentType, ext, ytdlpArgs, timeoutMs, req, res }) {
  if (!HAS_FFMPEG) {
    return res.status(501).json({ success: false, error: 'Fitur konversi butuh ffmpeg yang tidak tersedia di server ini. Deploy ke VPS/server penuh untuk MP3 & HD.' });
  }
  const v = validateTargetUrl(req.query?.url);
  if (!v.ok) return res.status(400).json({ success: false, error: v.error });

  const filename = sanitizeFilename(req.query?.filename || title, 'media') + `.${ext}`;
  const id = crypto.randomBytes(8).toString('hex');
  const outTpl = path.join(TMP_DIR, `${id}.%(ext)s`);
  const args = [...ytdlpArgs, '--ffmpeg-location', FFMPEG_BIN, '--no-playlist', '--no-warnings',
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

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const url = body.url ?? req.query?.url;

  const result = await extractMedia(url);
  if (!result.ok) return res.status(result.status || 500).json({ success: false, error: result.error });
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
