/* bin-cleaning/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via SL; the aliases below keep
   every extracted call site unchanged. base.js owns the reduced-motion flag,
   the reveal observer (once, at boot), the content fetch/merge lifecycle, and
   calling window.renderContent(). Because renderContent replaces innerHTML on
   every dynamic region on EVERY call (including the post-fetch re-render),
   this file keeps its own revealScan so freshly-created .reveal nodes are
   re-observed — base.js's initReveal() only runs once, at boot.
   val/setErr/showDone are NOT aliased — this niche defines its own with
   different signatures. */
(function () {
  'use strict';

  var SL = window.SL;
  var esc = SL.esc, num = SL.num, telHref = SL.telHref, telDigits = SL.telDigits;
  var CONTENT = window.DEFAULT_CONTENT;

  /* Shared quote/paren stripper for anything interpolated into a CSS url("…")
     or an img src attribute — symmetric with contracting/niche.js's cssUrl(). */
  function safeUrl(u){ return String(u || '').replace(/["\\)]/g, ''); }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =====================================================
     OWNER-EDITABLE CONTENT
     DEFAULT_CONTENT ships with the page and renders
     immediately. content.json (repo root, edited from
     /admin/) is fetched at runtime and merged over it —
     stats, trust strip, pricing, process, owner, FAQ,
     reviews and the footer all re-render from the merged
     object. Keep content.json's shape in sync with this
     const.
     ===================================================== */
  /* Lead delivery — no backend. FormSubmit needs no account, but the FIRST
     real submission emails a one-time activation link to LEAD.email; click it
     once and every sign-up after that lands in that inbox, formatted as a
     table. */
  var LEAD = { provider: 'formsubmit', email: '', sms: '' };

  function applyRuntime(c){
    LEAD.email = (c.brand||{}).leadEmail || LEAD.email;
    LEAD.sms = telDigits((c.brand||{}).phone);
  }
  applyRuntime(CONTENT);

  /* photo slots: operator URLs (merged content) or dashed placeholders */
  function applyPhotos(c){
    var n = c.niche || {};
    var ba = document.getElementById('ba');
    /* Fall back both-or-neither: a lone operator photo paired with Prime's demo
       photo would present a fabricated before/after pair as one real bin. */
    var hasBoth = !!(n.beforeImg && n.afterImg);
    var before = hasBoth ? n.beforeImg : '/sites/bin-cleaning/photos/before.jpg';
    var after  = hasBoth ? n.afterImg  : '/sites/bin-cleaning/photos/after.jpg';
    if (ba) {
      ba.style.setProperty('--before-img', 'url("' + safeUrl(before) + '")');
      ba.style.setProperty('--after-img',  'url("' + safeUrl(after)  + '")');
      /* the slider is meaningless with a placeholder on either side */
      var wrap = ba.closest('.ba-wrap');
      if (wrap) wrap.classList.toggle('slot-empty', !hasBoth && !before);
    }
    var cityEl = document.getElementById('baCity');
    if (cityEl) cityEl.textContent = (c.brand || {}).city || 'Nampa';
    var logo = (c.brand || {}).logo;
    [].forEach.call(document.querySelectorAll('.logo-img'), function (el) {
      if (logo) el.style.backgroundImage = 'url("' + safeUrl(logo) + '")';
      el.classList.toggle('slot-empty', !logo);
    });
    var op = document.getElementById('ownerPhoto');
    if (op) {
      var ph = (c.owner || {}).photo;
      if (ph) op.innerHTML = '<img src="' + safeUrl(ph) + '" alt="' + esc((c.owner||{}).name||'The owner') + '" loading="lazy">';
      op.classList.toggle('slot-empty', !ph);
    }
  }

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

  // ---------- falling water droplets in hero ----------
  var drops = document.getElementById('drops');
  if(drops && !reduce){
    var n = window.innerWidth < 700 ? 10 : 18;
    for(var i=0;i<n;i++){
      var d = document.createElement('span');
      d.className = 'drop';
      d.style.left = Math.random()*100 + '%';
      var dur = 3.5 + Math.random()*4;
      d.style.animationDuration = dur + 's';
      d.style.animationDelay = (-Math.random()*dur) + 's';
      d.style.opacity = 0.3 + Math.random()*0.5;
      d.style.height = (10 + Math.random()*12) + 'px';
      drops.appendChild(d);
    }
  }

  /* =====================================================
     SIGNATURE — before/after power-wash slider
     pointer + keyboard drag, --pos CSS var, gentle
     auto-nudge on first view (skipped under reduced motion).
     ===================================================== */
  var ba = document.getElementById('ba');
  if(ba){
    var pos = 50, dragging = false, touched = false;
    var setPos = function(p){
      pos = Math.max(0, Math.min(100, p));
      ba.style.setProperty('--pos', pos + '%');
      ba.setAttribute('aria-valuenow', Math.round(pos));
    };
    var xToPct = function(clientX){
      var r = ba.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 100;
    };
    var start = function(e){
      dragging = true; ba.classList.add('spraying');
      if(!touched){ touched = true; ba.classList.add('touched'); }
      move(e);
    };
    var move = function(e){
      if(!dragging) return;
      var x = (e.touches ? e.touches[0].clientX : e.clientX);
      setPos(xToPct(x));
      if(e.cancelable) e.preventDefault();
    };
    var end = function(){ dragging = false; ba.classList.remove('spraying'); };

    ba.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move, {passive:false});
    window.addEventListener('mouseup', end);
    ba.addEventListener('touchstart', start, {passive:false});
    window.addEventListener('touchmove', move, {passive:false});
    window.addEventListener('touchend', end);

    // keyboard
    ba.addEventListener('keydown', function(e){
      if(e.key === 'ArrowLeft'){ setPos(pos-4); e.preventDefault(); if(!touched){touched=true;ba.classList.add('touched');} }
      if(e.key === 'ArrowRight'){ setPos(pos+4); e.preventDefault(); if(!touched){touched=true;ba.classList.add('touched');} }
    });

    // gentle auto-nudge on first view to signal it drags
    if(!reduce && 'IntersectionObserver' in window){
      var io2 = new IntersectionObserver(function(en){
        en.forEach(function(x){
          if(x.isIntersecting && !touched){
            var seq=[68,32,50], k=0;
            var t = setInterval(function(){
              if(touched){ clearInterval(t); return; }
              setPos(seq[k++]); if(k>=seq.length) clearInterval(t);
            }, 520);
            io2.unobserve(ba);
          }
        });
      }, {threshold:.5});
      io2.observe(ba);
    }
  }

  /* =====================================================
     TRUST STRIP
     ===================================================== */
  var TRUST_ICONS = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s6 4 6 10a6 6 0 0 1-12 0C6 6 12 2 12 2z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  ];

  /* =====================================================
     PRICING tiers. Canonical shape (§4.2): pricing[], features
     is an ARRAY, highlight is the flag, label is the name, and
     this niche carries its price in blurb. Renders ALL tiers,
     including the "4+ bins / whole street" group-rate entry —
     it carries no numeric price or features, so it renders as
     a plain call-to-text tile instead of a "Book" button.
     ===================================================== */
  var checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';

  function priceDisplay(blurb){
    var s = String(blurb || '');
    if(s.charAt(0) === '$') return '<sup>$</sup>' + esc(s.slice(1));
    return esc(s);
  }

  function pricingRender(c){
    var brand = c.brand || {};
    var pricing = c.pricing || [];
    document.getElementById('pricingGrid').innerHTML = pricing.map(function(p, i){
      var isPriced = String(p.blurb || '').charAt(0) === '$';
      var feats = (p.features || []).map(function(f){ return '<li>' + checkSvg + esc(f) + '</li>'; }).join('');
      var cta = isPriced
        ? '<a class="btn' + (p.highlight ? '' : ' btn--ghost') + '" href="#book">Book ' + esc(p.label) + '</a>'
        : '<a class="btn btn--ghost" href="' + telHref(brand.phone) + '">Call or text</a>';
      /* the group-rate tile's note carries no phone number of its own (F2) —
         the CURRENT operator phone is appended here, at render time, so it can
         never go stale or leak a different operator's number. */
      var note = p.note ? esc(p.note) + (isPriced ? '' : (brand.phone ? ' ' + esc(brand.phone) : '')) : '';
      return '<div class="tier' + (p.highlight ? ' tier--best' : '') + ' reveal" data-delay="' + ((i % 3) + 1) + '">' +
        '<span class="tier__label">' + esc(p.label) + '</span>' +
        '<div class="tier__price">' + priceDisplay(p.blurb) + '</div>' +
        (p.per ? '<div class="tier__per">' + esc(p.per) + '</div>' : '') +
        (note ? '<div class="tier__note">' + note + '</div>' : '') +
        (feats ? '<ul class="tier__features">' + feats + '</ul>' : '') +
        cta +
      '</div>';
    }).join('');
    document.getElementById('pricingNote').innerHTML = esc(c.groupNote || '') + (brand.phone ? ' ' + esc(brand.phone) : '');
  }

  /* =====================================================
     CANS SELECT — signup form's "how many cans" dropdown,
     rebuilt from c.pricing so an edited price shows up in
     the option text instead of a stale hardcoded label (F6).
     Selection is preserved across re-render where possible.
     ===================================================== */
  function cansSelectRender(c){
    var sel = document.getElementById('s-cans');
    if(!sel) return;
    var prev = sel.value;
    var pricing = c.pricing || [];
    var highlightIdx = 0;
    var labels = pricing.map(function(p, i){
      if(p.highlight) highlightIdx = i;
      var isPriced = String(p.blurb || '').charAt(0) === '$';
      return isPriced
        ? (i + 1) + (i === 0 ? ' can' : ' cans') + ' — ' + p.blurb
        : '4+ cans — group rate';
    });
    sel.innerHTML = labels.map(function(label){
      return '<option value="' + esc(label) + '">' + esc(label) + '</option>';
    }).join('');
    var idx = labels.indexOf(prev);
    sel.selectedIndex = idx > -1 ? idx : highlightIdx;
  }

  /* =====================================================
     CONTENT RENDER — re-paints every owner-editable region
     from the merged CONTENT object. Runs once with the
     inline defaults (no flash) and again if content.json
     loads. Never hard-fails the page.
     ===================================================== */
  var ownerPhotoBox = document.getElementById('ownerPhoto');
  var ownerPhotoAria = ownerPhotoBox.getAttribute('aria-label');

  function renderContent(c){
    applyRuntime(c);
    applyPhotos(c);

    var brand = c.brand || {}, area = c.serviceArea || {}, owner = c.owner || {};
    var social = c.social || [];
    var e164 = telHref(brand.phone);
    var smsBody = encodeURIComponent("Hi " + brand.name + "! I'd like to sign up for bin cleaning.");

    // ----- brand & contact -----
    document.querySelectorAll('[data-brand]').forEach(function(el){
      if (el.id === 'brandName') el.innerHTML = esc(brand.name) + '<span>' + esc(brand.tagline || '') + '</span>';
      else el.textContent = brand.name;
    });
    document.querySelectorAll('[data-tagline]').forEach(function(el){ el.textContent = brand.tagline || ''; });
    document.querySelectorAll('a[href^="tel:"]').forEach(function(a){ a.href = e164; });
    document.querySelectorAll('a[href^="sms:"]').forEach(function(a){ a.href = 'sms:' + telDigits(brand.phone) + '?body=' + smsBody; });
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.textContent = brand.phone; });
    document.getElementById('heroTag').textContent = brand.tagline || '';
    var fe = document.getElementById('footEmail');
    fe.href = 'mailto:' + brand.email; fe.textContent = brand.email;

    // ----- service area -----
    var cities = (area.cities || []).filter(Boolean);
    document.getElementById('footServe').textContent = cities.length
      ? 'Serving ' + cities.join(' & ')
      : 'Serving ' + (area.short || brand.city || '');

    // ----- social links (footer; hidden when empty) -----
    var footSocial = document.getElementById('footSocial');
    if (social.length) {
      footSocial.innerHTML = social.filter(function(s){ return /^https:\/\//i.test(s.url); /* scheme-gated here too, not just in sbv_social_valid — entity encoding cannot stop a scheme, and safeUrl only de-fangs CSS/attr breakout */ }).map(function(s){
        return '<a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent-2)">' + esc(s.label || s.n) + '</a>';
      }).join(' · ');
      footSocial.hidden = false;
    } else {
      footSocial.innerHTML = '';
      footSocial.hidden = true;
    }

    // ----- stats -> hero proof row -----
    document.getElementById('statsRow').innerHTML = (c.stats || []).map(function(s){
      return '<div class="proof"><b>' + esc(s.big) + '</b><span>' + esc(s.small) + '</span></div>';
    }).join('');

    // ----- trust strip -----
    document.getElementById('trustGrid').innerHTML = (c.trust || []).map(function(t, i){
      return '<div class="trust__item">' + (TRUST_ICONS[i % TRUST_ICONS.length]) + esc(t.title) + '</div>';
    }).join('');

    // ----- pricing -----
    pricingRender(c);

    // ----- process -----
    document.getElementById('processGrid').innerHTML = (c.process || []).map(function(st, i){
      return '<div class="step reveal" data-delay="' + ((i % 3) + 1) + '"><span class="step__n"></span><h3>' + esc(st.title) + '</h3><p>' + esc(st.blurb) + '</p></div>';
    }).join('');

    // ----- owner (applyPhotos handles the photo slot itself) -----
    document.getElementById('ownerName').textContent = owner.heading || ('Meet ' + (owner.name || 'the owner'));
    document.getElementById('ownerBio').textContent = owner.bio || '';
    if (!ownerPhotoBox.querySelector('img')) ownerPhotoBox.setAttribute('aria-label', ownerPhotoAria);
    else ownerPhotoBox.setAttribute('aria-label', 'Photo of ' + (owner.name || 'the owner'));

    // ----- faq -----
    document.getElementById('faqList').innerHTML = (c.faq || []).map(function(f, i){
      return '<details class="faq reveal"' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + '<span class="plus">+</span></summary><div class="faq__body">' + esc(f.a) + '</div></details>';
    }).join('');

    // ----- reviews (three static cards; empty-state CSS shows placeholder copy) -----
    var reviewEls = document.querySelectorAll('.review');
    (c.testimonials || []).forEach(function(t, i){
      var el = reviewEls[i];
      if(!el) return;
      el.querySelector('.review__quote').textContent = t.quote || '';
      el.querySelector('.review__who').textContent = t.name ? ('— ' + t.name) : '';
    });

    // ----- cans select in signup form: derived from c.pricing (F6) -----
    cansSelectRender(c);

    revealScan(document);
  }

  /* =====================================================
     SIGN-UP FORM — FormSubmit fetch + sms fallback
     ===================================================== */
  var form = document.getElementById('signupForm');
  var msgEl = document.getElementById('signupMsg');
  var submitBtn = document.getElementById('signupSubmit');

  var val = function(id){ var el = document.getElementById(id); return el ? (el.value||'').trim() : ''; };
  var setErr = function(elOrField, on){
    var f = elOrField && elOrField.closest ? elOrField.closest('.field') : elOrField;
    if(f) f.classList.toggle('invalid', !!on);
  };
  var getDays = function(){
    return [].slice.call(form.querySelectorAll('input[name="days"]:checked')).map(function(c){ return c.value; });
  };

  var buildSms = function(d){
    var body = "Hi " + CONTENT.brand.name + "! I'd like to sign up."
      + " Name: " + d.name + "."
      + " Phone: " + d.phone + "."
      + " Address: " + d.address + (d.city ? ", " + d.city : "") + "."
      + " Cans: " + d.cans + "."
      + " Days: " + (d.days || "any") + "."
      + " How often: " + d.frequency + "."
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
          + 'background:#0b1a30;color:#fff;padding:14px 22px;border-radius:12px;'
          + 'box-shadow:0 12px 40px rgba(0,0,0,.5);border:1px solid rgba(127,215,255,.3);'
          + 'font-family:Inter,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
          + 'opacity:0;transition:opacity .25s ease;';
        document.body.appendChild(t);
      }
      t.innerHTML = 'Call or text us at <strong style="color:var(--accent-2);letter-spacing:.02em">' + esc(CONTENT.brand.phone) + '</strong> from your phone.';
      requestAnimationFrame(function(){ t.style.opacity = '1'; });
      clearTimeout(window.__smsToastTimer);
      window.__smsToastTimer = setTimeout(function(){ t.style.opacity = '0'; }, 4500);
    });
  }

  var showDone = function(phone, smsUrl){
    form.hidden = true;
    var done = document.getElementById('signupDone');
    var dm = document.getElementById('doneMsg');
    if(dm){
      if(isMobile && smsUrl){
        dm.textContent = "We got your info! We'll text you at " + phone + " to lock in your day and price. Opening a text so you can send us a copy too — just hit send.";
      } else {
        dm.textContent = "We got your info! We'll text you at " + phone + " from " + CONTENT.brand.phone + " to lock in your day and price. Keep an eye on your messages.";
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

    var d = {
      name: val('s-name'),
      phone: val('s-phone'),
      address: val('s-addr'),
      city: val('s-city'),
      cans: val('s-cans'),
      days: getDays().join(', '),
      frequency: val('s-freq'),
      notes: val('s-notes')
    };

    var bad = false;
    setErr(document.getElementById('s-name'), !d.name); bad = bad || !d.name;
    var digits = d.phone.replace(/\D/g,'');
    setErr(document.getElementById('s-phone'), digits.length < 7); bad = bad || digits.length < 7;
    setErr(document.getElementById('s-addr'), !d.address); bad = bad || !d.address;
    setErr(document.getElementById('s-city'), !d.city); bad = bad || !d.city;
    var daysField = form.querySelector('.field--days');
    var noDays = getDays().length === 0;
    setErr(daysField, noDays); bad = bad || noDays;
    var consent = document.getElementById('s-consent').checked;

    if(bad){ msgEl.textContent = 'Please fill in the highlighted fields and pick at least one day.'; msgEl.classList.add('err'); return; }
    if(!consent){ msgEl.textContent = 'Please check the consent box so we can text you a confirmation.'; msgEl.classList.add('err'); return; }

    var smsUrl = buildSms(d);
    submitBtn.disabled = true; submitBtn.textContent = 'Reserving…';

    var payload = {
      _subject: 'New bin cleaning sign-up — ' + d.name,
      _template: 'table',
      _captcha: 'false',
      name: d.name, phone: d.phone,
      address: d.address, city: d.city,
      cans: d.cans, days: d.days || 'any',
      frequency: d.frequency,
      notes: d.notes || '—'
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
      submitBtn.disabled = false; submitBtn.textContent = 'Reserve my spot';
      msgEl.classList.add('err');
      if(isMobile){
        msgEl.textContent = "Hmm, that didn't send. Opening a text instead — your info is pre-filled, just hit send.";
        setTimeout(function(){ window.location.href = smsUrl; }, 700);
      } else {
        msgEl.textContent = "Hmm, that didn't send. Call or text us at " + CONTENT.brand.phone + " and we'll get you booked the old-fashioned way.";
      }
    });
  });

  // clear a field's error as the user fixes it
  form.addEventListener('input', function(e){
    var f = e.target.closest && e.target.closest('.field'); if(f) f.classList.remove('invalid');
    if(e.target.name === 'days'){ var df = form.querySelector('.field--days'); if(df) df.classList.remove('invalid'); }
  });

  // paint from the inline defaults immediately, then merge the live override
  /* boot handed to base.js */ // 404 / offline: the defaults stand

  window.renderContent = renderContent;
})();
