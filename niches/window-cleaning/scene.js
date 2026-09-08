/* window-cleaning/scene.js — the signature animation is CSS, in sections.css.
   Light and water: wc-sweep (a band of daylight travelling across the hero
   photo card), wc-shaft (two soft shafts of light crossing the hero, as if
   through a mullioned window) and wc-bead (water beads running down the
   leaning sash). All of it is transform/opacity only, loops on @keyframes,
   and is switched off by the prefers-reduced-motion block at the foot of that
   same file plus base.css's global animation:none override — so there is
   nothing for JavaScript to drive (SITELAB_TEMPLATE.md 7.0, D-S). A stub here
   is the correct shape, not a gap; qa-site.js grades the animation wherever
   it lives. The reduce flag is accepted and deliberately unused. */
window.initScene = function (reduce) { void reduce; /* see sections.css */ };
