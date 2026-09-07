/* dumpster-rental/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via the SL namespace; the aliases
   below keep every call site in the extracted code unchanged.
   base.js owns: the reduced-motion flag, the reveal observer, the content
   fetch/merge lifecycle, and calling window.renderContent(). */
(function () {
  'use strict';

  var SL = window.SL;
  var esc = SL.esc, num = SL.num, telHref = SL.telHref;
  var reduce = SL.reduce;
  /* val/setErr/showDone are deliberately NOT aliased: this niche defines its own
     with different signatures (setErr toggles a field class; showDone carries the
     SMS hand-off). Generic versions would be a silent behaviour change. */
  var CONTENT = window.DEFAULT_CONTENT;

/* PRICING and LEAD are DERIVED from CONTENT (applyRuntime).
     total = base[size] + duration[days] + (rush ? rush : 0) — flat, all-inclusive. */
  var PRICING = { base: {}, duration: {}, rush: 0, includedTons: 0 };
  /* Lead delivery — no backend. FormSubmit needs no account, but the FIRST real
     submission emails a one-time activation link to LEAD.email; click it once and
     every booking after that lands in that inbox, formatted as a table. */
  var LEAD = { provider: 'formsubmit', email: '', sms: '' };


  function applyRuntime(c){
    PRICING = { base: {}, duration: {}, rush: num((c.terms||{}).rushFee), includedTons: num((c.terms||{}).includedTons) };
    (c.sizes||[]).forEach(function(s){ PRICING.base[String(s.yd)] = num(s.price_label); });
    (c.durations||[]).forEach(function(d){ PRICING.duration[String(d.days)] = num(d.addon); });
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
  var revs = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && !reduce){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
    revs.forEach(function(r){ io.observe(r); });
  } else { revs.forEach(function(r){ r.classList.add('in'); }); }

  // ---------- drifting dust motes in hero ----------
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
     SIGNATURE — BUILD YOUR PRICE
     ===================================================== */
  var picker      = document.getElementById('picker');
  var priceNum    = document.getElementById('priceNum');
  var priceBreak  = document.getElementById('priceBreak');
  var pickerBook  = document.getElementById('pickerBook');
  var pickerSms   = document.getElementById('pickerSms');
  var rushToggle  = document.getElementById('rushToggle');

  var getSize = function(){
    var el = picker.querySelector('input[name="size"]:checked');
    return el ? el.value : '15';
  };
  var getDays = function(){
    var el = picker.querySelector('input[name="days"]:checked');
    return el ? el.value : '3';
  };
  var getRush = function(){ return !!(rushToggle && rushToggle.checked); };

  // one calc used everywhere: picker, summary, sms quote
  var calcPrice = function(size, days, rush){
    return num(PRICING.base[size]) + num(PRICING.duration[days]) + (rush ? num(PRICING.rush) : 0);
  };

  var configLabel = function(size, days, rush){
    return size + '-yd dumpster · ' + days + '-day rental'
      + (rush ? ' · same-week delivery' : '')
      + ' — $' + calcPrice(size, days, rush)
      + ' flat (delivery, pickup & ' + PRICING.includedTons + ' tons included)';
  };

  var renderPrice = function(){
    var size = getSize(), days = getDays(), rush = getRush();
    var total = calcPrice(size, days, rush);

    priceNum.textContent = '$' + total;
    if(!reduce){ // subtle pop on change; skipped under reduced motion
      priceNum.classList.remove('pop');
      void priceNum.offsetWidth; // restart the animation
      priceNum.classList.add('pop');
    }

    var parts = [size + '-yd base $' + num(PRICING.base[size])];
    if(num(PRICING.duration[days]) > 0) parts.push('+$' + num(PRICING.duration[days]) + ' ' + days + '-day');
    if(rush) parts.push('+$' + num(PRICING.rush) + ' same-week');
    priceBreak.textContent = parts.join(' · ');

    pickerSms.href = 'sms:' + LEAD.sms + '?body=' + encodeURIComponent(
      "Hi " + CONTENT.brand.name + "! I'd like to book: " + configLabel(size, days, rush));
  };

  picker.addEventListener('change', function(e){
    if(e.target.name === 'size' || e.target.name === 'days' || e.target === rushToggle) renderPrice();
  });
  renderPrice(); // initial paint

  /* ----- carry the config into the booking form ----- */
  var bSize    = document.getElementById('b-size');
  var bDays    = document.getElementById('b-days');
  var bSummary = document.getElementById('b-summary');

  var syncSummary = function(){
    // only build a summary for concrete sizes; "help me pick" stays open-ended
    if(bSize.value === 'unsure'){
      bSummary.value = 'Not sure on size yet — help me pick.';
      return;
    }
    bSummary.value = configLabel(bSize.value, bDays.value, getRush());
  };

  pickerBook.addEventListener('click', function(){
    bSize.value = getSize();
    bDays.value = getDays();
    syncSummary();
    document.getElementById('book').scrollIntoView(reduce ? {} : {behavior:'smooth'});
    // focus the first field once we've arrived (without yanking the scroll)
    setTimeout(function(){ document.getElementById('b-name').focus({preventScroll:true}); }, reduce ? 0 : 650);
  });

  // keep the summary honest if they change size/length inside the form
  bSize.addEventListener('change', function(){ if(bSummary.value) syncSummary(); });
  bDays.addEventListener('change', function(){ if(bSummary.value) syncSummary(); });

  /* =====================================================
     BOOKING FORM — FormSubmit fetch + sms fallback
     ===================================================== */
  var form = document.getElementById('bookForm');
  var msgEl = document.getElementById('bookMsg');
  var submitBtn = document.getElementById('bookSubmit');

  // no past drop-off dates
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
    var body = "Hi " + CONTENT.brand.name + "! I'd like to book a roll-off."
      + " Name: " + d.name + "."
      + " Phone: " + d.phone + "."
      + " Address: " + d.address + (d.city ? ", " + d.city : "") + "."
      + " Size: " + (d.size === 'unsure' ? 'not sure yet' : d.size + ' yard') + "."
      + " Drop-off: " + d.dropoff_date + "."
      + " Length: " + d.rental_length + "-day."
      + (d.config_summary ? " Config: " + d.config_summary + "." : "")
      + (d.placement_notes ? " Placement: " + d.placement_notes + "." : "");
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
          + 'background:#0a1812;color:#F2E9D8;padding:14px 22px;border-radius:12px;'
          + 'box-shadow:0 12px 40px rgba(0,0,0,.55);border:1px solid rgba(255,196,0,.35);'
          + 'font-family:Inter,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
          + 'opacity:0;transition:opacity .25s ease;';
        document.body.appendChild(t);
      }
      t.innerHTML = 'Call or text us at <strong style="color:#FFD34D;letter-spacing:.02em">' + esc(CONTENT.brand.phone) + '</strong> from your phone.';
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
        dm.textContent = "We got it! We'll text you at " + phone + " to confirm your delivery window. Opening a text so you can send us a copy too — just hit send.";
      } else {
        dm.textContent = "We got it! We'll text you at " + phone + " from " + CONTENT.brand.phone + " to confirm your delivery window. Keep an eye on your messages.";
      }
    }
    if(done){ done.hidden = false; done.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'center'}); }
    // Belt-and-suspenders: on mobile only, also open a pre-filled SMS.
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
      size: val('b-size'),
      dropoff_date: val('b-date'),
      rental_length: val('b-days'),
      placement_notes: val('b-notes'),
      config_summary: val('b-summary')
    };

    var bad = false;
    setErr('b-name', !d.name); bad = bad || !d.name;
    var digits = d.phone.replace(/\D/g,'');
    setErr('b-phone', digits.length < 7); bad = bad || digits.length < 7;
    setErr('b-addr', !d.address); bad = bad || !d.address;
    setErr('b-city', !d.city); bad = bad || !d.city;
    setErr('b-date', !d.dropoff_date); bad = bad || !d.dropoff_date;
    var consent = document.getElementById('b-consent').checked;

    if(bad){ msgEl.textContent = 'Please fill in the highlighted fields.'; msgEl.classList.add('err'); return; }
    if(!consent){ msgEl.textContent = 'Please check the consent box so we can text you a confirmation.'; msgEl.classList.add('err'); return; }

    var smsUrl = buildSms(d);
    submitBtn.disabled = true; submitBtn.textContent = 'Sending…';

    var payload = {
      _subject: 'New dumpster booking — ' + d.name + ' (' + (d.size === 'unsure' ? 'size TBD' : d.size + ' yd') + ')',
      _template: 'table',
      _captcha: 'false',
      name: d.name, phone: d.phone,
      address: d.address, city: d.city,
      size: d.size === 'unsure' ? 'Not sure — help them pick' : d.size + ' yard',
      dropoff_date: d.dropoff_date,
      rental_length: d.rental_length + '-day',
      placement_notes: d.placement_notes || '—',
      config_summary: d.config_summary || '— (picker not used)'
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
      submitBtn.disabled = false; submitBtn.textContent = 'Reserve my dumpster';
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

  // Dimensional painted-steel box at true proportional scale (1 ft = 10 units).
  // north-star: reuses the shared 5-stop steel sheen (#bin-steel) + feTurbulence
  // grain (#bin-grain) + contact shadow (#bin-cast) so JS-regenerated picker cards
  // read as real containers. Same geometry the static markup ships with (JS-off safe).
  function sizeSvg(lengthFt, heightFt){
    var L = num(lengthFt) || 16, H = num(heightFt) || 4.5;
    var floorY = 94, topY = Math.max(18, Math.round(floorY - H * 10));
    var x0 = Math.max(6, Math.round(120 - L * 5)), x1 = Math.min(234, Math.round(120 + L * 5));
    var cx = Math.round((x0 + x1) / 2), rx = Math.round((x1 - x0) / 2 + 6);
    var n = Math.max(2, Math.floor(L / 4)), ribs = '';
    for(var i = 1; i <= n; i++){
      var xr = Math.round(x0 + (x1 - x0) * i / (n + 1));
      ribs += '<path d="M' + xr + ' ' + (topY + 7) + ' V' + (floorY - 3) + '" stroke="#8a6300" stroke-opacity=".55" stroke-width="3"/>'
            + '<path d="M' + (xr + 2) + ' ' + (topY + 7) + ' V' + (floorY - 3) + '" stroke="#FFE9A6" stroke-opacity=".4" stroke-width="1.4"/>';
    }
    return '<svg viewBox="0 0 240 112" fill="none">'
      + '<ellipse cx="' + cx + '" cy="' + (floorY + 9) + '" rx="' + rx + '" ry="5.5" fill="#050b07" opacity=".5" filter="url(#bin-cast)"/>'
      + '<path d="M' + x0 + ' ' + topY + ' H' + x1 + ' L' + (x1 - 4) + ' ' + floorY + ' H' + (x0 + 4) + ' Z" fill="url(#bin-steel)" filter="url(#bin-grain)"/>'
      + '<path d="M' + x0 + ' ' + topY + ' H' + x1 + '" stroke="url(#bin-rail)" stroke-width="7" stroke-linecap="round"/>'
      + '<path d="M' + (x0 + 5) + ' ' + (topY + 5) + ' H' + (x1 - 5) + '" stroke="#7a5600" stroke-opacity=".5" stroke-width="3"/>'
      + ribs
      + '<path d="M' + (x0 + 3) + ' ' + (topY + 3) + ' L' + (x0 + 34) + ' ' + (topY + 3) + ' L' + (x0 + 14) + ' ' + (floorY - 4) + ' L' + (x0 + 3) + ' ' + (floorY - 4) + ' Z" fill="url(#bin-sheen)"/>'
      + '<path d="M' + x0 + ' ' + topY + ' V' + (topY - 9) + ' H' + (x0 + 14) + '" stroke="url(#bin-rail)" stroke-width="5" stroke-linecap="round"/>'
      + '<rect x="' + (x0 + 6) + '" y="' + (floorY - 1) + '" width="14" height="9" rx="2.5" fill="#161105"/>'
      + '<rect x="' + (x1 - 20) + '" y="' + (floorY - 1) + '" width="14" height="9" rx="2.5" fill="#161105"/>'
      + '<path d="M6 106 H234" stroke="#F2E9D8" stroke-opacity=".18" stroke-width="2"/></svg>';
  }

  // "Project label | 80" lines -> fill meters
  function parseMeters(str){
    return String(str || '').split(/\n+/).map(function(line){
      var m = line.split('|');
      if(m.length < 2 || !m[0].trim()) return null;
      return { lab: m[0].trim(), pct: Math.max(0, Math.min(100, Math.round(num(m[1])))) };
    }).filter(Boolean);
  }

  function renderContent(c){
    applyRuntime(c);
    var brand = c.brand || {}, terms = c.terms || {}, area = c.serviceArea || {}, owner = c.owner || {};
    var sizes = c.sizes || [], durations = c.durations || [];
    var e164 = telHref(brand.phone);
    var smsBody = encodeURIComponent("Hi " + brand.name + "! I'd like to book a roll-off.");

    // ----- brand & contact -----
    document.getElementById('brandName').innerHTML = esc(brand.name) + '<span>' + esc((area.short || '') + ' roll-offs') + '</span>';
    document.querySelectorAll('a[href^="tel:"]').forEach(function(a){ a.href = 'tel:' + e164; });
    document.querySelectorAll('a[href^="sms:"]').forEach(function(a){ a.href = 'sms:' + e164 + '?body=' + smsBody; });
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.textContent = brand.phone; });
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = brand.name; });
    document.querySelectorAll('[data-tagline]').forEach(function(el){ el.textContent = brand.tagline; });
    var fe = document.getElementById('footEmail');
    fe.href = 'mailto:' + brand.email; fe.textContent = brand.email;

    // ----- service area -----
    document.getElementById('heroEyebrow').textContent = 'Roll-off dumpster rental · ' + area.region;
    var cities = (area.cities || []).filter(Boolean);
    document.getElementById('footServe').innerHTML = 'Serving ' + cities.map(esc).join(' · ');
    document.getElementById('faqDeliver').innerHTML = cities.map(esc).join(', ')
      + ' and everything in between — <b>the whole ' + esc(area.short) + '.</b>'
      + " Outside that ring? Text us your address anyway; if a route works we'll make it work.";

    // (hand-built footSocial removed — the shared footer-contact component
    //  renders social alongside hours/address now, the bin-cleaning call.)

    // ----- sizes: picker cards, "what fits" cards, booking select -----
    if(sizes.length){
      var prevEl = picker.querySelector('input[name="size"]:checked');
      var prevVal = prevEl ? prevEl.value : null;
      var defYd = String(sizes[Math.floor((sizes.length - 1) / 2)].yd);
      var checkedYd = sizes.some(function(s){ return String(s.yd) === prevVal; }) ? prevVal : defYd;

      document.getElementById('sizesGrid').innerHTML = sizes.map(function(s){
        return '<label class="size-card"><input type="radio" name="size" value="' + esc(s.yd) + '"' + (String(s.yd) === checkedYd ? ' checked' : '') + ' />'
          + '<span class="size-card__in">'
          + '<span class="size-card__svg" aria-hidden="true">' + sizeSvg(s.lengthFt, s.heightFt) + '</span>'
          + '<span class="size-card__name">' + esc(s.label) + ' <small>from $' + num(s.price_label) + '</small></span>'
          + '<span class="size-card__dims">' + esc(s.dims) + '</span>'
          + '<span class="size-card__loads">' + esc(s.loads) + '</span>'
          + '<span class="size-card__best">' + esc(s.best) + '</span>'
          + '</span></label>';
      }).join('');

      document.getElementById('fitsGrid').innerHTML = sizes.map(function(s, i){
        var meters = parseMeters(s.meters).map(function(m){
          return '<div class="meter"><div class="meter__top"><span class="meter__label">' + esc(m.lab) + '</span><span class="meter__pct">~' + m.pct + '%</span></div>'
            + '<span class="meter__track"><span class="meter__bar" style="--w:' + m.pct + '%"></span></span></div>';
        }).join('');
        return '<div class="fit-card reveal in" data-delay="' + ((i % 3) + 1) + '">'
          + '<div class="fit-card__size"><b>' + esc(s.label) + '</b></div>'
          + '<div class="fit-card__tag">' + esc(s.dims) + ' · ' + esc(String(s.loads || '').replace(/^Fits\s*/i, '')) + '</div>'
          + meters
          + (s.note ? '<p class="fit-card__note">' + esc(s.note) + '</p>' : '')
          + '</div>';
      }).join('');

      var prevSel = bSize.value;
      bSize.innerHTML = sizes.map(function(s){
        return '<option value="' + esc(s.yd) + '">' + esc(s.label) + ' — from $' + num(s.price_label) + '</option>';
      }).join('') + '<option value="unsure">Not sure — help me pick</option>';
      bSize.value = (prevSel === 'unsure' || sizes.some(function(s){ return String(s.yd) === prevSel; })) ? prevSel : checkedYd;
    }

    // ----- rental lengths: pills + booking select -----
    if(durations.length){
      var prevDaysEl = picker.querySelector('input[name="days"]:checked');
      var prevDays = prevDaysEl ? prevDaysEl.value : null;
      var checkedDays = durations.some(function(d){ return String(d.days) === prevDays; }) ? prevDays : String(durations[0].days);

      document.getElementById('daysPills').innerHTML = durations.map(function(d){
        var add = num(d.addon);
        return '<label class="pill"><input type="radio" name="days" value="' + esc(d.days) + '"' + (String(d.days) === checkedDays ? ' checked' : '') + ' />'
          + '<span>' + esc(d.days) + '-day' + (add > 0 ? ' <b>+$' + add + '</b>' : '') + '</span></label>';
      }).join('');

      var prevLen = bDays.value;
      bDays.innerHTML = durations.map(function(d){
        var add = num(d.addon);
        return '<option value="' + esc(d.days) + '">' + esc(d.days) + '-day' + (add > 0 ? ' (+$' + add + ')' : '') + '</option>';
      }).join('');
      bDays.value = durations.some(function(d){ return String(d.days) === prevLen; }) ? prevLen : checkedDays;

      document.getElementById('faqExtendQ').innerHTML = 'What if I need it longer than '
        + esc(durations[durations.length - 1].days) + ' days?<span class="plus">+</span>';
    }

    // ----- terms & fees -----
    var tons = num(terms.includedTons), rushFee = num(terms.rushFee);
    var overage = num(terms.overagePerTon), extraDay = num(terms.extraDayFee);
    var words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    var cnt = function(n){ return (n > 0 && n < 10) ? words[n] : String(n); };
    document.getElementById('rushFeeLbl').textContent = rushFee;
    document.getElementById('priceInc').innerHTML = 'Delivery, pickup &amp; ' + tons + ' tons of disposal included';
    document.getElementById('priceLead').textContent = cnt(sizes.length) + ' sizes, ' + cnt(durations.length).toLowerCase()
      + ' rental lengths, one honest number. Every price includes delivery, pickup and ' + tons
      + ' tons of disposal — what you see here is what shows up on your card.';
    document.getElementById('overageLine').innerHTML = 'Going over ' + tons + ' tons? Overage is a flat <b style="color:var(--sand)">$'
      + overage + ' per ton</b>, billed only if the landfill scale ticket says so — and we send you the ticket.';
    document.getElementById('faqWeight').innerHTML = '<b>' + tons + ' tons (' + (tons * 2000).toLocaleString('en-US')
      + " lbs)</b> is baked into every price. Most household projects never touch the limit. If you're tossing heavy stuff — concrete, dirt, tile — overage is a flat $"
      + overage + ' per ton, billed only if the landfill scale ticket shows it. We forward you the ticket, so you never take our word for it.';
    document.getElementById('faqExtend').innerHTML = "Easy — it's <b>$" + extraDay
      + " per extra day</b>, no re-booking, no re-delivery fee. Just text us before your pickup date and we'll push it out. Long remodels do this all the time.";

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
      // caption on the fallback illustration follows the owner's name
      var cap = document.getElementById('ownerCaption');
      if(cap){
        var first = String(owner.name || '').trim().split(/\s+/)[0];
        cap.textContent = first ? first.toUpperCase() + ' DRIVES IT HIMSELF' : '';
      }
    }

    // re-run the live price + booking summary off the fresh data
    renderPrice();
    if(bSummary.value) syncSummary();
  }

  /* base.js calls this on boot and again after content.json merges over. */
  window.renderContent = renderContent;
})();
