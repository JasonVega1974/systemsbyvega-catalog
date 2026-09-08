/* personal-assistant/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via SL. base.js owns the
   reduced-motion flag, the reveal observer, the content fetch/merge lifecycle,
   and calling window.renderContent(). Sinks are DOM-property assignments
   (textContent / element properties) throughout; innerHTML appears only for
   static icon markup that carries no content value.

   Content shape notes: hero/about/plate/week/howItWorks/boundaries live under
   content.json's `niche` namespace and reach this renderer FLAT (base.js
   SLflat). brand.city is a COMBINED "City, ST" string here, not split.
   pricing is the tiers-model ARRAY and every row follows the platform display
   -string contract: label, blurb (the PRICE DISPLAY STRING — this is where
   ARRAY_FIELD_MAPS.pricing lands an operator's price_label save), per, note,
   features, highlight. Reading a price from anything but blurb would be a
   silent no-op the moment an operator edited their rates, so blurb is what is
   read below, and p.note is rendered rather than dropped because the admin
   offers that field too. The SAVED array is authoritative for length: this
   renderer iterates whatever it is handed and never pads from the demo. */
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
  function smsBody(){ return 'Hi ' + brandName() + "! I'd like to start a list."; }
  function setText(id, v){ var el = document.getElementById(id); if (el && v != null && v !== '') el.textContent = v; }
  function clear(el){ while (el && el.firstChild) el.removeChild(el.firstChild); }

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

  /* The services board: three tabbed columns, order preserved from content. */
  function renderPlate(groups){
    var g = document.getElementById('plateGrid');
    if (!g || !groups || !groups.length) return;
    clear(g);
    groups.forEach(function (grp, i) {
      if (!grp) return;
      var col = document.createElement('div');
      col.className = 'plate-col ' + revealCls();
      col.setAttribute('data-delay', String(i % 3 + 1));

      var head = document.createElement('div');
      head.className = 'plate-col__head';
      var tab = document.createElement('span');
      tab.className = 'plate-col__tab';
      tab.textContent = grp.group || '';
      head.appendChild(tab);
      if (grp.blurb) {
        var blurb = document.createElement('p');
        blurb.className = 'plate-col__blurb';
        blurb.textContent = grp.blurb;
        head.appendChild(blurb);
      }
      col.appendChild(head);

      var ul = document.createElement('ul');
      ul.className = 'plate-col__list';
      (grp.items || []).forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      });
      col.appendChild(ul);
      g.appendChild(col);
    });
  }

  /* The weekday rail — this niche's substitute for a photo gallery. */
  function renderWeek(days){
    var rail = document.getElementById('weekRail');
    if (!rail || !days || !days.length) return;
    clear(rail);
    days.forEach(function (d, i) {
      if (!d) return;
      var li = document.createElement('li');
      li.className = 'wday ' + revealCls();
      li.setAttribute('data-delay', String(i % 3 + 1));
      var day = document.createElement('span');
      day.className = 'wday__day';
      day.textContent = d.day || '';
      var h3 = document.createElement('h3'); h3.textContent = d.title || '';
      var p = document.createElement('p'); p.textContent = d.desc || '';
      li.appendChild(day); li.appendChild(h3); li.appendChild(p);
      rail.appendChild(li);
    });
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

  /* ===== the tier picker =====
     Cards are labels wrapping a radio, so the visitor's choice is a real form
     control (keyboard reachable, announced) and it carries into the intake
     form. `picked` survives a re-render — an operator edit landing mid-visit
     must not silently move somebody's selection. */
  var picked = '';

  function tierRows(){
    var rows = (cc() || {}).pricing;
    return Array.isArray(rows) ? rows : [];
  }

  /* The one control on this page that changes a displayed price. Reads the
     checked row out of the live pricing array by label — never off the DOM
     text — so what lands in the lead is what the operator actually saved. */
  function syncSummary(){
    var rows = tierRows();
    var row = null, i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].label === picked) { row = rows[i]; break; }
    }
    if (!row) row = rows[0] || null;

    var line = document.getElementById('pickedLine');
    var field = document.getElementById('q-tier');
    if (!row) {
      if (line) line.textContent = '';
      if (field) field.value = '';
      return;
    }
    var price = [row.blurb, row.per].filter(Boolean).join(' ');
    var summary = price ? (row.label + ' — ' + price) : String(row.label || '');
    if (field) field.value = summary;
    if (line) line.textContent = summary
      ? ('You picked: ' + summary + '. Nothing is locked in — it just tells me where to start.')
      : '';
  }

  function renderPrices(rows){
    var g = document.getElementById('priceGrid');
    if (!g || !Array.isArray(rows) || !rows.length) return;

    /* Keep a live selection if its tier survived the edit; otherwise fall to
       the highlighted row, then the first row. */
    var labels = rows.map(function (p) { return p && p.label; });
    if (labels.indexOf(picked) === -1) {
      var best = rows.filter(function (p) { return p && p.highlight; })[0];
      picked = String((best && best.label) || labels[0] || '');
    }

    clear(g);
    rows.forEach(function (p, i) {
      if (!p) return;
      var label = document.createElement('label');
      label.className = 'pcard ' + (p.highlight ? 'pcard--best ' : '') + revealCls();
      label.setAttribute('data-delay', String(i % 3 + 1));

      var input = document.createElement('input');
      input.className = 'pcard__in';
      input.type = 'radio';
      input.name = 'wf-tier';
      input.value = String(p.label || '');
      input.checked = (String(p.label || '') === picked);
      label.appendChild(input);

      var body = document.createElement('span');
      body.className = 'pcard__body';

      /* p.note is an admin-editable field on this row. Ten niches render the
         tier and drop the note; this one renders it, and only when it has
         something in it. The highlighted row wears it as a flag above the
         name, every other row as a footnote under the features. */
      if (p.note && p.highlight) {
        var flag = document.createElement('span');
        flag.className = 'pcard__flag';
        flag.textContent = p.note;
        body.appendChild(flag);
      }

      var name = document.createElement('span');
      name.className = 'pcard__label';
      name.textContent = p.label || '';
      body.appendChild(name);

      /* blurb is the display string. Absent means the operator cleared it —
         render nothing rather than a bare "$0" or an empty currency stub. */
      if (p.blurb) {
        var price = document.createElement('span');
        price.className = 'pcard__price';
        price.appendChild(document.createTextNode(p.blurb));
        if (p.per) {
          var per = document.createElement('span');
          per.className = 'pcard__per';
          per.textContent = p.per;
          price.appendChild(per);
        }
        body.appendChild(price);
      }

      var feats = document.createElement('span');
      feats.className = 'pcard__feats';
      (p.features || []).forEach(function (f) {
        var li = document.createElement('span');
        li.className = 'pcard__feat';
        li.textContent = f;
        feats.appendChild(li);
      });
      body.appendChild(feats);

      if (p.note && !p.highlight) {
        var note = document.createElement('span');
        note.className = 'pcard__note';
        note.textContent = p.note;
        body.appendChild(note);
      }

      label.appendChild(body);
      g.appendChild(label);
    });

    syncSummary();
  }

  function renderBounds(b){
    if (!b) return;
    setText('boundHeading', b.heading);
    setText('boundLead', b.lead);
    setText('boundNote', b.note);
    var g = document.getElementById('boundList');
    if (!g || !b.items || !b.items.length) return;
    clear(g);
    b.items.forEach(function (it, i) {
      if (!it) return;
      var card = document.createElement('div');
      card.className = 'bound ' + revealCls();
      card.setAttribute('data-delay', String(i % 3 + 1));
      var h3 = document.createElement('h3'); h3.textContent = it.title || '';
      var p = document.createElement('p'); p.textContent = it.desc || '';
      card.appendChild(h3); card.appendChild(p);
      g.appendChild(card);
    });
  }

  function renderArea(sa){
    if (!sa) return;
    setText('areaShort', sa.short);
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
    setText('meetName', o.name);
    setText('meetHeading', o.heading);
    setText('meetDesc', o.bio);
    var mp = document.getElementById('meetPhoto');
    if (mp) {
      clear(mp);
      if (o.photo) {
        var img = document.createElement('img');
        img.src = o.photo;
        img.alt = o.name ? ('Photo of ' + o.name) : 'Photo of the owner';
        mp.appendChild(img);
        mp.removeAttribute('aria-label'); mp.removeAttribute('role');
      }
    }
  }

  /* An operator's uploaded logo (manifest photoSlots includes 'logo', and the
     merge lands it on brand.logo). Swapping the drawn mark for it is what
     makes that upload slot honest — a slot the page never renders would be an
     admin control that goes nowhere. Empty leaves the drawn mark alone. */
  function renderMarks(b){
    ['navMark', 'footMark'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var svg = el.querySelector('svg');
      var img = el.querySelector('img');
      if (!b.logo) {
        /* Hide rather than remove, both ways: an operator who clears the
           logo again gets the drawn mark back without a reload. */
        if (img) img.hidden = true;
        if (svg) svg.removeAttribute('hidden');
        return;
      }
      if (!img) { img = document.createElement('img'); el.appendChild(img); }
      img.hidden = false;
      img.src = b.logo;
      img.alt = (b.name || 'Business') + ' logo';
      if (svg) svg.setAttribute('hidden', 'hidden');
    });
  }

  function renderContent(c){
    var b = c.brand || {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand]'), function (el) { el.textContent = b.name || ''; });

    var bl = document.getElementById('brandLocale');
    if (bl && b.city) bl.textContent = 'Errands & admin · ' + b.city;

    var tel = telHref(b.phone), sms = smsHref(b.phone, smsBody());
    Array.prototype.forEach.call(document.querySelectorAll('a[data-tel]'), function (a) { a.setAttribute('href', tel); });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-sms]'), function (a) { a.setAttribute('href', sms); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-phone-text]'), function (el) { el.textContent = b.phone || ''; });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-mail]'), function (a) {
      if (!b.email) { a.hidden = true; return; }
      a.hidden = false;
      a.setAttribute('href', 'mailto:' + b.email);
      a.textContent = b.email;
    });

    renderMarks(b);
    setText('footTagline', b.tagline);
    var area = document.getElementById('areaLine');
    if (area) area.textContent = 'Serving ' + ((c.serviceArea && c.serviceArea.region) || b.city || '');

    renderHero(c.hero);
    renderAbout(c.about);
    renderPlate(c.plate);
    setText('plateNote', c.plateNote);
    renderWeek(c.week);
    setText('weekNote', c.weekNote);
    renderSteps(c.howItWorks);
    renderPrices(c.pricing);
    setText('pricingNote', c.pricingNote);
    renderBounds(c.boundaries);
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

  /* Tier picker. Delegated on the grid element, which survives every
     re-render (only its children are replaced), so this binds exactly once. */
  var priceGrid = document.getElementById('priceGrid');
  if (priceGrid) {
    priceGrid.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.name !== 'wf-tier') return;
      picked = t.value || '';
      syncSummary();
    });
    priceGrid.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.name === 'wf-tier') { picked = t.value || ''; syncSummary(); }
    });
  }

  /* ===== intake form =====
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
      var body = 'Hi ' + brandName() + "! I'd like to start a list."
        + ' Name: ' + d.name + '.'
        + ' Phone: ' + d.phone + '.'
        + ' Town: ' + d.city + '.'
        + (d.who ? ' For: ' + d.who + '.' : '')
        + (d.tier ? ' Thinking: ' + d.tier + '.' : '')
        + (d.notes ? ' The list: ' + d.notes + '.' : '');
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
            + 'background:#FFFFFF;color:#22201C;padding:14px 22px;border-radius:14px;'
            + 'box-shadow:0 18px 46px -18px rgba(34,32,28,.5);border:1px solid rgba(28,94,89,.28);'
            + 'font-family:Manrope,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
            + 'opacity:0;transition:opacity .25s ease;';
          document.body.appendChild(t);
        }
        t.innerHTML = 'Call or text <strong style="color:#1C5E59;letter-spacing:.02em">' + esc(brandPhone()) + '</strong> from your phone.';
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
          dm.textContent = 'I have your list. I will call you at ' + phone + ' to talk it through. Opening a text so you can send me a copy too — just hit send.';
        } else {
          dm.textContent = 'I have your list. I will call you at ' + phone + ' from ' + brandPhone() + ' to talk it through. Nothing starts until we have agreed what is on it.';
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
      var checks = ['q-name', 'q-phone', 'q-city'];
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
                                            : 'Please complete the required fields and tick the consent box.';
        if (firstBad) firstBad.focus();
        return;
      }

      var data = {
        name: val('q-name'), phone: val('q-phone'), email: val('q-email'),
        city: val('q-city'), who: val('q-who'), start: val('q-start'),
        tier: val('q-tier'), notes: val('q-notes')
      };

      // build request per provider
      var url, payload, headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (LEAD.provider === 'web3forms' && LEAD.web3formsKey) {
        url = 'https://api.web3forms.com/submit';
        payload = Object.assign({
          access_key: LEAD.web3formsKey,
          subject: 'New list: ' + data.name + ' — ' + data.city,
          from_name: brandName() + ' site'
        }, data);
      } else {
        url = 'https://formsubmit.co/ajax/' + encodeURIComponent(brandEmail());
        payload = Object.assign({
          _subject: 'New list: ' + data.name + ' — ' + data.city,
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
            msgEl.textContent = 'Opening a text with your details — just hit send and I will take it from there.';
            window.location.href = buildSms(data);
          } else {
            msgEl.className = 'book__msg err';
            msgEl.textContent = 'Could not reach our server. Please text your list to ' + brandPhone() + ' and I will pick it up from there.';
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
