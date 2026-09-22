// i18n + tema + ikon SVG — kamus ID/EN, toggle, ikon gaya Lucide (stroke). Dipakai semua halaman.
function svgIcon(name, size) {
  var s = size || 16;
  var P = {
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    paste: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
    captions: '<rect width="18" height="14" x="3" y="5" rx="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    settings: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>'
  };
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
}

const STR = {
  id: {
    'nav.docs': 'Panduan', 'nav.home': 'Kembali', 'nav.install': 'Install',
    'marquee': 'VAN313 ULTRA • NO WATERMARK • MP3 192K • HD 1080P • SUBTITLE • BATCH • PLAYLIST • ',
    'hero.role': 'VAN313 | OFFICIAL', 'hero.action': 'TEMPEL LINK DI BAWAH',
    'form.url': 'TARGET URL', 'form.ph': 'https://tiktok.com/...',
    'form.paste': 'Tempel', 'form.go': 'Download', 'form.processing': 'Memproses...',
    'form.search_ph': 'Cari video YouTube...', 'form.search': 'Cari',
    'form.batch': 'Mode Batch (banyak link)',
    'form.batch_ph': 'Satu link per baris (maks 10)...',
    'form.batch_go': 'Proses Semua',
    'loading': 'MEMPROSES...',
    'err.title': 'Terjadi Kesalahan',
    'sec.preview': 'Preview', 'sec.video': 'Video',
    'sec.hd': 'HD Full + Suara', 'sec.audio': 'Audio',
    'sec.img': 'Foto', 'sec.sub': 'Subtitle',
    'sec.playlist': 'Playlist', 'sec.search': 'Hasil Pencarian',
    'opt.best': 'Terbaik', 'opt.dl': 'Download', 'opt.save': 'Simpan',
    'opt.noaudio': 'Tanpa suara', 'opt.direct': 'langsung',
    'hd.note': 'Digabung di server dengan progress. Hasil MP4 HD bersuara.',
    'hd.noffmpeg': 'HD tidak tersedia di server ini (butuh ffmpeg).',
    'mp3.note': 'Konversi MP3 192kbps otomatis:',
    'mp3.noffmpeg': 'MP3 tidak tersedia di server ini (butuh ffmpeg).',
    'mp3.btn': 'Buat MP3',
    'trim.btn': 'Trim', 'trim.title': 'Potong Video', 'trim.start': 'Mulai (detik)',
    'trim.end': 'Selesai (detik)', 'trim.go': 'Potong', 'trim.max': 'Maksimal hasil 10 menit.',
    'sub.auto': 'otomatis', 'sub.manual': 'resmi',
    'thumb.btn': 'Download Thumbnail',
    'qr.btn': 'QR', 'copy.btn': 'Salin', 'copied': 'Disalin!',
    'play.btn': 'Putar', 'stop.btn': 'Tutup',
    'job.title': 'Proses Server', 'job.cancel': 'Batalkan', 'job.done': 'Selesai — Download',
    'job.failed': 'Gagal', 'job.close': 'Tutup',
    'hist.title': 'Riwayat', 'hist.clear': 'Hapus',
    'pl.choose': 'Pilih item:',
    'pl.items': 'item', 'pl.process': 'Proses',
    'foot.powered': 'DIDUKUNG OLEH', 'foot.tag': 'CEPAT • RINGAN • TANPA WATERMARK',
    'foot.tos': 'Syarat & Ketentuan', 'foot.privacy': 'Privasi', 'foot.dmca': 'DMCA',
    'e.empty': 'Tempel link video ke kolom TARGET URL dulu.',
    'e.badurl': 'Format URL tidak valid.',
    'e.noresult': 'Media tidak ditemukan / link invalid.',
    'e.clip': 'Gagal baca clipboard. Tempel manual (Ctrl+V).',
    'e.cookies': 'Tips: error login IG bisa diatasi dengan cookies.txt (lihat Panduan).',
    'search.noresult': 'Tidak ada hasil.',
    'batch.count': 'link',
    'lightbox.dl': 'Download', 'lightbox.close': 'Tutup',
    'install.done': 'App ter-install.',
    'install.manual': 'Menu browser → "Install app".',
    'theme': 'Tema',
    'd.brand': 'PANDUAN', 'd.back': 'KEMBALI', 'd.h1': 'MANUAL PENGGUNA',
    'd.sub': 'DOKUMENTASI & CARA PAKAI',
    'd.s1': '01 // CARA PAKAI',
    'd.st1t': 'SALIN LINK', 'd.st1d': 'Buka TikTok, Instagram, YouTube, dll. Ketuk "Bagikan" lalu "Salin Tautan".',
    'd.st2t': 'TEMPEL LINK', 'd.st2d': 'Tempel ke kolom "TARGET URL" (atau tekan tombol Tempel).',
    'd.st3t': 'PROSES', 'd.st3d': 'Tekan "Download". Pilih resolusi, audio, foto, atau subtitle.',
    'd.st4t': 'SIMPAN FILE', 'd.st4d': 'Pilih kualitas lalu Download. MP3/HD/Trim diproses server dengan progress.',
    'd.s2': '02 // PLATFORM', 'd.s2sub': 'MENDUKUNG EKSTRAKSI DARI:',
    'd.s3': '03 // BANTUAN',
    'd.faq1q': 'MEDIA TIDAK DITEMUKAN?', 'd.faq1a': 'Pastikan akun tidak private dan link benar. Postingan teks tidak bisa diunduh.',
    'd.faq2q': 'DOWNLOAD GAGAL DI TENGAH?', 'd.faq2a': 'Koneksi tidak stabil atau link kedaluwarsa. Ulangi proses.',
    'd.faq3q': 'TIKTOK MASIH ADA WATERMARK?', 'd.faq3a': 'Pilih opsi "No WM". Jika gagal, server sumber mungkin maintenance.',
    'd.faq4q': 'IG ERROR LOGIN / RATE LIMIT?', 'd.faq4a': 'Tunggu ±1 menit, atau admin bisa pasang cookies.txt.',
    'd.faq5q': 'MP3 / HD / TRIM TIDAK MUNCUL?', 'd.faq5a': 'Butuh ffmpeg (server penuh/VPS). Di Vercel tombolnya otomatis sembunyi.',
    'd.s4': '04 // FITUR LAIN',
    'd.f1': 'Cari video YouTube langsung tanpa link.',
    'd.f2': 'Batch: proses sampai 10 link sekaligus.',
    'd.f3': 'Subtitle YouTube (resmi + otomatis).',
    'd.f4': 'Trim: potong video per detik (maks 10 mnt).',
    'd.f5': 'Install sebagai app + Share dari TikTok/IG.',
    'd.f6': 'QR code tiap file + riwayat + playlist.',
    'd.join': 'VAN313 | OFFICIAL', 'd.joinsub': 'Join untuk update & lapor bug.', 'd.joinbtn': 'Join Channel',
    'l.back': 'Beranda', 'l.en_note': 'English summary below Indonesian version.',
    'a.title': 'ADMIN', 'a.key_ph': 'Kunci admin...', 'a.login': 'Buka', 'a.refresh': 'Refresh',
    'a.cookies': 'Cek Cookies', 'a.total': 'Total request', 'a.ok': 'Sukses', 'a.err': 'Gagal',
    'a.uptime': 'Uptime (detik)', 'a.jobs': 'Jobs (buat/selesai/gagal/batal/aktif)',
    'a.byplat': 'Per platform', 'a.byep': 'Per endpoint', 'a.recent': 'Terbaru', 'a.errors': 'Error terakhir',
    'a.wrong': 'Kunci admin salah.',
    's.title': 'Membuka downloader...', 's.none': 'Tidak ada link ditemukan. Kembali dan Share link video.',
    'o.title': 'OFFLINE', 'o.msg': 'Tidak ada koneksi. Halaman tersimpan masih bisa dibuka.',
  },
  en: {
    'nav.docs': 'Guide', 'nav.home': 'Back', 'nav.install': 'Install',
    'marquee': 'VAN313 ULTRA • NO WATERMARK • MP3 192K • HD 1080P • SUBTITLES • BATCH • PLAYLIST • ',
    'hero.role': 'VAN313 | OFFICIAL', 'hero.action': 'PASTE YOUR LINK BELOW',
    'form.url': 'TARGET URL', 'form.ph': 'https://tiktok.com/...',
    'form.paste': 'Paste', 'form.go': 'Download', 'form.processing': 'Processing...',
    'form.search_ph': 'Search YouTube videos...', 'form.search': 'Search',
    'form.batch': 'Batch Mode (multiple links)',
    'form.batch_ph': 'One link per line (max 10)...',
    'form.batch_go': 'Process All',
    'loading': 'PROCESSING...',
    'err.title': 'Something Went Wrong',
    'sec.preview': 'Preview', 'sec.video': 'Video',
    'sec.hd': 'Full HD + Audio', 'sec.audio': 'Audio',
    'sec.img': 'Photos', 'sec.sub': 'Subtitles',
    'sec.playlist': 'Playlist', 'sec.search': 'Search Results',
    'opt.best': 'Best', 'opt.dl': 'Download', 'opt.save': 'Save',
    'opt.noaudio': 'No audio', 'opt.direct': 'direct',
    'hd.note': 'Merged on server with progress. Result: HD MP4 with audio.',
    'hd.noffmpeg': 'HD unavailable on this server (needs ffmpeg).',
    'mp3.note': 'Automatic 192kbps MP3 conversion:',
    'mp3.noffmpeg': 'MP3 unavailable on this server (needs ffmpeg).',
    'mp3.btn': 'Make MP3',
    'trim.btn': 'Trim', 'trim.title': 'Trim Video', 'trim.start': 'Start (sec)',
    'trim.end': 'End (sec)', 'trim.go': 'Trim', 'trim.max': 'Max 10 min output.',
    'sub.auto': 'auto', 'sub.manual': 'official',
    'thumb.btn': 'Download Thumbnail',
    'qr.btn': 'QR', 'copy.btn': 'Copy', 'copied': 'Copied!',
    'play.btn': 'Play', 'stop.btn': 'Close',
    'job.title': 'Server Job', 'job.cancel': 'Cancel', 'job.done': 'Done — Download',
    'job.failed': 'Failed', 'job.close': 'Close',
    'hist.title': 'History', 'hist.clear': 'Clear',
    'pl.choose': 'Pick an item:',
    'pl.items': 'items', 'pl.process': 'Process',
    'foot.powered': 'POWERED BY', 'foot.tag': 'FAST • LIGHT • NO WATERMARK',
    'foot.tos': 'Terms', 'foot.privacy': 'Privacy', 'foot.dmca': 'DMCA',
    'e.empty': 'Paste a video link into TARGET URL first.',
    'e.badurl': 'Invalid URL format.',
    'e.noresult': 'Media not found / invalid link.',
    'e.clip': 'Cannot read clipboard. Paste manually (Ctrl+V).',
    'e.cookies': 'Tip: IG login errors can be fixed with cookies.txt (see Guide).',
    'search.noresult': 'No results.',
    'batch.count': 'links',
    'lightbox.dl': 'Download', 'lightbox.close': 'Close',
    'install.done': 'App installed.',
    'install.manual': 'Browser menu → "Install app".',
    'theme': 'Theme',
    'd.brand': 'GUIDE', 'd.back': 'BACK', 'd.h1': 'USER MANUAL',
    'd.sub': 'DOCUMENTATION & HOW TO USE',
    'd.s1': '01 // HOW TO USE',
    'd.st1t': 'COPY LINK', 'd.st1d': 'Open TikTok, Instagram, YouTube, etc. Tap "Share" then "Copy Link".',
    'd.st2t': 'PASTE LINK', 'd.st2d': 'Paste into "TARGET URL" (or press Paste).',
    'd.st3t': 'PROCESS', 'd.st3d': 'Press "Download". Pick resolution, audio, photo, or subtitle.',
    'd.st4t': 'SAVE FILE', 'd.st4d': 'Pick quality then Download. MP3/HD/Trim run on server with progress.',
    'd.s2': '02 // PLATFORMS', 'd.s2sub': 'EXTRACTION SUPPORTED FROM:',
    'd.s3': '03 // HELP',
    'd.faq1q': 'MEDIA NOT FOUND?', 'd.faq1a': 'Make sure the account is public and the link is correct.',
    'd.faq2q': 'DOWNLOAD FAILED MIDWAY?', 'd.faq2a': 'Unstable connection or expired link. Retry.',
    'd.faq3q': 'TIKTOK STILL HAS WATERMARK?', 'd.faq3a': 'Pick "No WM" options. If it fails, the source may be in maintenance.',
    'd.faq4q': 'IG LOGIN / RATE LIMIT?', 'd.faq4a': 'Wait ±1 min, or admin can install cookies.txt.',
    'd.faq5q': 'MP3 / HD / TRIM MISSING?', 'd.faq5a': 'Needs ffmpeg (full server/VPS). Auto-hidden on Vercel.',
    'd.s4': '04 // MORE FEATURES',
    'd.f1': 'Search YouTube videos directly, no link needed.',
    'd.f2': 'Batch: process up to 10 links at once.',
    'd.f3': 'YouTube subtitles (official + auto).',
    'd.f4': 'Trim: cut video by seconds (max 10 min).',
    'd.f5': 'Install as app + Share from TikTok/IG.',
    'd.f6': 'QR code per file + history + playlists.',
    'd.join': 'VAN313 | OFFICIAL', 'd.joinsub': 'Join for updates & bug reports.', 'd.joinbtn': 'Join Channel',
    'l.back': 'Home', 'l.en_note': 'English summary below Indonesian version.',
    'a.title': 'ADMIN', 'a.key_ph': 'Admin key...', 'a.login': 'Open', 'a.refresh': 'Refresh',
    'a.cookies': 'Check Cookies', 'a.total': 'Total requests', 'a.ok': 'Success', 'a.err': 'Failed',
    'a.uptime': 'Uptime (sec)', 'a.jobs': 'Jobs (created/done/error/cancelled/active)',
    'a.byplat': 'By platform', 'a.byep': 'By endpoint', 'a.recent': 'Recent', 'a.errors': 'Latest errors',
    'a.wrong': 'Wrong admin key.',
    's.title': 'Opening downloader...', 's.none': 'No link found. Go back and Share a video link.',
    'o.title': 'OFFLINE', 'o.msg': 'No connection. Saved pages still open.',
  },
};

function getLang() {
  try { return localStorage.getItem('sann_lang') || 'id'; } catch (e) { return 'id'; }
}
function t(key) {
  var L = getLang();
  return (STR[L] && STR[L][key]) || STR.id[key] || key;
}
function setLang(L) {
  try { localStorage.setItem('sann_lang', L); } catch (e) {}
  applyI18n();
}
function applyI18n() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
  var lb = document.getElementById('langBtn');
  if (lb) lb.innerHTML = svgIcon('globe', 15) + '<span>' + (getLang() === 'id' ? 'ID' : 'EN') + '</span>';
}

// Tema terang/gelap
function getTheme() {
  try { return localStorage.getItem('sann_theme') || 'dark'; } catch (e) { return 'dark'; }
}
function applyTheme() {
  document.documentElement.dataset.theme = getTheme() === 'light' ? 'light' : '';
  var tb = document.getElementById('themeBtn');
  if (tb) tb.innerHTML = svgIcon(getTheme() === 'light' ? 'sun' : 'moon', 16);
}
function toggleTheme() {
  try { localStorage.setItem('sann_theme', getTheme() === 'light' ? 'dark' : 'light'); } catch (e) {}
  applyTheme();
}
document.addEventListener('DOMContentLoaded', function () { applyI18n(); applyTheme(); });
