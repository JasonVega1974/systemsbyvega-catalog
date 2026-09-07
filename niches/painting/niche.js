/* painting/niche.js — this niche's renderer and interactive logic.
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
     the visualizer swatches, services, pricing, booking
     form, footer, FAQ and owner section all re-render from
     the merged object. Keep content.json's shape in sync
     with this const. (Static copy the admin does NOT touch:
     the JSON-LD offers/priceRange in <head> and the meta
     description.)
     ===================================================== */
/* Lead delivery — no backend. FormSubmit needs no account, but the FIRST real
     submission emails a one-time activation link to LEAD.email; click it once and
     every booking after that lands in that inbox, formatted as a table. */
  var LEAD = { provider: 'formsubmit', email: '', sms: '' };

  /* Shared quote/paren stripper for anything interpolated into an img src or
     href attribute — symmetric with bin-cleaning/niche.js's safeUrl(). */
  function safeUrl(u){ return String(u || '').replace(/["\\)]/g, ''); }

  function money(n){ return '$' + num(n).toLocaleString('en-US'); }

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

  // ---------- drifting paint-fleck motes in hero ----------
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
      var s = 3 + Math.random()*3;
      m.style.width = s + 'px'; m.style.height = s + 'px';
      motes.appendChild(m);
    }
  }

  /* =====================================================
     SIGNATURE — ROOM RE-PAINT VISUALIZER
     Tap-driven, not drag-driven: every swatch is a real
     <button> with a click handler, so mouse, touch and
     keyboard (Enter/Space, native button behavior) all work
     identically with zero extra fallback code. The wall's
     fill color transitions via CSS (killed under
     prefers-reduced-motion by the global rule above).
     ===================================================== */
  var vizRoom = document.getElementById('vizRoom');
  var swatchesEl = document.getElementById('swatches');
  var vizIntro = document.getElementById('vizIntro');
  var activeSwatch = null;

  // Base room scene is now STATIC inline SVG in the markup (renders with JS off).
  // JS only recolors the accent wall; the fixed lighting model above does the rest.
  var roomWall = document.getElementById('roomWall');

  function applySwatch(sw){
    if(!sw) return;
    activeSwatch = sw.id;
    if(roomWall){ roomWall.setAttribute('fill', sw.hex); }
    vizIntro.textContent = 'Wall shown in ' + sw.name + '. Like it? Get it quoted below.';
    var summary = document.getElementById('b-summary');
    if(summary){ summary.value = 'Room Refresh in ' + sw.name; }
    Array.prototype.forEach.call(swatchesEl.children, function(btn){
      btn.setAttribute('aria-pressed', btn.getAttribute('data-id') === sw.id ? 'true' : 'false');
    });
  }

  function renderSwatches(){
    var list = CONTENT.swatches || [];
    swatchesEl.innerHTML = list.map(function(sw){
      return '<button type="button" class="swatch" data-id="' + esc(sw.id) + '" aria-pressed="false">' +
        '<span class="swatch__chip" style="background:' + esc(sw.hex) + '" aria-hidden="true"></span>' +
        esc(sw.name) + '</button>';
    }).join('');
    Array.prototype.forEach.call(swatchesEl.children, function(btn){
      btn.addEventListener('click', function(){
        var sw = list.filter(function(s){ return s.id === btn.getAttribute('data-id'); })[0];
        applySwatch(sw);
      });
    });
    if(list.length){ applySwatch(list[0]); }
  }

  /* =====================================================
     SERVICES
     ===================================================== */
  var SVC_ICONS = {
    interior: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
    exterior: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 4l9 6.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
    cabinet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18"/><circle cx="9" cy="12" r=".6" fill="currentColor"/><circle cx="15" cy="12" r=".6" fill="currentColor"/></svg>',
    deck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18M3 14h18M3 19h18"/><path d="M6 4v18M18 4v18"/></svg>'
  };
  function renderServices(){
    var grid = document.getElementById('servicesGrid');
    grid.innerHTML = (CONTENT.services || []).map(function(s, i){
      return '<div class="svc-card reveal" data-delay="' + ((i % 3) + 1) + '">' +
        '<div class="svc-card__ic" aria-hidden="true">' + (SVC_ICONS[s.icon] || SVC_ICONS.interior) + '</div>' +
        '<h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div>';
    }).join('');
    revealScan(grid);
  }

  /* =====================================================
     PRICING
     ===================================================== */
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  function renderPricing(){
    var grid = document.getElementById('plansGrid');
    grid.innerHTML = (CONTENT.pricing || []).map(function(p){
      var pill = p.highlight ? '<span class="plan-card__pill">Most booked</span>' : '';
      var feats = (p.features || []).map(function(f){ return '<li>' + CHECK + '<span>' + esc(f) + '</span></li>'; }).join('');
      return '<div class="plan-card' + (p.highlight ? ' plan-card--best' : '') + '">' + pill +
        '<div class="plan-card__tier">' + esc(p.label) + '</div>' +
        '<div class="plan-card__freq">' + esc(p.per || '') + '</div>' +
        '<div class="plan-card__price">' + esc(p.blurb) + '<small>typical range, confirmed before we start</small></div>' +
        '<ul class="plan-card__features">' + feats + '</ul>' +
        '<a class="btn" href="#book">Get quoted</a></div>';
    }).join('');
  }

  /* =====================================================
     SERVICE + BOOKING SELECT OPTIONS
     ===================================================== */
  function renderBookingSelect(){
    var sel = document.getElementById('b-service');
    var opts = (CONTENT.pricing || []).map(function(p){ return p.label; })
      .concat((CONTENT.services || []).map(function(s){ return s.title; }));
    sel.innerHTML = '<option value="" disabled selected>Choose one…</option>' +
      opts.map(function(o){ return '<option value="' + esc(o) + '">' + esc(o) + '</option>'; }).join('');
  }

  /* =====================================================
     OWNER + FAQ + TESTIMONIALS + FOOTER
     ===================================================== */
  function renderOwner(){
    var o = CONTENT.owner || {};
    var descEl = document.getElementById('ownerDesc');
    if(descEl) descEl.textContent = o.bio || '';
    var cap = document.getElementById('ownerCaption');
    if(cap) cap.textContent = 'ON A JOB MOST WEEKS';
    var photoEl = document.getElementById('ownerPhoto');
    if(photoEl && o.photo){
      var existing = photoEl.querySelector('img');
      if(!existing){
        var img = document.createElement('img');
        img.alt = (o.name || 'Owner') + ' portrait';
        img.loading = 'lazy';
        photoEl.querySelector('svg').replaceWith(img);
      }
      photoEl.querySelector('img').src = o.photo;
    }
  }

  function renderFaq(){
    var list = document.getElementById('faqList');
    list.innerHTML = (CONTENT.faq || []).map(function(f){
      return '<details class="faq reveal"><summary>' + esc(f.q) + '<span class="plus">+</span></summary>' +
        '<div class="faq__body">' + esc(f.a) + '</div></details>';
    }).join('');
    revealScan(list);
  }

  function renderTestimonials(){
    var grid = document.getElementById('reviewsGrid');
    grid.innerHTML = (CONTENT.testimonials || []).map(function(t, i){
      return '<div class="review reveal" data-delay="' + ((i % 3) + 1) + '">' +
        '<div class="review__quote">' + esc(t.quote || '') + '</div>' +
        '<div class="review__who">— ' + esc(t.name || 'Add a real review here') + '</div></div>';
    }).join('');
    revealScan(grid);
  }

  function renderFooter(){
    var b = CONTENT.brand || {};
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = b.name || ''; });
    document.querySelectorAll('[data-tagline]').forEach(function(el){ el.textContent = b.tagline || ''; });
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.textContent = b.phone || ''; });
    document.querySelectorAll('a[href^="tel:"]').forEach(function(el){ el.href = 'tel:' + telHref(b.phone); });
    var fe = document.getElementById('footEmail');
    if(fe){ fe.href = 'mailto:' + (b.email || ''); fe.textContent = b.email || ''; }
    var area = CONTENT.serviceArea || {};
    var cities = (area.cities || []).filter(Boolean);
    var fs = document.getElementById('footServe');
    if(fs){ fs.textContent = 'Serving ' + cities.join(' · '); }
    var faqDeliver = document.getElementById('faqDeliver');
    if(faqDeliver){ faqDeliver.textContent = cities.join(', ') + ' and everything in between — the whole ' + (area.short || '') + '.'; }
    var eyebrow = document.getElementById('heroEyebrow');
    if(eyebrow){ eyebrow.textContent = 'Residential painting · ' + (b.city || ''); }

    // ----- social links (footer; hidden when empty) -----
    var footSocial = document.getElementById('footSocial');
    if(footSocial){
      var social = CONTENT.social || [];
      /* Filter FIRST, then gate visibility on the filtered result — gating on
         the raw (pre-filter) social.length would show an empty, hidden=false
         footer row whenever every entry failed the https scheme check. */
      var socialLinks = social.filter(function(s){ return /^https:\/\//i.test(s.url); /* scheme-gated here too, not just in sbv_social_valid — entity encoding cannot stop a scheme, and safeUrl only de-fangs CSS/attr breakout */ });
      if(socialLinks.length){
        footSocial.innerHTML = socialLinks.map(function(s){
          return '<a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent-2)">' + esc(s.label || s.n) + '</a>';
        }).join(' · ');
        footSocial.hidden = false;
      } else {
        footSocial.innerHTML = '';
        footSocial.hidden = true;
      }
    }
  }

  function renderAll(){
    renderSwatches();
    renderServices();
    renderPricing();
    renderBookingSelect();
    renderOwner();
    renderFaq();
    renderTestimonials();
    renderFooter();
  }
  /* boot handed to base.js */

  /* =====================================================
     BOOKING FORM — FormSubmit fetch + sms fallback
     ===================================================== */
  var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  var form = document.getElementById('bookForm');
  var msgEl = document.getElementById('bookMsg');
  var submitBtn = document.getElementById('bookSubmit');
  var doneEl = document.getElementById('bookDone');
  var doneMsgEl = document.getElementById('doneMsg');

  function val(id){ var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; }
  function setErr(fieldEl, on){ if(fieldEl) fieldEl.classList.toggle('invalid', !!on); }

  function buildSms(d){
    var body = "Hi Bristlecone Paint Co.! I'd like a quote."
      + " Name: " + d.name + "."
      + " Phone: " + d.phone + "."
      + " Address: " + d.address + (d.city ? ", " + d.city : "") + "."
      + " Job: " + d.service + "."
      + (d.notes ? " Notes: " + d.notes + "." : "")
      + (d.summary ? " Selection: " + d.summary + "." : "");
    return 'sms:' + LEAD.sms + '?body=' + encodeURIComponent(body);
  }

  function showDone(phone){
    form.hidden = true;
    doneEl.hidden = false;
    doneMsgEl.textContent = "We'll text " + (phone || 'you') + " shortly to confirm your quote.";
    doneEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }

  if(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(val('_honey') || (document.querySelector('.hp') && document.querySelector('.hp').value)){ return; }

      var d = {
        name: val('b-name'), phone: val('b-phone'), address: val('b-addr'), city: val('b-city'),
        service: val('b-service'), notes: val('b-notes'), summary: val('b-summary'),
        consent: document.getElementById('b-consent').checked
      };

      var invalid = false;
      [['b-name', d.name], ['b-phone', d.phone], ['b-addr', d.address], ['b-city', d.city], ['b-service', d.service]].forEach(function(pair){
        var el = document.getElementById(pair[0]);
        var bad = !pair[1];
        setErr(el ? el.closest('.field') : null, bad);
        if(bad) invalid = true;
      });
      if(!d.consent){ invalid = true; }
      if(invalid){ msgEl.textContent = 'Please fill in the required fields and check the consent box.'; msgEl.classList.add('err'); return; }

      msgEl.textContent = ''; msgEl.classList.remove('err');
      submitBtn.disabled = true; submitBtn.textContent = 'Sending…';

      var smsUrl = buildSms(d);

      fetch('https://formsubmit.co/ajax/' + LEAD.email, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: d.name, phone: d.phone, address: d.address, city: d.city,
          service: d.service, notes: d.notes, selection: d.summary,
          _subject: 'Bristlecone Paint Co. — new quote request', _template: 'table', _captcha: 'false'
        })
      }).then(function(r){ return r.json(); }).then(function(res){
        if(res && (res.success === 'true' || res.success === true)){
          showDone(d.phone);
          if(isMobile){ setTimeout(function(){ window.location.href = smsUrl; }, 900); }
        } else { throw new Error('formsubmit rejected'); }
      }).catch(function(){
        msgEl.innerHTML = "Hmm — that didn't go through. Text your job straight to <strong>" + esc(document.querySelector('[data-phone]').textContent) + "</strong> instead.";
        msgEl.classList.add('err');
        submitBtn.disabled = false; submitBtn.textContent = 'Get my quote';
      });
    });
  }

  window.renderContent = renderAll;
})();
