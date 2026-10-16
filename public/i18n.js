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
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
}

const STR = {
  id: {
    'nav.docs': 'Panduan', 'nav.home': 'Beranda', 'nav.install': 'Install App',
    'marquee': 'ULTRA DOWNLOADER • TIKTOK TANPA WATERMARK • IG REELS & FOTO • YOUTUBE HD & MP3 • FACEBOOK HD • TWITTER / X • CEPAT & GRATIS • ',
    'hero.role': 'ULTRA DOWNLOADER // ALL-IN-ONE ENGINE', 'hero.action': 'TEMPEL TAUTAN MEDIA DI BAWAH',
    'form.url': '01 // TARGET URL', 'form.ph': 'Tempel link TikTok, IG, YouTube, FB, X di sini...',
    'form.paste': 'Tempel', 'form.clear': 'Hapus', 'form.go': 'Download Sekarang', 'form.processing': 'Memproses...',
    'form.examples': 'CONTOH CEPAT (KLIK UNTUK TES):',
    'form.search_lbl': '02 // PENCARIAN YOUTUBE LANGSUNG',
    'form.search_ph': 'Ketik judul lagu atau video YouTube...', 'form.search': 'Cari Video',
    'form.batch': 'Mode Batch (Proses Banyak Link Sekaligus)',
    'form.batch_ph': 'Tempel satu link per baris (maksimal 10 link)...',
    'form.batch_go': 'Proses Semua Link',
    'loading': 'SEDANG MENGEKSTRAK MEDIA...',
    'err.title': 'Terjadi Kesalahan',
    'sec.preview': 'Preview Media', 'sec.video': 'Pilihan Video',
    'sec.hd': 'Konversi HD + Suara', 'sec.audio': 'Pilihan Audio / MP3',
    'sec.img': 'Galeri Foto', 'sec.sub': 'Subtitle',
    'sec.playlist': 'Daftar Playlist', 'sec.search': 'Hasil Pencarian YouTube',
    'opt.best': 'Unduh Terbaik', 'opt.dl': 'Download', 'opt.save': 'Simpan Foto',
    'opt.noaudio': 'Video Saja', 'opt.direct': 'langsung',
    'hd.note': 'Digabung otomatis dengan audio jernih. Hasil file MP4 siap tonton.',
    'hd.noffmpeg': 'HD tidak tersedia di server ini.',
    'mp3.note': 'Ekstrak audio MP3 jernih secara instan:',
    'mp3.noffmpeg': 'MP3 tidak tersedia di server ini.',
    'mp3.btn': 'Convert ke MP3',
    'trim.btn': 'Potong Video', 'trim.title': 'Potong Durasi Video', 'trim.start': 'Mulai (detik)',
    'trim.end': 'Selesai (detik)', 'trim.go': 'Potong Sekarang', 'trim.max': 'Maksimal durasi hasil 10 menit.',
    'sub.auto': 'otomatis', 'sub.manual': 'resmi',
    'thumb.btn': 'Unduh Thumbnail',
    'qr.btn': 'QR', 'copy.btn': 'Salin', 'copied': 'Tautan berhasil disalin!',
    'play.btn': 'Putar', 'stop.btn': 'Tutup',
    'job.title': 'Memproses File di Server', 'job.cancel': 'Batalkan', 'job.done': 'Selesai — Unduh File',
    'job.failed': 'Gagal', 'job.close': 'Tutup',
    'hist.title': 'Riwayat Unduhan Terakhir', 'hist.clear': 'Bersihkan',
    'pl.choose': 'Pilih video dari daftar untuk diunduh:',
    'pl.items': 'item', 'pl.process': 'Pilih & Proses',
    'guide.badge': 'PANDUAN KILAT',
    'guide.title': 'CARA PAKAI ULTRA DOWNLOADER',
    'guide.sub': '4 LANGKAH MUDAH TANPA RIBET & TANPA WATERMARK',
    'guide.s1t': 'SALIN TAUTAN', 'guide.s1d': 'Buka aplikasi TikTok, Instagram, YouTube, Facebook, atau X lalu salin link postingan.',
    'guide.s2t': 'TEMPEL KE KOLOM', 'guide.s2d': 'Klik tombol "Tempel" pada kolom Target URL atau gunakan pencarian YouTube langsung.',
    'guide.s3t': 'KLIK DOWNLOAD', 'guide.s3d': 'Sistem otomatis mendeteksi platform dan menampilkan preview beserta semua resolusi.',
    'guide.s4t': 'SIMPAN MEDIA', 'guide.s4d': 'Pilih format Video HD, MP3 Audio, atau Foto lalu unduh langsung ke perangkatmu.',
    'guide.more': 'Buka Dokumentasi & FAQ Lengkap →',
    'foot.powered': 'DIKEMBANGKAN OLEH', 'foot.tag': 'NEO-BRUTALISM UI • CEPAT • BERSIH • TANPA WATERMARK',
    'foot.tos': 'Syarat & Ketentuan', 'foot.privacy': 'Privasi', 'foot.dmca': 'DMCA',
    'e.empty': 'Tempel link video ke kolom TARGET URL terlebih dahulu.',
    'e.badurl': 'Format URL tidak valid. Pastikan diawali http:// atau https://',
    'e.noresult': 'Media tidak ditemukan atau akun bersifat private.',
    'e.clip': 'Izin clipboard ditolak browser. Silakan tempel manual (Ctrl+V / Tahan & Tempel).',
    'e.cookies': 'Tips: Untuk konten IG/FB private tertentu, admin dapat memasang cookies.txt.',
    'e.cookies_yt': 'Tips: Pasang cookies YouTube via halaman Admin untuk video batas usia.',
    'e.cookies_gen': 'Tips: Konten memerlukan autentikasi pada platform sumber.',
    'search.noresult': 'Tidak ditemukan hasil pencarian yang cocok.',
    'batch.count': 'tautan berhasil diproses',
    'lightbox.dl': 'Unduh Gambar', 'lightbox.close': 'Tutup',
    'install.done': 'Ultra Downloader berhasil di-install!',
    'install.manual': 'Buka menu browser → pilih "Tambahkan ke Layar Utama / Install App".',
    'theme': 'Tema',
    'd.brand': 'PANDUAN ULTRA', 'd.back': 'KEMBALI KE BERANDA', 'd.h1': 'PANDUAN & DOKUMENTASI',
    'd.sub': 'MANUAL LENGKAP PENGGUNAAN ULTRA DOWNLOADER',
    'd.s1': '01 // LANGKAH EKSEKUSI',
    'd.st1t': 'SALIN TAUTAN (COPY LINK)', 'd.st1d': 'Buka TikTok, Instagram, YouTube, Facebook, atau X/Twitter. Ketuk tombol "Bagikan" lalu pilih "Salin Tautan".',
    'd.st2t': 'TEMPEL TAUTAN (PASTE)', 'd.st2d': 'Tempel tautan ke kolom "TARGET URL" di halaman utama atau cukup tekan tombol "Tempel" otomatis.',
    'd.st3t': 'EKSTRAKSI & PREVIEW', 'd.st3d': 'Tekan tombol "Download Sekarang". Sistem akan menampilkan player preview, resolusi video, audio MP3, atau galeri foto.',
    'd.st4t': 'UNDUH KE PERANGKAT', 'd.st4d': 'Pilih resolusi terbaik (HD No Watermark / MP4 / MP3) lalu simpan langsung ke HP atau laptop Anda.',
    'd.s2': '02 // PLATFORM & FITUR DIDUKUNG', 'd.s2sub': 'TERINTEGRASI PENUH DENGAN ENGINE KECEPATAN TINGGI:',
    'd.s3': '03 // SOLUSI MASALAH (FAQ)',
    'd.faq1q': 'KENAPA MEDIA TIDAK DITEMUKAN?', 'd.faq1a': 'Pastikan akun atau postingan bersifat publik (bukan akun private) dan link yang disalin masih aktif.',
    'd.faq2q': 'UNDUHAN TERPUTUS DI TENGAH JALAN?', 'd.faq2a': 'Biasanya karena koneksi internet berganti atau link CDN sudah kedaluwarsa. Cukup klik Download ulang dari awal.',
    'd.faq3q': 'BAGAIMANA CARA DOWNLOAD TIKTOK TANPA WATERMARK?', 'd.faq3a': 'Pilih tombol "HD • No WM" pada bagian Pilihan Video. Video akan langsung terunduh bersih tanpa logo.',
    'd.faq4q': 'BAGAIMANA CARA UBAH VIDEO YOUTUBE JADI MP3?', 'd.faq4a': 'Tempel link YouTube lalu pilih "MP3 • 128kbps" di bagian Pilihan Audio, atau klik tombol "Convert ke MP3".',
    'd.faq5q': 'APAKAH BISA DIGUNAKAN DI HP DAN LAPTOP?', 'd.faq5a': 'Ya! Ultra Downloader dirancang responsif penuh untuk semua layar smartphone Android/iOS, tablet, maupun laptop/PC.',
    'd.s4': '04 // FITUR EKSTRA ULTRA DOWNLOADER',
    'd.f1': 'Pencarian YouTube langsung berdasarkan kata kunci tanpa harus menyalin link.',
    'd.f2': 'Mode Batch: proses dan ekstrak hingga 10 tautan berbeda sekaligus.',
    'd.f3': 'Pemutar video & audio inline dengan pengubah kualitas langsung di halaman.',
    'd.f4': 'Pembuat kode QR instan di setiap format untuk kirim cepat dari laptop ke HP.',
    'd.f5': 'Dukungan PWA: bisa di-install sebagai aplikasi di HP maupun desktop.',
    'd.f6': 'Riwayat unduhan otomatis tersimpan aman di browser Anda.',
    'd.join': 'ULTRA DOWNLOADER OFFICIAL', 'd.joinsub': 'Ikuti saluran resmi untuk info pembaruan fitur & bantuan teknis.', 'd.joinbtn': 'Gabung Saluran Resmi',
    'l.back': 'Beranda', 'l.en_note': 'English summary below Indonesian version.',
    'a.title': 'ADMIN PANEL', 'a.key_ph': 'Masukkan kunci admin...', 'a.login': 'Buka Statistik', 'a.refresh': 'Muat Ulang',
    'a.cookies': 'Cek Status Cookies', 'a.up_t': 'Upload cookies.txt (Khusus Server VPS)', 'a.up_btn': 'Upload Cookies', 'a.total': 'Total Request', 'a.ok': 'Sukses', 'a.err': 'Gagal',
    'a.uptime': 'Uptime (detik)', 'a.jobs': 'Statistik Job Server',
    'a.byplat': 'Trafik per Platform', 'a.byep': 'Trafik per Endpoint', 'a.recent': 'Aktivitas Terbaru', 'a.errors': 'Log Error Terakhir',
    'a.wrong': 'Kunci admin tidak sesuai.',
    's.title': 'Membuka Ultra Downloader...', 's.none': 'Tidak ada tautan ditemukan. Silakan bagikan ulang link video.',
    'o.title': 'MODE OFFLINE', 'o.msg': 'Koneksi internet terputus. Nyalakan data/Wi-Fi lalu coba kembali.',
  },
  en: {
    'nav.docs': 'Guide', 'nav.home': 'Home', 'nav.install': 'Install App',
    'marquee': 'ULTRA DOWNLOADER • NO WATERMARK TIKTOK • IG REELS & PHOTOS • YOUTUBE HD & MP3 • FACEBOOK HD • TWITTER / X • FAST & FREE • ',
    'hero.role': 'ULTRA DOWNLOADER // ALL-IN-ONE ENGINE', 'hero.action': 'PASTE YOUR MEDIA LINK BELOW',
    'form.url': '01 // TARGET URL', 'form.ph': 'Paste TikTok, IG, YouTube, FB, X link here...',
    'form.paste': 'Paste', 'form.clear': 'Clear', 'form.go': 'Download Now', 'form.processing': 'Processing...',
    'form.examples': 'QUICK EXAMPLES (CLICK TO TEST):',
    'form.search_lbl': '02 // DIRECT YOUTUBE SEARCH',
    'form.search_ph': 'Type song title or YouTube video keywords...', 'form.search': 'Search Video',
    'form.batch': 'Batch Mode (Process Multiple Links)',
    'form.batch_ph': 'Paste one link per line (up to 10 links)...',
    'form.batch_go': 'Process All Links',
    'loading': 'EXTRACTING MEDIA...',
    'err.title': 'Something Went Wrong',
    'sec.preview': 'Media Preview', 'sec.video': 'Video Options',
    'sec.hd': 'Full HD + Audio Merge', 'sec.audio': 'Audio / MP3 Options',
    'sec.img': 'Photo Gallery', 'sec.sub': 'Subtitles',
    'sec.playlist': 'Playlist Items', 'sec.search': 'YouTube Search Results',
    'opt.best': 'Best Quality', 'opt.dl': 'Download', 'opt.save': 'Save Photo',
    'opt.noaudio': 'Video Only', 'opt.direct': 'direct',
    'hd.note': 'Automatically merged with crisp audio into a ready-to-watch MP4 file.',
    'hd.noffmpeg': 'HD merge unavailable on this server.',
    'mp3.note': 'Extract high-quality MP3 audio instantly:',
    'mp3.noffmpeg': 'MP3 conversion unavailable on this server.',
    'mp3.btn': 'Convert to MP3',
    'trim.btn': 'Trim Video', 'trim.title': 'Trim Video Duration', 'trim.start': 'Start (sec)',
    'trim.end': 'End (sec)', 'trim.go': 'Trim Now', 'trim.max': 'Max 10 min output duration.',
    'sub.auto': 'auto', 'sub.manual': 'official',
    'thumb.btn': 'Download Thumbnail',
    'qr.btn': 'QR', 'copy.btn': 'Copy', 'copied': 'Link copied to clipboard!',
    'play.btn': 'Play', 'stop.btn': 'Close',
    'job.title': 'Server Processing', 'job.cancel': 'Cancel', 'job.done': 'Complete — Download File',
    'job.failed': 'Failed', 'job.close': 'Close',
    'hist.title': 'Recent Downloads', 'hist.clear': 'Clear All',
    'pl.choose': 'Select an item to process:',
    'pl.items': 'items', 'pl.process': 'Select & Process',
    'guide.badge': 'QUICK GUIDE',
    'guide.title': 'HOW TO USE ULTRA DOWNLOADER',
    'guide.sub': '4 EASY STEPS — FAST, CLEAN & NO WATERMARK',
    'guide.s1t': 'COPY LINK', 'guide.s1d': 'Open TikTok, Instagram, YouTube, Facebook, or X and copy the post or video URL.',
    'guide.s2t': 'PASTE LINK', 'guide.s2d': 'Click "Paste" in the Target URL column or search YouTube directly by keywords.',
    'guide.s3t': 'HIT DOWNLOAD', 'guide.s3d': 'Our engine detects the platform automatically and loads previews plus all qualities.',
    'guide.s4t': 'SAVE FILE', 'guide.s4d': 'Pick HD Video, MP3 Audio, or Photo and save it directly to your phone or laptop.',
    'guide.more': 'Open Full Documentation & FAQ →',
    'foot.powered': 'POWERED BY', 'foot.tag': 'NEO-BRUTALISM UI • FAST • CLEAN • NO WATERMARK',
    'foot.tos': 'Terms of Service', 'foot.privacy': 'Privacy Policy', 'foot.dmca': 'DMCA',
    'e.empty': 'Please paste a media link into the TARGET URL field first.',
    'e.badurl': 'Invalid URL format. Make sure it starts with http:// or https://',
    'e.noresult': 'Media not found or the account is private.',
    'e.clip': 'Clipboard access blocked. Please paste manually (Ctrl+V / Long-press Paste).',
    'e.cookies': 'Tip: For restricted IG/FB posts, the admin can configure cookies.txt.',
    'e.cookies_yt': 'Tip: Add age-verified YouTube cookies via the Admin page.',
    'e.cookies_gen': 'Tip: This content requires authentication on the source site.',
    'search.noresult': 'No matching videos found.',
    'batch.count': 'links processed',
    'lightbox.dl': 'Download Image', 'lightbox.close': 'Close',
    'install.done': 'Ultra Downloader installed!',
    'install.manual': 'Open browser menu → "Add to Home Screen / Install App".',
    'theme': 'Theme',
    'd.brand': 'ULTRA GUIDE', 'd.back': 'BACK TO HOME', 'd.h1': 'USER GUIDE & DOCS',
    'd.sub': 'COMPLETE MANUAL FOR ULTRA DOWNLOADER',
    'd.s1': '01 // STEP-BY-STEP WORKFLOW',
    'd.st1t': 'COPY MEDIA LINK', 'd.st1d': 'Open TikTok, Instagram, YouTube, Facebook, or X/Twitter. Tap "Share" and copy the link.',
    'd.st2t': 'PASTE INTO COLUMN', 'd.st2d': 'Paste the link into the "TARGET URL" input field or tap the automatic "Paste" button.',
    'd.st3t': 'EXTRACT & PREVIEW', 'd.st3d': 'Press "Download Now". Preview the video/audio inline and browse all available formats.',
    'd.st4t': 'SAVE TO DEVICE', 'd.st4d': 'Choose your preferred resolution (HD No Watermark / MP4 / MP3) and download immediately.',
    'd.s2': '02 // SUPPORTED PLATFORMS & FORMATS', 'd.s2sub': 'POWERED BY HIGH-SPEED MULTI-PLATFORM EXTRACTION:',
    'd.s3': '03 // TROUBLESHOOTING & FAQ',
    'd.faq1q': 'WHY IS MEDIA NOT FOUND?', 'd.faq1a': 'Ensure the post is public (not from a private account) and the link is valid.',
    'd.faq2q': 'DOWNLOAD STOPPED MIDWAY?', 'd.faq2a': 'Usually caused by network drops or an expired CDN token. Simply re-run the link.',
    'd.faq3q': 'HOW TO DOWNLOAD TIKTOK WITHOUT WATERMARK?', 'd.faq3a': 'Click the "HD • No WM" button under Video Options for a clean, watermark-free MP4.',
    'd.faq4q': 'HOW TO CONVERT YOUTUBE TO MP3?', 'd.faq4a': 'Paste a YouTube link and select "MP3 • 128kbps" under Audio Options, or click "Convert to MP3".',
    'd.faq5q': 'DOES IT WORK ON MOBILE AND LAPTOP?', 'd.faq5a': 'Yes! Ultra Downloader is fully responsive across Android, iOS, tablets, and desktop browsers.',
    'd.s4': '04 // PRO FEATURES',
    'd.f1': 'Direct YouTube keyword search without leaving the page.',
    'd.f2': 'Batch Mode: extract up to 10 links simultaneously.',
    'd.f3': 'Built-in video & audio preview player with quality switcher.',
    'd.f4': 'Instant QR code generator per file to send downloads to your phone.',
    'd.f5': 'Installable PWA with native share-sheet integration.',
    'd.f6': 'Local download history saved privately in your browser.',
    'd.join': 'ULTRA DOWNLOADER OFFICIAL', 'd.joinsub': 'Follow our official channel for updates and support.', 'd.joinbtn': 'Join Official Channel',
    'l.back': 'Home', 'l.en_note': 'English summary below Indonesian version.',
    'a.title': 'ADMIN PANEL', 'a.key_ph': 'Enter admin key...', 'a.login': 'Open Stats', 'a.refresh': 'Refresh',
    'a.cookies': 'Check Cookies', 'a.up_t': 'Upload cookies.txt (VPS only)', 'a.up_btn': 'Upload Cookies', 'a.total': 'Total Requests', 'a.ok': 'Success', 'a.err': 'Failed',
    'a.uptime': 'Uptime (sec)', 'a.jobs': 'Server Jobs',
    'a.byplat': 'By Platform', 'a.byep': 'By Endpoint', 'a.recent': 'Recent Activity', 'a.errors': 'Latest Errors',
    'a.wrong': 'Invalid admin key.',
    's.title': 'Opening Ultra Downloader...', 's.none': 'No link found. Please share a valid video link.',
    'o.title': 'OFFLINE MODE', 'o.msg': 'No internet connection. Reconnect and try again.',
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

// Tema gelap (default) / terang — atribut eksplisit agar konsisten di semua halaman
function getTheme() {
  try { return localStorage.getItem('sann_theme') || 'dark'; } catch (e) { return 'dark'; }
}
function applyTheme() {
  var th = getTheme() === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = th;
  try {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = th === 'light' ? '#f4f1ea' : '#090a0f';
  } catch (e) {}
  var tb = document.getElementById('themeBtn');
  if (tb) tb.innerHTML = svgIcon(th === 'light' ? 'moon' : 'sun', 16);
}
function toggleTheme() {
  try { localStorage.setItem('sann_theme', getTheme() === 'light' ? 'dark' : 'light'); } catch (e) {}
  applyTheme();
}
applyTheme();
document.addEventListener('DOMContentLoaded', function () { applyI18n(); applyTheme(); });
