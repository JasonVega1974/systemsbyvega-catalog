/* bbq-food-truck/niche.js — this niche's renderer and interactive logic.
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

  /* =========================================================
     OWNER-EDITABLE CONTENT
     =========================================================
     DEFAULT_CONTENT is the built-in fallback — the page renders
     from it instantly, then fetches content.json (the live copy
     the /admin/ panel edits) and re-renders with that.
     Owners: don't edit this file — use /admin/ instead.

     schedule — the Find-the-truck week. One entry per day:
       day     — full day name, exactly: "Monday" … "Sunday"
       spot    — where the truck parks (short, punchy name)
       address — street address or cross-streets shown on the card
       hours   — serving window as plain text, e.g. "11 AM – 2 PM"
       mapUrl  — a Google Maps link for the Directions button
                 (open Google Maps, find the spot, hit Share → Copy link)

     Day off? Use:  { day:"Monday", off:true, note:"why (optional)" }
     The site figures out which card is TODAY automatically —
     no dates to type, just day names. Keep all 7 days listed,
     Monday through Sunday, in order.

     menu — four fixed categories; items have name/desc/price and
     an optional image (uploaded via the admin panel).

     catering.packages — the three starting-price cards above the
     lead form. Each: label (tier + headcount), price ("$21" — the
     currency symbol renders as the small superscript), per (the
     small line under the price), best (true puts the "Most Booked"
     ribbon on it — use it on one card, or none), features (a list
     of ticked lines). Prices here are STARTING prices; every event
     still gets a real quote. Editable from /admin/ → Catering.

     brand.formEmail — where FormSubmit delivers catering leads.
     FormSubmit emails a ONE-TIME activation link to that address
     on the first real submission; click it once and every lead
     after that lands in that inbox.
     ========================================================= */
/* tel: href from the display phone — digits only, +1 for 10-digit US numbers */

  /* ---------- year stamp ---------- */
  document.getElementById('yr').textContent = new Date().getFullYear();

  /* ---------- nav solidify ---------- */
  var nav = document.getElementById('nav');
  var onScroll = function(){ nav.classList.toggle('solid', window.scrollY > 30); };
  onScroll(); window.addEventListener('scroll', onScroll, {passive:true});

  /* ---------- reveal on scroll ---------- */
  var revs = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && !reduce){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
    revs.forEach(function(r){ io.observe(r); });
  } else { revs.forEach(function(r){ r.classList.add('in'); }); }

  /* JS-rendered blocks miss the scan above (it runs once, at boot),
     so re-arm any .reveal nodes a render just created. */
  function revealScan(root){
    if(!root) return;
    var els = root.querySelectorAll('.reveal');
    Array.prototype.forEach.call(els, function(r){
      if(io && !r.classList.contains('in')) io.observe(r);
      else r.classList.add('in');
    });
  }

  /* ---------- hero smoke + embers ---------- */
  var smokes = document.getElementById('smokes');
  if(smokes && !reduce){
    var small = window.innerWidth < 700;
    var puffN = small ? 5 : 9, emberN = small ? 6 : 12, i, el, dur;
    for(i=0;i<puffN;i++){
      el = document.createElement('span');
      el.className = 'puff';
      var size = 60 + Math.random()*120;
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.left = Math.random()*100 + '%';
      dur = 16 + Math.random()*14;
      el.style.animationDuration = dur + 's';
      el.style.animationDelay = (-Math.random()*dur) + 's';
      el.style.setProperty('--drift', (Math.random()*160 - 60) + 'px');
      smokes.appendChild(el);
    }
    for(i=0;i<emberN;i++){
      el = document.createElement('span');
      el.className = 'emberbit';
      el.style.left = Math.random()*100 + '%';
      dur = 7 + Math.random()*8;
      el.style.animationDuration = dur + 's';
      el.style.animationDelay = (-Math.random()*dur) + 's';
      el.style.setProperty('--drift', (Math.random()*120 - 40) + 'px');
      var s = 2 + Math.random()*3;
      el.style.width = s + 'px';
      el.style.height = s + 'px';
      smokes.appendChild(el);
    }
  }

  /* =========================================================
     FIND THE TRUCK — render the week
     Day matching is by DAY NAME (Mon–Sun), never by typed
     dates, so the owner can't break the "today" highlight.
     ========================================================= */
  var WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var JS_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];


  function renderWeek(){
    var wrap = document.getElementById('week');
    if(!wrap) return;
    var todayName = JS_DAYS[new Date().getDay()];       // e.g. "Thursday"
    var todayIdx = WEEK.indexOf(todayName);             // 0 (Mon) … 6 (Sun)
    var html = '';

    (CONTENT.schedule || []).forEach(function(entry){
      var idx = WEEK.indexOf(entry.day);                // -1 if day is mistyped
      var isToday = idx === todayIdx;
      var isPast = idx > -1 && idx < todayIdx;
      var cls = 'daycard';
      if(entry.off) cls += ' daycard--off';
      if(isToday) cls += ' daycard--today';
      else if(isPast) cls += ' daycard--past';

      html += '<article class="' + cls + '">';
      if(isToday && !entry.off){
        html += '<span class="today-badge">We’re here today</span>';
      }
      html += '<span class="daycard__day">' + esc(entry.day) + (isToday ? ' • today' : '') + '</span>';

      if(entry.off){
        html += '<span class="daycard__off-pill">' + (isToday ? 'Truck off today' : 'No service') + '</span>';
        html += '<p class="daycard__addr">' + esc(entry.note || 'Back on the road soon.') + '</p>';
      } else {
        html += '<h3 class="daycard__spot">' + esc(entry.spot) + '</h3>';
        html += '<p class="daycard__addr">' + esc(entry.address) + '</p>';
        html += '<span class="daycard__hours"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>' + esc(entry.hours) + '</span>';
        if(isPast){
          html += '<span class="daycard__gone">Been &amp; gone</span>';
        } else {
          html += '<a class="btn btn--ghost btn--sm" href="' + esc(entry.mapUrl) + '" target="_blank" rel="noopener noreferrer">'
               + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3z"/><path d="M9 7v13M15 4v13"/></svg>'
               + 'Directions</a>';
        }
      }
      html += '</article>';
    });

    wrap.innerHTML = html;
  }

  /* =========================================================
     MENU — tab pills swap the list
     ========================================================= */
  var menuList = document.getElementById('menuList');
  var tabs = document.querySelectorAll('.menu__tabs .tab');
  var currentCat = 'plates';

  function renderMenu(cat){
    currentCat = cat;
    var items = (CONTENT.menu || {})[cat] || [];
    var html = '';
    items.forEach(function(it){
      var inner = '<div class="mi__row"><span class="mi__name">' + esc(it.name) + '</span>'
        + '<span class="mi__dots" aria-hidden="true"></span>'
        + '<span class="mi__price">' + esc(it.price) + '</span></div>'
        + '<p class="mi__desc">' + esc(it.desc) + '</p>';
      html += '<div class="mi">'
        + (it.image
            ? '<div class="mi__flex"><img class="mi__thumb" src="' + esc(it.image) + '" alt="' + esc(it.name) + '" loading="lazy"><div class="mi__inner">' + inner + '</div></div>'
            : inner)
        + '</div>';
    });
    menuList.innerHTML = html;
  }

  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      tabs.forEach(function(t){
        t.classList.toggle('on', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      menuList.setAttribute('aria-labelledby', tab.id);
      renderMenu(tab.getAttribute('data-cat'));
    });
  });

  /* =========================================================
     CATERING PACKAGES — starting-price cards, from CONTENT
     so the owner can change a price from /admin/ without a
     developer. Same markup the cards always had.
     ========================================================= */
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';

  /* "$21" -> ['$','21'] so the symbol can render as the small superscript.
     A price with no leading symbol ("Ask us") just renders as-is. */
  function splitPrice(p){
    var m = String(p == null ? '' : p).trim().match(/^([^0-9]*)([\s\S]*)$/);
    return m ? [m[1], m[2]] : ['', ''];
  }

  function renderPackages(){
    var grid = document.getElementById('pkgGrid');
    if(!grid) return;
    var pkgs = CONTENT.pricing || [];
    var html = '';

    pkgs.forEach(function(p, i){
      var pr = splitPrice(p.blurb);
      html += '<div class="pkg' + (p.highlight ? ' pkg--best' : '') + ' reveal" data-delay="' + (i + 1) + '">';
      if(p.label) html += '<span class="pkg__label">' + esc(p.label) + '</span>';
      html += '<div class="pkg__price">' + (pr[0] ? '<sup>' + esc(pr[0]) + '</sup>' : '') + esc(pr[1]) + '</div>';
      if(p.per) html += '<div class="pkg__per">' + esc(p.per) + '</div>';
      var feats = p.features || [];
      if(feats.length){
        html += '<ul class="pkg__features">';
        feats.forEach(function(f){ html += '<li>' + TICK + esc(f) + '</li>'; });
        html += '</ul>';
      }
      html += '<a class="btn" href="#lead">Get a quote</a>';
      html += '</div>';
    });

    grid.innerHTML = html;
    /* No packages = no empty grid (and no dangling 56px gap); the lead form
       still carries the quote. Inline display beats .pkg-grid's display:grid,
       which [hidden] would not. */
    grid.style.display = pkgs.length ? '' : 'none';
    revealScan(grid);
  }

  /* =========================================================
     CATERING LEAD FORM — FormSubmit, no backend
     ========================================================= */
  var form = document.getElementById('leadForm');
  if(form){
    var msgEl = document.getElementById('leadMsg');
    var submitBtn = document.getElementById('leadSubmit');
    var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    var val = function(id){ var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
    var mark = function(id, bad){
      var el = document.getElementById(id);
      if(el && el.closest('.field')) el.closest('.field').classList.toggle('invalid', !!bad);
    };

    /* Desktop guard: never let sms:/tel: links trigger Windows'
       "Pick an app" dialog — show a toast with the number instead.
       Mobile is untouched; phones handle these links natively. */
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
            + 'background:#1F1913;color:#F6EBD9;padding:14px 22px;border-radius:12px;'
            + 'box-shadow:0 12px 40px rgba(0,0,0,.6);border:1px solid rgba(232,89,12,.4);'
            + 'font-family:\'Nunito Sans\',system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
            + 'opacity:0;transition:opacity .25s ease;';
          document.body.appendChild(t);
        }
        t.innerHTML = 'Call or text us at <strong style="color:#E3B341;letter-spacing:.02em">' + esc(CONTENT.brand.phone) + '</strong> from your phone.';
        requestAnimationFrame(function(){ t.style.opacity = '1'; });
        clearTimeout(window.__smsToastTimer);
        window.__smsToastTimer = setTimeout(function(){ t.style.opacity = '0'; }, 4500);
      });
    }

    var buildSms = function(d){
      var body = "Hi " + CONTENT.brand.name + "! Catering quote please."
        + " Name: " + d.name + "."
        + " Phone: " + d.phone + "."
        + " Date: " + d.event_date + "."
        + " Headcount: " + d.headcount + "."
        + " Type: " + d.event_type + "."
        + (d.message ? " Notes: " + d.message : "");
      return "sms:" + telHref(CONTENT.brand.phone) + "?body=" + encodeURIComponent(body);
    };

    var showDone = function(d){
      form.hidden = true;
      var done = document.getElementById('leadDone');
      var dm = document.getElementById('doneMsg');
      var smsUrl = buildSms(d);
      if(dm){
        if(isMobile){
          dm.textContent = "Got it, " + d.name.split(' ')[0] + "! We'll reach you at " + d.phone
            + " within one business day. Opening a text so you can send us a copy too — just hit send.";
        } else {
          dm.textContent = "Got it, " + d.name.split(' ')[0] + "! We'll call or email you within one business day to talk headcount, meats and a real number.";
        }
      }
      if(done){ done.hidden = false; done.scrollIntoView({behavior:'smooth', block:'center'}); }
      /* Belt-and-suspenders: on mobile only, also open a pre-filled text. */
      if(isMobile){ setTimeout(function(){ window.location.href = smsUrl; }, 900); }
    };

    form.addEventListener('submit', function(e){
      e.preventDefault();

      /* honeypot: bots fill it, humans can't see it */
      if(form.querySelector('input[name="_honey"]').value){ return; }

      var d = {
        name: val('c-name'),
        phone: val('c-phone'),
        email: val('c-email'),
        event_date: val('c-date'),
        headcount: val('c-count'),
        event_type: val('c-type'),
        message: val('c-msg')
      };

      var bad = false;
      mark('c-name', !d.name); bad = bad || !d.name;
      mark('c-phone', !/[\d]{7,}/.test(d.phone.replace(/\D/g,''))); bad = bad || !/[\d]{7,}/.test(d.phone.replace(/\D/g,''));
      mark('c-email', !/^\S+@\S+\.\S+$/.test(d.email)); bad = bad || !/^\S+@\S+\.\S+$/.test(d.email);
      mark('c-date', !d.event_date); bad = bad || !d.event_date;
      mark('c-count', !d.headcount); bad = bad || !d.headcount;
      mark('c-type', !d.event_type); bad = bad || !d.event_type;

      if(bad){
        msgEl.textContent = 'Almost there — fill in the highlighted fields.';
        msgEl.className = 'lead__msg err';
        return;
      }

      msgEl.textContent = 'Sending…';
      msgEl.className = 'lead__msg';
      submitBtn.disabled = true;

      fetch('https://formsubmit.co/ajax/' + CONTENT.brand.formEmail, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: 'Catering lead — ' + d.name + ' (' + d.headcount + ', ' + d.event_date + ')',
          _template: 'table',
          name: d.name,
          phone: d.phone,
          email: d.email,
          event_date: d.event_date,
          headcount: d.headcount,
          event_type: d.event_type,
          message: d.message || '(none)'
        })
      }).then(function(res){
        if(!res.ok) throw new Error('bad status');
        return res.json();
      }).then(function(){
        showDone(d);
      }).catch(function(){
        submitBtn.disabled = false;
        msgEl.innerHTML = 'Hmm, that didn’t go through. Call or text us at <b>' + esc(CONTENT.brand.phone) + '</b> — or '
          + '<a href="' + buildSms(d).replace(/"/g,'&quot;') + '" style="color:#FF7A2F;font-weight:800">tap here to send it as a text</a>.';
        msgEl.className = 'lead__msg err';
      });
    });
  }

  /* =========================================================
     CONTENT RENDERING — defaults first (no flash), then merge
     content.json (edited by /admin/) over the top. Never
     hard-fails: 404/offline just means the defaults stand.
     ========================================================= */
  function applyEdits(){
    var b = CONTENT.brand || {};
    var tel = telHref(b.phone);
    var map = {
      'brand-name': b.name,
      'phone': b.phone,
      'email': b.email,
      'city': b.city,
      'instagram': b.instagram,
      'bio': (CONTENT.about && CONTENT.about.bio) || ''
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-edit]'), function(el){
      var k = el.getAttribute('data-edit');
      var v = map[k];
      if(v == null) return;
      el.textContent = v;
      if(el.tagName === 'A' && k === 'email') el.setAttribute('href', 'mailto:' + v);
    });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-tel]'), function(a){
      a.setAttribute('href', 'tel:' + tel);
    });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-sms]'), function(a){
      a.setAttribute('href', 'sms:' + tel + '?body=' + encodeURIComponent("Hi " + (b.name || '') + "! I'd like a catering quote."));
    });

    /* announcement pill in the hero — hidden when there's no text */
    var bar = document.getElementById('announceBar');
    if(bar){
      var an = CONTENT.announcement || {};
      if(an.text){
        bar.hidden = false;
        bar.innerHTML = an.link
          ? '<a href="' + esc(an.link) + '" target="_blank" rel="noopener noreferrer">' + esc(an.text) + '</a>'
          : esc(an.text);
      } else {
        bar.hidden = true;
        bar.innerHTML = '';
      }
    }

    /* footer social links — only when the owner adds some */
    var fsoc = document.getElementById('footSocial');
    if(fsoc){
      var soc = CONTENT.social || [];
      fsoc.innerHTML = soc.length
        ? soc.map(function(s){
            return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.n) + '</a>';
          }).join(' · ') + '<br />'
        : '';
    }
  }

  function renderContent(){
    applyEdits();
    renderWeek();
    renderMenu(currentCat);
    renderPackages();
  }

  /* boot handed to base.js */

  window.renderContent = renderContent;
})();
