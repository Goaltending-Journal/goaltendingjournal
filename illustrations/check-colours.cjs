/* Step 4 colour checks for Knights: Gilded, on all 32 teams' colours.
   1. The jersey number against the tabard: WCAG 2 contrast (3:1 budget) and APCA Lc.
   2. Every pair the picture relies on (number/tabard, trim/field, trim/tabard, armour/field),
      again under simulated deuteranopia, protanopia and tritanopia (Machado et al. 2009, full severity).
   3. The card's gold rule against the page, light and dark (3:1 budget).
   Writes audit/colours.json and prints the failures. Run: node illustrations/check-colours.cjs */
const fs = require("fs"), path = require("path");
const GD = require("./gilded.js");
const MD = require("./medieval.js");
const TEAMS = require("./team-colours.json").teams;

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const enc = (v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgbHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

const CVD = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const simulate = (hex, m) => { const c = hexRgb(hex).map(lin); return rgbHex(m.map((r) => enc(r[0] * c[0] + r[1] * c[1] + r[2] * c[2]))); };

// APCA-W3 0.0.98G: lightness contrast Lc of text on background (sign shows polarity; |Lc| is what counts)
function apca(text, bg) {
  const Y = (h) => { const [r, g, b] = hexRgb(h).map((v) => (v / 255) ** 2.4); let y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b; return y < 0.022 ? y + (0.022 - y) ** 1.414 : y; };
  const yt = Y(text), yb = Y(bg);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) { const s = (yb ** 0.56 - yt ** 0.57) * 1.14; return s < 0.1 ? 0 : +((s - 0.027) * 100).toFixed(1); }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14; return s > -0.1 ? 0 : +((s + 0.027) * 100).toFixed(1);
}
// OKLab distance, to catch two colours that keep their contrast but lose their hue difference
function oklab(hex) {
  const [r, g, b] = hexRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dE = (a, b) => { const p = oklab(a), q = oklab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const r2 = (v) => +v.toFixed(2);

const PAGES = { light: ["#f6f6fb", "#ffffff"], dark: ["#11121d", "#191b2a"] };   // goalies.html --ice and --boards
const out = { checked: new Date().toISOString().slice(0, 10), budgets: { number: "3:1 WCAG", pairs: "3:1 trim/field, armour/field and tabard/field (or 2:1 trim/tabard when the trim edge carries it), 2:1 cross/shield, in every vision type", page: "3:1" }, teams: {}, failures: [] };

for (const [code, team] of Object.entries(TEAMS)) {
  const tk = GD.tokens(team), gold = GD.T.gold[1];
  const pairs = { "number/tabard": [tk.number, tk.tabard, 3], "trim/field": [tk.trim, tk.field, 3], "armour/field": [gold, tk.field, 3],
    // The tabard has to stand off the field, by itself or by its trim edge
    [tk.edgeNeeded ? "trim/tabard" : "tabard/field"]: tk.edgeNeeded ? [tk.trim, tk.tabard, 2] : [tk.tabard, tk.field, 3], "cross/shield": [tk.cross, tk.tabard, 2] };
  const row = { tokens: tk, crest: GD.CRESTS[code] && GD.CRESTS[code].charge, number: { wcag: r2(GD.wcag(tk.number, tk.tabard)), apca: apca(tk.number, tk.tabard), whiteWcag: r2(GD.wcag("#FFFFFF", tk.tabard)) }, vision: {} };
  for (const [vision, m] of Object.entries({ normal: null, ...CVD })) {
    row.vision[vision] = {};
    for (const [name, [a, b, min]] of Object.entries(pairs)) {
      const A = m ? simulate(a, m) : a, B = m ? simulate(b, m) : b, c = GD.wcag(A, B), d = dE(A, B);
      row.vision[vision][name] = { wcag: r2(c), dE: r2(d) };
      if (c < min) out.failures.push({ team: code, vision, pair: name, wcag: r2(c), min });
    }
  }
  out.teams[code] = row;
}
// The card's edge is an ink hairline outside a gold rule: whichever is stronger separates the card from the page
for (const [theme, bgs] of Object.entries(PAGES)) for (const bg of bgs) {
  const c = Math.max(GD.wcag(GD.T.gold[1], bg), GD.wcag(GD.T.ink, bg));
  out.page = out.page || {}; out.page[`${theme} ${bg}`] = r2(c);
  if (c < 3) out.failures.push({ page: theme, bg, wcag: r2(c), min: 3 });
}
// Tapestry (the style Goldy locked on 2026-10-29): pale linen ground, so the crest, outline and card edge are checked on linen
const TAP = MD.TAP, tap = { teams: {}, failures: [], page: {} };
for (const [code, team] of Object.entries(TEAMS)) {
  const tk = MD.tapTokens(team);
  const pairs = { "number/tabard": [tk.number, tk.tab, 3], "crest/linen": [tk.crest, TAP.linen, 3], "outline/linen": [TAP.thread, TAP.linen, 3],
    "outline/armour": [TAP.thread, tk.armour[0], 3], "cross/shield": [tk.cross, tk.tab, 2] };
  const row = { tokens: { tabard: tk.tab, armour: tk.armour[0], crest: tk.crest, number: tk.number, cross: tk.cross, steel: tk.steel }, number: { wcag: r2(GD.wcag(tk.number, tk.tab)), apca: apca(tk.number, tk.tab) }, vision: {} };
  for (const [vision, m] of Object.entries({ normal: null, ...CVD })) {
    row.vision[vision] = {};
    for (const [name, [a, b, min]] of Object.entries(pairs)) {
      const A = m ? simulate(a, m) : a, B = m ? simulate(b, m) : b, c = GD.wcag(A, B);
      row.vision[vision][name] = r2(c);
      if (c < min) tap.failures.push({ team: code, vision, pair: name, wcag: r2(c), min });
    }
  }
  tap.teams[code] = row;
}
// The card's edge: linen with a thread rule round it; whichever is stronger separates it from the page
for (const [theme, bgs] of Object.entries(PAGES)) for (const bg of bgs) {
  const c = Math.max(GD.wcag(TAP.linen, bg), GD.wcag(TAP.thread, bg));
  tap.page[`${theme} ${bg}`] = r2(c);
  if (c < 3) tap.failures.push({ page: theme, bg, wcag: r2(c), min: 3 });
}
out.tapestry = tap;
fs.mkdirSync(path.join(__dirname, "audit"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "audit", "colours.json"), JSON.stringify(out, null, 1));
const fb = Object.entries(out.teams).filter(([, r]) => r.tokens.number !== "#FFFFFF").map(([c]) => c);
console.log(`32 teams checked. Number fallback (ink) for: ${fb.join(", ") || "none"}. Page: ${JSON.stringify(out.page)}`);
console.log("Gilded: " + (out.failures.length ? out.failures.map((f) => JSON.stringify(f)).join("\n") : "no failures."));
console.log(`Tapestry: number falls back to thread for ${Object.entries(tap.teams).filter(([, r]) => r.tokens.number === TAP.thread).map(([c]) => c).join(", ")}; steel for ${Object.entries(tap.teams).filter(([, r]) => r.tokens.steel).map(([c]) => c).join(", ")}. Page: ${JSON.stringify(tap.page)}`);
console.log("Tapestry: " + (tap.failures.length ? tap.failures.map((f) => JSON.stringify(f)).join("\n") : "no failures."));
