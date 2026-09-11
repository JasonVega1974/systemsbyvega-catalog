#!/usr/bin/env node
'use strict';
/* One-off: screenshots the Step-3 rebuilt landscaping site (see task-3 brief,
 * Step 3) at 1280x800 quality 78 into assets/shots/hero/2-branded.jpg.
 * Usage: node tools/build-shots-hero3.js <path-to-built-index.html>
 */
const path = require('path');
const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-shots-hero3.js <path-to-index.html>'); process.exit(2); }

(async () => {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  const abs = path.resolve(src).split(path.sep).join('/');
  const fileUrl = 'file:///' + abs;
  console.log('loading', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  const out = path.join(__dirname, '..', 'assets', 'shots', 'hero', '2-branded.jpg');
  await page.screenshot({ path: out, type: 'jpeg', quality: 78 });
  console.log('ok wrote', out);
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
