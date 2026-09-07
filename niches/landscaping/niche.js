/* landscaping/niche.js — this niche's renderer and interactive logic.
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
     /admin/) is fetched at runtime and merged over it —
     the season wheel, plans grid, booking form, footer,
     FAQ and owner section all re-render from the merged
     object. Keep content.json's shape in sync with this
     const. (Static copy the admin does NOT touch: the
     JSON-LD offers/priceRange in <head> and the meta
     description.)
     ===================================================== */
/* Lead delivery — no backend. FormSubmit needs no account, but the FIRST real
     submission emails a one-time activation link to LEAD.email; click it once and
     every booking after that lands in that inbox, formatted as a table. */
  var LEAD = { provider: 'formsubmit', email: '', sms: '' };

  function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

  function applyRuntime(c){
    LEAD.email = (c.brand||{}).leadEmail || LEAD.email;
    LEAD.sms = telHref((c.brand||{}).phone);
  }
  applyRuntime(CONTENT);

  // ---------- year ----------
  document.getElementById('yr').textContent = new Date().getFullYear();

  // ---------- nav solidify ----------
  var nav = document.getElementById('nav');
  var onScroll = function(){ nav.classList.toggle('solid', window.scrollY > 30); };
  onScroll(); window.addEventListener('scroll', onScroll, {passive:true});

  // ---------- reveal on scroll (re-armable for JS-injected nodes) ----------
  var io = null;
  if('IntersectionObserver' in window && !reduce){
    io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
  }
  function revealScan(root){
    var nodes = (root || document).querySelectorAll('.reveal:not(.in)');
    if(io){ nodes.forEach(function(n){ io.observe(n); }); }
    else { nodes.forEach(function(n){ n.classList.add('in'); }); }
  }
  revealScan(document);

  // ---------- drifting pollen motes in hero ----------
  var motes = document.getElementById('motes');
  if(motes && !reduce){
    var n = window.innerWidth < 700 ? 8 : 16;
    for(var i=0;i<n;i++){
      var m = document.createElement('span');
      m.className = 'mote';
      m.style.left = Math.random()*100 + '%';
      var dur = 9 + Math.random()*10;
      m.style.animationDuration = dur + 's';
      m.style.animationDelay = (-Math.random()*dur) + 's';
      m.style.opacity = 0.25 + Math.random()*0.5;
      var s = 2.5 + Math.random()*3;
      m.style.width = s + 'px'; m.style.height = s + 'px';
      motes.appendChild(m);
    }
  }

  /* =====================================================
     SIGNATURE — SEASON WHEEL
     ===================================================== */
  var TAB_ICONS = {
    spring: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4-2 7-6 7-11a7 7 0 0 0-14 0c0 5 3 9 7 11Z"/><path d="M12 11v6"/></svg>',
    summer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
    fall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3 3 3 6 1 8 2 0 4 1 5 3-3 1-6 0-7-2 0 3-1 6-3 8-1-3-1-6 1-8-2 0-4-1-5-3 3-1 6 0 7 2 0-3 1-6 1-8Z"/></svg>',
    winter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M4 7l16 10M20 7L4 17"/></svg>'
  };
  var SEASON_COLORS = {
    spring: { foliage: '#5f7a52', ground: '#3a4f36', sky: '#9c93ff' },
    summer: { foliage: '#3d6b3f', ground: '#2a4a2c', sky: '#f2c94c' },
    fall:   { foliage: '#9a6a3a', ground: '#5a3f26', sky: '#d98a52' },
    winter: { foliage: '#5b6a63', ground: '#c9d2cd', sky: '#c7d6ff' }
  };

  var wheelTabs = document.getElementById('wheelTabs');
  var wheelBody = document.getElementById('wheelBody');
  var wheelInfo = document.getElementById('wheelInfo');
  var wheelCaption = document.getElementById('wheelCaption');
  var wheelPhoto = document.getElementById('wheelPhoto');
  var yardScene = document.getElementById('yardScene');
  var activeSeason = null;

  function seasonForMonth(seasons, month){
    for(var i=0;i<seasons.length;i++){
      var s = seasons[i], start = num(s.startMonth) || 1;
      for(var k=0;k<3;k++){
        var mm = ((start - 1 + k) % 12) + 1;
        if(mm === month) return s.id;
      }
    }
    return seasons.length ? seasons[0].id : null;
  }

  function priceLabel(svc){
    var p = '$' + num(svc.price);
    if(svc.unit === 'from') return 'from ' + p;
    if(svc.unit === 'per push') return p;
    return p;
  }
  function unitLabel(svc){
    if(svc.unit === 'per push') return 'per push';
    if(svc.unit === 'from') return 'starting price';
    return 'one-time';
  }

  function yardSceneSvg(){
    return '<svg class="yard-scene" viewBox="0 0 400 500" fill="none" role="img" aria-label="Illustration of the yard through the seasons">' +
      '<circle cx="300" cy="90" r="30" fill="var(--sky,#9c93ff)" fill-opacity=".55"/>' +
      '<path class="yard-ground" d="M20 340 H380 L360 420 H40 Z"/>' +
      '<circle class="yard-tree" cx="160" cy="270" r="70"/>' +
      '<circle class="yard-tree" cx="230" cy="250" r="52"/>' +
      '<rect x="185" y="300" width="16" height="70" fill="#4a3a2c"/>' +
      '<g class="yard-blossom">' +
        '<circle cx="120" cy="240" r="5" fill="#F2D9E8"/><circle cx="150" cy="212" r="4.5" fill="#F2D9E8"/>' +
        '<circle cx="188" cy="230" r="5.2" fill="#F2D9E8"/><circle cx="210" cy="200" r="4.2" fill="#F2D9E8"/>' +
        '<circle cx="238" cy="222" r="4.8" fill="#F2D9E8"/>' +
      '</g>' +
      '<g class="yard-leaffall">' +
        '<circle cx="110" cy="330" r="5" fill="#D98A52"/><circle cx="260" cy="350" r="4.4" fill="#C4622E"/>' +
        '<circle cx="200" cy="370" r="4.8" fill="#E0A25E"/><circle cx="150" cy="360" r="4" fill="#C4622E"/>' +
        '<circle cx="300" cy="330" r="4.2" fill="#D98A52"/>' +
      '</g>' +
      '<g class="yard-snow">' +
        '<ellipse cx="160" cy="330" rx="66" ry="14" fill="#F2F0E6" fill-opacity=".85"/>' +
        '<ellipse cx="230" cy="316" rx="48" ry="11" fill="#F2F0E6" fill-opacity=".85"/>' +
        '<rect x="16" y="410" width="368" height="14" rx="4" fill="#F2F0E6" fill-opacity=".7"/>' +
      '</g>' +
      '<rect x="16" y="416" width="368" height="8" rx="3" fill="#26332B"/>' +
      '</svg>';
  }

  function wheelRender(){
    var seasons = CONTENT.seasons || [];
    if(!seasons.length){ wheelTabs.innerHTML = ''; wheelBody.innerHTML = ''; return; }
    if(!seasons.some(function(s){ return s.id === activeSeason; })){
      activeSeason = seasonForMonth(seasons, new Date().getMonth() + 1);
    }
    var season = seasons.filter(function(s){ return s.id === activeSeason; })[0] || seasons[0];

    wheelTabs.innerHTML = seasons.map(function(s){
      var sel = s.id === season.id;
      return '<button type="button" class="tab" data-season-tab="' + esc(s.id) + '" role="tab" aria-selected="' + (sel ? 'true' : 'false') + '">' +
        (TAB_ICONS[s.id] || TAB_ICONS.spring) + esc(s.label) + '<span>' + esc(s.monthRange || '') + '</span></button>';
    }).join('');

    var artHtml;
    if(season.photo){
      artHtml = '<div class="wheel__art"><img src="' + esc(season.photo) + '" alt="' + esc(season.label) + ' at Larkspur & Ledge" loading="lazy" />' +
        '<span class="wheel__caption">' + esc(season.label) + ' · ' + esc(season.monthRange || '') + '</span></div>';
    } else {
      artHtml = '<div class="wheel__art">' + yardSceneSvg() +
        '<span class="wheel__caption">' + esc(season.label) + ' · ' + esc(season.monthRange || '') + '</span></div>';
    }

    var svcHtml = (season.services || []).map(function(svc){
      return '<div class="svc"><div class="svc__body"><div class="svc__name">' + esc(svc.name) + '</div>' +
        '<div class="svc__desc">' + esc(svc.desc || '') + '</div></div>' +
        '<div class="svc__price">' + priceLabel(svc) + '<small>' + esc(unitLabel(svc)) + '</small></div></div>';
    }).join('');

    wheelBody.innerHTML = artHtml +
      '<div class="wheel__info">' +
        '<span class="wheel__range">' + esc(season.monthRange || '') + '</span>' +
        '<p class="wheel__blurb">' + esc(season.blurb || '') + '</p>' +
        '<div class="svc-list">' + svcHtml + '</div>' +
        '<div class="wheel__actions">' +
          '<button class="btn" type="button" id="wheelBook">Request ' + esc(season.label) + ' services</button>' +
          '<a class="wheel__alt" id="wheelSms" href="#">or text us this list</a>' +
        '</div>' +
      '</div>';

    var scene = wheelBody.querySelector('.yard-scene');
    if(scene){
      scene.setAttribute('data-season', season.id);
      var colors = SEASON_COLORS[season.id] || SEASON_COLORS.spring;
      scene.style.setProperty('--scene-foliage', colors.foliage);
      scene.style.setProperty('--scene-ground', colors.ground);
      scene.style.setProperty('--sky', colors.sky);
    }

    var bookBtn = document.getElementById('wheelBook');
    var smsAlt = document.getElementById('wheelSms');
    var summaryLine = (season.services || []).map(function(s){ return s.name + ' (' + priceLabel(s) + ')'; }).join(', ');
    if(smsAlt){
      smsAlt.href = 'sms:' + LEAD.sms + '?body=' + encodeURIComponent(
        "Hi " + CONTENT.brand.name + "! I'd like " + season.label + " services: " + summaryLine);
    }
    if(bookBtn){
      bookBtn.addEventListener('click', function(){
        var svc = document.getElementById('b-service');
        var notes = document.getElementById('b-notes');
        var summary = document.getElementById('b-summary');
        if(svc) svc.value = 'seasonal';
        if(notes) notes.value = "Interested in " + season.label + " services: " + summaryLine + ".";
        if(summary) summary.value = season.label + ' seasonal services — ' + summaryLine;
        document.getElementById('book').scrollIntoView(reduce ? {} : {behavior:'smooth'});
        setTimeout(function(){ document.getElementById('b-name').focus({preventScroll:true}); }, reduce ? 0 : 650);
      });
    }

    revealScan(wheelBody);
  }

  wheelTabs.addEventListener('click', function(e){
    var b = e.target.closest('[data-season-tab]');
    if(!b) return;
    activeSeason = b.getAttribute('data-season-tab');
    wheelRender();
  });

  /* =====================================================
     PLANS (pricing) grid
     ===================================================== */
  var plansGrid = document.getElementById('plansGrid');
  var checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  function plansRender(){
    var plans = CONTENT.plans || [];
    plansGrid.innerHTML = plans.map(function(p, i){
      var feats = (p.features || []).map(function(f){ return '<li>' + checkSvg + '<span>' + esc(f) + '</span></li>'; }).join('');
      return '<div class="plan-card reveal' + (p.best ? ' plan-card--best' : '') + '" data-delay="' + ((i % 3) + 1) + '" data-plan="' + esc(slugify(p.tier)) + '">' +
        (p.best ? '<span class="plan-card__pill">Most popular</span>' : '') +
        '<div class="plan-card__tier">' + esc(p.tier) + '</div>' +
        '<div class="plan-card__freq">' + esc(p.freq || '') + '</div>' +
        '<div class="plan-card__price">$' + num(p.price) + '<small>/' + esc(p.per || 'mo') + '</small></div>' +
        '<ul class="plan-card__features">' + feats + '</ul>' +
        '<button class="btn' + (p.best ? '' : ' btn--ghost') + '" type="button" data-choose-plan="' + esc(slugify(p.tier)) + '">Choose this plan</button>' +
      '</div>';
    }).join('');
    revealScan(plansGrid);
  }

  plansGrid.addEventListener('click', function(e){
    var b = e.target.closest('[data-choose-plan]');
    if(!b) return;
    var slug = b.getAttribute('data-choose-plan');
    var plan = (CONTENT.plans || []).filter(function(p){ return slugify(p.tier) === slug; })[0];
    var svc = document.getElementById('b-service');
    var summary = document.getElementById('b-summary');
    if(svc && plan) svc.value = slug;
    if(summary && plan) summary.value = plan.tier + ' — $' + num(plan.price) + '/' + (plan.per || 'mo') + ' · ' + (plan.freq || '');
    document.getElementById('book').scrollIntoView(reduce ? {} : {behavior:'smooth'});
    setTimeout(function(){ document.getElementById('b-name').focus({preventScroll:true}); }, reduce ? 0 : 650);
  });

  /* =====================================================
     BOOKING FORM — FormSubmit fetch + sms fallback
     ===================================================== */
  var form = document.getElementById('bookForm');
  var msgEl = document.getElementById('bookMsg');
  var submitBtn = document.getElementById('bookSubmit');
  var bService = document.getElementById('b-service');
  var bSummary = document.getElementById('b-summary');

  function serviceOptionsHtml(){
    var opts = (CONTENT.plans || []).map(function(p){
      return '<option value="' + esc(slugify(p.tier)) + '">' + esc(p.tier) + ' — $' + num(p.price) + '/' + esc(p.per || 'mo') + '</option>';
    }).join('');
    opts += '<option value="seasonal">One-time seasonal service (see above)</option>';
    opts += '<option value="unsure">Not sure — help me pick</option>';
    return opts;
  }

  // no past start dates
  var bDate = document.getElementById('b-date');
  var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  bDate.min = today.toISOString().slice(0,10);

  var val = function(id){ var el = document.getElementById(id); return el ? (el.value||'').trim() : ''; };
  var setErr = function(id, on){
    var el = document.getElementById(id);
    var f = el && el.closest('.field');
    if(f) f.classList.toggle('invalid', !!on);
  };

  var buildSms = function(d){
    var body = "Hi " + CONTENT.brand.name + "! I'd like a quote."
      + " Name: " + d.name + "."
      + " Phone: " + d.phone + "."
      + " Address: " + d.address + (d.city ? ", " + d.city : "") + "."
      + " Interested in: " + d.serviceLabel + "."
      + " Start date: " + d.start_date + "."
      + (d.config_summary ? " Selection: " + d.config_summary + "." : "")
      + (d.notes ? " Notes: " + d.notes + "." : "");
    return "sms:" + LEAD.sms + "?body=" + encodeURIComponent(body);
  };

  var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  /* Global guard: on desktop, never let sms:/tel: links trigger the OS
     "Pick an app" dialog. Show a friendly toast instead. Mobile untouched. */
  if(!isMobile){
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href^="sms:"], a[href^="tel:"]');
      if(!a) return;
      e.preventDefault();
      var t = document.getElementById('smsToast');
      if(!t){
        t = document.createElement('div');
        t.id = 'smsToast';
        t.setAttribute('role','status');
        t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:9999;'
          + 'background:#0A100B;color:#F2F0E6;padding:14px 22px;border-radius:12px;'
          + 'box-shadow:0 12px 40px rgba(0,0,0,.55);border:1px solid rgba(129,119,242,.35);'
          + 'font-family:Work Sans,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
          + 'opacity:0;transition:opacity .25s ease;';
        document.body.appendChild(t);
      }
      t.innerHTML = 'Call or text us at <strong style="color:#9C93FF;letter-spacing:.02em">' + esc(CONTENT.brand.phone) + '</strong> from your phone.';
      requestAnimationFrame(function(){ t.style.opacity = '1'; });
      clearTimeout(window.__smsToastTimer);
      window.__smsToastTimer = setTimeout(function(){ t.style.opacity = '0'; }, 4500);
    });
  }

  var showDone = function(phone, smsUrl){
    form.hidden = true;
    var done = document.getElementById('bookDone');
    var dm = document.getElementById('doneMsg');
    if(dm){
      if(isMobile && smsUrl){
        dm.textContent = "We got it! We'll text you at " + phone + " to confirm your quote. Opening a text so you can send us a copy too — just hit send.";
      } else {
        dm.textContent = "We got it! We'll text you at " + phone + " from " + CONTENT.brand.phone + " to confirm your quote. Keep an eye on your messages.";
      }
    }
    if(done){ done.hidden = false; done.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'center'}); }
    if(smsUrl && isMobile){ setTimeout(function(){ window.location.href = smsUrl; }, 900); }
  };

  form.addEventListener('submit', function(e){
    e.preventDefault();
    msgEl.textContent = ''; msgEl.className = 'book__msg';

    // honeypot: silently succeed for bots
    if(form.querySelector('input[name="_honey"]').value){ showDone('your number', ''); return; }

    var svcVal = val('b-service');
    var svcLabel = (function(){
      if(svcVal === 'seasonal') return 'One-time seasonal service';
      if(svcVal === 'unsure') return 'Not sure — help them pick';
      var plan = (CONTENT.plans || []).filter(function(p){ return slugify(p.tier) === svcVal; })[0];
      return plan ? plan.tier : svcVal;
    })();

    var d = {
      name: val('b-name'),
      phone: val('b-phone'),
      address: val('b-addr'),
      city: val('b-city'),
      service: svcVal,
      serviceLabel: svcLabel,
      start_date: val('b-date'),
      notes: val('b-notes'),
      config_summary: val('b-summary')
    };

    var bad = false;
    setErr('b-name', !d.name); bad = bad || !d.name;
    var digits = d.phone.replace(/\D/g,'');
    setErr('b-phone', digits.length < 7); bad = bad || digits.length < 7;
    setErr('b-addr', !d.address); bad = bad || !d.address;
    setErr('b-city', !d.city); bad = bad || !d.city;
    setErr('b-date', !d.start_date); bad = bad || !d.start_date;
    var consent = document.getElementById('b-consent').checked;

    if(bad){ msgEl.textContent = 'Please fill in the highlighted fields.'; msgEl.classList.add('err'); return; }
    if(!consent){ msgEl.textContent = 'Please check the consent box so we can text you a confirmation.'; msgEl.classList.add('err'); return; }

    var smsUrl = buildSms(d);
    submitBtn.disabled = true; submitBtn.textContent = 'Sending…';

    var payload = {
      _subject: 'New yard care request — ' + d.name + ' (' + d.serviceLabel + ')',
      _template: 'table',
      _captcha: 'false',
      name: d.name, phone: d.phone,
      address: d.address, city: d.city,
      service: d.serviceLabel,
      start_date: d.start_date,
      notes: d.notes || '—',
      config_summary: d.config_summary || '— (no season/plan picker used)'
    };

    fetch('https://formsubmit.co/ajax/' + LEAD.email, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(r){
      if(!r.ok) throw new Error('bad status');
      return r.json();
    }).then(function(){
      showDone(d.phone, smsUrl);
    }).catch(function(){
      // network or provider hiccup — fall back to SMS so the lead isn't lost
      submitBtn.disabled = false; submitBtn.textContent = 'Get my quote';
      msgEl.classList.add('err');
      if(isMobile){
        msgEl.textContent = "Hmm, that didn't send. Opening a text instead — your info is pre-filled, just hit send.";
        setTimeout(function(){ window.location.href = smsUrl; }, 700);
      } else {
        msgEl.textContent = "Hmm, that didn't send. Call or text us at " + CONTENT.brand.phone + " and we'll get you booked the old-fashioned way.";
      }
    });
  });

  /* =====================================================
     CONTENT RENDER — re-paints every owner-editable region
     from the merged CONTENT object. Runs once with the
     inline defaults (no flash) and again if content.json
     loads. Never hard-fails the page.
     ===================================================== */
  var ownerPhotoBox = document.getElementById('ownerPhoto');
  var ownerPhotoDefault = ownerPhotoBox.innerHTML;
  var ownerPhotoAria = ownerPhotoBox.getAttribute('aria-label');

  function renderContent(c){
    applyRuntime(c);
    var brand = c.brand || {}, area = c.serviceArea || {}, owner = c.owner || {}, misc = c.misc || {};
    var e164 = telHref(brand.phone);
    var smsBody = encodeURIComponent("Hi " + brand.name + "! I'd like a quote.");

    // ----- brand & contact -----
    document.getElementById('brandName').innerHTML = esc(brand.name) + '<span>' + esc((area.short || '') + ' landscaping') + '</span>';
    document.querySelectorAll('a[href^="tel:"]').forEach(function(a){ a.href = 'tel:' + e164; });
    document.querySelectorAll('a[href^="sms:"]').forEach(function(a){ a.href = 'sms:' + e164 + '?body=' + smsBody; });
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.textContent = brand.phone; });
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = brand.name; });
    document.querySelectorAll('[data-tagline]').forEach(function(el){ el.textContent = brand.tagline; });
    var fe = document.getElementById('footEmail');
    fe.href = 'mailto:' + brand.email; fe.textContent = brand.email;

    // ----- service area -----
    document.getElementById('heroEyebrow').textContent = 'Lawn & yard care · ' + area.region;
    var cities = (area.cities || []).filter(Boolean);
    document.getElementById('footServe').innerHTML = 'Serving ' + cities.map(esc).join(' · ');
    document.getElementById('faqDeliver').innerHTML = cities.map(esc).join(', ')
      + ' and everything in between — <b>the whole ' + esc(area.short) + '.</b>'
      + " Outside that ring? Text us your address anyway; if a route works we'll make it work.";

    // ----- social links: rendered by the footer-contact component (fc-social) -----
    // (landscaping's own hand-built footSocial was removed — one social
    // renderer, not two — see _template/components/footer-contact.js)

    // ----- misc notes -----
    document.getElementById('plansNote').innerHTML = esc(misc.plansNote || '');
    document.getElementById('scopeNote').innerHTML = esc(misc.scopeNote || '');

    // ----- season wheel + plans + booking selects -----
    wheelRender();
    plansRender();
    var prevSel = bService.value;
    bService.innerHTML = serviceOptionsHtml();
    var slugs = (c.plans || []).map(function(p){ return slugify(p.tier); }).concat(['seasonal','unsure']);
    bService.value = slugs.indexOf(prevSel) > -1 ? prevSel : (slugs[0] || '');
    if(bSummary.value) { /* leave any in-progress summary alone */ }

    // ----- owner -----
    document.getElementById('ownerDesc').textContent = owner.bio || '';
    if(owner.photo){
      ownerPhotoBox.innerHTML = '<img src="' + esc(owner.photo) + '" alt="' + esc(owner.name || 'The owner') + '" loading="lazy" />';
      ownerPhotoBox.setAttribute('aria-label', owner.name || 'The owner');
    } else {
      if(ownerPhotoBox.innerHTML !== ownerPhotoDefault){
        ownerPhotoBox.innerHTML = ownerPhotoDefault;
        ownerPhotoBox.setAttribute('aria-label', ownerPhotoAria);
      }
      var cap = document.getElementById('ownerCaption');
      if(cap){
        var first = String(owner.name || '').trim().split(/\s+/)[0];
        cap.textContent = first ? 'ON SITE MOST WEEKS' : '';
      }
    }

    // ----- reviews (three static cards; empty-state CSS shows placeholder copy) -----
    var reviewEls = document.querySelectorAll('.review');
    (c.testimonials || []).forEach(function(t, i){
      var el = reviewEls[i];
      if(!el) return;
      el.querySelector('.review__quote').textContent = t.quote || '';
      el.querySelector('.review__who').textContent = t.name ? ('— ' + t.name) : '— Add a real review here';
    });

    revealScan(document);
  }

  // paint from the inline defaults immediately, then merge the live override
  /* boot handed to base.js */ // 404 / offline: the defaults stand

  window.renderContent = renderContent;
})();
