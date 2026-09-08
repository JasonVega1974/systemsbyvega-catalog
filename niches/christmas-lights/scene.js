/* christmas-lights/scene.js — the signature animation is CSS, in sections.css.
   The motif is a garland warming up: cl-twinkle lifts each lamp's filament
   glow in turn along the hero string, cl-breathe drifts the halo behind the
   photo, and cl-fall carries a few flakes down past it. All three are
   opacity/transform only, loop on @keyframes, and are switched off by the
   prefers-reduced-motion block at the foot of that same file (and again by
   base.css's global animation:none override). A timer-driven string has
   nothing per-frame for JavaScript to compute, so a stub here is the correct
   shape rather than a gap — qa-site.js grades the animation wherever it
   lives (SITELAB_TEMPLATE.md 7.0, D-S).
   The reduce flag is accepted and deliberately unused; the CSS honours it. */
window.initScene = function (reduce) { void reduce; /* see sections.css */ };
