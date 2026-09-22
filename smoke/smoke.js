// Smoke tests: run against a live server (default http://localhost:3000).
// Usage: BASE=http://localhost:3000 node smoke/smoke.js
const BASE = process.env.BASE || 'http://localhost:3000';
const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const TT = 'https://www.tiktok.com/@khaby.lame/video/6971795480774708485'; // oEmbed-verified 2026-09-22
const FB = 'https://www.facebook.com/share/r/176Gd2Y3F5/';
const IG = 'https://www.instagram.com/reel/Da_eH4pva9C/?igsh=MWpzNXdhbjE1cjZmOA==';
let fails = 0;
async function t(name, fn) {
  try { await fn(); console.log('PASS', name); }
  catch (e) { fails++; console.log('FAIL', name, '-', e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert'); }
async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { r, j };
}
(async () => {
  await t('health', async () => {
    const r = await fetch(BASE + '/api/health');
    const j = await r.json();
    assert(j.ok === true, 'not healthy');
  });
  await t('config', async () => {
    const r = await fetch(BASE + '/api/config');
    const j = await r.json();
    assert(typeof j.trim === 'boolean' && typeof j.search === 'boolean', 'bad caps');
  });
  await t('analyze YT', async () => {
    const { r, j } = await post('/api/index', { url: YT });
    assert(r.ok && j.success, 'analyze failed: ' + JSON.stringify(j).slice(0, 200));
    assert(j.downloads && ((j.downloads.video || []).length + (j.downloads.audio || []).length + (j.downloads.image || []).length) > 0, 'no downloads');
    assert(j.info && j.info.title, 'no info');
  });
  await t('analyze TikTok', async () => {
    const { r, j } = await post('/api/index', { url: TT });
    assert(r.ok && j.success, 'analyze failed: ' + JSON.stringify(j).slice(0, 200));
    assert(j.downloads && (j.downloads.video || []).length > 0, 'no video');
  });
  await t('analyze FB share', async () => {
    const { r, j } = await post('/api/index', { url: FB });
    assert(r.ok && j.success, 'analyze failed: ' + JSON.stringify(j).slice(0, 200));
    assert(j.downloads && ((j.downloads.video || []).length + (j.downloads.audio || []).length) > 0, 'no downloads');
  });
  await t('analyze IG reel', async () => {
    const { r, j } = await post('/api/index', { url: IG });
    assert(r.ok && j.success, 'analyze failed: ' + JSON.stringify(j).slice(0, 200));
    assert(j.downloads && ((j.downloads.video || []).length + (j.downloads.audio || []).length) > 0, 'no downloads');
  });
  await t('search', async () => {
    const r = await fetch(BASE + '/api/search?q=never%20gonna');
    const j = await r.json();
    assert(r.ok && j.success && j.results.length > 0, 'no results');
  });
  await t('mp3 job quick (may skip on Vercel)', async () => {
    const { r, j } = await post('/api/job', { kind: 'mp3', url: YT });
    if (r.status === 501) { console.log('  (skipped: ffmpeg-less runtime)'); return; }
    assert(r.ok && j.jobId, 'job not created: ' + JSON.stringify(j).slice(0, 200));
    for (let i = 0; i < 40; i++) {
      await new Promise(r2 => setTimeout(r2, 3000));
      const s = await (await fetch(BASE + '/api/job/' + j.jobId)).json();
      const st = (s.job || {}).status;
      if (st === 'done') return;
      if (st === 'error' || st === 'cancelled') throw new Error('job ' + st + ': ' + ((s.job || {}).error || ''));
    }
    throw new Error('job timeout');
  });
  await t('cookies health', async () => {
    const r = await fetch(BASE + '/api/cookies-health');
    const j = await r.json();
    assert(r.ok && j.success && typeof j.ok === 'boolean', 'bad cookies health');
  });
  await t('rate limit headers', async () => {
    const r = await fetch(BASE + '/api/cookies-health');
    assert(r.headers.get('ratelimit-limit'), 'no rate-limit headers');
  });
  console.log(fails ? `\n${fails} FAILURES` : '\nALL SMOKE TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();
