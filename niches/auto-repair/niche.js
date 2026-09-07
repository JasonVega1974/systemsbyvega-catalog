/* auto-repair/niche.js — this niche's renderer and interactive logic.
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
     Injected from content.json at build time so the two
     stay byte-consistent — NEW-SITE-CHECKLIST.md rule #2.
     ===================================================== */
/* ---------- render ---------- */
  function renderContent(c){
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = c.brand.name; });
    document.querySelectorAll('[data-city]').forEach(function(el){ el.textContent = c.brand.city; });
    var telLink = telHref(c.brand.phone);
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = c.brand.phone; });
    document.querySelectorAll('[data-phone-link]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = 'Call or text ' + c.brand.phone; });
    document.querySelectorAll('.mobile-cta .call').forEach(function(el){ el.href = 'tel:' + telLink; });
    document.querySelectorAll('.mobile-cta .text').forEach(function(el){ el.href = 'sms:' + telLink + '?body=' + encodeURIComponent('Hi ' + c.brand.name + ', can you take a look at my car?'); });

    // trust stats
    document.getElementById('trustStats').innerHTML = c.stats.map(function(s){
      return '<div class="tstat"><b>' + esc(s.num) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');

    // services
    var icos = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l4.5-4.5"/><path d="M17 21h4"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3 4 6 6.6 6 10a6 6 0 0 1-12 0c0-3.4 3-6 6-10z"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l4-4 4 4 4-4 4 4"/><path d="M4 11l4-4 4 4 4-4 4 4"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5.5 6.5l13 11M18.5 6.5l-13 11"/><circle cx="12" cy="12" r="9"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
    ];
    document.getElementById('svcGrid').innerHTML = c.services.map(function(s, i){
      return '<div class="svc"><span class="s-ico">' + icos[i % icos.length] + '</span><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div>';
    }).join('');

    // sound diagnoser
    renderSounds(c);
    document.getElementById('soundNote').textContent = c.soundNote || '';

    // pricing — rows are {label, blurb}: content.json's house shape for
    // mergePath "pricing" (bin-cleaning convention; the operator-content
    // endpoint overlays admin saves of price_label onto blurb). This read
    // used p.range, a key no row ever carried, so the demo rendered blank.
    document.getElementById('priceList').innerHTML = c.pricing.map(function(p){
      return '<div class="prow"><span class="job">' + esc(p.label) + '</span><span class="dots"></span><span class="rng">' + esc(p.blurb || '') + '</span></div>';
    }).join('');
    document.getElementById('pricingNote').textContent = c.pricingNote || '';

    // process
    document.getElementById('howGrid').innerHTML = c.process.map(function(st){
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

  /* ---------- sound diagnoser: pills + result panel ---------- */
  var selSound = '', selWhen = '';
  function renderSounds(c){
    document.getElementById('soundPills').innerHTML = (c.sounds || []).map(function(s){
      return '<button type="button" class="spill" data-sound="' + esc(s.id) + '" aria-pressed="false">' + esc(s.label) + '</button>';
    }).join('');
    document.getElementById('whenPills').innerHTML = (c.soundWhens || []).map(function(w){
      return '<button type="button" class="spill when" data-when="' + esc(w.id) + '" aria-pressed="false">' + esc(w.label) + '</button>';
    }).join('');

    var wrap = document.getElementById('sounds');
    if(!wrap._wired){
      wrap._wired = true;
      wrap.addEventListener('click', function(e){
        var sb = e.target.closest('[data-sound]');
        var wb = e.target.closest('[data-when]');
        if(sb){ selSound = sb.getAttribute('data-sound'); }
        if(wb){ selWhen = wb.getAttribute('data-when'); }
        if(sb || wb) syncSounds();
      });
    }
    syncSounds();
  }

  function syncSounds(){
    var c = CONTENT;
    var soundOk = (c.sounds || []).some(function(s){ return s.id === selSound; });
    var whenOk = (c.soundWhens || []).some(function(w){ return w.id === selWhen; });
    if(!soundOk) selSound = '';
    if(!whenOk) selWhen = '';
    document.querySelectorAll('#sounds [data-sound]').forEach(function(el){
      var on = el.getAttribute('data-sound') === selSound;
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('#sounds [data-when]').forEach(function(el){
      var on = el.getAttribute('data-when') === selWhen;
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // light up the rendered bay for the chosen sound (physics-eased, additive)
    setCarZone(selSound ? zoneFor(selSound, selWhen) : '');
    var box = document.getElementById('soundResult');
    if(!selSound || !selWhen){
      var prompt = !selSound && !selWhen ? 'Pick a sound and a moment — we\'ll tell you what it usually means.'
        : (!selWhen ? 'Now pick when you hear it.' : 'Now pick the sound itself.');
      box.innerHTML = '<p class="sr-empty">' + prompt + '</p>';
      return;
    }
    var r = (c.soundResults || []).filter(function(x){ return x.sound === selSound && x.when === selWhen; })[0] || c.soundFallback || {};
    var sLbl = labelOf(c.sounds, selSound), wLbl = labelOf(c.soundWhens, selWhen);
    var culprits = String(r.culprits || '').split('\n').filter(Boolean).map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('');
    box.innerHTML =
      '<p class="sr-combo">' + esc(sLbl) + ' · ' + esc(wLbl) + '</p>' +
      '<h3>Usual suspects</h3><ul>' + culprits + '</ul>' +
      '<h3>What we\'d do</h3><p class="sr-covers">' + esc(r.covers || '') + '</p>' +
      '<p class="sr-range">' + esc(r.range || '') + '</p>' +
      (r.caveat ? '<p class="sr-caveat">' + esc(r.caveat) + '</p>' : '') +
      '<p class="sr-cta"><a class="btn-pri" href="#book">Book the look</a></p>';
  }
  function labelOf(arr, id){
    var hit = (arr || []).filter(function(x){ return x.id === id; })[0];
    return hit ? hit.label : id;
  }

  /* ---------- rendered-bay zone highlight ----------
     Physics-eased glow, mirroring the north-star's requestAnimationFrame
     decay loop (dj-site-blue/index.html line 1524). Each zone runs a small
     spring toward a target (1 = lit, 0 = dark) with a touch of overshoot so
     the highlight "pops" then settles. Purely presentational + additive:
     the sound/timing/result DATA still binds from content.json. */
  var carEls = {
    brakes: document.getElementById('carZoneBrakes'),
    engine: document.getElementById('carZoneEngine'),
    suspension: document.getElementById('carZoneSuspension')
  };
  var carLabelEl = document.getElementById('carZoneLabel');
  var carZoneNames = { brakes: 'Front brakes', engine: 'Engine bay', suspension: 'Suspension & wheels' };
  var carDefaultLabel = carLabelEl ? carLabelEl.textContent : '';
  var carState = { brakes:{x:0,v:0,t:0}, engine:{x:0,v:0,t:0}, suspension:{x:0,v:0,t:0} };
  var carKeys = ['brakes','engine','suspension'];
  var carRAF = null, carLast = 0, carActive = '';

  // map a chosen sound + moment to the mechanical zone we'd inspect
  function zoneFor(sound, when){
    if(when === 'braking') return 'brakes';
    if(sound === 'squeal' && (when === 'cold' || when === 'turning')) return 'engine';
    var m = { squeal:'brakes', grind:'brakes', knock:'engine', hiss:'engine',
              clunk:'suspension', hum:'suspension', click:'suspension' };
    return m[sound] || 'engine';
  }

  function applyCarState(){
    carKeys.forEach(function(k){
      var el = carEls[k]; if(!el) return;
      var x = carState[k].x;
      el.style.opacity = Math.max(0, Math.min(1, x));
      el.style.transform = 'scale(' + (0.9 + 0.1 * Math.max(0, Math.min(1.12, x))) + ')';
    });
  }

  function carTick(now){
    var dt = Math.min(0.05, (now - carLast) / 1000 || 0.016); carLast = now;
    var STIFF = 210, DAMP = 22, moving = false;   // slight overshoot -> physical pop
    carKeys.forEach(function(k){
      var s = carState[k];
      var a = -STIFF * (s.x - s.t) - DAMP * s.v;
      s.v += a * dt; s.x += s.v * dt;
      if(Math.abs(s.x - s.t) > 0.001 || Math.abs(s.v) > 0.001){ moving = true; }
      else { s.x = s.t; s.v = 0; }
    });
    applyCarState();
    carRAF = moving ? requestAnimationFrame(carTick) : null;
  }

  function setCarZone(zone){
    carActive = zone || '';
    carKeys.forEach(function(k){ carState[k].t = (k === zone) ? 1 : 0; });
    if(carLabelEl){
      carLabelEl.textContent = zone ? ('Checking: ' + (carZoneNames[zone] || zone)) : carDefaultLabel;
    }
    if(!carEls.brakes) return;
    if(reduce){   // reduced-motion: snap to target, no animation loop
      carKeys.forEach(function(k){ carState[k].x = carState[k].t; carState[k].v = 0; });
      applyCarState();
      return;
    }
    carLast = performance.now();
    if(!carRAF){ carRAF = requestAnimationFrame(carTick); }
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
      vehicle: document.getElementById('qVehicle').value.trim() || '(not given)',
      issue: document.getElementById('qIssue').value.trim(),
      dropoff: document.getElementById('qWhen').value,
      _subject: CONTENT.brand.name + ' — new booking request from ' + name,
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
      submitBtn.textContent = 'Get me a straight answer';
    });
  });

  /* ---------- boot ---------- */
  /* boot handed to base.js */

  window.renderContent = renderContent;
})();
