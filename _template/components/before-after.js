/* _template/components/before-after.js
   Slider drag/keyboard logic extracted verbatim (behavior) from
   niches/bin-cleaning/niche.js. Image resolution is generalized: the target
   keys come from data-merge on .ba-cmp-wrap, stamped by tools/build-site.js
   from the niche's manifest merge.beforeAfter. */
(function () {
  'use strict';

  function safeUrl(u) { return String(u || '').replace(/["\\)]/g, ''); }

  /* "niche.beforeImg/afterImg" (default/unknown falls back to this shape) or
     "projects[0]" (contracting's shape: c.projects[0].beforeImg/afterImg). */
  function resolveImages(c, mergeSpec) {
    var base = (mergeSpec === 'projects[0]')
      ? ((c.projects && c.projects[0]) || {})
      : ((c && c.niche) || {});
    return { before: base.beforeImg || '', after: base.afterImg || '' };
  }

  function initBeforeAfter(c) {
    var wrap = document.querySelector('.ba-cmp-wrap');
    var ba = document.querySelector('.ba-cmp');
    if (!wrap || !ba) return;

    var mergeSpec = wrap.getAttribute('data-merge') || 'niche.beforeImg/afterImg';
    var imgs = resolveImages(c || {}, mergeSpec);
    /* both-or-neither: a lone real photo is never paired with a placeholder
       standing in as the other side of a fabricated comparison. */
    var hasBoth = !!(imgs.before && imgs.after);
    if (hasBoth) {
      ba.style.setProperty('--before-img', 'url("' + safeUrl(imgs.before) + '")');
      ba.style.setProperty('--after-img', 'url("' + safeUrl(imgs.after) + '")');
    } else {
      ba.style.removeProperty('--before-img');
      ba.style.removeProperty('--after-img');
    }
    wrap.classList.toggle('slot-empty', !hasBoth);

    if (ba.__slBaWired) return; // wire drag/keyboard once; renderContent may
                                 // run again after the content.json fetch.
    ba.__slBaWired = true;

    var pos = 50, dragging = false, touched = false;
    function setPos(p) {
      pos = Math.max(0, Math.min(100, p));
      ba.style.setProperty('--pos', pos + '%');
      ba.setAttribute('aria-valuenow', Math.round(pos));
    }
    function xToPct(clientX) {
      var r = ba.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 100;
    }
    function start(e) {
      dragging = true; ba.classList.add('dragging');
      if (!touched) { touched = true; ba.classList.add('touched'); }
      move(e);
    }
    function move(e) {
      if (!dragging) return;
      var x = (e.touches ? e.touches[0].clientX : e.clientX);
      setPos(xToPct(x));
      if (e.cancelable) e.preventDefault();
    }
    function end() { dragging = false; ba.classList.remove('dragging'); }

    ba.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move, { passive: false });
    window.addEventListener('mouseup', end);
    ba.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);

    ba.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { setPos(pos - 4); e.preventDefault(); if (!touched) { touched = true; ba.classList.add('touched'); } }
      if (e.key === 'ArrowRight') { setPos(pos + 4); e.preventDefault(); if (!touched) { touched = true; ba.classList.add('touched'); } }
    });

    // gentle auto-nudge on first view to signal it drags
    var reduce = !!(window.SL && window.SL.reduce);
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (x) {
          if (x.isIntersecting && !touched) {
            var seq = [68, 32, 50], k = 0;
            var t = setInterval(function () {
              if (touched) { clearInterval(t); return; }
              setPos(seq[k++]); if (k >= seq.length) clearInterval(t);
            }, 520);
            io.unobserve(ba);
          }
        });
      }, { threshold: .5 });
      io.observe(ba);
    }
  }

  if (window.SLComponents && typeof window.SLComponents.register === 'function') {
    window.SLComponents.register(initBeforeAfter);
  }
})();
