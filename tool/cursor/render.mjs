// 커서 SVG 를 32px·64px(레티나) 투명 PNG 로 굽는다: node tool/cursor/render.mjs
// Playwright 가 필요하다(맥에서는 모아캠 저장소에 깔린 것을 빌려 쓴다). 결과는 assets/cursor/ 에 쓴다.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../assets/cursor');
const require = createRequire(process.env.PLAYWRIGHT_FROM || '/Users/njkim/Desktop/njkim/_user/Project/moacam/package.json');
const { chromium } = require('playwright');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const scale of [1, 2]) {
  const page = await browser.newPage({ viewport: { width: 64, height: 64 }, deviceScaleFactor: scale });
  for (const name of ['grab', 'grabbing']) {
    const svg = readFileSync(join(here, `${name}.svg`)).toString('base64');
    await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img id="c" src="data:image/svg+xml;base64,${svg}" width="32" height="32">`);
    await page.locator('#c').screenshot({ path: join(out, `${name}${scale === 2 ? '@2x' : ''}.png`), omitBackground: true });
  }
  await page.close();
}
await browser.close();
console.log('ok', out);
