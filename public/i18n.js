// i18n + tema — kamus ID/EN & toggle. Dipakai semua halaman.
const STR = {
  id: {
    'nav.docs': 'BACA YA INI', 'nav.home': 'KEMBALI KE SISTEM', 'nav.install': 'INSTALL APP',
    'marquee': 'SYSTEM READY • V.4.0 ULTRA • NO WATERMARK • MP3 • HD 1080P • SUBTITLE • BATCH • SANN404 • ',
    'hero.role': 'ADMINISTRATOR', 'hero.action': 'PASTE YOUR LINK BELOW',
    'form.url': 'TARGET URL:', 'form.ph': 'https://tiktok.com/...',
    'form.paste': '📋 TEMPEL', 'form.go': 'INITIATE DOWNLOAD', 'form.processing': 'MEMPROSES...',
    'form.search_ph': 'Cari video YouTube...', 'form.search': '🔍 CARI',
    'form.batch': '📦 MODE BATCH (banyak link)',
    'form.batch_ph': 'Satu link per baris (maks 10)...',
    'form.batch_go': 'PROSES SEMUA',
    'loading': 'PROCESSING DATA STREAM...',
    'err.title': 'SYSTEM ERROR',
    'sec.preview': 'PREVIEW', 'sec.video': '🎬 VIDEO MP4 // PILIH RESOLUSI',
    'sec.hd': '🔥 HD FULL (GAMBAR + SUARA DIGABUNG)', 'sec.audio': '🎵 AUDIO / MP3',
    'sec.img': '🖼️ GAMBAR // NO WATERMARK', 'sec.sub': '💬 SUBTITLE / CAPTION',
    'sec.playlist': '📋 PLAYLIST TERDETEKSI', 'sec.search': '🔍 HASIL PENCARIAN',
    'opt.best': '⬇ DOWNLOAD TERBAIK', 'opt.dl': '⬇ DOWNLOAD', 'opt.save': '⬇ SAVE',
    'opt.noaudio': '⚠ TANPA SUARA', 'opt.direct': 'langsung',
    'hd.note': '⚙ Diproses di server dengan progress. Hasil: MP4 HD bersuara.',
    'hd.noffmpeg': '⚠ HD FULL tidak tersedia di server ini (butuh ffmpeg). Deploy ke VPS/server penuh untuk mengaktifkan. Pilihan download langsung di atas tetap bisa dipakai.',
    'mp3.note': '💡 Butuh MP3 murni? Konversi otomatis 192kbps (semua platform):',
    'mp3.noffmpeg': '⚠ Konversi MP3 tidak tersedia di server ini (butuh ffmpeg). Pakai file audio langsung di atas, atau deploy ke VPS/server penuh.',
    'mp3.btn': '🎵 BUAT MP3 192KBPS',
    'trim.btn': '✂ TRIM', 'trim.title': 'POTONG VIDEO', 'trim.start': 'Mulai (detik):',
    'trim.end': 'Selesai (detik):', 'trim.go': 'PROSES TRIM', 'trim.max': 'Maks hasil 10 menit.',
    'sub.auto': 'otomatis', 'sub.manual': 'resmi',
    'thumb.btn': '⬇ DOWNLOAD THUMBNAIL',
    'qr.btn': 'QR', 'copy.btn': 'SALIN', 'copied': 'Disalin!',
    'play.btn': '▶ PUTAR', 'stop.btn': '⏹ TUTUP',
    'job.title': 'PROSES SERVER', 'job.cancel': 'BATALKAN', 'job.done': 'SELESAI — DOWNLOAD SEKARANG',
    'job.failed': 'GAGAL', 'job.close': 'TUTUP',
    'hist.title': '🕘 RIWAYAT TERAKHIR', 'hist.clear': 'HAPUS RIWAYAT',
    'pl.choose': 'Klik PROSES pada item yang mau didownload:',
    'pl.items': 'ITEM', 'pl.process': '⚙ PROSES',
    'foot.powered': 'POWERED BY', 'foot.tag': 'ENGINEERED FOR PERFORMANCE',
    'foot.tos': 'Syarat & Ketentuan', 'foot.privacy': 'Privasi', 'foot.dmca': 'DMCA',
    'e.empty': 'Tempel dulu link videonya ke kolom TARGET URL.',
    'e.badurl': 'Format URL tidak valid. Contoh: https://www.tiktok.com/...',
    'e.noresult': 'Media tidak ditemukan / Link Invalid.',
    'e.clip': 'Gagal baca clipboard. Tempel manual (Ctrl+V).',
    'e.cookies': '💡 Tips: error login/rate-limit IG bisa diatasi dengan cookies.txt di server (lihat Docs).',
    'search.noresult': 'Tidak ada hasil.',
    'batch.count': 'link',
    'lightbox.dl': '⬇ DOWNLOAD INI', 'lightbox.close': 'TUTUP ✕',
    'install.done': 'App ter-install / sudah tersedia.',
    'install.manual': 'Untuk install: menu browser (⋮) → "Install app" / "Add to Home Screen".',
    'theme': '🌙/☀️ Tema',
    'd.brand': 'BACA!!', 'd.back': 'KEMBALI KE SISTEM', 'd.h1': 'MANUAL PENGGUNA',
    'd.sub': 'ARSIP DOKUMENTASI & PROTOKOL PENGGUNAAN',
    'd.s1': '01 // PROTOKOL EKSEKUSI',
    'd.st1t': 'AKUISISI TAUTAN (COPY LINK)', 'd.st1d': 'Buka aplikasi target (TikTok, Instagram, YouTube, dll). Cari tombol "Share/Bagikan" lalu pilih "Salin Tautan".',
    'd.st2t': 'INJEKSI DATA (PASTE)', 'd.st2d': 'Kembali ke sistem, tempel tautan ke kotak "TARGET URL" (atau tekan 📋 TEMPEL).',
    'd.st3t': 'INISIASI PROSES', 'd.st3d': 'Tekan "INITIATE DOWNLOAD". Sistem memindai dan menampilkan pilihan resolusi, audio, gambar & subtitle.',
    'd.st4t': 'PENGAMBILAN FILE', 'd.st4d': 'Pilih kualitas lalu "DOWNLOAD". Untuk MP3/HD/trim, proses server berjalan dengan progress bar.',
    'd.s2': '02 // DATABASE PLATFORM', 'd.s2sub': 'SISTEM MENDUKUNG EKSTRAKSI DARI:',
    'd.s3': '03 // DIAGNOSA MASALAH',
    'd.faq1q': 'ERROR: MEDIA TIDAK DITEMUKAN?', 'd.faq1a': 'Pastikan akun tidak private dan link benar. Postingan teks tanpa media tidak bisa diunduh.',
    'd.faq2q': 'DOWNLOAD GAGAL DI TENGAH JALAN?', 'd.faq2a': 'Koneksi tidak stabil atau link CDN kedaluwarsa. Refresh dan ulangi proses.',
    'd.faq3q': 'TIKTOK MASIH ADA WATERMARK?', 'd.faq3a': 'Pilih opsi bertanda "No WM". Jika gagal, server sumber mungkin maintenance.',
    'd.faq4q': 'IG ERROR "BUTUH LOGIN" / "RATE LIMIT"?', 'd.faq4a': 'Instagram membatasi server. Tunggu ±1 menit, atau admin bisa pasang cookies.txt (lihat README).',
    'd.faq5q': 'MP3 / HD / TRIM TIDAK MUNCUL?', 'd.faq5a': 'Fitur konversi butuh ffmpeg (server penuh/VPS). Di Vercel tombolnya otomatis disembunyikan.',
    'd.s4': '04 // FITUR LANJUTAN',
    'd.f1': '🔍 Cari video YouTube langsung tanpa link.',
    'd.f2': '📦 Batch: proses sampai 10 link sekaligus.',
    'd.f3': '💬 Subtitle YouTube (resmi + otomatis, termasuk Indonesia).',
    'd.f4': '✂ Trim: potong video per detik (maks 10 mnt).',
    'd.f5': '📲 Install sebagai app + Share langsung dari TikTok/IG.',
    'd.f6': '📋 QR code tiap file + riwayat + playlist.',
    'd.join': 'SANN404 FORUM ACCESS', 'd.joinsub': 'Bergabung untuk update sistem & lapor bug.', 'd.joinbtn': 'JoinSaluran',
    'l.back': '← BERANDA', 'l.en_note': 'English summary below Indonesian version.',
    'a.title': 'ADMIN STATS', 'a.key_ph': 'Kunci admin...', 'a.login': 'BUKA', 'a.refresh': '⟳ REFRESH',
    'a.cookies': 'CEK COOKIES', 'a.total': 'Total request', 'a.ok': 'Sukses', 'a.err': 'Gagal',
    'a.uptime': 'Uptime (detik)', 'a.jobs': 'Jobs (buat/selesai/gagal/batal/aktif)',
    'a.byplat': 'Per platform', 'a.byep': 'Per endpoint', 'a.recent': 'Terbaru', 'a.errors': 'Error terakhir',
    'a.wrong': 'Kunci admin salah.',
    's.title': 'Membuka downloader...', 's.none': 'Tidak ada link ditemukan. Kembali dan Share link video.',
    'o.title': 'OFFLINE', 'o.msg': 'Tidak ada koneksi. Halaman tersimpan masih bisa dibuka.',
  },
  en: {
    'nav.docs': 'READ THIS DOCS', 'nav.home': 'BACK TO SYSTEM', 'nav.install': 'INSTALL APP',
    'marquee': 'SYSTEM READY • V.4.0 ULTRA • NO WATERMARK • MP3 • HD 1080P • SUBTITLES • BATCH • SANN404 • ',
    'hero.role': 'ADMINISTRATOR', 'hero.action': 'PASTE YOUR LINK BELOW',
    'form.url': 'TARGET URL:', 'form.ph': 'https://tiktok.com/...',
    'form.paste': '📋 PASTE', 'form.go': 'INITIATE DOWNLOAD', 'form.processing': 'PROCESSING...',
    'form.search_ph': 'Search YouTube videos...', 'form.search': '🔍 SEARCH',
    'form.batch': '📦 BATCH MODE (multiple links)',
    'form.batch_ph': 'One link per line (max 10)...',
    'form.batch_go': 'PROCESS ALL',
    'loading': 'PROCESSING DATA STREAM...',
    'err.title': 'SYSTEM ERROR',
    'sec.preview': 'PREVIEW', 'sec.video': '🎬 MP4 VIDEOS // PICK RESOLUTION',
    'sec.hd': '🔥 FULL HD (VIDEO + AUDIO MERGED)', 'sec.audio': '🎵 AUDIO / MP3',
    'sec.img': '🖼️ IMAGES // NO WATERMARK', 'sec.sub': '💬 SUBTITLES / CAPTIONS',
    'sec.playlist': '📋 PLAYLIST DETECTED', 'sec.search': '🔍 SEARCH RESULTS',
    'opt.best': '⬇ DOWNLOAD BEST', 'opt.dl': '⬇ DOWNLOAD', 'opt.save': '⬇ SAVE',
    'opt.noaudio': '⚠ NO AUDIO', 'opt.direct': 'direct',
    'hd.note': '⚙ Processed on server with progress. Result: HD MP4 with audio.',
    'hd.noffmpeg': '⚠ FULL HD unavailable on this server (needs ffmpeg). Deploy to a VPS/full server to enable. Direct downloads above still work.',
    'mp3.note': '💡 Need pure MP3? Automatic 192kbps conversion (all platforms):',
    'mp3.noffmpeg': '⚠ MP3 conversion unavailable on this server (needs ffmpeg). Use direct audio above, or deploy to a VPS/full server.',
    'mp3.btn': '🎵 MAKE MP3 192KBPS',
    'trim.btn': '✂ TRIM', 'trim.title': 'TRIM VIDEO', 'trim.start': 'Start (sec):',
    'trim.end': 'End (sec):', 'trim.go': 'PROCESS TRIM', 'trim.max': 'Max 10 min output.',
    'sub.auto': 'auto', 'sub.manual': 'official',
    'thumb.btn': '⬇ DOWNLOAD THUMBNAIL',
    'qr.btn': 'QR', 'copy.btn': 'COPY', 'copied': 'Copied!',
    'play.btn': '▶ PLAY', 'stop.btn': '⏹ CLOSE',
    'job.title': 'SERVER JOB', 'job.cancel': 'CANCEL', 'job.done': 'DONE — DOWNLOAD NOW',
    'job.failed': 'FAILED', 'job.close': 'CLOSE',
    'hist.title': '🕘 RECENT HISTORY', 'hist.clear': 'CLEAR HISTORY',
    'pl.choose': 'Click PROCESS on the item you want to download:',
    'pl.items': 'ITEMS', 'pl.process': '⚙ PROCESS',
    'foot.powered': 'POWERED BY', 'foot.tag': 'ENGINEERED FOR PERFORMANCE',
    'foot.tos': 'Terms of Service', 'foot.privacy': 'Privacy', 'foot.dmca': 'DMCA',
    'e.empty': 'Paste a video link into TARGET URL first.',
    'e.badurl': 'Invalid URL format. Example: https://www.tiktok.com/...',
    'e.noresult': 'Media not found / Invalid link.',
    'e.clip': 'Cannot read clipboard. Paste manually (Ctrl+V).',
    'e.cookies': '💡 Tip: IG login/rate-limit errors can be fixed with cookies.txt on the server (see Docs).',
    'search.noresult': 'No results.',
    'batch.count': 'links',
    'lightbox.dl': '⬇ DOWNLOAD THIS', 'lightbox.close': 'CLOSE ✕',
    'install.done': 'App installed / already available.',
    'install.manual': 'To install: browser menu (⋮) → "Install app" / "Add to Home Screen".',
    'theme': '🌙/☀️ Theme',
    'd.brand': 'READ!!', 'd.back': 'BACK TO SYSTEM', 'd.h1': 'USER MANUAL',
    'd.sub': 'DOCUMENTATION ARCHIVE & USAGE PROTOCOL',
    'd.s1': '01 // EXECUTION PROTOCOL',
    'd.st1t': 'ACQUIRE LINK (COPY)', 'd.st1d': 'Open the target app (TikTok, Instagram, YouTube, etc). Tap "Share" then "Copy Link".',
    'd.st2t': 'INJECT DATA (PASTE)', 'd.st2d': 'Back to the system, paste the link into "TARGET URL" (or press 📋 PASTE).',
    'd.st3t': 'INITIATE PROCESS', 'd.st3d': 'Press "INITIATE DOWNLOAD". The system scans and shows resolution, audio, image & subtitle options.',
    'd.st4t': 'RETRIEVE FILE', 'd.st4d': 'Pick quality then "DOWNLOAD". MP3/HD/trim run on server with a progress bar.',
    'd.s2': '02 // PLATFORM DATABASE', 'd.s2sub': 'EXTRACTION SUPPORTED FROM:',
    'd.s3': '03 // TROUBLESHOOTING',
    'd.faq1q': 'ERROR: MEDIA NOT FOUND?', 'd.faq1a': 'Make sure the account is public and the link is correct. Text-only posts cannot be downloaded.',
    'd.faq2q': 'DOWNLOAD FAILED MIDWAY?', 'd.faq2a': 'Unstable connection or expired CDN link. Refresh and retry.',
    'd.faq3q': 'TIKTOK STILL HAS WATERMARK?', 'd.faq3a': 'Pick options marked "No WM". If it fails, the source may be in maintenance.',
    'd.faq4q': 'IG "LOGIN REQUIRED" / "RATE LIMIT"?', 'd.faq4a': 'Instagram throttles servers. Wait ±1 min, or admin can install cookies.txt (see README).',
    'd.faq5q': 'MP3 / HD / TRIM MISSING?', 'd.faq5a': 'Conversion needs ffmpeg (full server/VPS). On Vercel the buttons auto-hide.',
    'd.s4': '04 // ADVANCED FEATURES',
    'd.f1': '🔍 Search YouTube videos directly, no link needed.',
    'd.f2': '📦 Batch: process up to 10 links at once.',
    'd.f3': '💬 YouTube subtitles (official + auto, incl. Indonesian).',
    'd.f4': '✂ Trim: cut video by seconds (max 10 min).',
    'd.f5': '📲 Install as app + Share straight from TikTok/IG.',
    'd.f6': '📋 QR code per file + history + playlists.',
    'd.join': 'SANN404 FORUM ACCESS', 'd.joinsub': 'Join for system updates & bug reports.', 'd.joinbtn': 'JoinChannel',
    'l.back': '← HOME', 'l.en_note': 'English summary below Indonesian version.',
    'a.title': 'ADMIN STATS', 'a.key_ph': 'Admin key...', 'a.login': 'OPEN', 'a.refresh': '⟳ REFRESH',
    'a.cookies': 'CHECK COOKIES', 'a.total': 'Total requests', 'a.ok': 'Success', 'a.err': 'Failed',
    'a.uptime': 'Uptime (sec)', 'a.jobs': 'Jobs (created/done/error/cancelled/active)',
    'a.byplat': 'By platform', 'a.byep': 'By endpoint', 'a.recent': 'Recent', 'a.errors': 'Latest errors',
    'a.wrong': 'Wrong admin key.',
    's.title': 'Opening downloader...', 's.none': 'No link found. Go back and Share a video link.',
    'o.title': 'OFFLINE', 'o.msg': 'No connection. Saved pages still open.',
  },
};

function getLang() {
  try { return localStorage.getItem('sann_lang') || 'id'; } catch { return 'id'; }
}
function t(key) {
  const L = getLang();
  return (STR[L] && STR[L][key]) || STR.id[key] || key;
}
function setLang(L) {
  try { localStorage.setItem('sann_lang', L); } catch {}
  applyI18n();
}
function applyI18n() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  const lb = document.getElementById('langBtn');
  if (lb) lb.textContent = getLang() === 'id' ? '🌐 ID' : '🌐 EN';
}

// Tema terang/gelap
function getTheme() {
  try { return localStorage.getItem('sann_theme') || 'dark'; } catch { return 'dark'; }
}
function applyTheme() {
  document.documentElement.dataset.theme = getTheme() === 'light' ? 'light' : '';
  const tb = document.getElementById('themeBtn');
  if (tb) tb.textContent = getTheme() === 'light' ? '☀️' : '🌙';
}
function toggleTheme() {
  try { localStorage.setItem('sann_theme', getTheme() === 'light' ? 'dark' : 'light'); } catch {}
  applyTheme();
}
document.addEventListener('DOMContentLoaded', () => { applyI18n(); applyTheme(); });
