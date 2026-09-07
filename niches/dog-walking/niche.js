/* dog-walking/niche.js — this niche's renderer and interactive logic.
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
     Builder rates are STRINGS holding whole dollars
     ("18") so they round-trip through the admin's text
     inputs; the page Number()s them before doing math.
     ===================================================== */
var DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  var DAY_FULL = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  var TIMES = ["Morning","Midday","Afternoon"];
  var LENGTHS = ["20","30","45"];
  var WEEKS_PER_MONTH = 4.3;

  /* Builder state survives re-renders (admin edits arrive via content.json). */
  var B = { svc: 0, len: "30", days: [false,false,false,false,false,false,false], times: [1,1,1,1,1,1,1] };

  /* ---------- render ---------- */
  function renderContent(c){
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = c.brand.name; });
    document.querySelectorAll('[data-city]').forEach(function(el){ el.textContent = c.brand.city; });
    var telLink = telHref(c.brand.phone);
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = c.brand.phone; });
    document.querySelectorAll('[data-phone-link]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = 'Call or text ' + c.brand.phone; });
    document.querySelectorAll('.mobile-cta .call').forEach(function(el){ el.href = 'tel:' + telLink; });
    document.querySelectorAll('.mobile-cta .text').forEach(function(el){ el.href = 'sms:' + telLink + '?body=' + encodeURIComponent('Hi ' + c.brand.name + ', can you walk my dog?'); });

    // trust stats
    document.getElementById('trustStats').innerHTML = c.stats.map(function(s){
      return '<div class="tstat"><b>' + esc(s.num) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');

    // services
    var icos = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15c2-6 7-9 12-7l4-2-2 4c1 5-3 9-8 9-2 0-3.5-.5-4.5-1.5L2 19z"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M4 20c0-3 2-5 5-5h6c3 0 5 2 5 5"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 9v11h14V9"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>'
    ];
    document.getElementById('svcGrid').innerHTML = c.services.map(function(s, i){
      return '<div class="scard"><span class="s-ico">' + icos[i % icos.length] + '</span><h3>' + esc(s.label) + '</h3><p>' + esc(s.desc) + '</p><div class="s-price">' + esc(s.price_label) + '</div></div>';
    }).join('');

    // service select in booking form
    var svcSel = document.getElementById('qSvc');
    svcSel.innerHTML = c.services.map(function(s){
      return '<option value="' + esc(s.label) + '">' + esc(s.label) + '</option>';
    }).join('') + '<option value="Not sure yet">Not sure yet</option>';

    // walk week builder
    renderBuilder(c);
    document.getElementById('builderNote').textContent = (c.walkSettings || {}).note || '';

    // how it works
    document.getElementById('howGrid').innerHTML = c.howItWorks.map(function(st){
      return '<div class="how-card"><h3>' + esc(st.title) + '</h3><p>' + esc(st.desc) + '</p></div>';
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

  /* ---------- walk week builder ---------- */
  function builderSvcs(c){ return (c.walkServices && c.walkServices.length) ? c.walkServices : []; }

  function renderBuilder(c){
    var svcs = builderSvcs(c);
    if(B.svc >= svcs.length) B.svc = 0;               // stale-index guard after admin edits
    if(LENGTHS.indexOf(B.len) < 0) B.len = LENGTHS[1];

    document.getElementById('svcOpts').innerHTML = svcs.map(function(s, i){
      return '<button type="button" class="b-opt" data-bsvc="' + i + '" aria-pressed="' + (i === B.svc) + '">' +
        esc(s.label) + '<small>' + esc(s.desc) + '</small></button>';
    }).join('');

    var cur = svcs[B.svc];
    document.getElementById('lenOpts').innerHTML = LENGTHS.map(function(L){
      var r = cur ? Number(cur['rate' + L]) || 0 : 0;
      return '<button type="button" class="b-opt" data-blen="' + L + '" aria-pressed="' + (L === B.len) + '">' +
        L + ' min<small>$' + r + ' / visit</small></button>';
    }).join('');

    document.getElementById('weekGrid').innerHTML = DAYS.map(function(d, i){
      var on = B.days[i];
      return '<div class="wday">' +
        '<button type="button" class="wday-t" data-bday="' + i + '" aria-pressed="' + on + '" aria-label="' + DAY_FULL[i] + (on ? ' — selected' : '') + '">' +
          d + '<small>' + (on ? esc(B.len) + ' min' : '&nbsp;') + '</small></button>' +
        '<button type="button" class="wday-time" data-btime="' + i + '"' + (on ? '' : ' hidden') +
          ' aria-label="' + DAY_FULL[i] + ' time of day: ' + TIMES[B.times[i]] + ' — activate to change">' + esc(TIMES[B.times[i]]) + '</button>' +
        '</div>';
    }).join('');

    renderPrice(c);

    var wrap = document.getElementById('builder');
    if(!wrap._wired){
      wrap._wired = true;
      wrap.addEventListener('click', function(e){
        var b = e.target.closest('[data-bsvc],[data-blen],[data-bday],[data-btime]');
        if(!b) return;
        if(b.hasAttribute('data-bsvc')){ B.svc = +b.getAttribute('data-bsvc'); }
        else if(b.hasAttribute('data-blen')){ B.len = b.getAttribute('data-blen'); }
        else if(b.hasAttribute('data-bday')){ var i = +b.getAttribute('data-bday'); B.days[i] = !B.days[i]; }
        else if(b.hasAttribute('data-btime')){ var j = +b.getAttribute('data-btime'); B.times[j] = (B.times[j] + 1) % TIMES.length; }
        renderBuilder(CONTENT);
      });
    }
  }

  function planMath(c){
    var svcs = builderSvcs(c);
    var svc = svcs[B.svc];
    if(!svc) return null;
    var n = B.days.filter(Boolean).length;
    var rate = Number(svc['rate' + B.len]) || 0;
    var ws = c.walkSettings || {};
    var pct = n >= 5 ? (Number(ws.fiveDayPct) || 0) : n >= 3 ? (Number(ws.threeDayPct) || 0) : 0;
    var monthly = Math.round(rate * n * WEEKS_PER_MONTH * (1 - pct / 100));
    return { svc: svc, n: n, rate: rate, pct: pct, monthly: monthly };
  }

  function renderPrice(c){
    var out = document.getElementById('priceOut');
    var m = planMath(c);
    if(!m || !m.n){
      out.innerHTML = '<p class="bp-empty">Pick at least one day to see your plan.</p>';
      return;
    }
    var discChip = m.pct ? '<span class="bp-disc">' + (m.n >= 5 ? '5-day pack' : '3+ days') + ' — ' + m.pct + '% off</span>' : '';
    out.innerHTML =
      '<div class="bp-num">$' + m.monthly + '<span> / month</span></div>' +
      '<p class="bp-meta">' + m.n + (m.n === 1 ? ' visit' : ' visits') + ' a week · ' + esc(m.svc.label) + ' · ' +
        esc(B.len) + ' min · $' + m.rate + ' per visit</p>' + discChip;
  }

  function builderSummary(c){
    var m = planMath(c);
    if(!m || !m.n) return '';
    var days = DAYS.filter(function(_, i){ return B.days[i]; }).map(function(d, k){
      var idx = DAYS.indexOf(d);
      return d + ' (' + TIMES[B.times[idx]].toLowerCase() + ')';
    }).join(', ');
    return 'From the week builder: ' + m.svc.label + ' · ' + B.len + ' min · ' + days + ' · about $' + m.monthly + '/mo';
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

  /* ---------- builder -> booking form handoff ---------- */
  document.getElementById('builderCta').addEventListener('click', function(){
    var m = planMath(CONTENT);
    if(!m || !m.n) return; // still scrolls to the form via the anchor
    var sel = document.getElementById('qSvc');
    var firstWord = (m.svc.label || '').split(/\s+/)[0].toLowerCase();
    var matched = false;
    Array.prototype.forEach.call(sel.options, function(o){
      if(!matched && o.value.toLowerCase().indexOf(firstWord) === 0){ sel.value = o.value; matched = true; }
    });
    if(!matched) sel.value = 'Not sure yet';
    var notes = document.getElementById('qNotes');
    var summary = builderSummary(CONTENT);
    if(summary && notes.value.indexOf('From the week builder:') < 0){
      notes.value = summary + (notes.value ? '\n' + notes.value : '');
    }
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
      dog: document.getElementById('qDog').value.trim() || '(not given)',
      service: document.getElementById('qSvc').value,
      notes: document.getElementById('qNotes').value.trim(),
      _subject: CONTENT.brand.name + ' — new meet & greet request from ' + name,
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
      submitBtn.textContent = 'Request my meet & greet';
    });
  });

  /* ---------- boot ---------- */
  /* boot handed to base.js */

  window.renderContent = renderContent;
})();
