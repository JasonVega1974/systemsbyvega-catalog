/* car-detailing/niche.js — this niche's renderer and interactive logic.
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
     packages, add-ons, the hotspot zones, results,
     testimonials, service area, owner and footer all
     re-render from the merged object.
     Keep content.json's shape in sync with this const.
     (Static copy the admin does NOT touch: the JSON-LD
     offers/priceRange in <head> and the meta description.)
     ===================================================== */
/* Lead delivery — no backend. FormSubmit needs no account, but the FIRST real
     submission emails a one-time activation link to LEAD.email; click it once and
     every booking after that lands in that inbox, formatted as a table. */
  var LEAD = { provider: 'formsubmit', email: '', sms: '' };


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

  // ---------- reveal on scroll ----------
  function revealScan(root){
    var revs = (root || document).querySelectorAll('.reveal:not(.in)');
    if('IntersectionObserver' in window && !reduce){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
      }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
      revs.forEach(function(r){ io.observe(r); });
    } else { revs.forEach(function(r){ r.classList.add('in'); }); }
  }
  revealScan(document);

  // ---------- drifting shine sparkles in hero ----------
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
     SIGNATURE — CAR HOTSPOT DIAGRAM
     ===================================================== */
  var diagram   = document.getElementById('detailDiagram');
  var zoneLabel = document.getElementById('zoneLabel');
  var zoneBlurb = document.getElementById('zoneBlurb');
  var zoneChips = document.getElementById('zoneChips');
  var zoneMap   = {};   // id -> {label, blurb}
  var zoneOrder = [];   // ids present, in content order

  function setZone(id){
    if(!zoneMap[id]) return;
    diagram.setAttribute('data-active', id);
    zoneLabel.innerHTML = esc(zoneMap[id].label);
    zoneBlurb.textContent = zoneMap[id].blurb;
    // sync pressed state on hotspots + chips
    diagram.querySelectorAll('.hot').forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-zone') === id)); });
    if(zoneChips){ zoneChips.querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-zone') === id)); }); }
  }

  // hotspot markers (static in markup) — one delegated handler
  diagram.addEventListener('click', function(e){
    var b = e.target.closest('button[data-zone]');
    if(b) setZone(b.getAttribute('data-zone'));
  });

  /* =====================================================
     BOOKING FORM — refs + FormSubmit fetch + sms fallback
     ===================================================== */
  var bPackage  = document.getElementById('b-package');
  var form      = document.getElementById('bookForm');
  var msgEl     = document.getElementById('bookMsg');
  var submitBtn = document.getElementById('bookSubmit');

  // "Book this package" buttons carry the choice into the form (delegated)
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-book-package]');
    if(!b) return;
    var wanted = b.getAttribute('data-book-package');
    if(bPackage){
      var found = Array.prototype.some.call(bPackage.options, function(o){ return o.value === wanted; });
      bPackage.value = found ? wanted : bPackage.value;
    }
    document.getElementById('book').scrollIntoView(reduce ? {} : {behavior:'smooth'});
    setTimeout(function(){ document.getElementById('b-name').focus({preventScroll:true}); }, reduce ? 0 : 650);
  });

  // no past dates
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
    var body = "Hi " + CONTENT.brand.name + "! I'd like to book a detail."
      + " Name: " + d.name + "."
      + " Phone: " + d.phone + "."
      + " Where: " + d.address + (d.city ? ", " + d.city : "") + "."
      + " Vehicle: " + d.vehicle + "."
      + " Package: " + d.package + "."
      + " Date: " + d.preferred_date + " (" + d.time_window + ")."
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
          + 'background:#0b1017;color:#EDF3F7;padding:14px 22px;border-radius:12px;'
          + 'box-shadow:0 12px 40px rgba(0,0,0,.55);border:1px solid rgba(45,212,206,.35);'
          + 'font-family:Manrope,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
          + 'opacity:0;transition:opacity .25s ease;';
        document.body.appendChild(t);
      }
      t.innerHTML = 'Call or text us at <strong style="color:#5CE8E2;letter-spacing:.02em">' + esc(CONTENT.brand.phone) + '</strong> from your phone.';
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
        dm.textContent = "We got it! We'll text you at " + phone + " to confirm your window. Opening a text so you can send us a copy too — just hit send.";
      } else {
        dm.textContent = "We got it! We'll text you at " + phone + " from " + CONTENT.brand.phone + " to confirm your window. Keep an eye on your messages.";
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
      name: val('b-name'),
      phone: val('b-phone'),
      address: val('b-addr'),
      city: val('b-city'),
      vehicle: val('b-vehicle'),
      package: val('b-package'),
      preferred_date: val('b-date'),
      time_window: val('b-time'),
      notes: val('b-notes')
    };

    var bad = false;
    setErr('b-name', !d.name); bad = bad || !d.name;
    var digits = d.phone.replace(/\D/g,'');
    setErr('b-phone', digits.length < 7); bad = bad || digits.length < 7;
    setErr('b-addr', !d.address); bad = bad || !d.address;
    setErr('b-city', !d.city); bad = bad || !d.city;
    setErr('b-date', !d.preferred_date); bad = bad || !d.preferred_date;
    var consent = document.getElementById('b-consent').checked;

    if(bad){ msgEl.textContent = 'Please fill in the highlighted fields.'; msgEl.classList.add('err'); return; }
    if(!consent){ msgEl.textContent = 'Please check the consent box so we can text you a confirmation.'; msgEl.classList.add('err'); return; }

    var smsUrl = buildSms(d);
    submitBtn.disabled = true; submitBtn.textContent = 'Sending…';

    var payload = {
      _subject: 'New detail booking — ' + d.name + ' (' + d.package + ')',
      _template: 'table',
      _captcha: 'false',
      name: d.name, phone: d.phone,
      address: d.address, city: d.city,
      vehicle: d.vehicle, package: d.package,
      preferred_date: d.preferred_date,
      time_window: d.time_window,
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
      submitBtn.disabled = false; submitBtn.textContent = 'Book my detail';
      msgEl.classList.add('err');
      if(isMobile){
        msgEl.textContent = "Hmm, that didn't send. Opening a text instead — your info is pre-filled, just hit send.";
        setTimeout(function(){ window.location.href = smsUrl; }, 700);
      } else {
        msgEl.textContent = "Hmm, that didn't send. Call or text us at " + CONTENT.brand.phone + " and we'll book you the old-fashioned way.";
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

  var checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  var starIcon  = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3 6.9 7.5.6-5.7 5 1.7 7.4L12 24l-6.5-.1 1.7-7.4L1.5 9.5 9 8.9z"/></svg>';

  function renderContent(c){
    applyRuntime(c);
    var brand = c.brand || {}, area = c.serviceArea || {}, owner = c.owner || {};
    var packages = c.pricing || [], addons = c.addons || [], zones = c.zones || [];
    var results = c.results || [], testimonials = c.testimonials || [], social = c.social || [];
    var notes = c.notes || {};
    var e164 = telHref(brand.phone);
    var smsBody = encodeURIComponent("Hi " + brand.name + "! I'd like to book a detail.");

    // ----- brand & contact -----
    document.getElementById('brandName').innerHTML = esc(brand.name) + '<span>Mobile detailing · ' + esc((area.short || '').replace(/^the\s+/i,'')) + '</span>';
    document.querySelectorAll('a[href^="tel:"]').forEach(function(a){ a.href = 'tel:' + e164; });
    document.querySelectorAll('a[href^="sms:"]').forEach(function(a){ a.href = 'sms:' + e164 + '?body=' + smsBody; });
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.textContent = brand.phone; });
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = brand.name; });
    document.querySelectorAll('[data-tagline]').forEach(function(el){ el.textContent = brand.tagline; });
    var fe = document.getElementById('footEmail');
    fe.href = 'mailto:' + brand.email; fe.textContent = brand.email;

    // ----- service area -----
    document.getElementById('heroEyebrow').textContent = 'Mobile car detailing · ' + area.region;
    var cities = (area.cities || []).filter(Boolean);
    document.getElementById('footServe').textContent = 'Serving ' + cities.join(' · ');
    document.getElementById('faqDeliver').innerHTML = cities.map(esc).join(', ')
      + ' and everything in between — <b>the whole ' + esc(String(area.short || '').replace(/^the\s+/i,'')) + '.</b>'
      + " Just outside the ring? Text us your address; if the route works we'll make it work.";

    // ----- social links (footer; hidden when empty) -----
    document.getElementById('footSocial').innerHTML = social.length
      ? social.map(function(s){
          return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--gloss-bright)">' + esc(s.n) + '</a>';
        }).join(' · ') + '<br />'
      : '';

    // ----- packages: cards + booking select -----
    document.getElementById('packageGrid').innerHTML = packages.map(function(p, i){
      var items = p.features || [];
      return '<div class="pkg' + (p.highlight ? ' pkg--best' : '') + ' reveal" data-delay="' + ((i % 3) + 1) + '">'
        + (p.highlight ? '<span class="pkg__flag">Our pick</span>' : '')
        + '<div class="pkg__name">' + esc(p.label) + '</div>'
        + (p.per ? '<div class="pkg__dur">' + esc(p.per) + '</div>' : '')
        + '<div class="pkg__price">$' + num(p.blurb) + '<small>flat</small></div>'
        + (p.tagline ? '<p class="pkg__best">' + esc(p.tagline) + '</p>' : '')
        + '<ul class="pkg__list">' + items.map(function(it){ return '<li>' + checkIcon + '<span>' + esc(it) + '</span></li>'; }).join('') + '</ul>'
        + '<button class="btn' + (p.highlight ? '' : ' btn--ghost') + '" type="button" data-book-package="' + esc(p.label) + '">Book ' + esc(p.label) + '</button>'
        + '</div>';
    }).join('');

    if(bPackage){
      var prevPkg = bPackage.value;
      bPackage.innerHTML = packages.map(function(p){
        return '<option value="' + esc(p.label) + '">' + esc(p.label) + ' — $' + num(p.blurb) + '</option>';
      }).join('') + '<option value="Not sure — help me pick">Not sure — help me pick</option>';
      var names = packages.map(function(p){ return p.label; });
      bPackage.value = (prevPkg && (names.indexOf(prevPkg) >= 0 || prevPkg === 'Not sure — help me pick'))
        ? prevPkg : (packages[0] ? packages[0].label : '');
    }
    document.getElementById('pkgNote').textContent = notes.pkgAddon || '';

    // ----- add-ons -----
    document.getElementById('addonGrid').innerHTML = addons.map(function(a){
      return '<div class="addon">'
        + '<div class="addon__top"><span class="addon__name">' + esc(a.name) + '</span>'
        + '<span class="addon__price">+$' + num(a.price) + '</span></div>'
        + (a.desc ? '<p class="addon__desc">' + esc(a.desc) + '</p>' : '')
        + '</div>';
    }).join('');
    document.getElementById('addonFoot').textContent = notes.addonFoot || '';

    // ----- hotspot zones -----
    zoneMap = {}; zoneOrder = [];
    zones.forEach(function(z){ if(z && z.id){ zoneMap[z.id] = { label: z.label || z.id, blurb: z.blurb || '' }; zoneOrder.push(z.id); } });
    // hide hotspots whose zone was removed; label the rest
    diagram.querySelectorAll('.hot').forEach(function(b){
      var id = b.getAttribute('data-zone');
      if(zoneMap[id]){ b.style.display = ''; b.title = zoneMap[id].label; b.querySelector('.hp').textContent = zoneMap[id].label; }
      else { b.style.display = 'none'; }
    });
    // chips (a11y + a fallback way to browse the zones)
    if(zoneChips){
      zoneChips.innerHTML = zoneOrder.map(function(id){
        return '<button type="button" data-zone="' + esc(id) + '" aria-pressed="false">' + esc(zoneMap[id].label) + '</button>';
      }).join('');
    }
    var active = diagram.getAttribute('data-active');
    setZone(zoneMap[active] ? active : (zoneOrder[0] || 'paint'));

    // ----- results gallery (empty-state when no photos) -----
    var rg = document.getElementById('resultsGrid');
    if(results.length){
      rg.classList.remove('results-empty-wrap');
      rg.innerHTML = results.map(function(r){
        return '<figure class="result">'
          + (r.image ? '<img src="' + esc(r.image) + '" alt="' + esc(r.caption || 'Detailed car') + '" loading="lazy" />' : '')
          + (r.caption ? '<figcaption class="result__cap">' + esc(r.caption) + '</figcaption>' : '')
          + '</figure>';
      }).join('');
    } else {
      rg.innerHTML = '<div class="results-empty" style="grid-column:1/-1">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M3 17l5-4 4 3 3-2 6 5"/></svg>'
        + '<p>Before-and-after shots land here soon</p></div>';
    }

    // ----- testimonials (empty-state when none) -----
    var tg = document.getElementById('testimonialGrid');
    if(testimonials.length){
      /* Stars render the review's OWN rating, never a flat five: flattening
         a real customer's 3-star words into 5 stars misrepresents them, and
         a missing rating shows no stars rather than an invented one. */
      tg.innerHTML = testimonials.map(function(t){
        var n = Math.max(0, Math.min(5, parseInt(t.rating, 10) || 0));
        var stars = n ? '<div class="quote__stars" aria-hidden="true">' + new Array(n + 1).join(starIcon) + '</div>' : '';
        return '<figure class="quote">'
          + stars
          + '<blockquote class="quote__body">' + esc(t.quote || '') + '</blockquote>'
          + '<figcaption class="quote__who">' + esc(t.name || '') + '</figcaption>'
          + '</figure>';
      }).join('');
    } else {
      /* Empty state carries NO stars and no invented reviewer — a rating
         with nothing behind it is fabricated proof, even on a placeholder. */
      tg.innerHTML = [1,2,3].map(function(){
        return '<figure class="quote">'
          + '<blockquote class="quote__body"></blockquote>'
          + '<figcaption class="quote__who">&mdash; Add a real review here</figcaption>'
          + '</figure>';
      }).join('');
    }

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
        cap.textContent = first ? first.toUpperCase() + ' RUNS EVERY JOB HIMSELF' : '';
      }
    }

    // re-arm reveal for any freshly injected nodes
    revealScan(document);
  }

  // paint from the inline defaults immediately, then merge the live override
  /* boot handed to base.js */ // 404 / offline: the defaults stand

  window.renderContent = renderContent;
})();
