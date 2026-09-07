/* personal-trainer/niche.js — this niche's renderer and interactive logic.
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

  // year
  document.getElementById('yr').textContent = new Date().getFullYear();

  // nav solidify
  var nav = document.getElementById('nav');
  var onScroll = function(){ nav.classList.toggle('solid', window.scrollY > 30); };
  onScroll(); window.addEventListener('scroll', onScroll, {passive:true});

  // reveal on scroll
  var revs = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && !reduce){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
    revs.forEach(function(r){ io.observe(r); });
  } else { revs.forEach(function(r){ r.classList.add('in'); }); }

  // floating chalk-dust motes in the hero
  var motes = document.getElementById('motes');
  if(motes && !reduce){
    var n = window.innerWidth < 700 ? 8 : 16;
    for(var i=0;i<n;i++){
      var m = document.createElement('span');
      m.className = 'mote';
      var size = 2 + Math.random()*4;
      m.style.width = size + 'px';
      m.style.height = size + 'px';
      m.style.left = Math.random()*100 + '%';
      m.style.background = Math.random() < .6
        ? 'rgba(255,90,46,' + (0.25 + Math.random()*0.3) + ')'
        : 'rgba(237,237,230,' + (0.12 + Math.random()*0.18) + ')';
      var dur = 11 + Math.random()*14;
      m.style.animationDuration = dur + 's';
      m.style.animationDelay = (-Math.random()*dur) + 's';
      m.style.setProperty('--o', (0.25 + Math.random()*0.4).toFixed(2));
      m.style.setProperty('--sway', ((Math.random()*90) - 45).toFixed(0) + 'px');
      motes.appendChild(m);
    }
  }

  // ---- goal emblem swap (additive; the static base emblem renders with JS off) ----
  function setEmblem(id){
    var stage = document.getElementById('goalEmblem');
    if(!stage) return;
    var all = stage.querySelectorAll('[data-emblem]'), found = false;
    for(var i=0;i<all.length;i++){
      var on = all[i].getAttribute('data-emblem') === id;
      all[i].classList.toggle('is-active', on);
      if(on) found = true;
    }
    if(!found && all[0]) all[0].classList.add('is-active');
  }

  // ---- hero spark fountain: gravity acceleration + momentum (north-star physics: dj-site-blue).
  //      Purely additive over the static hero illustration; disabled under reduced-motion. ----
  (function(){

  /* signature animation extracted to scene.js */

  })();

  /* =====================================================
     CONTENT — everything the owner edits in one object.
     DEFAULT_CONTENT ships inline (renders immediately);
     content.json at the repo root — written by /admin/ —
     overrides it at runtime. Keep both shapes in sync.
     ===================================================== */
var currentGoal = 'strength';

  var goalById = function(id){
    var list = (CONTENT.goals || []);
    for(var i=0;i<list.length;i++){ if(list[i].id === id) return list[i]; }
    return list[0];
  };

  /* =====================================================
     SIGNATURE: goal-path picker
     Clicking a pill re-renders the program grid, the proof
     stats and re-sorts the FAQ to emphasize that goal.
     ===================================================== */
  var renderGoalPills = function(list){
    document.getElementById('goalPills').innerHTML = (list || []).map(function(g){
      return '<button class="goal-pill" data-goal="' + esc(g.id) + '" aria-pressed="' + (g.id === currentGoal ? 'true' : 'false') + '">' + esc(g.label) + '</button>';
    }).join('');
  };

  var renderGoalPanel = function(){
    var g = goalById(currentGoal);
    if(!g) return;
    document.getElementById('goalTagline').textContent = g.tagline || '';
    document.getElementById('goalBlurb').textContent = g.blurb || '';
    // Injected cards intentionally skip the .reveal class: the goal-panel
    // wrapper above already faded in once via IntersectionObserver, so a
    // pill click just swaps content in place rather than re-animating it.
    document.getElementById('programGrid').innerHTML = (g.programs || []).map(function(p){
      return '<div class="program-card"><span class="program-card__n"></span><h3>' + esc(p.title) + '</h3><p>' + esc(p.desc) + '</p></div>';
    }).join('');
    document.getElementById('goalProof').innerHTML = (g.proof || []).map(function(s){
      return '<div class="proof"><b>' + esc(s.num) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');
    var cta = document.getElementById('goalBookCta');
    cta.textContent = 'Book training for ' + (g.label || 'this goal');
  };

  var renderFaq = function(list){
    var goal = currentGoal;
    var scored = (list || []).map(function(f, i){
      var tags = String(f.tags || 'all').split(',').map(function(t){ return t.trim(); }).filter(Boolean);
      var score = tags.indexOf(goal) > -1 ? 0 : (tags.indexOf('all') > -1 ? 1 : 2);
      return { f: f, i: i, score: score };
    });
    scored.sort(function(a, b){ return a.score - b.score || a.i - b.i; });
    var goalLabel = (goalById(goal) || {}).label || '';
    document.getElementById('faqList').innerHTML = scored.map(function(s){
      var badge = s.score === 0 ? '<span class="faq__badge">For ' + esc(goalLabel) + '</span>' : '';
      return '<details class="faq"><summary>' + badge + '<span>' + esc(s.f.q) + '</span><span class="plus">+</span></summary><div class="faq__body">' + esc(s.f.a) + '</div></details>';
    }).join('');
  };

  var setGoal = function(id, opts){
    opts = opts || {};
    if(!goalById(id)) return;
    currentGoal = id;
    renderGoalPills(CONTENT.goals);
    renderGoalPanel();
    renderFaq(CONTENT.faq);
    setEmblem(id);
    var goalSel = document.getElementById('b-goal');
    if(goalSel) goalSel.value = id;
    if(!opts.silent){
      try{ history.replaceState(null, '', '?goal=' + encodeURIComponent(id) + '#goals'); }catch(err){}
    }
  };

  document.getElementById('goalPills').addEventListener('click', function(e){
    var b = e.target.closest('[data-goal]');
    if(!b) return;
    setGoal(b.getAttribute('data-goal'));
  });
  document.getElementById('goalBookCta').addEventListener('click', function(){
    var goalSel = document.getElementById('b-goal');
    if(goalSel) goalSel.value = currentGoal;
  });

  /* =====================================================
     RENDER — paints every owner-editable region from the
     merged CONTENT object. Runs once with the defaults,
     again if content.json loads. Never hard-fails the page.
     ===================================================== */
  var SOCIAL_ICONS = {
    'Instagram': '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r=".8" fill="currentColor" stroke="none"/>',
    'TikTok': '<path d="M9 12a4 4 0 1 0 4 4V4c.4 2.5 2.1 4.1 4.6 4.4"/>',
    'Facebook': '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    'YouTube': '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9.5l5 2.5-5 2.5z"/>',
    'Website': '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>'
  };
  var socSvg = function(platform){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + (SOCIAL_ICONS[platform] || SOCIAL_ICONS.Website) + '</svg>';
  };
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  var renderStats = function(list){
    document.getElementById('proofRow').innerHTML = (list || []).map(function(s){
      return '<div class="proof"><b>' + esc(s.num) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');
  };

  var renderPricing = function(list, note){
    document.getElementById('pricingGrid').innerHTML = (list || []).map(function(p){
      var feats = (p.features || []).map(function(x){ return String(x).trim(); }).filter(Boolean);
      return '<div class="price-card' + (p.highlight ? ' price-card--best' : '') + '">'
        + (p.highlight ? '<span class="price-card__badge">' + esc(p.note || 'Most popular') + '</span>' : '')
        + '<div class="price-card__name">' + esc(p.label) + '</div>'
        + '<div class="price-card__price"><b>' + esc(p.blurb) + '</b><span>' + esc(p.per || '') + '</span></div>'
        + '<ul>' + feats.map(function(f){ return '<li>' + CHECK_SVG + '<span>' + esc(f) + '</span></li>'; }).join('') + '</ul>'
        + (!p.highlight && p.note ? '<div class="price-card__note">' + esc(p.note) + '</div>' : '')
        + '</div>';
    }).join('');
    document.getElementById('pricingNote').textContent = note || '';
  };

  var renderAbout = function(c){
    document.getElementById('bioText').textContent = c.bio || '';
    document.getElementById('chipRow').innerHTML = (c.chips || []).map(function(ch){
      return '<span class="chip">' + esc(ch.t) + '</span>';
    }).join('');
  };

  var renderGallery = function(list){
    document.getElementById('galleryGrid').innerHTML = (list || []).map(function(g){
      var art = g.image
        ? '<img src="' + esc(g.image) + '" alt="' + esc(g.title) + '" loading="lazy">'
        : '';
      return '<div class="gtile">' + art + '<span class="gtile__cap">' + esc(g.title) + (g.tag ? ' · ' + esc(g.tag) : '') + '</span></div>';
    }).join('');
  };

  var renderTestimonials = function(list){
    document.getElementById('testGrid').innerHTML = (list || []).map(function(t){
      return '<div class="test-card"><blockquote>' + esc(t.quote || '') + '</blockquote><cite>' + esc(t.name || '') + '</cite></div>';
    }).join('');
  };

  var renderSocial = function(list, brand){
    var pillsHtml = (list || []).map(function(s){
      return '<a class="social" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">'
        + socSvg(s.icon) + esc(s.label || s.icon) + '</a>';
    });
    pillsHtml.push('<a class="social" href="mailto:' + esc(brand.email) + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>'
      + esc(brand.email) + '</a>');
    document.getElementById('socialRow').innerHTML = pillsHtml.join('');
  };

  var renderBrand = function(b){
    var short = String(b.city || '').split(',')[0].trim();
    document.querySelectorAll('[data-edit="city"]').forEach(function(el){ el.textContent = b.city; });
    document.querySelectorAll('[data-edit="city-short"]').forEach(function(el){ el.textContent = short; });
    var fp = document.getElementById('footPhone');
    fp.href = telHref(b.phone); fp.textContent = b.phone;
    var fe = document.getElementById('footEmail');
    fe.href = 'mailto:' + b.email; fe.textContent = b.email;
    var alt = document.getElementById('bookAlt');
    alt.href = 'sms:+' + String(b.phone || '').replace(/\D/g, '').replace(/^1?/, '1');
    var text = document.getElementById('textLink');
    if(text) text.href = 'sms:' + telHref(b.phone).replace('tel:', '');
  };

  var renderGoalSelect = function(list){
    var sel = document.getElementById('b-goal');
    sel.innerHTML = (list || []).map(function(g){
      return '<option value="' + esc(g.id) + '">' + esc(g.label) + '</option>';
    }).join('') + '<option value="not-sure">Not sure yet</option>';
    sel.value = currentGoal;
  };

  var renderBooking = function(s){
    var open = !s || s.acceptingClients !== false;
    var formEl = document.getElementById('bookForm');
    var closed = document.getElementById('bookClosed');
    var done = document.getElementById('bookDone');
    if(open){
      closed.hidden = true;
      if(done.hidden) formEl.hidden = false;
    } else {
      formEl.hidden = true;
      done.hidden = true;
      document.getElementById('closedMsg').textContent = (s && s.closedNote) || 'The client list is full right now — check back soon.';
      closed.hidden = false;
    }
  };

  var renderContent = function(c){
    renderBrand(c.brand || {});
    renderStats(c.stats);
    renderGoalSelect(c.goals);
    renderGoalPills(c.goals);
    renderGoalPanel();
    renderPricing(c.pricing, c.pricingNote);
    renderAbout(c);
    renderGallery(c.gallery);
    renderTestimonials(c.testimonials);
    renderFaq(c.faq);
    renderSocial(c.social, c.brand || {});
    renderBooking(c.settings);
  };
  /* boot handed to base.js */
  // deep-link support: ?goal=strength preselects the goal path on load
  try{
    var param = new URLSearchParams(window.location.search).get('goal');
    if(param && goalById(param)) setGoal(param, {silent:true});
  }catch(err){}

  // live override: content.json is what /admin/ edits. 404/offline = defaults stand.


  /* =====================================================
     BOOKING FORM — no backend
     Default: FormSubmit (zero signup). The FIRST real submission emails an
     activation link to LEAD.email; click it once and every request after
     that lands in the inbox. Swap the email below for the real one.
     ===================================================== */
  // Delivery inbox = CONTENT.brand.leadEmail (editable at /admin/ → Contact).
  var LEAD = {
    provider: 'formsubmit',
    get email(){ return (CONTENT.brand && CONTENT.brand.leadEmail) || DEFAULT_CONTENT.brand.leadEmail; }
  };

  var form = document.getElementById('bookForm');
  var msgEl = document.getElementById('bookMsg');
  var submitBtn = document.getElementById('bookSubmit');

  var setErr = function(input, on){
    var f = input.closest('.field');
    if(f) f.classList.toggle('invalid', !!on);
  };
  var say = function(text, cls){
    msgEl.textContent = text;
    msgEl.className = 'book__msg' + (cls ? ' ' + cls : '');
  };

  form.addEventListener('submit', function(e){
    e.preventDefault();

    // honeypot — bots fill it, humans can't see it
    if(form.querySelector('input[name="_honey"]').value){ return; }

    var name    = document.getElementById('b-name');
    var email   = document.getElementById('b-email');
    var phone   = document.getElementById('b-phone');
    var consent = document.getElementById('b-consent');

    var bad = false;
    [name, email].forEach(function(el){
      var empty = !(el.value || '').trim();
      setErr(el, empty);
      if(empty) bad = true;
    });
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email.value||'').trim());
    if(!emailOk){ setErr(email, true); bad = true; }
    if(!consent.checked){
      say('Please confirm the contact permission checkbox first.', 'err');
      return;
    }
    if(bad){
      say('A couple of required fields are missing — they’re marked in red.', 'err');
      return;
    }

    var goalSel = document.getElementById('b-goal');
    var goalLabel = goalSel.options[goalSel.selectedIndex] ? goalSel.options[goalSel.selectedIndex].text : goalSel.value;

    var payload = {
      _subject: 'Consult request — Cora Vale Fitness',
      name: name.value.trim(),
      email: email.value.trim(),
      phone: (phone.value||'').trim() || '(not given)',
      goal: goalLabel,
      format: document.getElementById('b-format').value,
      message: (document.getElementById('b-msg').value || '').trim() || '(none)'
    };

    submitBtn.disabled = true;
    say('Sending…');

    fetch('https://formsubmit.co/ajax/' + LEAD.email, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(res){
      if(!res.ok) throw new Error('bad status');
      return res.json();
    }).then(function(){
      form.hidden = true;
      var done = document.getElementById('bookDone');
      var dm = document.getElementById('doneMsg');
      dm.textContent = 'Got it, ' + payload.name.split(' ')[0] + '. Cora reads every request personally — expect a reply at ' + payload.email + ' within one business day.';
      done.hidden = false;
      done.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'center'});
    }).catch(function(){
      submitBtn.disabled = false;
      say('That didn’t go through. Email ' + ((CONTENT.brand && CONTENT.brand.email) || 'the studio') + ' instead.', 'err');
    });
  });

  /* Desktop tel: guard — stops Windows' "Pick an app" dialog; shows a toast
     with the number instead. Phones are untouched. */
  var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(!isMobile){
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]');
      if(!a) return;
      e.preventDefault();
      var t = document.getElementById('telToast');
      if(!t){
        t = document.createElement('div');
        t.id = 'telToast';
        t.setAttribute('role','status');
        t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:9999;'
          + 'background:#1a1f24;color:#ededE6;padding:14px 22px;border-radius:4px;'
          + 'box-shadow:0 12px 40px rgba(0,0,0,.6);border:1px solid rgba(255,90,46,.4);'
          + 'font-family:\'Inter\',system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
          + 'opacity:0;transition:opacity .25s ease;';
        document.body.appendChild(t);
      }
      t.innerHTML = 'Text Cora at <strong style="color:#FF7A47;letter-spacing:.02em">' + esc((CONTENT.brand && CONTENT.brand.phone) || '') + '</strong> from your phone.';
      requestAnimationFrame(function(){ t.style.opacity = '1'; });
      clearTimeout(window.__telToastTimer);
      window.__telToastTimer = setTimeout(function(){ t.style.opacity = '0'; }, 4500);
    });
  }

  window.renderContent = renderContent;
})();
