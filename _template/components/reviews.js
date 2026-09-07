/* _template/components/reviews.js
   Fills the three review cards from c.testimonials via element.textContent
   (DOM-property assignment, the escaping standard for this build). Carries
   its OWN fallback strings -- the B1 lesson: an empty testimonial must still
   read as an honest, deliberate placeholder, not blank space or a copied-in
   assumption about a real customer. Empty-compliant: a fictional demo with
   no testimonials renders three "coming soon" cards, never a fabricated
   quote. */
(function () {
  'use strict';

  var FALLBACK_QUOTE = 'Real review coming soon.';
  var FALLBACK_WHO = '— Add a real review here';

  function initReviews(c) {
    var cards = document.querySelectorAll('.review-cmp');
    if (!cards.length) return;
    var testimonials = (c && c.testimonials) || [];
    cards.forEach(function (card, i) {
      var t = testimonials[i] || {};
      var quoteEl = card.querySelector('.review-cmp__quote');
      var whoEl = card.querySelector('.review-cmp__who');
      if (quoteEl) quoteEl.textContent = t.quote || FALLBACK_QUOTE;
      if (whoEl) whoEl.textContent = t.name ? ('— ' + t.name) : FALLBACK_WHO;
    });
  }

  if (window.SLComponents && typeof window.SLComponents.register === 'function') {
    window.SLComponents.register(initReviews);
  }
})();
