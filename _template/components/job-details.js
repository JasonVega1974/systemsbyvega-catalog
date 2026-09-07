/* _template/components/job-details.js
   Fills the two-column included/not-included lists from c.jobDetails.
   DOM-property assignment throughout (createElement + textContent), no
   innerHTML. Hidden entirely when the niche/operator supplies neither list;
   a column with its own empty list hides independently of its sibling. */
(function () {
  'use strict';

  function fill(ul, items) {
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    items.forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
    return items.length;
  }

  function initJobDetails(c) {
    var section = document.getElementById('jobDetails');
    var incUl = document.getElementById('jdIncluded');
    var notUl = document.getElementById('jdNotIncluded');
    if (!section || !incUl || !notUl) return;

    var jd = (c && c.jobDetails) || {};
    var included = Array.isArray(jd.included) ? jd.included.filter(Boolean) : [];
    var notIncluded = Array.isArray(jd.notIncluded) ? jd.notIncluded.filter(Boolean) : [];

    var incCount = fill(incUl, included);
    var notCount = fill(notUl, notIncluded);

    var incCol = incUl.closest('.jd-cmp__col');
    var notCol = notUl.closest('.jd-cmp__col');
    if (incCol) incCol.hidden = !incCount;
    if (notCol) notCol.hidden = !notCount;

    section.hidden = !(incCount || notCount);
  }

  if (window.SLComponents && typeof window.SLComponents.register === 'function') {
    window.SLComponents.register(initJobDetails);
  }
})();
