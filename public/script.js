// Frontend All-in-One Downloader — UI lengkap: resolusi, MP3, HD-merge, gambar, playlist, riwayat
const $ = (id) => document.getElementById(id);

// Deteksi kapabilitas server (Vercel = tanpa ffmpeg -> MP3/HD disembunyikan)
window.__HAS_FFMPEG = true;
fetch('/api/health').then((r) => r.json()).then((j) => {
  window.__HAS_FFMPEG = !!j.ffmpeg;
}).catch(() => {});

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function safeFilename(title, ext, suffix) {
    const base = String(title || 'media').normalize('NFC').replace(/[\\/:*?"<>|#%&{}$!'@+=`~]/g, '').replace(/\s+/g, '_').trim().slice(0, 50) || 'SANN404_DL';
    return `${base}${suffix ? '_' + suffix : ''}.${ext || 'mp4'}`;
}

function detectPlatform(url) {
    const u = String(url || '').toLowerCase();
    if (u.includes('tiktok.com') || u.includes('vt.tiktok')) return 'TIKTOK';
    if (u.includes('instagram.com')) return u.includes('/stories/') ? 'IG STORY' : (u.includes('/reel') ? 'IG REELS' : 'INSTAGRAM');
    if (u.includes('youtube.com') || u.includes('youtu.be')) return u.includes('/shorts') ? 'YT SHORTS' : 'YOUTUBE';
    if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com')) return u.includes('/reel') ? 'FB REELS' : 'FACEBOOK';
    if (u.includes('x.com') || u.includes('twitter.com')) return 'X / TWITTER';
    if (u.includes('soundcloud.com')) return 'SOUNDCLOUD';
    if (u.includes('threads.')) return 'THREADS';
    if (u.includes('pinterest.')) return 'PINTEREST';
    if (u.includes('reddit.com')) return 'REDDIT';
    if (u.includes('vimeo.com')) return 'VIMEO';
    if (u.includes('twitch.tv')) return 'TWITCH';
    if (/^https?:\/\//i.test(u)) return 'DIRECT LINK';
    return null;
}

/* ---------- Riwayat (localStorage) ---------- */
const HIST_KEY = 'sann_history_v1';
function getHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch { return []; }
}
function pushHistory(item) {
    try {
        let h = getHistory().filter((x) => x.u !== item.u);
        h.unshift(item);
        h = h.slice(0, 12);
        localStorage.setItem(HIST_KEY, JSON.stringify(h));
        renderHistory();
    } catch {}
}
function renderHistory() {
    const box = $('history');
    if (!box) return;
    const h = getHistory();
    if (!h.length) { box.innerHTML = ''; box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.innerHTML = `<div class="hist-title">🕘 RIWAYAT TERAKHIR</div>` + h.map((x, i) =>
        `<button class="hist-item" onclick="refetch(${i})" title="${esc(x.u)}">
            <span class="hist-plat">${esc(x.p)}</span>
            <span class="hist-name">${esc(x.t)}</span>
        </button>`
    ).join('') + `<button class="hist-clear" onclick="clearHistory()">HAPUS RIWAYAT</button>`;
}
function refetch(i) {
    const h = getHistory()[i];
    if (!h) return;
    $('urlInput').value = h.u;
    updatePlatBadge();
    fetchMedia();
}
function clearHistory() {
    try { localStorage.removeItem(HIST_KEY); } catch {}
    renderHistory();
}

/* ---------- Badge platform otomatis ---------- */
function updatePlatBadge() {
    const badge = $('platBadge');
    if (!badge) return;
    const p = detectPlatform($('urlInput').value.trim());
    if (!p) { badge.classList.add('hidden'); return; }
    badge.classList.remove('hidden');
    badge.textContent = '◉ ' + p;
}

/* ---------- Fetch utama ---------- */
async function fetchMedia(urlOverride) {
    const input = $('urlInput');
    const btn = $('downloadBtn');
    const loading = $('loading');
    const resultDiv = $('result');
    const errorCard = $('error-msg');
    const errorText = $('error-text');
    const url = (urlOverride || input.value).trim();

    if (!url) {
        errorText.textContent = 'Tempel dulu link videonya ke kolom TARGET URL.';
        errorCard.classList.remove('hidden');
        return;
    }
    if (!/^https?:\/\/.+\..+/i.test(url)) {
        errorText.textContent = 'Format URL tidak valid. Contoh: https://www.tiktok.com/...';
        errorCard.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'MEMPROSES...';
    loading.classList.remove('hidden');
    resultDiv.innerHTML = '';
    errorCard.classList.add('hidden');

    try {
        const response = await fetch('/api/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Media tidak ditemukan / Link Invalid.');

        if (json.is_playlist) renderPlaylist(json);
        else renderDownloads(json.downloads || { video: json.data || [], audio: [], image: [] }, json.info || {}, json.original_url || url, json);

        pushHistory({
            t: String((json.info && json.info.title) || (json.playlist && json.playlist.title) || url).slice(0, 60),
            u: json.original_url || url,
            p: (json.info && json.info.platform) || detectPlatform(url) || '?',
            time: Date.now()
        });
    } catch (err) {
        errorText.textContent = err.message;
        errorCard.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'INITIATE DOWNLOAD';
        loading.classList.add('hidden');
    }
}

/* ---------- Render hasil download ---------- */
function dlLink(mediaUrl, filename, label, extraClass) {
    return `<a class="dl-btn ${extraClass || ''}" href="/api/download?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}">${esc(label)}</a>`;
}

function renderDownloads(dl, info, originalUrl, full) {
    const resultDiv = $('result');
    const videos = dl.video || [], audios = dl.audio || [], images = dl.image || [];
    const title = info.title || 'media';

    // Kartu INFO
    const infoCard = document.createElement('div');
    infoCard.className = 'cyber-card result-card';
    const totalFiles = videos.length + audios.length + images.length;
    infoCard.innerHTML = `
        <div class="result-header">
            <span>${esc((info.platform || 'MEDIA').toUpperCase())}${full.is_album ? ' // ALBUM' : ''}</span>
            <span class="result-badge">SUCCESS</span>
        </div>
        <div class="result-body" style="display:flex; gap:12px; align-items:center;">
            ${info.thumbnail ? `<img src="${esc(info.thumbnail)}" alt="thumb" style="width:110px; height:110px; object-fit:cover; margin:0;">` : ''}
            <div style="font-family:'JetBrains Mono'; font-size:0.78rem; line-height:1.6; word-break:break-word;">
                <div style="font-weight:800; font-size:0.85rem;">${esc(title)}</div>
                ${info.uploader ? `<div>&gt; OLEH: ${esc(info.uploader)}</div>` : ''}
                ${info.duration_label && info.duration_label !== '-' ? `<div>&gt; DURASI: ${esc(info.duration_label)}</div>` : ''}
                <div>&gt; FILE: ${videos.length} VIDEO • ${audios.length} AUDIO • ${images.length} GAMBAR</div>
            </div>
        </div>`;
    resultDiv.appendChild(infoCard);

    // Preview player (video terbaik)
    if (videos.length) {
        const best = videos[0];
        const pv = document.createElement('div');
        pv.className = 'cyber-card result-card';
        pv.innerHTML = `
            <div class="result-header"><span>PREVIEW // ${esc(best.quality)}</span><span class="result-badge">${esc(best.filesize_label || '')}</span></div>
            <div class="result-body">
                <div style="background:#000; padding:5px; border:2px solid #000;">
                    <video controls preload="metadata" poster="${esc(best.thumbnail || info.thumbnail || '')}" playsinline style="border:none; margin:0; max-height:420px;">
                        <source src="${esc(best.url)}" type="video/mp4">
                    </video>
                </div>
            </div>`;
        resultDiv.appendChild(pv);
    } else if (audios.length) {
        const best = audios[0];
        const pv = document.createElement('div');
        pv.className = 'cyber-card result-card';
        pv.innerHTML = `
            <div class="result-header"><span>PREVIEW // AUDIO</span><span class="result-badge">${esc(best.filesize_label || '')}</span></div>
            <div class="result-body"><audio controls preload="metadata" style="width:100%;"><source src="${esc(best.url)}"></audio></div>`;
        resultDiv.appendChild(pv);
    }

    // Seksi VIDEO (pilihan resolusi)
    if (videos.length) {
        const sec = document.createElement('div');
        sec.className = 'cyber-card result-card';
        sec.innerHTML = `<div class="result-header"><span>🎬 VIDEO MP4 // PILIH RESOLUSI</span><span class="result-badge">${videos.length} PILIHAN</span></div>
        <div class="result-body">` + videos.map((m, i) => `
            <div class="opt-row">
                <div class="opt-info">
                    <span class="q-badge">${esc(m.quality)}</span>
                    <span class="opt-meta">${esc(m.extension.toUpperCase())} • ${esc(m.filesize_label || 'Unknown')}${m.has_audio === false ? ' • ⚠ TANPA SUARA' : ''}</span>
                </div>
                ${dlLink(m.url, safeFilename(title, m.extension, m.quality.replace(/[^a-z0-9]+/gi, '')), i === 0 ? '⬇ DOWNLOAD TERBAIK' : '⬇ DOWNLOAD', i === 0 ? 'best' : '')}
            </div>`).join('') + `</div>`;
        resultDiv.appendChild(sec);
    }

    // Seksi HD MERGE (gabung gambar+suara kualitas tinggi)
    if (info.merge_heights && info.merge_heights.length) {
        const sec = document.createElement('div');
        sec.className = 'cyber-card result-card merge-card';
        const canConvert = window.__HAS_FFMPEG !== false;
        const hdBody = canConvert
            ? `<div class="merge-note">⚙ Diproses di server (butuh ±1–3 menit, jangan tutup tab). Hasil: MP4 HD bersuara.</div>
                ${info.merge_heights.map((h) => `
                    <a class="dl-btn merge" href="/api/merge?url=${encodeURIComponent(originalUrl)}&height=${h}&filename=${encodeURIComponent(safeFilename(title, '', '') + '_' + h + 'p')}">⬇ ${h}P FULL HD + SUARA</a>
                `).join('')}`
            : `<div class="merge-note">⚠ HD FULL tidak tersedia di server ini (butuh ffmpeg). Deploy ke VPS/server penuh untuk mengaktifkan. Pilihan download langsung di atas tetap bisa dipakai.</div>`;
        sec.innerHTML = `
            <div class="result-header"><span>🔥 HD FULL (GAMBAR + SUARA DIGABUNG)</span><span class="result-badge">SERVER</span></div>
            <div class="result-body">${hdBody}</div>`;
        resultDiv.appendChild(sec);
    }

    // Seksi AUDIO + MP3
    {
        const sec = document.createElement('div');
        sec.className = 'cyber-card result-card';
        let rows = audios.map((m, i) => `
            <div class="opt-row">
                <div class="opt-info">
                    <span class="q-badge audio">${esc(m.quality)}</span>
                    <span class="opt-meta">${esc(m.extension.toUpperCase())} • ${esc(m.filesize_label || 'Unknown')} • langsung</span>
                </div>
                ${dlLink(m.url, safeFilename(title, m.extension, 'audio' + i), '⬇ DOWNLOAD')}
            </div>`).join('');
        sec.innerHTML = `
            <div class="result-header"><span>🎵 AUDIO / MP3</span><span class="result-badge">MUSIK</span></div>
            <div class="result-body">
                ${rows}
                ${window.__HAS_FFMPEG !== false
                    ? `<div class="merge-note">💡 Butuh MP3 murni? Konversi otomatis 192kbps (semua platform):</div>
                <a class="dl-btn mp3" href="/api/mp3?url=${encodeURIComponent(originalUrl)}&filename=${encodeURIComponent(safeFilename(title, '', ''))}">🎵 DOWNLOAD MP3 192KBPS</a>`
                    : `<div class="merge-note">⚠ Konversi MP3 tidak tersedia di server ini (butuh ffmpeg). Pakai file audio langsung di atas, atau deploy ke VPS/server penuh.</div>`}
            </div>`;
        resultDiv.appendChild(sec);
    }

    // Seksi GAMBAR
    if (images.length) {
        const sec = document.createElement('div');
        sec.className = 'cyber-card result-card';
        sec.innerHTML = `
            <div class="result-header"><span>🖼️ GAMBAR // NO WATERMARK</span><span class="result-badge">${images.length} FILE</span></div>
            <div class="result-body">
                <div class="img-grid">` + images.map((m, i) => `
                    <div class="img-cell">
                        <img src="${esc(m.thumbnail || m.url)}" alt="img${i}" loading="lazy">
                        <div class="img-meta">${esc(m.quality || 'Foto')} • ${esc(m.extension.toUpperCase())}</div>
                        ${dlLink(m.url, safeFilename(title, m.extension, 'img' + (i + 1)), '⬇ SAVE')}
                    </div>`).join('') + `
                </div>
            </div>`;
        resultDiv.appendChild(sec);
    }

    if (!totalFiles) {
        const d = document.createElement('div');
        d.className = 'cyber-card result-card';
        d.innerHTML = `<div class="result-body" style="font-family:monospace;">Tidak ada file yang bisa diunduh dari link ini.</div>`;
        resultDiv.appendChild(d);
    }
}

/* ---------- Render playlist ---------- */
function renderPlaylist(json) {
    const resultDiv = $('result');
    const pl = json.playlist || {};
    const card = document.createElement('div');
    card.className = 'cyber-card result-card';
    card.innerHTML = `
        <div class="result-header"><span>📋 PLAYLIST TERDETEKSI</span><span class="result-badge">${pl.shown || (json.items || []).length} ITEM</span></div>
        <div class="result-body">
            <div style="font-family:'JetBrains Mono'; font-weight:800; margin-bottom:4px;">${esc(pl.title || 'Playlist')}</div>
            <div style="font-family:'JetBrains Mono'; font-size:0.78rem; margin-bottom:12px;">Total ±${esc(String(pl.total || '?'))} video • Klik PROSES pada item yang mau didownload:</div>
            <div class="pl-list">` + (json.items || []).map((it, i) => `
                <div class="opt-row">
                    ${it.thumbnail ? `<img src="${esc(it.thumbnail)}" class="pl-thumb" loading="lazy" alt="">` : ''}
                    <div class="opt-info" style="flex:1;">
                        <div class="pl-title">${i + 1}. ${esc(it.title)}</div>
                        <span class="opt-meta">${it.duration_label && it.duration_label !== '-' ? '⏱ ' + esc(it.duration_label) : ''}</span>
                    </div>
                    <button class="dl-btn" onclick="fetchMedia(decodeURIComponent('${encodeURIComponent(it.url)}'))">⚙ PROSES</button>
                </div>`).join('') + `
            </div>
        </div>`;
    resultDiv.appendChild(card);
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
    const input = $('urlInput');
    if (input) {
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchMedia(); });
        input.addEventListener('input', updatePlatBadge);
        input.addEventListener('paste', () => setTimeout(updatePlatBadge, 50));
    }
    renderHistory();
});
