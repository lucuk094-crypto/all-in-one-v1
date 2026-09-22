/* MediaDownloader Ultra — frontend v5
   Target: index.html (urlInput/downloadBtn/result/...), i18n.js (kunci form.* sec.* opt.* ...),
   backend: POST /api/index, GET /api/search, POST /api/job, GET /api/job/:id, GET /api/file/:id */
'use strict';

var SERVER = { trim: true, mp3: true, merge: true, search: true, batch: true, maxBatch: 10, turnstileSite: null, umamiUrl: null, umamiId: null };
var CAPTCHA_TOKEN = '';
var GALLERY = [];
var LB_INDEX = 0;
var ACTIVE_JOBS = {};
var BATCH_MODE = false;

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function isEN() { try { return getLang() === 'en'; } catch (e) { return false; } }
function toast(msg) {
    var box = $('toast'); if (!box) return;
    box.textContent = msg; box.classList.remove('hidden');
    clearTimeout(box._t); box._t = setTimeout(function () { box.classList.add('hidden'); }, 3500);
}
function logClient(msg, url) {
    try {
        fetch('/api/client-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg: String(msg).slice(0, 300), url: String(url || location.href).slice(0, 200) }) }).catch(function () { });
    } catch (e) { /* abaikan */ }
}
function apiLink(path, params) {
    var q = Object.keys(params || {}).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return path + (q ? '?' + q : '');
}
function guardedParams(extra) {
    var p = Object.assign({}, extra || {});
    if (SERVER.turnstileSite && CAPTCHA_TOKEN) p.token = CAPTCHA_TOKEN;
    return p;
}
function guardedBody(extra) {
    var p = Object.assign({}, extra || {});
    if (SERVER.turnstileSite && CAPTCHA_TOKEN) p['cf-turnstile-response'] = CAPTCHA_TOKEN;
    return p;
}
function needCaptcha() {
    if (SERVER.turnstileSite && !CAPTCHA_TOKEN) {
        toast(isEN() ? 'Please complete the CAPTCHA first.' : 'Selesaikan CAPTCHA dulu.');
        return true;
    }
    return false;
}

/* ---------- boot: config, captcha, umami, cookies, pwa, ?u= ---------- */
async function initServer() {
    try {
        var r = await fetch('/api/config', { cache: 'no-store' });
        var cfg = await r.json();
        Object.keys(cfg || {}).forEach(function (k) { SERVER[k] = cfg[k]; });
    } catch (e) { /* default */ }
    setupTurnstile();
    setupUmami();
    checkCookies();
    var u = null;
    try { u = new URLSearchParams(location.search).get('u'); } catch (e) { }
    if (u) {
        var inp = $('urlInput');
        if (inp) { inp.value = u; fetchMedia(); }
    }
}
function setupTurnstile() {
    if (!SERVER.turnstileSite || !$('downloadBtn')) return;
    var box = document.createElement('div');
    box.id = 'turnstileBox';
    box.style.margin = '12px 0';
    $('downloadBtn').parentNode.insertBefore(box, $('downloadBtn'));
    var render = function () {
        try {
            window.turnstile.render('#turnstileBox', {
                sitekey: SERVER.turnstileSite,
                callback: function (tok) { CAPTCHA_TOKEN = tok; },
                'expired-callback': function () { CAPTCHA_TOKEN = ''; },
                'error-callback': function () { CAPTCHA_TOKEN = ''; }
            });
            return true;
        } catch (e) { return false; }
    };
    if (window.turnstile) { if (!render()) setTimeout(setupTurnstileRetry, 1000); }
    else {
        var s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        s.async = true; s.defer = true;
        s.onload = function () { if (!render()) setTimeout(setupTurnstileRetry, 1000); };
        document.head.appendChild(s);
    }
}
function setupTurnstileRetry() {
    try {
        if (window.turnstile && $('turnstileBox') && !$('turnstileBox').firstChild) {
            window.turnstile.render('#turnstileBox', { sitekey: SERVER.turnstileSite, callback: function (tok) { CAPTCHA_TOKEN = tok; } });
        }
    } catch (e) { }
}
function setupUmami() {
    var E = window.__ENV || {};
    var url = E.umamiUrl || SERVER.umamiUrl, id = E.umamiId || SERVER.umamiId;
    if (!url || !id || document.querySelector('script[data-website-id]')) return;
    var s = document.createElement('script');
    s.async = true; s.defer = true;
    s.setAttribute('data-website-id', id);
    s.src = String(url).replace(/\/$/, '') + '/script.js';
    document.head.appendChild(s);
}
async function checkCookies() {
    try {
        var r = await fetch('/api/cookies-health');
        var j = await r.json();
        if (j && j.success && !j.ok && document.querySelector('.container')) {
            var d = document.createElement('div');
            d.className = 'cookie-warn';
            d.textContent = t('e.cookies') + ' ';
            var b = document.createElement('button');
            b.className = 'mini-btn plain'; b.textContent = '✕';
            b.onclick = function () { d.remove(); };
            d.appendChild(b);
            var c = document.querySelector('.container');
            c.insertBefore(d, c.firstChild);
        }
    } catch (e) { /* offline */ }
}

/* ---------- riwayat ---------- */
function getHistory() { try { return JSON.parse(localStorage.getItem('dlHistory') || '[]'); } catch (e) { return []; } }
function saveHistory(item) {
    try {
        var h = getHistory().filter(function (x) { return x.url !== item.url; });
        h.unshift(item); localStorage.setItem('dlHistory', JSON.stringify(h.slice(0, 10)));
    } catch (e) { }
}
function renderHistory() {
    var box = $('history'); if (!box) return;
    var h = getHistory();
    if (!h.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    var html = '<div class="sec-label">' + esc(t('hist.title')) + ' <a href="#" id="histClear" style="color:var(--accent-tertiary);">[' + esc(t('hist.clear')) + ']</a></div>';
    h.forEach(function (x, i) {
        html += '<div class="hist-row" data-hi="' + i + '"><span class="opt-meta" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(x.title || x.url) + '</span><span class="q-badge">' + esc(x.badge || '') + '</span></div>';
    });
    box.innerHTML = html;
    var c = $('histClear');
    if (c) c.onclick = function (e) { e.preventDefault(); try { localStorage.removeItem('dlHistory'); } catch (err) { } renderHistory(); };
    Array.prototype.forEach.call(box.querySelectorAll('.hist-row'), function (row) {
        row.onclick = function () {
            var x = getHistory()[+row.getAttribute('data-h')];
            if (x && $('urlInput')) { $('urlInput').value = x.url; fetchMedia(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        };
    });
}

/* ---------- clipboard & toast copy ---------- */
async function pasteClipboard() {
    var inp = $('urlInput'); if (!inp) return;
    try {
        var txt = await navigator.clipboard.readText();
        var m = String(txt || '').match(/https?:\/\/[^\s"'<>]+/);
        if (m) { inp.value = m[0]; detectPlatform(); toast(t('copied')); }
        else toast(t('e.clip'));
    } catch (e) { toast(t('e.clip')); inp.focus(); }
}
function copyText(txt) {
    var done = function () { toast(t('copied')); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); });
    else { fallbackCopy(txt); done(); }
}
function fallbackCopy(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { }
    document.body.removeChild(ta);
}
function detectPlatform() {
    var badge = $('platBadge'); if (!badge || !$('urlInput')) return;
    var u = $('urlInput').value.toLowerCase();
    var p = u.indexOf('tiktok') >= 0 ? 'TIKTOK' : u.indexOf('instagram') >= 0 ? 'INSTAGRAM' : u.indexOf('youtu') >= 0 ? 'YOUTUBE' : u.indexOf('facebook') >= 0 || u.indexOf('fb.') >= 0 ? 'FACEBOOK' : u.indexOf('twitter') >= 0 || u.indexOf('x.com') >= 0 ? 'X/TWITTER' : '';
    badge.textContent = p;
    badge.classList.toggle('hidden', !p);
}

/* ---------- fetch utama ---------- */
function setLoading(on) {
    var l = $('loading'); if (l) l.classList.toggle('hidden', !on);
    var b = $('downloadBtn'); if (b) b.disabled = !!on;
}
function showError(msg, hintKey) {
    var box = $('error-msg'); if (!box) { toast(msg); return; }
    box.classList.remove('hidden');
    $('error-text').textContent = msg;
    var h = $('error-hint');
    if (h) {
        if (hintKey) { h.textContent = t(hintKey); h.classList.remove('hidden'); }
        else h.classList.add('hidden');
    }
    setLoading(false);
}
function hideError() {
    var box = $('error-msg'); if (box) box.classList.add('hidden');
}
async function doAnalyze(url) {
    var r = await fetch('/api/index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(guardedBody({ url: url })) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || !j.success) {
        var err = new Error(j.error || ('HTTP ' + r.status));
        err.hint = j.hint || null; err.status = r.status;
        throw err;
    }
    return j;
}
function validUrl(u) { return /^https?:\/\/[^\s"'<>]+$/i.test(u); }

async function fetchMedia() {
    var inp = $('urlInput'); if (!inp) return;
    var url = inp.value.trim();
    if (!url) { toast(t('e.empty')); return; }
    if (!validUrl(url)) { showError(t('e.badurl')); return; }
    if (needCaptcha()) return;
    hideError();
    var res = $('result'); if (res) res.innerHTML = '';
    setLoading(true);
    try {
        var j = await doAnalyze(url);
        setLoading(false);
        renderJson(j, url);
        saveHistory({ url: url, title: (j.info && j.info.title) || url, badge: (j.info && j.info.platform) || '' });
        renderHistory();
    } catch (e) {
        logClient('analyze: ' + (e.message || e), url);
        var cookieish = e.hint === 'cookies' || /cookie|login|masuk/i.test(e.message || '');
        showError(e.message || 'Error', cookieish ? 'e.cookies' : null);
    }
}
function toggleBatch() {
    BATCH_MODE = !BATCH_MODE;
    var b = $('batchBox'); if (b) b.classList.toggle('hidden', !BATCH_MODE);
}
async function fetchBatch() {
    var ta = $('batchInput'); if (!ta) return;
    var urls = ta.value.split('\n').map(function (s) { return s.trim(); }).filter(validUrl);
    urls = urls.slice(0, SERVER.maxBatch || 10);
    if (!urls.length) { toast(t('e.empty')); return; }
    if (needCaptcha()) return;
    hideError();
    var res = $('result'); if (res) res.innerHTML = '';
    setLoading(true);
    var okCount = 0;
    for (var i = 0; i < urls.length; i++) {
        try {
            var j = await doAnalyze(urls[i]);
            renderJson(j, urls[i], true);
            okCount++;
            saveHistory({ url: urls[i], title: (j.info && j.info.title) || urls[i], badge: (j.info && j.info.platform) || '' });
        } catch (e) {
            logClient('batch: ' + (e.message || e), urls[i]);
            if (res) {
                var d = document.createElement('div');
                d.className = 'cyber-card error-state';
                d.innerHTML = '<div class="error-body">❌ ' + esc(urls[i]) + '<br>' + esc(e.message || 'Error') + '</div>';
                res.appendChild(d);
            }
        }
    }
    setLoading(false);
    renderHistory();
    toast(t('batch.count').replace('{n}', okCount + '/' + urls.length));
}

/* ---------- render hasil ---------- */
function proxied(item, title, kind) {
    var ext = item.extension || (kind === 'audio' ? 'mp3' : kind === 'image' ? 'jpg' : 'mp4');
    return apiLink('/api/download', { url: item.url, filename: title, ext: ext });
}
function qrToggle(btn, url) {
    var cell = btn.parentElement.parentElement.querySelector('.qr-cell');
    if (!cell) return;
    if (!cell.classList.contains('hidden')) { cell.classList.add('hidden'); cell.innerHTML = ''; return; }
    cell.classList.remove('hidden');
    try {
        var qr = qrcode(0, 'M');
        qr.addData(url); qr.make();
        cell.innerHTML = qr.createImgTag(4, 8);
    } catch (e) { cell.textContent = 'QR error'; }
}
function renderJson(j, srcUrl, append) {
    var res = $('result'); if (!res) return;
    if (!append) res.innerHTML = '';
    var card = document.createElement('div');
    card.className = 'cyber-card result-card';
    var info = j.info || {};
    var title = info.title || 'Media';
    var badge = info.platform || j.source || '';
    var n = res.children.length;

    if (j.is_playlist || j.is_album) {
        var pl = j.playlist || {};
        var items = j.items || [];
        var html = '<div class="result-header"><span>' + esc(t('sec.playlist')) + '</span><span class="result-badge">' + (pl.shown || items.length) + '/' + (pl.total || items.length) + ' ' + esc(t('pl.items')) + '</span></div>' +
            '<div class="result-body"><div class="opt-meta" style="margin-bottom:8px;">' + esc(String(pl.title || title).slice(0, 80)) + '</div>' +
            '<div class="sec-label">' + esc(t('pl.choose')) + '</div><div class="pl-list"></div></div>';
        card.innerHTML = html;
        res.appendChild(card);
        var box = card.querySelector('.pl-list');
        items.forEach(function (it) {
            var row = document.createElement('div');
            row.className = 'opt-row';
            row.innerHTML = '<span class="opt-meta">' + esc(String(it.title || '').slice(0, 70)) + (it.duration_label ? ' • ' + esc(it.duration_label) : '') + '</span>';
            var b = document.createElement('button');
            b.className = 'mini-btn'; b.textContent = '▶ ' + t('pl.process');
            b.onclick = function () { if ($('urlInput')) $('urlInput').value = it.url; fetchMedia(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
            row.appendChild(b);
            box.appendChild(row);
        });
        return;
    }

    var dl = j.downloads || {};
    var videos = dl.video || [], audios = dl.audio || [], images = dl.image || [], subs = dl.subtitles || [];
    var h = '<div class="result-header"><span>' + esc(String(title).slice(0, 60)) + '</span><span class="result-badge">' + esc(badge) + '</span></div><div class="result-body">';
    if (info.thumbnail) h += '<div class="sec-label">' + esc(t('sec.preview')) + '</div><img src="' + esc(info.thumbnail) + '" class="result-thumb" alt="preview" data-thumb>';
    h += '<div class="result-meta-line">' +
        (info.uploader ? '<span class="meta-chip">👤 ' + esc(String(info.uploader).slice(0, 30)) + '</span>' : '') +
        (info.duration_label ? '<span class="meta-chip">⏱ ' + esc(info.duration_label) + '</span>' : '') +
        (j.cached ? '<span class="meta-chip">⚡ cache</span>' : '') + '</div>';

    if (videos.length) {
        h += '<div class="sec-label">' + esc(t('sec.video')) + '</div>';
        videos.forEach(function (v, i) {
            var tag = v.has_audio === false ? ' • ' + esc(t('opt.noaudio')) : '';
            h += '<div class="opt-row" data-vr="' + i + '"><span class="opt-meta">📹 ' + esc(v.quality || '') + ' • ' + esc(v.extension || 'mp4') + (v.filesize_label ? ' • ' + esc(v.filesize_label) : '') + tag + '</span>' +
                '<span style="display:flex;gap:6px;flex-wrap:wrap;"><button class="mini-btn plain" data-act="play">' + esc(t('play.btn')) + '</button>' +
                '<a class="dl-btn' + (i === 0 ? ' best' : '') + '" href="' + esc(proxied(v, title, 'video')) + '" download>' + esc(i === 0 ? t('opt.best') : t('opt.dl')) + '</a>' +
                '<button class="mini-btn plain" data-act="copy">' + esc(t('copy.btn')) + '</button>' +
                '<button class="mini-btn plain" data-act="qr">' + esc(t('qr.btn')) + '</button></span>' +
                '<div class="qr-cell hidden" style="flex-basis:100%;"></div><div class="play-cell" style="flex-basis:100%;"></div></div>';
        });
    }
    if (audios.length) {
        h += '<div class="sec-label">' + esc(t('sec.audio')) + '</div>';
        h += '<div class="audio-card"><div class="ac-title">▶ ' + esc(String(title).slice(0, 70)) + '</div><audio controls preload="none" src="' + esc(audios[0].url) + '"></audio></div>';
        audios.forEach(function (a) {
            h += '<div class="opt-row"><span class="opt-meta">🎵 ' + esc(a.quality || '') + ' • ' + esc(a.extension || 'mp3') + (a.filesize_label ? ' • ' + esc(a.filesize_label) : '') + '</span>' +
                '<span style="display:flex;gap:6px;"><a class="dl-btn" href="' + esc(proxied(a, title, 'audio')) + '" download>' + esc(t('opt.dl')) + '</a>' +
                '<button class="mini-btn plain" data-au="' + esc(a.url) + '">' + esc(t('copy.btn')) + '</button></span></div>';
        });
    }
    if (images.length) {
        h += '<div class="sec-label">' + esc(t('sec.img')) + '</div><div class="img-gallery">';
        images.forEach(function (im, i) {
            h += '<img loading="lazy" src="' + esc(im.thumbnail || im.url) + '" alt="img" data-gi="' + i + '" onerror="this.style.display=\'none\'">';
        });
        h += '</div>';
        images.forEach(function (im, i) {
            h += '<div class="opt-row"><span class="opt-meta">🖼️ ' + esc(im.quality || ('Foto ' + (i + 1))) + '</span>' +
                '<a class="dl-btn" href="' + esc(proxied(im, title + '_' + (i + 1), 'image')) + '" download>' + esc(t('opt.save')) + '</a></div>';
        });
    }
    if (subs.length) {
        h += '<div class="sec-label">' + esc(t('sec.sub')) + '</div><div class="sub-grid">';
        subs.forEach(function (s) {
            var lbl = (s.lang || '?').toUpperCase() + ' • ' + (s.ext || 'vtt') + ' • ' + (s.auto ? t('sub.auto') : t('sub.manual'));
            h += '<a class="sub-chip" href="' + esc(s.url) + '" download target="_blank" rel="noopener">💬 ' + esc(lbl) + '</a>';
        });
        h += '</div>';
    }

    var canConvert = videos.length || audios.length;
    if (canConvert) {
        if (SERVER.mp3) {
            h += '<div class="sec-label">🎧 MP3</div><div class="convert-row"><button class="mini-btn" data-job="mp3">' + esc(t('mp3.btn')) + '</button></div><div class="hint-text">' + esc(t('mp3.note')) + '</div>';
        } else if (SERVER.runtime === 'vercel') h += '<div class="hint-text">' + esc(t('mp3.noffmpeg')) + '</div>';
        if (SERVER.merge && videos.length) {
            var heights = info.merge_heights && info.merge_heights.length ? info.merge_heights : [720];
            h += '<div class="sec-label">' + esc(t('sec.hd')) + '</div><div class="convert-row">';
            heights.forEach(function (hh) { h += '<button class="mini-btn alt" data-job="merge" data-h="' + hh + '">🎬 HD ' + hh + 'p</button>'; });
            h += '</div><div class="hint-text">' + esc(t('hd.note')) + '</div>';
        } else if (SERVER.runtime === 'vercel' && videos.length) h += '<div class="hint-text">' + esc(t('hd.noffmpeg')) + '</div>';
        if (SERVER.trim && videos.length) {
            h += '<div class="sec-label">✂️ ' + esc(t('trim.title')) + '</div><div class="convert-row"><button class="mini-btn plain" data-job="trim">' + esc(t('trim.btn')) + '</button></div>' +
                '<div class="trim-extra hidden"><div class="trim-inputs"><span>' + esc(t('trim.start')) + '</span><input type="number" min="0" value="0" class="t-start"><span>' + esc(t('trim.end')) + '</span><input type="number" min="1" value="30" class="t-end"><button class="mini-btn" data-job="trimgo">' + esc(t('trim.go')) + '</button></div><div class="hint-text">' + esc(t('trim.max')) + '</div></div>';
        }
    }
    h += '</div>';
    card.innerHTML = h;
    card.setAttribute('data-card', String(n));
    res.appendChild(card);

    var th = card.querySelector('[data-thumb]');
    if (th) th.onclick = function () { openLightbox([info.thumbnail], 0); };
    Array.prototype.forEach.call(card.querySelectorAll('[data-gi]'), function (img) {
        img.style.cursor = 'zoom-in';
        img.onclick = function () { openLightbox(images.map(function (x) { return x.url; }), +img.getAttribute('data-gi')); };
    });
    videos.forEach(function (v, i) {
        var row = card.querySelector('[data-vr="' + i + '"]');
        if (!row) return;
        var btns = row.querySelectorAll('button');
        Array.prototype.forEach.call(btns, function (b) {
            var act = b.getAttribute('data-act');
            if (act === 'play') b.onclick = function () {
                var cell = row.querySelector('.play-cell');
                if (cell.innerHTML) { cell.innerHTML = ''; b.textContent = t('play.btn'); return; }
                var vid = document.createElement('video');
                vid.controls = true; vid.preload = 'metadata'; vid.src = v.url;
                cell.appendChild(vid);
                b.textContent = t('stop.btn');
            };
            else if (act === 'copy') b.onclick = function () { copyText(v.url); };
            else if (act === 'qr') b.onclick = function () { qrToggle(b, v.url); };
        });
    });
    Array.prototype.forEach.call(card.querySelectorAll('[data-au]'), function (b) { b.onclick = function () { copyText(b.getAttribute('data-au')); }; });
    Array.prototype.forEach.call(card.querySelectorAll('[data-job]'), function (b) {
        b.onclick = function () {
            var kind = b.getAttribute('data-job');
            if (kind === 'trim') { var tx = card.querySelector('.trim-extra'); if (tx) tx.classList.toggle('hidden'); return; }
            if (kind === 'trimgo') {
                var s = parseFloat(card.querySelector('.t-start').value) || 0;
                var e = parseFloat(card.querySelector('.t-end').value) || 0;
                submitJob('trim', srcUrl, title, { start: s, end: e });
                return;
            }
            submitJob(kind, srcUrl, title, kind === 'merge' ? { height: parseInt(b.getAttribute('data-h') || '720', 10) } : {});
        };
    });
}

/* ---------- jobs ---------- */
function openJobModal() { var m = $('jobModal'); if (m) m.classList.remove('hidden'); }
function closeJobModal() { var m = $('jobModal'); if (m) m.classList.add('hidden'); }
async function submitJob(kind, url, title, extra) {
    if (needCaptcha()) return;
    openJobModal();
    $('jobFill').style.width = '0%';
    $('jobPct').textContent = '0%';
    $('jobMeta').textContent = '...';
    $('jobDl').classList.add('hidden');
    try {
        var body = guardedBody(Object.assign({ kind: kind, url: url, filename: title }, extra || {}));
        var r = await fetch('/api/job', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok || !j.jobId) throw new Error(j.error || ('HTTP ' + r.status));
        $('jobCancel').onclick = function () { cancelJob(j.jobId); };
        pollJob(j.jobId);
    } catch (e) {
        logClient('job-create: ' + (e.message || e), url);
        $('jobMeta').textContent = '❌ ' + t('job.failed') + ': ' + (e.message || 'Error');
    }
}
async function pollJob(id) {
    ACTIVE_JOBS[id] = true;
    while (ACTIVE_JOBS[id]) {
        await new Promise(function (res) { setTimeout(res, 1500); });
        if (!ACTIVE_JOBS[id]) return;
        try {
            var r = await fetch('/api/job/' + encodeURIComponent(id));
            var j = await r.json().catch(function () { return {}; });
            var st = j.job || {};
            var state = st.status || 'working';
            var pct = Math.min(100, st.progress || 0);
            $('jobFill').style.width = pct + '%';
            $('jobPct').textContent = pct + '%';
            $('jobMeta').textContent = (st.phase || state) + ' • ' + (st.speed || '-') + ' • ETA ' + (st.eta || '-');
            if (state === 'done') {
                delete ACTIVE_JOBS[id];
                var a = $('jobDl');
                a.href = st.fileUrl || ('/api/file/' + encodeURIComponent(id));
                a.download = (st.file && st.file.filename) || 'download';
                a.classList.remove('hidden');
                if (st.file && st.file.size_label) $('jobMeta').textContent += ' • ' + st.file.size_label;
                toast(t('job.done'));
                return;
            }
            if (state === 'error' || state === 'cancelled') {
                delete ACTIVE_JOBS[id];
                $('jobMeta').textContent = '❌ ' + (st.error || state);
                return;
            }
        } catch (e) { /* retry */ }
    }
}
async function cancelJob(id) {
    delete ACTIVE_JOBS[id];
    try { await fetch('/api/job/' + encodeURIComponent(id), { method: 'DELETE' }); } catch (e) { }
    closeJobModal();
}

/* ---------- pencarian ---------- */
async function doSearch() {
    var inp = $('searchInput'); if (!inp) return;
    var q = inp.value.trim();
    if (!q) { toast(t('e.empty')); return; }
    if (needCaptcha()) return;
    var res = $('result'); if (res) res.innerHTML = '';
    hideError(); setLoading(true);
    try {
        var r = await fetch(apiLink('/api/search', guardedParams({ q: q, max: 8 })));
        var j = await r.json().catch(function () { return {}; });
        var items = j.results || j.items || [];
        setLoading(false);
        if (!r.ok || !j.success) throw new Error(j.error || ('HTTP ' + r.status));
        if (!items.length) { showError(t('search.noresult')); return; }
        var card = document.createElement('div');
        card.className = 'cyber-card result-card';
        var h = '<div class="result-header"><span>' + esc(t('sec.search')) + '</span><span class="result-badge">' + items.length + '</span></div><div class="result-body">';
        items.forEach(function (it, i) {
            h += '<div class="sr-row"><div class="sr-info"><div class="sr-title">' + esc(it.title || '') + '</div><div class="sr-meta">' + esc(it.channel || '') + (it.duration_label ? ' • ' + esc(it.duration_label) : '') + '</div></div><button class="sr-use" data-sr="' + i + '">⬇</button></div>';
        });
        h += '</div>';
        card.innerHTML = h;
        if (res) res.appendChild(card);
        Array.prototype.forEach.call(card.querySelectorAll('[data-sr]'), function (b) {
            b.onclick = function () {
                var it = items[+b.getAttribute('data-sr')];
                if ($('urlInput')) $('urlInput').value = it.url;
                fetchMedia();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        });
        items.forEach(function (it, i) {
            if (!it.thumbnail) return;
            var row = card.querySelectorAll('.sr-row')[i];
            if (!row) return;
            var img = document.createElement('img');
            img.src = it.thumbnail; img.alt = ''; img.loading = 'lazy';
            img.onerror = function () { img.remove(); };
            row.insertBefore(img, row.firstChild);
        });
    } catch (e) {
        logClient('search: ' + (e.message || e), q);
        setLoading(false);
        showError(/tidak ada hasil|no result/i.test(e.message || '') ? t('search.noresult') : (e.message || 'Error'));
    }
}

/* ---------- lightbox ---------- */
function openLightbox(list, idx) {
    GALLERY = list || []; LB_INDEX = idx || 0;
    showLb();
    var lb = $('lightbox'); if (lb) lb.classList.remove('hidden');
}
function showLb() {
    if (!GALLERY.length) return;
    LB_INDEX = (LB_INDEX + GALLERY.length) % GALLERY.length;
    var img = $('lbImg'); if (img) img.src = GALLERY[LB_INDEX];
    var d = $('lbDl'); if (d) d.href = GALLERY[LB_INDEX];
}
function lbNav(n) { LB_INDEX += n; showLb(); }
function closeLightbox() { var lb = $('lightbox'); if (lb) lb.classList.add('hidden'); }

/* ---------- PWA ---------- */
var deferredPrompt = null;
window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferredPrompt = e;
    var b = $('installBtn'); if (b) b.classList.remove('hidden');
});
async function installPwa() {
    if (!deferredPrompt) { toast(t('install.manual')); return; }
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; toast(t('install.done')); } catch (e) { }
    deferredPrompt = null;
    var b = $('installBtn'); if (b) b.classList.add('hidden');
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', function () {
    renderHistory();
    initServer();
    var ib = $('installBtn');
    if (ib) ib.addEventListener('click', installPwa);
    var inp = $('urlInput');
    if (inp) {
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') fetchMedia(); });
        inp.addEventListener('input', detectPlatform);
    }
    var si = $('searchInput');
    if (si) si.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });
});
window.addEventListener('error', function (ev) { logClient('window: ' + (ev.error && ev.error.message || ev.message || 'err')); });
