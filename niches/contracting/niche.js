/* contracting/niche.js — this niche's renderer and interactive logic.
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

  /* =====================================================================
     EDITABLE CONTENT
     DEFAULT_CONTENT ships inline so the page renders instantly with zero
     network calls. content.json (repo root) is the live override — the
     /admin/ panel commits it via the GitHub Contents API, and the merge
     below re-renders every editable region. Keep these keys in sync with
     admin/index.html (SECTIONS schema + SEED).
     ===================================================================== */
/* ---- content helpers ---- */
  function phoneDigits(p){ var d=String(p||"").replace(/\D/g,""); if(d.length===10) d="1"+d; return d; }
  function smsHref(p,body){ return "sms:+"+phoneDigits(p)+(body?"?body="+encodeURIComponent(body):""); }
  function cssUrl(u){ return 'url("'+String(u).replace(/["\\)]/g,"")+'")'; }
  var SMS_BODY = "Hi Summit & Stone! I'd like a free estimate on a project.";

  /* service icons, keyed so the admin can pick one per card */
  var SVC_ICONS = {
    concrete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="18" height="8" rx="1"/><path d="M3 14h18"/><path d="M9 10v8M15 10v8"/><path d="M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/></svg>',
    landscape: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7"/><path d="M12 15c-4 0-6-2.5-6-6 3.5 0 6 2 6 6z"/><path d="M12 13c0-4.5 2.5-7 7-7 0 4.5-2.5 7-7 7z"/><path d="M5 22h14"/></svg>',
    remodel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V8l8-5 8 5v13"/><path d="M4 12h16"/><path d="M9 21v-5h6v5"/><path d="M9 8h.01M15 8h.01"/></svg>',
    deck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9l2-3 2 3v12"/><path d="M10 21V9l2-3 2 3v12"/><path d="M16 21V9l2-3 2 3v12"/><path d="M2 13h20M2 18h20"/></svg>',
    wash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v4"/><path d="M3 5h4"/><path d="M8 8l9 9"/><path d="M14 4l6 6-8 8-6-6z"/><path d="M19 15l2 2-3 3-2-2"/></svg>',
    punchlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>'
  };
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
  var TILE_STYLES = { patio:1, fence:1, pavers:1, kitchen:1, deck:1, driveway:1 };

  var revealReady = false; // set true once the scroll-reveal observer exists
  function revealCls(){ return revealReady ? "reveal in" : "reveal"; }

  /* ---- before/after projects (signature) ---- */
  var activeProject = 0;
  function applyProject(p){
    var ba = document.getElementById('ba'); if(!ba || !p) return;
    var tb = document.getElementById('baTagB'), ta = document.getElementById('baTagA');
    if(tb) tb.textContent = p.beforeTag || "Before";
    if(ta) ta.textContent = p.afterTag || "After";
    if(p.beforeImg) ba.style.setProperty('--before-img', cssUrl(p.beforeImg)); else ba.style.removeProperty('--before-img');
    if(p.afterImg)  ba.style.setProperty('--after-img',  cssUrl(p.afterImg));  else ba.style.removeProperty('--after-img');
    var note = document.getElementById('baNote'); if(note) note.textContent = p.note || "";
  }
  function currentProjects(){
    return (CONTENT.projects && CONTENT.projects.length) ? CONTENT.projects : DEFAULT_CONTENT.projects;
  }
  function renderProjects(){
    var projects = currentProjects();
    if(activeProject >= projects.length) activeProject = 0;
    applyProject(projects[activeProject]);
    var sw = document.getElementById('baSwitch'); if(!sw) return;
    if(projects.length < 2){ sw.innerHTML = ""; return; }
    sw.innerHTML = projects.map(function(p,i){
      return '<button type="button" data-proj="'+i+'"'+(i===activeProject?' class="active"':'')+'>'
        + esc(p.title || ("Project "+(i+1))) + (p.location ? ' · '+esc(p.location) : '') + '</button>';
    }).join("");
  }
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('#baSwitch button[data-proj]'); if(!btn) return;
    activeProject = +btn.getAttribute('data-proj');
    renderProjects();
  });

  /* ---- section renderers ---- */
  function renderServiceOptions(services){
    var sel = document.getElementById('q-service'); if(!sel) return;
    var prev = sel.value;
    var html = '<option value="" selected disabled>Pick the closest fit…</option>';
    services.forEach(function(s){ html += '<option value="'+esc(s.title)+'">'+esc(s.title)+'</option>'; });
    html += '<option value="Something else / not sure">Something else / not sure</option>';
    sel.innerHTML = html;
    if(prev) sel.value = prev;
  }
  function renderServices(services){
    var g = document.getElementById('svcGrid'); if(!g) return;
    g.innerHTML = services.map(function(s,i){
      return '<div class="svc '+revealCls()+'" data-delay="'+(i%3+1)+'"><div class="svc__ic">'
        + (SVC_ICONS[s.icon] || SVC_ICONS.punchlist) + '</div>'
        + '<h3>'+esc(s.title)+'</h3><p>'+esc(s.desc)+'</p></div>';
    }).join("");
    renderServiceOptions(services);
  }
  function renderPricing(tiers){
    var g = document.getElementById('priceGrid'); if(!g) return;
    g.innerHTML = tiers.map(function(t,i){
      var feats = (t.features||[]).filter(function(f){ return String(f).trim(); }).map(function(f){
        return '<li>'+CHECK_SVG+esc(f)+'</li>';
      }).join("");
      return '<div class="tier'+(t.highlight?' tier--best':'')+' '+revealCls()+'" data-delay="'+(i%3+1)+'">'
        + '<span class="tier__label">'+esc(t.label)+'</span>'
        + '<div class="tier__price">'+esc(t.blurb)+'</div>'
        + '<div class="tier__per">'+esc(t.per)+'</div>'
        + '<ul class="tier__features">'+feats+'</ul>'
        + '<a class="btn" href="#estimate">'+esc(t.cta || "Get an estimate")+'</a></div>';
    }).join("");
  }
  function renderGallery(items){
    var g = document.getElementById('workGrid'); if(!g) return;
    g.innerHTML = items.map(function(it,i){
      var style = TILE_STYLES[it.style] ? it.style : "driveway";
      return '<figure class="tile tile--'+style+' '+revealCls()+'" data-delay="'+(i%3+1)+'">'
        + (it.image ? '<img src="'+esc(it.image)+'" alt="'+esc(it.title)+'" loading="lazy" />' : '')
        + '<figcaption>'+esc(it.title)+'<span>'+esc(it.tag)+'</span></figcaption></figure>';
    }).join("");
  }
  function renderTestimonials(items){
    var g = document.getElementById('tGrid'); if(!g) return;
    g.innerHTML = items.map(function(t,i){
      return '<div class="testimonial '+revealCls()+'" data-delay="'+(i%3+1)+'">'
        + '<span class="testimonial__mark" aria-hidden="true">&ldquo;</span>'
        + '<p class="testimonial__body">'+esc(t.quote)+'</p>'
        + '<span class="testimonial__name">'+esc(t.name)+'</span></div>';
    }).join("");
  }

  function renderContent(c){
    var b = c.brand || {};
    /* Full legal/display name everywhere; the nav lockup drops a trailing
       " Contracting" (the tagline line right under it already says "General
       Contracting"), matching the demo's original shortened lockup text. A
       renamed brand that doesn't end in "Contracting" just shows in full. */
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand]'), function(el){ el.textContent = b.name || ""; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-brand-short]'), function(el){
      el.textContent = String(b.name || "").replace(/\s+Contracting$/i, "");
    });
    var tel = telHref(b.phone), sms = smsHref(b.phone, SMS_BODY);
    Array.prototype.forEach.call(document.querySelectorAll('a[data-tel]'), function(a){ a.setAttribute('href', tel); });
    Array.prototype.forEach.call(document.querySelectorAll('a[data-sms]'), function(a){ a.setAttribute('href', sms); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-phone-text]'), function(el){ el.textContent = b.phone || ""; });
    var area = document.getElementById('areaLine');
    if(area) area.innerHTML = 'Serving '+esc((c.serviceArea && c.serviceArea.region) || b.city || "")+(b.license ? ' · '+esc(b.license) : '');
    var o = c.owner || {};
    var mh = document.getElementById('meetHeading'); if(mh) mh.textContent = o.heading || "Meet the owner";
    var md = document.getElementById('meetDesc'); if(md) md.textContent = o.bio || "";
    var mp = document.getElementById('meetPhoto');
    if(mp) mp.innerHTML = o.photo ? '<img src="'+esc(o.photo)+'" alt="Photo of the owner" />' : "";
    renderProjects();
    renderServices((c.services && c.services.length) ? c.services : DEFAULT_CONTENT.services);
    renderPricing((c.pricing && c.pricing.length) ? c.pricing : DEFAULT_CONTENT.pricing);
    renderGallery((c.gallery && c.gallery.length) ? c.gallery : DEFAULT_CONTENT.gallery);
    renderTestimonials((c.testimonials && c.testimonials.length) ? c.testimonials : DEFAULT_CONTENT.testimonials);
  }

  /* boot handed to base.js */
 // render defaults immediately — no flash
 // 404 / offline: defaults stand — never hard-fail the page

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
  revealReady = true; // regions re-rendered after this point appear instantly instead of waiting on the observer

  // rising grinder sparks in hero
  var sparks = document.getElementById('sparks');
  if(sparks && !reduce){
    var n = window.innerWidth < 700 ? 9 : 16;
    for(var i=0;i<n;i++){
      var s = document.createElement('span');
      s.className = 'spark';
      s.style.left = Math.random()*100 + '%';
      var dur = 5 + Math.random()*5;
      s.style.animationDuration = dur + 's';
      s.style.animationDelay = (-Math.random()*dur) + 's';
      s.style.opacity = 0.25 + Math.random()*0.5;
      var sz = 2 + Math.random()*3;
      s.style.width = sz + 'px';
      s.style.height = sz + 'px';
      sparks.appendChild(s);
    }
  }

  // ===== before/after driveway slider =====
  var ba = document.getElementById('ba');
  if(ba){
    var pos = 50, dragging = false, touched = false;
    var setPos = function(p){
      pos = Math.max(0, Math.min(100, p));
      ba.style.setProperty('--pos', pos + '%');
      ba.setAttribute('aria-valuenow', Math.round(pos));
    };
    var xToPct = function(clientX){
      var r = ba.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 100;
    };
    var markTouched = function(){ if(!touched){ touched = true; ba.classList.add('touched'); } };
    var start = function(e){
      dragging = true; ba.classList.add('grinding');
      markTouched();
      move(e);
    };
    var move = function(e){
      if(!dragging) return;
      var x = (e.touches ? e.touches[0].clientX : e.clientX);
      setPos(xToPct(x));
      if(e.cancelable) e.preventDefault();
    };
    var end = function(){ dragging = false; ba.classList.remove('grinding'); };

    ba.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move, {passive:false});
    window.addEventListener('mouseup', end);
    ba.addEventListener('touchstart', start, {passive:false});
    window.addEventListener('touchmove', move, {passive:false});
    window.addEventListener('touchend', end);

    // keyboard support
    ba.addEventListener('keydown', function(e){
      if(e.key === 'ArrowLeft'){ setPos(pos-4); e.preventDefault(); markTouched(); }
      if(e.key === 'ArrowRight'){ setPos(pos+4); e.preventDefault(); markTouched(); }
      if(e.key === 'Home'){ setPos(0); e.preventDefault(); markTouched(); }
      if(e.key === 'End'){ setPos(100); e.preventDefault(); markTouched(); }
    });

    // gentle auto-nudge on first view to signal it drags
    if(!reduce && 'IntersectionObserver' in window){
      var io2 = new IntersectionObserver(function(en){
        en.forEach(function(x){
          if(x.isIntersecting && !touched){
            var seq=[68,32,50], k=0;
            var t = setInterval(function(){
              if(touched){ clearInterval(t); return; }
              setPos(seq[k++]); if(k>=seq.length) clearInterval(t);
            }, 520);
            io2.unobserve(ba);
          }
        });
      }, {threshold:.5});
      io2.observe(ba);
    }
  }

  // ===== quote request form =====
  // Leads are delivered without a backend. Default: FormSubmit (no account —
  // the FIRST real submission emails an activation link to the lead inbox;
  // click it once and every lead after that lands in that inbox).
  // The destination email and business number now live in CONTENT.brand
  // (DEFAULT_CONTENT above / content.json), editable from /admin/.
  // To switch to Web3Forms instead: set provider:'web3forms' and paste web3formsKey.
  var LEAD = {
    provider: 'formsubmit',
    web3formsKey: ''                    // <-- paste a key from web3forms.com to use Web3Forms
  };
  // Always read contact details off the merged CONTENT so an admin edit takes
  // effect everywhere (form destination, SMS fallback, toasts) with no rebuild.
  function brandPhone(){ return (CONTENT.brand && CONTENT.brand.phone) || DEFAULT_CONTENT.brand.phone; }
  function brandEmail(){ return (CONTENT.brand && (CONTENT.brand.leadEmail || CONTENT.brand.email)) || (DEFAULT_CONTENT.brand.leadEmail || DEFAULT_CONTENT.brand.email); }

  var form = document.getElementById('quoteForm');
  if(form){
    var msgEl = document.getElementById('quoteMsg');
    var submitBtn = document.getElementById('quoteSubmit');
    var val = function(id){ var el=document.getElementById(id); return el ? (el.value||'').trim() : ''; };
    var setErr = function(fieldEl, on){ if(fieldEl) fieldEl.classList.toggle('invalid', !!on); };

    var getDays = function(){
      return Array.prototype.slice.call(form.querySelectorAll('input[name="days"]:checked')).map(function(c){return c.value;});
    };

    var buildSms = function(d){
      var body = "Hi Summit & Stone! I'd like a free estimate."
        + " Name: " + d.name + "."
        + " Phone: " + d.phone + "."
        + " Address: " + d.address + (d.city ? ", " + d.city : "") + "."
        + " Project: " + d.service + "."
        + (d.description ? " Details: " + d.description + "." : "")
        + " Best days: " + (d.days || "any") + ".";
      return smsHref(brandPhone(), body);
    };

    var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Global guard: on desktop, never let sms: or tel: links trigger Windows'
    // "Open Pick an app?" dialog. Intercept and show a helpful toast instead.
    // Mobile is untouched — phones handle these links natively.
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
            + 'background:#241c10;color:#fff;padding:14px 22px;border-radius:12px;'
            + 'box-shadow:0 12px 40px rgba(0,0,0,.55);border:1px solid rgba(245,166,35,.35);'
            + 'font-family:Barlow,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;'
            + 'opacity:0;transition:opacity .25s ease;';
          document.body.appendChild(t);
        }
        t.innerHTML = 'Call or text us at <strong style="color:#ffbe45;letter-spacing:.02em">' + esc(brandPhone()) + '</strong> from your phone.';
        requestAnimationFrame(function(){ t.style.opacity = '1'; });
        clearTimeout(window.__smsToastTimer);
        window.__smsToastTimer = setTimeout(function(){ t.style.opacity = '0'; }, 4500);
      });
    }

    var showDone = function(phone, smsUrl){
      form.hidden = true;
      var done = document.getElementById('quoteDone');
      var dm = document.getElementById('doneMsg');
      if(dm){
        if(isMobile && smsUrl){
          dm.textContent = "We got your info! We'll text you at " + phone + " to set up your free walk-through. Opening a text so you can send us a copy too — just hit send.";
        } else {
          dm.textContent = "We got your info! We'll text you at " + phone + " from " + brandPhone() + " to set up your free walk-through. Keep an eye on your messages.";
        }
      }
      if(done){ done.hidden = false; done.scrollIntoView({behavior:'smooth', block:'center'}); }
      // Belt-and-suspenders: on mobile only, also open the customer's SMS app pre-filled.
      // Skipped on desktop to avoid the "Open Pick an app?" system dialog.
      if(smsUrl && isMobile){ setTimeout(function(){ window.location.href = smsUrl; }, 900); }
    };

    form.addEventListener('submit', function(e){
      e.preventDefault();

      // honeypot: bots fill this; treat as done and do nothing real
      var hp = form.querySelector('.hp');
      if(hp && hp.value){ showDone(val('q-phone') || 'your phone'); return; }

      // validate
      var checks = [['q-name','name'],['q-phone','phone'],['q-addr','address'],['q-city','city'],['q-service','service']];
      var firstBad = null, ok = true;
      checks.forEach(function(c){
        var el = document.getElementById(c[0]);
        var bad = !el.value || !el.value.trim();
        setErr(el.closest('.field'), bad);
        if(bad){ ok=false; if(!firstBad) firstBad=el; }
      });
      var days = getDays();
      var daysField = form.querySelector('.field--days');
      setErr(daysField, days.length===0);
      if(days.length===0){ ok=false; if(!firstBad) firstBad=form.querySelector('input[name="days"]'); }
      var consent = document.getElementById('q-consent');
      if(!consent.checked){ ok=false; if(!firstBad) firstBad=consent; }

      if(!ok){
        msgEl.className = 'estimate__msg err';
        msgEl.textContent = consent.checked ? 'Please fill in the highlighted fields and pick at least one day.'
                                            : 'Please complete the required fields and check the consent box.';
        if(firstBad) firstBad.focus();
        return;
      }

      var data = {
        name: val('q-name'), phone: val('q-phone'),
        address: val('q-addr'), city: val('q-city'),
        service: val('q-service'), description: val('q-desc'),
        days: days.join(', ')
      };

      // build request per provider
      var url, payload, headers = {'Content-Type':'application/json', 'Accept':'application/json'};
      if(LEAD.provider === 'web3forms' && LEAD.web3formsKey){
        url = 'https://api.web3forms.com/submit';
        payload = Object.assign({
          access_key: LEAD.web3formsKey,
          subject: 'New estimate request: ' + data.name + ' — ' + data.service,
          from_name: 'Summit & Stone site'
        }, data);
      } else {
        url = 'https://formsubmit.co/ajax/' + encodeURIComponent(brandEmail());
        payload = Object.assign({
          _subject: 'New estimate request: ' + data.name + ' — ' + data.service,
          _template: 'table', _captcha: 'false'
        }, data);
      }

      submitBtn.disabled = true;
      var origText = submitBtn.textContent; submitBtn.textContent = 'Sending…';
      msgEl.className = 'estimate__msg'; msgEl.textContent = '';

      fetch(url, {method:'POST', headers:headers, body:JSON.stringify(payload)})
        .then(function(r){ return r.ok ? r.json().catch(function(){return {ok:true};}) : Promise.reject(r.status); })
        .then(function(){ showDone(data.phone, buildSms(data)); })
        .catch(function(){
          // couldn't reach the lead server — never lose the lead
          if(isMobile){
            msgEl.className = 'estimate__msg ok';
            msgEl.textContent = 'Opening a text with your details — just hit send and we’ll take it from there!';
            window.location.href = buildSms(data);
          } else {
            msgEl.className = 'estimate__msg err';
            msgEl.textContent = 'Couldn’t reach our server. Please text your details to ' + brandPhone() + ' and we’ll get you scheduled!';
          }
        })
        .then(function(){ submitBtn.disabled = false; submitBtn.textContent = origText; });
    });

    // clear a field's error as the user fixes it
    form.addEventListener('input', function(e){
      var f = e.target.closest && e.target.closest('.field'); if(f) f.classList.remove('invalid');
      if(e.target.name === 'days') { var df=form.querySelector('.field--days'); if(df) df.classList.remove('invalid'); }
    });
    form.addEventListener('change', function(e){
      var f = e.target.closest && e.target.closest('.field'); if(f) f.classList.remove('invalid');
    });
  }

  window.renderContent = renderContent;
})();
