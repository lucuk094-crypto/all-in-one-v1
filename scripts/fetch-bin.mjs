// Download binary yt-dlp saat Vercel build (biar repo tetap kecil).
// Dijalankan via: npm run vercel-build
import { mkdirSync, existsSync, chmodSync, createWriteStream, statSync } from 'fs';
import { Readable } from 'stream';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'api', 'bin');
mkdirSync(dir, { recursive: true });
const dest = path.join(dir, 'yt-dlp');

if (existsSync(dest) && statSync(dest).size > 10 * 1024 * 1024) {
  chmodSync(dest, 0o755);
  console.log('yt-dlp sudah ada, skip download.');
  process.exit(0);
}

const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
console.log('Download yt-dlp dari', url);
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok || !res.body) throw new Error(`Gagal download yt-dlp: HTTP ${res.status}`);

const file = createWriteStream(dest);
await new Promise((resolve, reject) => {
  Readable.fromWeb(res.body).pipe(file);
  file.on('finish', resolve);
  file.on('error', reject);
});
chmodSync(dest, 0o755);
console.log('yt-dlp tersimpan:', dest, Math.round(statSync(dest).size / 1024 / 1024) + 'MB');
