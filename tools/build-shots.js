#!/usr/bin/env node
'use strict';
/* build-shots.js — every screenshot on the site, captured from the real thing.
 *
 * RUN LOCALLY, COMMIT THE OUTPUT. Not at Vercel build time: the build command
 * is three fast checks, and adding headless Chromium to it would slow every
 * deploy to regenerate assets that change perhaps monthly.
 *
 * playwright-core is already a dependency (api/marketing-kit.mjs uses it), so
 * this adds no package. @sparticuz/chromium is ALSO already a dependency, but
 * it is the AWS-Lambda build used by that Vercel function at runtime — its
 * executablePath is undefined on a normal dev machine, so it cannot be the
 * browser source here. Resolution order, matching tools/a11y-sweep.js's
 * pattern (see resolvePlaywright there) but chosen so a missing browser fails
 * loudly rather than silently producing nothing:
 *   1. SBV_CHROME env var → an explicit executablePath
 *   2. chromium.launch({ channel: 'chrome' }) → local system Chrome
 *   3. the npx playwright cache path
 * If none work, the tool throws naming all three attempts.
 *
 *   node tools/build-shots.js                 all groups
 *   node tools/build-shots.js --only featured one group
 *   node tools/build-shots.js --list          print targets and exit
 *
 * Local targets are served from a throwaway static server on 127.0.0.1 so a
 * root-relative /assets/... resolves exactly as it does in production.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'assets', 'shots');
const args = process.argv.slice(2);
const only = (args.indexOf('--only') > -1) ? args[args.indexOf('--only') + 1] : null;
const qualityFlag = (args.indexOf('--quality') > -1) ? Number(args[args.indexOf('--quality') + 1]) : 78;

const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
                '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
                '.svg':'image/svg+xml', '.webp':'image/webp' };

/* group, name, url (local path or absolute), and an optional prepare() that
   runs in the page before the shot — that is how a signature interaction gets
   captured in its interesting state rather than at rest. */
const TARGETS = [
  /* hero — TWO frames (Ruling R7), not three.
     /admin/ is behind auth: a headless capture is a sign-in form, and
     shipping that captioned "your admin" would be a screenshot of something
     not actually running — barred by the spec's own screenshot rule and by
     the compliance checklist. The admin step stays in How-it-works as text,
     which is where it already lived. A third frame can be added later if a
     signed-in capture becomes possible. */
  { group:'hero', name:'1-demo', url:'/sites/landscaping/' },
  // 2-branded is produced by Step 3 (tools/build-shots-hero3.js), from a real rebuild.

  // featured — six niches, two frames each (rest + signature interaction)
  { group:'featured', name:'bin-cleaning',        url:'/sites/bin-cleaning/' },
  { group:'featured', name:'bin-cleaning-hover',  url:'/sites/bin-cleaning/',  prepare:'slider' },
  { group:'featured', name:'landscaping',         url:'/sites/landscaping/' },
  { group:'featured', name:'landscaping-hover',   url:'/sites/landscaping/',   prepare:'season' },
  { group:'featured', name:'dumpster-rental',     url:'/sites/dumpster-rental/' },
  { group:'featured', name:'dumpster-rental-hover',url:'/sites/dumpster-rental/',prepare:'picker' },
  { group:'featured', name:'dog-walking',         url:'/sites/dog-walking/' },
  { group:'featured', name:'dog-walking-hover',   url:'/sites/dog-walking/',   prepare:'week' },
  { group:'featured', name:'dj',                  url:'/sites/dj/pink/' },
  { group:'featured', name:'dj-hover',            url:'/sites/dj/pink/',       prepare:'wait' },
  { group:'featured', name:'child-care',          url:'/sites/child-care/' },
  { group:'featured', name:'child-care-hover',    url:'/sites/child-care/',    prepare:'wait' },

  // platforms — consignmentbiz already exists in assets/proof/; recapture all
  // three here so the group is self-consistent in size and quality.
  { group:'platforms', name:'estatesalebiz',  url:'https://estatesalebiz.com' },
  { group:'platforms', name:'garagesalebiz',  url:'https://garagesalebiz.com' },
  { group:'platforms', name:'consignmentbiz', url:'https://consignmentbiz.com' },

  // work — the eight linked portfolio entries. Kingdom Creatives is OFFLINE
  // and deliberately absent; /work/ renders a typographic placard for it.
  { group:'work', name:'estatesalebiz',    url:'https://estatesalebiz.com' },
  { group:'work', name:'garagesalebiz',    url:'https://garagesalebiz.com' },
  { group:'work', name:'consignmentbiz',   url:'https://consignmentbiz.com' },
  { group:'work', name:'sitelab',          url:'/sites/' },
  { group:'work', name:'yourlifecc',       url:'https://yourlifecc.com' },
  { group:'work', name:'churchfortruckers',url:'https://churchfortruckers.org' },
  { group:'work', name:'primebincleaning', url:'https://primebincleaning.com' },
  { group:'work', name:'domvegz',          url:'https://domvegz.com' },
];

/* Signature-interaction setup, run inside the page. Each returns only after
   the interaction has visibly settled. Unknown keys just wait — a shot at
   rest is a worse shot, never a wrong one. */
const PREPARE = {
  slider: `(async()=>{const s=document.querySelector('[class*=ba-],[class*=slider] input,input[type=range]');
           if(s){s.value=s.max?Math.round(s.max*0.55):55;s.dispatchEvent(new Event('input',{bubbles:true}));}
           await new Promise(r=>setTimeout(r,600));})()`,
  season: `(async()=>{const b=[...document.querySelectorAll('button,[role=tab]')]
             .find(e=>/summer|fall|autumn/i.test(e.textContent));if(b)b.click();
           await new Promise(r=>setTimeout(r,900));})()`,
  picker: `(async()=>{const b=[...document.querySelectorAll('button,[role=tab],label')]
             .find(e=>/20|30 ?yard|yd/i.test(e.textContent));if(b)b.click();
           await new Promise(r=>setTimeout(r,700));})()`,
  week:   `(async()=>{const d=[...document.querySelectorAll('button,[role=checkbox],label')]
             .filter(e=>/mon|wed|fri/i.test(e.textContent)).slice(0,3);d.forEach(e=>e.click());
           await new Promise(r=>setTimeout(r,700));})()`,
  wait:   `new Promise(r=>setTimeout(r,2500))`,
};

if (args.includes('--list')) {
  TARGETS.forEach(t => console.log(`${t.group}/${t.name}  ${t.url}`));
  process.exit(0);
}

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        r.writeHead(404); return r.end('nf');
      }
      r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      r.end(fs.readFileSync(f));
    });
    s.listen(0, '127.0.0.1', () => res({ s, port: s.address().port }));
  });
}

/* Browser resolution (Ruling R12). @sparticuz/chromium's executablePath is
   undefined outside its AWS Lambda build environment — verified on this
   machine — so it is never tried here. Each attempt is recorded so a total
   failure can name all three rather than producing nothing silently. */
async function launchBrowser() {
  const { chromium } = require('playwright-core');
  const attempts = [];
  const LAUNCH_ARGS = ['--hide-scrollbars', '--force-color-profile=srgb'];

  if (process.env.SBV_CHROME) {
    try {
      return await chromium.launch({ executablePath: process.env.SBV_CHROME, args: LAUNCH_ARGS });
    } catch (e) { attempts.push(`SBV_CHROME=${process.env.SBV_CHROME} -> ${e.message.split('\n')[0]}`); }
  } else {
    attempts.push('SBV_CHROME not set');
  }

  try {
    return await chromium.launch({ channel: 'chrome', args: LAUNCH_ARGS });
  } catch (e) { attempts.push(`channel:'chrome' -> ${e.message.split('\n')[0]}`); }

  const npxCache = 'C:/Users/JasonVega/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright';
  try {
    const pw = require(npxCache);
    return await pw.chromium.launch({ args: LAUNCH_ARGS });
  } catch (e) { attempts.push(`npx cache (${npxCache}) -> ${e.message.split('\n')[0]}`); }

  throw new Error('No local Chromium found. Attempts:\n  ' + attempts.join('\n  '));
}

(async () => {
  const browser = await launchBrowser();
  const { s, port } = await serve();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });

  const list = only ? TARGETS.filter(t => t.group === only) : TARGETS;
  let failed = 0;
  const failedNames = [];
  for (const t of list) {
    const dir = path.join(OUT, t.group);
    fs.mkdirSync(dir, { recursive: true });
    const url = t.url.startsWith('http') ? t.url : `http://127.0.0.1:${port}${t.url}`;
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);          // fonts + entry animations settle
      if (t.prepare) await page.evaluate(PREPARE[t.prepare] || PREPARE.wait);
      await page.screenshot({
        path: path.join(dir, t.name + '.jpg'), type: 'jpeg', quality: qualityFlag,
      });
      console.log(`  ok    ${t.group}/${t.name}`);
    } catch (e) {
      failed++;
      failedNames.push(`${t.group}/${t.name} (${t.url})`);
      console.log(`  FAIL  ${t.group}/${t.name}  ${t.url}  ${e.message.split('\n')[0]}`);
    }
    await page.close();
  }
  await ctx.close(); await browser.close(); s.close();
  /* A missing screenshot must not pass quietly — a page task downstream would
     render a broken image and the gate does not check binaries. */
  if (failed) {
    console.error(`\n${failed} target(s) failed: ${failedNames.join(', ')}`);
  }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('build-shots failed: ' + e.message); process.exit(1); });
