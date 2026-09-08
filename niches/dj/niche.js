/* dj/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via SL; the aliases below keep
   every extracted call site unchanged. base.js owns the reduced-motion flag,
   the reveal observer, the content fetch/merge lifecycle, and calling
   window.renderContent(). val/setErr/showDone are NOT aliased — this niche
   defines its own with different signatures. */
(function () {
  'use strict';

  var SL = window.SL;
  var esc = SL.esc, num = SL.num, telHref = SL.telHref;
  var reduce = SL.reduce;
  var CONTENT = window.DEFAULT_CONTENT;

/* ============================================================
   DEFAULT CONTENT — demo/fallback data that ships with the page.
   Everything here is overridden by content.json, which is what
   the /admin panel edits. Change content in the admin, not here.
   ============================================================ */
/* ---------- helpers ---------- */
const $ = (s,el=document)=>el.querySelector(s);
const make = (html)=>{ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };

/* ---------- live content: default data above is the fallback; content.json (edited in /admin) overrides it ---------- */
/* CONTENT is declared by the niche.js preamble (var CONTENT =
   window.DEFAULT_CONTENT), so this line only drops the old alias.

   base.js owns the content lifecycle now, and the fetch chain that used to
   kick off the YouTube library went with it. Re-arm it here, keyed on the
   channel/key pair so the first render loads with the inlined defaults and a
   later render reloads only if content.json actually changed them. */
var _ytSig = null;
function _ytMaybe(){
  var Y = CONTENT.youtube || {};
  var sig = (Y.apiKey || "") + "|" + (Y.channelId || "");
  if (sig === _ytSig) return;
  _ytSig = sig;
  loadYouTubeLibrary();
}
const ICONS = {
  "Spotify":"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.8-.96a.63.63 0 0 1-.28-1.22c3.83-.87 7.1-.5 9.73 1.1.3.18.39.58.21.87zm1.23-2.74a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.24 1.34.36.22.48.7.25 1.06zm.11-2.85C14.42 8.07 9.1 7.87 6.03 8.8a.94.94 0 1 1-.54-1.8c3.52-1.06 9.4-.86 13.1 1.34a.94.94 0 0 1-.96 1.62z",
  "SoundCloud":"M11.5 9.4c-.28 0-.5.22-.5.5v6.6c0 .28.22.5.5.5h7.3c1.6 0 2.9-1.3 2.9-2.9s-1.3-2.9-2.9-2.9c-.3 0-.6.05-.86.14C17.4 8.5 15.4 7 13.1 7c-.6 0-1.1.5-1.1 1.1v.8c-.16-.3-.34-.5-.5-.5zM9.5 10c-.28 0-.5.22-.5.5v5.5c0 .28.22.5.5.5s.5-.22.5-.5v-5.5c0-.28-.22-.5-.5-.5zM7.5 10.5c-.28 0-.5.22-.5.5v5c0 .28.22.5.5.5s.5-.22.5-.5v-5c0-.28-.22-.5-.5-.5zM5.5 11c-.28 0-.5.22-.5.5v4.5c0 .28.22.5.5.5s.5-.22.5-.5v-4.5c0-.28-.22-.5-.5-.5zM3.5 11.5c-.28 0-.5.22-.5.5v4c0 .28.22.5.5.5s.5-.22.5-.5v-4c0-.28-.22-.5-.5-.5z",
  "YouTube":"M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.76-1.77C19.34 5.1 12 5.1 12 5.1s-7.34 0-8.84.43A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.76 1.77c1.5.43 8.84.43 8.84.43s7.34 0 8.84-.43a2.5 2.5 0 0 0 1.76-1.77C23 15.2 23 12 23 12zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z",
  "Instagram":"M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.42.37 1.06.42 2.23.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.17-1.06.37-2.23.42-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.42a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.17-.42-.37-1.06-.42-2.23C2.2 15.58 2.2 15.2 2.2 12s0-3.58.07-4.85c.05-1.17.25-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.17 1.06-.37 2.23-.42C8.42 2.2 8.8 2.2 12 2.2zm0 4.86A4.94 4.94 0 1 0 12 17a4.94 4.94 0 0 0 0-9.94zm0 8.14A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zm6.3-8.34a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0z",
  "X":"M18.2 2H21l-6.55 7.48L22.5 22h-6.6l-5.17-6.76L4.8 22H2l7.02-8.02L1.5 2h6.77l4.68 6.18L18.2 2zm-1.16 18h1.83L7.05 3.9H5.1L17.04 20z",
  "TikTok":"M16.5 2c.3 2.06 1.45 3.62 3.5 3.9v2.5c-1.2.12-2.35-.18-3.5-.78v6.4c0 4.2-3.3 6.5-6.3 5.85-2.9-.62-4.2-3.5-3.5-6.1.6-2.25 2.7-3.55 4.9-3.4v2.6c-.5-.05-1.05.05-1.55.3-1 .5-1.45 1.65-1.05 2.7.45 1.15 1.85 1.6 2.95.95.8-.46 1.05-1.26 1.05-2.16V2h3.5z",
  "Apple Music":"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.5 4.6v6.93c0 1.27-.9 2.07-2 2.07-1.05 0-1.86-.74-1.86-1.74s.8-1.74 1.85-1.74c.36 0 .7.09.98.25V8.4l-4 1.04v5.05c0 1.27-.9 2.07-2 2.07-1.05 0-1.86-.74-1.86-1.74s.8-1.74 1.85-1.74c.36 0 .7.09.99.25V7.5l5.6-1.46c.27-.07.5.12.5.4z"
};

function renderAll(){
/* ---------- artist identity ---------- */
const A = {
    name:    (CONTENT.brand || {}).name,
    tagline: (CONTENT.brand || {}).tagline,
    about:   (CONTENT.owner || {}).bio,
    role:    CONTENT.role,
    genres:  CONTENT.genres
  };
const artistName = A.name || "Your Name";
document.title = artistName + " — Official Website";
["brandName","wordmark","aboutName","bookName","footName"].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=artistName; });
const _fm=document.getElementById('footMark'); if(_fm) _fm.innerHTML = escYt(artistName).trim().split(/\s+/).join('<br>');
const _hmeta=document.getElementById('heroMeta'); if(_hmeta) _hmeta.textContent = (A.role||'DJ & Producer') + (A.location ? ' · '+A.location : '');
const _htag=document.getElementById('heroTag'); if(_htag) _htag.textContent = A.tagline || '';
const _ac=document.getElementById('aboutCopy');
if(_ac){
  const paras=String(A.about||'').split(/\n\s*\n/).filter(Boolean);
  _ac.innerHTML = paras.map((p,i)=>`<p${i===0?' class="first"':''}>${escYt(p)}</p>`).join('') || '<p class="first">Add your story in the admin panel.</p>';
}
const _cr=document.getElementById('creed');
if(_cr) _cr.innerHTML = (A.genres||[]).map(g=>`<span>${escYt(g)}</span>`).join('');

/* ---------- external links & embeds ---------- */
renderEmbeds();
renderLinks();
_ytMaybe();

/* ---------- render hero mini ---------- */
$('#heroMini').innerHTML = CONTENT.heroMini.map(m=>`<div class="m"><b>${esc(m.b)}</b><span>${esc(m.s)}</span></div>`).join('');

/* ---------- marquee (actual events + years, derived from shows) ---------- */
const yearOf = w => (String(w).match(/\d{4}/)||[''])[0];
const credits = CONTENT.shows.map(s => /\d{4}/.test(s.t) ? s.t : `${s.t} ${yearOf(s.when)}`.trim());
const mk = credits.map(c=>`<span>${esc(c)}<em>✦</em></span>`).join('');
$('#marquee').innerHTML = mk + mk; // duplicate for seamless loop

/* ---------- stats ---------- */
$('#statGrid').innerHTML = CONTENT.stats.map(s=>`
  <div class="stat"><div class="num">${esc(s.num)}</div><div class="lab">${esc(s.lab)}</div><div class="sub">${esc(s.sub)}</div></div>`).join('');

/* ---------- releases ---------- */
renderReleaseGrid();

/* ---------- merch ---------- */
renderMerchGrid();

/* ---------- shows ---------- */
$('#timeline').innerHTML = CONTENT.shows.map(s=>`
  <div class="show ${s.up?'up':''}">
    <div class="when">${esc(s.when)}</div>
    <div class="what"><h4>${esc(s.t)}</h4><p>${esc(s.p)}</p></div>
    <div class="tag">${s.up?'★ Latest · ':''}${esc(s.tag)}</div>
  </div>`).join('');

/* ---------- photos ---------- */
const palettes=[['#1B3A8F','#3D8BFF'],['#FF9A3C','#0A1433'],['#57E7FF','#1B3A8F'],['#3D8BFF','#FF9A3C'],['#0A1433','#57E7FF'],['#FF9A3C','#3D8BFF']];
const photoSizes=['tall','mid','','mid','tall','','mid','tall',''];
const _photos=(CONTENT.photos&&CONTENT.photos.length)?CONTENT.photos:photoSizes.map((sz)=>({url:'',size:sz}));
$('#photoGrid').innerHTML = _photos.map((p,i)=>{
  const sz=(p&&p.size)||photoSizes[i%photoSizes.length]||'';
  if(p&&p.url) return `<div class="photo ${esc(sz)}" style="position:relative;overflow:hidden"><img src="${esc(p.url)}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>`;
  const g=`linear-gradient(${150+i*15}deg,${palettes[i%palettes.length][0]},${palettes[i%palettes.length][1]})`;
  return `<div class="photo ${esc(sz)}" style="background:${g}"><div class="ph">Photo slot ${i+1}<br>upload-ready</div></div>`;
}).join('');

/* ---------- media tabs (attach once) ---------- */
if(!window.__dvTabs){ window.__dvTabs=1;
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-selected','false');});
  t.classList.add('active'); t.setAttribute('aria-selected','true');
  const v=t.dataset.tab==='video';
  $('#ytLib').classList.toggle('hidden',!v);
  $('#photoGrid').classList.toggle('hidden',v);
}));
}

/* ---------- socials (full-colour brand logos) ---------- */
const SOC_COLORS = {
  "Spotify":"#1DB954", "SoundCloud":"#FF5500", "YouTube":"#FF0000",
  "X":"#FFFFFF", "Apple Music":"#FA243C"
};
function socIcon(s){
  const P = esc(s.p || ICONS[s.n] || '');
  if(s.n==="Instagram"){
    return `<svg viewBox="0 0 24 24"><defs>
      <linearGradient id="igGrad" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#FEDA77"/><stop offset=".45" stop-color="#DD2A7B"/>
        <stop offset=".75" stop-color="#9537B8"/><stop offset="1" stop-color="#515BD4"/>
      </linearGradient></defs><path fill="url(#igGrad)" d="${P}"/></svg>`;
  }
  if(s.n==="TikTok"){
    return `<svg viewBox="0 0 24 24">
      <path d="${P}" fill="#25F4EE" transform="translate(-1.1 .9)"/>
      <path d="${P}" fill="#FE2C55" transform="translate(1.1 -.9)"/>
      <path d="${P}" fill="#FFFFFF"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24"><path fill="${SOC_COLORS[s.n]||'#EAF2FF'}" d="${P}"/></svg>`;
}
/* scheme gate, same as _template/components/footer-contact.js isHttps —
   entity-encoding cannot stop a scheme. "#" is allowed through as the demo's
   inert placeholder so the default circles keep rendering. */
const socOk = s => s.url==='#' || /^https:\/\//i.test(String(s.url||''));
$('#socials').innerHTML = CONTENT.social.filter(socOk).map(s=>`
  <a class="soc" href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.n)}" title="${esc(s.n)}">${socIcon(s)}</a>`).join('');

/* ---------- section visibility toggles ---------- */
const _showBk = !(CONTENT.settings && CONTENT.settings.showBooking===false);
const _bk=document.getElementById('book'); if(_bk) _bk.style.display=_showBk?'':'none';
document.querySelectorAll('a[href="#book"]').forEach(a=>{ a.style.display=_showBk?'':'none'; });

if(CONTENT.portraitUrl){ const _p=$('#portrait'); if(_p){ _p.innerHTML='<img src="'+esc(CONTENT.portraitUrl)+'" alt="" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:2">'; } }
} /* ---------- end renderAll ---------- */

/* ---------- release grid (cover art matched in from gallery-manifest.json once it loads; see buildCoverMap below) ---------- */
let releaseCoverMap = new Map();
function renderReleaseGrid(){
  $('#releaseGrid').innerHTML = CONTENT.releases.map(r=>{
    const cover = releaseCoverMap.get(normTitle(r.t));
    const art = cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : '';
    return `
  <a class="release" href="${esc(r.url)}" target="_blank" rel="noopener">
    <div class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
    <div class="art" style="background:linear-gradient(150deg,${esc(r.c1)},${esc(r.c2)})">${art}<span${cover?' class="has-cover"':''}>${esc(r.t)}</span></div>
    <div class="yr">${esc(r.y)}</div><h4>${esc(r.t)}</h4>
  </a>`;
  }).join('');
}

/* ---------- merch (manually curated in content.json — no product API) ---------- */
function renderMerchGrid(){
  const grid=$('#merchGrid'); if(!grid) return;
  const items = CONTENT.merch || [];
  const storeUrl = String((CONTENT.links && CONTENT.links.merchUrl) || '').trim();
  const sec = document.getElementById('merch');
  const show = !!(items.length || storeUrl);
  if(sec) sec.style.display = show ? '' : 'none';
  document.querySelectorAll('a[href="#merch"]').forEach(a=>{ a.style.display = show ? '' : 'none'; });
  if(!show) return;
  if(!items.length){
    grid.innerHTML = `<div class="merch-empty">
      <p>New merch drops soon — for now, shop the full store.</p>
      <a class="btn btn-primary" href="${esc(storeUrl)}" target="_blank" rel="noopener">Shop the store →</a>
    </div>`;
    return;
  }
  grid.innerHTML = items.map(m=>`
  <div class="merch-card">
    <div class="shot">${m.image?`<img src="${esc(m.image)}" alt="" loading="lazy" decoding="async">`:''}</div>
    <h4>${esc(m.name||'')}</h4>
    <div class="price">${esc(m.price||'')}</div>
    ${(m.streamlabsUrl||storeUrl)?`<a class="btn btn-primary" href="${esc(m.streamlabsUrl||storeUrl)}" target="_blank" rel="noopener">Shop Now →</a>`:''}
  </div>`).join('');
}

/* ---------- music embeds (Spotify / SoundCloud, set in admin Settings) ---------- */
const THEME_PRIMARY = '#3D8BFF';
function renderEmbeds(){
  const L = CONTENT.links || {};
  const wrapEl = document.getElementById('embeds');
  const sp = document.getElementById('spotifyEmbed'), sc = document.getElementById('soundcloudEmbed');
  if(!wrapEl || !sp || !sc) return;
  const spId = (String(L.spotifyArtistUrl||'').match(/artist\/([A-Za-z0-9]+)/)||[])[1] || '';
  if(spId){
    sp.hidden = false;
    sp.innerHTML = `<iframe loading="lazy" title="Spotify player" src="https://open.spotify.com/embed/artist/${spId}?utm_source=generator&theme=0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  } else { sp.hidden = true; sp.innerHTML=''; }
  const scUrl = String(L.soundcloudUrl||'').trim();
  const scOk = /^https:\/\/(www\.)?soundcloud\.com\/.+/.test(scUrl);
  if(scOk){
    sc.hidden = false;
    sc.innerHTML = `<iframe loading="lazy" title="SoundCloud player" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(scUrl)}&color=%23${THEME_PRIMARY.slice(1)}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=true"></iframe>`;
  } else { sc.hidden = true; sc.innerHTML=''; }
  const n = (spId?1:0)+(scOk?1:0);
  wrapEl.style.display = n ? '' : 'none';
  wrapEl.style.gridTemplateColumns = n===2 ? '' : '1fr';
}

/* ---------- outbound links (Bandsintown / merch store / YouTube CTAs) ---------- */
function renderLinks(){
  const L = CONTENT.links || {}, Y = CONTENT.youtube || {};
  const bit = String(L.bandsintownUrl||'').trim();
  ['showsBtn','showsFoot'].forEach(id=>{
    const el = document.getElementById(id); if(!el) return;
    el.style.display = bit ? '' : 'none';
    if(bit) el.href = bit;
  });
  const mb = document.getElementById('merchStoreBtn');
  const mu = String(L.merchUrl||'').trim();
  if(mb){ mb.style.display = mu ? '' : 'none'; if(mu) mb.href = mu; }
  const cu = String(Y.channelUrl||'').trim();
  const sub = document.getElementById('ytSubscribe');
  if(sub){ sub.style.display = cu ? '' : 'none'; if(cu) sub.href = cu; }
  const cid = String(Y.channelId||'').trim();
  const mus = document.getElementById('ytMusic');
  if(mus){ mus.style.display = cid ? '' : 'none'; if(cid) mus.href = 'https://music.youtube.com/channel/'+cid.replace(/^UU/,'UC'); }
}

/* ============================================================
   YOUTUBE LIBRARY — pulls the channel's uploads straight from the
   YouTube Data API using the key + channel ID saved in the admin
   Settings tab. RSS fallback if the API fails; CTA-only if both do.
   ============================================================ */
const YT = { all:[], visible:9, sort:'newest', query:'', activeId:null, ready:false, coverMap:new Map() };

function normTitle(s){
  return (s||'').toLowerCase()
    .replace(/\(feat\.[^)]*\)/g,' ')
    .replace(/\bfeat\.[^-|]*/g,' ')
    .replace(/\b(official\s*)?(audio|video|lyric video|lyrics|visualizer|music video)\b/g,' ')
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .trim().replace(/\s+/g,' ');
}
function escYt(s){ return (s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function extractYtId(raw){
  if(!raw) return '';
  raw = String(raw).trim();
  if(/^[\w-]{11}$/.test(raw)) return raw;
  const m = raw.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? m[1] : '';
}
function fmtViews(n){
  if(!n) return '';
  if(n>=1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'')+'M views';
  if(n>=1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'K views';
  return n+' view'+(n===1?'':'s');
}
function fmtAgo(iso){
  if(!iso) return '';
  const secs=(Date.now()-new Date(iso).getTime())/1000;
  const units=[['yr',31536000],['mo',2592000],['wk',604800],['day',86400],['hr',3600],['min',60]];
  for(const [label,unitSecs] of units){ const v=Math.floor(secs/unitSecs); if(v>=1) return `${v} ${label}${v>1?'s':''} ago`; }
  return 'just now';
}

const galleryManifestPromise = fetch('gallery-manifest.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]).catch(()=>[]);
async function buildCoverMap(){
  const manifest = await galleryManifestPromise;
  const map = new Map();
  (Array.isArray(manifest)?manifest:[]).forEach(m=>{ if(m && m.title && m.image_file) map.set(normTitle(m.title), m.image_file); });
  return map;
}
function logUnmatchedTitles(){
  const unmatched = YT.all.filter(v=>!YT.coverMap.has(normTitle(v.title)));
  if(unmatched.length){
    console.groupCollapsed(`[YouTube Library] ${unmatched.length} video title(s) unmatched to gallery-manifest.json`);
    unmatched.forEach(v=>console.info(v.title));
    console.groupEnd();
  }
}

function parseYouTubeRSS(xml){
  const doc = new DOMParser().parseFromString(xml,'application/xml');
  return Array.from(doc.getElementsByTagNameNS('*','entry')).map(entry=>{
    const get=(tag)=>{ const el=entry.getElementsByTagNameNS('*',tag)[0]; return el?el.textContent:''; };
    const id = get('videoId');
    const thumbEl = entry.getElementsByTagNameNS('*','thumbnail')[0];
    const thumb = thumbEl ? thumbEl.getAttribute('url') : (id?`https://i.ytimg.com/vi/${id}/hqdefault.jpg`:'');
    return { id, title:get('title'), publishedAt:get('published')||null, duration:'', views:0, thumb:{medium:thumb,high:thumb} };
  }).filter(v=>v.id);
}

function currentFeaturedVideo(){
  if(YT.activeId){ const m=YT.all.find(v=>v.id===YT.activeId); if(m) return m; }
  const override = extractYtId(CONTENT.settings && CONTENT.settings.featuredVideoId);
  if(override){ const m=YT.all.find(v=>v.id===override); if(m) return m; }
  return YT.all[0];
}

function renderYtFeatured(video){
  const el=$('#ytFeatured'); if(!el || !video) return;
  el.classList.remove('playing');
  el.dataset.id = video.id;
  const thumb = (video.thumb && (video.thumb.maxres||video.thumb.high||video.thumb.medium)) || '';
  el.innerHTML = `
    <img src="${escYt(thumb)}" alt="" loading="eager" onerror="this.style.display='none'">
    <button class="pbtn" type="button" aria-label="Play ${escYt(video.title)}">
      <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    </button>
    <div class="yt-meta"><h4>${escYt(video.title)}</h4><p>${fmtAgo(video.publishedAt)}${video.views?' · '+fmtViews(video.views):''}</p></div>`;
  el.querySelector('.pbtn').addEventListener('click', ()=>playFeatured(video));
}

function playFeatured(video){
  const el=$('#ytFeatured'); if(!el) return;
  el.classList.add('playing');
  el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${extractYtId(video.id)}?autoplay=1&rel=0" title="${escYt(video.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  YT.activeId = video.id;
}

function filteredSortedVideos(){
  const q = YT.query.trim().toLowerCase();
  let list = YT.all.filter(v=> !q || v.title.toLowerCase().includes(q));
  list = list.slice();
  if(YT.sort==='views') list.sort((a,b)=> (b.views||0)-(a.views||0));
  else list.sort((a,b)=> new Date(b.publishedAt||0) - new Date(a.publishedAt||0));
  return list;
}

function renderYtGrid(){
  const list = filteredSortedVideos();
  const shown = list.slice(0, YT.visible);
  const grid=$('#ytGrid'), empty=$('#ytEmpty'), more=$('#ytMore');
  if(!list.length){
    grid.innerHTML=''; empty.hidden=false; empty.textContent='No videos match your search.'; more.hidden=true; return;
  }
  empty.hidden=true;
  grid.innerHTML = shown.map(v=>{
    const cover = YT.coverMap.get(normTitle(v.title));
    const thumb = (v.thumb && (v.thumb.medium||v.thumb.high)) || '';
    return `<button class="yt-card" type="button" data-id="${escYt(v.id)}">
      <div class="thumb">
        <img src="${escYt(thumb)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">
        ${v.duration?`<span class="dur">${v.duration}</span>`:''}
        ${cover?`<span class="cover-badge">Single available</span>`:''}
      </div>
      <h5>${escYt(v.title)}</h5>
      <p class="yt-sub"><span>${fmtAgo(v.publishedAt)}</span>${v.views?`<span>${fmtViews(v.views)}</span>`:''}</p>
    </button>`;
  }).join('');
  more.hidden = list.length <= YT.visible;
  grid.querySelectorAll('.yt-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      const v = YT.all.find(x=>x.id===card.dataset.id);
      if(!v) return;
      renderYtFeatured(v);
      playFeatured(v);
      $('#ytFeatured').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
    });
  });
}

function bindYtControls(){
  if(window.__ytControlsBound) return; window.__ytControlsBound=true;
  $('#ytSearch').addEventListener('input', e=>{ YT.query=e.target.value; YT.visible=9; renderYtGrid(); });
  $('#ytSort').addEventListener('change', e=>{ YT.sort=e.target.value; YT.visible=9; renderYtGrid(); });
  $('#ytMore').addEventListener('click', ()=>{ YT.visible+=9; renderYtGrid(); });
}

function renderYtUnavailable(){
  $('#ytFeatured').innerHTML = '';
  $('#ytGrid').innerHTML = '';
  const empty=$('#ytEmpty');
  empty.hidden=false;
  const cu=String((CONTENT.youtube&&CONTENT.youtube.channelUrl)||'').trim();
  empty.innerHTML = cu
    ? 'Videos are taking a breather — <a href="'+esc(cu)+'" target="_blank" rel="noopener" style="color:var(--gold)">watch on YouTube</a> in the meantime.'
    : 'Connect your YouTube channel in the admin panel (Settings tab) and your videos will appear here automatically.';
  $('#ytMore').hidden=true;
  const controls=document.querySelector('.yt-controls'); if(controls) controls.hidden=true;
}

function fmtDuration(iso){
  const m=/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso||'');
  if(!m) return '';
  const h=+(m[1]||0), mi=+(m[2]||0), s=+(m[3]||0), ss=String(s).padStart(2,'0');
  return h>0 ? h+':'+String(mi).padStart(2,'0')+':'+ss : mi+':'+ss;
}
async function ytApi(key,path,params){
  const url=new URL('https://www.googleapis.com/youtube/v3/'+path);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  url.searchParams.set('key',key);
  const r=await fetch(url);
  if(!r.ok) throw new Error('YouTube API '+r.status);
  return r.json();
}
async function fetchYtLibrary(key,channelId){
  const uploads=channelId.replace(/^UC/,'UU');
  let ids=[], pageToken='', pages=0;
  do{
    const page=await ytApi(key,'playlistItems',Object.assign(
      {part:'contentDetails',playlistId:uploads,maxResults:'50'},
      pageToken?{pageToken}:{}));
    (page.items||[]).forEach(it=>{ const id=it.contentDetails&&it.contentDetails.videoId; if(id) ids.push(id); });
    pageToken=page.nextPageToken||''; pages++;
  }while(pageToken && pages<8);
  const videos=[];
  for(let i=0;i<ids.length;i+=50){
    const page=await ytApi(key,'videos',{part:'snippet,statistics,contentDetails,status',id:ids.slice(i,i+50).join(',')});
    (page.items||[]).forEach(v=>{
      const st=v.status||{};
      if(st.privacyStatus!=='public') return;
      if(st.uploadStatus && st.uploadStatus!=='processed') return;
      const th=(v.snippet&&v.snippet.thumbnails)||{};
      videos.push({
        id:v.id,
        title:(v.snippet&&v.snippet.title)||'',
        publishedAt:(v.snippet&&v.snippet.publishedAt)||null,
        duration:fmtDuration(v.contentDetails&&v.contentDetails.duration),
        views:Number((v.statistics&&v.statistics.viewCount)||0),
        thumb:Object.assign(
          {medium:(th.medium&&th.medium.url)||(th.default&&th.default.url)||'',
           high:(th.high&&th.high.url)||(th.medium&&th.medium.url)||''},
          th.maxres?{maxres:th.maxres.url}:{})
      });
    });
  }
  videos.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
  return videos;
}
async function loadYouTubeLibrary(){
  const grid=$('#ytGrid');
  grid.innerHTML = Array.from({length:6}).map(()=>'<div class="yt-card"><div class="thumb yt-skel"></div></div>').join('');
  const Y=CONTENT.youtube||{};
  const key=String(Y.apiKey||'').trim();
  const cid=String(Y.channelId||'').trim().replace(/^UU/,'UC');
  let videos=[];
  if(key && cid){
    try{ videos=await fetchYtLibrary(key,cid); }
    catch(e){ console.warn('[YouTube] API load failed:', e.message||e); }
  }
  if(false){   /* RSS-via-proxy fallback removed — see brief.md */
    try{
      const rss=await fetch('https://api.allorigins.win/raw?url='+encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id='+cid))
        .then(r=> r.ok ? r.text() : Promise.reject(new Error('rss failed')));
      videos=parseYouTubeRSS(rss);
    }catch(e2){}
  }
  if(!videos.length){ renderYtUnavailable(); return; }
  YT.all=videos;
  YT.coverMap = await buildCoverMap();
  YT.ready = true;
  bindYtControls();
  renderYtFeatured(currentFeaturedVideo());
  renderYtGrid();
  const controls=document.querySelector('.yt-controls'); if(controls) controls.hidden=false;
}

$('#yr').textContent = new Date().getFullYear();

/* paint with defaults immediately, then swap in live content.json (edited via /admin) */
/* boot handed to base.js */
buildCoverMap().then(map=>{ releaseCoverMap=map; renderReleaseGrid(); });

/* ============================================================ NAV behaviour */
const nav=$('#nav'), burger=$('#burger'), navLinks=$('#navLinks');
addEventListener('scroll',()=>nav.classList.toggle('scrolled', scrollY>40));
burger.addEventListener('click',()=>{
  const open=navLinks.classList.toggle('open');
  burger.setAttribute('aria-expanded',open);
});
navLinks.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
  navLinks.classList.remove('open'); burger.setAttribute('aria-expanded',false);
}));

/* ============================================================ scroll reveal */
const io=new IntersectionObserver((es)=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} }),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* ============================================================ magnetic buttons — desktop fine-pointer only, respects reduced motion */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer:fine)').matches) return;
  document.querySelectorAll('.btn').forEach(btn=>{
    btn.addEventListener('mousemove', e=>{
      const r=btn.getBoundingClientRect();
      const x=e.clientX-r.left-r.width/2, y=e.clientY-r.top-r.height/2;
      btn.style.transform=`translateY(${-3+y*0.25}px) translateX(${x*0.15}px)`;
    });
    btn.addEventListener('mouseleave', ()=>{ btn.style.transform=''; });
  });
})();

/* ---------- full bio expander ---------- */
(function(){
  const t=$('#bioToggle'), f=$('#bioFull'); if(!t||!f) return;
  t.addEventListener('click',()=>{
    const open=f.classList.toggle('open');
    t.setAttribute('aria-expanded',open);
    t.querySelector('.bt-label').textContent = open ? 'Show less' : 'Read the full story';
  });
})();

/* ============================================================ BOOKING calendar */
const calDays=$('#calDays'), calLabel=$('#calLabel'), calSel=$('#calSelected'), dateInput=$('#bDate');
let view=new Date(); view.setDate(1);
const today=new Date(); today.setHours(0,0,0,0);
let selected=null;
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
function renderCal(){
  calLabel.textContent = `${MON[view.getMonth()]} ${view.getFullYear()}`;
  const start=view.getDay(), days=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
  let html='';
  for(let i=0;i<start;i++) html+='<button class="cal-day empty" disabled tabindex="-1"></button>';
  for(let d=1;d<=days;d++){
    const date=new Date(view.getFullYear(),view.getMonth(),d);
    const past=date<today;
    const isSel=selected && date.getTime()===selected.getTime();
    html+=`<button class="cal-day${isSel?' sel':''}" data-d="${d}" ${past?'disabled':''}>${d}</button>`;
  }
  calDays.innerHTML=html;
  calDays.querySelectorAll('.cal-day:not(.empty):not([disabled])').forEach(b=>b.addEventListener('click',()=>{
    selected=new Date(view.getFullYear(),view.getMonth(),+b.dataset.d);
    const txt=selected.toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'});
    calSel.textContent=txt; dateInput.value=txt;
    renderCal();
  }));
}
$('#calPrev').addEventListener('click',()=>{ view.setMonth(view.getMonth()-1); renderCal(); });
$('#calNext').addEventListener('click',()=>{ view.setMonth(view.getMonth()+1); renderCal(); });
renderCal();

/* ============================================================ BOOKING submit (front-end simulation) */
$('#bookForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  const f=e.target, name=f.name.value.trim(), email=f.email.value.trim();
  const msg=$('#bookMsg');
  if(!name||!email||!dateInput.value){
    msg.className='book-msg show';
    msg.innerHTML=`<h4>Almost there</h4><p>Add your name, email, and pick a date on the calendar so we can get back to you.</p>`;
    msg.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  msg.className='book-msg show';
  SL.postForm(CONTENT.brand.leadEmail, { name: name, email: email,
    date: dateInput.value, type: f.type.value });
  msg.innerHTML=`
    <h4>Request sent ✦</h4>
    <p>Thanks, ${escYt(name.split(' ')[0])} — this demo just previewed a <b>${escYt(f.type.value)}</b> request for <b>${escYt(dateInput.value)}</b>. On your live site, this request goes straight to your inbox.</p>
    <p class="auto">Demo form — no email was sent and nothing was booked. The live version connects to your email or booking service.</p>`;
  msg.scrollIntoView({behavior:'smooth',block:'center'});
  f.querySelectorAll('input,textarea').forEach(i=>{ if(i.type!=='submit') i.value=''; });
  dateInput.value=''; calSel.textContent='— pick a date —'; selected=null; renderCal();
});

/* ============================================================ HERO canvas: rising embers + live music waveform
   A beat-driven audio visualizer: bass bars (left) move slow & heavy and slam on
   each kick; treble bars (right) flicker fast; a traveling sweep moves energy across
   like a track playing; the waveform mirrors as a reflection on the gold horizon. */
(function(){

  /* signature animation extracted to scene.js */

})();

/* ============================================================ HERO parallax stars + aurora sweep (scroll-synced, additive over the canvas above) */
(function(){
  const hero=$('.hero'), stars=document.querySelectorAll('.hero-stars .layer'), aurora=$('.hero-aurora');
  if(!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let ticking=false;
  function update(){
    ticking=false;
    const rect=hero.getBoundingClientRect();
    const progress=Math.min(1, Math.max(0, -rect.top/(rect.height||1)));
    stars.forEach((layer,i)=>{ layer.style.transform=`translateY(${progress*(24+i*36)}px)`; });
    if(aurora){ aurora.style.opacity=String(.55*(1-progress*.8)); aurora.style.setProperty('--aurora-x',`${50+progress*18}%`); }
  }
  addEventListener('scroll',()=>{ if(!ticking){ ticking=true; requestAnimationFrame(update); } }, {passive:true});
  update();
})();

  window.renderContent = renderAll;
})();
