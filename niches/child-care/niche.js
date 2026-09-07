/* child-care/niche.js — this niche's renderer and interactive logic.
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
     Written as strict JSON so tooling can verify the two
     stay byte-consistent.
     ===================================================== */
/* ---------- render ---------- */
  function renderContent(c){
    document.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = c.brand.name; });
    document.querySelectorAll('[data-city]').forEach(function(el){ el.textContent = c.brand.city; });
    var telLink = telHref(c.brand.phone);
    document.querySelectorAll('[data-phone]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = c.brand.phone; });
    document.querySelectorAll('[data-phone-link]').forEach(function(el){ el.href = 'tel:' + telLink; el.textContent = 'Call or text ' + c.brand.phone; });
    document.querySelectorAll('.mobile-cta .call').forEach(function(el){ el.href = 'tel:' + telLink; });
    document.querySelectorAll('.mobile-cta .text').forEach(function(el){ el.href = 'sms:' + telLink + '?body=' + encodeURIComponent('Hi ' + c.brand.name + ', are you free this weekend?'); });

    // trust stats
    document.getElementById('trustStats').innerHTML = c.stats.map(function(s){
      return '<div class="tstat"><b>' + esc(s.num) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');

    // services
    document.getElementById('svcGrid').innerHTML = c.services.map(function(s){
      return '<div class="svc-card"><h3>' + esc(s.title) + '<span class="from">' + esc(s.from) + '</span></h3><p>' + esc(s.desc) + '</p></div>';
    }).join('');

    // how it works
    document.getElementById('howGrid').innerHTML = c.howItWorks.map(function(st){
      return '<div class="how-card"><h3>' + esc(st.title) + '</h3><p>' + esc(st.desc) + '</p></div>';
    }).join('');

    // approach
    var icos = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    ];
    document.getElementById('appGrid').innerHTML = c.approach.map(function(a, i){
      return '<div class="acard"><span class="a-ico">' + icos[i % icos.length] + '</span><h3>' + esc(a.title) + '</h3><p>' + esc(a.desc) + '</p></div>';
    }).join('');

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

    // rates — rows of {label, rate, unit}, the admin's hourly save shape
    // (merged onto niche.rates by index), so an operator's pricing edit
    // renders here with no key translation. Row order carries meaning:
    // row 0 is the base rate, every later row renders as a "+$" add-on.
    var rates = c.rates || [];
    document.getElementById('rateGrid').innerHTML = rates.map(function(row, i){
      return '<div class="rcard"><div class="rnum">' + (i ? '+' : '') + '$' + esc(row.rate) + esc(row.unit || '/hr') + '</div><div class="rlbl">' + esc(row.label) + '</div></div>';
    }).join('');
    document.getElementById('ratesNote').textContent = c.ratesNote || '';

    // when-select in booking form
    var whenSel = document.getElementById('qWhen');
    whenSel.innerHTML = (c.careTimes || []).map(function(t){
      return '<option value="' + esc(t.label) + '">' + esc(t.label) + '</option>';
    }).join('') + '<option value="Flexible">Flexible / not sure yet</option>';

    // testimonials
    document.getElementById('testGrid').innerHTML = c.testimonials.map(function(t){
      return '<div class="tcard"><p>' + esc(t.quote) + '</p><div class="tname">' + esc(t.name) + '</div></div>';
    }).join('');

    // faq
    document.getElementById('faqList').innerHTML = c.faq.map(function(f, i){
      return '<details class="qa"' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + '<span class="pm">+</span></summary><div class="ans">' + esc(f.a) + '</div></details>';
    }).join('');

    // planner
    renderPlannerControls(c);
    renderPlan(c);

    revealScan(document.body);
  }

  /* ---------- sitter match planner ---------- */
  var plState = { counts: {}, time: null, needs: {} };

  function renderPlannerControls(c){
    // stale-id guards: drop state for ids that no longer exist
    var bandIds = (c.ageBands || []).map(function(b){ return b.id; });
    Object.keys(plState.counts).forEach(function(k){ if(bandIds.indexOf(k) === -1) delete plState.counts[k]; });
    var timeIds = (c.careTimes || []).map(function(t){ return t.id; });
    if(timeIds.indexOf(plState.time) === -1) plState.time = timeIds[0] || null;
    var needIds = (c.careNeeds || []).map(function(n){ return n.id; });
    Object.keys(plState.needs).forEach(function(k){ if(needIds.indexOf(k) === -1) delete plState.needs[k]; });

    document.getElementById('plAges').innerHTML = (c.ageBands || []).map(function(b){
      var n = plState.counts[b.id] || 0;
      return '<div class="age-row' + (n > 0 ? ' on' : '') + '"><span class="al">' + esc(b.label) + '</span>' +
        '<span class="stepper">' +
        '<button type="button" data-band="' + esc(b.id) + '" data-delta="-1" aria-label="Fewer ' + esc(b.label) + '">−</button>' +
        '<span class="cnt">' + n + '</span>' +
        '<button type="button" data-band="' + esc(b.id) + '" data-delta="1" aria-label="More ' + esc(b.label) + '">+</button>' +
        '</span></div>';
    }).join('');

    document.getElementById('plTimes').innerHTML = (c.careTimes || []).map(function(t){
      var on = t.id === plState.time;
      return '<button type="button" class="plpill' + (on ? ' on' : '') + '" data-time="' + esc(t.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(t.label) + '</button>';
    }).join('');

    document.getElementById('plNeeds').innerHTML = (c.careNeeds || []).map(function(nd){
      var on = !!plState.needs[nd.id];
      return '<button type="button" class="plpill' + (on ? ' on' : '') + '" data-need="' + esc(nd.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(nd.label) + '</button>';
    }).join('');

    var wrap = document.getElementById('planner');
    if(!wrap._wired){
      wrap._wired = true;
      wrap.addEventListener('click', function(e){
        var st = e.target.closest('[data-band]');
        if(st){
          var id = st.getAttribute('data-band'), d = +st.getAttribute('data-delta');
          plState.counts[id] = Math.max(0, Math.min(4, (plState.counts[id] || 0) + d));
          renderPlannerControls(CONTENT); renderPlan(CONTENT);
          return;
        }
        var tp = e.target.closest('[data-time]');
        if(tp){
          plState.time = tp.getAttribute('data-time');
          renderPlannerControls(CONTENT); renderPlan(CONTENT);
          return;
        }
        var np = e.target.closest('[data-need]');
        if(np){
          var nid = np.getAttribute('data-need');
          plState.needs[nid] = !plState.needs[nid];
          renderPlannerControls(CONTENT); renderPlan(CONTENT);
          return;
        }
        if(e.target.closest('#planCta')) sendPlanToForm();
      });
    }
  }

  function totalKids(){
    return Object.keys(plState.counts).reduce(function(sum, k){ return sum + (plState.counts[k] || 0); }, 0);
  }

  // Softly-shaded moment motif keyed off the (content-driven) slot label — display layer only,
  // the slot/desc DATA still comes from content.json.rundown. Each motif carries a highlight
  // path for depth so the tiles read as illustrated, not flat icons.
  function momentArt(slot){
    var s = (slot || '').toLowerCase();
    var P = '#5B3F86', A = '#E79A3C', H = 'rgba(255,255,255,.55)';
    function g(inner){ return '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">' + inner + '</svg>'; }
    if(/arriv|door|welcome|hand/.test(s)) return g('<path d="M9 27V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v19z" fill="'+P+'"/><path d="M11 6h8a2 2 0 0 1 2 2v2H9V8a2 2 0 0 1 2-2z" fill="'+H+'"/><circle cx="18" cy="17" r="1.5" fill="'+A+'"/>');
    if(/settl|play|block|toy/.test(s)) return g('<rect x="6" y="16" width="9" height="9" rx="1.5" fill="'+P+'"/><rect x="16" y="16" width="9" height="9" rx="1.5" fill="'+A+'"/><rect x="11" y="7" width="9" height="9" rx="1.5" fill="'+P+'"/><rect x="6" y="16" width="9" height="3" fill="'+H+'"/>');
    if(/home ?work|read|book|study/.test(s)) return g('<path d="M6 8c4-2 8-2 10 0v18c-2-2-6-2-10 0z" fill="'+P+'"/><path d="M26 8c-4-2-8-2-10 0v18c2-2 6-2 10 0z" fill="'+A+'"/><path d="M16 8v18" stroke="'+H+'" stroke-width="1"/>');
    if(/dinn|meal|snack|food|eat/.test(s)) return g('<path d="M6 15a10 8 0 0 0 20 0z" fill="'+P+'"/><ellipse cx="16" cy="15" rx="10" ry="2.6" fill="'+A+'"/><path d="M8 14c2-2 6-2 8 0" stroke="'+H+'" stroke-width="1" fill="none"/>');
    if(/tidy|clean|up\b/.test(s)) return g('<path d="M7 13h18l-1.5 12H8.5z" fill="'+P+'"/><path d="M7 13h18l-.4 3H7.4z" fill="'+H+'"/><path d="M11 13c0-3 2-5 5-5s5 2 5 5" stroke="'+A+'" stroke-width="2" fill="none"/>');
    if(/pet|dog|cat|animal/.test(s)) return g('<circle cx="16" cy="20" r="7" fill="'+P+'"/><circle cx="9" cy="12" r="2.4" fill="'+A+'"/><circle cx="23" cy="12" r="2.4" fill="'+A+'"/><circle cx="11" cy="16" r="2.2" fill="'+A+'"/><circle cx="21" cy="16" r="2.2" fill="'+A+'"/>');
    if(/wind|calm|quiet|pajama|bath/.test(s)) return g('<path d="M22 18a8 8 0 1 1-8-11 6 6 0 0 0 8 11z" fill="'+P+'"/><circle cx="12" cy="9" r="1" fill="'+H+'"/>');
    if(/bed|sleep|story|night|light/.test(s)) return g('<path d="M22 18a8 8 0 1 1-8-11 6 6 0 0 0 8 11z" fill="'+P+'"/><path d="M23 8h4l-4 4h4" stroke="'+A+'" stroke-width="1.6" fill="none"/>');
    if(/note|pickup|parent|text|update/.test(s)) return g('<rect x="8" y="6" width="16" height="20" rx="2" fill="'+P+'"/><path d="M11 12h10M11 16h10M11 20h6" stroke="'+H+'" stroke-width="1.5"/><circle cx="23" cy="7" r="3" fill="'+A+'"/>');
    return g('<path d="M16 26S6 19 6 13a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 13-10 13z" fill="'+P+'"/><path d="M11 10a3 3 0 0 1 4 1" stroke="'+H+'" stroke-width="1.4" fill="none"/>');
  }

  function renderPlan(c){
    var body = document.getElementById('planBody');
    var kids = totalKids();
    if(!kids){
      body.innerHTML = '<p class="pl-empty">Add at least one kid on the left and your sample evening appears here.</p>';
      return;
    }
    var time = (c.careTimes || []).filter(function(t){ return t.id === plState.time; })[0] || null;
    var rates = c.rates || [];
    var baseRow = rates[0] || {}, extraRow = rates[1] || {};
    var rate = num(baseRow.rate) + num(extraRow.rate) * (kids - 1) + (time ? num(time.bump) : 0);

    var crew = (c.ageBands || []).filter(function(b){ return (plState.counts[b.id] || 0) > 0; })
      .map(function(b){ return esc(b.label) + ' ×' + plState.counts[b.id]; }).join(', ');

    var steps = (c.rundown || []).filter(function(s){ return !s.need || plState.needs[s.need]; });

    var html = '<div class="est"><span class="num">$' + rate + esc(baseRow.unit || '/hr') + '</span>' +
      '<span class="meta">estimated for ' + kids + (kids === 1 ? ' kid' : ' kids') +
      (time ? ' · ' + esc(time.label).toLowerCase() : '') + '</span></div>' +
      '<p class="est-note">' + crew + '. We confirm the exact rate together before your first booking — every family\'s evening looks a little different.</p>';

    html += '<ul class="tl tl-illus">' + steps.map(function(s, i){
      return '<li class="tl-moment" style="--i:' + i + '">' +
        '<span class="tl-art" aria-hidden="true">' + momentArt(s.slot) + '</span>' +
        '<span class="tl-txt"><span class="slot">' + esc(s.slot) + '</span><p>' + esc(s.desc) + '</p></span></li>';
    }).join('') + '</ul>';

    html += '<p class="pl-cta"><button type="button" class="btn-pri" id="planCta">Request this plan</button></p>';
    body.innerHTML = html;
  }

  function sendPlanToForm(){
    var c = CONTENT, kids = totalKids();
    var time = (c.careTimes || []).filter(function(t){ return t.id === plState.time; })[0];
    var crew = (c.ageBands || []).filter(function(b){ return (plState.counts[b.id] || 0) > 0; })
      .map(function(b){ return b.label + ' ×' + plState.counts[b.id]; }).join(', ');
    var needs = (c.careNeeds || []).filter(function(n){ return plState.needs[n.id]; })
      .map(function(n){ return n.label; }).join(', ');
    var summary = 'From the planner: ' + kids + (kids === 1 ? ' kid' : ' kids') + ' (' + crew + ')' +
      (time ? ' · ' + time.label : '') + (needs ? ' · ' + needs : '');
    document.getElementById('qNotes').value = summary;
    var kidsSel = document.getElementById('qKids');
    kidsSel.value = kids >= 4 ? '4+' : String(kids);
    if(time){
      var whenSel = document.getElementById('qWhen');
      for(var i = 0; i < whenSel.options.length; i++){
        if(whenSel.options[i].value === time.label){ whenSel.selectedIndex = i; break; }
      }
    }
    document.getElementById('book').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    setTimeout(function(){ document.getElementById('qName').focus({ preventScroll: true }); }, reduce ? 0 : 600);
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
    var honey = form.querySelector('[name="_honey"]');
    if(honey && honey.value) return; // honeypot tripped, silently drop

    var name = document.getElementById('qName').value.trim();
    var phone = document.getElementById('qPhone').value.trim();
    if(!name || !phone){
      status.textContent = 'Please fill in your name and phone number.';
      status.classList.add('err');
      return;
    }
    status.textContent = ''; status.classList.remove('err');
    submitBtn.disabled = true; submitBtn.textContent = 'Sending…';

    var payload = {
      name: name, phone: phone,
      city: document.getElementById('qCity').value.trim() || '(not given)',
      kids: document.getElementById('qKids').value,
      when: document.getElementById('qWhen').value,
      notes: document.getElementById('qNotes').value.trim(),
      _subject: CONTENT.brand.name + ' — new request from ' + name,
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
      submitBtn.textContent = 'Request a meet-and-greet';
    });
  });

  /* ---------- boot ---------- */
  /* boot handed to base.js */

  window.renderContent = renderContent;
})();
