/* The nine research topics, in legend order, and the colour key for each researcher (their first topic in researchers-data.js).
   Shared by the homepage sphere (constellation.js) and the Researcher Network Map on research.html, so both show the same
   people in the same colours. The colours themselves are the --t-* tokens in site-nav.css. */
window.GRJ_TOPICS = [
  ["hip", "Hip & groin"], ["inj", "Injury & safety"], ["eq", "Equipment"],
  ["vis", "Vision & anticipation"], ["phy", "Physiology & training"],
  ["bio", "Movement & biomechanics"], ["psy", "Psychology & cognition"],
  ["dev", "Development & coaching"], ["stats", "Performance analytics"]
];
(function () {
  const key = Object.fromEntries(window.GRJ_TOPICS.map(([k, n]) => [n, k]));
  window.grjTopicKey = (name) => key[name] || null;
  window.grjPersonKey = (p) => key[(p.tp || [])[0]] || "hip";
})();
