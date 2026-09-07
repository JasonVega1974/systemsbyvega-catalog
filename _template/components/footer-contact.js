/* _template/components/footer-contact.js
   Hours + address + social row for the footer. Fed from c.contact.hours,
   c.contact.address, c.contact.postal, c.brand.city/state and c.social.
   Escaping standard for this build: DOM-property assignment for every sink
   (textContent / element properties), never innerHTML or string
   concatenation into markup -- so this file, unlike bin-cleaning's
   hand-written footSocial (innerHTML + esc()), builds each link node with
   createElement and sets .href/.rel/.target/.textContent directly. */
(function () {
  'use strict';

  /* Same scheme gate bin-cleaning's footSocial uses, done again here rather
     than trusted from upstream: entity-encoding on a value cannot stop a
     scheme, and a manifest/content change is not a security boundary. */
  function isHttps(url) { return /^https:\/\//i.test(String(url || '')); }
  function safeUrl(u) { return String(u || '').replace(/["\\)]/g, ''); }

  function setLine(el, text) {
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  function initFooterContact(c) {
    var hoursEl = document.getElementById('fcHours');
    var addrEl = document.getElementById('fcAddress');
    var socEl = document.getElementById('fcSocial');
    if (!hoursEl && !addrEl && !socEl) return; // no slot on this page

    var contact = (c && c.contact) || {};
    var brand = (c && c.brand) || {};
    var social = (c && c.social) || [];

    setLine(hoursEl, contact.hours);

    /* city/state/postal are only shown as the TAIL of a real street address --
       brand.city alone (with no contact.address) is not an address, and most
       niches already surface it elsewhere (e.g. a "Serving <city>" line), so
       showing it here on its own would not be the empty-renders-nothing state
       this component promises. */
    var fullAddress = '';
    if (contact.address) {
      // brand.state is read here for completeness, but no real content.json in
      // this codebase ever sets it: operator-content.mjs already composes a
      // combined "City, ST" string into brand.city (Task 5/6 audit), so
      // brand.state is dead weight on every current pipeline, not a bug in
      // this component.
      var cityState = [brand.city, brand.state].filter(Boolean).join(', ');
      var tail = [cityState, contact.postal].filter(Boolean).join(' ');
      fullAddress = [contact.address, tail].filter(Boolean).join(', ');
    }
    setLine(addrEl, fullAddress);

    if (socEl) {
      var links = social.filter(function (s) { return s && isHttps(s.url); });
      while (socEl.firstChild) socEl.removeChild(socEl.firstChild);
      links.forEach(function (s, i) {
        if (i) socEl.appendChild(document.createTextNode(' \u00b7 '));
        var a = document.createElement('a');
        a.href = safeUrl(s.url);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = s.label || s.n || s.url;
        socEl.appendChild(a);
      });
      socEl.hidden = !links.length;
    }
  }

  if (window.SLComponents && typeof window.SLComponents.register === 'function') {
    window.SLComponents.register(initFooterContact);
  }
})();
