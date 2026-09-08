/* christmas-lights/niche.js — this niche's renderer and interactive logic.
   Shared utilities come from _template/base.js via SL. base.js owns the
   reduced-motion flag, the reveal observer, the content fetch/merge lifecycle,
   and calling window.renderContent(). Sinks are DOM-property assignments
   (textContent / element properties) throughout; esc() is imported for the
   escaping canon even though nothing here concatenates into markup.

   Content shape notes: hero/about/howItWorks/included/faq/pricingNote live
   under content.json's `niche` namespace and reach this renderer FLAT
   (base.js SLflat). brand.city carries the combined "City, ST" string, which
   is what api/operator-content.mjs writes.

   PRICING IS THE TIERS MODEL — a root-level ARRAY of
   {label, blurb, per, note, highlight, features}. `blurb` IS the price
   display string: ARRAY_FIELD_MAPS.pricing lands an operator's admin
   price_label on that key, so reading anything else here would make their
   save a silent no-op. On this niche the third tier's blurb is the word
   "Quoted", not a figure, so nothing below prefixes a currency symbol,
   parses a number, or assumes the string is numeric at all. Nothing here
   computes or formats money — the strings render verbatim.

   testimonials is [] and stays [] — the shared reviews component owns that
   empty state. No quote, name, rating or count is generated anywhere. */
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
     effect everywhere — form destination, SMS fallback, toast — no rebuild. */
  function cc(){ return window.CONTENT || CONTENT; }
  function brandName(){ return (cc().brand && cc().brand.name) || CONTENT.brand.name; }
  function brandPhone(){ return (cc().brand && cc().brand.phone) || CONTENT.brand.phone; }
  function brandEmail(){ return (cc().brand && (cc().brand.leadEmail || cc().brand.email)) || (CONTENT.brand.leadEmail || CONTENT.brand.email); }
  function smsBody(){ return 'Hi ' + brandName() + "! I'd like a holiday lighting quote."; }
  function setText(id, v){ var el = document.getElementById(id); if (el && v != null && v !== '') el.textContent = v; }
  function clear(el){ while (el && el.firstChild) el.removeChild(el.firstChild); }

  /* Re-rendered regions appear instantly once the boot render + reveal
     observer have run (this listener registers AFTER base.js's, so it fires
     after boot). Before that, first-paint nodes keep .reveal and get observed. */
  var revealReady = false;
  document.addEventListener('DOMContentLoaded', function () { revealReady = true; });
  function revealCls(){ return revealReady ? 'reveal in' : 'reveal'; }

  var PIN_D = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z';

  /* Icons are static geometry authored here, never content, so they are
     assembled as elements rather than markup strings. */
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
      step.setAttribute('data-delay', String((i % 3) + 1));
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
      card.setAttribute('data-delay', String((i % 3) + 1));
      var h3 = document.createElement('h3'); h3.textContent = r.title || '';
      var p = document.createElement('p'); p.textContent = r.desc || '';
      card.appendChild(h3); card.appendChild(p);
      g.appendChild(card);
    });
  }

  /* ===== pricing =====
     Every string on a card comes straight off the row: label, blurb (the
     price display string), per, note, features. A row with an empty blurb
     renders no price line at all rather than a bare symbol or a made-up
     figure. The highlighted row wears the "Our pick" badge from
     sections.css — never a badge implying booking volume, because this is a
     demonstration business with no customers. */
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
      card.setAttribute('data-delay', String((i % 3) + 1));

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
          li.textContent = f == null ? '' : String(f);
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

  /* ===== the package picker =====
     It SELECTS one of the published tiers; it never computes a figure of its
     own. The readout echoes that row's own label / blurb / per, so an
     operator's saved price_label is the only money on screen, and the card it
     points at gets a .is-match ring. Length follows the saved array. */
  var pickIdx = -1;

  function renderPickerPills(rows){
    var box = document.getElementById('pickerPills');
    if (!box) return;
    var pricing = Array.isArray(rows) ? rows : [];
    clear(box);
    if (pickIdx >= pricing.length) pickIdx = -1;
    pricing.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'picker__pill';
      b.textContent = p.label || ('Option ' + (i + 1));
      b.setAttribute('aria-pressed', pickIdx === i ? 'true' : 'false');
      b.setAttribute('data-idx', String(i));
      box.appendChild(b);
    });
  }

  /* Named renderPrice(): the one place the picker's readout is written. */
  function renderPrice(){
    var read = document.getElementById('pickerRead');
    var pricing = Array.isArray(cc().pricing) ? cc().pricing : [];
    var row = pickIdx > -1 ? pricing[pickIdx] : null;

    Array.prototype.forEach.call(document.querySelectorAll('.picker__pill'), function (b) {
      b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-idx')) === pickIdx));
    });
    tierCards.forEach(function (card, i) { card.classList.toggle('is-match', i === pickIdx); });

    if (!read) return;
    clear(read);
    if (!row) {
      read.textContent = 'Pick one and we’ll point you at the tier it lands in.';
      return;
    }
    read.appendChild(document.createTextNode('That’s the '));
    var strong = document.createElement('b');
    strong.textContent = row.label || '';
    read.appendChild(strong);
    read.appendChild(document.createTextNode(' package'));
    if (row.blurb) {
      read.appendChild(document.createTextNode(' — '));
      var money = document.createElement('b');
      /* blurb verbatim, per appended as written. "Quoted after a site walk"
         has to read as naturally as "$695 for the season". */
      money.textContent = row.blurb + (row.per ? ' ' + row.per : '');
      read.appendChild(money);
    }
    read.appendChild(document.createTextNode('.'));
  }

  /* The quote form's package dropdown is rebuilt from the same rows, so an
     edited tier label shows up in the option text instead of going stale. */
  function renderPackageSelect(rows){
    var sel = document.getElementById('q-package');
    if (!sel) return;
    var pricing = Array.isArray(rows) ? rows : [];
    var prev = sel.value;
    clear(sel);
    var first = document.createElement('option');
    first.value = 'Not sure yet';
    first.textContent = 'Not sure yet';
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

  /* owner.name and owner.bio ship empty on this niche. Neither is filled in
     here: the name line stays hidden until an operator saves one, and the bio
     is left genuinely empty so base.css's .owner__desc:empty placeholder can
     say so out loud rather than the page inventing a founder. */
  function renderOwner(o){
    if (!o) return;
    setText('ownerHeading', o.heading);
    var nameEl = document.getElementById('ownerName');
    if (nameEl) {
      nameEl.textContent = o.name || '';
      nameEl.hidden = !o.name;
    }
    var descEl = document.getElementById('ownerDesc');
    if (descEl) descEl.textContent = o.bio || '';
    var photo = document.getElementById('ownerPhoto');
    if (photo) {
      clear(photo);
      if (o.photo) {
        var img = document.createElement('img');
        img.src = o.photo;
        img.alt = o.name ? ('Photo of ' + o.name) : 'Photo of the owner';
        photo.appendChild(img);
      }
    }
  }

  function renderContent(c){
    var b = c.brand || {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand]'), function (el) { el.textContent = b.name || ''; });
    /* The nav lockup drops a trailing " Holiday Lighting" — the line beneath
       it already says "Holiday lighting · <city>". */
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand-short]'), function (el) {
      el.textContent = String(b.name || '').replace(/\s+Holiday Lighting$/i, '');
    });
    var bl = document.getElementById('brandLocale');
    if (bl && b.city) bl.textContent = 'Holiday lighting · ' + b.city;

    var tel = telHref(b.phone), sms = smsHref(b.phone, smsBody());
    Array.prototype.forEach.call(document.querySelectorAll('a[data-tel]'), function (a) { a.setAttribute('href', tel); });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-sms]'), function (a) { a.setAttribute('href', sms); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-phone-text]'), function (el) { el.textContent = b.phone || ''; });

    setText('heroTagline', b.tagline);
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
    renderPickerPills(c.pricing);
    renderPackageSelect(c.pricing);
    renderPrice();
    setText('pricingNote', c.pricingNote);

    renderFaq(c.faq);
    renderArea(c.serviceArea);
    renderOwner(c.owner);
  }

  /* The picker's click handler is delegated once, so it survives every
     re-render of the pill row (boot, then again after the content fetch). */
  var pillBox = document.getElementById('pickerPills');
  if (pillBox) {
    pillBox.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.picker__pill');
      if (!b) return;
      var i = Number(b.getAttribute('data-idx'));
      pickIdx = (pickIdx === i) ? -1 : i;
      renderPrice();
      var sel = document.getElementById('q-package');
      var pricing = Array.isArray(cc().pricing) ? cc().pricing : [];
      if (sel && pickIdx > -1 && pricing[pickIdx]) {
        var want = pricing[pickIdx].label || '';
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
      var body = 'Hi ' + brandName() + "! I'd like a holiday lighting quote."
        + ' Name: ' + d.name + '.'
        + ' Phone: ' + d.phone + '.'
        + ' Address: ' + d.address + (d.city ? ', ' + d.city : '') + '.'
        + (d.pkg ? ' Package: ' + d.pkg + '.' : '')
        + (d.notes ? ' Notes: ' + d.notes + '.' : '');
      return smsHref(brandPhone(), body);
    };

    var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    /* Desktop guard: never let sms: or tel: links open the OS "pick an app"
       dialog — show a toast instead. Mobile is untouched. The toast is
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
            + 'background:#173039;color:#EAF2F5;padding:14px 22px;border-radius:14px;'
            + 'box-shadow:0 18px 44px rgba(0,0,0,.6);border:1px solid rgba(232,176,75,.42);'
            + 'font-family:"Source Sans 3",system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
            + 'opacity:0;transition:opacity .25s ease;';
          document.body.appendChild(t);
        }
        clear(t);
        t.appendChild(document.createTextNode('Call or text us at '));
        var num = document.createElement('strong');
        num.style.cssText = 'color:#E8B04B;letter-spacing:.02em';
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
          dm.textContent = 'We got your details. We’ll text you at ' + phone
            + ' with a figure. Opening a text so you can send us a copy too — just hit send.';
        } else {
          dm.textContent = 'We got your details. We’ll text you at ' + phone + ' from '
            + brandPhone() + ' with a figure and the next open install date.';
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
      if (consent && !consent.checked) { ok = false; if (!firstBad) firstBad = consent; }

      if (!ok) {
        msgEl.className = 'book__msg err';
        msgEl.textContent = (consent && consent.checked)
          ? 'Please fill in the highlighted fields.'
          : 'Please complete the required fields and check the consent box.';
        if (firstBad) firstBad.focus();
        return;
      }

      var data = {
        name: val('q-name'), phone: val('q-phone'),
        address: val('q-addr'), city: val('q-city'),
        pkg: val('q-package'), notes: val('q-notes')
      };

      // build request per provider
      var url, payload, headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (LEAD.provider === 'web3forms' && LEAD.web3formsKey) {
        url = 'https://api.web3forms.com/submit';
        payload = Object.assign({
          access_key: LEAD.web3formsKey,
          subject: 'New lighting quote request: ' + data.name + ' — ' + data.city,
          from_name: brandName() + ' site'
        }, data);
      } else {
        url = 'https://formsubmit.co/ajax/' + encodeURIComponent(brandEmail());
        payload = Object.assign({
          _subject: 'New lighting quote request: ' + data.name + ' — ' + data.city,
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
            msgEl.textContent = 'Couldn’t reach our server. Please text your details to '
              + brandPhone() + ' and we’ll get you a quote.';
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
