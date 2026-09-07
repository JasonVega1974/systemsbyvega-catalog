/* moving/niche.js — this niche's renderer and interactive logic.
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
     stay deep-equal.
     ===================================================== */
/* Fixed icon library for Load Builder tiles (admin picks by key). */
  var ICONS = {
    bed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-7h18v7"/><path d="M3 11V6"/><path d="M6 11V9h5v2"/><path d="M3 16h18"/></svg>',
    sofa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 18v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M5 18v2"/><path d="M19 18v2"/></svg>',
    kitchen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M3 10h18"/><path d="M9 5v2"/><path d="M15 5v2"/></svg>',
    table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h18"/><path d="M5 8v10"/><path d="M19 8v10"/><path d="M5 13h14"/></svg>',
    desk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="9" rx="1.5"/><path d="M12 14v4"/><path d="M8 18h8"/></svg>',
    garage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7"/><path d="M7 16h10"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4"/><path d="M12 12v9"/></svg>',
    piano: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3 13h18"/><path d="M8 13v5"/><path d="M12 13v5"/><path d="M16 13v5"/></svg>',
    safe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5v-1"/><path d="M12 16.5v-1"/></svg>',
    fridge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="1.5"/><path d="M7 10h10"/><path d="M10 6v2"/><path d="M10 13v3"/></svg>',
    washer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4.5"/><path d="M7 6h2"/><path d="M15 6h2"/></svg>',
    patio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c4 0 7 2.4 8 5H4c1-2.6 4-5 8-5z"/><path d="M12 8v11"/><path d="M7 21c1.5-1.4 3.3-2 5-2s3.5.6 5 2"/></svg>',
    gym: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8v8"/><path d="M4 10v4"/><path d="M17 8v8"/><path d="M20 10v4"/><path d="M7 12h10"/></svg>'
  };
  var SVC_ICONS = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="12" height="9" rx="1.5"/><path d="M14 11h4l4 4v2h-8z"/><circle cx="7" cy="19" r="1.6"/><circle cx="18" cy="19" r="1.6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4"/><path d="M12 12v9"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20V9l9-5 9 5v11"/><path d="M9 20v-6h6v6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7l-9 9-4-4"/><rect x="2" y="2" width="20" height="20" rx="3"/></svg>'
  ];

  /* ---------- render ---------- */
  function renderContent(c){
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = c.brand.name; });
    document.querySelectorAll('[data-city]').forEach(function(el){ el.textContent = c.brand.city; });
    var telLink = telHref(c.brand.phone);
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = c.brand.phone; });
    document.querySelectorAll('[data-phone-link]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = 'Call or text ' + c.brand.phone; });
    document.querySelectorAll('.mobile-cta .call').forEach(function(el){ el.href = 'tel:' + telLink; });
    document.querySelectorAll('.mobile-cta .text').forEach(function(el){ el.href = 'sms:' + telLink + '?body=' + encodeURIComponent('Hi ' + c.brand.name + ', can you help with my move?'); });

    document.getElementById('trustStats').innerHTML = c.stats.map(function(s){
      return '<div class="tstat"><b>' + esc(s.num) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');

    document.getElementById('svcGrid').innerHTML = c.services.map(function(s, i){
      return '<div class="scard"><span class="s-ico">' + SVC_ICONS[i % SVC_ICONS.length] + '</span><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div>';
    }).join('');

    renderLoad(c);
    document.getElementById('loadNote').textContent = c.loadNote || '';

    document.getElementById('procGrid').innerHTML = c.process.map(function(st){
      return '<div class="proc-card"><h3>' + esc(st.title) + '</h3><p>' + esc(st.desc) + '</p></div>';
    }).join('');

    var tiers = c.crewTiers || [];
    document.getElementById('rateRows').innerHTML = tiers.map(function(t){
      return '<div class="rrow"><div class="rr-label">' + esc(t.label) + '</div><div class="rr-rate">$' + esc(t.rate) + ' ' + esc(t.unit || '/hr') + '</div><div class="rr-fit">' + esc(t.fit) + '</div></div>';
    }).join('');
    document.getElementById('billableNote').textContent = c.billableNote || '';
    document.getElementById('pricingNote').textContent = c.pricingNote || '';

    document.getElementById('areaShort').textContent = c.serviceArea.short;
    document.getElementById('areaChips').innerHTML = (c.serviceArea.cities || []).map(function(city){
      return '<span class="achip">' + esc(city) + '</span>';
    }).join('');

    document.getElementById('ownerEyebrow').textContent = c.owner.heading || 'Our story';
    document.getElementById('ownerName').textContent = c.owner.name;
    document.getElementById('ownerBio').textContent = c.owner.bio;
    var photoWrap = document.getElementById('ownerPhotoWrap');
    photoWrap.innerHTML = c.owner.photo ? '<img src="' + esc(c.owner.photo) + '" alt="' + esc(c.owner.name) + '">' : '';

    document.getElementById('testGrid').innerHTML = c.testimonials.map(function(t){
      return '<div class="tcard"><p>' + esc(t.quote) + '</p><div class="tname">' + esc(t.name) + '</div></div>';
    }).join('');

    document.getElementById('faqList').innerHTML = c.faq.map(function(f, i){
      return '<details class="qa"' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + '<span class="pm">+</span></summary><div class="ans">' + esc(f.a) + '</div></details>';
    }).join('');

    revealScan(document.body);
  }

  /* ---------- Load Builder ---------- */
  var counts = {};

  function renderLoad(c){
    var items = c.loadItems || [];
    // drop counts for ids that no longer exist (stale-id guard)
    Object.keys(counts).forEach(function(id){
      if(!items.some(function(it){ return it.id === id; })) delete counts[id];
    });

    var groups = [];
    items.forEach(function(it){ if(groups.indexOf(it.group) === -1) groups.push(it.group); });

    document.getElementById('loadTiles').innerHTML = groups.map(function(g){
      var tiles = items.filter(function(it){ return it.group === g; }).map(function(it){
        var n = counts[it.id] || 0;
        return '<div class="lb-tile' + (n > 0 ? ' on' : '') + '" data-tile="' + esc(it.id) + '">' +
          '<span class="lt-ico">' + (ICONS[it.icon] || ICONS.box) + '</span>' +
          '<span class="lt-name">' + esc(it.label) + '</span>' +
          '<span class="lt-vol">~' + esc(it.vol) + ' cu ft</span>' +
          '<span class="lb-step">' +
            '<button type="button" data-dec="' + esc(it.id) + '" aria-label="Remove one ' + esc(it.label) + '">−</button>' +
            '<span class="lt-count" data-count="' + esc(it.id) + '">' + n + '</span>' +
            '<button type="button" data-inc="' + esc(it.id) + '" aria-label="Add one ' + esc(it.label) + '">+</button>' +
          '</span></div>';
      }).join('');
      return '<div class="lb-group"><div class="lb-group-h">' + esc(g) + '</div><div class="lb-tiles">' + tiles + '</div></div>';
    }).join('');

    var tilesWrap = document.getElementById('load');
    if(!tilesWrap._wired){
      tilesWrap._wired = true;
      tilesWrap.addEventListener('click', function(e){
        var inc = e.target.closest('[data-inc]');
        var dec = e.target.closest('[data-dec]');
        if(!inc && !dec) return;
        var id = inc ? inc.getAttribute('data-inc') : dec.getAttribute('data-dec');
        counts[id] = Math.max(0, (counts[id] || 0) + (inc ? 1 : -1));
        var cEl = document.querySelector('[data-count="' + id + '"]');
        if(cEl) cEl.textContent = counts[id];
        var tile = document.querySelector('[data-tile="' + id + '"]');
        if(tile) tile.classList.toggle('on', counts[id] > 0);
        recalc();
      });
    }
    recalc();
  }

  function pickTier(list, vol){
    for(var i = 0; i < list.length; i++){
      if(vol <= num(list[i].maxVol, 0)) return list[i];
    }
    return list[list.length - 1] || null;
  }
  function r5(x){ return Math.round(x * 2) / 2; }
  function fmtH(x){ return String(r5(x)).replace(/\.0$/, ''); }
  function money(x){ return '$' + (Math.round(x / 10) * 10).toLocaleString('en-US'); }

  var lastCalc = null;
  function recalc(){
    var c = CONTENT, s = c.loadSettings || {};
    var items = c.loadItems || [];
    var totalVol = 0, heavyCount = 0, picked = [];
    items.forEach(function(it){
      var n = counts[it.id] || 0;
      if(n > 0){
        totalVol += num(it.vol) * n;
        if(it.heavy) heavyCount += n;
        picked.push(n + '× ' + it.label);
      }
    });

    var out = document.getElementById('loadOut');
    var fill = document.getElementById('truckFill');
    var x2 = document.getElementById('truckX2');

    if(totalVol <= 0){
      lastCalc = null;
      out.innerHTML = '<p class="lo-empty">Tap the rooms and big pieces that are moving — the truck, crew and ballpark show up here.</p>';
      fill.setAttribute('width', '0');
      x2.style.display = 'none';
      return;
    }

    var trucks = c.trucks || [];
    var truck = pickTier(trucks, totalVol);
    var isOverflow = truck && num(truck.maxVol) >= 999999;
    var fillPct = isOverflow ? 1 : (truck ? Math.min(1, totalVol / num(truck.maxVol, 1)) : 0);
    fill.setAttribute('width', String(Math.round(fillPct * 150)));
    x2.style.display = isOverflow ? '' : 'none';

    var tier = pickTier(c.crewTiers || [], totalVol);
    var crew = tier ? num(tier.crew, 2) : 2;
    var rate = tier ? num(tier.rate, 0) : 0;
    var hoursLow = Math.max(
      num(s.minHours, 2),
      num(s.baseHours, 1) + totalVol / (num(s.cuFtPerMoverHour, 110) * crew) + heavyCount * num(s.heavyExtraHours, .5)
    );
    var hoursHigh = hoursLow * num(s.rangePad, 1.35);

    lastCalc = {
      picked: picked, vol: Math.round(totalVol),
      truck: truck ? truck.label : '', crew: crew,
      hours: fmtH(hoursLow) + '–' + fmtH(hoursHigh) + ' hrs',
      price: money(rate * hoursLow) + '–' + money(rate * hoursHigh)
    };

    out.innerHTML =
      '<p class="lo-label">' + esc(lastCalc.truck) + '</p>' +
      '<ul class="lo-rows">' +
        '<li><span>Estimated load</span><b>≈ ' + lastCalc.vol + ' cu ft</b></li>' +
        '<li><span>Crew</span><b>' + crew + ' movers</b></li>' +
        '<li><span>Time on site</span><b>' + esc(lastCalc.hours) + '</b></li>' +
        '<li><span>Ballpark</span><b>' + esc(lastCalc.price) + '</b></li>' +
      '</ul>' +
      '<p class="lo-cta"><button type="button" class="btn-pri" id="loadCta">Request an exact quote for this load</button></p>';

    var cta = document.getElementById('loadCta');
    if(cta) cta.addEventListener('click', function(){
      var notes = document.getElementById('qNotes');
      var summary = 'Load Builder estimate: ' + lastCalc.picked.join(', ') +
        ' — ≈' + lastCalc.vol + ' cu ft, ' + lastCalc.truck + ', ' + lastCalc.crew +
        ' movers, ' + lastCalc.hours + ', ' + lastCalc.price + '.';
      var existing = notes.value.trim();
      if(!existing || existing.indexOf('Load Builder estimate:') === 0){
        notes.value = summary;
      } else {
        notes.value = summary + '\n\n' + existing;
      }
      document.getElementById('quote').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
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
      from: document.getElementById('qFrom').value.trim() || '(not given)',
      to: document.getElementById('qTo').value.trim() || '(not given)',
      size: document.getElementById('qSize').value,
      date: document.getElementById('qDate').value.trim() || '(not given)',
      notes: document.getElementById('qNotes').value.trim(),
      _subject: CONTENT.brand.name + ' — new move request from ' + name,
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
        success.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      } else {
        throw new Error('formsubmit rejected');
      }
    }).catch(function(){
      status.innerHTML = 'Something didn\'t go through — text us directly at <strong>' + esc(CONTENT.brand.phone) + '</strong> instead.';
      status.classList.add('err');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request my quote';
    });
  });

  /* ---------- boot ---------- */
  /* boot handed to base.js */

  window.renderContent = renderContent;
})();
