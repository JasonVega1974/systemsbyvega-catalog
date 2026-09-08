/* caregiving/niche.js — this niche's renderer and interactive logic.
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
     /admin/) is fetched at runtime and merged over it.
     Keep content.json's shape in sync with this const.
     ===================================================== */
var DAY_ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  var TIME_ORDER = ["Morning","Morning & evening","Midday","Afternoon","Overnight"];

  /* ---------- render ---------- */
  function renderContent(c){
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = c.brand.name; });
    document.querySelectorAll('[data-city]').forEach(function(el){ el.textContent = c.brand.city; });
    var telLink = telHref(c.brand.phone);
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = c.brand.phone; });
    document.querySelectorAll('[data-phone-link]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = 'Call or text ' + c.brand.phone; });
    document.querySelectorAll('.mobile-cta .call').forEach(function(el){ el.href = 'tel:' + telLink; });
    document.querySelectorAll('.mobile-cta .text').forEach(function(el){ el.href = 'sms:' + telLink + '?body=' + encodeURIComponent('Hi ' + c.brand.name + ', I\'d like to ask about care for my family.'); });

    // trust stats
    document.getElementById('trustStats').innerHTML = c.stats.map(function(s){
      return '<div class="tstat"><b>' + esc(s.num) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');

    // care needs checklist
    var cnGrid = document.getElementById('cnGrid');
    cnGrid.innerHTML = c.careNeeds.map(function(n){
      return '<label class="cn-card" data-need="' + esc(n.id) + '"><input type="checkbox" data-need-check="' + esc(n.id) + '"><span class="cn-body"><b>' + esc(n.label) + '</b><p>' + esc(n.desc) + '</p></span></label>';
    }).join('');

    // quote form need chips
    document.getElementById('qfNeeds').innerHTML = c.careNeeds.map(function(n){
      return '<label><input type="checkbox" name="need_' + esc(n.id) + '" value="' + esc(n.label) + '"> ' + esc(n.label) + '</label>';
    }).join('');

    // pricing
    document.getElementById('priceGrid').innerHTML = c.pricing.map(function(p){
      /* Canonical shape (§4.2): features is an ARRAY, highlight is the flag,
         label is the name, and this niche carries its price in blurb. */
      var feats = (p.features || []).map(function(f){ return '<li>' + esc(f) + '</li>'; }).join('');
      return '<div class="pcard' + (p.highlight ? ' best' : '') + '">' +
        (p.highlight ? '<span class="pnote">' + esc(p.note || 'Our pick') + '</span>' : '') +
        '<h3>' + esc(p.label) + '</h3>' +
        '<div class="pnum">' + esc(p.blurb) + '<span>' + esc(p.per) + '</span></div>' +
        '<ul>' + feats + '</ul></div>';
    }).join('');
    document.getElementById('pricingNote').textContent = c.pricingNote || '';

    // service area
    document.getElementById('areaShort').textContent = c.serviceArea.short;
    document.getElementById('areaChips').innerHTML = (c.serviceArea.cities || []).map(function(city){
      return '<span class="achip">' + esc(city) + '</span>';
    }).join('');

    // owner
    document.getElementById('ownerEyebrow').textContent = c.owner.heading || 'Our story';
    document.getElementById('ownerName').textContent = c.owner.name;
    document.getElementById('ownerBio').textContent = c.owner.bio;
    var photoWrap = document.getElementById('ownerPhotoWrap');
    photoWrap.innerHTML = c.owner.photo ? '<img src="' + esc(c.owner.photo) + '" alt="' + esc(c.owner.name) + '">' : '';

    // testimonials
    document.getElementById('testGrid').innerHTML = c.testimonials.map(function(t){
      return '<div class="tcard"><p>' + esc(t.quote) + '</p><div class="tname">' + esc(t.name) + '</div></div>';
    }).join('');

    // faq
    document.getElementById('faqList').innerHTML = c.faq.map(function(f, i){
      return '<details class="qa"' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + '<span class="pm">+</span></summary><div class="ans">' + esc(f.a) + '</div></details>';
    }).join('');

    revealScan(document.body);
    wireCareNeeds(c);
  }

  /* ---------- care-plan builder logic ---------- */
  function wireCareNeeds(c){
    var byId = {};
    c.careNeeds.forEach(function(n){ byId[n.id] = n; });
    var checks = document.querySelectorAll('[data-need-check]');
    checks.forEach(function(chk){
      chk.addEventListener('change', function(){
        var card = chk.closest('.cn-card');
        if(card) card.classList.toggle('on', chk.checked);
        renderPlan(byId);
      });
    });
  }

  function renderPlan(byId){
    var checked = Array.prototype.slice.call(document.querySelectorAll('[data-need-check]:checked')).map(function(el){
      return byId[el.getAttribute('data-need-check')];
    }).filter(Boolean);

    var body = document.getElementById('planBody');
    if(!checked.length){
      body.innerHTML = '<p class="plan-empty">Check a need above to see a sample weekly visit schedule.</p>';
      return;
    }

    var scheduled = checked.filter(function(n){ return n.days && n.days.length; });
    var asNeeded = checked.filter(function(n){ return !n.days || !n.days.length; });

    var html = '<div class="plan-week">';
    DAY_ORDER.forEach(function(day){
      var items = scheduled.filter(function(n){ return n.days.indexOf(day) !== -1; })
        .sort(function(a,b){ return TIME_ORDER.indexOf(a.time) - TIME_ORDER.indexOf(b.time); });
      html += '<div class="pw-day"><span class="pw-name">' + day + '</span>';
      if(items.length){
        items.forEach(function(n){ html += '<div class="pw-pill">' + esc(n.label) + '<br>' + esc(n.time) + '</div>'; });
      } else {
        html += '<div class="pw-none">—</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    if(asNeeded.length){
      html += '<div class="plan-note">Also requested: ' + asNeeded.map(function(n){ return esc(n.label); }).join(', ') + ' — scheduled around the week above as appointments come up.</div>';
    }

    body.innerHTML = html;
  }

  /* ---------- reveal on scroll ---------- */
  var io = null;
  function revealScan(root){
    var nodes = (root || document).querySelectorAll('.reveal:not(.in)');
    if(reduce || !('IntersectionObserver' in window)){
      nodes.forEach(function(el){ el.classList.add('in'); });
      return;
    }
    if(!io){
      io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    }
    nodes.forEach(function(el){ io.observe(el); });
  }

  /* ---------- year (none shown; footer omits copyright line per current copy) ---------- */

  /* ---------- nav solidify ---------- */
  var nav = document.getElementById('nav');
  var onScroll = function(){ nav.classList.toggle('solid', window.scrollY > 24); };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- desktop sms:/tel: guard ---------- */
  var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  function toast(msg){
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function(){ t.classList.remove('show'); }, 3200);
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest('a[href^="sms:"], a[href^="tel:"]');
    if(!a || isMobile) return;
    e.preventDefault();
    toast('Call or text ' + CONTENT.brand.phone);
  });

  /* ---------- lead form (FormSubmit) ---------- */
  var LEAD = { provider: 'formsubmit', email: '' };
  function applyRuntime(c){ LEAD.email = (c.brand||{}).leadEmail || LEAD.email; }
  applyRuntime(CONTENT);

  var form = document.getElementById('quoteForm');
  var status = document.getElementById('qfStatus');
  var success = document.getElementById('qfSuccess');
  var submitBtn = document.getElementById('qfSubmit');
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(form._honey && form._honey.value){ return; } // honeypot tripped, silently drop
    var honey = form.querySelector('[name="_honey"]');
    if(honey && honey.value) return;

    var name = document.getElementById('qName').value.trim();
    var phone = document.getElementById('qPhone').value.trim();
    if(!name || !phone){
      status.textContent = 'Please fill in your name and phone number.';
      status.classList.add('err');
      return;
    }
    status.textContent = ''; status.classList.remove('err');
    submitBtn.disabled = true; submitBtn.textContent = 'Sending…';

    var needs = Array.prototype.slice.call(form.querySelectorAll('.qf-needs input:checked')).map(function(c){ return c.value; }).join(', ');
    var payload = {
      name: name, phone: phone,
      city: document.getElementById('qCity').value.trim() || '(not given)',
      needs: needs || '(not specified)',
      notes: document.getElementById('qNotes').value.trim(),
      _subject: 'Hearth & Home — new consultation request from ' + name,
      _template: 'table', _captcha: 'false'
    };

    fetch('https://formsubmit.co/ajax/' + encodeURIComponent(LEAD.email), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(r){ return r.json(); }).then(function(res){
      if(res && (res.success === 'true' || res.success === true)){
        form.hidden = true;
        success.hidden = false;
        success.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      } else {
        throw new Error('formsubmit rejected');
      }
    }).catch(function(){
      status.innerHTML = 'Something didn\'t go through — text us directly at <strong>' + esc(CONTENT.brand.phone) + '</strong> instead.';
      status.classList.add('err');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request a free consultation';
    });
  });

  /* ---------- boot ---------- */
  /* boot handed to base.js */

  window.renderContent = renderContent;
})();
