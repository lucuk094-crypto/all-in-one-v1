# all-in-one-downloader (yt-dlp edition — LENGKAP)

Website downloader all-in-one: TikTok, Instagram (Reels/Story/Foto/Carousel), YouTube
(Video/Shorts/Playlist/Mix), Facebook (Video/Reels), X/Twitter, SoundCloud, Threads,
Pinterest, dan 1000+ situs lain — bertenaga **yt-dlp + ffmpeg**. Oleh SANN404 FORUM.

## Fitur

- 🎬 **Video MP4 multi-resolusi** (tiap platform, otomatis: 1080p/720p/576p/...)
- 🚫 **No Watermark** (TikTok + semua foto)
- 🎵 **MP3 192kbps** sekali klik (semua platform) — `/api/mp3`
- 🔥 **HD 720p/1080p + suara** (gabung otomatis di server, H.264+AAC) — `/api/merge`
- 🖼️ **Gambar/foto** (postingan foto, carousel, TikTok photo-mode)
- 📋 **Playlist & album**: playlist besar → daftar item + tombol proses per item;
  album kecil (≤12) → langsung diekstrak semua
- 🕘 **Riwayat** 12 terakhir (localStorage) + badge platform otomatis
- 🛡️ Validasi URL, anti-SSRF, rate limit 30/menit, cache 10 menit,
  maks 2 konversi bersamaan, pesan error Bahasa Indonesia

## Arsitektur

```
Browser ──POST /api/index {url}──> server.js ──> api/index.js ──> yt-dlp -J
                                                              └─> tikwm (fallback TikTok)
Browser <── JSON {info, downloads{video,audio,image}, items?} ─┘
Browser ──GET /api/download?url=..──> proxy streaming (bebas CORS)
Browser ──GET /api/mp3?url=.. ──> yt-dlp extract MP3 ──> file .mp3
Browser ──GET /api/merge?url=..&height=720 ──> yt-dlp merge ──> file .mp4 HD
```

## Prasyarat

- Node.js 18+
- `yt-dlp` (di PATH atau `/home/user/bin/yt-dlp`, atau env `YTDLP_BIN`)
- `ffmpeg` + `ffprobe` (untuk MP3 & HD-merge; atau env `FFMPEG_BIN`)
- `deno` (opsional, disarankan — format YouTube lengkap)
- `cookies.txt` (opsional, format Netscape di folder project / env `COOKIES_FILE` —
  sangat membantu IG/FB. Export via ekstensi "Get cookies.txt LOCALLY" saat login.)

## Cara jalan lokal

```bash
npm install
node server.js
# buka http://localhost:3000
```

## API

### POST /api/index — ekstrak media (atau GET ?url=...)
Respon: `{ success, source, cached, is_playlist?, is_album?, playlist?, items?,
downloads: { video[], audio[], image[] }, data[] (kompatibel lama), info, original_url }`

Tiap item download: `{ type, url, quality, extension, filesize, filesize_label,
thumbnail, has_audio }`. Info: `{ title, thumbnail, duration(_label), uploader,
platform, webpage_url, has_split, merge_heights[] }`.

### GET /api/download?url=...&filename=... — proxy download langsung
### GET /api/mp3?url=...&filename=... — konversi MP3 192kbps
### GET /api/merge?url=...&height=720|1080&filename=... — HD + suara (H264/AAC)
### GET /api/health — status yt-dlp/ffmpeg/cookies/antrean

## Deploy ke Vercel (gratis, 1 klik)

1. Push repo ini ke GitHub, lalu di Vercel: **Add New Project → Import** repo tersebut.
2. Biarkan semua setting default (`buildCommand` otomatis download binary yt-dlp).
3. Deploy. Timeout function sudah diset 60 detik (maksimal paket Hobby).

Yang jalan di Vercel: ekstrak semua platform, download langsung multi-resolusi,
audio langsung, gambar, playlist/album, proxy anti-CORS.
Yang TIDAK jalan di Vercel: tombol **MP3** & **HD-merge** (butuh ffmpeg — bundle
ffmpeg ±80MB tidak muat di limit function Vercel). Tombolnya otomatis disembunyikan
dan diganti catatan. Butuh MP3/HD? Deploy ke VPS (di bawah).

## Deploy produksi full (VPS / Render / Railway / Fly.io)

Butuh server yang bisa menjalankan binary + ffmpeg:

```bash
npm install
# install yt-dlp, ffmpeg, (deno) lalu:
node server.js
```

Semua fitur aktif termasuk MP3 & HD-merge.
