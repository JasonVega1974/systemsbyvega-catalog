/* window-cleaning/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via SL. base.js owns the
   reduced-motion flag, the reveal observer, the content fetch/merge lifecycle,
   and calling window.renderContent(). Sinks are DOM-property assignments
   (textContent / element properties) throughout; esc() is imported for the
   escaping canon even though nothing here concatenates into markup.

   Content shape notes: hero/about/howItWorks/included/faq/contact and the
   before/after image paths live under content.json's `niche` namespace and
   reach this renderer FLAT (base.js SLflat). brand.city carries the combined
   "City, ST" string, which is what api/operator-content.mjs writes.

   PRICING IS THE TIERS MODEL — a root-level ARRAY of
   {label, blurb, per, note, highlight, features}. `blurb` IS the price
   display string: ARRAY_FIELD_MAPS.pricing lands an operator's admin
   price_label on that key, so reading anything else here would make their
   save a silent no-op. `note` is offered by the admin too and is rendered on
   the card below, hidden when the operator clears it. Nothing in this file
   computes, derives or formats a figure — the strings render verbatim. */
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
  function brandName(){ return (cc().brand && cc().brand.name) || CONTENT.brand.name; }
  function brandPhone(){ return (cc().brand && cc().brand.phone) || CONTENT.brand.phone; }
  function brandEmail(){ return (cc().brand && (cc().brand.leadEmail || cc().brand.email)) || (CONTENT.brand.leadEmail || CONTENT.brand.email); }
  function smsBody(){ return 'Hi ' + brandName() + "! I'd like a window cleaning quote."; }
  function setText(id, v){ var el = document.getElementById(id); if (el && v != null && v !== '') el.textContent = v; }
  function clear(el){ while (el && el.firstChild) el.removeChild(el.firstChild); }

  /* Re-rendered regions appear instantly once the boot render + reveal
     observer have run (this listener registers AFTER base.js's, so it fires
     after boot). Before that, first-paint nodes keep .reveal and get observed. */
  var revealReady = false;
  document.addEventListener('DOMContentLoaded', function () { revealReady = true; });
  function revealCls(){ return revealReady ? 'reveal in' : 'reveal'; }

  var PIN_D = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z';

  /* Small SVG builders. Icons are static geometry authored here, never content,
     so they are assembled as elements rather than markup strings. */
  function svgEl(name){ return document.createElementNS('http://www.w3.org/2000/svg', name); }
  function iconPin(){
    var s = svgEl('svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    var p = svgEl('path'); p.setAttribute('d', PIN_D);
    var c = svgEl('circle'); c.setAttribute('cx', '12'); c.setAttribute('cy', '10'); c.setAttribute('r', '3');
    s.appendChild(p); s.appendChild(c);
    return s;
  }
  function iconTick(){
    var s = svgEl('svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    var p = svgEl('path'); p.setAttribute('d', 'M5 12l5 5L20 7');
    s.appendChild(p);
    return s;
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

  function renderIncluded(rows){
    var g = document.getElementById('incGrid');
    if (!g || !rows || !rows.length) return;
    clear(g);
    rows.forEach(function (r, i) {
      var card = document.createElement('div');
      card.className = 'inc ' + revealCls();
      card.setAttribute('data-delay', String(i % 3 + 1));
      var h3 = document.createElement('h3'); h3.textContent = r.title || '';
      var p = document.createElement('p'); p.textContent = r.desc || '';
      card.appendChild(h3); card.appendChild(p);
      g.appendChild(card);
    });
  }

  /* ===== pricing =====
     The tier cards. Every string on a card comes straight off the row:
     label, blurb (the price display string), per, note, features. A row with
     an empty blurb renders no price line at all rather than a bare currency
     symbol or a fabricated "$0". */
  var tierCards = [];      // index-aligned with the rendered pricing rows

  function renderTiers(rows){
    var g = document.getElementById('tiersGrid');
    if (!g) return;
    var pricing = Array.isArray(rows) ? rows : [];
    clear(g);
    tierCards = [];
    pricing.forEach(function (p, i) {
      var card = document.createElement('div');
      card.className = 'tier' + (p.highlight ? ' tier--best' : '') + ' ' + revealCls();
      card.setAttribute('data-delay', String(i % 3 + 1));

      var label = document.createElement('span');
      label.className = 'tier__label';
      label.textContent = p.label || '';
      card.appendChild(label);

      if (p.blurb) {
        var price = document.createElement('div');
        price.className = 'tier__price';
        price.textContent = p.blurb;
        card.appendChild(price);
      }
      if (p.per) {
        var per = document.createElement('div');
        per.className = 'tier__per';
        per.textContent = p.per;
        card.appendChild(per);
      }
      /* p.note: offered by the admin (PRICE_MODEL_FIELDS tiers) and rendered
         here. Hidden entirely when the operator clears it, so an emptied note
         leaves no dangling divider behind. */
      var note = document.createElement('div');
      note.className = 'tier__note';
      note.textContent = p.note || '';
      note.hidden = !p.note;
      card.appendChild(note);

      var feats = Array.isArray(p.features) ? p.features : [];
      if (feats.length) {
        var ul = document.createElement('ul');
        ul.className = 'tier__features';
        feats.forEach(function (f) {
          var li = document.createElement('li');
          li.appendChild(iconTick());
          li.appendChild(document.createTextNode(f == null ? '' : String(f)));
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }

      var cta = document.createElement('a');
      cta.className = 'btn' + (p.highlight ? '' : ' btn--ghost');
      cta.setAttribute('href', '#book');
      cta.textContent = 'Get this quote';
      card.appendChild(cta);

      g.appendChild(card);
      tierCards.push(card);
    });
  }

  /* ===== the pane-count picker =====
     It SELECTS one of the published tiers; it never computes a figure of its
     own. The readout echoes that row's own label / blurb / per, so an
     operator's saved price_label is the only money on screen, and the card it
     points at gets a .is-match ring. Length follows the saved array. */
  var paneIdx = -1;

  function renderCounterPills(rows){
    var box = document.getElementById('counterPills');
    if (!box) return;
    var pricing = Array.isArray(rows) ? rows : [];
    clear(box);
    if (paneIdx >= pricing.length) paneIdx = -1;
    pricing.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'counter__pill';
      b.textContent = p.label || ('Option ' + (i + 1));
      b.setAttribute('aria-pressed', paneIdx === i ? 'true' : 'false');
      b.setAttribute('data-idx', String(i));
      box.appendChild(b);
    });
  }

  /* Named renderPrice(): the one place the picker's readout is written. */
  function renderPrice(){
    var read = document.getElementById('counterRead');
    var pricing = Array.isArray(cc().pricing) ? cc().pricing : [];
    var row = paneIdx > -1 ? pricing[paneIdx] : null;

    Array.prototype.forEach.call(document.querySelectorAll('.counter__pill'), function (b) {
      b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-idx')) === paneIdx));
    });
    tierCards.forEach(function (card, i) { card.classList.toggle('is-match', i === paneIdx); });

    if (!read) return;
    clear(read);
    if (!row) {
      read.textContent = 'Pick a range and we’ll point you at the tier it lands in.';
      return;
    }
    read.appendChild(document.createTextNode('That’s the '));
    var strong = document.createElement('b');
    strong.textContent = row.label || '';
    read.appendChild(strong);
    read.appendChild(document.createTextNode(' tier'));
    if (row.blurb) {
      read.appendChild(document.createTextNode(' — '));
      var money = document.createElement('b');
      money.textContent = row.blurb + (row.per ? ' ' + row.per : '');
      read.appendChild(money);
      read.appendChild(document.createTextNode('.'));
    } else {
      read.appendChild(document.createTextNode('.'));
    }
  }

  /* The quote form's pane dropdown is rebuilt from the same rows, so an
     edited tier label shows up in the option text instead of going stale. */
  function renderPaneSelect(rows){
    var sel = document.getElementById('q-panes');
    if (!sel) return;
    var pricing = Array.isArray(rows) ? rows : [];
    var prev = sel.value;
    clear(sel);
    var first = document.createElement('option');
    first.value = 'Not counted yet';
    first.textContent = 'Not counted yet';
    sel.appendChild(first);
    pricing.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.label || '';
      o.textContent = p.label || '';
      sel.appendChild(o);
    });
    var opts = Array.prototype.map.call(sel.options, function (o) { return o.value; });
    var at = opts.indexOf(prev);
    sel.selectedIndex = at > -1 ? at : 0;
  }

  function renderFaq(rows){
    var g = document.getElementById('faqList');
    if (!g || !rows || !rows.length) return;
    clear(g);
    rows.forEach(function (row) {
      var d = document.createElement('details');
      d.className = 'faq ' + revealCls();
      var s = document.createElement('summary');
      s.appendChild(document.createTextNode(row.q || ''));
      var plus = document.createElement('span');
      plus.className = 'plus';
      plus.setAttribute('aria-hidden', 'true');
      plus.textContent = '+';
      s.appendChild(plus);
      var body = document.createElement('div');
      body.className = 'faq__body';
      body.textContent = row.a || '';
      d.appendChild(s); d.appendChild(body);
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
      chip.appendChild(iconPin());
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
    /* The nav lockup drops a trailing " Window Co." — the line beneath it
       already says "Window cleaning · <city>". */
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand-short]'), function (el) {
      el.textContent = String(b.name || '').replace(/\s+Window Co\.?$/i, '');
    });
    var bl = document.getElementById('brandLocale');
    if (bl && b.city) bl.textContent = 'Window cleaning · ' + b.city;

    var tel = telHref(b.phone), sms = smsHref(b.phone, smsBody());
    Array.prototype.forEach.call(document.querySelectorAll('a[data-tel]'), function (a) { a.setAttribute('href', tel); });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-sms]'), function (a) { a.setAttribute('href', sms); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-phone-text]'), function (el) { el.textContent = b.phone || ''; });

    setText('footTagline', b.tagline);
    var area = document.getElementById('areaLine');
    if (area) area.textContent = 'Serving ' + ((c.serviceArea && c.serviceArea.region) || b.city || '');

    var hoursEl = document.getElementById('ctaHours');
    if (hoursEl) {
      var hours = (c.contact && c.contact.hours) || '';
      hoursEl.textContent = hours;
      hoursEl.hidden = !hours;
    }

    renderHero(c.hero);
    renderAbout(c.about);
    renderSteps(c.howItWorks);
    renderIncluded(c.included);

    renderTiers(c.pricing);
    renderCounterPills(c.pricing);
    renderPaneSelect(c.pricing);
    renderPrice();
    setText('countHelp', c.countHelp);
    setText('pricingNote', c.pricingNote);

    setText('baHeading', c.beforeAfterHeading);
    setText('baBlurb', c.beforeAfterBlurb);

    renderFaq(c.faq);
    renderArea(c.serviceArea);
    renderOwner(c.owner);
  }

  /* The picker's click handler is delegated once, so it survives every
     re-render of the pill row (boot, then again after the content fetch). */
  var pillBox = document.getElementById('counterPills');
  if (pillBox) {
    pillBox.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.counter__pill');
      if (!b) return;
      var i = Number(b.getAttribute('data-idx'));
      paneIdx = (paneIdx === i) ? -1 : i;
      renderPrice();
      var sel = document.getElementById('q-panes');
      var pricing = Array.isArray(cc().pricing) ? cc().pricing : [];
      if (sel && paneIdx > -1 && pricing[paneIdx]) {
        var want = pricing[paneIdx].label || '';
        var opts = Array.prototype.map.call(sel.options, function (o) { return o.value; });
        var at = opts.indexOf(want);
        if (at > -1) sel.selectedIndex = at;
      }
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

  /* ===== quote request form =====
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
      var body = 'Hi ' + brandName() + "! I'd like a window cleaning quote."
        + ' Name: ' + d.name + '.'
        + ' Phone: ' + d.phone + '.'
        + ' Address: ' + d.address + (d.city ? ', ' + d.city : '') + '.'
        + (d.panes ? ' Panes: ' + d.panes + '.' : '')
        + (d.scope ? ' Scope: ' + d.scope + '.' : '')
        + (d.date ? ' Preferred week: ' + d.date + '.' : '')
        + (d.notes ? ' Notes: ' + d.notes + '.' : '');
      return smsHref(brandPhone(), body);
    };

    var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    /* Desktop guard: never let sms: or tel: links open the OS "pick an app"
       dialog — show a helpful toast instead. Mobile is untouched. The toast is
       assembled from nodes, so the phone number lands via textContent. */
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
            + 'background:#FFFFFF;color:#16272E;padding:14px 22px;border-radius:14px;'
            + 'box-shadow:0 18px 44px rgba(16,72,88,.28);border:1px solid rgba(17,151,175,.4);'
            + 'font-family:Figtree,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
            + 'opacity:0;transition:opacity .25s ease;';
          document.body.appendChild(t);
        }
        while (t.firstChild) t.removeChild(t.firstChild);
        t.appendChild(document.createTextNode('Call or text us at '));
        var num = document.createElement('strong');
        num.style.cssText = 'color:#0B6C7D;letter-spacing:.02em';
        num.textContent = brandPhone();
        t.appendChild(num);
        t.appendChild(document.createTextNode(' from your phone.'));
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
          dm.textContent = 'We got your details. We’ll text you at ' + phone + ' with a flat quote. Opening a text so you can send us a copy too — just hit send.';
        } else {
          dm.textContent = 'We got your details. We’ll text you at ' + phone + ' from ' + brandPhone() + ' with a flat quote and the next open slot.';
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
        var isBad = !el.value || !el.value.trim();
        setErr(el.closest('.field'), isBad);
        if (isBad) { ok = false; if (!firstBad) firstBad = el; }
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
        panes: val('q-panes'), scope: val('q-scope'),
        date: val('q-date'), notes: val('q-notes')
      };

      // build request per provider
      var url, payload, headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (LEAD.provider === 'web3forms' && LEAD.web3formsKey) {
        url = 'https://api.web3forms.com/submit';
        payload = Object.assign({
          access_key: LEAD.web3formsKey,
          subject: 'New window quote request: ' + data.name + ' — ' + data.city,
          from_name: brandName() + ' site'
        }, data);
      } else {
        url = 'https://formsubmit.co/ajax/' + encodeURIComponent(brandEmail());
        payload = Object.assign({
          _subject: 'New window quote request: ' + data.name + ' — ' + data.city,
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
            msgEl.textContent = 'Opening a text with your details — just hit send and we’ll take it from there.';
            window.location.href = buildSms(data);
          } else {
            msgEl.className = 'book__msg err';
            msgEl.textContent = 'Couldn’t reach our server. Please text your details to ' + brandPhone() + ' and we’ll get you a quote.';
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

  /* esc() is part of this build's escaping canon; referenced so the import is
     never quietly dropped by a future edit that does need a string sink. */
  void esc;

  window.renderContent = renderContent;
})();
