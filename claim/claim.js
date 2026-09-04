/* ============================================================================
   claim/claim.js — the territory claim modal for sites/index.html
   ----------------------------------------------------------------------------
   Loaded from the bottom of the Site Shop. Owns the modal, sign-in, and the
   hand-off to Stripe. sites/index.html keeps only: the config block, the
   vendored SDK, a pair of buttons per card, and the modal's CSS.

   ── THREE PHASES, AND WHY THEY ARE SEPARATE ────────────────────────────────
     1  CHECK    is this city open for this business?
     2  AUTH     who are you?          (skipped entirely if already signed in)
     3  CONFIRM  what exactly, and do you agree?   -> Stripe

   Phase 1 answers live in `intent` for the life of the modal, so returning
   from a sign-in does not lose the city someone just typed. Nothing is written
   to the database before Stripe; the first row is the intake that
   /api/create-checkout parks.

   ── WHAT THIS FILE DOES NOT DECIDE ─────────────────────────────────────────
   Whether a niche is purchasable, whether a city normalises, whether it is
   already claimed: all of that is sbv_city_available() behind
   /api/check-territory. There is no copy of the gate here, and no city
   normaliser — sbv_norm_city() in the database is the only one, and a second
   implementation that drifts by a single abbreviation would let a taken city
   read as free and fail after the card was charged.

   ── THE SDK IS FOR AUTH ONLY ───────────────────────────────────────────────
   supabase-js is vendored at /assets/vendor/ and used for signInWithPassword,
   signUp, getSession and signOut. Everything else — availability, counts,
   acceptance, checkout — is plain fetch, matching assets/sbv.js. The SDK
   derives its storage key as sb-<project-ref>-auth-token, which is the same
   key claim/thank-you.html writes by hand, so a buyer signed in on either page
   is signed in on the other.
   ========================================================================= */
(function () {
  'use strict';

  /* Both key shapes are read on purpose. sites/index.html uses the explicit
     supabaseUrl / supabaseAnonKey names; index.html and claim/thank-you.html
     already ship the shorter url / key. Reading either means one config object
     works on every page and nothing has to be renamed in a file that is
     already live. Nothing is hardcoded here. */
  var RAW = window.SBV_CONFIG || {};
  var CFG = {
    url: RAW.supabaseUrl || RAW.url || '',
    key: RAW.supabaseAnonKey || RAW.key || ''
  };
  if (!CFG.url || !CFG.key) {
    console.error('claim.js: SBV_CONFIG needs supabaseUrl + supabaseAnonKey ' +
                  '(or url + key). Claim disabled.');
    return;
  }

  /* ------------------------------------------------------------------ state */

  var sb = null;              /* supabase client, created on first use      */
  var modal = null;           /* the one modal element, injected once       */
  var lastFocus = null;       /* restored when the modal closes             */
  var acceptance = null;      /* { version, text } from /api/acceptance     */
  var intent = null;          /* what the buyer has told us so far          */

  function resetIntent(slug, name) {
    intent = {
      niche: slug, nicheName: name,
      city: '', state: '', cityNorm: '',
      tier: 'launch', business: '', clientId: ''
    };
  }

  /* 50 states + DC. Deliberately a fixed list rather than anything derived:
     the territory key is (niche, city, state), so a typo here becomes a
     territory nobody can ever buy. */
  var STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
    'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
    'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
    'VT','VA','WA','WV','WI','WY'
  ];

  /* Buyer-facing text for every way the check can say no. An unmapped reason
     falls back to the generic line rather than leaking an internal token. */
  var WHY = {
    claimed:            'is already claimed for this business.',
    niche_not_for_sale: 'is not something we sell right now.',
    unrecognised_city:  'could not be read as a city. Try it without punctuation.',
    bad_state:          'needs a state.',
    incomplete:         'needs both a city and a state.'
  };

  /* -------------------------------------------------------------- utilities */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || modal).querySelector(sel); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* Mirrors the client_id CHECK on sbv_tenants. A buyer typing "Static Rose"
     gets static-rose rather than a validation error about hyphens. */
  function slugify(s) {
    return String(s || '').toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40).replace(/-+$/g, '');
  }

  function client() {
    if (sb) return sb;
    if (!window.supabase || !window.supabase.createClient) return null;
    sb = window.supabase.createClient(CFG.url, CFG.key);
    return sb;
  }

  /* --------------------------------------------------------------- the shell */

  /* Injected rather than written into sites/index.html: that page is
     hand-maintained and 1,200 lines already. The CSS lives there; this is the
     markup it styles. */
  function build() {
    var opts = STATES.map(function (s) {
      return '<option value="' + s + '">' + s + '</option>';
    }).join('');

    var el = document.createElement('div');
    el.className = 'cm-back';
    el.id = 'claimModal';
    el.setAttribute('hidden', '');
    el.innerHTML =
      '<div class="cm" role="dialog" aria-modal="true" aria-labelledby="cmTitle">' +
        '<button type="button" class="cm-x" id="cmClose" aria-label="Close">&times;</button>' +
        '<p class="cm-step" id="cmStep">Step 1 of 3</p>' +
        '<h2 class="cm-title" id="cmTitle">Check your city</h2>' +

        /* ---- phase 1 ---- */
        '<div class="cm-phase" data-phase="check">' +
          '<p class="cm-lead" id="cmLead"></p>' +
          '<div class="cm-row">' +
            '<label class="cm-f"><span>City</span>' +
              '<input type="text" id="cmCity" autocomplete="address-level2" placeholder="Boise"></label>' +
            '<label class="cm-f cm-f-sm"><span>State</span>' +
              '<select id="cmState"><option value="">--</option>' + opts + '</select></label>' +
          '</div>' +
          '<p class="cm-msg" id="cmCheckMsg" role="status"></p>' +
          '<button type="button" class="cm-go" id="cmCheck">Check availability</button>' +
        '</div>' +

        /* ---- phase 2 ---- */
        '<div class="cm-phase" data-phase="auth" hidden>' +
          '<p class="cm-lead">Territories are held against an account, so this' +
            ' step comes before payment.</p>' +
          '<div class="cm-tabs">' +
            '<button type="button" class="cm-tab on" data-mode="in">Sign in</button>' +
            '<button type="button" class="cm-tab" data-mode="up">Create account</button>' +
          '</div>' +
          '<label class="cm-f"><span>Email</span>' +
            '<input type="email" id="cmEmail" autocomplete="email"></label>' +
          '<label class="cm-f"><span>Password</span>' +
            '<input type="password" id="cmPass" autocomplete="current-password"></label>' +
          '<p class="cm-msg" id="cmAuthMsg" role="alert"></p>' +
          '<button type="button" class="cm-go" id="cmAuthGo">Sign in</button>' +
        '</div>' +

        /* ---- phase 3 ---- */
        '<div class="cm-phase" data-phase="confirm" hidden>' +
          '<p class="cm-ok" id="cmOk"></p>' +
          '<fieldset class="cm-tiers">' +
            '<legend>Package</legend>' +
            '<label><input type="radio" name="cmTier" value="launch" checked>' +
              '<b>$299</b> launch-ready</label>' +
            '<label><input type="radio" name="cmTier" value="custom">' +
              '<b>$499</b> custom launch</label>' +
          '</fieldset>' +
          '<label class="cm-f"><span>Business name</span>' +
            /* autocomplete off: Chrome otherwise fills this from the saved
               contact profile right after the phase-2 credentials autofill,
               and the buyer is naming a NEW business, not their account. */
            '<input type="text" id="cmBiz" maxlength="120" autocomplete="off"></label>' +
          '<label class="cm-f"><span>Web address</span>' +
            '<span class="cm-sub"><input type="text" id="cmSlug" maxlength="40" autocomplete="off">' +
              '<em>.systemsbyvega.com</em></span></label>' +
          '<p class="cm-hint">Your site&rsquo;s temporary address. You can connect' +
            ' your own domain later.</p>' +
          '<div class="cm-terms" id="cmTerms" tabindex="0" aria-label="Terms"></div>' +
          '<label class="cm-accept"><input type="checkbox" id="cmAccept">' +
            '<span>I have read and agree to the above.</span></label>' +
          '<p class="cm-msg" id="cmConfirmMsg" role="alert"></p>' +
          '<button type="button" class="cm-go" id="cmClaim" disabled>Claim this territory</button>' +
          '<p class="cm-fine">You will be taken to Stripe to pay. Nothing is' +
            ' claimed until the payment clears.</p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);
    modal = el;
    wire();
  }

  /* ---------------------------------------------------------------- phases */

  function phase(name) {
    var all = modal.querySelectorAll('.cm-phase');
    for (var i = 0; i < all.length; i++) {
      all[i].hidden = all[i].getAttribute('data-phase') !== name;
    }
    var n = { check: 1, auth: 2, confirm: 3 }[name];
    $('#cmStep').textContent = 'Step ' + n + ' of 3';
    $('#cmTitle').textContent =
      name === 'check' ? 'Check your city'
      : name === 'auth' ? 'Sign in to continue'
      : 'Confirm your territory';
    var first = modal.querySelector('.cm-phase:not([hidden]) input, .cm-phase:not([hidden]) button');
    if (first) first.focus();
  }

  /* ---- phase 1: availability -------------------------------------------- */

  function doCheck() {
    var city = $('#cmCity').value.trim();
    var state = $('#cmState').value;
    var msg = $('#cmCheckMsg');
    var btn = $('#cmCheck');
    msg.className = 'cm-msg';

    if (city.length < 2) { msg.textContent = 'Type the city you want.'; msg.className = 'cm-msg bad'; return; }
    if (!state) { msg.textContent = 'Choose a state.'; msg.className = 'cm-msg bad'; return; }

    btn.disabled = true; btn.textContent = 'Checking…';
    msg.textContent = '';

    fetch('/api/check-territory?niche=' + encodeURIComponent(intent.niche)
          + '&city=' + encodeURIComponent(city)
          + '&state=' + encodeURIComponent(state))
      .then(function (r) {
        return r.json().catch(function () { return {}; })
          .then(function (b) { return { status: r.status, body: b }; });
      })
      .then(function (out) {
        btn.disabled = false; btn.textContent = 'Check availability';
        var b = out.body || {};

        if (out.status === 429) { msg.textContent = b.message || 'Too many checks. Wait a minute.'; msg.className = 'cm-msg bad'; return; }
        if (!b.ok) { msg.textContent = b.message || 'We could not check that just now. Try again in a moment.'; msg.className = 'cm-msg bad'; return; }

        var where = esc(b.city_label) + ', ' + esc(b.state_code);

        if (!b.available) {
          /* city_norm is shown ONLY here, and only to explain a "no" to
             somebody who spelled it differently — "St. Charles" matching an
             existing "Saint Charles" looks arbitrary without it. It is never
             used for comparison; the database owns that. */
          var norm = (b.reason === 'claimed' && b.city_norm
            && b.city_norm !== String(b.city_label).toLowerCase())
            ? ' <span class="cm-norm">(matched to &ldquo;' + esc(b.city_norm) + '&rdquo;)</span>'
            : '';
          msg.innerHTML = '<b>' + where + '</b> ' + (WHY[b.reason] || WHY.claimed) + norm;
          msg.className = 'cm-msg bad';
          return;
        }

        intent.city = b.city_label;
        intent.state = b.state_code;
        intent.cityNorm = b.city_norm || '';
        next();
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Check availability';
        msg.textContent = 'We could not reach our server. Try again in a moment.';
        msg.className = 'cm-msg bad';
      });
  }

  /* Where phase 1 hands off to: straight past auth if there is a session. */
  function next() {
    var c = client();
    if (!c) { toConfirm(); return; }      /* SDK missing — handled at claim */
    c.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (s && s.access_token) { paintAuth(s.user); toConfirm(); }
      else phase('auth');
    }).catch(function () { phase('auth'); });
  }

  /* ---- phase 2: auth ----------------------------------------------------- */

  var authMode = 'in';

  function doAuth() {
    var c = client();
    var msg = $('#cmAuthMsg');
    var btn = $('#cmAuthGo');
    msg.textContent = '';

    if (!c) {
      msg.textContent = 'Sign-in could not load. Reload the page, or email info@kingdom-creatives.com.';
      return;
    }

    var email = $('#cmEmail').value.trim();
    var pass = $('#cmPass').value;
    if (!email || !pass) { msg.textContent = 'Email and password, please.'; return; }
    if (authMode === 'up' && pass.length < 8) {
      msg.textContent = 'Use at least 8 characters.'; return;
    }

    btn.disabled = true;
    btn.textContent = authMode === 'in' ? 'Signing in…' : 'Creating…';

    /* Logged on purpose, and kept. It answers the one question that is
       otherwise unanswerable from outside: what THIS browser actually sent.
       A stale cached claim.js sends nothing here; a correct one prints the
       redirect. What Supabase then DOES with the value is a separate question
       — see the Network tab entry for /auth/v1/signup. */
    var redirectTo = location.origin + '/sites/?confirmed=1';
    if (authMode === 'up') console.log('[claim] signUp emailRedirectTo =', redirectTo);

    /* Sign-UP only, and only here. Saving on every availability check would
       ambush a buyer who looked at a city once and wandered off with a modal
       on some unrelated later visit. */
    if (authMode === 'up') savePending();

    var p = authMode === 'in'
      ? c.auth.signInWithPassword({ email: email, password: pass })
      : c.auth.signUp({
          email: email,
          password: pass,
          /* PER-CALL, not the project Site URL. Changing that global would send
             password resets and every future auth email here too.
             MUST be allowlisted under Authentication -> URL Configuration ->
             Redirect URLs (with a ** suffix, or the query string will not
             match), otherwise Supabase silently falls back to the Site URL and
             this line does nothing at all.
             location.origin so preview and production each return to
             themselves rather than one hardcoded host. */
          options: { emailRedirectTo: redirectTo }
        });

    p.then(function (res) {
      btn.disabled = false;
      btn.textContent = authMode === 'in' ? 'Sign in' : 'Create account';

      if (res.error) {
        /* Deliberately not "no account with that email" — that confirms which
           addresses exist to anyone who asks. */
        msg.textContent = authMode === 'in'
          ? 'That email and password did not match. Try again.'
          : (res.error.message || 'We could not create that account.');
        return;
      }
      var s = res.data && res.data.session;
      if (!s) {
        /* Sign-up with confirmations on returns a user and no session. The
           buyer does NOT have to come back and sign in: the confirmation link
           establishes the session, and savePending() above means the modal
           reopens on the city they already chose. The old wording — "then sign
           in here" — described the flow before resumeClaim() existed, and sent
           people hunting for a step that no longer exists.

           The tab still flips to Sign in, as the fallback for somebody who
           confirms in a different browser and comes back to this tab by hand.

           No promise that the city is held. Nothing is written before Stripe
           and resumeClaim() re-checks on return, so "reserved" would be a
           claim the system does not honour. */
        msg.textContent = 'Check your email — the link brings you straight back '
          + 'here to finish. Nothing is reserved until payment, so confirm soon.';
        authMode = 'in'; paintTabs();
        return;
      }
      paintAuth(s.user);
      toConfirm();
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = authMode === 'in' ? 'Sign in' : 'Create account';
      msg.textContent = 'We could not reach the sign-in server. Try again in a moment.';
    });
  }

  function paintTabs() {
    var tabs = modal.querySelectorAll('.cm-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('on', tabs[i].getAttribute('data-mode') === authMode);
    }
    $('#cmAuthGo').textContent = authMode === 'in' ? 'Sign in' : 'Create account';
    $('#cmPass').setAttribute('autocomplete', authMode === 'in' ? 'current-password' : 'new-password');
  }

  /* ---- phase 3: confirm -------------------------------------------------- */

  function toConfirm() {
    $('#cmOk').innerHTML = '<b>' + esc(intent.city) + ', ' + esc(intent.state)
      + '</b> is available for ' + esc(intent.nicheName) + '.';
    if (!$('#cmBiz').value) $('#cmBiz').value = '';
    phase('confirm');
    loadTerms();
  }

  function loadTerms() {
    var box = $('#cmTerms');
    var check = $('#cmAccept');
    var claim = $('#cmClaim');

    if (acceptance) { box.textContent = acceptance.text; return; }

    box.textContent = 'Loading terms…';
    check.disabled = true;

    fetch('/api/acceptance')
      .then(function (r) { return r.json(); })
      .then(function (b) {
        if (!b.ok || !b.text) throw new Error('bad');
        acceptance = { version: b.version, text: b.text };
        box.textContent = b.text;
        check.disabled = false;
      })
      .catch(function () {
        /* Refuse rather than showing terms we cannot prove. A ticked box
           against text we failed to load is worth nothing. */
        box.textContent = 'We could not load the terms just now. Reload the page and try again.';
        check.disabled = true;
        claim.disabled = true;
      });
  }

  function doClaim() {
    var msg = $('#cmConfirmMsg');
    var btn = $('#cmClaim');
    msg.textContent = '';

    var biz = $('#cmBiz').value.trim();
    var slug = slugify($('#cmSlug').value || biz);
    if (biz.length < 2) { msg.textContent = 'Give your business a name.'; return; }
    if (slug.length < 3) { msg.textContent = 'Your web address needs at least 3 letters or numbers.'; return; }
    if (!acceptance) { msg.textContent = 'The terms did not load. Reload the page.'; return; }

    var tier = (modal.querySelector('input[name="cmTier"]:checked') || {}).value || 'launch';
    var c = client();
    if (!c) { msg.textContent = 'Sign-in could not load. Reload the page.'; return; }

    btn.disabled = true; btn.textContent = 'Opening checkout…';

    c.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (!s || !s.access_token) { phase('auth'); btn.disabled = false; btn.textContent = 'Claim this territory'; return; }

      return fetch('/api/create-checkout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche_slug: intent.niche, tier: tier, client_id: slug,
          business_name: biz, city_label: intent.city, state_code: intent.state,
          acceptance_version: acceptance.version
        })
      }).then(function (r) {
        return r.json().catch(function () { return {}; })
          .then(function (b) { return { status: r.status, body: b }; });
      }).then(function (out) {
        var b = out.body || {};
        if (b.ok && b.url) { window.location.href = b.url; return; }
        btn.disabled = false; btn.textContent = 'Claim this territory';
        /* 409 means the city went while they were filling this in — send them
           back to phase 1 rather than leaving them staring at a dead button. */
        if (out.status === 409) { msg.textContent = b.message || 'That city was just claimed. Try another.'; phase('check'); return; }
        msg.textContent = b.message || 'We could not open checkout. Try again in a moment.';
      });
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Claim this territory';
      msg.textContent = 'We could not reach our server. Try again in a moment.';
    });
  }

  /* ------------------------------------------------------------- open/close */

  function open(slug, name) {
    if (!modal) build();
    resetIntent(slug, name);
    lastFocus = document.activeElement;
    $('#cmLead').textContent = name + ' — one operator per city. Check whether yours is open.';
    $('#cmCity').value = ''; $('#cmState').value = '';
    /* Phase 3 resets too: without this, a name typed in an earlier abandoned
       claim reappears on the next open, which reads as "we pre-filled it".
       The touched flag resets with it so the name→slug auto-fill re-arms. */
    $('#cmBiz').value = ''; $('#cmSlug').value = '';
    delete $('#cmSlug').dataset.touched;
    $('#cmCheckMsg').textContent = ''; $('#cmCheckMsg').className = 'cm-msg';
    $('#cmAuthMsg').textContent = ''; $('#cmConfirmMsg').textContent = '';
    $('#cmAccept').checked = false; $('#cmClaim').disabled = true;
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    phase('check');
  }

  function close() {
    if (!modal) return;
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* Keyboard: Esc closes, Tab cycles inside. Without the trap, tabbing walks
     out of a dialog that visually covers the page. */
  function trap(ev) {
    if (ev.key === 'Escape') { close(); return; }
    if (ev.key !== 'Tab') return;
    var f = modal.querySelectorAll(
      '.cm-phase:not([hidden]) input, .cm-phase:not([hidden]) select,' +
      '.cm-phase:not([hidden]) button, .cm-x, .cm-terms');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }

  function wire() {
    on($('#cmClose'), 'click', close);
    on(modal, 'click', function (e) { if (e.target === modal) close(); });
    on(modal, 'keydown', trap);
    on($('#cmCheck'), 'click', doCheck);
    on($('#cmCity'), 'keydown', function (e) { if (e.key === 'Enter') doCheck(); });
    on($('#cmAuthGo'), 'click', doAuth);
    on($('#cmPass'), 'keydown', function (e) { if (e.key === 'Enter') doAuth(); });
    on($('#cmClaim'), 'click', doClaim);
    on($('#cmAccept'), 'change', function () { $('#cmClaim').disabled = !this.checked; });
    on($('#cmBiz'), 'input', function () {
      if (!$('#cmSlug').dataset.touched) $('#cmSlug').value = slugify(this.value);
    });
    on($('#cmSlug'), 'input', function () { this.dataset.touched = '1'; });
    var tabs = modal.querySelectorAll('.cm-tab');
    for (var i = 0; i < tabs.length; i++) {
      on(tabs[i], 'click', function () { authMode = this.getAttribute('data-mode'); paintTabs(); });
    }
  }

  /* ------------------------------------------------------------------- nav */

  function paintAuth(user) {
    var box = document.getElementById('navAuth');
    var mail = document.getElementById('navEmail');
    if (!box || !mail || !user) return;
    mail.textContent = user.email || '';
    box.hidden = false;
  }

  function initNav() {
    var c = client();
    if (!c) return;
    c.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (s && s.user) paintAuth(s.user);
    }).catch(function () { /* signed out is the default */ });

    var out = document.getElementById('navSignOut');
    on(out, 'click', function () {
      var cc = client();
      if (!cc) return;
      cc.auth.signOut().then(function () {
        var box = document.getElementById('navAuth');
        if (box) box.hidden = true;
      });
    });
  }

  /* ------------------------------------------------- pending claim (resume) */

  /* What the buyer was claiming when they left for their inbox, so the modal
     can come back to phase 3 instead of an empty form.

     localStorage, not sessionStorage: the confirmation link opens a NEW TAB
     from the mail client, and sessionStorage does not cross that boundary. It
     would work when you paste the link into the same tab and do nothing at all
     for every real buyer — a failure that looks like a pass in testing.

     Two properties make it behave like session state anyway: the TTL below,
     and the fact that the record is DELETED the moment it is read. A refresh,
     a back button, or a visit next week cannot replay it. */
  var PENDING_KEY = 'sbv.claim.pending';
  var PENDING_TTL = 60 * 60 * 1000;   /* an inbox trip, not a shopping cart */

  function savePending() {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({
        v: 1,
        niche_slug: intent.niche,
        niche_name: intent.nicheName,
        city_label: intent.city,
        state_code: intent.state,
        /* Always 'launch' today: the tier radio lives in phase 3 and the buyer
           has not reached it yet. Stored so the restore pre-selects whatever
           resetIntent defaulted to, and so this keeps working unchanged if the
           choice ever moves earlier. Do not read it as a preference. */
        tier: intent.tier,
        city_norm: intent.cityNorm,
        saved_at: Date.now()
      }));
    } catch (e) { /* private mode, or quota. The claim still works, unresumed. */ }
  }

  /* Reads AND clears in one call: no path wants to look without consuming. */
  function takePending() {
    var raw = null;
    try {
      raw = localStorage.getItem(PENDING_KEY);
      localStorage.removeItem(PENDING_KEY);
    } catch (e) { return null; }
    if (!raw) return null;

    var p;
    try { p = JSON.parse(raw); } catch (e) { return null; }

    /* v guards a future shape change: a record written by an older claim.js is
       discarded whole rather than half-restored into a screen that takes a
       payment. Same reason the city fields are checked and not defaulted. */
    if (!p || p.v !== 1 || !p.niche_slug || !p.city_label || !p.state_code) return null;
    if (!p.saved_at || (Date.now() - p.saved_at) > PENDING_TTL) return null;
    return p;
  }

  /* Both arrival shapes count. The catalog is normally reached as
     /sites/?confirmed=1, but index.html's fallback button hands the raw auth
     fragment over instead — gated on the query string alone, neither the
     banner nor the resume would fire on that path. */
  function arrivedFromConfirm() {
    var params = new URLSearchParams(location.search);
    if (params.get('confirmed') === '1') return true;
    /* PKCE hands the code back on the query string instead of putting tokens in
       the fragment. Not this project's flow today — the vendored build ships
       flowType implicit — but index.html forwards that shape too now, and a
       forwarded arrival that nothing recognises is worse than no forward. */
    if (params.get('code')) return true;
    var h = location.hash || '';
    return h.indexOf('type=signup') !== -1 || h.indexOf('access_token') !== -1;
  }

  function resumeClaim() {
    var p = takePending();
    if (!p) return;

    open(p.niche_slug, p.niche_name);

    /* The stored city goes into the phase 1 INPUTS rather than straight into
       intent, because doCheck() reads from those inputs. That single choice
       means the re-check, the taken-city wording, the 429 path and the hand-off
       to phase 3 are all the code that already exists rather than a second copy
       of it drifting out of step. cityNorm and tier are set directly because
       doCheck does not touch either until the server answers. */
    $('#cmCity').value = p.city_label;
    $('#cmState').value = p.state_code;
    intent.cityNorm = p.city_norm || '';
    intent.tier = p.tier || 'launch';
    var radio = modal.querySelector('input[name="cmTier"][value="' + intent.tier + '"]');
    if (radio) radio.checked = true;

    /* The city was open when they left for their inbox. That was minutes or
       hours ago and somebody else may have taken it since, so the stored yes is
       re-verified rather than trusted: a stale one reaching the pay button
       comes back as a 409 AFTER the form is filled in, which is the failure
       GarageSaleBiz's create-checkout header records as the direct cause of
       every paid-but-blocked operator on EstateSaleBiz.

       doCheck's own next() then skips phase 2 when the session is live and
       stops there when it is not, and its failure paths leave the buyer on
       phase 1 with the city already filled in — one click, not a retype. */
    doCheck();
  }

  /* ------------------------------------------------------- confirmed banner */

  /* Shown once, when the email-confirmation link lands back here. The buyer has
     just been bounced out to their inbox and back, and without this the page is
     identical to the one they left — nothing marks that anything happened.

     resumeClaim() reopens the claim itself; this only explains why a modal
     appeared. It still runs when there is nothing to resume — an expired
     record, a different browser — and then it is the whole of the feedback.

     The query string is stripped with replaceState so a refresh, a back
     button, or a shared link cannot replay it. */
  function confirmedBanner(confirmed) {
    if (!confirmed) return;
    var params = new URLSearchParams(location.search);

    var el = document.createElement('div');
    el.className = 'cb';
    /* status, not alert: this is a confirmation, and alert interrupts a screen
       reader mid-sentence for something that is only good news. */
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<span class="cb-tick" aria-hidden="true">&#10003;</span>' +
      '<span class="cb-text"><b>Email confirmed</b> &mdash; you can now claim a territory.</span>' +
      '<button type="button" class="cb-x" aria-label="Dismiss">&times;</button>';
    document.body.appendChild(el);

    var gone = false;
    function dismiss() {
      if (gone) return;
      gone = true;
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 260);
    }
    on(el, 'click', dismiss);
    setTimeout(dismiss, 5000);

    params.delete('confirmed');
    var qs = params.toString();
    history.replaceState({}, '', location.pathname + (qs ? '?' + qs : ''));
  }

  /* ---------------------------------------------------------------- counts */

  /* Optimistic and silent (D-17): paint whatever arrives, and if the call is
     slow or fails the badges simply never appear. Nothing here blocks the page.

     The >3 floor is enforced IN SQL — sbv_claim_counts() returns null below it
     — so this does not re-implement the rule. A count of 1, 2 or 3 arrives as
     null and renders nothing. */
  function loadCounts() {
    fetch(CFG.url + '/rest/v1/rpc/sbv_claim_counts', {
      method: 'POST',
      headers: { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key,
                 'Content-Type': 'application/json' },
      body: '{}'
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!rows || !rows.length) return;
        rows.forEach(function (row) {
          if (typeof row.claimed !== 'number' || row.claimed <= 0) return;
          var el = document.querySelector('[data-claimed="' + row.niche_slug + '"]');
          if (!el) return;
          el.textContent = row.claimed + (row.claimed === 1 ? ' market claimed' : ' markets claimed');
          el.hidden = false;
        });
      })
      .catch(function () { /* silent by design */ });
  }

  /* ------------------------------------------------------------------ boot */

  /* ONE ENTRY POINT. sites/index.html calls window.initClaim() and nothing
     else; there is no auto-boot on DOMContentLoaded. That means this file can
     be loaded on a page that does not want it without binding anything, and
     the page controls the moment of wiring rather than racing the parser.

     Idempotent: calling it twice re-binds nothing and rebuilds nothing. */
  var started = false;

  function initClaim() {
    if (started) return;
    started = true;

    /* FIRST, before initNav(). That calls client() synchronously, and
       createClient consumes the URL fragment on construction — so by the time
       it returns, the #…type=signup half of arrivedFromConfirm() is already
       gone. Read once here and pass the answer down; confirmedBanner() then
       strips ?confirmed=1, which would take the other half out from under
       whichever of the two ran second. */
    var confirmed = arrivedFromConfirm();

    var btns = document.querySelectorAll('.claim-btn');
    for (var i = 0; i < btns.length; i++) {
      on(btns[i], 'click', function () {
        open(this.getAttribute('data-slug'), this.getAttribute('data-name'));
      });
    }
    initNav();
    if (confirmed) resumeClaim();
    confirmedBanner(confirmed);
    loadCounts();
  }

  window.initClaim = initClaim;
})();
