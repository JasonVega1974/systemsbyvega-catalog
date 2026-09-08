/* sprinkler/scene.js — the signature animation is CSS, in sections.css.
   sweep, mist and cycle: a rotor arc oscillating over the hero photo
   (sp-sweep), first-light droplets lifting off the spray and drifting up
   through the hero (sp-mist), and a four-zone controller strip stepping
   through its zones one at a time (sp-cycle). All of it is transform and
   opacity only, loops on @keyframes, and is switched off by the
   prefers-reduced-motion block at the foot of that same file plus base.css's
   global animation:none override — so there is nothing here for JavaScript
   to drive (SITELAB_TEMPLATE.md 7.0, D-S). A stub is the correct shape, not
   a gap. qa-site.js grades the animation wherever it lives. */
window.initScene = function (reduce) { /* see sections.css */ };
