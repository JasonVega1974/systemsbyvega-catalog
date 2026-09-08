/* residential-cleaning/scene.js — the signature animation is CSS, in
   sections.css. Rise, bloom and sweep: soap bubbles drifting up through the
   hero (yb-rise), a soft daylight bloom breathing behind the photo plate
   (yb-glowpulse), and a slow light sweep crossing the photo frame
   (yb-sheen-run). All of it is transform/opacity only, loops on @keyframes,
   and is switched off by the prefers-reduced-motion block in that same file
   plus base.css's global animation:none override — so there is nothing here
   for JavaScript to drive (SITELAB_TEMPLATE.md 7.0, D-S). A stub is the
   correct shape, not a gap; qa-site.js grades the animation wherever it
   lives. The reduce flag is accepted so the signature matches every other
   niche's initScene. */
window.initScene = function (reduce) { /* see sections.css — CSS-only scene */ };
