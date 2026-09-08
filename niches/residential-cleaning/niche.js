/* residential-cleaning/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via SL. base.js owns the
   reduced-motion flag, the reveal observer, the content fetch/merge lifecycle,
   and calling window.renderContent(). Sinks are DOM-property assignments
   (textContent / element properties) throughout; innerHTML appears only for
   static icon markup and with esc() per the escaping canon.

   Content shape notes: hero/about/howItWorks/promises/pricingNote/beforeAfter
   live under content.json's `niche` namespace and reach this renderer FLAT
   (base.js SLflat). brand.city carries a combined "City, ST" string.

   PRICING CONTRACT — pricing is the tiers ARRAY, each row
   {label, blurb, per, note, highlight, features}. `blurb` IS the price display
   string: that is where api/operator-content.mjs's ARRAY_FIELD_MAPS.pricing
   lands an operator's admin `price_label` save. A renderer reading any other
   key would be a silent no-op the moment an operator edits a price. `note` is
   rendered too, and hidden when empty — the admin offers the field, so the
   page has to honour it. The OPERATOR's saved array is authoritative for
   length, so nothing below assumes a row count. */
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
  function clear(el){ while (el.firstChild) el.removeChild(el.firstChild); }

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
    setText('aboutSignoff', a.signoff);
  }

  function renderSteps(steps){
    var g = document.getElementById('stepsGrid');
    if (!g || !steps || !steps.length) return;
    clear(g);
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

  function renderPromises(rows){
    var g = document.getElementById('promiseGrid');
    if (!g || !rows || !rows.length) return;
    clear(g);
    rows.forEach(function (r, i) {
      var card = document.createElement('div');
      card.className = 'promise ' + revealCls();
      card.setAttribute('data-delay', String(i % 3 + 1));
      var b = document.createElement('b'); b.textContent = r.title || '';
      var s = document.createElement('span'); s.textContent = r.blurb || '';
      card.appendChild(b); card.appendChild(s);
      g.appendChild(card);
    });
  }

  /* ---- pricing: the tier board ----------------------------------------
     Cards and picker are both built from the SAME array, so an operator who
     saves three tiers gets three pills and three cards. A row with no `blurb`
     renders no price line at all rather than a fabricated or zeroed figure. */
  var pickedTier = 0;

  function tierRows(){
    var p = cc().pricing;
    return Array.isArray(p) ? p.filter(function (r) { return r && (r.label || r.blurb); }) : [];
  }

  /* The readout the picker drives — this is the interactive price path
     (SITELAB_TEMPLATE.md §9.3). It only ever repeats values that are already
     in the pricing array. */
  function renderPrice(i){
    var rows = tierRows();
    var out = document.getElementById('priceReadout');
    if (!out) return;
    clear(out);
    var row = rows[i];
    if (!row) return;

    var lead = document.createTextNode(row.label ? (row.label + ' — ') : '');
    out.appendChild(lead);
    if (row.blurb) {
      var b = document.createElement('b');
      b.textContent = row.blurb + (row.per ? (' ' + row.per) : '');
      out.appendChild(b);
    }
    if (row.note) {
      out.appendChild(document.createTextNode('. '));
      out.appendChild(document.createTextNode(row.note));
    }

    var tabs = document.querySelectorAll('.tier-tab');
    Array.prototype.forEach.call(tabs, function (t, k) {
      t.setAttribute('aria-selected', k === i ? 'true' : 'false');
    });
    var cards = document.querySelectorAll('.tier-card');
    Array.prototype.forEach.call(cards, function (c, k) {
      c.classList.toggle('tier-card--picked', k === i);
    });
  }

  function renderTabs(rows){
    var tabs = document.getElementById('priceTabs');
    if (!tabs) return;
    clear(tabs);
    rows.forEach(function (row, i) {
      var t = document.createElement('button');
      t.type = 'button';
      t.className = 'tier-tab';
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', i === pickedTier ? 'true' : 'false');
      t.textContent = row.label || ('Option ' + (i + 1));
      t.addEventListener('click', function () { pickedTier = i; renderPrice(i); });
      tabs.appendChild(t);
    });
  }

  function renderTierCards(rows){
    var grid = document.getElementById('priceGrid');
    if (!grid) return;
    clear(grid);
    rows.forEach(function (row, i) {
      var card = document.createElement('div');
      card.className = 'tier-card ' + revealCls() + (row.highlight ? ' tier-card--hi' : '');
      card.setAttribute('data-delay', String(i % 3 + 1));

      if (row.highlight) {
        var flag = document.createElement('span');
        flag.className = 'tier-card__flag';
        flag.textContent = 'Our default plan';
        card.appendChild(flag);
      }

      var label = document.createElement('div');
      label.className = 'tier-card__label';
      label.textContent = row.label || '';
      card.appendChild(label);

      /* blurb IS the price display string (ARRAY_FIELD_MAPS.pricing maps the
         admin's price_label onto it). Absent means the operator cleared it —
         render nothing rather than a zero. */
      if (row.blurb) {
        var priceWrap = document.createElement('div');
        var price = document.createElement('div');
        price.className = 'tier-card__price';
        price.textContent = row.blurb;
        priceWrap.appendChild(price);
        if (row.per) {
          var per = document.createElement('span');
          per.className = 'tier-card__per';
          per.textContent = row.per;
          priceWrap.appendChild(per);
        }
        card.appendChild(priceWrap);
      }

      /* note: the admin's tiers editor offers this field, so the card renders
         it — and hides it entirely when the operator leaves it blank. */
      if (row.note) {
        var note = document.createElement('p');
        note.className = 'tier-card__note';
        note.textContent = row.note;
        card.appendChild(note);
      }

      if (Array.isArray(row.features) && row.features.length) {
        var ul = document.createElement('ul');
        ul.className = 'tier-card__features';
        row.features.forEach(function (f) {
          if (!f) return;
          var li = document.createElement('li');
          li.textContent = f;
          ul.appendChild(li);
        });
        if (ul.childNodes.length) card.appendChild(ul);
      }

      grid.appendChild(card);
    });
  }

  function renderPricing(){
    var rows = tierRows();
    if (!rows.length) return;
    if (pickedTier >= rows.length) pickedTier = 0;
    /* Open on the highlighted tier when there is one — that is the row this
       business points people at, and it keeps the readout non-empty. */
    var hi = -1;
    rows.forEach(function (r, i) { if (hi < 0 && r.highlight) hi = i; });
    if (hi > -1 && pickedTier === 0) pickedTier = hi;
    renderTabs(rows);
    renderTierCards(rows);
    renderPrice(pickedTier);
  }

  function renderBeforeAfter(ba){
    if (!ba) return;
    setText('baKicker', ba.kicker);
    setText('baHeading', ba.heading);
    setText('baBlurb', ba.blurb);
    setText('baNote', ba.note);
  }

  function renderArea(sa, note){
    if (sa) {
      setText('areaRegion', sa.region);
      var g = document.getElementById('areaChips');
      if (g && sa.cities && sa.cities.length) {
        clear(g);
        sa.cities.forEach(function (city) {
          var chip = document.createElement('span');
          chip.className = 'chip';
          chip.innerHTML = PIN_SVG;          // static icon markup, no content in it
          chip.appendChild(document.createTextNode(city));
          g.appendChild(chip);
        });
      }
    }
    setText('areaNote', note);
  }

  function renderFaq(rows){
    var list = document.getElementById('faqList');
    if (!list || !rows || !rows.length) return;
    clear(list);
    rows.forEach(function (r) {
      if (!r || !r.q) return;
      var d = document.createElement('details');
      d.className = 'faq';
      var s = document.createElement('summary');
      s.appendChild(document.createTextNode(r.q));
      var plus = document.createElement('span');
      plus.className = 'plus';
      plus.setAttribute('aria-hidden', 'true');
      plus.textContent = '+';
      s.appendChild(plus);
      var body = document.createElement('div');
      body.className = 'faq__body';
      body.textContent = r.a || '';
      d.appendChild(s); d.appendChild(body);
      list.appendChild(d);
    });
  }

  function renderOwner(o){
    if (!o) return;
    setText('meetHeading', o.heading);
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
    /* The nav lockup drops the trailing " Cleaning Co." — the line under it
       already says "House cleaning · <city>". */
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand-short]'), function (el) {
      el.textContent = String(b.name || '').replace(/\s+Cleaning Co\.?$/i, '');
    });
    var bl = document.getElementById('brandLocale');
    if (bl && b.city) bl.textContent = 'House cleaning · ' + b.city;

    var tel = telHref(b.phone), sms = smsHref(b.phone, smsBody());
    Array.prototype.forEach.call(document.querySelectorAll('a[data-tel]'), function (a) { a.setAttribute('href', tel); });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-sms]'), function (a) { a.setAttribute('href', sms); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-phone-text]'), function (el) { el.textContent = b.phone || ''; });

    setText('footTagline', b.tagline);
    var area = document.getElementById('areaLine');
    if (area) area.textContent = 'Serving ' + ((c.serviceArea && c.serviceArea.region) || b.city || '');

    renderHero(c.hero);
    renderAbout(c.about);
    renderSteps(c.howItWorks);
    renderPromises(c.promises);
    renderPricing();
    setText('pricingNote', c.pricingNote);
    renderBeforeAfter(c.beforeAfter);
    renderArea(c.serviceArea, c.areaNote);
    renderFaq(c.faq);
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
        + ' Address: ' + d.address + (d.city ? ', ' + d.city : '') + '.'
        + (d.home ? ' Home size: ' + d.home + '.' : '')
        + (d.cadence ? ' How often: ' + d.cadence + '.' : '')
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
            + 'background:#FFFFFF;color:#10251D;padding:14px 22px;border-radius:14px;'
            + 'box-shadow:0 18px 44px rgba(9,58,40,.28);border:1px solid rgba(8,105,74,.35);'
            + 'font-family:Manrope,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
            + 'opacity:0;transition:opacity .25s ease;';
          document.body.appendChild(t);
        }
        t.innerHTML = 'Call or text us at <strong style="color:#08694A;letter-spacing:.02em">' + esc(brandPhone()) + '</strong> from your phone.';
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
        home: val('q-home'), cadence: val('q-cadence'),
        notes: val('q-notes')
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
