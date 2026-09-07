/* estate-sale/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via SL. base.js owns the
   reduced-motion flag, the reveal observer, the content fetch/merge lifecycle,
   and calling window.renderContent(). Sinks are DOM-property assignments
   (textContent / element properties) throughout; innerHTML appears only with
   esc() per the escaping canon.
   Content shape notes: hero/about/howItWorks/whatSells live under content.json's
   `niche` namespace and reach this renderer FLAT (base.js SLflat). brand carries
   a SPLIT city + state — the only niche that does — composed here wherever a
   locale line renders. pricing is the percentage-model OBJECT
   {commission, minimum, note} (spec Decision 3), never an array. */
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
  function smsBody(){ return 'Hi ' + brandName() + "! I'd like to book a free walkthrough."; }
  function setText(id, v){ var el = document.getElementById(id); if (el && v != null && v !== '') el.textContent = v; }

  /* Re-rendered regions appear instantly once the boot render + reveal
     observer have run (this listener registers AFTER base.js's, so it fires
     after boot). Before that, first-paint nodes keep .reveal and get observed. */
  var revealReady = false;
  document.addEventListener('DOMContentLoaded', function () { revealReady = true; });
  function revealCls(){ return revealReady ? 'reveal in' : 'reveal'; }

  var PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';

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

  function renderSteps(steps){
    var g = document.getElementById('stepsGrid');
    if (!g || !steps || !steps.length) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    steps.forEach(function (s, i) {
      var step = document.createElement('div');
      step.className = 'step ' + revealCls();
      step.setAttribute('data-delay', String(i % 3 + 1));
      var n = document.createElement('span'); n.className = 'step__n';
      var h3 = document.createElement('h3'); h3.textContent = s.title || '';
      var p = document.createElement('p'); p.textContent = s.desc || '';
      step.appendChild(n); step.appendChild(h3); step.appendChild(p);
      g.appendChild(step);
    });
  }

  /* The percentage fee sheet. commission + minimum are the admin's two
     editable fields for this model; note rides along on the same object.
     Values render verbatim — this file adds no money copy of its own. */
  function renderFee(p){
    if (!p || typeof p !== 'object' || Array.isArray(p)) return;
    setText('feeCommission', p.commission);
    setText('feeMinimum', p.minimum);
    setText('feeNote', p.note);
  }

  /* The pricing ledger: rows grouped by category, order preserved from
     content. Every value lands via textContent. */
  function renderWhatSells(rows){
    var g = document.getElementById('wsGroups');
    if (!g || !rows || !rows.length) return;
    var groups = [], byCat = {};
    rows.forEach(function (r) {
      if (!r || !r.item) return;
      var cat = r.cat || 'More finds';
      if (!byCat[cat]) { byCat[cat] = { cat: cat, rows: [] }; groups.push(byCat[cat]); }
      byCat[cat].rows.push(r);
    });
    while (g.firstChild) g.removeChild(g.firstChild);
    groups.forEach(function (grp, i) {
      var card = document.createElement('div');
      card.className = 'ws-group ' + revealCls();
      card.setAttribute('data-delay', String(i % 3 + 1));
      var head = document.createElement('div');
      head.className = 'ws-group__cat';
      head.textContent = grp.cat;
      card.appendChild(head);
      grp.rows.forEach(function (r) {
        var row = document.createElement('div'); row.className = 'ws-row';
        var top = document.createElement('div'); top.className = 'ws-row__top';
        var item = document.createElement('span'); item.className = 'ws-row__item'; item.textContent = r.item || '';
        top.appendChild(item);
        if (r.range) {
          var range = document.createElement('span'); range.className = 'ws-row__range'; range.textContent = r.range;
          top.appendChild(range);
        }
        row.appendChild(top);
        if (r.note) {
          var note = document.createElement('div'); note.className = 'ws-row__note'; note.textContent = r.note;
          row.appendChild(note);
        }
        card.appendChild(row);
      });
      g.appendChild(card);
    });
  }

  function renderArea(sa){
    if (!sa) return;
    setText('areaRegion', sa.region);
    var g = document.getElementById('areaChips');
    if (!g || !sa.cities || !sa.cities.length) return;
    while (g.firstChild) g.removeChild(g.firstChild);
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
    setText('meetDesc', o.bio);
    var mp = document.getElementById('meetPhoto');
    if (mp) {
      while (mp.firstChild) mp.removeChild(mp.firstChild);
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
    /* Full name everywhere; the nav lockup drops a trailing " Estate Sales" —
       the line under it already says "Estate sales · <city, state>". */
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand]'), function (el) { el.textContent = b.name || ''; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand-short]'), function (el) {
      el.textContent = String(b.name || '').replace(/\s+Estate Sales$/i, '');
    });
    /* brand.city + brand.state are SPLIT in this niche's content.json —
       compose "City, ST" once and reuse it. */
    var locale = [b.city, b.state].filter(Boolean).join(', ');
    var bl = document.getElementById('brandLocale');
    if (bl && locale) bl.textContent = 'Estate sales · ' + locale;

    var tel = telHref(b.phone), sms = smsHref(b.phone, smsBody());
    Array.prototype.forEach.call(document.querySelectorAll('a[data-tel]'), function (a) { a.setAttribute('href', tel); });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-sms]'), function (a) { a.setAttribute('href', sms); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-phone-text]'), function (el) { el.textContent = b.phone || ''; });

    setText('footTagline', b.tagline);
    var area = document.getElementById('areaLine');
    if (area) area.textContent = 'Serving ' + ((c.serviceArea && c.serviceArea.region) || locale || b.city || '');

    renderHero(c.hero);
    renderAbout(c.about);
    renderSteps(c.howItWorks);
    renderFee(c.pricing);
    renderWhatSells(c.whatSells);
    setText('wsNote', c.whatSellsNote);
    renderArea(c.serviceArea);
    renderOwner(c.owner);
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
      var body = 'Hi ' + brandName() + "! I'd like to book a free walkthrough."
        + ' Name: ' + d.name + '.'
        + ' Phone: ' + d.phone + '.'
        + ' House: ' + d.address + (d.city ? ', ' + d.city : '') + '.'
        + (d.date ? ' Preferred date: ' + d.date + '.' : '')
        + (d.notes ? ' Situation: ' + d.notes + '.' : '');
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
            + 'background:#1A2E28;color:#F2EDE0;padding:14px 22px;border-radius:14px;'
            + 'box-shadow:0 12px 40px rgba(0,0,0,.55);border:1px solid rgba(200,154,63,.4);'
            + 'font-family:Karla,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
            + 'opacity:0;transition:opacity .25s ease;';
          document.body.appendChild(t);
        }
        t.innerHTML = 'Call or text us at <strong style="color:#E3B95F;letter-spacing:.02em">' + esc(brandPhone()) + '</strong> from your phone.';
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
          dm.textContent = 'We got your info. We\'ll text you at ' + phone + ' to set up your free walkthrough. Opening a text so you can send us a copy too — just hit send.';
        } else {
          dm.textContent = 'We got your info. We\'ll text you at ' + phone + ' from ' + brandPhone() + ' to set up your free walkthrough. Keep an eye on your messages.';
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
      var checks = ['q-name', 'q-phone', 'q-addr', 'q-city'];
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
        address: val('q-addr'), city: val('q-city'),
        date: val('q-date'), notes: val('q-notes')
      };

      // build request per provider
      var url, payload, headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (LEAD.provider === 'web3forms' && LEAD.web3formsKey) {
        url = 'https://api.web3forms.com/submit';
        payload = Object.assign({
          access_key: LEAD.web3formsKey,
          subject: 'New walkthrough request: ' + data.name + ' — ' + data.city,
          from_name: brandName() + ' site'
        }, data);
      } else {
        url = 'https://formsubmit.co/ajax/' + encodeURIComponent(brandEmail());
        payload = Object.assign({
          _subject: 'New walkthrough request: ' + data.name + ' — ' + data.city,
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
            msgEl.textContent = 'Couldn\'t reach our server. Please text your details to ' + brandPhone() + ' and we\'ll get you scheduled.';
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
