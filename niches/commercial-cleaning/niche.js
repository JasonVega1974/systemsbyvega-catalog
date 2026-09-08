/* commercial-cleaning/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via SL. base.js owns the
   reduced-motion flag, the reveal observer, the content fetch/merge lifecycle,
   and calling window.renderContent(). Sinks are DOM-property assignments
   (textContent / element properties) throughout; innerHTML appears only with
   static markup that carries no content value, per the escaping canon.

   Content shape notes: hero/about/standards/sectors/process and the before-
   after image paths live under content.json's `niche` namespace and reach this
   renderer FLAT (base.js SLflat). brand.city is a single combined "City, ST"
   string, matching what operator-content.mjs composes.

   Pricing is the TIER ARRAY. Each row is
     { label, blurb, per, note, highlight, features }
   and `blurb` is the DISPLAY STRING — it is where ARRAY_FIELD_MAPS.pricing
   lands an operator's saved price_label, so it is the only key this file may
   read for a price. `note` is the third admin-editable field and renders on
   the card, hidden when the operator clears it. The saved array is
   authoritative for length, so every card is built from the array rather than
   assumed to be four. */
(function () {
  'use strict';

  var SL = window.SL;
  var esc = SL.esc, telHref = SL.telHref, num = SL.num;
  var CONTENT = window.DEFAULT_CONTENT;

  /* ---- content helpers ---- */
  function phoneDigits(p){ var d = String(p || '').replace(/\D/g, ''); if (d.length === 10) d = '1' + d; return d; }
  function smsHref(p, body){ return 'sms:+' + phoneDigits(p) + (body ? '?body=' + encodeURIComponent(body) : ''); }
  /* Always read contact details off the LIVE merged view (base.js refreshes
     window.CONTENT after the content.json fetch) so an admin edit takes
     effect everywhere — form destination, SMS fallback, toasts — no rebuild. */
  function cc(){ return window.CONTENT || CONTENT; }
  function brandName(){ return (cc().brand && cc().brand.name) || DEFAULT_CONTENT.brand.name; }
  function brandPhone(){ return (cc().brand && cc().brand.phone) || DEFAULT_CONTENT.brand.phone; }
  function brandEmail(){ return (cc().brand && (cc().brand.leadEmail || cc().brand.email)) || (DEFAULT_CONTENT.brand.leadEmail || DEFAULT_CONTENT.brand.email); }
  function smsBody(){ return 'Hi ' + brandName() + '! I would like to set up a walkthrough for our building.'; }
  function setText(id, v){ var el = document.getElementById(id); if (el && v != null && v !== '') el.textContent = v; }

  /* Re-rendered regions appear instantly once the boot render + reveal
     observer have run (this listener registers AFTER base.js's, so it fires
     after boot). Before that, first-paint nodes keep .reveal and get observed. */
  var revealReady = false;
  document.addEventListener('DOMContentLoaded', function () { revealReady = true; });
  function revealCls(){ return revealReady ? 'reveal in' : 'reveal'; }

  var PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  function clear(el){ while (el.firstChild) el.removeChild(el.firstChild); }
  function add(parent, tag, cls, text){
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  /* ---- section renderers ---- */
  function renderHero(h){
    if (!h) return;
    setText('heroKicker', h.kicker);
    setText('heroTitle', h.title);
    setText('heroSub', h.subtitle);
    setText('heroCtaPrimary', h.ctaPrimary);
    setText('heroCtaSecondary', h.ctaSecondary);
  }

  function renderAbout(a){
    if (!a) return;
    setText('aboutHeading', a.heading);
    setText('aboutBody', a.body);
  }

  function renderStandards(rows){
    var g = document.getElementById('stdGrid');
    if (!g || !rows || !rows.length) return;
    clear(g);
    rows.forEach(function (s, i) {
      var card = document.createElement('article');
      card.className = 'std ' + revealCls();
      card.setAttribute('data-delay', String(i % 3 + 1));
      var tick = add(card, 'span', 'std__tick');
      tick.setAttribute('aria-hidden', 'true');
      add(card, 'h3', '', s.title || '');
      add(card, 'p', '', s.blurb || '');
      g.appendChild(card);
    });
  }

  function renderSectors(rows){
    var g = document.getElementById('sectorGrid');
    if (!g || !rows || !rows.length) return;
    clear(g);
    rows.forEach(function (s, i) {
      var card = document.createElement('div');
      card.className = 'sector ' + revealCls();
      card.setAttribute('data-delay', String(i % 3 + 1));
      add(card, 'h3', '', s.name || '');
      add(card, 'p', '', s.blurb || '');
      g.appendChild(card);
    });
  }

  function renderProcess(steps){
    var g = document.getElementById('stepsGrid');
    if (!g || !steps || !steps.length) return;
    clear(g);
    steps.forEach(function (s, i) {
      var step = document.createElement('div');
      step.className = 'step ' + revealCls();
      step.setAttribute('data-delay', String(i % 3 + 1));
      var n = add(step, 'span', 'step__n');
      n.setAttribute('aria-hidden', 'true');
      add(step, 'h3', '', s.title || '');
      add(step, 'p', '', s.desc || '');
      g.appendChild(step);
    });
  }

  /* ---- pricing: the tier cards ----
     Rows come from the operator-authoritative pricing array. blurb is the
     display string and is rendered verbatim; a row with an empty blurb hides
     the figure block entirely rather than printing a bare currency symbol or
     a zero. note is rendered on the card and hidden when empty — the admin
     offers that field, so ignoring it would make an operator's save a silent
     no-op. highlight is a base-only boolean the admin never edits. */
  function renderPricing(rows){
    var g = document.getElementById('priceGrid');
    if (!g || !Array.isArray(rows) || !rows.length) return;
    clear(g);
    rows.forEach(function (p, i) {
      p = p || {};
      var card = document.createElement('article');
      card.className = 'price-card ' + (p.highlight ? 'price-card--hi ' : '') + revealCls();
      card.setAttribute('data-delay', String(i % 3 + 1));
      card.setAttribute('data-idx', String(i));

      add(card, 'h3', 'price-card__label', p.label || '');

      var blurb = String(p.blurb == null ? '' : p.blurb).trim();
      if (blurb) {
        var fig = add(card, 'div', 'price-card__figure');
        add(fig, 'span', 'price-card__blurb', blurb);
        if (p.per) add(fig, 'span', 'price-card__per', p.per);
      }

      var note = add(card, 'p', 'price-card__note', p.note || '');
      note.hidden = !p.note;

      var feats = Array.isArray(p.features) ? p.features.filter(Boolean) : [];
      if (feats.length) {
        var ul = add(card, 'ul', 'price-card__features');
        feats.forEach(function (f) { add(ul, 'li', '', f); });
      }
      g.appendChild(card);
    });
  }

  /* ---- the square-foot estimator ----
     Every rate is parsed out of a tier's OWN blurb, so an operator's
     price_label save moves this figure with the card and there is no second
     copy of the numbers to drift. A tier only qualifies when its per-unit
     reads as a square-foot rate AND its blurb parses to a positive number, so
     a quoted tier ("Quoted", "after a walkthrough") never appears here. With
     no qualifying tier the whole block hides rather than showing an empty
     picker. */
  function estimableRows(rows){
    return (Array.isArray(rows) ? rows : []).map(function (p, i) {
      p = p || {};
      return { i: i, label: String(p.label || ''), per: String(p.per || ''), rate: num(p.blurb) };
    }).filter(function (r) {
      return /sq\s*\.?\s*(ft|foot|feet)/i.test(r.per) && r.rate > 0;
    });
  }

  function money(n){
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* Named recalc so both the select and the tier cards drive one code path. */
  function recalc(){
    var sel = document.getElementById('estPlan');
    var sq = document.getElementById('estSqft');
    var out = document.getElementById('estOut');
    var sub = document.getElementById('estSub');
    if (!sel || !sq || !out) return;

    var opt = sel.options[sel.selectedIndex];
    var rate = opt ? parseFloat(opt.value) : 0;
    var area = Math.round(num(sq.value));

    if (!(rate > 0) || !(area >= 100)) {
      out.textContent = '—';
      if (sub) sub.textContent = 'enter at least 100 square feet';
      return;
    }
    /* Nearest five dollars: a janitorial contract is never quoted to the cent,
       and rounding here keeps the figure reading as the estimate it is. */
    var monthly = Math.round(rate * area / 5) * 5;
    if (monthly < 5) monthly = 5;
    out.textContent = money(monthly);
    if (sub) {
      sub.textContent = 'estimated monthly · ' + money(area).slice(1) + ' sq ft at '
        + (opt.getAttribute('data-blurb') || '');
    }
  }

  function renderEstimator(rows){
    var box = document.getElementById('estimator');
    var sel = document.getElementById('estPlan');
    if (!box || !sel) return;

    var options = estimableRows(rows);
    if (!options.length) { box.hidden = true; return; }

    var wanted = sel.getAttribute('data-idx');
    clear(sel);
    options.forEach(function (o) {
      var el = document.createElement('option');
      el.value = String(o.rate);
      el.textContent = o.label;
      el.setAttribute('data-idx', String(o.i));
      el.setAttribute('data-blurb', String(rows[o.i] && rows[o.i].blurb || ''));
      el.setAttribute('data-per', o.per);
      sel.appendChild(el);
    });
    /* Keep the visitor's pick across a re-render; otherwise start on the
       highlighted tier when there is one. */
    var start = 0;
    options.forEach(function (o, k) {
      if (wanted != null && String(o.i) === wanted) start = k;
      else if (wanted == null && rows[o.i] && rows[o.i].highlight) start = k;
    });
    sel.selectedIndex = start;
    sel.setAttribute('data-idx', String(options[start].i));
    box.hidden = false;
    recalc();
  }

  function selectPlanByIndex(idx){
    var sel = document.getElementById('estPlan');
    if (!sel) return false;
    for (var k = 0; k < sel.options.length; k++) {
      if (sel.options[k].getAttribute('data-idx') === String(idx)) {
        sel.selectedIndex = k;
        sel.setAttribute('data-idx', String(idx));
        recalc();
        return true;
      }
    }
    return false;
  }

  function renderFaq(rows){
    var g = document.getElementById('faqList');
    if (!g || !Array.isArray(rows) || !rows.length) return;
    clear(g);
    rows.forEach(function (f) {
      if (!f || !f.q) return;
      var d = document.createElement('details');
      d.className = 'faq';
      var s = document.createElement('summary');
      s.appendChild(document.createTextNode(f.q));
      var plus = document.createElement('span');
      plus.className = 'plus';
      plus.setAttribute('aria-hidden', 'true');
      plus.textContent = '+';
      s.appendChild(plus);
      d.appendChild(s);
      add(d, 'div', 'faq__body', f.a || '');
      g.appendChild(d);
    });
  }

  function renderArea(sa){
    if (!sa) return;
    setText('areaRegion', sa.region);
    var g = document.getElementById('areaChips');
    if (!g || !sa.cities || !sa.cities.length) return;
    clear(g);
    sa.cities.forEach(function (city) {
      var chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = PIN_SVG;          // static icon markup, no content in it
      chip.appendChild(document.createTextNode(city));
      g.appendChild(chip);
    });
  }

  function renderOwner(o){
    if (!o) return;
    setText('meetHeading', o.heading);
    setText('meetName', o.name);
    setText('meetDesc', o.bio);
    var mp = document.getElementById('meetPhoto');
    if (mp) {
      clear(mp);
      if (o.photo) {
        var img = document.createElement('img');
        img.src = o.photo;
        img.alt = 'Photo of the owner';
        mp.appendChild(img);
        mp.removeAttribute('aria-label'); mp.removeAttribute('role');
      }
    }
  }

  function renderContent(c){
    var b = c.brand || {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand]'), function (el) { el.textContent = b.name || ''; });
    /* The nav lockup drops a trailing " Facility Care" — the line under it
       already reads "Facility care · <city>". */
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand-short]'), function (el) {
      el.textContent = String(b.name || '').replace(/\s+Facility\s+Care$/i, '');
    });
    var bl = document.getElementById('brandLocale');
    if (bl && b.city) bl.textContent = 'Facility care · ' + b.city;

    var tel = telHref(b.phone), sms = smsHref(b.phone, smsBody());
    Array.prototype.forEach.call(document.querySelectorAll('a[data-tel]'), function (a) { a.setAttribute('href', tel); });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-sms]'), function (a) { a.setAttribute('href', sms); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-phone-text]'), function (el) { el.textContent = b.phone || ''; });

    setText('footTagline', b.tagline);
    var area = document.getElementById('areaLine');
    if (area) area.textContent = 'Serving ' + ((c.serviceArea && c.serviceArea.region) || b.city || '');

    renderHero(c.hero);
    renderAbout(c.about);
    renderStandards(c.standards);
    renderSectors(c.sectors);
    renderProcess(c.process);
    renderPricing(c.pricing);
    renderEstimator(c.pricing);
    setText('priceNote', c.pricingNote);
    setText('estNote', c.estimatorNote);
    setText('baNote', c.baNote);
    renderFaq(c.faq);
    renderArea(c.serviceArea);
    renderOwner(c.owner);
  }

  /* ---- estimator wiring (delegated, so a re-render never loses it) ---- */
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.id !== 'estPlan') return;
    var opt = t.options[t.selectedIndex];
    if (opt) t.setAttribute('data-idx', opt.getAttribute('data-idx') || '');
    recalc();
  });
  document.addEventListener('input', function (e) {
    if (e.target && (e.target.id === 'estSqft' || e.target.id === 'estPlan')) recalc();
  });
  /* Clicking a tier card points the estimator at that tier — the cards ARE the
     picker for anyone who never notices the select. */
  document.addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('.price-card');
    if (!card) return;
    var idx = card.getAttribute('data-idx');
    if (idx == null) return;
    if (selectPlanByIndex(idx)) {
      var box = document.getElementById('estimator');
      if (box && !box.hidden) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  // year
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // nav solidify
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('solid', window.scrollY > 30); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ===== walkthrough request form =====
     Leads deliver without a backend via FormSubmit (house pattern): the FIRST
     real submission emails an activation link to the lead inbox; the
     destination email and business number live in CONTENT.brand and are
     editable from /admin/. Set provider:'web3forms' + a key to switch. */
  var LEAD = {
    provider: 'formsubmit',
    web3formsKey: ''                    // <-- paste a key from web3forms.com to use Web3Forms
  };

  var form = document.getElementById('bookForm');
  if (form) {
    var msgEl = document.getElementById('bookMsg');
    var submitBtn = document.getElementById('bookSubmit');
    var val = function (id) { var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
    var setErr = function (fieldEl, on) { if (fieldEl) fieldEl.classList.toggle('invalid', !!on); };

    var buildSms = function (d) {
      var body = 'Hi ' + brandName() + '! I would like to set up a walkthrough for our building.'
        + ' Name: ' + d.name + '.'
        + ' Company: ' + d.company + '.'
        + ' Phone: ' + d.phone + '.'
        + (d.email ? ' Email: ' + d.email + '.' : '')
        + (d.sqft ? ' Approx sq ft: ' + d.sqft + '.' : '')
        + (d.frequency ? ' Frequency: ' + d.frequency + '.' : '')
        + (d.notes ? ' Notes: ' + d.notes + '.' : '');
      return smsHref(brandPhone(), body);
    };

    var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Desktop guard: never let sms: or tel: links open the OS "pick an app"
    // dialog — show a helpful toast instead. Mobile is untouched.
    if (!isMobile) {
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="sms:"], a[href^="tel:"]');
        if (!a) return;
        e.preventDefault();
        var t = document.getElementById('smsToast');
        if (!t) {
          t = document.createElement('div');
          t.id = 'smsToast';
          t.setAttribute('role', 'status');
          t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:9999;'
            + 'background:#1D2A31;color:#E8EDF0;padding:14px 22px;border-radius:10px;'
            + 'box-shadow:0 12px 40px rgba(0,0,0,.6);border:1px solid rgba(69,182,200,.4);'
            + 'font-family:"Public Sans",system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
            + 'opacity:0;transition:opacity .25s ease;';
          document.body.appendChild(t);
        }
        t.innerHTML = 'Call or text us at <strong style="color:#45B6C8;letter-spacing:.02em">' + esc(brandPhone()) + '</strong> from your phone.';
        requestAnimationFrame(function () { t.style.opacity = '1'; });
        clearTimeout(window.__smsToastTimer);
        window.__smsToastTimer = setTimeout(function () { t.style.opacity = '0'; }, 4500);
      });
    }

    var showDone = function (phone, smsUrl) {
      form.hidden = true;
      var done = document.getElementById('bookDone');
      var dm = document.getElementById('doneMsg');
      if (dm) {
        if (isMobile && smsUrl) {
          dm.textContent = 'We have it. We will call or text ' + phone + ' to set a walkthrough time. '
            + 'Opening a text so you can send us a copy too — just hit send.';
        } else {
          dm.textContent = 'We have it. We will call or text ' + phone + ' from ' + brandPhone()
            + ' to set a walkthrough time, and you will have the written scope in your inbox after we have walked the building.';
        }
      }
      if (done) { done.hidden = false; done.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      // On mobile only, also open the sender's SMS app pre-filled.
      if (smsUrl && isMobile) { setTimeout(function () { window.location.href = smsUrl; }, 900); }
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // honeypot: bots fill this; treat as done and do nothing real
      var hp = form.querySelector('.hp');
      if (hp && hp.value) { showDone(val('q-phone') || 'your phone'); return; }

      // validate
      var checks = ['q-name', 'q-company', 'q-phone'];
      var firstBad = null, ok = true;
      checks.forEach(function (id) {
        var el = document.getElementById(id);
        var bad = !el.value || !el.value.trim();
        setErr(el.closest('.field'), bad);
        if (bad) { ok = false; if (!firstBad) firstBad = el; }
      });
      var consent = document.getElementById('q-consent');
      if (!consent.checked) { ok = false; if (!firstBad) firstBad = consent; }

      if (!ok) {
        msgEl.className = 'book__msg err';
        msgEl.textContent = consent.checked ? 'Please fill in the highlighted fields.'
                                            : 'Please complete the required fields and check the consent box.';
        if (firstBad) firstBad.focus();
        return;
      }

      var data = {
        name: val('q-name'), company: val('q-company'),
        phone: val('q-phone'), email: val('q-email'),
        sqft: val('q-sqft'), frequency: val('q-freq'), notes: val('q-notes')
      };

      // build request per provider
      var url, payload, headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (LEAD.provider === 'web3forms' && LEAD.web3formsKey) {
        url = 'https://api.web3forms.com/submit';
        payload = Object.assign({
          access_key: LEAD.web3formsKey,
          subject: 'Walkthrough request: ' + data.company + ' — ' + data.name,
          from_name: brandName() + ' site'
        }, data);
      } else {
        url = 'https://formsubmit.co/ajax/' + encodeURIComponent(brandEmail());
        payload = Object.assign({
          _subject: 'Walkthrough request: ' + data.company + ' — ' + data.name,
          _template: 'table', _captcha: 'false'
        }, data);
      }

      submitBtn.disabled = true;
      var origText = submitBtn.textContent; submitBtn.textContent = 'Sending…';
      msgEl.className = 'book__msg'; msgEl.textContent = '';

      fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(payload) })
        .then(function (r) { return r.ok ? r.json().catch(function () { return { ok: true }; }) : Promise.reject(r.status); })
        .then(function () { showDone(data.phone, buildSms(data)); })
        .catch(function () {
          // couldn't reach the lead server — never lose the lead
          if (isMobile) {
            msgEl.className = 'book__msg ok';
            msgEl.textContent = 'Opening a text with your details — just hit send and we will take it from there.';
            window.location.href = buildSms(data);
          } else {
            msgEl.className = 'book__msg err';
            msgEl.textContent = 'Could not reach our server. Please text your details to ' + brandPhone() + ' and we will get the walkthrough booked.';
          }
        })
        .then(function () { submitBtn.disabled = false; submitBtn.textContent = origText; });
    });

    // clear a field's error as the user fixes it
    form.addEventListener('input', function (e) {
      var f = e.target.closest && e.target.closest('.field'); if (f) f.classList.remove('invalid');
    });
    form.addEventListener('change', function (e) {
      var f = e.target.closest && e.target.closest('.field'); if (f) f.classList.remove('invalid');
    });
  }

  window.renderContent = renderContent;
})();
