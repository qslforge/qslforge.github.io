// Turns /verify/<code> into /verify/?c=<code> (GitHub Pages has no server-side rewrites).
(function () {
  var m = window.location.pathname.match(/^\/verify\/([A-Za-z2-7]{12})\/?$/);
  if (m) window.location.replace("/verify/?c=" + m[1].toUpperCase());
})();
