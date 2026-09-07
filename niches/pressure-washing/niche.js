/* pressure-washing/niche.js — this niche's renderer and interactive logic.
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
     the surfaces grid, pricing cards, booking form, footer,
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

  // ---------- reveal on scroll (re-armed for JS-rendered nodes, see revealScan) ----------
  var io = null;
  if('IntersectionObserver' in window && !reduce){
    io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
  }
  function revealScan(root){
    var nodes = (root || document).querySelectorAll('.reveal:not([data-rv])');
    nodes.forEach(function(r){
      r.setAttribute('data-rv', '1');
      if(io) io.observe(r); else r.classList.add('in');
    });
  }
  revealScan(document);

  // ---------- drifting droplets in hero backdrop ----------
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
      m.style.width = s + 'px'; m.style.height = (s*1.4) + 'px';
      motes.appendChild(m);
    }
  }


  /* signature animation extracted to scene.js */


  /* =====================================================
     BOOKING FORM — FormSubmit fetch + sms fallback
     ===================================================== */
  var form = document.getElementById('bookForm');
  var msgEl = document.getElementById('bookMsg');
  var submitBtn = document.getElementById('bookSubmit');
  var bService = document.getElementById('b-service');
  var bSummary = document.getElementById('b-summary');

  // no past service dates
  var bDate = document.getElementById('b-date');
  var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  bDate.min = today.toISOString().slice(0,10);

  var val = function(id){ var el = document.getElementById(id); return el ? (el.value||'').trim() : ''; };
  var setErr = function(id, on){
    var el = document.getElementById(id);
    var f = el && el.closest('.field');
    if(f) f.classList.toggle('invalid', !!on);
  };

  function pickPackage(name, price){
    bService.value = name;
    bSummary.value = name + ' — $' + num(price) + ' flat';
    document.getElementById('book').scrollIntoView(reduce ? {} : {behavior:'smooth'});
    setTimeout(function(){ document.getElementById('b-name').focus({preventScroll:true}); }, reduce ? 0 : 650);
  }
  window.__ggpPickPackage = pickPackage; // wired to each pricing card's button in renderContent

  var buildSms = function(d){
    var body = "Hi " + CONTENT.brand.name + "! I'd like to book a powerwash."
      + " Name: " + d.name + "."
      + " Phone: " + d.phone + "."
      + " Address: " + d.address + (d.city ? ", " + d.city : "") + "."
      + " Package: " + (d.service === 'unsure' ? 'not sure yet' : d.service) + "."
      + " Preferred date: " + d.preferred_date + "."
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
          + 'background:#03111a;color:#EAF7FB;padding:14px 22px;border-radius:12px;'
          + 'box-shadow:0 12px 40px rgba(0,0,0,.55);border:1px solid rgba(34,211,238,.35);'
          + 'font-family:Manrope,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
          + 'opacity:0;transition:opacity .25s ease;';
        document.body.appendChild(t);
      }
      t.innerHTML = 'Call or text us at <strong style="color:#7FF0FF;letter-spacing:.02em">' + esc(CONTENT.brand.phone) + '</strong> from your phone.';
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
        dm.textContent = "We got it! We'll text you at " + phone + " to confirm your appointment window. Opening a text so you can send us a copy too — just hit send.";
      } else {
        dm.textContent = "We got it! We'll text you at " + phone + " from " + CONTENT.brand.phone + " to confirm your appointment window. Keep an eye on your messages.";
      }
    }
    if(done){ done.hidden = false; done.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'center'}); }
    if(smsUrl && isMobile){ setTimeout(function(){ window.location.href = smsUrl; }, 900); }
  };

  form.addEventListener('submit', function(e){
    e.preventDefault();
    msgEl.textContent = ''; msgEl.className = 'book__msg';

    if(form.querySelector('input[name="_honey"]').value){ showDone('your number', ''); return; }

    var d = {
      name: val('b-name'),
      phone: val('b-phone'),
      address: val('b-addr'),
      city: val('b-city'),
      service: val('b-service'),
      preferred_date: val('b-date'),
      notes: val('b-notes'),
      config_summary: val('b-summary')
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
      _subject: 'New powerwash booking — ' + d.name + ' (' + (d.service === 'unsure' ? 'package TBD' : d.service) + ')',
      _template: 'table',
      _captcha: 'false',
      name: d.name, phone: d.phone,
      address: d.address, city: d.city,
      service: d.service === 'unsure' ? 'Not sure — help them pick' : d.service,
      preferred_date: d.preferred_date,
      notes: d.notes || '—',
      config_summary: d.config_summary || '— (no package picked yet)'
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
      submitBtn.disabled = false; submitBtn.textContent = 'Book my wash';
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

  var SURF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

  function parseFeatures(str){
    return String(str || '').split(/\n+/).map(function(s){ return s.trim(); }).filter(Boolean);
  }

  function renderContent(c){
    applyRuntime(c);
    var brand = c.brand || {}, area = c.serviceArea || {}, owner = c.owner || {};
    var surfaces = c.surfaces || [], pricing = c.pricing || [], testimonials = c.testimonials || [], social = c.social || [];
    var e164 = telHref(brand.phone);
    var smsBody = encodeURIComponent("Hi " + brand.name + "! I'd like to book a powerwash.");

    // ----- brand & contact -----
    document.getElementById('brandName').innerHTML = esc(brand.name) + '<span>' + esc((brand.city || area.short || '')) + '</span>';
    document.querySelectorAll('a[href^="tel:"]').forEach(function(a){ a.href = 'tel:' + e164; });
    document.querySelectorAll('a[href^="sms:"]').forEach(function(a){ a.href = 'sms:' + e164 + '?body=' + smsBody; });
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.textContent = brand.phone; });
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = brand.name; });
    document.querySelectorAll('[data-tagline]').forEach(function(el){ el.textContent = brand.tagline; });
    var fe = document.getElementById('footEmail');
    fe.href = 'mailto:' + brand.email; fe.textContent = brand.email;

    // ----- service area -----
    document.getElementById('heroEyebrow').textContent = 'Pressure washing · ' + area.region;
    var cities = (area.cities || []).filter(Boolean);
    document.getElementById('footServe').textContent = 'Serving ' + cities.join(' · ');
    document.getElementById('faqDeliver').innerHTML = cities.map(esc).join(', ')
      + ' and everything in between — <b>the whole ' + esc(area.short) + '.</b>'
      + " Outside that ring? Text us your address anyway; if a route works we'll make it work.";

    // ----- social links (footer; hidden when empty) -----
    document.getElementById('footSocial').innerHTML = social.length
      ? social.map(function(s){
          return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--aqua-bright)">' + esc(s.n) + '</a>';
        }).join(' · ') + '<br />'
      : '';

    // ----- surfaces we clean -----
    document.getElementById('surfacesGrid').innerHTML = surfaces.map(function(s, i){
      return '<div class="surf-card reveal in" data-delay="' + ((i % 3) + 1) + '">'
        + '<div class="surf-card__ic">' + SURF_ICON + '</div>'
        + '<h3>' + esc(s.name) + '</h3>'
        + '<p>' + esc(s.blurb) + '</p>'
        + '</div>';
    }).join('');

    // ----- pricing tiers -----
    var minPrice = pricing.length ? Math.min.apply(null, pricing.map(function(p){ return num(p.blurb); })) : null;
    if(minPrice != null) document.getElementById('statFrom').textContent = 'From $' + minPrice;

    document.getElementById('pricingGrid').innerHTML = pricing.map(function(p, i){
      var feats = parseFeatures(p.features).map(function(f){
        return '<li>' + CHECK_ICON + '<span>' + esc(f) + '</span></li>';
      }).join('');
      return '<div class="price-card reveal in' + (p.highlight ? ' price-card--best' : '') + '" data-delay="' + ((i % 3) + 1) + '">'
        + (p.highlight ? '<span class="price-card__pill">Most requested</span>' : '')
        + '<div class="price-card__name">' + esc(p.label) + '</div>'
        + '<div class="price-card__amt">$' + num(p.blurb) + '<small>flat</small></div>'
        + '<div class="price-card__unit">' + esc(p.per) + '</div>'
        + '<ul class="price-card__feats">' + feats + '</ul>'
        + (p.note ? '<p class="price-card__note">' + esc(p.note) + '</p>' : '')
        + '<button type="button" class="btn' + (p.highlight ? '' : ' btn--ghost') + '" data-pkg="' + i + '">Book this package</button>'
        + '</div>';
    }).join('');

    // wire "Book this package" buttons (re-bound each render, since innerHTML was replaced)
    document.querySelectorAll('#pricingGrid [data-pkg]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var p = pricing[Number(btn.getAttribute('data-pkg'))];
        if(p) pickPackage(p.label, num(p.blurb));
      });
    });

    // keep the booking select's options in sync with the live tiers
    var prevSel = bService.value;
    bService.innerHTML = pricing.map(function(p){
      return '<option value="' + esc(p.label) + '">' + esc(p.label) + ' — $' + num(p.blurb) + '</option>';
    }).join('') + '<option value="unsure">Not sure — help me pick</option>';
    bService.value = (prevSel === 'unsure' || pricing.some(function(p){ return p.label === prevSel; })) ? prevSel : 'unsure';

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
        cap.textContent = first ? first.toUpperCase() + ' DRIVES EVERY JOB' : '';
      }
    }

    // ----- testimonials (empty-state via CSS :empty) -----
    document.getElementById('testiGrid').innerHTML = testimonials.length
      ? testimonials.map(function(t, i){
          return '<div class="testi-card reveal in" data-delay="' + ((i % 3) + 1) + '">'
            + '<p class="testi__quote">' + esc(t.quote) + '</p>'
            + '<p class="testi__meta">' + (t.author ? '<b>' + esc(t.author) + '</b>' + (t.location ? ' · ' + esc(t.location) : '') : 'Awaiting first review') + '</p>'
            + '</div>';
        }).join('')
      : '';

    // re-arm the reveal observer for anything just injected via innerHTML
    revealScan(document.getElementById('surfacesGrid'));
    revealScan(document.getElementById('pricingGrid'));
    revealScan(document.getElementById('testiGrid'));
  }

  // paint from the inline defaults immediately, then merge the live override
  /* boot handed to base.js */ // 404 / offline: the defaults stand

  window.renderContent = renderContent;
})();
