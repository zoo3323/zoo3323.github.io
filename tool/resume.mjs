// 이력서 PDF 를 굽는다: python3 tool/build.py 로 resume/index.html 을 만든 뒤 node tool/resume.mjs
// Playwright 가 필요하다(맥에서는 모아캠 저장소에 깔린 것을 빌려 쓴다). 결과는 assets/resume.pdf.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(process.env.PLAYWRIGHT_FROM || '/Users/njkim/Desktop/njkim/_user/Project/moacam/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(join(root, 'resume/index.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: join(root, 'assets/resume.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('ok', join(root, 'assets/resume.pdf'));
