/* _template/legal/legal.js
   Overlays the operator's saved details onto the generated legal page.

   Same mechanism the storefront uses: the build stamps the niche's demo
   values into the markup, and this fetches content.json RELATIVE so the one
   file works in both places. On the demo (/sites/<slug>/terms.html) that
   resolves to the niche's own content.json; on a tenant subdomain the page is
   served at /terms, so it resolves to /content.json, which middleware.js
   sends to /api/operator-content. Neither case needs to know which it is in.

   If the fetch fails the page keeps the stamped defaults, which is the same
   fail-open behaviour as base.js. A legal page that renders the wrong
   business name is bad; one that renders nothing is worse. */
(function () {
  'use strict';

  var set = function (sel, value) {
    if (value === null || value === undefined || String(value).trim() === '') return;
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = String(value);
  };

  var attr = function (sel, name, value) {
    if (!value) return;
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) nodes[i].setAttribute(name, value);
  };

  /* Which document this is, so we pick the matching custom-clause field. */
  var doc = document.documentElement.getAttribute('data-legal-doc') === 'privacy'
    ? 'privacyCustom' : 'termsCustom';

  fetch('content.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (c) {
      if (!c) return;
      var brand = c.brand || {};

      set('[data-lg-name]',  brand.name);
      set('[data-lg-phone]', brand.phone);
      set('[data-lg-email]', brand.email);
      set('[data-lg-city]',  brand.city);

      /* tel: needs the digits, not the display formatting. */
      if (brand.phone) attr('[data-lg-tel]', 'href', 'tel:' + String(brand.phone).replace(/[^\d+]/g, ''));
      if (brand.email) attr('[data-lg-mailto]', 'href', 'mailto:' + brand.email);

      /* Operator-added clauses. textContent, never innerHTML — this is
         operator-supplied text arriving over the network, and the CSS carries
         white-space:pre-wrap so their line breaks survive without markup. */
      var extra = (c.legal || {})[doc];
      if (extra && String(extra).trim() !== '') {
        var body = document.querySelector('[data-lg-custom-body]');
        var wrap = document.querySelector('[data-lg-custom]');
        if (body && wrap) {
          body.textContent = String(extra);
          wrap.removeAttribute('hidden');
        }
      }
    })
    .catch(function () { /* keep the stamped defaults */ });
}());
