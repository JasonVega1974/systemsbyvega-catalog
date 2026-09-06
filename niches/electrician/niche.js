/* electrician/niche.js — this niche's renderer and interactive logic.
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

  /* =====================================================
     OWNER-EDITABLE CONTENT
     DEFAULT_CONTENT ships with the page and renders
     immediately. content.json (repo root, edited from
     /admin/) is fetched at runtime and merged over it —
     the switchboard, pricing, service area, FAQ, footer and
     owner section all re-render from the merged object.
     Keep content.json's shape in sync with this const.
     (Static copy the admin does NOT touch: the JSON-LD in
     <head> and the meta description.)
     ===================================================== */
/* Lead delivery — no backend. FormSubmit needs no account, but the FIRST real
     submission emails a one-time activation link to LEAD.email; click it once and
     every quote request after that lands in that inbox, formatted as a table. */
  var LEAD = { provider: 'formsubmit', email: '', sms: '' };

  /* Shared quote/paren stripper for anything interpolated into an img src
     attribute — symmetric with bin-cleaning/niche.js's safeUrl(). */
  function safeUrl(u){ return String(u || '').replace(/["\\)]/g, ''); }

  function applyRuntime(c){
    LEAD.email = (c.brand||{}).leadEmail || LEAD.email;
    LEAD.sms = telHref((c.brand||{}).phone);
  }
  applyRuntime(CONTENT);

  // ---------- year ----------
  document.getElementById('yr').textContent = new Date().getFullYear();

  // ---------- nav solidify ----------
  var nav = document.getElementById('nav');
  var onScroll = function(){ nav.classList.toggle('solid', window.scrollY > 30); };
  onScroll(); window.addEventListener('scroll', onScroll, {passive:true});

  // ---------- reveal on scroll (re-armable for JS-injected nodes) ----------
  var io = null;
  if('IntersectionObserver' in window && !reduce){
    io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
  }
  function revealScan(root){
    var nodes = (root || document).querySelectorAll('.reveal:not(.in)');
    if(io){ nodes.forEach(function(n){ io.observe(n); }); }
    else { nodes.forEach(function(n){ n.classList.add('in'); }); }
  }

  // ---------- drifting spark motes in hero ----------
  var sparksEl = document.getElementById('sparks');
  if(sparksEl && !reduce){
    var n = window.innerWidth < 700 ? 8 : 16;
    for(var i=0;i<n;i++){
      var m = document.createElement('span');
      m.className = 'spark-mote';
      m.style.left = Math.random()*100 + '%';
      var dur = 8 + Math.random()*9;
      m.style.animationDuration = dur + 's';
      m.style.animationDelay = (-Math.random()*dur) + 's';
      m.style.opacity = 0.3 + Math.random()*0.5;
      sparksEl.appendChild(m);
    }
  }

  // ---------- BREAKER SWITCHBOARD ----------
  var onIds = {};
  function renderBreakers(){
    var wrap = document.getElementById('breakers');
    wrap.innerHTML = (CONTENT.services||[]).map(function(s){
      return '<button type="button" class="breaker" data-id="'+esc(s.id)+'" aria-pressed="'+(onIds[s.id]?'true':'false')+'">'+
        '<span class="breaker__switch" aria-hidden="true"></span>'+
        '<span class="breaker__label">'+esc(s.label)+'</span>'+
      '</button>';
    }).join('');
    renderReadout();
  }
  function renderReadout(){
    var readout = document.getElementById('readout');
    var active = (CONTENT.services||[]).filter(function(s){ return onIds[s.id]; });
    document.getElementById('onCount').textContent = active.length;
    if(!active.length){
      readout.innerHTML = '<div class="readout-empty">Flip a breaker above to see what it powers.</div>';
      return;
    }
    readout.innerHTML = '<div class="readout-list">' + active.map(function(s){
      return '<div class="readout-card"><div class="readout-card__body"><div class="readout-card__name">'+esc(s.label)+'</div>'+
        '<div class="readout-card__desc">'+esc(s.desc)+'</div></div><span class="readout-card__tag">On</span></div>';
    }).join('') + '</div>';
    revealScan(readout);
  }
  document.getElementById('breakers').addEventListener('click', function(e){
    var btn = e.target.closest('.breaker'); if(!btn) return;
    var id = btn.getAttribute('data-id');
    onIds[id] = !onIds[id];
    btn.setAttribute('aria-pressed', onIds[id] ? 'true' : 'false');
    renderReadout();
    var opt = document.querySelector('#b-service option[value="'+id+'"]');
    if(opt){
      var summary = document.getElementById('b-summary');
      var chosen = (CONTENT.services||[]).filter(function(s){ return onIds[s.id]; }).map(function(s){ return s.label; });
      summary.value = chosen.join(', ');
      if(chosen.length === 1){ document.getElementById('b-service').value = id; }
    }
  });

  // ---------- pricing ----------
  function renderPricing(){
    var p = CONTENT.pricing || {};
    var sc = p.serviceCall || {};
    document.getElementById('callPrice').textContent = '$' + (sc.price != null ? sc.price : 95);
    document.getElementById('callNote').textContent = sc.note || '';
    document.getElementById('rangesList').innerHTML = (p.ranges||[]).map(function(r){
      return '<div class="range-row"><span class="range-row__label">'+esc(r.label)+'</span><span class="range-row__val">'+esc(r.range)+'</span></div>';
    }).join('');
  }

  // ---------- service area ----------
  function renderArea(){
    var area = CONTENT.serviceArea || {};
    var cities = (area.cities || []).filter(Boolean);
    document.getElementById('areaChips').innerHTML = cities.map(function(c){
      return '<span class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 21s-6-5.7-6-10a6 6 0 0 1 12 0c0 4.3-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>'+esc(c)+'</span>';
    }).join('');
    document.getElementById('footServe').textContent = 'Serving ' + cities.join(' · ');
  }

  // ---------- FAQ ----------
  function renderFaq(){
    document.getElementById('faqList').innerHTML = (CONTENT.faq||[]).map(function(f){
      return '<details class="faq"><summary>'+esc(f.q)+'<span class="plus">+</span></summary><div class="faq__body">'+esc(f.a)+'</div></details>';
    }).join('');
  }

  // ---------- service select options ----------
  function renderServiceOptions(){
    var sel = document.getElementById('b-service');
    sel.innerHTML = '<option value="" disabled selected>Choose one…</option>' +
      (CONTENT.services||[]).map(function(s){ return '<option value="'+esc(s.id)+'">'+esc(s.label)+'</option>'; }).join('') +
      '<option value="other">Something else</option>';
  }

  // ---------- brand / footer ----------
  function renderBrand(){
    var b = CONTENT.brand || {};
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = b.name || ''; });
    document.querySelectorAll('[data-tagline]').forEach(function(el){ el.textContent = b.tagline || ''; });
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.textContent = b.phone || ''; });
    document.querySelectorAll('a[href^="tel:"]').forEach(function(a){ a.href = 'tel:' + telHref(b.phone); });
    var fe = document.getElementById('footEmail');
    if(fe){ fe.href = 'mailto:' + b.email; fe.textContent = b.email; }
    document.getElementById('heroEyebrow').textContent = 'Electrician · ' + (b.city || '').replace(/, ID$/, ', Idaho');

    // ----- social links (footer; hidden when empty) -----
    var footSocial = document.getElementById('footSocial');
    if(footSocial){
      var social = CONTENT.social || [];
      /* Filter FIRST, then gate visibility on the filtered result — gating on
         the raw (pre-filter) social.length would show an empty, hidden=false
         footer row whenever every entry failed the https scheme check. */
      var socialLinks = social.filter(function(s){ return /^https:\/\//i.test(s.url); /* scheme-gated here too, not just in sbv_social_valid — entity encoding cannot stop a scheme, and safeUrl only de-fangs CSS/attr breakout */ });
      if(socialLinks.length){
        footSocial.innerHTML = socialLinks.map(function(s){
          return '<a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent-2)">' + esc(s.label || s.n) + '</a>';
        }).join(' · ');
        footSocial.hidden = false;
      } else {
        footSocial.innerHTML = '';
        footSocial.hidden = true;
      }
    }
  }

  // ---------- owner ----------
  var ownerPhotoBox = document.getElementById('ownerPhoto');
  var ownerPhotoFallbackAria = ownerPhotoBox ? ownerPhotoBox.getAttribute('aria-label') : null;
  function renderOwner(){
    var o = CONTENT.owner || {};
    var desc = document.getElementById('ownerDesc');
    desc.textContent = o.bio || '';

    if(ownerPhotoBox){
      var ph = o.photo;
      if(ph){
        ownerPhotoBox.innerHTML = '<img src="' + safeUrl(ph) + '" alt="' + esc(o.name || 'The owner') + '" loading="lazy">';
        ownerPhotoBox.setAttribute('aria-label', 'Photo of ' + (o.name || 'the owner'));
      } else if(!ownerPhotoBox.querySelector('img') && ownerPhotoFallbackAria !== null){
        ownerPhotoBox.setAttribute('aria-label', ownerPhotoFallbackAria);
      }
    }
  }

  // ---------- testimonials ----------
  function renderTestimonials(){
    var t = CONTENT.testimonials || [];
    document.querySelectorAll('.review').forEach(function(card, i){
      var q = card.querySelector('.review__quote'), who = card.querySelector('.review__who');
      var item = t[i] || {};
      q.textContent = item.quote || '';
      who.textContent = item.author ? ('— ' + item.author) : '— Add a real review here';
    });
  }

  function renderContent(c){
    CONTENT = c;
    applyRuntime(CONTENT);
    renderBrand();
    renderBreakers();
    renderPricing();
    renderArea();
    renderFaq();
    renderServiceOptions();
    renderOwner();
    renderTestimonials();
    revealScan(document);
  }

  /* boot handed to base.js */

  // ---------- urgency toggle ----------
  var urgency = 'scheduled';
  var urgencyNotes = {
    scheduled: "Routine work — we'll confirm a time that works for you.",
    emergency: "Active hazard — we'll call to confirm the fastest slot we can get to you."
  };
  document.querySelectorAll('.urgency button').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.urgency button').forEach(function(b){ b.setAttribute('aria-pressed','false'); });
      btn.setAttribute('aria-pressed','true');
      urgency = btn.getAttribute('data-val');
      document.getElementById('urgencyNote').textContent = urgencyNotes[urgency] || '';
    });
  });

  // ---------- quote form ----------
  var form = document.getElementById('bookForm');
  if(form){
    var msgEl = document.getElementById('bookMsg');
    var submitBtn = document.getElementById('bookSubmit');
    var doneCard = document.getElementById('bookDone');

    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(form.querySelector('.hp').value){ return; } // honeypot tripped, silently drop
      var name = document.getElementById('b-name').value.trim();
      var phone = document.getElementById('b-phone').value.trim();
      var addr = document.getElementById('b-addr').value.trim();
      var city = document.getElementById('b-city').value.trim();
      var service = document.getElementById('b-service').value;
      var consent = document.getElementById('b-consent').checked;

      var invalid = false;
      [['b-name',name],['b-phone',phone],['b-addr',addr],['b-city',city],['b-service',service]].forEach(function(pair){
        var el = document.getElementById(pair[0]);
        var field = el.closest('.field');
        var bad = !pair[1];
        field.classList.toggle('invalid', bad);
        if(bad) invalid = true;
      });
      if(!consent) invalid = true;
      if(invalid){ msgEl.textContent = 'Please fill in the required fields.'; msgEl.className = 'book__msg err'; return; }

      submitBtn.disabled = true; submitBtn.textContent = 'Sending…';
      var payload = {
        name: name, phone: phone, address: addr, city: city,
        service: service, urgency: urgency,
        notes: document.getElementById('b-notes').value.trim(),
        selection: document.getElementById('b-summary').value,
        _subject: 'Voltridge Electric — ' + (urgency === 'emergency' ? 'URGENT ' : '') + 'quote request',
        _template: 'table', _captcha: 'false'
      };

      fetch('https://formsubmit.co/ajax/' + encodeURIComponent(LEAD.email), {
        method: 'POST',
        headers: {'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(payload)
      }).then(function(r){ return r.json(); }).then(function(res){
        if(res && (res.success === 'true' || res.success === true)){
          form.hidden = true;
          doneCard.hidden = false;
          document.getElementById('doneMsg').textContent = "We'll text " + name.split(' ')[0] + ' shortly to confirm.';
          doneCard.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'center'});
        } else { throw new Error('formsubmit rejected'); }
      }).catch(function(){
        msgEl.innerHTML = 'Hmm — that didn\'t go through. Text us directly at <strong>' + esc(CONTENT.brand.phone) + '</strong> instead.';
        msgEl.className = 'book__msg err';
        submitBtn.disabled = false; submitBtn.textContent = 'Get my quote';
      });
    });
  }

  window.renderContent = renderContent;
})();
