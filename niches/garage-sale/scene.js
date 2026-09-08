/* garage-sale/scene.js — the signature animation is CSS, in sections.css.
   sway, glow and drift — a cardboard GARAGE SALE sign swaying on its twine
   beside the hero photo card, morning motes drifting up through the low sun,
   and a sunrise halo breathing behind the photo. All of it is
   transform/opacity only, loops on @keyframes (gs-signsway, gs-sunhalo,
   gs-drift), and is switched off by the prefers-reduced-motion block in that
   same file plus base.css's global animation:none override — so there is
   nothing for JavaScript to drive (SITELAB_TEMPLATE.md 7.0, D-S). A stub
   here is the correct shape, not a gap. qa-site.js grades the animation
   wherever it lives. */
window.initScene = function (reduce) { /* see sections.css */ };
