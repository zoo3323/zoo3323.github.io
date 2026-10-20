// 링크 미리보기 그림(1200×630)을 만든다: node tool/og.mjs  (그 뒤 python3 tool/build.py)
// 첫 화면은 그대로 찍어 assets/img/og.png, 소개·회사 프로젝트·앱 쪽은 쪽마다 카드를 그려 assets/og/<이름>.jpg 로 둔다.
// 빌드가 쪽마다 이 그림을 og:image 로 쓴다(그림이 없으면 og.png). Playwright(맥에서는 모아캠 저장소에 깔린 것)가 필요하다.
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import http from 'node:http';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(process.env.PLAYWRIGHT_FROM || '/Users/njkim/Desktop/njkim/_user/Project/moacam/package.json');
const { chromium } = require('playwright');
const json = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const site = json('tool/site.json');
const about = json('tool/about.json');
const shelf = json('tool/shelf.json');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const host = site.site.replace(/^https?:\/\//, '');

// 진열대 카드(그림·색)를 주소로 찾는다
const items = [];
const walk = (o) => {
  if (Array.isArray(o)) o.forEach(walk);
  else if (o && typeof o === 'object') {
    if (typeof o.href === 'string') items.push(o);
    Object.values(o).forEach(walk);
  }
};
walk(shelf);
const item = (href) => items.find((x) => x.href === href) || {};

const cards = [
  {
    id: 'about',
    kind: '소개',
    title: site.developer,
    sub: about.headline,
    line: about.lead,
    tone: '#ffe55c',
    art: `<figure class="polaroid"><img src="${esc(shelf.profile.photo)}" alt=""><figcaption>${esc(site.developer)}</figcaption></figure>`,
  },
  ...about.work.map((w) => {
    const it = item(`/work/${w.slug}/`);
    return {
      id: `work-${w.slug}`,
      kind: '회사 프로젝트',
      title: w.org,
      sub: `${w.unit} · ${w.period}`,
      line: it.line || w.summary,
      tone: it.tone || '#efeee8',
      art: `<img class="cover" src="${esc(it.image)}" alt="">`,
    };
  }),
  ...site.apps.map((id) => {
    const a = json(`tool/apps/${id}/app.json`);
    return {
      id,
      kind: `앱 · ${a.status}`,
      title: a.name,
      sub: a.platforms.map((p) => p.name).join(' · '),
      line: a.line,
      tone: a.tone,
      art: `<img class="icon" src="/assets/img/${id}/icon.webp" alt="">`,
    };
  }),
];

const card = (c) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
@font-face { font-family: "Do Hyeon"; src: url("/assets/fonts/DoHyeon.woff2") format("woff2"); font-display: block; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; position: relative; color: #17171a; word-break: keep-all;
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
  background: radial-gradient(circle, #dddbd2 0 4.5px, transparent 5px) 20px 20px / 40px 40px, #fafaf6; }
.art { position: absolute; left: 56px; top: 44px; width: 520px; height: 542px; display: grid; place-items: center; overflow: hidden;
  background: ${c.tone}; border-radius: 30px; box-shadow: 0 0 0 3px #17171a, 0 22px 34px -20px rgb(52 48 70 / 0.7); }
.cover { width: 100%; height: 100%; object-fit: cover; }
.icon { width: 300px; height: 300px; border-radius: 68px; box-shadow: 0 0 0 6px #fff, 0 0 0 9px #17171a, 0 26px 36px -18px rgb(23 23 26 / 0.55); }
.polaroid { margin: 0; padding: 18px 18px 0; width: 300px; background: #fffef9; transform: rotate(-3deg);
  box-shadow: 0 0 0 2px rgb(23 23 26 / 0.12), 0 24px 34px -18px rgb(52 48 70 / 0.6); }
.polaroid img { display: block; width: 100%; aspect-ratio: 35 / 45; object-fit: cover; }
.polaroid figcaption { padding: 16px 0 20px; text-align: center; font: 400 30px/1 "Do Hyeon", sans-serif; color: #55554f; }
.text { position: absolute; left: 628px; right: 56px; top: 64px; }
.chip { display: inline-block; padding: 10px 20px 8px; font-size: 24px; font-weight: 700; color: #fff; background: #17171a; border-radius: 999px; }
h1 { margin: 26px 0 0; font: 400 78px/1.06 "Do Hyeon", sans-serif; letter-spacing: -0.01em; }
.sub { margin: 18px 0 0; font-size: 27px; font-weight: 700; color: #55554f; }
.line { margin: 22px 0 0; font-size: 30px; line-height: 1.45; color: #2b2b30;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.foot { position: absolute; left: 628px; right: 56px; bottom: 50px; display: flex; align-items: center; gap: 12px; font-size: 25px; font-weight: 700; color: #55554f; }
.foot i { width: 18px; height: 18px; border-radius: 50%; background: #ffe55c; box-shadow: 0 0 0 3px #17171a; }
</style></head><body>
<div class="art">${c.art}</div>
<div class="text"><span class="chip">${esc(c.kind)}</span><h1>${esc(c.title)}</h1><p class="sub">${esc(c.sub)}</p><p class="line">${esc(c.line)}</p></div>
<p class="foot"><i></i>${esc(site.developer)} · ${esc(host)}</p>
</body></html>`;

// 저장소 폴더를 그대로 내보내는 작은 서버(+ /__og/<이름> 은 카드 쪽)
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url.startsWith('/__og/')) {
    const c = cards.find((x) => x.id === url.slice(6));
    res.writeHead(c ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(c ? card(c) : 'no card');
  }
  let file = normalize(join(root, url));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (url.endsWith('/')) file = join(file, 'index.html');
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
mkdirSync(join(root, 'assets/og'), { recursive: true });
const only = process.argv.slice(2);
for (const c of cards) {
  if (only.length && !only.includes(c.id)) continue;
  await page.goto(`${base}/__og/${c.id}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'assets/og', `${c.id}.jpg`), type: 'jpeg', quality: 86 });
  console.log('ok', `assets/og/${c.id}.jpg`);
}
// 첫 화면: 처음 방문 힌트와 흔들림 없이 그대로 찍는다
if (!only.length || only.includes('home')) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('zoo3323:peek', '1');
    } catch {}
  });
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(root, 'assets/img/og.png') });
  console.log('ok', 'assets/img/og.png');
}
await browser.close();
server.close();
