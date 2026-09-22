#!/usr/bin/env bash
# Unduh binari yt-dlp + ffmpeg statis ke ~/bin (atau $BINDIR).
# Dipakai untuk setup awal VPS dan pemulihan sandbox.
set -euo pipefail
BINDIR="${BINDIR:-$HOME/bin}"
mkdir -p "$BINDIR"
echo "-> yt-dlp ..."
curl -sL -o "$BINDIR/yt-dlp" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x "$BINDIR/yt-dlp"
echo "-> ffmpeg (johnvansickle static) ..."
cd /tmp
rm -rf ffmpeg.tar.xz ffmpeg-*-amd64-static
curl -sL -o ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar -xJf ffmpeg.tar.xz --wildcards '*/ffmpeg'
mv ffmpeg-*-amd64-static/ffmpeg "$BINDIR/ffmpeg"
chmod +x "$BINDIR/ffmpeg"
rm -rf ffmpeg.tar.xz ffmpeg-*-amd64-static
echo "-> verifikasi:"
"$BINDIR/yt-dlp" --version
"$BINDIR/ffmpeg" -version 2>/dev/null | head -1
