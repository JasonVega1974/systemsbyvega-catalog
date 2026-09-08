/* sprinkler/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via SL. base.js owns the
   reduced-motion flag, the reveal observer, the content fetch/merge lifecycle,
   and calling window.renderContent(). Sinks are DOM-property assignments
   (textContent / element properties) throughout; innerHTML appears only with
   esc() per the escaping canon, and only over static icon markup.

   Content shape notes: hero/about/howItWorks/services/repairs/season/planner
   and the before-after image paths live under content.json's `niche`
   namespace and reach this renderer FLAT (base.js SLflat). brand.city is a
   COMBINED "City, ST" string, matching every niche but estate-sale.

   pricing is the QUOTE model's OBJECT {starting_at, note} at the root of
   content.json — never an array. Those two keys are exactly what the admin's
   quote editor writes (PRICE_MODEL_FIELDS.quote) and what
   api/operator-content.mjs lays over the demo via overlayObjectKeys, so both
   are rendered here verbatim and neither is reformatted. Hourly repair
   pricing is described in COPY (the repairs column and the note), never
   shipped as a second pricing model — the admin can represent one model per
   niche. */
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
  function smsBody(){ return 'Hi ' + brandName() + "! I'd like to book a free walk of my property."; }
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

  /* Two title/blurb lists that differ only in their row class and which key
     carries the heading — services use `title`/`desc`, repairs use
     `name`/`blurb`. One builder, two calls. */
  function renderRows(hostId, rows, rowClass, titleKey, bodyKey){
    var host = document.getElementById(hostId);
    if (!host || !rows || !rows.length) return;
    clear(host);
    rows.forEach(function (r) {
      if (!r || !r[titleKey]) return;
      var row = document.createElement('div'); row.className = rowClass;
      var b = document.createElement('b'); b.textContent = r[titleKey];
      var s = document.createElement('span'); s.textContent = r[bodyKey] || '';
      row.appendChild(b); row.appendChild(s);
      host.appendChild(row);
    });
  }

  function renderSeason(rows){
    var g = document.getElementById('seasonGrid');
    if (!g || !rows || !rows.length) return;
    clear(g);
    rows.forEach(function (r, i) {
      var card = document.createElement('div');
      card.className = 'sp-season__card ' + revealCls();
      card.setAttribute('data-delay', String(i % 3 + 1));
      var when = document.createElement('span'); when.className = 'sp-season__when'; when.textContent = r.when || '';
      var h3 = document.createElement('h3'); h3.textContent = r.title || '';
      var p = document.createElement('p'); p.textContent = r.desc || '';
      card.appendChild(when); card.appendChild(h3); card.appendChild(p);
      g.appendChild(card);
    });
  }

  /* The quote model's two editable fields. Rendered verbatim: this file adds
     no money copy of its own and invents no figure the operator did not
     type. The installation panel deliberately carries no number — a quote
     niche has none to carry. */
  function renderQuote(p){
    if (!p || typeof p !== 'object' || Array.isArray(p)) return;
    setText('quoteStartingAt', p.starting_at);
    setText('quoteNote', p.note);
  }

  function renderFaq(items){
    var host = document.getElementById('faqList');
    if (!host || !items || !items.length) return;
    clear(host);
    items.forEach(function (f) {
      if (!f || !f.q) return;
      var d = document.createElement('details'); d.className = 'faq';
      var sm = document.createElement('summary');
      sm.appendChild(document.createTextNode(f.q));
      var plus = document.createElement('span');
      plus.className = 'plus'; plus.setAttribute('aria-hidden', 'true'); plus.textContent = '+';
      sm.appendChild(plus);
      var body = document.createElement('div'); body.className = 'faq__body';
      body.textContent = f.a || '';
      d.appendChild(sm); d.appendChild(body);
      host.appendChild(d);
    });
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

  /* ---- scope builder ----------------------------------------------------
     Three pickers that compose a plain-language summary of what a walk would
     be looking at, and nothing else. It never prints, derives or implies a
     price: this niche's model is `quote`, and the only figure on the page is
     the operator's own pricing.starting_at. The summary rides along on the
     lead so the first call starts from something real. */
  var PLANNER_IDS = { property: 'pl-property', system: 'pl-system', surface: 'pl-surface' };

  function fillSelect(sel, options){
    if (!sel || !options || !options.length) return;
    var keep = sel.value;
    clear(sel);
    options.forEach(function (label) {
      var o = document.createElement('option');
      o.value = label; o.textContent = label;
      sel.appendChild(o);
    });
    if (keep) sel.value = keep;
  }

  function plannerValue(key){
    var sel = document.getElementById(PLANNER_IDS[key]);
    return sel ? (sel.value || '') : '';
  }

  function updateQuote(){
    var out = document.getElementById('plannerSummary');
    var property = plannerValue('property');
    var system = plannerValue('system');
    var surface = plannerValue('surface');
    if (!property && !system && !surface) return '';
    var summary = [property, system, surface].filter(Boolean).join(' · ');
    if (out) {
      out.textContent = summary
        ? 'We would be walking: ' + summary + '. Bring that up when we call and we will already be on the same page.'
        : '';
    }
    var scope = document.getElementById('q-scope');
    if (scope) scope.value = summary;
    return summary;
  }

  function renderPlanner(pl){
    if (!pl) return;
    setText('plannerPrompt', pl.prompt);
    setText('plannerNote', pl.note);
    fillSelect(document.getElementById(PLANNER_IDS.property), pl.property);
    fillSelect(document.getElementById(PLANNER_IDS.system), pl.system);
    fillSelect(document.getElementById(PLANNER_IDS.surface), pl.surface);
    updateQuote();
  }

  function renderContent(c){
    var b = c.brand || {};
    /* Full name everywhere; the nav lockup drops a trailing " Irrigation Co."
       because the line under it already says "Irrigation · <city>". */
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand]'), function (el) { el.textContent = b.name || ''; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand-short]'), function (el) {
      el.textContent = String(b.name || '').replace(/\s+Irrigation(\s+Co\.?)?$/i, '');
    });
    var bl = document.getElementById('brandLocale');
    if (bl && b.city) bl.textContent = 'Irrigation · ' + b.city;

    var tel = telHref(b.phone), sms = smsHref(b.phone, smsBody());
    Array.prototype.forEach.call(document.querySelectorAll('a[data-tel]'), function (a) { a.setAttribute('href', tel); });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-sms]'), function (a) { a.setAttribute('href', sms); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-phone-text]'), function (el) { el.textContent = b.phone || ''; });
    /* The PUBLIC contact address (brand.email), not brand.leadEmail — leads
       route to the lead inbox through the form POST and are never printed. */
    Array.prototype.forEach.call(document.querySelectorAll('a[data-email]'), function (a) {
      if (!b.email) { a.hidden = true; return; }
      a.hidden = false;
      a.setAttribute('href', 'mailto:' + b.email);
      a.textContent = b.email;
    });

    setText('footTagline', b.tagline);
    var area = document.getElementById('areaLine');
    if (area) area.textContent = 'Serving ' + ((c.serviceArea && c.serviceArea.region) || b.city || '');

    renderHero(c.hero);
    renderAbout(c.about);
    renderSteps(c.howItWorks);
    renderRows('servicesGrid', c.services, 'sp-svc__row', 'title', 'desc');
    renderRows('repairsList', c.repairs, 'sp-fix__row', 'name', 'blurb');
    setText('repairsNote', c.repairsNote);
    renderSeason(c.season);
    setText('baLead', c.beforeAfterLead);
    setText('baNote', c.beforeAfterNote);
    renderQuote(c.pricing);
    renderPlanner(c.planner);
    renderFaq(c.faq);
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

  // scope builder: recompose the summary whenever a picker moves
  var plannerCard = document.getElementById('plannerCard');
  if (plannerCard) {
    plannerCard.addEventListener('change', function (e) {
      if (e.target && e.target.tagName === 'SELECT') updateQuote();
    });
  }

  /* ===== walk request form =====
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
      var body = 'Hi ' + brandName() + "! I'd like to book a free walk of my property."
        + ' Name: ' + d.name + '.'
        + ' Phone: ' + d.phone + '.'
        + ' Property: ' + d.address + (d.city ? ', ' + d.city : '') + '.'
        + (d.scope ? ' Looking at: ' + d.scope + '.' : '')
        + (d.date ? ' Preferred date: ' + d.date + '.' : '')
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
            + 'background:#10262E;color:#EAF4F1;padding:14px 22px;border-radius:12px;'
            + 'box-shadow:0 12px 40px rgba(0,0,0,.6);border:1px solid rgba(79,215,154,.4);'
            + 'font-family:"Instrument Sans",system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
            + 'opacity:0;transition:opacity .25s ease;';
          document.body.appendChild(t);
        }
        t.innerHTML = 'Call or text us at <strong style="color:#4FD79A;letter-spacing:.02em">' + esc(brandPhone()) + '</strong> from your phone.';
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
          dm.textContent = 'We got your info. We\'ll text you at ' + phone + ' to set up your free walk. Opening a text so you can send us a copy too — just hit send.';
        } else {
          dm.textContent = 'We got your info. We\'ll text you at ' + phone + ' from ' + brandPhone() + ' to set up your free walk. Keep an eye on your messages.';
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
        date: val('q-date'), scope: val('q-scope') || updateQuote(),
        notes: val('q-notes')
      };

      // build request per provider
      var url, payload, headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (LEAD.provider === 'web3forms' && LEAD.web3formsKey) {
        url = 'https://api.web3forms.com/submit';
        payload = Object.assign({
          access_key: LEAD.web3formsKey,
          subject: 'New walk request: ' + data.name + ' — ' + data.city,
          from_name: brandName() + ' site'
        }, data);
      } else {
        url = 'https://formsubmit.co/ajax/' + encodeURIComponent(brandEmail());
        payload = Object.assign({
          _subject: 'New walk request: ' + data.name + ' — ' + data.city,
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
