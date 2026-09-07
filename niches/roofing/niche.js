/* roofing/niche.js — this niche's renderer and interactive logic.
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
  function smsHref(p,body){ return 'sms:'+telHref(p)+(body?'?body='+encodeURIComponent(body):''); }

  /* =====================================================
     OWNER-EDITABLE CONTENT
     DEFAULT_CONTENT ships with the page and renders immediately.
     content.json (repo root, edited from /admin/) is fetched at
     runtime and merged over it. Keep content.json's shape in sync
     with this const.
     ===================================================== */
var LEAD = { provider: 'formsubmit', email: '', sms: '' };
  function applyRuntime(c){
    LEAD.email = (c.brand||{}).leadEmail || LEAD.email;
    LEAD.sms = telHref((c.brand||{}).phone);
  }
  applyRuntime(CONTENT);

  var SC_ICONS = {
    repair: '<path d="M14 10l7-7M17 7l3 3M4 20l6-6M4 20l4-1 9-9-3-3-9 9-1 4z"/>',
    replace: '<path d="M3 12l9-9 9 9M6 10v10h12V10"/>',
    claim: '<path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>',
    gutter: '<path d="M3 6h18M6 6v14M18 6v14M6 20h12"/>'
  };

  /* ---------- render ---------- */
  function renderContent(c){
    var b = c.brand || {};
    document.querySelectorAll('[data-brand],[data-brand2]').forEach(function(el){ el.textContent = b.name || ''; });
    document.querySelectorAll('[data-tagline],[data-tagline2]').forEach(function(el){ el.textContent = b.tagline || ''; });
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.textContent = b.phone || ''; });
    document.querySelectorAll('[data-tel],[data-tel2]').forEach(function(el){ el.setAttribute('href', 'tel:'+telHref(b.phone)); });
    document.querySelectorAll('[data-sms]').forEach(function(el){
      var body = el.hasAttribute('data-sms-body') ? el.getAttribute('data-sms-body') : ("Hi " + (b.name||'') + "! I'd like a free roof inspection.");
      el.setAttribute('href', smsHref(b.phone, body));
    });
    var em = document.querySelector('[data-email]');
    if(em){ em.href = 'mailto:' + (b.email||''); em.textContent = b.email || ''; }

    document.getElementById('heroSub') && (document.getElementById('heroSub').textContent = '');
    var heroSubEl = document.querySelector('[data-heroSub]');
    if(heroSubEl) heroSubEl.textContent = heroSubEl.textContent; // no-op, static copy stays

    // hero stats
    var hs = document.getElementById('heroStats');
    hs.innerHTML = (c.stats||[]).map(function(s){
      return '<div class="hstat"><b>'+esc(s.num)+'</b><span>'+esc(s.label)+'</span></div>';
    }).join('');

    // self-check intro
    var scIntro = document.getElementById('scIntro');
    if(scIntro && c.selfCheck && c.selfCheck.intro) scIntro.textContent = c.selfCheck.intro;

    // services
    var svc = document.getElementById('svcGrid');
    svc.innerHTML = (c.services||[]).map(function(s){
      return '<div class="svc-card"><div class="ic"><svg viewBox="0 0 24 24">'+(SC_ICONS[s.icon]||SC_ICONS.repair)+'</svg></div><h3>'+esc(s.title)+'</h3><p>'+esc(s.desc)+'</p></div>';
    }).join('');

    // pricing
    var pg = document.getElementById('priceGrid');
    pg.innerHTML = (c.pricing||[]).map(function(p){
      return '<div class="pcard'+(p.highlight?' feat':'')+'">'+(p.highlight?'<span class="tag">Most common</span>':'')+
        '<h3>'+esc(p.label)+'</h3><div class="price">'+esc(p.blurb)+'</div>'+(p.per?'<div class="per">'+esc(p.per)+'</div>':'<div class="per">&nbsp;</div>')+
        '<ul>'+(p.features||[]).map(function(f){return '<li>'+esc(f)+'</li>';}).join('')+'</ul></div>';
    }).join('');

    // service area
    var area = c.serviceArea || {};
    var saR = document.getElementById('saRegion');
    if(saR) saR.textContent = 'Roofing the ' + (area.region || '') + '.';
    var saC = document.getElementById('saCities');
    if(saC) saC.innerHTML = (area.cities||[]).map(function(city){ return '<span class="sa-chip">'+esc(city)+'</span>'; }).join('');
    var footServe = document.getElementById('footServe');
    if(footServe) footServe.textContent = 'Serving ' + (area.cities||[]).join(' · ');

    // owner
    var o = c.owner || {};
    var oName = document.getElementById('ownerName'); if(oName) oName.textContent = o.name || '';
    var oBio = document.getElementById('ownerBio'); if(oBio) oBio.textContent = o.bio || '';
    var oPhoto = document.getElementById('ownerPhoto');
    if(oPhoto){
      if(o.photo){ oPhoto.innerHTML = '<img src="'+esc(o.photo)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:14px">'; oPhoto.style.color=''; }
      else { oPhoto.textContent = 'Photo coming soon'; }
    }

    // testimonials
    var tg = document.getElementById('testGrid');
    tg.innerHTML = (c.testimonials||[]).map(function(t){
      var q = t.quote ? esc(t.quote) : 'Real review coming soon.';
      var n = t.name ? esc(t.name) : '';
      return '<div class="tcard"><p>“'+q+'”</p>'+(n?'<div class="who">'+n+'</div>':'')+'</div>';
    }).join('');

    // faq
    var fl = document.getElementById('faqList');
    fl.innerHTML = (c.faq||[]).map(function(f,i){
      return '<details class="qa reveal"'+(i===0?' open':'')+'><summary>'+esc(f.q)+'<span class="pm">+</span></summary><p>'+esc(f.a)+'</p></details>';
    }).join('');

    revealScan(document.body);
    initSelfCheck(c.selfCheck || DEFAULT_CONTENT.selfCheck);
  }

  /* boot handed to base.js */

  // ---------- year ----------
  var yr = document.getElementById('yr'); if(yr) yr.textContent = new Date().getFullYear();

  // ---------- nav solidify ----------
  var nav = document.getElementById('nav');
  var onScroll = function(){ nav.classList.toggle('solid', window.scrollY > 30); };
  onScroll(); window.addEventListener('scroll', onScroll, {passive:true});

  // ---------- reveal on scroll (re-armable for JS-rendered nodes) ----------
  var io = null;
  function revealScan(root){
    var nodes = (root||document).querySelectorAll('.reveal:not(.in)');
    if(reduce || !('IntersectionObserver' in window)){
      nodes.forEach(function(n){ n.classList.add('in'); });
      return;
    }
    if(!io){
      io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
      }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
    }
    nodes.forEach(function(n){ io.observe(n); });
  }
  revealScan(document);

  // ---------- self-check roof-diagram highlight (rAF spring, physics-eased) ----------
  // Presentational only: moves #chkGlow to the roof zone the active question is about
  // and brightens the matching zone label. Data/flow is unchanged. — north-star: dj-site-blue
  var ZONE_PTS = [ [150,108], [210,146], [210,64], [315,40] ]; // 0 shingles, 1 gutters, 2 peak/attic, 3 impact
  var glow = { x:210, y:104, vx:0, vy:0, tx:210, ty:104, raf:0 };
  function zoneForQuestion(q, i){
    var id = String((q && q.id) || '').toLowerCase();
    if(/shingle/.test(id)) return 0;
    if(/granule|gutter|downspout/.test(id)) return 1;
    if(/daylight|attic|stain|soft|leak/.test(id)) return 2;
    if(/storm|hail|wind|branch/.test(id)) return 3;
    return Math.max(0, Math.min(i, 3)); // fall back to question order
  }
  function setActiveZone(z){
    var pt = ZONE_PTS[z] || [210,104];
    var lbls = document.querySelectorAll('.chk-zonelbl');
    lbls.forEach(function(l){ l.classList.toggle('active', parseInt(l.getAttribute('data-z'),10) === z); });
    glow.tx = pt[0]; glow.ty = pt[1];
    var el = document.getElementById('chkGlow');
    if(reduce || !el){ // reduced motion: snap to zone, no animation
      glow.x = glow.tx; glow.y = glow.ty; glow.vx = glow.vy = 0;
      if(el) el.setAttribute('transform', 'translate('+glow.x+' '+glow.y+')');
      return;
    }
    if(!glow.raf) glow.raf = requestAnimationFrame(stepGlow);
  }
  function stepGlow(){
    var el = document.getElementById('chkGlow');
    if(!el){ glow.raf = 0; return; }
    var k = 0.16, damp = 0.74; // spring stiffness + damping => eased physics decay
    glow.vx = (glow.vx + (glow.tx - glow.x) * k) * damp;
    glow.vy = (glow.vy + (glow.ty - glow.y) * k) * damp;
    glow.x += glow.vx; glow.y += glow.vy;
    el.setAttribute('transform', 'translate('+glow.x.toFixed(2)+' '+glow.y.toFixed(2)+')');
    if(Math.abs(glow.tx-glow.x) + Math.abs(glow.ty-glow.y) + Math.abs(glow.vx) + Math.abs(glow.vy) > 0.4){
      glow.raf = requestAnimationFrame(stepGlow);
    } else {
      el.setAttribute('transform', 'translate('+glow.tx+' '+glow.ty+')');
      glow.raf = 0;
    }
  }

  // ---------- self-check state machine ----------
  var scState = { qi: 0, answers: [] };
  function initSelfCheck(sc){
    scState = { qi: 0, answers: [] };
    var progress = document.getElementById('scProgress');
    progress.innerHTML = sc.questions.map(function(){ return '<i></i>'; }).join('');
    document.getElementById('scResult').classList.remove('show','urgent','watch');
    renderScQuestion(sc);
  }
  function renderScQuestion(sc){
    var q = sc.questions[scState.qi];
    var wrap = document.getElementById('scQuestion');
    wrap.innerHTML =
      '<div class="sc-qnum">Question '+(scState.qi+1)+' of '+sc.questions.length+'</div>'+
      '<div class="sc-qtext">'+esc(q.q)+'</div>'+
      '<div class="sc-opts" role="group" aria-label="'+esc(q.q)+'">'+
        '<button type="button" class="sc-opt" data-ans="yes">Yes</button>'+
        '<button type="button" class="sc-opt" data-ans="no">No</button>'+
        '<button type="button" class="sc-opt" data-ans="unsure">Not sure</button>'+
      '</div>'+
      '<button type="button" class="sc-back'+(scState.qi===0?' hidden':'')+'" id="scBack">← Back</button>';
    var marks = document.querySelectorAll('#scProgress i');
    marks.forEach(function(m,i){ m.classList.toggle('done', i < scState.qi); });
    setActiveZone(zoneForQuestion(q, scState.qi)); // move the diagram highlight to this zone
    wrap.querySelectorAll('.sc-opt').forEach(function(btn){
      btn.addEventListener('click', function(){
        scState.answers[scState.qi] = btn.getAttribute('data-ans');
        if(scState.qi < sc.questions.length - 1){ scState.qi++; renderScQuestion(sc); }
        else { finishSelfCheck(sc); }
      });
    });
    var back = document.getElementById('scBack');
    if(back) back.addEventListener('click', function(){ if(scState.qi>0){ scState.qi--; renderScQuestion(sc); } });
  }
  function finishSelfCheck(sc){
    var yesCount = scState.answers.filter(function(a){ return a==='yes'; }).length;
    // settle the diagram highlight on the first flagged zone (or impact if all clear)
    var firstFlag = scState.answers.indexOf('yes');
    setActiveZone(firstFlag >= 0 ? zoneForQuestion(sc.questions[firstFlag], firstFlag) : 3);
    document.getElementById('scQuestion').innerHTML = '';
    var marks = document.querySelectorAll('#scProgress i');
    marks.forEach(function(m){ m.classList.add('done'); });
    var result = document.getElementById('scResult');
    var badge = document.getElementById('scBadge');
    var headline = document.getElementById('scHeadline');
    var body = document.getElementById('scBody');
    result.classList.remove('urgent','watch');
    if(yesCount >= 1){
      result.classList.add('urgent');
      badge.textContent = 'Worth a look soon';
      headline.textContent = yesCount >= 2 ? "Worth scheduling a free inspection soon." : "Worth a quick look.";
      body.textContent = "Based on your answers, at least one sign points to something worth having a roofer actually look at in person. A free inspection will tell you exactly what's going on — no obligation either way.";
    } else {
      result.classList.add('watch');
      badge.textContent = 'Looking okay for now';
      headline.textContent = "Sounds like you're in good shape.";
      body.textContent = "Nothing in your answers points to an obvious problem right now. Roofs are worth a look after any major storm anyway — the free inspection stands whenever you want a second opinion.";
    }
    result.classList.add('show');
    var summary = sc.questions.map(function(q,i){ return q.q + ' ' + (scState.answers[i]||'').toUpperCase(); }).join(' | ');
    var cta = document.getElementById('scCta');
    cta.onclick = function(){
      var details = document.getElementById('qDetails');
      if(details) details.value = "Self-check summary: " + summary;
      var target = document.getElementById('quote');
      if(target) target.scrollIntoView({behavior: reduce ? 'auto' : 'smooth'});
    };
    revealScan(result.closest('section'));
  }
  document.addEventListener('click', function(e){
    if(e.target && e.target.id === 'scRestart'){ initSelfCheck(CONTENT.selfCheck || DEFAULT_CONTENT.selfCheck); }
  });

  // ---------- desktop sms:/tel: guard ----------
  var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(!isMobile){
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href^="sms:"], a[href^="tel:"]');
      if(!a) return;
      e.preventDefault();
      var t = document.getElementById('svToast');
      t.style.cssText = 'display:block;position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:9999;background:#1A2733;color:#fff;padding:14px 22px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.55);border:1px solid rgba(181,84,31,.4);font-family:Rubik,system-ui,sans-serif;font-size:15px;max-width:88vw;text-align:center;';
      t.innerHTML = 'Call or text us at <strong style="color:#D97539">'+esc((CONTENT.brand||{}).phone||'')+'</strong> from your phone.';
      clearTimeout(window.__svToastTimer);
      window.__svToastTimer = setTimeout(function(){ t.style.display='none'; }, 4200);
    });
  }

  // ---------- quote form (FormSubmit + honeypot) ----------
  (function(){
    var form = document.getElementById('quoteForm');
    if(!form) return;
    var msg = document.getElementById('qMsg');
    var success = document.getElementById('qSuccess');
    var btn = document.getElementById('qSubmit');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(form.querySelector('[name="_honey"]').value){ return; } // bot caught, silently drop
      msg.textContent = ''; msg.classList.remove('err');
      btn.disabled = true; btn.textContent = 'Sending…';
      var payload = {
        name: document.getElementById('qName').value,
        phone: document.getElementById('qPhone').value,
        address: document.getElementById('qAddress').value,
        details: document.getElementById('qDetails').value,
        _subject: 'Storm Ridge Roofing — inspection request',
        _template: 'table', _captcha: 'false'
      };
      fetch('https://formsubmit.co/ajax/' + encodeURIComponent(LEAD.email), {
        method: 'POST',
        headers: {'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(payload)
      }).then(function(r){ return r.json(); }).then(function(res){
        if(res && (res.success === 'true' || res.success === true)){
          form.hidden = true;
          success.classList.add('show');
          success.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'center'});
        } else { throw new Error('formsubmit rejected'); }
      }).catch(function(){
        msg.textContent = "Hmm — that didn't go through. Text your info straight to " + ((CONTENT.brand||{}).phone||'') + " instead.";
        msg.classList.add('err');
        btn.disabled = false; btn.textContent = 'Request my free inspection →';
      });
    });
  })();

  window.renderContent = renderContent;
})();
