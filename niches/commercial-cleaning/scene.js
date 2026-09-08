/* commercial-cleaning/scene.js — the signature animation is CSS, in
   sections.css. Two loops, both restrained on purpose because the buyer here
   is reading a proposal rather than being sold to: kf-lamp, the tower's floors
   lighting and going dark again as the crew works its way up the building, and
   kf-sweep, a slow band of light crossing the hero bay. Both are opacity and
   transform only, both loop on @keyframes, and both are switched off by the
   prefers-reduced-motion block in that same file plus base.css's global
   animation:none override — so there is nothing for JavaScript to drive
   (SITELAB_TEMPLATE.md 7.0, D-S). A stub here is the correct shape, not a gap.
   qa-site.js grades the animation wherever it lives. */
window.initScene = function (reduce) { /* see sections.css */ };
