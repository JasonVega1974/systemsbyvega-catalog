/* mechanic/scene.js — the signature animation is CSS, in sections.css.
   gg-spin, gg-sweep and gg-roll — a socket ring turning slowly behind the
   hero photo, the amber beacon on the truck roof breathing, and hazard
   chevrons rolling along the shoulder rail under the hero. All of it is
   transform and opacity only, loops on @keyframes, and is switched off by the
   prefers-reduced-motion block at the bottom of that same file plus
   base.css's global animation:none override — so there is nothing for
   JavaScript to drive (SITELAB_TEMPLATE.md 7.0, D-S). A stub here is the
   correct shape, not a gap. qa-site.js grades the animation wherever it
   lives. */
window.initScene = function (reduce) { /* see sections.css */ };
