/* mechanic/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via SL. base.js owns the
   reduced-motion flag, the reveal observer, the content fetch/merge lifecycle,
   and calling window.renderContent(). Sinks are DOM-property assignments
   (textContent / element properties) throughout; innerHTML appears only with
   static icon markup or esc(), per the escaping canon.

   Content shape notes: hero/about/process/proof/trust/beforeAfter/book live
   under content.json's `niche` namespace and reach this renderer FLAT
   (base.js SLflat). pricing is the tiers ARRAY and every row is read through
   the platform display-string contract — label / blurb / per / note /
   features / highlight — because that is exactly where an operator's admin
   save lands (api/operator-content.mjs ARRAY_FIELD_MAPS.pricing maps
   price_label -> blurb). Reading any other key would be a silent no-op.

   note is RENDERED on the tier card. Ten sibling niches offer the operator
   that field in the admin and drop it on the floor; a mobile mechanic quoting
   flat rates needs the "your engine bay may be the five-hour one" line more
   than most, so it is a first-class element here, hidden only when empty. */
(function () {
  'use strict';

  var SL = window.SL;
  var esc = SL.esc, telHref = SL.telHref;
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
  function smsBody(){ return 'Hi ' + brandName() + "! I'd like a flat rate for a driveway visit."; }
  function setText(id, v){ var el = document.getElementById(id); if (el && v != null && v !== '') el.textContent = v; }
  function clear(el){ while (el && el.firstChild) el.removeChild(el.firstChild); }

  /* Re-rendered regions appear instantly once the boot render + reveal
     observer have run (this listener registers AFTER base.js's, so it fires
     after boot). Before that, first-paint nodes keep .reveal and get observed. */
  var revealReady = false;
  document.addEventListener('DOMContentLoaded', function () { revealReady = true; });
  function revealCls(){ return revealReady ? 'reveal in' : 'reveal'; }
  function delayOf(i){ return String((i % 3) + 1); }

  /* Static icon markup — no content value is ever interpolated into these. */
  var PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var TRUST_SVG = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17V7h11v10"/><path d="M14 10h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="M8 10h8M8 14h5"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 7.5 16 12l-4-4 4.5-4.5a5 5 0 0 0-6.4 6.4L3.5 16.5a2 2 0 1 0 2.8 2.8l6.6-6.6a5 5 0 0 0 7.6-5.2z"/></svg>',
    PIN_SVG
  ];

  /* ---- section renderers ---- */
  function renderHero(h){
    if (!h) return;
    setText('heroKicker', h.kicker);
    setText('heroTitle', h.title);
    setText('heroSub', h.subtitle);
    setText('heroCtaPrimary', h.ctaPrimary);
    setText('heroCtaSecondary', h.ctaSecondary);
  }

  function renderProof(rows){
    var g = document.getElementById('heroProof');
    if (!g || !rows || !rows.length) return;
    clear(g);
    rows.forEach(function (r) {
      var d = document.createElement('div'); d.className = 'proof';
      var b = document.createElement('b'); b.textContent = r.big || '';
      var s = document.createElement('span'); s.textContent = r.small || '';
      d.appendChild(b); d.appendChild(s);
      g.appendChild(d);
    });
  }

  function renderTrust(rows){
    var g = document.getElementById('trustStrip');
    if (!g || !rows || !rows.length) return;
    clear(g);
    rows.forEach(function (r, i) {
      var d = document.createElement('div'); d.className = 'trust__item';
      d.innerHTML = TRUST_SVG[i % TRUST_SVG.length];   // static markup only
      var s = document.createElement('span'); s.className = 'trust__label';
      s.textContent = r.title || '';
      d.appendChild(s);
      g.appendChild(d);
    });
  }

  function renderAbout(a){
    if (!a) return;
    setText('aboutHeading', a.heading);
    setText('aboutBody', a.body);
    var ul = document.getElementById('aboutPoints');
    if (!ul || !a.points || !a.points.length) return;
    clear(ul);
    a.points.forEach(function (p) {
      var li = document.createElement('li'); li.textContent = p;
      ul.appendChild(li);
    });
  }

  function renderSteps(steps){
    var g = document.getElementById('stepsGrid');
    if (!g || !steps || !steps.length) return;
    clear(g);
    steps.forEach(function (s, i) {
      var step = document.createElement('div');
      step.className = 'step ' + revealCls();
      step.setAttribute('data-delay', delayOf(i));
      var n = document.createElement('span'); n.className = 'step__n';
      var h3 = document.createElement('h3'); h3.textContent = s.title || '';
      var p = document.createElement('p'); p.textContent = s.desc || '';
      step.appendChild(n); step.appendChild(h3); step.appendChild(p);
      g.appendChild(step);
    });
  }

  function renderServices(rows){
    var g = document.getElementById('serviceGrid');
    if (!g || !rows || !rows.length) return;
    clear(g);
    rows.forEach(function (s, i) {
      var card = document.createElement('article');
      card.className = 'gg-svc ' + revealCls();
      card.setAttribute('data-delay', delayOf(i));
      var h3 = document.createElement('h3'); h3.className = 'gg-svc__title'; h3.textContent = s.title || '';
      var p = document.createElement('p'); p.className = 'gg-svc__desc'; p.textContent = s.desc || '';
      card.appendChild(h3); card.appendChild(p);
      g.appendChild(card);
    });
  }

  /* ===== flat-rate tiers =====
     Rows are display strings, never arithmetic: blurb is printed verbatim, so
     an operator whose rate reads "Text for a flat rate" gets exactly that and
     there is no code path that can render a computed zero. */
  var TIERS = [];
  var pickedIndex = -1;

  function syncSummary(){
    var labelEl = document.getElementById('quoteLabel');
    var priceEl = document.getElementById('quotePrice');
    var perEl   = document.getElementById('quotePer');
    var noteEl  = document.getElementById('quoteNote');
    if (!labelEl || !priceEl) return;

    var row = (pickedIndex > -1) ? TIERS[pickedIndex] : null;
    var empty = (cc().pricePickerEmpty) || (DEFAULT_CONTENT.niche && DEFAULT_CONTENT.niche.pricePickerEmpty) || 'Nothing picked yet';

    labelEl.textContent = row ? (row.label || '') : empty;
    priceEl.textContent = row ? (row.blurb || '') : '—';
    if (perEl) perEl.textContent = row ? (row.per || '') : '';
    if (noteEl) {
      noteEl.textContent = (row && row.note) ? row.note : '';
      noteEl.hidden = !(row && row.note);
    }

    var cards = document.querySelectorAll('#priceGrid .gg-rate');
    Array.prototype.forEach.call(cards, function (c, i) {
      c.classList.toggle('is-picked', i === pickedIndex);
      var btn = c.querySelector('.gg-rate__pick');
      if (btn) {
        btn.setAttribute('aria-pressed', i === pickedIndex ? 'true' : 'false');
        btn.textContent = i === pickedIndex ? 'In the quote line' : 'Put in quote line';
      }
    });
  }

  function renderPricing(rows){
    var g = document.getElementById('priceGrid');
    if (!g || !Array.isArray(rows) || !rows.length) return;
    TIERS = rows;
    if (pickedIndex >= rows.length) pickedIndex = -1;
    clear(g);
    rows.forEach(function (p, i) {
      var card = document.createElement('article');
      card.className = 'gg-rate ' + revealCls() + (p.highlight ? ' gg-rate--hot' : '');
      card.setAttribute('data-delay', delayOf(i));
      card.setAttribute('data-index', String(i));

      var h3 = document.createElement('h3'); h3.className = 'gg-rate__label';
      h3.textContent = p.label || '';
      card.appendChild(h3);

      /* blurb is the price DISPLAY STRING (admin price_label lands here). */
      if (p.blurb) {
        var price = document.createElement('div'); price.className = 'gg-rate__price';
        price.textContent = p.blurb;
        card.appendChild(price);
      }
      if (p.per) {
        var per = document.createElement('div'); per.className = 'gg-rate__per';
        per.textContent = p.per;
        card.appendChild(per);
      }
      if (Array.isArray(p.features) && p.features.length) {
        var ul = document.createElement('ul'); ul.className = 'gg-rate__features';
        p.features.forEach(function (f) {
          var li = document.createElement('li'); li.textContent = f;
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }
      /* the note the platform has been collecting and nobody rendered */
      var note = document.createElement('p'); note.className = 'gg-rate__note';
      note.textContent = p.note || '';
      note.hidden = !p.note;
      card.appendChild(note);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gg-rate__pick';
      btn.textContent = 'Put in quote line';
      btn.setAttribute('aria-pressed', 'false');
      card.appendChild(btn);

      g.appendChild(card);
    });
    syncSummary();
  }

  function renderFaq(rows){
    var g = document.getElementById('faqList');
    if (!g || !rows || !rows.length) return;
    clear(g);
    rows.forEach(function (f) {
      var d = document.createElement('details');
      d.className = 'faq ' + revealCls();
      var s = document.createElement('summary');
      s.appendChild(document.createTextNode(f.q || ''));
      var plus = document.createElement('span');
      plus.className = 'plus'; plus.setAttribute('aria-hidden', 'true');
      plus.textContent = '+';
      s.appendChild(plus);
      var body = document.createElement('div');
      body.className = 'faq__body'; body.textContent = f.a || '';
      d.appendChild(s); d.appendChild(body);
      g.appendChild(d);
    });
  }

  function renderBeforeAfter(ba){
    if (!ba) return;
    setText('baEyebrow', ba.eyebrow);
    setText('baHeading', ba.heading);
    setText('baBlurb', ba.blurb);
    setText('baNote', ba.note);
  }

  function renderArea(sa){
    if (!sa) return;
    setText('areaRegion', sa.region);
    setText('areaShort', sa.short);
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

  function renderBook(b){
    if (!b) return;
    setText('bookEyebrow', b.eyebrow);
    setText('bookHeading', b.heading);
    setText('bookBlurb', b.blurb);
    setText('bookSubmit', b.buttonLabel);
    setText('bookDoneHeading', b.doneHeading);
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
    /* The nav lockup drops a trailing " Mobile Mechanic" — the line under it
       already says "Mobile mechanic · <city>". */
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand-short]'), function (el) {
      el.textContent = String(b.name || '').replace(/\s+Mobile\s+Mechanic$/i, '');
    });
    var bl = document.getElementById('brandLocale');
    if (bl && b.city) bl.textContent = 'Mobile mechanic · ' + b.city;

    var tel = telHref(b.phone), sms = smsHref(b.phone, smsBody());
    Array.prototype.forEach.call(document.querySelectorAll('a[data-tel]'), function (a) { a.setAttribute('href', tel); });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-sms]'), function (a) { a.setAttribute('href', sms); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-phone-text]'), function (el) { el.textContent = b.phone || ''; });

    var fe = document.getElementById('footEmail');
    if (fe && b.email) { fe.href = 'mailto:' + b.email; fe.textContent = b.email; }

    setText('footTagline', b.tagline);
    var area = document.getElementById('areaLine');
    if (area) area.textContent = 'Serving ' + ((c.serviceArea && c.serviceArea.region) || b.city || '');

    renderHero(c.hero);
    renderProof(c.proof);
    renderTrust(c.trust);
    renderAbout(c.about);
    renderSteps(c.process);
    renderServices(c.services);
    renderPricing(c.pricing);
    setText('pricePickerHint', c.pricePickerHint);
    setText('priceNote', c.pricingNote);
    renderBeforeAfter(c.beforeAfter);
    renderFaq(c.faq);
    renderArea(c.serviceArea);
    renderBook(c.book);
    renderOwner(c.owner);
  }

  /* Picking a tier. Delegated on the grid so it survives every re-render,
     including the one that follows the content.json fetch. */
  var grid = document.getElementById('priceGrid');
  if (grid) {
    grid.addEventListener('click', function (e) {
      var card = e.target.closest && e.target.closest('.gg-rate');
      if (!card) return;
      var idx = parseInt(card.getAttribute('data-index'), 10);
      if (isNaN(idx)) return;
      pickedIndex = (pickedIndex === idx) ? -1 : idx;
      syncSummary();
      var line = document.getElementById('quoteLine');
      if (line && pickedIndex > -1) line.classList.add('is-live');
    });
  }

  // year
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // nav solidify
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('solid', window.scrollY > 30); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ===== job request form =====
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
      var body = 'Hi ' + brandName() + "! I'd like a flat rate for a driveway visit."
        + ' Name: ' + d.name + '.'
        + ' Phone: ' + d.phone + '.'
        + ' Vehicle: ' + d.vehicle + '.'
        + ' Where it sits: ' + d.address + (d.city ? ', ' + d.city : '') + '.'
        + (d.date ? ' Day that suits me: ' + d.date + '.' : '')
        + (d.notes ? ' Symptom: ' + d.notes + '.' : '');
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
            + 'background:#1F2926;color:#EFF3F0;padding:14px 22px;border-radius:10px;'
            + 'box-shadow:0 12px 40px rgba(0,0,0,.6);border:1px solid rgba(74,204,124,.4);'
            + 'font-family:Barlow,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
            + 'opacity:0;transition:opacity .25s ease;';
          document.body.appendChild(t);
        }
        t.innerHTML = 'Call or text us at <strong style="color:#4ACC7C;letter-spacing:.02em">' + esc(brandPhone()) + '</strong> from your phone.';
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
          dm.textContent = 'We got it. We\'ll text you at ' + phone + ' with a flat rate for the job. Opening a text so you can send us a copy too — just hit send.';
        } else {
          dm.textContent = 'We got it. We\'ll text you at ' + phone + ' from ' + brandPhone() + ' with a flat rate for the job. Keep an eye on your messages.';
        }
      }
      if (done) { done.hidden = false; done.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      // On mobile only, also open the customer's SMS app pre-filled.
      if (smsUrl && isMobile) { setTimeout(function () { window.location.href = smsUrl; }, 900); }
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // honeypot: bots fill this; treat as done and do nothing real
      var hp = form.querySelector('.hp');
      if (hp && hp.value) { showDone(val('q-phone') || 'your phone'); return; }

      // validate
      var checks = ['q-name', 'q-phone', 'q-vehicle', 'q-addr', 'q-city'];
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
        name: val('q-name'), phone: val('q-phone'),
        vehicle: val('q-vehicle'),
        address: val('q-addr'), city: val('q-city'),
        date: val('q-date'), notes: val('q-notes')
      };

      // build request per provider
      var url, payload, headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (LEAD.provider === 'web3forms' && LEAD.web3formsKey) {
        url = 'https://api.web3forms.com/submit';
        payload = Object.assign({
          access_key: LEAD.web3formsKey,
          subject: 'New driveway job: ' + data.name + ' — ' + data.vehicle,
          from_name: brandName() + ' site'
        }, data);
      } else {
        url = 'https://formsubmit.co/ajax/' + encodeURIComponent(brandEmail());
        payload = Object.assign({
          _subject: 'New driveway job: ' + data.name + ' — ' + data.vehicle,
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
            msgEl.textContent = 'Opening a text with your details — just hit send and we\'ll take it from there.';
            window.location.href = buildSms(data);
          } else {
            msgEl.className = 'book__msg err';
            msgEl.textContent = 'Couldn\'t reach our server. Please text your details to ' + brandPhone() + ' and we\'ll get you a flat rate.';
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
