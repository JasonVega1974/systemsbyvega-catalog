/* hvac/niche.js — this niche's renderer and interactive logic.
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
     Written as strict JSON so tooling can verify the two
     stay byte-consistent.
     ===================================================== */
/* Fixed hotspot geometry for up to 7 spots (index-matched to systemMap).
     Extra spots beyond 7 still appear as chips below the diagram. */
  var SPOT_GEO = [
    { x: 150, y: 345 },   /* furnace (utility room)   */
    { x: 208, y: 300 },   /* return filter (plenum)   */
    { x: 96,  y: 352 },   /* water heater             */
    { x: 222, y: 216 },   /* duct chase, mid-wall     */
    { x: 342, y: 318 },   /* thermostat, living room  */
    { x: 262, y: 104 },   /* attic insulation         */
    { x: 560, y: 356 }    /* AC condenser, outside    */
  ];

  /* Static cutaway-house drawing. Hotspots are appended per systemMap data. */
  function houseSvgBase(){
    return [
      /* ground */
      '<line class="house-line" x1="14" y1="400" x2="626" y2="400"/>',
      /* house shell */
      '<rect class="house-fill" x="62" y="150" width="396" height="250"/>',
      '<path class="house-line" d="M62,400 V150 M458,400 V150"/>',
      /* roof + attic */
      '<path class="house-line" d="M44,152 L260,58 L476,152"/>',
      '<path class="house-soft" d="M78,145 L260,66 L442,145"/>',
      /* attic insulation batts */
      '<path class="house-warm" d="M104,150 h44 v-12 h-44 z M162,150 h44 v-12 h-44 z M220,150 h44 v-12 h-44 z M278,150 h44 v-12 h-44 z M336,150 h44 v-12 h-44 z M394,150 h22 v-12 h-22 z"/>',
      /* floor split */
      '<line class="house-line" x1="62" y1="272" x2="458" y2="272"/>',
      /* utility room wall */
      '<line class="house-soft" x1="248" y1="272" x2="248" y2="400"/>',
      /* duct chase: vertical + branches */
      '<rect class="house-duct" x="210" y="150" width="26" height="150"/>',
      '<path class="house-duct" d="M236,196 h120 M236,240 h80"/>',
      /* supply registers */
      '<rect class="house-soft" x="352" y="192" width="26" height="8"/>',
      '<rect class="house-soft" x="312" y="236" width="26" height="8"/>',
      /* furnace box */
      '<rect class="house-warm" x="130" y="316" width="44" height="70"/>',
      '<path class="house-soft" d="M138,330 h28 M138,342 h28"/>',
      /* return plenum + filter slot */
      '<rect class="house-duct" x="186" y="286" width="42" height="26"/>',
      /* water heater cylinder */
      '<rect class="house-soft" x="82" y="326" width="30" height="62" rx="13"/>',
      /* thermostat on wall */
      '<rect class="house-cool" x="330" y="306" width="22" height="14" rx="3"/>',
      /* windows for flavor */
      '<rect class="house-soft" x="300" y="170" width="34" height="26" rx="3"/>',
      '<rect class="house-soft" x="110" y="188" width="34" height="26" rx="3"/>',
      '<rect class="house-soft" x="386" y="300" width="34" height="30" rx="3"/>',
      /* door */
      '<path class="house-soft" d="M282,400 v-52 a8,8 0 0 1 8,-8 h14 a8,8 0 0 1 8,8 v52"/>',
      /* condenser pad + unit */
      '<line class="house-soft" x1="512" y1="400" x2="612" y2="400"/>',
      '<rect class="house-cool" x="524" y="330" width="72" height="66" rx="6"/>',
      '<circle class="house-soft" cx="560" cy="358" r="18"/>',
      '<path class="house-soft" d="M560,344 v28 M546,358 h28"/>',
      /* refrigerant lineset to house */
      '<path class="house-duct" d="M524,368 H470 a10,10 0 0 1 -10,-10 v-32"/>'
    ].join('');
  }

  /* ---------- render ---------- */
  function renderContent(c){
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = c.brand.name; });
    document.querySelectorAll('[data-city]').forEach(function(el){ el.textContent = c.brand.city; });
    var telLink = telHref(c.brand.phone);
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = c.brand.phone; });
    document.querySelectorAll('[data-phone-link]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = 'Call or text ' + c.brand.phone; });
    document.querySelectorAll('.mobile-cta .call').forEach(function(el){ el.href = 'tel:' + telLink; });
    document.querySelectorAll('.mobile-cta .text').forEach(function(el){ el.href = 'sms:' + telLink + '?body=' + encodeURIComponent('Hi ' + c.brand.name + ', my house needs a look.'); });

    // trust stats
    document.getElementById('trustStats').innerHTML = c.stats.map(function(s){
      return '<div class="tstat"><b>' + esc(s.num) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');

    // services
    var svcIcos = {
      heat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3.5 4 5.5 6.4 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 9.4 8.5 7 12 3z"/><path d="M12 12c1.4 1.6 2.2 2.7 2.2 4a2.2 2.2 0 0 1-4.4 0c0-1.3.8-2.4 2.2-4z"/></svg>',
      cool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M4 6l16 12M20 6L4 18"/></svg>',
      air: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7a2.5 2.5 0 1 1-2.5 2.5"/></svg>',
      plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>'
    };
    document.getElementById('svcGrid').innerHTML = c.services.map(function(s){
      /* pole was renamed to the canonical services[].icon (§4.2). */
      var pole = svcIcos[s.icon] ? s.icon : 'plan';
      return '<div class="svc ' + pole + '"><span class="s-ico">' + svcIcos[pole] + '</span><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div>';
    }).join('');

    // plans
    document.getElementById('priceGrid').innerHTML = c.pricing.map(function(p){
      /* Canonical shape (§4.2): pricing[], features is an ARRAY, highlight is the
         flag, label is the name, and price is a NUMBER — formatting is the
         renderer's job, which is why the currency symbol is added here.
         The old note field held "Most popular", which is exactly what highlight
         already means, so it was dropped and the badge text is literal now. */
      var feats = (p.features || []).map(function(f){ return '<li>' + esc(f) + '</li>'; }).join('');
      return '<div class="pcard' + (p.highlight ? ' best' : '') + '">' +
        (p.highlight ? '<span class="pnote">Our pick</span>' : '') +
        '<h3>' + esc(p.label) + '</h3>' +
        '<div class="pnum">' + esc(p.blurb) + '<span> ' + esc(p.per) + '</span></div>' +
        '<ul>' + feats + '</ul></div>';
    }).join('');
    document.getElementById('pricingNote').textContent = c.pricingNote || '';

    // system map
    renderSystemMap(c);
    document.getElementById('sysNote').textContent = c.sysNote || '';

    // seasonal
    document.getElementById('seasonGrid').innerHTML = c.seasonal.map(function(s){
      var items = (s.items || '').split('\n').filter(Boolean).map(function(it){ return '<li>' + esc(it) + '</li>'; }).join('');
      return '<div class="scard' + (s.kind === 'warm' ? ' warm' : '') + '">' +
        '<span class="sc-tag">' + (s.kind === 'warm' ? 'Heating' : 'Cooling') + '</span>' +
        '<h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p><ul>' + items + '</ul></div>';
    }).join('');

    // service area
    document.getElementById('areaShort').textContent = c.serviceArea.short;
    document.getElementById('areaChips').innerHTML = (c.serviceArea.cities || []).map(function(city){
      return '<span class="achip">' + esc(city) + '</span>';
    }).join('');

    // owner
    document.getElementById('ownerEyebrow').textContent = c.owner.heading || 'Our story';
    document.getElementById('ownerName').textContent = c.owner.name;
    document.getElementById('ownerBio').textContent = c.owner.bio;
    var photoWrap = document.getElementById('ownerPhotoWrap');
    photoWrap.innerHTML = c.owner.photo ? '<img src="' + esc(c.owner.photo) + '" alt="' + esc(c.owner.name) + '">' : '';

    // testimonials
    document.getElementById('testGrid').innerHTML = c.testimonials.map(function(t){
      return '<div class="tcard"><p>' + esc(t.quote) + '</p><div class="tname">' + esc(t.name) + '</div></div>';
    }).join('');

    // faq
    document.getElementById('faqList').innerHTML = c.faq.map(function(f, i){
      return '<details class="qa"' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + '<span class="pm">+</span></summary><div class="ans">' + esc(f.a) + '</div></details>';
    }).join('');

    revealScan(document.body);
  }

  /* ---------- system map: house diagram + chips + detail panel ---------- */
  var activeSpot = -1;
  function renderSystemMap(c){
    var spots = c.systemMap || [];
    var svg = '<svg viewBox="0 0 640 420" role="img" aria-label="Cutaway house diagram with tappable heating and cooling components">';
    svg += houseSvgBase();
    spots.slice(0, SPOT_GEO.length).forEach(function(s, i){
      var g = SPOT_GEO[i];
      svg += '<g class="hs-g" tabindex="0" role="button" aria-pressed="false" data-spot="' + i + '" aria-label="' + esc(s.label) + ' — symptoms and pricing">' +
        '<circle class="hs-halo" cx="' + g.x + '" cy="' + g.y + '" r="14"/>' +
        '<circle class="hs-ring" cx="' + g.x + '" cy="' + g.y + '" r="18"/>' +
        '<circle class="hs-dot" cx="' + g.x + '" cy="' + g.y + '" r="13"/>' +
        '<text class="hs-num" x="' + g.x + '" y="' + (g.y + 4.5) + '" text-anchor="middle">' + (i + 1) + '</text></g>';
    });
    svg += '</svg>';
    document.getElementById('sysMapBox').innerHTML = svg;

    document.getElementById('sysChips').innerHTML = spots.map(function(s, i){
      return '<button type="button" class="schip" data-spot="' + i + '" aria-pressed="false">' + (i < SPOT_GEO.length ? (i + 1) + ' · ' : '') + esc(s.label) + '</button>';
    }).join('');

    var wrap = document.getElementById('sysmap');
    if(!wrap._wired){
      wrap._wired = true;
      wrap.addEventListener('click', function(e){
        var el = e.target.closest('[data-spot]');
        if(el) activateSpot(+el.getAttribute('data-spot'));
      });
      wrap.addEventListener('keydown', function(e){
        var el = e.target.closest('g[data-spot]');
        if(el && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')){
          e.preventDefault();
          activateSpot(+el.getAttribute('data-spot'));
        }
      });
    }
    if(activeSpot >= 0 && activeSpot < spots.length) activateSpot(activeSpot);
  }

  function activateSpot(i){
    var spots = CONTENT.systemMap || [];
    var s = spots[i];
    if(!s) return;
    activeSpot = i;
    document.querySelectorAll('#sysmap [data-spot]').forEach(function(el){
      var on = +el.getAttribute('data-spot') === i;
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.getElementById('sysDetail').innerHTML =
      '<p class="sd-label">' + esc(s.label) + '</p>' +
      '<p class="sd-h warm">Sounds like</p><p class="sd-t">' + esc(s.symptoms) + '</p>' +
      '<p class="sd-h">What a visit covers</p><p class="sd-t">' + esc(s.covers) + '</p>' +
      '<p class="sd-h">Ballpark</p><p class="sd-range">' + esc(s.range) + '</p>' +
      '<p class="sd-cta"><a class="btn-pri" href="#book">Book this visit</a></p>';
  }

  /* ---------- reveal on scroll ---------- */
  var io = null;
  function revealScan(root){
    var nodes = (root || document).querySelectorAll('.reveal:not(.in)');
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

  /* ---------- nav solidify ---------- */
  var nav = document.getElementById('nav');
  var onScroll = function(){ nav.classList.toggle('solid', window.scrollY > 24); };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- desktop sms:/tel: guard ---------- */
  var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  function toast(msg){
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function(){ t.classList.remove('show'); }, 3200);
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest('a[href^="sms:"], a[href^="tel:"]');
    if(!a || isMobile) return;
    e.preventDefault();
    toast('Call or text ' + CONTENT.brand.phone);
  });

  /* ---------- lead form (FormSubmit) ---------- */
  var LEAD = { provider: 'formsubmit', email: '' };
  function applyRuntime(c){ LEAD.email = (c.brand||{}).leadEmail || LEAD.email; }
  applyRuntime(CONTENT);

  var form = document.getElementById('quoteForm');
  var status = document.getElementById('qfStatus');
  var success = document.getElementById('qfSuccess');
  var submitBtn = document.getElementById('qfSubmit');
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var honey = form.querySelector('[name="_honey"]');
    if(honey && honey.value) return; // honeypot tripped, silently drop

    var name = document.getElementById('qName').value.trim();
    var phone = document.getElementById('qPhone').value.trim();
    if(!name || !phone){
      status.textContent = 'Please fill in your name and phone number.';
      status.classList.add('err');
      return;
    }
    status.textContent = ''; status.classList.remove('err');
    submitBtn.disabled = true; submitBtn.textContent = 'Sending…';

    var payload = {
      name: name, phone: phone,
      address: document.getElementById('qAddress').value.trim() || '(not given)',
      need: document.getElementById('qNeed').value,
      timing: document.getElementById('qWhen').value,
      notes: document.getElementById('qNotes').value.trim(),
      _subject: CONTENT.brand.name + ' — new request from ' + name,
      _template: 'table', _captcha: 'false'
    };

    fetch('https://formsubmit.co/ajax/' + encodeURIComponent(LEAD.email), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(r){ return r.json(); }).then(function(res){
      if(res && (res.success === 'true' || res.success === true)){
        form.hidden = true;
        success.hidden = false;
        success.setAttribute('data-show','1');
        success.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      } else {
        throw new Error('formsubmit rejected');
      }
    }).catch(function(){
      status.innerHTML = 'Something didn\'t go through — text us directly at <strong>' + esc(CONTENT.brand.phone) + '</strong> instead.';
      status.classList.add('err');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request a visit';
    });
  });

  /* ---------- boot ---------- */
  /* boot handed to base.js */

  window.renderContent = renderContent;
})();
