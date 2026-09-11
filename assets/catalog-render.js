/* ============================================================================
   SYSTEMS BY VEGA — catalog renderer (shared)
   ----------------------------------------------------------------------------
   ONE renderer, used twice:
     * at build time by tools/build-catalog.js, which writes the finished markup
       straight into index.html, so the catalog is present in the HTML and the
       page is complete with JavaScript disabled or broken;
     * at run time by assets/sbv.js, to re-render when live rows and real
       waiting counts come back from the database.

   It lives in its own file specifically so those two paths cannot drift.

   THE CARD IS THE "OWN YOUR TOWN" PLATE, ported from the multi-niche page in
   the GarageSaleBiz repo (HEAD:niches.html). Every device is carried over:
   the ruled plate surface, two galvanised staples through the top edge, the
   tilted circular sticker, the stamped status pill, the mono index label, the
   dashed divider and the red-arrow CTA row.

   ONE CONSTRAINT SHAPED EVERYTHING ELSE HERE: any field this markup reads must
   also exist on the rows sbv_niches returns, because sbv.js re-renders from
   those rows the moment they arrive. A field that lives only in the JSON seed
   would render once and then vanish on the live overlay. That is why the price
   badge is DERIVED from price_label rather than added as a new seed field —
   no schema change, and nothing to disappear a second later.

   Pure functions: strings in, strings out. No DOM, no fetch, no globals.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBVRender = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Counts render only ABOVE this floor. Mirrors garagesalebiz's
     `if (n <= REG_COUNT_FLOOR) return;` — so the first number a visitor can
     ever see is 4. A count of one or two argues against the exclusivity it is
     meant to evidence, and an invented number would be worse than either. */
  var FLOOR = 3;

  var ARROW = '<svg class="go-arrow" viewBox="0 0 60 30" aria-hidden="true">' +
              '<path d="M2 10h34V2l22 13-22 13v-8H2z"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function host(url) { return String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, ''); }

  function pad3(n) { return ('00' + n).slice(-3); }

  /* The index label: family code + the plate's position in seed order, so the
     board reads N° 001 through N° 029 top to bottom regardless of family. */
  function indexLabel(n, idx) {
    var fam = String(n.catalog_no || '').split('-')[0] || '--';
    return fam + ' · N° ' + pad3(idx);
  }

  /* Price badge, derived — never a second source of truth.
     "$497 + $39/mo · 3 cities" -> $497 / FOUNDING
     "$249 once · 3 cities"     -> $249 / ONE TIME
     A one-time price says "once"; anything else on this catalog is a founding
     rate. Both are read off the same string the card already prints. */
  function badge(n) {
    if (n.status !== 'open' || !n.price_label) return null;
    var m = String(n.price_label).match(/\$[\d,]+/);
    if (!m) return null;
    return { big: m[0], small: /\bonce\b/i.test(n.price_label) ? 'One time' : 'Founding' };
  }

  function statusTok(n) {
    if (n.status === 'open')    return { cls: 'open', text: 'Open now' };
    if (n.status === 'in_line') return { cls: 'wait', text: 'Waitlist' };
    return { cls: 'site', text: 'Website' };
  }

  /* Demo brand name and feature chips. These are NOT database columns and
     must never become ones: they describe the artifact on disk, not the
     product's commercial state. Passed in as a lookup so the runtime
     re-render has them too — a field that lives only in the seed renders
     once and disappears the moment live rows arrive. */
  function extras(n, lookup) {
    var x = (lookup && lookup[n.slug]) || {};
    return (x.brand ? '<p class="card-brand">' + esc(x.brand) + '</p>' : '') +
           (x.chips && x.chips.length
             ? '<p class="card-chips">' + x.chips.map(function (c) {
                 return '<span class="chip-sm">' + esc(c) + '</span>';
               }).join('') + '</p>'
             : '');
  }

  /* "Claim this territory" opens the claim/claim.js modal — slug and name are
     real sbv_niches columns, so this survives the live re-render same as the
     rest of the card. Offered wherever a turnkey site actually exists to buy,
     regardless of whether the underlying business itself is open or in line. */
  function claimBtn(n) {
    if (!n.website_offer || !n.demo_path) return '';
    return '<button type="button" class="card-go claim-btn" data-slug="' + esc(n.slug) +
           '" data-name="' + esc(n.name) + '"><span>Claim this territory</span>' + ARROW + '</button>' +
           '<p class="card-claimed" data-claimed="' + esc(n.slug) + '" hidden></p>';
  }

  function footRow(n, counts) {
    var c = (counts && counts[n.slug]) || {};
    var claim = claimBtn(n);

    if (n.status === 'open') {
      return '<a class="card-go" href="' + esc(n.open_url) + '">' +
               '<span>See the deal</span>' + ARROW +
             '</a>' +
             '<p class="card-note">' + esc(n.price_label || '') +
               ' · ' + esc(host(n.open_url)) + '</p>';
    }

    if (n.status === 'in_line') {
      var count = (typeof c.waiting === 'number' && c.waiting > FLOOR)
        ? '<p class="card-note"><b>' + c.waiting + '</b> in line</p>'
        : '';
      /* .js-line + data-niche are the hooks sbv.js binds to; they prefill the
         registry form with this niche. Unchanged from the previous card. */
      return '<a class="card-go js-line" href="#line" data-niche="' + esc(n.slug) + '">' +
               '<span>Claim a spot</span>' + ARROW +
             '</a>' + count +
             (n.website_offer && n.demo_path
               ? '<a class="card-alt" href="' + esc(n.demo_path) + '">See the site your customers would get</a>' + claim
               : '');
    }

    return (claim || ('<a class="card-go" href="' + esc(n.demo_path || '#websites') + '">' +
             '<span>See the site</span>' + ARROW +
           '</a>')) +
           (claim && n.demo_path
             ? '<a class="card-alt" href="' + esc(n.demo_path) + '">See the site first</a>'
             : '') +
           '<p class="card-note">$299 launch-ready · $499 custom</p>';
  }

  function entry(n, famName, counts, idx, extrasLookup) {
    var tok = statusTok(n);
    var bg  = badge(n);
    var cls = 'entry sheet reveal is-' + n.status.replace(/_/g, '-');

    return '<article class="' + cls + '" data-fam="' + esc(n.family) + '" id="n-' + esc(n.slug) + '">' +
             '<span class="staple l" aria-hidden="true"></span>' +
             '<span class="staple r" aria-hidden="true"></span>' +
             (bg
               ? '<span class="sticker hot" aria-hidden="true"><span class="big">' + esc(bg.big) +
                 '</span><span class="small">' + esc(bg.small) + '</span></span>'
               : (n.status === 'in_line'
                   ? '<span class="sticker soon" aria-hidden="true"><span class="big">Soon</span>' +
                     '<span class="small">Waitlist</span></span>'
                   : '')) +
             '<span class="card-meta">' +
               '<span class="code">' + esc(indexLabel(n, idx)) + '</span>' +
               '<span class="tok ' + tok.cls + '">' + esc(tok.text) + '</span>' +
             '</span>' +
             '<h3>' + esc(n.name) + '</h3>' +
             extras(n, extrasLookup) +
             '<p class="job">' + esc(n.job_line) + '</p>' +
             (n.caveat ? '<p class="caveat">' + esc(n.caveat) + '</p>' : '') +
             '<div class="entry-foot">' + footRow(n, counts) + '</div>' +
           '</article>';
  }

  function catalog(families, niches, counts, extrasLookup) {
    /* Seed order decides the number on the plate, so it is computed once from
       the whole list before anything is grouped by family. */
    var seedIndex = {};
    niches.forEach(function (n, i) { seedIndex[n.slug] = i + 1; });

    return families.map(function (fam) {
      var rows = niches
        .filter(function (n) { return n.family === fam.key; })
        .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      if (!rows.length) return '';

      return '<div class="family" data-fam="' + esc(fam.key) + '" style="--fam:var(--fam-' + esc(fam.key) + ')">' +
               '<div class="plate-head reveal">' +
                 '<span class="plate-no">Plate ' + esc(fam.code) + '</span>' +
                 '<h2 class="plate-title">' + esc(fam.name) + '</h2>' +
               '</div>' +
               '<p class="plate-note">' + esc(fam.note) + '</p>' +
               '<div class="grid">' +
                 rows.map(function (n) { return entry(n, fam.name, counts, seedIndex[n.slug], extrasLookup); }).join('') +
               '</div>' +
             '</div>';
    }).join('');
  }

  /* The landing-page hero rotator. One frame per niche that has a demo, in
     seed order, captured by tools/build-shots.js into assets/shots/rotator/
     under the niche's own slug — so this function and that tool read the same
     list and cannot disagree about which frames exist.

     Only FRAME 1 gets a src here. The other thirty-one are fetched by
     assets/sbv.js, one ahead of the one showing, which is the whole reason
     the hero can carry 32 frames without 32 downloads. That also means the
     no-JS and reduced-motion renderings are this markup exactly as it
     stands: frame 1, its caption, and the full trade list below.

     The chips are the reduced-motion (and no-JS) presentation, revealed by
     CSS. They are CAPPED at CHIP_CAP, with a generated '+N more' link for
     the rest. Printing all thirty-two put a 559px wall of pills in the hero
     at 390px — measured — which pushes the CTAs off the first screen and is
     a worse reduced-motion experience than the animation it stands in for.
     The remainder is stated rather than dropped, its count computed here
     (Ruling R20: a count in this markup is never typed), and the link goes
     to the page that lists every one of them. */
  var CHIP_CAP = 11;
  function heroRotator(niches) {
    var frames = niches.filter(function (n) { return n.demo_path; });
    if (!frames.length) return '';
    var first = frames[0];
    var shot = function (n) { return '/assets/shots/rotator/' + esc(n.slug) + '.jpg'; };

    return '' +
      '<div class="seq" data-rotator role="img" aria-label="The ' + esc(first.name) +
        ' demo storefront.">' +
        '<img class="seq-layer is-on" src="' + shot(first) + '" width="1280" height="800" ' +
             'fetchpriority="high" decoding="async" alt="">' +
        '<img class="seq-layer" width="1280" height="800" decoding="async" alt="">' +
      '</div>' +
      '<div class="seq-cap" data-rotator-cap aria-hidden="true">' +
        '<span class="seq-cap-layer is-on">' + esc(first.name) + '</span>' +
        '<span class="seq-cap-layer"></span>' +
      '</div>' +
      '<div class="seq-steps">' +
        frames.slice(0, CHIP_CAP).map(function (n, i) {
          return '<span class="seq-step' + (i === 0 ? ' is-current' : '') + '">' +
                 esc(n.name) + '</span>';
        }).join('') +
        (frames.length > CHIP_CAP
          ? '<a class="seq-step seq-step-more" href="/sites/">+' +
            (frames.length - CHIP_CAP) + ' more &rarr;</a>'
          : '') +
      '</div>';
  }

  function nicheSelect(niches) {
    var open = [], line = [];
    niches.forEach(function (n) {
      if (n.status === 'in_line') line.push(n);
      else if (n.status === 'open') open.push(n);
    });
    var html = '<option value="">Pick a business…</option>';
    if (line.length) {
      html += '<optgroup label="In line — tell me you want this one">' +
              line.map(function (n) { return '<option value="' + esc(n.slug) + '">' + esc(n.name) + '</option>'; }).join('') +
              '</optgroup>';
    }
    if (open.length) {
      html += '<optgroup label="Open today — go straight to the site">' +
              open.map(function (n) {
                return '<option value="' + esc(n.slug) + '" data-open="' + esc(n.open_url) + '">' + esc(n.name) + '</option>';
              }).join('') +
              '</optgroup>';
    }
    return html;
  }

  /* Every figure the masthead shows, derived from the data. Nothing here is
     ever written into the HTML by hand — that is how the previous homepage
     came to claim nine shipped projects while the portfolio rendered eleven. */
  function figures(niches) {
    var by = function (s) { return niches.filter(function (n) { return n.status === s; }).length; };
    return {
      total:       niches.length,
      open:        by('open'),
      inLine:      by('in_line'),
      websiteOnly: by('website_only'),
      /* Turnkey sites a buyer can actually claim today. Deliberately NOT the
         same as `total`: the board also lists ideas that are only in line and
         the three platforms that are whole businesses rather than websites. */
      sites:       niches.filter(function (n) { return n.website_offer; }).length,
      perCity:     1
    };
  }

  var WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  function numWord(n) { return n < WORDS.length ? WORDS[n] : String(n); }
  function thesisOpen(n) { return numWord(n) + (n === 1 ? ' is open today' : ' are open today'); }

  return {
    FLOOR: FLOOR,
    esc: esc,
    catalog: catalog,
    entry: entry,
    extras: extras,
    nicheSelect: nicheSelect,
    heroRotator: heroRotator,
    figures: figures,
    numWord: numWord,
    thesisOpen: thesisOpen,
    badge: badge,
    indexLabel: indexLabel
  };
}));
