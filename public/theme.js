/* Setzt Theme + Rail-Zustand vor dem ersten Paint (verhindert Flackern).
   Bewusst eine eigene Datei statt eines Inline-Skripts: die oeffentlichen
   Seiten werden statisch ausgeliefert und koennen darum keine CSP-Nonce
   tragen. Als Datei vom eigenen Origin ist das Skript von "script-src 'self'"
   gedeckt. */
(function () {
  try {
    var t = localStorage.getItem("theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    if (localStorage.getItem("rail") === "1") document.documentElement.setAttribute("data-rail", "1");
  } catch (e) {}
})();
