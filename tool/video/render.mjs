// 설명 영상 굽기: node tool/video/render.mjs [slug ...] [--stills 0,2.5,5 --out 폴더]
// 장면(tool/video/scenes/<slug>.js)을 프레임마다 찍어 ffmpeg 로 assets/video/<slug>.mp4 와 표지 그림 <slug>.webp 를 만든다.
// 자막은 about.json 의 work[].problems 에서 가져오고, 길이와 장(章)마다 시작 시각은 tool/video/clips.json 에 적는다(build.py 가 읽는다).
// Playwright(맥에서는 모아캠 저장소에 깔린 것), ffmpeg(libx264), cwebp 가 필요하다.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const require = createRequire(process.env.PLAYWRIGHT_FROM || '/Users/njkim/Desktop/njkim/_user/Project/moacam/package.json');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : null;
};
const stills = opt('--stills');
const outDir = opt('--out') || join(tmpdir(), 'clip-stills');
const fps = Number(opt('--fps') || 30);
const about = JSON.parse(readFileSync(join(root, 'tool/about.json'), 'utf8'));
const works = Object.fromEntries(about.work.map((w) => [w.slug, w]));
const slugs = args.length ? args : readdirSync(join(here, 'scenes')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const clipsPath = join(here, 'clips.json');
const clips = existsSync(clipsPath) ? JSON.parse(readFileSync(clipsPath, 'utf8')) : {};

const browser = await chromium.launch();
// 1280×720 으로 찍는다(쪽에서 가장 넓게 보여도 640px 안팎이라 2배 화면에도 넉넉하다)
const page = await browser.newPage({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1.6 });
page.on('pageerror', (e) => {
  console.error('장면 오류:', e.message);
  process.exitCode = 1;
});
for (const slug of slugs) {
  const problems = (works[slug]?.problems || []).map(({ problem, solution }) => ({ problem, solution }));
  await page.goto(`${pathToFileURL(join(here, 'stage.html')).href}?scene=${slug}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.READY === true);
  await page.evaluate((p) => {
    window.PROBLEMS = p;
  }, problems);
  const meta = await page.evaluate(() => ({ duration: SCENE.duration, at: SCENE.beats.map((b) => b.at), poster: SCENE.poster }));
  if (meta.at.length !== problems.length) console.warn(`※ ${slug}: 장 ${meta.at.length}개, 문제 ${problems.length}개 — 수가 다릅니다`);

  if (stills) {
    mkdirSync(outDir, { recursive: true });
    for (const t of stills.split(',').map(Number)) {
      await page.evaluate((t) => frame(t), t);
      await page.screenshot({ path: join(outDir, `${slug}-${t}.png`) });
    }
    console.log('stills', slug, outDir);
    continue;
  }

  const tmp = join(tmpdir(), `clip-${slug}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const n = Math.round(meta.duration * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => frame(t), i / fps);
    await page.screenshot({ path: join(tmp, `f${String(i).padStart(5, '0')}.png`) });
  }
  mkdirSync(join(root, 'assets/video'), { recursive: true });
  const mp4 = join(root, 'assets/video', `${slug}.mp4`);
  // 장이 바뀌는 자리마다 키 프레임을 두어, 목록을 눌러 그 장으로 건너뛸 때 바로 보이게 한다
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(tmp, 'f%05d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '27', '-pix_fmt', 'yuv420p',
    '-g', String(fps * 2), '-force_key_frames', meta.at.join(','), '-movflags', '+faststart', '-an', mp4,
  ]);
  await page.evaluate((t) => frame(t), meta.poster);
  const png = join(tmp, 'poster.png');
  await page.screenshot({ path: png });
  execFileSync('cwebp', ['-quiet', '-q', '80', png, '-o', join(root, 'assets/video', `${slug}.webp`)]);
  clips[slug] = { src: `/assets/video/${slug}.mp4`, poster: `/assets/video/${slug}.webp`, w: 1280, h: 720, duration: meta.duration, at: meta.at };
  writeFileSync(clipsPath, JSON.stringify(clips, null, 2) + '\n');
  rmSync(tmp, { recursive: true, force: true });
  console.log('ok', slug, `${meta.duration}s`, `${Math.round(statSync(mp4).size / 1024)}KB`);
}
await browser.close();
