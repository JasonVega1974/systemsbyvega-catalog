/* personal-assistant/scene.js — the signature animation is CSS, in sections.css.
   settle, breathe and lean: three ruled slips settling one after another beside
   the hero photo, a soft page-glow breathing behind it, and a clipped index tab
   leaning a degree and back. All of it is transform/opacity only, loops on
   @keyframes (wf-settle, wf-breathe, wf-tabtilt), and is switched off by the
   prefers-reduced-motion block in that same file plus base.css's global
   animation:none override — so there is nothing here for JavaScript to drive
   (SITELAB_TEMPLATE.md 7.0, D-S). A stub is the correct shape, not a gap.
   qa-site.js grades the animation wherever it lives. */
window.initScene = function (reduce) { /* see sections.css; reduce is handled there */ };
