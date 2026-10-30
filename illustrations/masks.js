/* Goalie masks: one mask per goalie type (Goldy, 2026-10-30). Each mask is a modern goalie mask (fibreglass shell,
   wire cage, backplate) crossed with a knight's helm, and carries its type's one trait in its shape.
   Front view, 100 × 100 frame, symmetric about x = 50 unless a type says otherwise.
   Original art only: no real goalie's mask design, no team logo. Team crests come from gilded.js.
   Works in the browser (window.GoalieMasks, after gilded.js) and in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./gilded.js"));
  else root.GoalieMasks = factory(root.GoalieGilded);
})(typeof self !== "undefined" ? self : this, function (GD) {
  "use strict";
  const fx = (v) => (Math.round(v * 10) / 10).toString();
  const P2 = (p) => `${fx(p[0])} ${fx(p[1])}`;
  // A smooth curve through points (Catmull-Rom as cubic Béziers), without the opening M
  function through(pts) {
    let d = "";
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += `C${P2([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${P2([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${P2(p2)}`;
    }
    return d;
  }
  // A symmetric closed shape from its right half, given as [dx, y] from the top centre to the bottom centre
  const sym = (half, cx = 50) => {
    const R = half.map(([dx, y]) => [cx + dx, y]), L = half.slice().reverse().map(([dx, y]) => [cx - dx, y]);
    return `M${P2(R[0])}${through(R)}${through(L)}Z`;
  };
  // Straight-sided version for helms with corners
  const symPoly = (half, cx = 50) => "M" + half.map(([dx, y]) => P2([cx + dx, y])).concat(half.slice().reverse().map(([dx, y]) => P2([cx - dx, y]))).join("L") + "Z";

  /* Shells: right halves. "modern" is today's mask: a round dome, wide cheeks that sweep to a pointed chin. */
  const SHELLS = {
    modern: [[0, 14], [10, 15.5], [18, 21], [22.5, 31], [23.5, 43], [22, 55], [19, 66], [14, 76], [7, 82], [0, 84]],
    barrel: [[0, 15], [14, 15.5], [21, 19], [23.5, 30], [24, 56], [23, 72], [19, 81], [0, 84]],           // barrel helm: boxy
    great: [[0, 14], [20, 14], [24, 18], [24, 80], [20, 84], [0, 84]],                                   // great helm: flat top, square
    frog: [[0, 15], [10, 16], [18, 22], [22, 33], [24, 47], [25.5, 60], [22, 72], [13, 88], [0, 96]],     // frog-mouth: big flared jaw, long chin
    sallet: [[0, 16], [11, 17], [19, 24], [23, 35], [27, 48], [37, 64], [33, 71], [17, 76], [7, 81], [0, 82]],   // sallet: flared tail sweeping out low
    armet: [[0, 14], [11, 15], [19, 21], [23, 32], [24, 46], [23, 60], [20, 71], [13, 80], [0, 84]],
    hound: [[0, 14], [10, 15.5], [18, 21], [22.5, 31], [23.5, 43], [22, 55], [19, 66], [14, 76], [7, 82], [0, 84]],
    plante: [[0, 18], [11, 19], [17, 25], [19, 38], [18.5, 54], [16, 68], [11, 79], [0, 84]],               // 1960s moulded mask: narrow oval
    sleek: [[0, 13], [9, 14], [17, 19.5], [22, 29], [23, 41], [21, 54], [17, 66], [11, 76], [5, 82], [0, 83.5]],
  };
  // Cage openings: right halves
  const HOLES = {
    cateye: [[0, 38], [8, 36.5], [15.5, 39], [17.5, 48], [15.5, 60], [10, 69], [0, 72]],
    wide: [[0, 37], [10, 36], [18, 38.5], [19.5, 50], [17.5, 63], [11, 72], [0, 75]],
    square: [[0, 36], [18, 36], [18, 70], [0, 70]],
    eyes: null,   // the old moulded mask: no cage, two eye holes and breathing holes
  };

  /* One mask per type. shell, hole, cage ("cateye", "bars", "slots", "dense"); extras add the trait. */
  const MASKS = {
    steady: { name: "Steady", helm: "Bascinet", shell: "modern", hole: "cateye", cage: "cateye", extras: ["dangler"],
      trait: "Today's mask, plain and square to the shot: a round bascinet dome, a cat-eye cage and a long throat dangler." },
    workhorse: { name: "Workhorse", helm: "Barrel helm", shell: "barrel", hole: "wide", cage: "bars", extras: ["net", "tape", "bottle"],
      trait: "A boxy barrel helm, taped and scuffed from every minute, framed by the net, with the water bottle on top." },
    "hd-stopper": { name: "High-Danger Stopper", helm: "Frog-mouth helm", shell: "frog", hole: "cateye", cage: "cateye", extras: ["puck-hit"],
      trait: "A jousting frog-mouth jaw that juts at the doorstep, with a puck stopped dead on the cage." },
    wall: { name: "The Wall", helm: "Great helm", shell: "great", hole: "square", cage: "slots", poly: true,
      trait: "A flat-topped great helm, square as a castle wall, with slot bars instead of a cage." },
    rebound: { name: "Rebound Controller", helm: "Sallet", shell: "sallet", hole: "cateye", cage: "cateye", extras: ["puck-held"],
      trait: "A sallet whose tail sweeps out low like a catching glove, with the puck held still in its mouth." },
    siege: { name: "Under Siege", helm: "Armet", shell: "armet", hole: "wide", cage: "dense", extras: ["dents", "shots"],
      trait: "A dented armet with a tight cage, pucks raining in from every side." },
    crease: { name: "Crease Battler", helm: "Hounskull", shell: "hound", hole: "cateye", cage: "cateye", extras: ["screen"], shift: 9,
      trait: "Peering round a screen: half the mask hidden behind a big shoulder in front of the crease." },
    standout: { name: "Standout", helm: "Winged helm", shell: "modern", hole: "cateye", cage: "cateye", extras: ["wings"],
      trait: "A winged helm: the one that rises above the rest." },
    "donut-king": { name: "Donut King", helm: "Crowned helm", shell: "modern", hole: "cateye", cage: "cateye", extras: ["crown"],
      trait: "A crown of zeros, one ring for every shutout." },
    grandpa: { name: "Grandpa", helm: "Moulded mask", shell: "plante", hole: "eyes", cage: null, extras: ["breath", "strap"],
      trait: "The league's elder wears the original: a 1960s moulded fibreglass mask with no cage." },
    "young-gun": { name: "Young Gun", helm: "Crested helm", shell: "sleek", hole: "cateye", cage: "cateye", extras: ["mohawk"],
      trait: "The newest, sleekest shell, with a mohawk crest raked back off the dome." },
    "style-king": { name: "Style King", helm: "Parade helm", shell: "modern", hole: "cateye", cage: "cateye", extras: ["plume", "ribbons"],
      trait: "A parade helm: a tall plume and ribbons, the loudest mask in the league." },
  };

  /** The mask as named parts, back to front: [{ role, d }]. Roles: net, bottle, back, wing, shell, hole, cage (stroke),
      vent, stripe, crestAt, tape, dent, breath, eye, strap, crown, ring, plume, ribbon, spike, puck, streak, screen. */
  function parts(type) {
    const M = MASKS[type], cx = 50 + (M.shift || 0), out = [], push = (role, d, frame) => out.push({ role, d, frame: frame || null });
    const has = (e) => (M.extras || []).includes(e);
    // Frame props ("back" or "front") stay full size; the mask and what it wears shrink to 80% so the props read at 32 px
    if (has("net")) push("net", "M6 96V40H94V96", "back");
    if (has("puck-hit")) push("burst", (() => { const pts = []; for (let i = 0; i < 24; i++) { const a = (i * Math.PI) / 12, r = i % 2 ? 30 : 48; pts.push(P2([50 + r * Math.cos(a), 54 + r * Math.sin(a)])); } return "M" + pts.join("L") + "Z"; })(), "back");
    if (has("bottle")) push("bottle", "M60 33h9v-6.5q0 -2 -2 -2h-1.5v-2.5h-2v2.5h-1.5q-2 0 -2 2Z");
    // Backplate showing at the temples (not on a great helm or the old moulded mask)
    if (!["great", "plante"].includes(M.shell)) push("back", sym([[0, 22], [20, 23], [27, 30], [28.5, 42], [26.5, 52], [0, 54]], cx));
    if (has("wings")) push("wing", ["M72 36C80 22 90 14 97 12C93 20 94 26 90 32C93 33 94 37 91 40C86 40 80 42 72 46Z", "M28 36C20 22 10 14 3 12C7 20 6 26 10 32C7 33 6 37 9 40C14 40 20 42 28 46Z"].join(""));
    if (has("plume")) { push("plume", "M50 15C40 4 44 -10 56 -16C51 -6 57 -3 55 4C62 -2 68 -1 70 -6C70 6 61 13 53 15Z"); push("ribbon", "M27 46C20 56 18 70 22 84L26 82C24 70 26 58 30 50ZM73 46C80 56 82 70 78 84L74 82C76 70 74 58 70 50Z"); }
    const shell = (M.poly ? symPoly : sym)(SHELLS[M.shell], cx);
    push("shell", shell);
    // Bascinet's mail aventail, as a goalie's throat dangler: a wide fan below the chin
    if (has("dangler")) push("dangler", `M${cx - 14} 84L${cx - 24} 104Q${cx} 112 ${cx + 24} 104L${cx + 14} 84Z`);
    // Crested helm read as a swept mohawk: three blades raking back to one side, so it never reads as the crown
    if (has("mohawk")) push("spike", [0, 1, 2].map((k) => { const x = cx - 10 + k * 9, y = 18 - k; return `M${fx(x - 5)} ${fx(y + 6)}C${fx(x)} ${fx(y - 8)} ${fx(x + 14)} ${fx(y - 16)} ${fx(x + 30)} ${fx(y - 18 + k * 2)}C${fx(x + 20)} ${fx(y - 8)} ${fx(x + 10)} ${fx(y)} ${fx(x + 6)} ${fx(y + 6)}Z`; }).join(""));
    if (has("crown")) { push("crown", `M${cx - 26} 24L${cx - 34} -2L${cx - 14} 10L${cx} -8L${cx + 14} 10L${cx + 34} -2L${cx + 26} 24Q${cx} 16 ${cx - 26} 24Z`);
      push("ring", [-19, 0, 19].map((dx, i) => { const x = cx + [-34, 0, 34][i], y = [-2, -8, -2][i]; return `M${x - 4.5} ${y}a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0ZM${x - 2} ${y}a2 2 0 1 1 4 0a2 2 0 1 1 -4 0Z`; }).join("")); }
    // Paint guides: a swoop band on each side (the style fills it), and where the crest decal sits on the forehead
    if (M.shell !== "plante") push("stripe", `M${cx - 21} 31C${cx - 14} 28 ${cx - 8} 32 ${cx - 6} 38L${cx - 12} 38C${cx - 14} 34 ${cx - 17} 33 ${cx - 22} 35ZM${cx + 21} 31C${cx + 14} 28 ${cx + 8} 32 ${cx + 6} 38L${cx + 12} 38C${cx + 14} 34 ${cx + 17} 33 ${cx + 22} 35Z`);
    // Vents on the dome
    if (!["great", "plante"].includes(M.shell)) push("vent", `M${cx - 7} 19.5h3.6v1.4h-3.6ZM${cx + 3.4} 19.5h3.6v1.4h-3.6Z`);
    // The face: a cage opening, or the moulded mask's eyes and breathing holes
    if (HOLES[M.hole]) {
      const hole = (M.hole === "square" ? symPoly : sym)(HOLES[M.hole], cx);
      push("hole", hole);
      push("cage", cage(M.cage, cx));
    } else {
      push("eye", `M${cx - 13} 41C${cx - 10} 37 ${cx - 4} 38 ${cx - 3} 42C${cx - 5} 46 ${cx - 11} 46 ${cx - 13} 41ZM${cx + 13} 41C${cx + 10} 37 ${cx + 4} 38 ${cx + 3} 42C${cx + 5} 46 ${cx + 11} 46 ${cx + 13} 41Z`);
      push("breath", [[0, 56], [-4, 60], [4, 60], [0, 64], [-8, 66], [8, 66], [-4, 70], [4, 70], [0, 74], [-7, 52], [7, 52]]
        .map(([dx, y]) => `M${fx(cx + dx - 1)} ${y}a1 1 0 1 0 2 0a1 1 0 1 0 -2 0Z`).join(""));
    }
    if (has("strap")) push("strap", `M${cx - 18.6} 36L${cx - 26} 33.5V39L${cx - 18.8} 41ZM${cx + 18.6} 36L${cx + 26} 33.5V39L${cx + 18.8} 41Z`);
    if (has("tape")) push("tape", `M${cx - 23} 50l9 -3 1.4 3.6 -9 3ZM${cx + 14} 74l7 3 -1.2 3.4 -7 -3Z`);
    if (has("dents")) push("dent", `M${cx - 16} 26q2 -1 3 1q-1 2 -3 -1ZM${cx + 15} 30q2 -1 3 1q-1 2 -3 -1ZM${cx - 20} 58q2 -1 3 1q-1 2 -3 -1ZM${cx + 8} 22q2 -1 3 1q-1 2 -3 -1Z`);
    if (has("puck-hit")) { push("puck", `M${cx - 6} 55a6 3.2 0 1 0 12 0a6 3.2 0 1 0 -12 0Z`); push("streak", `M${cx - 12} 49l-5 -3M${cx + 12} 49l5 -3M${cx - 13} 56h-6M${cx + 13} 56h6`); }
    if (has("puck-held")) push("puck", `M${cx - 5} 66a5 2.6 0 1 0 10 0a5 2.6 0 1 0 -10 0Z`);
    if (has("shots")) for (const [x, y, a] of [[9, 12, 35], [91, 12, 145], [6, 52, 0], [94, 52, 180], [9, 90, 325], [91, 90, 215]]) {
      const r = (a * Math.PI) / 180, tail = [x - Math.cos(r) * 8, y - Math.sin(r) * 8];
      push("shotStreak", `M${P2(tail)}L${x} ${y}`, "front"); push("shot", `M${x - 5} ${y}a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z`, "front");
    }
    if (has("screen")) push("screen", "M-2 102V52C-2 38 14 30 28 33C40 36 48 46 50 60L52 102Z", "front");
    return { mask: M, parts: out, cx, crestAt: [cx, M.shell === "great" ? 26 : 28] };
  }

  // Cage bars, clipped to the opening by the style
  function cage(kind, cx) {
    const v = (x, y0, y1) => `M${fx(x)} ${y0}V${y1}`, h = (y, bend = 2) => `M${cx - 26} ${y + bend}Q${cx} ${y - bend} ${cx + 26} ${y + bend}`;
    if (kind === "cateye") return v(cx, 34, 76) + [-6, 6, -12, 12].map((dx) => v(cx + dx, 50, 76)).join("") + h(49, 3) + h(57) + h(65, 1);
    if (kind === "bars") return [-15, -10, -5, 0, 5, 10, 15].map((dx) => v(cx + dx, 34, 78)).join("") + h(50, 1) + h(62, 1);
    if (kind === "dense") return [-16, -12, -8, -4, 0, 4, 8, 12, 16].map((dx) => v(cx + dx, 34, 78)).join("") + h(46, 1) + h(54, 1) + h(62, 1) + h(70, 1);
    if (kind === "slots") return [41, 46.5, 52, 57.5, 63].map((y) => `M${cx - 20} ${y}H${cx + 20}`).join("") + v(cx, 34, 72);
    return "";
  }

  // Plumes and crowns rise above y = 0, so every mask is drawn at 90% with room above
  const FIT = "translate(5 8) scale(.9)", ATTACH = "translate(10 10) scale(.8)";

  /* Draft paint: fibreglass in team colour, a trim swoop, the crest as a forehead decal, a steel cage. */
  function painted(type, team, num, opts = {}) {
    const A = parts(type), tk = GD.tokens(team), ink = "#1d1e26", id = `mk-${opts.id || type + (team.code || "")}`;
    const shellC = tk.tabard === "#000000" ? "#24252c" : tk.tabard, back = GD.mix(shellC, -0.35);
    const cageC = GD.lum(shellC) < 0.2 ? "#F4F5F8" : "#2a2b33";
    const L = `stroke="${ink}" stroke-width="1.1" stroke-linejoin="round"`;
    const roleAttr = {
      net: `fill="none" stroke="#C8102E" stroke-width="5" stroke-linejoin="round"`, burst: `fill="#F4E7C3" opacity=".9"`, shot: `fill="#15161b" stroke="#E8ECF4" stroke-width="1.4"`, shotStreak: `fill="none" stroke="#E8ECF4" stroke-width="2.4" stroke-linecap="round" opacity=".8"`, bottle: `fill="#E8ECF4" ${L}`,
      back: `fill="${back}" ${L}`, dangler: `fill="${back}" ${L}`, wing: `fill="#E8ECF4" ${L}`, plume: `fill="${tk.trim}" ${L}`, ribbon: `fill="${tk.trim}" ${L}`,
      shell: `fill="${shellC}" ${L}`, spike: `fill="${tk.trim}" ${L}`, crown: `fill="#D8B256" ${L}`, ring: `fill="#FBEFB8" fill-rule="evenodd" ${L}`,
      stripe: `fill="${tk.trim}"`, vent: `fill="${ink}" opacity=".6"`, hole: `fill="#14151b"`, cage: `fill="none" stroke="${cageC}" stroke-width="1.5" stroke-linecap="round" clip-path="url(#${id}-h)"`,
      eye: `fill="#14151b"`, breath: `fill="#14151b"`, strap: `fill="#C9A66B" ${L}`, tape: `fill="#F4F5F8" opacity=".9"`, dent: `fill="${ink}" opacity=".35"`,
      puck: `fill="#15161b" stroke="#E8ECF4" stroke-width="1.2"`, streak: `fill="none" stroke="#9aa0b8" stroke-width="1.6" stroke-linecap="round"`, screen: `fill="#3b3d48" ${L}`,
    };
    const hole = A.parts.find((p) => p.role === "hole");
    const draw = (f) => A.parts.filter((p) => p.frame === f).map((p) => (roleAttr[p.role] ? `<path d="${p.d}" ${roleAttr[p.role]}/>` : "")).join("");
    const gloss = `<path d="M${A.cx - 15} 22C${A.cx - 8} 16 ${A.cx + 2} 16 ${A.cx + 8} 18C${A.cx} 18 ${A.cx - 9} 21 ${A.cx - 15} 28Z" fill="#fff" opacity=".28"/>`;
    const crest = GD.CRESTS[team.code] ? GD.crest(team.code, [A.crestAt[0], A.crestAt[1] + 4.5], [0, -1], { trim: tk.trim }, 0.62) : "";
    const chin = A.mask.shell === "plante" ? "" : `<text x="${A.cx}" y="80.5" text-anchor="middle" style="font: 600 5px Jost, Futura, sans-serif; fill: ${tk.number === "#FFFFFF" ? "#fff" : ink}">${num}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${opts.size ? ` width="${opts.size}" height="${opts.size}"` : ""} role="img" aria-label="${opts.label || A.mask.name + " mask"}">
      ${hole ? `<defs><clipPath id="${id}-h"><path d="${hole.d}"/></clipPath></defs>` : ""}${opts.bg === false ? "" : `<rect x=".75" y=".75" width="98.5" height="98.5" rx="8" fill="${GD.mix(shellC, 0.86)}" stroke="${GD.mix(shellC, -0.2)}" stroke-width="1.5"/>`}<g transform="${FIT}">${draw("back")}<g transform="${ATTACH}">${draw(null)}${gloss}${crest}${chin}</g>${draw("front")}</g></svg>`;
  }

  /** Flat silhouette of the whole mask and its props, for the shape audit. */
  function silhouette(type, opts = {}) {
    const A = parts(type), ink = opts.ink || "#000";
    const draw = (f) => A.parts.filter((p) => p.frame === f && !["cage", "hole", "eye", "breath", "stripe", "vent", "dent", "tape", "streak", "ring"].includes(p.role))
      .map((p) => (p.role === "net" ? `<path d="${p.d}" fill="none" stroke="${ink}" stroke-width="6"/>` : p.role === "shotStreak" ? `<path d="${p.d}" fill="none" stroke="${ink}" stroke-width="3"/>` : `<path d="${p.d}"/>`)).join("");
    const body = `${draw("back")}<g transform="${ATTACH}">${draw(null)}</g>${draw("front")}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${opts.size ? ` width="${opts.size}" height="${opts.size}"` : ""}><g fill="${ink}" transform="${FIT}">${body}</g></svg>`;
  }

  return { MASKS, SHELLS, parts, painted, silhouette, ORDER: Object.keys(MASKS) };
});
