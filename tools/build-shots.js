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
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'assets', 'shots');
/* Scratch dir for the hero/2-branded rebuild (Ruling R13 fix round 2). It
   lives under ROOT — not an OS tmp dir — so the SAME static HTTP server that
   serves every other local target can serve it too; file:// was fix round
   2's finding 1 (root-relative /sites/landscaping/photos/... 404s under
   file://). Always removed after use (see the try/finally around the main
   loop below) and listed in .gitignore as a defensive backstop. */
const HERO3_DIR = path.join(ROOT, '.sbv-hero3-build');
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
  /* hero — NO LONGER THE LANDING-PAGE HERO. The hero there now rotates the
     six `featured` REST frames below (see .seq in assets/sbv.css), which
     superseded the two-frame demo-then-branded sequence of Rulings R7/R14.
     This group is kept because 2-branded is still the og:image/twitter:image
     on index.html — the only remaining consumer. 1-demo stays with it: it
     costs one capture, and the pair is what makes the og image legible as a
     before/after if the card is ever re-cropped. Delete both together, and
     repoint the og tags first, if that stops being true. */
  { group:'hero', name:'1-demo', url:'/sites/landscaping/' },
  /* 2-branded: a genuine build-site.js rebuild of landscaping under a
     different brand (see buildHeroBranded() below), served over the same
     HTTP server as every other local target — no file:// (Ruling R13 fix
     round 2, finding 1) — and built WITHOUT --demo, so it never carries the
     for-sale banner that correctly belongs only on 1-demo (finding 2). */
  { group:'hero', name:'2-branded', prep:'hero-branded' },

  /* featured — six niches, two frames each (rest + signature interaction).
     The REST frame of each is now load-bearing twice: the card on /, and the
     landing-page hero rotator that cross-fades all six. One file per niche,
     so a recapture updates both surfaces at once and the browser downloads
     each only once. Keep this list and the rotator's six <img> in index.html
     in the same order — the captions under the frame are positional. */
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
  // No child-care-hover (Ruling R13): its hero effect is an ambient CSS
  // twinkle with no discrete state to engage, so no capture can produce a
  // meaningfully distinct second frame. The landing-page task handles a
  // card with no hover frame.

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

/* Signature-interaction setup, run inside the page. Ruling R13: a hover
   capture exists to show a DIFFERENT region of the page than the rest shot,
   so each of these scrolls its real target into view, waits for the scroll
   to settle, engages the interaction, waits for it to animate/re-render, and
   leaves the page parked there for the screenshot. Selectors below were read
   from each niche's actual sections.html/niche.js (see task-3 report) rather
   than guessed — that is what produced near-duplicate "hover" frames the
   first time. Unknown keys just wait — a shot at rest is a worse shot, never
   a wrong one. */
const PREPARE = {
  /* bin-cleaning — the before/after slider is #ba, a div driven by
     mousedown/mousemove/mouseup + a --pos CSS var (niche.js), NOT an
     <input type=range>. Simulate a real drag toward the "before" side so
     the reveal is unambiguous. */
  slider: `(async()=>{
    const ba = document.getElementById('ba');
    if(!ba) return;
    ba.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,500));
    const r = ba.getBoundingClientRect();
    const x = r.left + r.width * 0.24, y = r.top + r.height / 2;
    ba.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, clientX:x, clientY:y}));
    window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:x, clientY:y}));
    window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, clientX:x, clientY:y}));
    await new Promise(r=>setTimeout(r,500));
  })()`,
  /* landscaping — the season wheel's tabs are #wheelTabs [data-season-tab],
     one of which starts aria-selected (seasonForMonth). Click whichever tab
     is NOT already selected so the frame shows a different season. */
  season: `(async()=>{
    const wheel = document.getElementById('wheel');
    if(wheel) wheel.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,500));
    const tabs = [...document.querySelectorAll('#wheelTabs [data-season-tab]')];
    const current = tabs.find(t=>t.getAttribute('aria-selected')==='true');
    const target = tabs.find(t=>t!==current) || tabs[0];
    if(target) target.click();
    await new Promise(r=>setTimeout(r,700));
  })()`,
  /* dumpster-rental — size picker. Already produced a meaningfully different
     frame; kept, with an explicit scrollIntoView added for consistency. */
  picker: `(async()=>{
    const b=[...document.querySelectorAll('button,[role=tab],label')]
      .find(e=>/20|30 ?yard|yd/i.test(e.textContent));
    if(b){ b.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,400)); b.click(); }
    await new Promise(r=>setTimeout(r,700));
  })()`,
  /* dog-walking — the week builder's day toggles are #weekGrid [data-bday].
     Toggle three days on so the price panel leaves its empty state. Every
     click calls renderBuilder(), which replaces #weekGrid's innerHTML — so
     buttons queried before the first click go stale/detached immediately
     after it. Re-query live from the DOM on each iteration instead of
     collecting all three nodes up front. */
  week: `(async()=>{
    const grid = document.getElementById('weekGrid');
    if(grid) grid.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,500));
    for (let i = 0; i < 3; i++) {
      const btn = document.querySelectorAll('#weekGrid [data-bday]')[i];
      if (btn) btn.click();
      await new Promise(r=>setTimeout(r,150));
    }
    await new Promise(r=>setTimeout(r,500));
  })()`,
  wait: `new Promise(r=>setTimeout(r,2500))`,
};

if (args.includes('--list')) {
  TARGETS.forEach(t => console.log(`${t.group}/${t.name}  ${t.url || '(' + t.prep + ': built at run time)'}`));
  process.exit(0);
}

/* Rebuilds landscaping under a different brand, WITHOUT --demo, into
   HERO3_DIR — then restores niches/landscaping/content.json immediately
   (git checkout, same as before) and verifies the restore actually landed
   clean before letting the caller proceed. Ruling R13 fix round 2: the
   for-sale banner only belongs on 1-demo, and --demo was what put it on
   2-branded too. */
function buildHeroBranded() {
  const contentPath = path.join(ROOT, 'niches', 'landscaping', 'content.json');
  try {
    const c = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    c.brand.name = 'Vega & Sons Lawn Care';
    c.brand.tagline = 'Cut clean. Every week.';
    c.brand.city = 'Nampa, ID';
    c.brand.phone = '(208) 555-0111';
    fs.writeFileSync(contentPath, JSON.stringify(c, null, 2));
    execFileSync(process.execPath,
      [path.join(ROOT, 'tools', 'build-site.js'), 'landscaping', '--out', HERO3_DIR],
      { stdio: 'inherit' });
  } finally {
    execFileSync('git', ['checkout', '--', 'niches/landscaping/content.json'], { cwd: ROOT });
  }
  const dirty = execFileSync('git', ['status', '--porcelain', 'niches/landscaping/content.json'], { cwd: ROOT })
    .toString().trim();
  if (dirty) throw new Error('content.json restore did not come back clean: ' + dirty);
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
  let builtHero3 = false;
  try {
    for (const t of list) {
      const dir = path.join(OUT, t.group);
      fs.mkdirSync(dir, { recursive: true });
      let url = t.url;
      try {
        if (t.prep === 'hero-branded') {
          buildHeroBranded();
          builtHero3 = true;
          url = `/${path.relative(ROOT, HERO3_DIR).split(path.sep).join('/')}/`;
        }
        url = url.startsWith('http') ? url : `http://127.0.0.1:${port}${url}`;
      } catch (e) {
        failed++;
        failedNames.push(`${t.group}/${t.name} (prep)`);
        console.log(`  FAIL  ${t.group}/${t.name}  prep  ${e.message.split('\n')[0]}`);
        continue;
      }
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
        failedNames.push(`${t.group}/${t.name} (${url})`);
        console.log(`  FAIL  ${t.group}/${t.name}  ${url}  ${e.message.split('\n')[0]}`);
      }
      await page.close();
    }
  } finally {
    // Never leave the scratch build behind, success or failure.
    if (builtHero3) fs.rmSync(HERO3_DIR, { recursive: true, force: true });
  }
  await ctx.close(); await browser.close(); s.close();
  /* A missing screenshot must not pass quietly — a page task downstream would
     render a broken image and the gate does not check binaries. */
  if (failed) {
    console.error(`\n${failed} target(s) failed: ${failedNames.join(', ')}`);
  }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('build-shots failed: ' + e.message); process.exit(1); });
