/* plumbing/niche.js — this niche's renderer and interactive logic.
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

var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =====================================================
   OWNER-EDITABLE CONTENT
   DEFAULT_CONTENT ships with the page and renders
   immediately. content.json (repo root, edited from
   /admin/) is fetched at runtime and merged over it.
   Keep content.json's shape in sync with this const.
   ===================================================== */
/* Lead delivery — no backend. FormSubmit needs no account, but the FIRST real
   submission emails an activation link to LEAD.email; click it once and
   every quote request after that lands in that inbox, formatted as a table. */
var LEAD = { provider: 'formsubmit', email: '', sms: '' };

/* Shared quote/paren stripper for anything interpolated into an img src
   attribute — symmetric with bin-cleaning/niche.js's safeUrl(). */
function safeUrl(u){ return String(u || '').replace(/["\\)]/g, ''); }

var SVC_ICONS = {
  leak: '<path d="M12 2c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
  heater: '<rect x="7" y="3" width="10" height="18" rx="3"/><path d="M10 8h4M10 12h4M10 16h4"/>',
  repipe: '<path d="M4 8h6a3 3 0 0 1 3 3v2a3 3 0 0 0 3 3h4M4 16h6a3 3 0 0 0 3-3"/>',
  drain: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>',
  fixture: '<path d="M6 10h12M8 10V6a4 4 0 0 1 8 0v4M6 14h12l-1 6H7z"/>',
  emergency: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>'
};


function applyRuntime(c){
  LEAD.email = (c.brand||{}).leadEmail || LEAD.email;
  LEAD.sms = telHref((c.brand||{}).phone);
}
applyRuntime(CONTENT);

/* ---------- render ---------- */
function renderContent(c){
  var b = c.brand || {};
  document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = b.name || ''; });
  document.querySelectorAll('[data-tagline]').forEach(function(el){ el.textContent = b.tagline || ''; });
  var eyebrowSub = document.querySelector('[data-eyebrow-sub]');
  if(eyebrowSub) eyebrowSub.textContent = 'Leak repair, water heaters, repiping, drains and emergency calls across the ' + ((c.serviceArea||{}).short || 'Treasure Valley') + ' — quoted before we start, fixed by the person who quoted it.';

  var telH = telHref(b.phone);
  document.querySelectorAll('[data-phone-tel]').forEach(function(el){
    if(el.tagName === 'A') el.setAttribute('href', 'tel:' + telH);
    if(el.textContent && /^\(\d{3}\)/.test(el.textContent.trim())) el.textContent = b.phone || '';
  });
  var fe = document.getElementById('footEmail');
  if(fe){ fe.href = 'mailto:' + (b.email||''); fe.textContent = b.email || ''; }
  var qSms = document.getElementById('qSms');
  if(qSms) qSms.href = 'sms:' + telH;

  // hero stats
  var hs = document.getElementById('heroStats');
  if(hs) hs.innerHTML = (c.stats||[]).map(function(s){ return '<div class="hstat"><b>'+esc(s.num)+'</b><span>'+esc(s.label)+'</span></div>'; }).join('');

  // services
  var sg = document.getElementById('svcGrid');
  if(sg) sg.innerHTML = (c.services||[]).map(function(s){
    return '<div class="scard reveal in"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">'+(SVC_ICONS[s.icon]||SVC_ICONS.leak)+'</svg></div><h3>'+esc(s.title)+'</h3><p>'+esc(s.desc)+'</p></div>';
  }).join('');

  // pricing
  var pg = document.getElementById('priceGrid');
  if(pg) pg.innerHTML = (c.pricing||[]).map(function(p){
    var feat = p.featured ? ' feat' : '';
    var pill = p.featured ? '<span class="pill">Most common</span>' : '';
    var items = String(p.features||'').split('\n').filter(Boolean).map(function(f){ return '<li><svg viewBox="0 0 24 24"><path d="M4 12l6 6L20 6"/></svg>'+esc(f)+'</li>'; }).join('');
    return '<div class="pcard'+feat+'">'+pill+'<div class="lbl">'+esc(p.label)+'</div><div class="price">'+esc(p.price)+'</div><span class="per">'+esc(p.per)+'</span><ul>'+items+'</ul></div>';
  }).join('');

  // service area
  var ac = document.getElementById('areaChips');
  if(ac) ac.innerHTML = ((c.serviceArea||{}).cities||[]).map(function(city){ return '<span class="achip">'+esc(city)+'</span>'; }).join('');
  var footServe = document.getElementById('footServe');
  if(footServe) footServe.textContent = 'Serving ' + ((c.serviceArea||{}).cities||[]).join(' · ');

  // owner
  var oName = document.getElementById('ownerName'), oBio = document.getElementById('ownerBio');
  if(oName) oName.textContent = (c.owner||{}).name || '';
  if(oBio) oBio.textContent = (c.owner||{}).bio || '';
  var oPhoto = document.getElementById('ownerPhoto');
  if(oPhoto && (c.owner||{}).photo){
    oPhoto.innerHTML = '<img src="' + safeUrl((c.owner||{}).photo) + '" alt="' + esc((c.owner||{}).name || 'The owner') + '" loading="lazy">';
  }

  // testimonials
  var tg = document.getElementById('tGrid');
  if(tg) tg.innerHTML = (c.testimonials||[]).map(function(t){
    var quote = t.quote ? esc(t.quote) : 'Real review coming soon.';
    var name = t.name ? '<div class="tname">'+esc(t.name)+'</div>' : '';
    return '<div class="tcard"><q>'+quote+'</q>'+name+'</div>';
  }).join('');

  // faq
  var fl = document.getElementById('faqList');
  if(fl) fl.innerHTML = (c.faq||[]).map(function(f, i){
    return '<details class="qa"'+(i===0?' open':'')+'><summary>'+esc(f.q)+'<span class="pm">+</span></summary><div class="ans">'+esc(f.a)+'</div></details>';
  }).join('');

  // drip calculator config
  window.__dripCfg = c.dripCalc || DEFAULT_CONTENT.dripCalc;
  var dripNote = document.getElementById('dripNote');
  if(dripNote && window.__dripCfg.note) dripNote.textContent = window.__dripCfg.note;
  updateDrip();

  revealScan(document);
}

/* boot handed to base.js */

// ---------- year ----------
var yr = document.getElementById('yr');
if(yr) yr.textContent = new Date().getFullYear();

// ---------- nav solidify ----------
var navEl = document.getElementById('nav');
var onScroll = function(){ navEl.classList.toggle('solid', window.scrollY > 30); };
onScroll(); window.addEventListener('scroll', onScroll, {passive:true});

// ---------- reveal on scroll (re-armed for JS-rendered nodes) ----------
var io = null;
function revealScan(root){
  var nodes = root.querySelectorAll('.reveal:not(.in)');
  if(reduce || !('IntersectionObserver' in window)){
    nodes.forEach(function(el){ el.classList.add('in'); });
    return;
  }
  if(!io){
    io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  }
  nodes.forEach(function(el){ io.observe(el); });
}
revealScan(document);

// ---------- ambient droplet particles ----------
(function(){
  if(reduce) return;
  var host = document.getElementById('heroSection');
  if(!host) return;
  var count = window.innerWidth < 700 ? 7 : 14;
  for(var i=0;i<count;i++){
    var d = document.createElement('span');
    d.className = 'droplet';
    var size = 6 + Math.random()*8;
    d.style.width = size+'px'; d.style.height = size+'px';
    d.style.left = Math.random()*100+'%';
    d.style.animationDuration = (6 + Math.random()*6)+'s';
    d.style.animationDelay = (-Math.random()*10)+'s';
    d.style.opacity = (.2 + Math.random()*.4).toFixed(2);
    host.appendChild(d);
  }
})();

// ---------- drip calculator ----------
var dripSlider = document.getElementById('dripSlider');
function updateDrip(){
  if(!dripSlider) return;
  var cfg = window.__dripCfg || DEFAULT_CONTENT.dripCalc;
  var rate = Number(dripSlider.value); // drops per minute
  var mlPerDay = rate * cfg.mlPerDrop * 60 * 24;
  var galPerMonth = (mlPerDay * 30) / 3785.41;
  var dollars = galPerMonth * cfg.costPerGallon;

  var label = 'Slow drip';
  if(rate >= 70) label = 'Thin stream';
  else if(rate >= 30) label = 'Steady drip';

  var lblEl = document.getElementById('dripRateLabel');
  var numEl = document.getElementById('dripRateNum');
  var galEl = document.getElementById('dripGallons');
  var dolEl = document.getElementById('dripDollars');
  if(lblEl) lblEl.textContent = label;
  if(numEl) numEl.textContent = rate + ' drops / min';
  if(galEl) galEl.textContent = galPerMonth.toFixed(1) + ' gal';
  if(dolEl) dolEl.textContent = '$' + dollars.toFixed(2);

  // feed the current drip rate to the gravity drop physics below (visual only)
  window.__dripRate = rate;
}
if(dripSlider){
  dripSlider.addEventListener('input', updateDrip);
  updateDrip();
}


  /* signature animation extracted to scene.js */


// ---------- emergency / scheduled mode toggle ----------
(function(){
  var btnSched = document.getElementById('modeScheduled');
  var btnEmerg = document.getElementById('modeEmergency');
  var note = document.getElementById('modeNote');
  var msgField = document.getElementById('qMsg');
  if(!btnSched || !btnEmerg) return;
  function setMode(emergency){
    btnSched.classList.toggle('active', !emergency);
    btnEmerg.classList.toggle('active', emergency);
    btnSched.setAttribute('aria-selected', String(!emergency));
    btnEmerg.setAttribute('aria-selected', String(emergency));
    note.classList.toggle('emergency', emergency);
    note.textContent = emergency
      ? "For a true emergency, calling or texting is faster than this form — we'll still get this message, but the phone line rings first."
      : "We'll reach out to find a time that works — usually within one business day.";
    if(msgField) msgField.placeholder = emergency ? "Pipe burst under the sink, water's spreading..." : "Leaking under the kitchen sink, started this morning...";
  }
  btnSched.addEventListener('click', function(){ setMode(false); });
  btnEmerg.addEventListener('click', function(){ setMode(true); });
})();

// ---------- quote form (FormSubmit + sms fallback) ----------
(function(){
  var form = document.getElementById('quoteForm');
  if(!form) return;
  var status = document.getElementById('qStatus');
  var success = document.getElementById('qSuccess');
  var successMsg = document.getElementById('qSuccessMsg');
  var btn = document.getElementById('qSubmit');

  var val = function(id){ var el = document.getElementById(id); return el ? (el.value||'').trim() : ''; };
  var setErr = function(el, on){ var row = el && el.closest('.f-row'); if(row) row.classList.toggle('invalid', !!on); };

  form.addEventListener('submit', function(e){
    e.preventDefault();
    status.textContent = ''; status.classList.remove('err');

    var name = val('qName'), phone = val('qPhone'), msg = val('qMsg');
    var ok = true;
    setErr(document.getElementById('qName'), !name); if(!name) ok = false;
    setErr(document.getElementById('qPhone'), !phone); if(!phone) ok = false;
    setErr(document.getElementById('qMsg'), !msg); if(!msg) ok = false;
    if(!ok){ status.textContent = 'Please fill in name, phone and what\'s going on.'; status.classList.add('err'); return; }

    if(form.querySelector('.hp').value){ return; } // honeypot tripped, silently drop

    btn.disabled = true; btn.textContent = 'Sending…';
    var payload = {
      name: name, phone: phone, city: val('qCity') || '(not given)', message: msg,
      _subject: 'Cascade & Copper — quote request',
      _template: 'table', _captcha: 'false'
    };
    fetch('https://formsubmit.co/ajax/' + LEAD.email, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(payload)
    }).then(function(r){ return r.json(); }).then(function(res){
      if(res && (res.success === 'true' || res.success === true)){
        form.hidden = true;
        successMsg.textContent = "We'll call or text " + phone + " shortly.";
        success.hidden = false;
        success.style.display = 'block';
        success.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'center'});
        if(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)){
          setTimeout(function(){
            window.location.href = 'sms:' + LEAD.sms + '?body=' + encodeURIComponent('Hi Cascade & Copper, following up on my quote request — ' + name);
          }, 900);
        }
      } else { throw new Error('formsubmit rejected'); }
    }).catch(function(){
      status.textContent = "Hmm — that didn't go through. Text us at " + (CONTENT.brand.phone||'') + ' instead.';
      status.classList.add('err');
      btn.disabled = false; btn.textContent = 'Send it →';
    });
  });
})();

// ---------- desktop sms:/tel: guard (avoids Windows "pick an app" dialog) ----------
(function(){
  var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(isMobile) return;
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href^="sms:"], a[href^="tel:"]');
    if(!a) return;
    e.preventDefault();
    var toast = document.getElementById('phoneToast');
    if(!toast) return;
    toast.textContent = 'Call or text: ' + (CONTENT.brand.phone || '');
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function(){ toast.classList.remove('show'); }, 3200);
  });
})();

  window.renderContent = renderContent;
})();
