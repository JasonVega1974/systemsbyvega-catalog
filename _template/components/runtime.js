/* _template/components/runtime.js — the shared-component wiring mechanism.
 *
 * Why this exists: base.js is shared by EVERY build, including the 23 (soon
 * more) niches that use none of these components, so it cannot unconditionally
 * call an initComponents(c) hook — a page with no components must build
 * byte-identical to today. tools/build-site.js only appends this file (once,
 * prepended ahead of any component's own .js) into the NICHE_JS bundle when
 * at least one component actually got included for that niche. A niche with
 * no components never sees this file at all.
 *
 * Mechanism: wrap window.renderContent. Script order is base.js, then
 * NICHE_JS (niche.js followed by this runtime + each included component's
 * .js, in that order — see _template/index.html and build-site.js), then
 * scene.js — all synchronous, all executed before base.js's own boot() runs
 * on DOMContentLoaded (see base.js). So by the time this file runs, niche.js
 * has already done `window.renderContent = function (c) { ... };` — we read
 * that as the "real" renderer, then replace window.renderContent with a
 * wrapper that calls it first (unchanged niche behavior, always) and then
 * runs every registered component initializer with the SAME content object.
 * boot() calls window.renderContent(CONTENT) twice — once synchronously at
 * boot, once again after the content.json fetch resolves — and the wrapper
 * covers both calls automatically, so a component reacts to a live operator
 * edit exactly like the niche's own render does.
 *
 * A component's own .js (footer-contact.js, before-after.js, ...) calls
 * window.SLComponents.register(fn) at parse time — after this file, since
 * build-site.js always places runtime.js first in the appended bundle.
 */
(function () {
  'use strict';

  if (window.SLComponents) return; // idempotent: only one niche build ever
                                    // appends this, but guard anyway.

  var list = [];
  window.SLComponents = {
    register: function (fn) { if (typeof fn === 'function') list.push(fn); }
  };

  var prevRender = window.renderContent;
  window.renderContent = function (c) {
    if (typeof prevRender === 'function') prevRender(c);
    list.forEach(function (fn) {
      /* One component's bug must not blank a page that otherwise rendered
         fine — swallow and move on to the next initializer. */
      try { fn(c); } catch (e) { /* component init failed; page still stands */ }
    });
  };
})();
