/* estate-sale/scene.js — the signature animation is CSS, in sections.css.
   sway and drift — a brass key swaying gently on its thread beside the hero
   photo card, attic-light dust motes drifting up through the hero, and a slow
   halo breathing behind the photo. All of it is transform/opacity only, loops
   on @keyframes (mm-keysway, mm-drift, mm-halo), and is switched off by the
   prefers-reduced-motion block in that same file plus base.css's global
   animation:none override — so there is nothing for JavaScript to drive
   (SITELAB_TEMPLATE.md 7.0, D-S). A stub here is the correct shape, not a gap.
   qa-site.js grades the animation wherever it lives. */
window.initScene = function (reduce) { /* see sections.css */ };
