/* _template/components/hero-photo.js
   src comes from c.niche.heroImg, falling back to the build-stamped default
   path (data-hero-default) for this niche's photos/hero.jpg. Neither one
   loading (missing content value AND a 404 on the default) shows the dashed
   slot-empty state instead of a broken image -- detected via the img's own
   load/error events rather than a build-time file-existence check, since
   this file has no filesystem access at runtime. DOM-property assignment
   throughout (img.src/.alt), never innerHTML. */
(function () {
  'use strict';

  function initHeroPhoto(c) {
    var fig = document.querySelector('.hero-photo-cmp');
    if (!fig) return;
    var img = fig.querySelector('img');
    if (!img) return;

    var n = (c && c.niche) || {};
    var brand = (c && c.brand) || {};
    var src = n.heroImg || fig.getAttribute('data-hero-default') || '';

    if (!src) { fig.classList.add('slot-empty'); return; }

    img.onerror = function () { fig.classList.add('slot-empty'); img.removeAttribute('src'); };
    img.onload = function () { fig.classList.remove('slot-empty'); };
    img.alt = brand.name ? (brand.name + ' — hero photo') : 'Hero photo';
    img.src = src;
  }

  if (window.SLComponents && typeof window.SLComponents.register === 'function') {
    window.SLComponents.register(initHeroPhoto);
  }
})();
