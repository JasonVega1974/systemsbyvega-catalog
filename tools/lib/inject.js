'use strict';
/* The BUILD: marker splice, shared by build-catalog.js and build-chrome.js.
   Lifted verbatim from build-catalog.js so the two tools cannot drift on
   what a marker means or how a malformed one fails. */
function inject(html, marker, value) {
  const open  = `<!-- BUILD:${marker} -->`;
  const close = `<!-- /BUILD:${marker} -->`;
  const i = html.indexOf(open);
  const j = html.indexOf(close);
  if (i === -1 || j === -1) throw new Error(`marker BUILD:${marker} not found`);
  if (j < i) throw new Error(`marker BUILD:${marker} is inverted`);
  return html.slice(0, i + open.length) + value + html.slice(j);
}
module.exports = { inject };
