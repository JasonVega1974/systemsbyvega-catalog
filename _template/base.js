/* _template/base.js — utilities and the content lifecycle.
   Shared by every niche. Niche-specific rendering lives in niches/<slug>/niche.js,
   which must define window.renderContent(CONTENT). */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
  function telDigits(p) { return String(p || '').replace(/[^0-9+]/g, ''); }
  function telHref(p) { return 'tel:' + telDigits(p); }
  function smsHref(p, body) { return 'sms:' + telDigits(p) + '?&body=' + encodeURIComponent(body || ''); }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  /* reveal-on-scroll. Under reduced motion everything is revealed at once. */
  function initReveal() {
    var els = [].slice.call(document.querySelectorAll('.reveal'));
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* Form POST. Returns a promise; the niche decides what to render on success. */
  function postForm(endpoint, payload) {
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; });
  }

  /* Consent gate (§9.3).
     Runs in the CAPTURE phase, ahead of the niche's own submit handler, so a
     checkbox the BUILD injected is enforced even though that niche's JS knows
     nothing about it.

     It does NOT stopPropagation: the niche handler still runs and sets its own
     message if it has one. We only supply wording when nobody else did, checked
     on the next tick — so the 8 sites that already gate keep their own copy and
     the injected sites get a sensible default. Enforcement is uniform; wording
     is not overridden. */
  function consentGate(e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var box = form.querySelector('input[type="checkbox"][id$="consent"]');
    if (!box || box.checked) return;

    e.preventDefault();
    box.focus();

    var msg = form.querySelector('[id$="Msg"]');
    var before = msg ? msg.textContent : null;
    setTimeout(function () {
      if (!msg || msg.textContent !== before) return;   // the niche spoke first
      msg.textContent = 'Please tick the consent box so we can reply to you.';
      if (msg.className.indexOf('err') < 0) msg.className += ' err';
    }, 0);
  }
  document.addEventListener('submit', consentGate, true);

  /* -- lead capture ---------------------------------------------------------
     Records the enquiry in the operator's lead list as well as emailing it.

     ONE implementation here rather than one per niche. base.js already sees
     every submit on every niche through consentGate, so a niche gets this by
     existing rather than by being edited, and there is no chance of 32 copies
     drifting.

     Bubble phase, and it never calls preventDefault: consentGate runs first in
     the capture phase and each niche's own handler does the real submission to
     FormSubmit. This one only listens. If it throws, breaks, or the network is
     down, the enquiry has still been emailed — which is why every failure path
     here is silent.

     It runs only on a CLAIMED site. clientId is present only in the merged
     response from /api/operator-content; the niche's own content.json on the
     demo path has none, so a demo submits nothing and no lead is ever recorded
     against a tenant that does not exist. */

  var LEAD_SENT = (typeof WeakSet === 'function') ? new WeakSet() : null;

  /* Fields the operator does not need repeated back at them, or that are not
     the visitor's words: the honeypot, the consent box, anything the niche
     marked private, and the three we lift out by name. */
  var LEAD_SKIP = /^(_honey|name|phone|email)$/i;

  function leadField(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    return (el && typeof el.value === 'string') ? el.value.trim() : '';
  }

  /* Everything else the visitor filled in, as readable lines. Niches ask very
     different questions -- panes, vehicle, package, placement -- and the answers
     ARE the enquiry, so they are kept rather than reduced to one field. The
     label is the field's own <label> text where there is one, since a raw name
     like placement_notes reads badly in an inbox. */
  function leadMessage(form) {
    var out = [];
    var els = form.querySelectorAll('input[name], select[name], textarea[name]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var n = el.getAttribute('name');
      if (!n || LEAD_SKIP.test(n) || n.charAt(0) === '_') continue;
      if (el.type === 'checkbox' && !el.checked) continue;
      if (el.type === 'radio' && !el.checked) continue;
      if (el.type === 'hidden' && !el.value) continue;
      var v = (el.value || '').trim();
      if (!v) continue;
      var label = '';
      if (el.id) {
        var lab = form.querySelector('label[for="' + el.id + '"]');
        if (lab) label = (lab.textContent || '').replace(/\s+/g, ' ').trim();
      }
      if (!label) label = n.replace(/[_-]+/g, ' ');
      out.push(label.replace(/[:\s]+$/, '') + ': ' + v);
    }
    return out.join('\n');
  }

  function captureLead(e) {
    try {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;

      /* consentGate blocks a submission with no consent ticked. That is not an
         enquiry, so it is not a lead. */
      if (e.defaultPrevented && !form.__slLeadAllow) {
        var box = form.querySelector('input[type="checkbox"][id$="consent"]');
        if (box && !box.checked) return;
      }

      var c = window.CONTENT || {};
      if (!c.clientId) return;                       /* demo site */
      if (LEAD_SENT && LEAD_SENT.has(form)) return;  /* niche re-dispatched */

      var phone = leadField(form, 'phone');
      var email = leadField(form, 'email');
      if (!phone && !email) return;                  /* nothing to reply to */

      if (LEAD_SENT) LEAD_SENT.add(form);

      fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* keepalive so the record still goes even if a niche ever switches to
           a submission that navigates away. */
        keepalive: true,
        body: JSON.stringify({
          client_id: c.clientId,
          name: leadField(form, 'name'),
          phone: phone,
          email: email,
          message: leadMessage(form),
          _honey: leadField(form, '_honey'),
        }),
      }).catch(function () { /* the email already went */ });
    } catch (err) {
      /* Never let lead capture break a working enquiry form. */
    }
  }

  document.addEventListener('submit', captureLead, false);


  /* The content lifecycle.
     DEFAULT_CONTENT is inlined by the build from content.json, so the two can
     never disagree. The fetch exists so an operator edit goes live without a
     rebuild; on failure the inlined copy already rendered. */
  /* content.json namespaces per-niche data under `niche` (SITELAB_TEMPLATE.md
     §4.3) so the canonical schema stays clean. But every niche renderer reads
     those keys FLAT — c.walkServices, c.systemMap, c.rundown — because they were
     written against the pre-consolidation shape. Nothing ever unpacked the
     namespace, so after the very first conversion every renderer that touched
     niche data threw on undefined. Hand the renderer a flattened view; the
     authored file keeps its namespace. Verified collision-free across all 17
     sites, and re-checked by qa-site.js on every run. */
  function SLflat(c) { return c && c.niche ? Object.assign({}, c, c.niche) : (c || {}); }

  /* Flatten the GLOBAL, once, before niche.js parses. Passing a flattened copy
     to renderContent(c) is not enough: every niche.js opens with
     `var CONTENT = window.DEFAULT_CONTENT;` and its interactive handlers — drip
     calculators, quoters, week builders — read that alias directly rather than
     the render parameter. Those paths would still see the nested shape.
     This is why base.js must be emitted BEFORE niche.js (see _template/index.html).
     content.json on disk keeps its namespace; only the runtime view is flat, so
     DEFAULT_CONTENT still matches the authored file byte for byte. */
  window.DEFAULT_CONTENT = SLflat(window.DEFAULT_CONTENT);

  function boot() {
    var CONTENT = SLflat(window.DEFAULT_CONTENT);
    window.CONTENT = CONTENT;
    if (typeof window.renderContent === 'function') window.renderContent(CONTENT);
    initReveal();
    if (typeof window.initScene === 'function') window.initScene(reduce);

    fetch('content.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        CONTENT = SLflat(Object.assign({}, window.DEFAULT_CONTENT, d));
        window.CONTENT = CONTENT;
        if (typeof window.renderContent === 'function') window.renderContent(CONTENT);
      })
      .catch(function () { /* offline or 404: the inlined defaults stand */ });
  }

  /* setErr and showDone are intentionally absent: every niche examined
     defines its own with a different signature. Sharing them would be a
     silent behaviour change, not a saving. */
  window.SL = { esc: esc, num: num, telHref: telHref, telDigits: telDigits,
                smsHref: smsHref, val: val, postForm: postForm, reduce: reduce };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
