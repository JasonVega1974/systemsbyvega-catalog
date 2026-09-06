/* metal-fabrication/niche.js — this niche's renderer and interactive logic.
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
    }, {threshold:.14, rootMargin:'0px 0px -8% 0px'});
    revs.forEach(function(r){ io.observe(r); });
  } else { revs.forEach(function(r){ r.classList.add('in'); }); }

  // rising sparks in the hero
  var sparks = document.getElementById('sparks');
  if(sparks && !reduce){
    var n = window.innerWidth < 700 ? 9 : 16;
    for(var i=0;i<n;i++){
      var s = document.createElement('span');
      s.className = 'sparkp';
      s.style.left = (2 + Math.random()*96) + '%';
      var dur = 4 + Math.random()*5;
      s.style.animationDuration = dur + 's';
      s.style.animationDelay = (-Math.random()*dur) + 's';
      s.style.setProperty('--dx', (Math.random()*90 - 45) + 'px');
      var sz = 2 + Math.random()*2.5;
      s.style.width = sz + 'px';
      s.style.height = sz + 'px';
      s.style.opacity = 0.35 + Math.random()*0.5;
      sparks.appendChild(s);
    }
  }

  // =====================================================================
  // CONTENT — owner-editable data.
  // DEFAULT_CONTENT ships with the page and renders instantly. content.json
  // (repo root, written by /admin/) is fetched at runtime and merged over it.
  // Keep the key shape in sync with admin/index.html (SECTIONS + SEED).
  // =====================================================================
  var telDigits = function(p){ var d=String(p||'').replace(/\D/g,''); if(d.length===10) d='1'+d; return '+'+d; };
  var chipHtml = function(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>'); };
  /* Shared quote/paren stripper for anything interpolated into an img src
     attribute — symmetric with bin-cleaning/niche.js's safeUrl(). */
  var safeUrl = function(u){ return String(u || '').replace(/["\\)]/g, ''); };

  var CAT_LABELS = { gates:"Gates & Railings", trailers:"Trailers", repair:"Repair", custom:"Custom" };
  var TONES = ["a","b","c","d","e","f","g","h"];
  var SVC_ICONS = {
    gate:'<path d="M3 21V7l4-3v17"/><path d="M17 21V4l4 3v14"/><path d="M7 9h10M7 14h10M7 19h10"/>',
    trailer:'<path d="M1 8h13v8H1z"/><path d="M14 11h4l3 3v2h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    repair:'<path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3z"/>',
    fire:'<path d="M8 12s-3 2.5-3 5a3 3 0 0 0 6 0"/><path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-4 2.5-5.5"/>',
    mobile:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M4.9 19.1l2.2-2.2M16.9 7.1l2.2-2.2"/>',
    plasma:'<path d="M4 20L20 4"/><path d="M4 4l4 4M16 16l4 4"/><circle cx="12" cy="12" r="2.5"/>'
  };
// ===== THE BUILD BOARD — rendered from CONTENT, pill filters with animated in/out =====
  var pills = document.querySelectorAll('.pill');
  var tickets = document.querySelectorAll('#board .ticket');
  var currentCat = 'all';

  var applyFilter = function(cat){
    currentCat = cat;
    tickets.forEach(function(t){
      var match = (cat === 'all') || (t.dataset.cat === cat);
      if(t._hideTimer){ clearTimeout(t._hideTimer); t._hideTimer = null; }

      if(reduce){
        // no animation — instant toggle
        t.classList.toggle('is-hidden', !match);
        t.classList.remove('is-out');
        return;
      }
      if(match){
        t.classList.remove('is-hidden');
        // let display:block land, then fade in on the next frames
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){ t.classList.remove('is-out'); });
        });
      } else {
        t.classList.add('is-out');
        t._hideTimer = setTimeout(function(){
          // only hide if this card still shouldn't show for the ACTIVE filter
          var stillOut = (currentCat !== 'all') && (t.dataset.cat !== currentCat);
          if(stillOut) t.classList.add('is-hidden');
        }, 290);
      }
    });
  };

  pills.forEach(function(p){
    p.addEventListener('click', function(){
      pills.forEach(function(x){ x.classList.remove('on'); x.setAttribute('aria-pressed','false'); });
      p.classList.add('on');
      p.setAttribute('aria-pressed','true');
      applyFilter(p.dataset.filter);
    });
  });

  var renderBoard = function(list){
    var board = document.getElementById('board');
    if(!board) return;
    board.innerHTML = list.map(function(p,i){
      var tone = TONES.indexOf(p.tone) > -1 ? p.tone : TONES[i % TONES.length];
      var img = p.image ? '<img src="'+esc(p.image)+'" alt="'+esc(p.title||'')+'" loading="lazy" />' : '';
      return '<article class="ticket" data-cat="'+esc(p.cat||'custom')+'">'
        + '<div class="ticket__head"><span class="ticket__no">'+esc(p.no||'')+'</span><span class="ticket__cat">'+esc(CAT_LABELS[p.cat]||p.cat||'')+'</span></div>'
        + '<div class="ticket__img tone-'+tone+'">'+img+'<span class="ticket__stamp">'+esc(p.status||'Delivered')+'</span></div>'
        + '<div class="ticket__body"><h3>'+esc(p.title||'')+'</h3><p class="ticket__spec">'+esc(p.spec||'')+'</p></div>'
        + '</article>';
    }).join('');
    tickets = board.querySelectorAll('.ticket');
    applyFilter(currentCat);
  };

  // ===== render every owner-editable region from CONTENT =====
  var renderContent = function(c){
    var b = c.brand || {};
    var tel = telDigits(b.phone);

    document.querySelectorAll('a[href^="tel:"]').forEach(function(a){ a.setAttribute('href','tel:'+tel); });
    document.querySelectorAll('a[href^="sms:"]').forEach(function(a){
      a.setAttribute('href', a.getAttribute('href').replace(/^sms:[^?]*/, 'sms:'+tel));
    });
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.textContent = b.phone || ''; });
    document.querySelectorAll('[data-email]').forEach(function(el){
      el.textContent = b.email || '';
      if(el.tagName === 'A') el.setAttribute('href','mailto:'+(b.email||''));
    });
    document.querySelectorAll('[data-city]').forEach(function(el){ el.textContent = b.city || ''; });
    document.querySelectorAll('[data-area]').forEach(function(el){ el.textContent = (c.serviceArea && c.serviceArea.region) || b.city || ''; });

    // hero proof stats — a trailing +/%/x on the number renders in spark yellow
    var proof = document.getElementById('proofStats');
    if(proof && Array.isArray(c.stats)){
      proof.innerHTML = c.stats.map(function(s){
        var m = /^(.*?)([+%×x]+)$/.exec(s.num||'');
        var big = m ? esc(m[1])+'<em>'+esc(m[2])+'</em>' : esc(s.num);
        return '<div class="proofstat"><b>'+big+'</b><span>'+esc(s.label)+'</span></div>';
      }).join('');
    }

    if(Array.isArray(c.projects)) renderBoard(c.projects);

    var grid = document.getElementById('svcGrid');
    if(grid && Array.isArray(c.services)){
      grid.innerHTML = c.services.map(function(s){
        return '<div class="svc"><div class="svc__ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
          + (SVC_ICONS[s.icon]||SVC_ICONS.repair) + '</svg></div><h3>'+esc(s.title)+'</h3><p>'+esc(s.desc)+'</p></div>';
      }).join('');
    }

    var sg = document.getElementById('specGroups');
    if(sg && Array.isArray(c.specs)){
      sg.innerHTML = c.specs.map(function(g){
        return '<div class="specgroup"><span class="specgroup__label">'+esc(g.label)+'</span><div class="chips">'
          + (g.chips||[]).map(function(ch){ return '<span class="chip">'+chipHtml(ch)+'</span>'; }).join('') + '</div></div>';
      }).join('');
    }

    var a = c.owner || {};
    var mt = document.getElementById('meetTitle');
    if(mt) mt.textContent = 'Meet ' + (a.name || 'the owner');
    var md = document.getElementById('meetDesc');
    if(md) md.innerHTML = a.bio ? esc(a.bio).replace(/\n/g,'<br />') : '';
    var mp = document.getElementById('meetPhoto');
    if(mp){
      if(a.photo){
        mp.innerHTML = '<img src="' + safeUrl(a.photo) + '" alt="' + esc(a.name || 'The owner') + '" loading="lazy">';
        mp.setAttribute('aria-label', 'Photo of ' + (a.name || 'the owner'));
      } else if(!mp.querySelector('img')){
        mp.setAttribute('aria-label', 'Photo of ' + (a.name||'the owner') + ' — coming soon');
      }
    }
  };

  // render defaults immediately (no flash), then merge the live override.
  // 404 / offline / bad JSON: the defaults stand — never hard-fail the page.
  /* boot handed to base.js */

  // ===== quote form (no backend) =====
  // Leads are delivered via FormSubmit — zero-signup. The FIRST real submission
  // emails an activation link to CONTENT.brand.email; click it once and every
  // quote request after that lands in that inbox. The destination email and the
  // text-fallback number both come from CONTENT.brand (edit in /admin/).
  var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Desktop guard: never let sms:/tel: links trigger the OS "Pick an app"
  // dialog. Intercept and show a toast with the number instead. Mobile untouched.
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
          + 'background:#10151b;color:#fff;padding:14px 22px;border-radius:12px;'
          + 'box-shadow:0 12px 40px rgba(0,0,0,.6);border:1px solid rgba(255,140,70,.4);'
          + 'font-family:Inter,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
          + 'opacity:0;transition:opacity .25s ease;';
        document.body.appendChild(t);
      }
      t.innerHTML = 'Call or text the shop at <strong style="color:#FFC53D;letter-spacing:.02em">' + esc(CONTENT.brand.phone) + '</strong> from your phone.';
      requestAnimationFrame(function(){ t.style.opacity = '1'; });
      clearTimeout(window.__smsToastTimer);
      window.__smsToastTimer = setTimeout(function(){ t.style.opacity = '0'; }, 4500);
    });
  }

  var form = document.getElementById('quoteForm');
  if(form){
    var msgEl = document.getElementById('quoteMsg');
    var submitBtn = document.getElementById('quoteSubmit');
    var fieldOf = function(id){ var el = document.getElementById(id); return el ? el.closest('.field') : null; };
    var val = function(id){ var el = document.getElementById(id); return el ? (el.value||'').trim() : ''; };

    var buildSms = function(d){
      var body = "Hi Black Anvil! Quote request."
        + " Name: " + d.name + "."
        + " Phone: " + d.phone + "."
        + " Project: " + d.project_type + "."
        + " Details: " + d.description + "."
        + " Timeline: " + d.timeline + "."
        + (d.city ? " Location: " + d.city + "." : "");
      return "sms:" + telDigits(CONTENT.brand.phone) + "?body=" + encodeURIComponent(body);
    };

    var showDone = function(phone, smsUrl){
      form.hidden = true;
      var done = document.getElementById('quoteDone');
      var dm = document.getElementById('doneMsg');
      if(dm){
        if(isMobile && smsUrl){
          dm.textContent = "Got it — I'll call or text you at " + phone + " within one business day. Opening a text so you can fire over photos too — just hit send.";
        } else {
          dm.textContent = "Got it — I'll call or text you at " + phone + " within one business day. Photos of the project or the broken part? Text them to " + CONTENT.brand.phone + ".";
        }
      }
      if(done){ done.hidden = false; done.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'center'}); }
      // Belt-and-suspenders: on mobile, also open a pre-filled SMS.
      if(smsUrl && isMobile){ setTimeout(function(){ window.location.href = smsUrl; }, 900); }
    };

    form.addEventListener('submit', function(e){
      e.preventDefault();
      msgEl.textContent = ''; msgEl.className = 'qform__msg';

      // honeypot — silently succeed for bots
      if(form.querySelector('input[name="_honey"]').value){ showDone('', ''); return; }

      var d = {
        name: val('q-name'),
        phone: val('q-phone'),
        email: val('q-email'),
        project_type: val('q-type'),
        description: val('q-desc'),
        timeline: val('q-when'),
        city: val('q-city')
      };

      // validate
      var ok = true;
      [['q-name', d.name], ['q-phone', d.phone], ['q-type', d.project_type], ['q-desc', d.description]].forEach(function(pair){
        var f = fieldOf(pair[0]);
        var bad = !pair[1];
        if(f) f.classList.toggle('invalid', bad);
        if(bad) ok = false;
      });
      if(!ok){
        msgEl.textContent = 'A couple required fields are missing — name, phone, project type, and a description.';
        msgEl.classList.add('err');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      var smsUrl = buildSms(d);
      var payload = {
        name: d.name, phone: d.phone, email: d.email || '(none given)',
        project_type: d.project_type, description: d.description,
        timeline: d.timeline, city: d.city || '(not given)',
        _subject: 'Black Anvil — quote request: ' + d.project_type,
        _template: 'table', _captcha: 'false'
      };

      fetch('https://formsubmit.co/ajax/' + encodeURIComponent(CONTENT.brand.leadEmail || CONTENT.brand.email), {
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(payload)
      }).then(function(r){ return r.json(); }).then(function(res){
        if(res && (res.success === 'true' || res.success === true)){
          showDone(d.phone, smsUrl);
        } else { throw new Error('formsubmit rejected'); }
      }).catch(function(){
        // graceful degrade: point at text/call so the lead is never lost
        msgEl.innerHTML = 'Hmm — that didn\'t go through. Text your project straight to <strong>' + esc(CONTENT.brand.phone) + '</strong> instead.';
        msgEl.classList.add('err');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send it to the shop';
      });
    });
  }

  window.renderContent = renderContent;
})();
