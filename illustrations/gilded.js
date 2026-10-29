/* Goalie illustrations, Step 4: Knights: Gilded, the chosen style (Goldy, 2026-10-29).
   Gold armour on a deep team-colour field scattered with stars, like a herald's roll.
   draw(poseKey, team, num, opts) -> SVG string, on the shared skeleton (goalie-skeleton.js).
   tokens(team) gives every colour the picture uses for that team, with the rule that chose it,
   so the checks (check-colours.cjs) and the model sheet (STYLE.md) read the same numbers the art does.
   Works in the browser (window.GoalieGilded, after goalie-skeleton.js) and in Node (require). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./goalie-skeleton.js"));
  else root.GoalieGilded = factory(root.GoalieSkeleton);
})(typeof self !== "undefined" ? self : this, function (G) {
  "use strict";

  // Fixed tokens: the same in every team's picture
  const T = {
    gold: ["#FBEFB8", "#D8B256", "#9A6F1F"],   // armour gradient: light, mid, shadow
    ink: "#1d1e26",                           // every outline
    ice: "#E8ECF4",                           // net posts, puck rims, blade tape
    paper: "#FFFFFF",                         // light number
    wood: "#6b4a2e",                          // stick
    donut: "#E9A4B8",
    skate: "#5d6170",
  };

  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  function mix(hex, t) {
    const to = t > 0 ? 255 : 0, a = Math.abs(t);
    return "#" + rgb(hex).map((v) => Math.round(v + (to - v) * a).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  const lum = (hex) => rgb(hex).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const wcag = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // Colour-vision simulation (Machado et al. 2009, full severity), so a trim colour is chosen only if it
  // still shows for deuteranopia, protanopia and tritanopia as well as normal vision
  const CVD = {
    deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
    protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
  };
  const simulate = (hex, m) => {
    const c = rgb(hex).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return "#" + m.map((r) => { const v = Math.min(1, Math.max(0, r[0] * c[0] + r[1] * c[1] + r[2] * c[2]));
      return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)).toString(16).padStart(2, "0"); }).join("");
  };
  // The lowest contrast of a pair across normal vision and the three simulations
  const wcagAll = (a, b) => Math.min(wcag(a, b), ...Object.values(CVD).map((m) => wcag(simulate(a, m), simulate(b, m))));

  /* The colour rules. Each team colour comes from its published palette (team-colours.json);
     only the field and the fallbacks are derived. */
  function tokens(team) {
    const pal = (team.palette || [team.primary, team.secondary, team.accent].map((hex) => ({ hex }))).map((c) => c.hex.toUpperCase());
    const tabard = pal[0];
    // Field: the sweater colour taken 45% toward black, so the gold armour stands off it.
    // A black sweater gets a charcoal field instead, so the black tabard still reads on it.
    // A gold sweater (Nashville, Vegas) would put gold on gold, so its field comes from the next team colour.
    let base = tabard, why = "sweater colour, 45% darker";
    if (wcag(mix(tabard, -0.45), T.gold[1]) < 4.5) {
      const alt = pal.slice(1).find((h) => h !== "#FFFFFF" && wcag(mix(h, -0.45), T.gold[1]) >= 4.5);
      if (alt) { base = alt; why = "second team colour, 45% darker (the sweater is gold)"; }
    }
    let field = lum(base) < 0.01 ? mix(base, 0.16) : mix(base, -0.45);
    if (lum(base) < 0.01) why = "black sweater: a charcoal field so the tabard reads";
    const ground = lum(base) < 0.01 ? mix(base, 0.06) : mix(base, -0.65);
    // Trim (the crest, the tabard's edge, the shield's rim): the first other team colour that shows on the
    // field (3:1) and against the tabard (2:1) in every vision type; failing that, the best one, or white.
    // Against the tabard only counts when the tabard itself is under 3:1 on the field (then its edge does the work).
    const cands = pal.slice(1).filter((h) => h !== tabard);
    const edgeNeeded = wcagAll(tabard, field) < 3;
    const score = (h) => Math.min(wcagAll(h, field) / 3, edgeNeeded ? wcagAll(h, tabard) / 2 : 9);
    let trim = cands.find((h) => h !== "#FFFFFF" && score(h) >= 1), trimWhy = "first team colour that shows on field and tabard";
    if (!trim) {
      trim = cands.concat(["#FFFFFF"]).sort((a, b) => score(b) - score(a))[0];
      trimWhy = trim === "#FFFFFF" ? "white: no other team colour shows on both" : "best other team colour (none reaches both limits)";
    }
    if (trim === "#FFFFFF") trim = "#F4F5F8";
    // The shield's cross sits on the sweater colour, so it needs 2:1 there; else ink or white, whichever shows
    const cross = wcagAll(trim, tabard) >= 2 ? trim : wcag(T.ink, tabard) >= wcag("#F4F5F8", tabard) ? T.ink : "#F4F5F8";
    // Number: white with an ink edge, unless white is under 3:1 on the tabard; then ink with a white edge
    const light = wcag(T.paper, tabard) >= 3;
    return {
      tabard, field, ground, trim, cross, edgeNeeded, fieldWhy: why, trimWhy,
      number: light ? T.paper : T.ink, numberEdge: light ? T.ink : T.paper,
      numberWhy: light ? "white (3:1 or more on the tabard)" : "fallback: ink, because white is under 3:1 on the tabard",
    };
  }

  // A four-point star for the field, centred on (x, y)
  const STAR = (x, y) => `M${x} ${y - 2.2}L${x + .7} ${y - .7} ${x + 2.2} ${y} ${x + .7} ${y + .7} ${x} ${y + 2.2} ${x - .7} ${y + .7} ${x - 2.2} ${y} ${x - .7} ${y - .7}Z`;
  const fx = (v) => (Math.round(v * 10) / 10).toString();
  const P2 = (p) => `${fx(p[0])} ${fx(p[1])}`;
  const unit = (a, b) => { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]) || 1; return [d[0] / L, d[1] / L]; };
  const along = (p, u, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
  const mirror = (d) => d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (m, x, y) => `${fx(-x)} ${y}`);

  /* Crests ({{MARKS}}): a charge on top of the great helm, drawn after each team's nickname as original art.
     Never a team's logo, crest or wordmark: a generic heraldic figure only. Local frame: the helm's crown is
     (0, 0), up is -y, about 10 units wide and tall. "f" is filled, "s" is stroked, "m" is mirrored to both sides. */
  const W = "M0.5 -3C3 -3.5 6 -6 7 -9.5C5 -8.5 4 -8.5 3 -8C4 -7 3.2 -6 2 -6C2.5 -5 1.6 -4.3 0.5 -4.5Z";
  const star = (() => { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 2 : 5, a = -Math.PI / 2 + (i * Math.PI) / 5; p.push(P2([r * Math.cos(a), -5 + r * Math.sin(a)])); } return `M${p.join("L")}Z`; })();
  const CRESTS = {
    ANA: { charge: "Duck's head", f: "M-3 0C-4.5 -5 -1.5 -9 1 -9C3 -9 3.6 -7.6 3.3 -6.8L6.5 -6.2 3.3 -5C3.2 -3 2 -1.5 3 0Z" },
    BOS: { charge: "Bear's ears", f: "M-5 0V-2.5A2.6 2.6 0 1 1 -1.2 -4.6H1.2A2.6 2.6 0 1 1 5 -2.5V0Z" },
    BUF: { charge: "Crossed sabres", f: "M-5.2 -9.2L-3.8 -10 4.8 -0.6 3.4 0.2ZM5.2 -9.2L3.8 -10 -4.8 -0.6 -3.4 0.2ZM-5.4 -2H-1.8V-0.6H-5.4ZM1.8 -2H5.4V-0.6H1.8Z" },
    CGY: { charge: "Flame", f: "M0 0C-4.5 -1 -4.5 -5.5 -1.2 -9.8C-1.3 -6.8 0.8 -6.5 0.3 -4.3C2 -5.2 3 -6.6 2.3 -9.4C5.4 -5.6 4.6 -0.8 0 0Z" },
    CAR: { charge: "Storm spiral", s: "M0 -4.5a1 1 0 0 1 1 1a2 2 0 0 1 -2 2a3 3 0 0 1 -3 -3a4 4 0 0 1 4 -4a4.5 4.5 0 0 1 4.5 4.5" },
    CHI: { charge: "Hawk's head", f: "M-3.5 0C-4 -6 0 -9.5 3.5 -8.5C5.5 -8 6 -6 5 -4.6C4.6 -5.8 3.8 -6 3 -5.6L2.4 -4C1.4 -2.6 1.2 -1.4 2 0Z" },
    COL: { charge: "Snow peak", f: "M-5.5 0L-1.5 -8.5 0.6 -5.2 2.2 -7.2 5.5 0ZM-1.5 -8.5L-3.2 -4.9-1.6 -5.6-0.4 -4.6 0.6 -5.2Z" },
    CBJ: { charge: "Cockade", f: "M-4 -4.5A4 4 0 1 0 4 -4.5A4 4 0 1 0 -4 -4.5ZM-1.6 -4.5A1.6 1.6 0 1 1 1.6 -4.5A1.6 1.6 0 1 1 -1.6 -4.5Z" },
    DAL: { charge: "Star", f: star },
    DET: { charge: "Pair of wings", f: W, m: true },
    EDM: { charge: "Drop", f: "M0 -10.5C2 -7 4 -5 4 -3.5A4 4 0 0 1 -4 -3.5C-4 -5 -2 -7 0 -10.5Z" },
    FLA: { charge: "Cat's ears", f: "M-5 0L-4.2 -7.5 -0.8 -2.4H0.8L4.2 -7.5 5 0Z" },
    LAK: { charge: "Crown", f: "M-5 0V-7.5L-2.5 -4.2 0 -8.8 2.5 -4.2 5 -7.5V0Z" },
    MIN: { charge: "Pine", f: "M0 -10.5L4 -5.6H2L5 -1.6H1V0H-1V-1.6H-5L-2 -5.6H-4Z" },
    MTL: { charge: "Fleur-de-lis", f: "M0 -10.5C2 -8.5 2 -5.5 0.8 -3.3C2 -4.3 4.3 -5 4.3 -7.3C6 -4.5 4 -2.3 1.5 -2.4V0H-1.5V-2.4C-4 -2.3 -6 -4.5 -4.3 -7.3C-4.3 -5 -2 -4.3 -0.8 -3.3C-2 -5.5 -2 -8.5 0 -10.5ZM-3.6 -3.2H3.6V-2H-3.6Z" },
    NSH: { charge: "Sabre tooth", f: "M-2.8 0C-2.6 -4.5 0 -8.5 2.6 -10.5C1.4 -7.4 1.4 -4 2.8 0Z" },
    NJD: { charge: "Horns", f: "M-0.5 -2C-3 -2.5 -4.5 -5.5 -3.6 -9.8C-5.8 -7 -6 -2.5 -4 0H-0.5Z", m: true },
    NYI: { charge: "Anchor", s: "M0 -8.2V0M-4 -3.6C-3 -0.4 3 -0.4 4 -3.6M-2.2 -6.6H2.2M1.2 -9.4A1.2 1.2 0 1 1 -1.2 -9.4A1.2 1.2 0 1 1 1.2 -9.4" },
    NYR: { charge: "Crossed arrows", f: "M-3.4 -7.6L-2.2 -8.4 4.8 -0.6 3.6 0.2ZM3.4 -7.6L2.2 -8.4 -4.8 -0.6 -3.6 0.2ZM-5.6 -10.6L-1.4 -9.4 -4.6 -6.4ZM5.6 -10.6L1.4 -9.4 4.6 -6.4Z" },
    OTT: { charge: "Laurel", f: "M-0.6 -0.4C-5.2 -1.4 -6.4 -6 -4.4 -10.4C-3.6 -6.6 -3 -3.4 -0.2 -1.8ZM-5 -3.2C-7.6 -3 -7.6 -5.4 -7.6 -5.4C-5.8 -5.6 -5 -4.4 -5 -3.2ZM-5.6 -6.6C-7.8 -7.2 -7.4 -9.4 -7.4 -9.4C-5.8 -9 -5.4 -7.6 -5.6 -6.6Z", m: true },
    PHI: { charge: "Swept wing", f: "M-5 0C-1 -1 4 -4 6 -10C3.5 -8.5 2 -8.6 0.5 -8C2 -7 1 -5.8 -0.5 -6C0 -4.8 -1.2 -4 -2.6 -4.4C-2.4 -3 -3.6 -1.6 -5 -1.5Z" },
    PIT: { charge: "Penguin", f: "M0 -10.5C3 -10.5 4 -5 3.5 0H-3.5C-4 -5 -3 -10.5 0 -10.5ZM-0.6 -8.6L1.6 -8 -0.4 -7.4Z", belly: "M0 -6.6C1.8 -6.6 2.2 -3 1.9 -0.4H-1.9C-2.2 -3 -1.8 -6.6 0 -6.6Z" },
    SJS: { charge: "Fin", f: "M-5.5 0C-2 -3 0 -7 1 -10.5C1.6 -6.2 3 -2 5.5 0Z" },
    SEA: { charge: "Tentacle", f: "M-3 0C-4.2 -5 1.8 -5 1.4 -8C1.2 -9 0 -9.1 -0.1 -8.4C-0.6 -9.9 2.9 -10.8 3.1 -8C3.4 -4 -1.2 -4 0.2 0Z" },
    STL: { charge: "Music note", f: "M-4.2 -1.8A2.3 1.7 -20 1 0 0.4 -1.8A2.3 1.7 -20 1 0 -4.2 -1.8ZM-0.6 -1.8V-10.2H0.6C1 -8 4 -7.6 3.6 -4.6C3 -6.6 1.6 -7 0.6 -7.2V-1.8Z" },
    TBL: { charge: "Lightning bolt", f: "M1.2 -10.5L-3.4 -4.2H-0.2L-1.8 0 3.6 -6.4H0.4Z" },
    TOR: { charge: "Leaf (a plain leaf, not a maple leaf)", f: "M0.4 0H-0.4V-1.6C-4.4 -3.4 -4.2 -8 0 -10.8C4.2 -8 4.4 -3.4 0.4 -1.6Z" },
    UTA: { charge: "Tusks", f: "M-1.2 -0.8C-5.6 -2.2 -6 -7.6 -1.6 -9.8C-3.6 -7.6 -3.6 -3.8 0 -2.2Z", m: true },
    VAN: { charge: "Wave", f: "M-5.5 0C-5.5 -5 -1 -9.2 3.2 -8.4C1 -7.4 0.2 -5.8 1.6 -4.8C2.6 -4.2 4.2 -4.6 5.2 -6.2C5.8 -3.2 5.2 -1 5.5 0Z" },
    VGK: { charge: "Sword", f: "M-1.2 -9.6L0 -11.2 1.2 -9.6V-3.4H3.6V-1.8H1.2V0H-1.2V-1.8H-3.6V-3.4H-1.2Z" },
    WSH: { charge: "Dome", f: "M-5 0Q-5 -6.2 0 -7.2Q5 -6.2 5 0ZM-0.6 -7V-10H0.6V-7Z" },
    WPG: { charge: "Arrowhead", f: "M0 -10.5L5 -0.6 0 -3.4 -5 -0.6Z" },
  };

  function crest(code, at, hd, tk) {
    const c = CRESTS[code];
    if (!c) return `<path d="M${P2(along(at, hd, 0.5))}L${P2(along(at, hd, 7))}" stroke="${tk.trim}" stroke-width="2.6" stroke-linecap="round"/>`;
    const hn = [-hd[1], hd[0]];
    const m = `matrix(${[hn[0], hn[1], -hd[0], -hd[1], at[0], at[1]].map((v) => v.toFixed(3)).join(" ")})`;
    const ds = c.m ? [c.f, mirror(c.f)] : [c.f || c.s];
    const body = c.s
      ? `<path d="${c.s}" fill="none" stroke="${T.ink}" stroke-width="2.6" stroke-linecap="round"/><path d="${c.s}" fill="none" stroke="${tk.trim}" stroke-width="1.4" stroke-linecap="round"/>`
      : ds.map((d) => `<path d="${d}" fill="${tk.trim}" stroke="${T.ink}" stroke-width=".7" stroke-linejoin="round" fill-rule="evenodd"/>`).join("")
        + (c.belly ? `<path d="${c.belly}" fill="${tk.tabard === tk.trim ? T.ice : T.ice}"/>` : "");
    return `<g transform="${m}">${body}</g>`;
  }

  // Fit the figure (and its crest) inside the frame: ice at y = 82.4, the top no higher than y = 10
  const inset = (A, crested) => {
    const top = Math.min(A.top, A.P.head[1] - 5.6 - (crested ? 11 : 0));
    const k = Math.min(0.82, 72 / (G.GROUND - top));
    return `translate(${(50 - 50 * k).toFixed(2)} ${(82.4 - G.GROUND * k).toFixed(2)}) scale(${k.toFixed(3)})`;
  };

  /** draw(poseKey, team, num, opts): team is an entry of team-colours.json plus { code }.
      opts.size sets width and height; opts.label the accessible name; opts.id makes gradient ids unique. */
  function draw(poseKey, team, num, opts = {}) {
    const A = G.parts(poseKey), P = A.P, tk = { ...tokens(team), ...(opts.tk || {}) }, ink = T.ink;
    const id = `gd-${opts.id || poseKey + "-" + (team.code || "x")}`, steel = `url(#${id})`;
    const body = A.parts.map((p) => {
      if (p.role === "shadow") return `<path d="${p.d}" fill="#000" opacity=".3"/>`;
      if (p.role === "blocker" || p.role === "mask") return "";
      // Net and pucks: drawn in ice with a heavy edge, so they survive the 32 px leaderboard row
      if (p.role === "net") return `<path d="${p.d}" fill="${T.ice}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/>`;
      if (p.role === "puck") return `<path d="${p.d}" fill="${ink}" stroke="${T.ice}" stroke-width="1.8" paint-order="stroke"/>`;
      if (p.role === "streak") return `<path d="${p.d}" fill="${T.gold[0]}" opacity=".85"/>`;
      const fill = { thigh: steel, pad: steel, skate: T.skate, torso: tk.tabard, arm: steel, glove: steel,
        shaft: T.wood, paddle: T.wood, blade: T.ice, donut: T.donut }[p.role];
      const edge = p.role === "torso" ? tk.trim : ink;
      return `<path d="${p.d}" fill="${fill}" fill-rule="evenodd" stroke="${edge}" stroke-width="${p.role === "torso" ? 1.6 : 1}" stroke-linejoin="round"/>`;
    }).join("");
    // Kite shield on the blocker hand, square to the forearm, in the sweater colour with a trim cross
    const hb = P.handBlocker, fu = unit(P.elbowBlocker, hb), fn = [-fu[1], fu[0]];
    const sh = [along(along(hb, fu, -6), fn, -6.5), along(along(hb, fu, -6), fn, 6.5), along(hb, fn, 6), along(along(hb, fu, 8), fn, 0), along(hb, fn, -6)];
    const shield = `<path d="M${P2(sh[0])}L${P2(sh[1])}L${P2(sh[2])}Q${P2(along(along(hb, fu, 5), fn, 4))} ${P2(sh[3])}Q${P2(along(along(hb, fu, 5), fn, -4))} ${P2(sh[4])}Z" fill="${tk.tabard}" stroke="${tk.trim}" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M${P2(along(hb, fu, -5))}L${P2(along(hb, fu, 6))}M${P2(along(along(hb, fu, -1), fn, -4.5))}L${P2(along(along(hb, fu, -1), fn, 4.5))}" stroke="${tk.cross}" stroke-width="1.2"/>`;
    // Great helm with a visor slit, and the team crest on top
    const h = P.head, hd = unit(P.neck, h), hn = [-hd[1], hd[0]];
    const c = (a, b) => along(along(h, hd, a), hn, b);
    const helm = `<path d="M${P2(c(5, -5))}L${P2(c(5, 5))}L${P2(c(-5.5, 5))}L${P2(c(-5.5, -5))}Z" fill="${steel}" stroke="${ink}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M${P2(c(1, -4))}L${P2(c(1, 4))}" stroke="${ink}" stroke-width="1.3"/>${crest(team.code, c(5, 0), hd, tk)}`;
    // The field: stars on a deep team colour, the ice below, a gold rule round the edge
    const gy = (7 + 0.82 * G.GROUND).toFixed(1);
    const g = T.gold;
    return `${G.svgOpen(A.pose, opts)}<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset=".5" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[2]}"/></linearGradient>
      <pattern id="${id}-s" width="14" height="28" patternUnits="userSpaceOnUse" x="0" y="-6"><path d="${STAR(7, 14)}${STAR(0, 0)}${STAR(14, 0)}${STAR(0, 28)}${STAR(14, 28)}" fill="${g[1]}" opacity=".35"/></pattern></defs>
      <rect width="100" height="100" fill="${tk.field}"/><rect width="100" height="${gy}" fill="url(#${id}-s)"/>
      <path d="M0 ${gy}H100V100H0Z" fill="${tk.ground}"/>
      <g transform="${inset(A, !!CRESTS[team.code])}">${body}${shield}${helm}
      <text x="${A.chest[0].toFixed(1)}" y="${A.chest[1].toFixed(1)}" transform="rotate(${A.torsoAngle + 90} ${A.chest[0].toFixed(1)} ${A.chest[1].toFixed(1)})" text-anchor="middle" dominant-baseline="central" style="font: 600 8px Jost, Futura, sans-serif; fill: ${tk.number}; paint-order: stroke; stroke: ${tk.numberEdge}; stroke-width: 1.3">${num}</text></g>
      <rect x="2.5" y="2.5" width="95" height="95" fill="none" stroke="${g[1]}" stroke-width="3"/><rect x=".5" y=".5" width="99" height="99" fill="none" stroke="${ink}"/></svg>`;
  }

  return { NAME: "Knights: Gilded", CONCEIT: "Gold armour on a deep team-colour field scattered with stars, like a herald's roll.",
    T, CRESTS, CVD, tokens, draw, mix, lum, wcag, wcagAll, simulate };
});
