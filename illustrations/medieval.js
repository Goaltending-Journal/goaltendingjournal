/* Goalie illustrations, Step 4 round 2: medieval-art knights. Goldy liked Gilded Knights but asked for figures
   that read as characters rather than blocks, in a medieval art style, keeping the knight and the crests.
   figure() redraws the same skeleton poses as smooth, tapered parts (one geometry for every style);
   each style paints those parts. Colour rules and crests come from gilded.js.
   Works in the browser (window.GoalieMedieval, after goalie-skeleton.js and gilded.js) and in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./goalie-skeleton.js"), require("./gilded.js"));
  else root.GoalieMedieval = factory(root.GoalieSkeleton, root.GoalieGilded);
})(typeof self !== "undefined" ? self : this, function (G, GD) {
  "use strict";
  const fx = (v) => (Math.round(v * 10) / 10).toString();
  const P2 = (p) => `${fx(p[0])} ${fx(p[1])}`;
  const unit = (a, b) => { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]) || 1; return [d[0] / L, d[1] / L]; };
  const along = (p, u, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
  const nrm = (u) => [-u[1], u[0]];
  const mix = GD.mix;

  // A smooth curve through points (Catmull-Rom as cubic Béziers), without the opening M
  function through(pts) {
    let d = "";
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += `C${P2([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${P2([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${P2(p2)}`;
    }
    return d;
  }
  // Normals along a chain of joints, turned so they point to the lit side (light from the upper left)
  const normals = (pts) => pts.map((p, i) => { const n = nrm(unit(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)])); return n[0] + n[1] > 0 ? [-n[0], -n[1]] : n; });
  // A tapered, rounded limb through joints, widths per joint; shift slides it toward the lit (+) or shaded (-) side
  function limb(pts, ws, shift = 0) {
    const ns = normals(pts), P = pts.map((p, i) => along(p, ns[i], shift * ws[i]));
    const L = P.map((p, i) => along(p, ns[i], ws[i] / 2)), R = P.map((p, i) => along(p, ns[i], -ws[i] / 2)).reverse();
    const r0 = ws[0] / 2, r1 = ws[ws.length - 1] / 2;
    const sweep = (a, b, c) => ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0 ? 1 : 0);
    const s1 = sweep(L[L.length - 2] || L[0], L[L.length - 1], R[0]), s0 = sweep(R[R.length - 2] || R[0], R[R.length - 1], L[0]);
    return `M${P2(L[0])}${through(L)}A${fx(r1)} ${fx(r1)} 0 0 ${s1} ${P2(R[0])}${through(R)}A${fx(r0)} ${fx(r0)} 0 0 ${s0} ${P2(L[0])}Z`;
  }
  // A highlight stroke down the lit side of a limb
  const shine = (pts, ws) => { const ns = normals(pts), Q = pts.map((p, i) => along(p, ns[i], ws[i] * 0.28)); return `M${P2(Q[0])}${through(Q)}`; };
  const ell = (c, rx, ry, rot) => { const u = [Math.cos(rot), Math.sin(rot)], deg = fx(rot * 180 / Math.PI);
    return `M${P2(along(c, u, -rx))}a${fx(rx)} ${fx(ry)} ${deg} 1 0 ${P2([2 * rx * u[0], 2 * rx * u[1]])}a${fx(rx)} ${fx(ry)} ${deg} 1 0 ${P2([-2 * rx * u[0], -2 * rx * u[1]])}Z`; };

  /** The posed knight as smooth parts, back to front: [{ role, d }]. Roles:
      net, shadow, cape, metal (+ shade, shine), tabard, hem, pauldron, wood, tape, catcher, pocket, shield, shieldRim,
      cross, sabaton, runner, padline, helm / helmShade / visor (in helm space, see .helm), puck, donut, streak. */
  function figure(poseKey, o = {}) {
    const A = G.parts(poseKey), P = A.P, k = o.lw || 1, hs = o.hs || 1.15, out = [];
    const push = (role, d) => out.push({ role, d });
    const metal = (pts, ws) => { ws = ws.map((w) => w * k); push("metal", limb(pts, ws)); push("shade", limb(pts, ws.map((w) => w * 0.42), -0.3)); push("shine", shine(pts, ws)); };
    const roles = (r) => A.parts.filter((p) => p.role === r);
    const up = unit(P.pelvis, P.neck), side = nrm(up);
    roles("net").forEach((p) => push("net", p.d));
    roles("shadow").forEach((p) => push("shadow", p.d));
    if (o.cape) {
      const sb = P.shBlocker, sg = P.shGlove, foot = Math.min(G.GROUND - 3, P.pelvis[1] + 24), cx = P.pelvis[0], sw = Math.abs(sg[0] - sb[0]);
      push("cape", `M${P2(sb)}C${P2([sb[0] - 7, sb[1] + 14])} ${P2([cx - sw * 0.85 - 5, foot - 8])} ${P2([cx - sw * 0.75 - 3, foot])}Q${P2([cx - 4, foot - 4])} ${P2([cx, foot + 1])}Q${P2([cx + 4, foot - 4])} ${P2([cx + sw * 0.75 + 3, foot])}C${P2([cx + sw * 0.85 + 5, foot - 8])} ${P2([sg[0] + 7, sg[1] + 14])} ${P2(sg)}Z`);
    }
    for (const s of ["L", "R"]) {
      const hip = P["hip" + s], knee = P["knee" + s], ankle = P["ankle" + s], toe = P["toe" + s];
      metal([hip, knee], [10, 9]);
      const sh = unit(knee, ankle), sn = nrm(sh);
      metal([along(knee, sh, -5), along(knee, sh, 9), ankle], [12.5, 13.5, 11]);
      // Real pad detail: two vertical face channels, the boot break and two straps across the lower pad
      const pc = (t, o) => along(along(knee, sh, t), sn, o * k);
      push("channel", [-2.6, 2.6].map((o) => `M${P2(pc(-2, o))}C${P2(pc(4, o * 1.15))} ${P2(pc(12, o * 1.15))} ${P2(pc(17, o * 0.9))}`).join(""));
      push("boot", `M${P2(pc(16.5, -5.2))}Q${P2(pc(18.2, 0))} ${P2(pc(16.5, 5.2))}`);
      push("strap", [13.2, 15.6].map((t) => `M${P2(pc(t, -5.6))}L${P2(pc(t + 0.5, 5.6))}`).join(""));
      push("padline", [4, 11].map((t) => `M${P2(along(along(knee, sh, t), sn, -5.6 * k))}Q${P2(along(knee, sh, t + 2.6))} ${P2(along(along(knee, sh, t), sn, 5.6 * k))}`).join(""));
      push("sabaton", limb([ankle, toe], [6 * k, 4.4 * k]));
      const bu = unit(ankle, toe), bn = nrm(bu), dn = bn[1] > 0 ? bn : [-bn[0], -bn[1]];
      push("runner", `M${P2(along(along(ankle, dn, 3.2 * k), bu, -2))}L${P2(along(along(toe, dn, 3.2 * k), bu, 2))}`);
    }
    // Breastplate, then the tabard over it with a pointed hem
    const belly = along(P.pelvis, up, 9);
    metal([along(P.pelvis, up, -1), belly, along(P.neck, up, -1.5)], [16, 17.5, 21]);
    const hem = along(P.pelvis, up, -6.5), top = along(P.neck, up, -4.5), tw = 7.2 * k;
    const hl = along(along(P.pelvis, side, -tw), up, -2), hr = along(along(P.pelvis, side, tw), up, -2);
    push("tabard", `M${P2(along(top, side, -tw))}Q${P2(along(belly, side, -tw - 1.5))} ${P2(hl)}L${P2(hem)}L${P2(hr)}Q${P2(along(belly, side, tw + 1.5))} ${P2(along(top, side, tw))}Q${P2(along(top, up, 2))} ${P2(along(top, side, -tw))}Z`);
    push("hem", `M${P2(hl)}L${P2(hem)}L${P2(hr)}`);
    for (const a of ["Blocker", "Glove"]) {
      metal([P["sh" + a], P["elbow" + a], P["hand" + a]], [8, 7, 6.5]);
      const ua = unit(P["sh" + a], P["elbow" + a]);
      push("cop", ell(P["elbow" + a], 3.4 * k, 2.8 * k, Math.atan2(ua[1], ua[0])));
      push("pauldron", ell(P["sh" + a], 5.3 * k, 4.4 * k, Math.atan2(side[1], side[0])));
      // Shoulder floater: two segment lines across the cap
      push("ridge", [-1.6, 1.4].map((t) => { const c0 = along(P["sh" + a], up, t); return `M${P2(along(c0, side, -4.2 * k))}Q${P2(along(c0, up, 1.6))} ${P2(along(c0, side, 4.2 * k))}`; }).join(""));
    }
    for (const r of ["shaft", "paddle"]) roles(r).forEach((p) => push("wood", p.d));
    roles("blade").forEach((p) => push("tape", p.d));
    if (A.pose.stick && !A.pose.stick.yoke) push("knob", ell(P.handBlocker, 2.2, 2.2, 0));
    const hg = P.handGlove, gu = unit(P.elbowGlove, hg), ga = Math.atan2(gu[1], gu[0]);
    const gn = nrm(gu), ts = (gn[0] * (P.pelvis[0] - hg[0]) + gn[1] * (P.pelvis[1] - hg[1])) > 0 ? 1 : -1;
    const g2 = (a, b) => along(along(hg, gu, a * k), gn, b * k * ts);
    push("cuff", `M${P2(g2(-6.5, -4.4))}L${P2(g2(-2, -4.8))}L${P2(g2(-2, 4.8))}L${P2(g2(-6.5, 4.4))}Z`);
    push("catcher", ell(along(hg, gu, 1.5), 7.2 * k, 6.3 * k, ga));
    push("thumb", ell(g2(1, 6.2), 3.4 * k, 2.4 * k, ga));
    push("pocket", ell(along(hg, gu, 2.4), 3.4 * k, 3 * k, ga));
    push("lace", `M${P2(g2(6.6, -4))}Q${P2(g2(8, 0))} ${P2(g2(6.6, 4))}M${P2(g2(7.4, 0))}L${P2(g2(3, 0))}M${P2(g2(-1.5, -5))}Q${P2(g2(-3, 0))} ${P2(g2(-1.5, 5))}`);
    const hb = P.handBlocker, fu = unit(P.elbowBlocker, hb), fn = nrm(fu);
    const c = (a, b, s = 1) => along(along(hb, fu, a * k * s), fn, b * k * s);
    const kite = (s) => `M${P2(c(-6, -6.5, s))}Q${P2(c(-7.5, 0, s))} ${P2(c(-6, 6.5, s))}Q${P2(c(2, 7, s))} ${P2(c(9, 0, s))}Q${P2(c(2, -7, s))} ${P2(c(-6, -6.5, s))}Z`;
    push("cuff", `M${P2(c(-10, -4))}L${P2(c(-5, -4.4))}L${P2(c(-5, 4.4))}L${P2(c(-10, 4))}Z`);
    push("shield", kite(1)); push("shieldRim", kite(0.78));
    push("cross", `M${P2(c(-4.5, 0))}L${P2(c(6, 0))}M${P2(c(-1, -4))}L${P2(c(-1, 4))}`);
    roles("streak").forEach((p) => push("streak", p.d));
    roles("puck").forEach((p) => push("puck", p.d));
    roles("donut").forEach((p) => push("donut", p.d));
    // The helm, in its own frame: a round bascinet with a dome and a visor slit
    const hd = unit(P.neck, P.head), hc = along(P.head, hd, (hs - 1) * 4.5), hn = nrm(hd);
    const helm = { at: hc, dir: hd, s: hs, matrix: `matrix(${[hn[0] * hs, hn[1] * hs, -hd[0] * hs, -hd[1] * hs, hc[0], hc[1]].map((v) => v.toFixed(3)).join(" ")})`,
      shape: "M-5 4.6L-5.4 -1C-5.6 -7.4 5.6 -7.4 5.4 -1L5 4.6Q0 6.2 -5 4.6Z", shade: "M1.6 -6.2C4.2 -5.6 5.6 -3.6 5.4 -1L5 4.6Q3 5.4 1.4 5.5Z",
      visor: "M-4.4 -1.2Q0 -2.2 4.4 -1.2L4.2 .6Q0 1.4 -4.2 .6Z",
      // A goalie cage in the helm's face: an opening, three bars down and two across, and a throat dangler below
      cageHole: "M-4.3 -2.6Q0 -3.6 4.3 -2.6L3.9 3.2Q0 4.6 -3.9 3.2Z", cage: "M-2 -3.1V4M0 -3.3V4.2M2 -3.1V4M-4.1 -.6Q0 -1.4 4.1 -.6M-3.9 1.7Q0 2.6 3.9 1.7",
      dangler: "M-2 5L2 5L1.8 8.2Q0 9.2 -1.8 8.2Z", comb: "M0 -6.8V-2.8", breaths: "M-2.6 2.2H-1.4M1.4 2.2H2.6M-2 3.3H-.8M.8 3.3H2", crown: along(hc, hd, 5.6 * hs) };
    // o.topY: a loop passes the highest point of all its keys, so the scale holds steady from frame to frame
    const crestK = Math.max(1, hs * 0.85), topY = o.topY ?? Math.min(A.top, helm.crown[1] - 10.5 * crestK);
    // Fit into the frame: the ice at iceY, the crest no higher than minTop
    const fit = (iceY = 82.4, minTop = 12) => { const kk = Math.min(0.8, (iceY - minTop) / (G.GROUND - topY));
      return `translate(${(50 - 50 * kk).toFixed(2)} ${(iceY - G.GROUND * kk).toFixed(2)}) scale(${kk.toFixed(3)})`; };
    return { A, P, parts: out, helm, crestK, up, numAt: along(P.pelvis, up, 13), numRot: A.torsoAngle + 90, fit, topY };
  }

  // Draw the parts with a paint table: role -> attributes string (or "" to skip)
  const paint = (F, table) => F.parts.map((p) => { const a = table[p.role]; return a ? `<path d="${p.d}" ${a}/>` : ""; }).join("");
  const helmSvg = (F, fill, line, extra = "") => `<g transform="${F.helm.matrix}"><path d="${F.helm.shape}" ${fill}/>${extra}<path d="${F.helm.shape}" fill="none" ${line}/></g>`;
  const numberSvg = (F, num, style) => `<text x="${fx(F.numAt[0])}" y="${fx(F.numAt[1])}" transform="rotate(${F.numRot} ${fx(F.numAt[0])} ${fx(F.numAt[1])})" text-anchor="middle" dominant-baseline="central" style="${style}">${num}</text>`;

  /* H1 · Illuminated miniature. A knight painted in a Book of Hours: burnished gold leaf, flat tempera with
     white highlights, on a diapered (lozenge) ground in team colour, inside a gold and red-and-blue frame. */
  function illuminated(poseKey, team, num, opts = {}) {
    const F = figure(poseKey, { cape: true }), tk = { ...GD.tokens(team), ...(opts.tk || {}) }, ink = "#2a1c14";
    const id = `mi-${opts.id || poseKey + (team.code || "")}`, leaf = "#D9A93A", leafDk = "#9C6E1C";
    const L = `stroke="${ink}" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"`;
    const body = paint(F, {
      net: `fill="#EDE6D2" ${L}`, shadow: `fill="#000" opacity=".25"`, cape: `fill="${mix(tk.tabard, -0.25)}" ${L}`,
      metal: `fill="${leaf}" ${L}`, shade: `fill="${leafDk}" opacity=".5"`, shine: `fill="none" stroke="#FFF6D6" stroke-width=".7" opacity=".9"`,
      tabard: `fill="${tk.tabard}" ${L}`, hem: `fill="none" stroke="${tk.trim}" stroke-width="1.2"`, pauldron: `fill="${leaf}" ${L}`,
      wood: `fill="#7a5230" ${L}`, tape: `fill="#F4EEDD" ${L}`, catcher: `fill="${leaf}" ${L}`, pocket: `fill="${leafDk}" opacity=".55"`,
      shield: `fill="${tk.tabard}" ${L}`, shieldRim: `fill="none" stroke="${tk.trim}" stroke-width="1"`, cross: `fill="none" stroke="${tk.cross}" stroke-width="1.5" stroke-linecap="round"`,
      padline: `fill="none" stroke="${ink}" stroke-width=".6" opacity=".6"`, sabaton: `fill="#6b6f80" ${L}`, runner: `fill="none" stroke="#F4EEDD" stroke-width="1.4" stroke-linecap="round"`,
      streak: `fill="${leaf}" opacity=".8"`, puck: `fill="${ink}" stroke="#F4EEDD" stroke-width="1.8" paint-order="stroke"`, donut: `fill="#E9A4B8" fill-rule="evenodd" ${L}`,
    });
    const helm = helmSvg(F, `fill="${leaf}"`, `stroke="${ink}" stroke-width="${(1 / F.helm.s).toFixed(2)}"`,
      `<path d="${F.helm.shade}" fill="${leafDk}" opacity=".5"/><path d="M-3.8 -5.2Q-2 -6.6 0 -6.6" fill="none" stroke="#FFF6D6" stroke-width=".5"/><path d="${F.helm.visor}" fill="${ink}"/><path d="${F.helm.breaths}" stroke="${ink}" stroke-width=".45"/>`);
    // Diapered ground: lozenges in two tones of the field, a gold dot at each crossing; then an ice floor with ripples
    const fA = tk.field, fB = mix(tk.field, 0.12), gy = 84;
    return `${G.svgOpen(F.A.pose, opts)}<defs><pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${fA}"/><path d="M5 0L10 5 5 10 0 5Z" fill="${fB}"/><circle cx="5" cy="5" r=".7" fill="${leaf}"/><circle cx="0" cy="0" r=".7" fill="${leaf}"/><circle cx="10" cy="0" r=".7" fill="${leaf}"/><circle cx="0" cy="10" r=".7" fill="${leaf}"/><circle cx="10" cy="10" r=".7" fill="${leaf}"/></pattern></defs>
      <rect width="100" height="100" fill="#F3E9D2"/><rect x="7" y="7" width="86" height="86" fill="url(#${id})"/>
      <path d="M7 ${gy}H93V93H7Z" fill="#DCE6EE"/><path d="M14 88.5h14M40 90h18M70 88h14" stroke="#9FB3C4" stroke-width=".8" stroke-linecap="round"/>
      <g transform="${F.fit(84, 11)}">${body}${helm}${GD.crest(team.code, F.helm.crown, F.helm.dir, { ...tk }, F.crestK)}
      ${numberSvg(F, num, `font: 600 8px Cinzel, Georgia, serif; fill: ${tk.number}; paint-order: stroke; stroke: ${tk.numberEdge}; stroke-width: 1.2`)}</g>
      <rect x="5.5" y="5.5" width="89" height="89" fill="none" stroke="${leaf}" stroke-width="3"/><rect x="2" y="2" width="96" height="96" fill="none" stroke="#2F4B9A" stroke-width="2"/>
      <rect x="2" y="2" width="96" height="96" fill="none" stroke="#B3261E" stroke-width="2" stroke-dasharray="6 6"/>
      ${[[5.5, 5.5], [94.5, 5.5], [5.5, 94.5], [94.5, 94.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${leaf}" stroke="${ink}" stroke-width=".6"/>`).join("")}
      <rect x=".4" y=".4" width="99.2" height="99.2" fill="none" stroke="${ink}" stroke-width=".8"/></svg>`;
  }

  /* H2 · Tapestry. The goalie stitched into the Bayeux Tapestry: wool colours laid on linen, a stitched outline,
     patterned border bands, and a Latin caption like the tapestry's own. */
  const LATIN = { steady: "CVSTOS STABILIS", workhorse: "HIC LABORAT", "hd-stopper": "PERICVLVM VINCIT", wall: "MVRVS", rebound: "HIC PVCK TENET",
    siege: "OBSESSVS", crease: "IN TVRBA PVGNAT", standout: "EGREGIVS", "donut-king": "REX NIHILI", grandpa: "SENEX", "young-gun": "IVVENIS", "style-king": "REX ELEGANTIAE" };
  /* Tapestry colour rules, shared by the drawing and check-colours.cjs. The trim, cross and number rules come from
     Gilded; what changes is the ground (pale linen, not a dark field), so the crest and armour get their own rules. */
  const TAP = { linen: "#EADFC4", thread: "#3A3550", cream: "#F2EBD8", ochre: ["#C9962E", "#94681E"], steel: ["#8E98AA", "#5E6679"] };
  function tapTokens(team) {
    const tk = GD.tokens(team), pal = (team.palette || []).map((c) => c.hex.toUpperCase());
    const tab = tk.tabard === "#000000" ? "#2E2A3A" : tk.tabard;   // a black dye reads as dark indigo wool
    // A gold sweater (Nashville, Vegas) would vanish into ochre armour, so those knights wear blue-grey steel wool
    // (judged for normal vision: the stitched outline keeps tabard and armour apart for every reader)
    const steel = GD.wcag(tab, TAP.ochre[0]) < 1.6 && parseInt(tab.slice(1, 3), 16) - parseInt(tab.slice(5, 7), 16) > 90;
    // The crest stands on the linen: the trim if it shows there (3:1, every kind of vision), else the next team colour, else thread
    const crest = [tk.trim, tab, ...pal].find((h) => GD.wcagAll(h, TAP.linen) >= 3) || TAP.thread;
    const light = GD.wcag(TAP.cream, tab) >= 3;
    return { ...tk, tab, steel, armour: steel ? TAP.steel : TAP.ochre, crest, number: light ? TAP.cream : TAP.thread, numberEdge: light ? TAP.thread : TAP.cream };
  }

  function tapestry(poseKey, team, num, opts = {}) {
    const F = figure(poseKey, { hs: 1.2, topY: opts.topY }), tk = { ...tapTokens(team), ...(opts.tk || {}) };
    const linen = TAP.linen, thread = TAP.thread, id = `tp-${opts.id || poseKey + (team.code || "")}`;
    // Below 100 px a lighter cut: solid outlines, no fine stitching, no caption; the shapes and colours stay
    const lite = opts.lite ?? (opts.size && opts.size < 100);
    // Two wools for the armour, as the tapestry does it: ochre, with a darker ochre on the shaded side
    const sage = "#7E8F5A", rust = "#9E4A3A", tab = tk.tab, tabDk = mix(tab, -0.3), [ochre, ochreDk] = tk.armour;
    const S = lite ? `stroke="${thread}" stroke-width="1.3" stroke-linejoin="round"` : `stroke="${thread}" stroke-width="1.1" stroke-dasharray="1.6 .7" stroke-linejoin="round"`;
    const fine = (w = 0.55) => `fill="none" stroke="${thread}" stroke-width="${w}" stroke-dasharray="1.2 .7" stroke-linecap="round"`;
    const couch = `fill="url(#${id}-c)"`;   // laid-and-couched work: parallel laid threads tied down by small cross stitches
    let lastMetal = "";
    const parts = F.parts.map((p) => {
      const d = p.d, P = (a) => (lite && a === couch ? "" : `<path d="${d}" ${a}/>`);
      if (p.role === "metal") lastMetal = d;
      if (lite && ["ridge", "channel", "padline", "boot", "strap", "lace", "thumb", "cop", "shieldRim"].includes(p.role)) return "";
      switch (p.role) {
        case "net": return P(`fill="#F2EBD8" ${S}`);
        case "metal": case "pauldron": return P(`fill="${ochre}"`) + P(couch) + (p.role === "metal" ? "" : P(`fill="none" ${S}`));
        case "shade": return P(`fill="${ochreDk}"`);
        case "tabard": return P(`fill="${tab}" ${S}`) + P(couch);
        case "hem": return P(`fill="none" stroke="${tk.trim}" stroke-width="1.4" stroke-dasharray="1.6 .7"`);
        case "ridge": return P(fine(0.6));
        case "cop": return P(`fill="${ochre}" ${S}`) + P(`fill="${ochreDk}" opacity=".5"`);
        case "channel": return P(fine(0.6));
        case "padline": return P(`fill="none" stroke="${thread}" stroke-width=".7" stroke-dasharray="1.2 .7"`);
        case "boot": return P(`fill="none" stroke="${thread}" stroke-width=".9"`);
        case "strap": return P(`fill="none" stroke="${rust}" stroke-width="1.5"`) + P(fine(0.4));
        case "sabaton": return P(`fill="${sage}" ${S}`);
        case "runner": return P(`fill="none" stroke="#F2EBD8" stroke-width="1.3"`);
        case "wood": return P(`fill="#7B5434" ${S}`);
        case "tape": return P(`fill="#F2EBD8" ${S}`);
        case "knob": return P(`fill="${thread}"`);
        case "cuff": return P(`fill="${tabDk}" ${S}`);
        case "catcher": return P(`fill="${ochre}" ${S}`) + P(couch);
        case "thumb": return P(`fill="${ochreDk}" ${S}`);
        case "pocket": return P(`fill="${ochreDk}" opacity=".7"`);
        case "lace": return P(`fill="none" stroke="${thread}" stroke-width="1.5"`) + P(`fill="none" stroke="#F2EBD8" stroke-width=".7" stroke-dasharray=".8 .6"`);
        case "shield": return P(`fill="${tab}" ${S}`) + P(couch);
        case "shieldRim": return P(`fill="none" stroke="${tk.trim}" stroke-width="1.1" stroke-dasharray="1.6 .7"`);
        case "cross": return P(`fill="none" stroke="${tk.cross}" stroke-width="1.5" stroke-dasharray="1.6 .5"`);
        case "streak": return P(`fill="${ochre}" opacity=".9"`);
        case "puck": return P(`fill="${thread}" stroke="#F2EBD8" stroke-width="1.6" paint-order="stroke"`);
        case "donut": return P(`fill="#D98FA0" fill-rule="evenodd" ${S}`);
        case "shine": return `<path d="${lastMetal}" fill="none" ${S}/>`;   // each limb's stitched edge, over its dark side
        default: return "";   // shadow, cape: not part of the tapestry look
      }
    });
    const H = F.helm;
    const helm = `<g transform="${H.matrix}"><path d="${H.dangler}" fill="${ochre}" stroke="${thread}" stroke-width=".8"/><path d="${H.shape}" fill="${ochre}"/>${lite ? "" : `<path d="${H.shape}" ${couch}/>`}<path d="${H.shade}" fill="${ochreDk}"/>
      ${lite ? "" : `<path d="${H.comb}" stroke="${thread}" stroke-width=".6" stroke-dasharray="1 .6"/>`}<path d="${H.cageHole}" fill="${thread}"/>${lite ? "" : `<path d="${H.cage}" fill="none" stroke="#F2EBD8" stroke-width=".6"/>`}
      <path d="${H.shape}" fill="none" stroke="${thread}" stroke-width="${(1.1 / H.s).toFixed(2)}" stroke-dasharray="1.4 .6"/></g>`;
    // Border bands: diagonal panels with small stitched roundels, top and bottom
    const band = (y) => { let d = ""; for (let x = 0; x < 100; x += 12.5) d += `M${x} ${y}L${x + 12.5} ${y + 9}`; return `<rect x="0" y="${y}" width="100" height="9" fill="#E2D3B0"/><path d="${d}" stroke="${thread}" stroke-width=".7" stroke-dasharray="1.4 .6"/>`; };
    const motifs = (y) => [6, 31, 56, 81].map((x, i) => `<circle cx="${x + 3}" cy="${y + 4.5}" r="1.7" fill="${[tab, sage, ochre, rust][i]}"/>`).join("");
    return `${G.svgOpen(F.A.pose, opts)}<defs><pattern id="${id}-c" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><path d="M0 .75H3M0 2.25H3" stroke="#000" stroke-width=".55" opacity=".16"/><path d="M1.5 0V3" stroke="#fff" stroke-width=".3" opacity=".22" stroke-dasharray=".7 2.3"/></pattern>
      <pattern id="${id}-w" width="1.6" height="1.6" patternUnits="userSpaceOnUse"><path d="M0 .8H1.6M.8 0V1.6" stroke="#B9A983" stroke-width=".25" opacity=".55"/></pattern></defs>
      <rect width="100" height="100" fill="${linen}"/><rect width="100" height="100" fill="url(#${id}-w)"/>${band(0)}${motifs(0)}${band(91)}${motifs(91)}
      ${lite ? "" : `<text x="50" y="17.5" text-anchor="middle" style="font: 600 5.6px Cinzel, Georgia, serif; letter-spacing: .4px; fill: ${thread}">${LATIN[poseKey.split(/[#@]/)[0]] || ""}</text>`}
      <path d="M8 84.5C24 82.5 40 86 56 84S86 83 92 84.5" fill="none" stroke="${sage}" stroke-width="1.4" stroke-dasharray="1.6 .7"/>
      <g transform="${F.fit(84, lite ? 12 : 21)}">${parts.join("")}${helm}${GD.crest(team.code, F.helm.crown, F.helm.dir, { trim: tk.crest }, F.crestK)}
      ${numberSvg(F, num, `font: 600 8px Cinzel, Georgia, serif; fill: ${tk.number}; paint-order: stroke; stroke: ${tk.numberEdge}; stroke-width: 1.2`)}</g>
      <rect x=".5" y=".5" width="99" height="99" fill="none" stroke="${thread}"/></svg>`;
  }

  /* H3 · Woodcut. A hand-coloured woodcut from an early printed chronicle: heavy black line and hatching cut on
     cream paper, then washed by hand in the team colour and ochre, a little outside the lines. */
  function woodcut(poseKey, team, num, opts = {}) {
    const F = figure(poseKey, { hs: 1.15, lw: 1.05 }), tk = { ...GD.tokens(team), ...(opts.tk || {}) };
    const blk = "#17130f", paper = "#F2E7CC", id = `wc-${opts.id || poseKey + (team.code || "")}`, hatch = `url(#${id})`;
    const L = `stroke="${blk}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"`;
    const wash = (h) => `fill="${h}" fill-opacity=".85"`;
    const body = paint(F, {
      net: `fill="${paper}" ${L}`, shadow: `fill="${hatch}"`, cape: "",
      metal: `${wash("#E2B65A")} ${L}`, shade: `fill="${hatch}"`, shine: "",
      tabard: `${wash(tk.tabard)} ${L}`, hem: `fill="none" stroke="${tk.trim}" stroke-width="1.2"`, pauldron: `${wash("#E2B65A")} ${L}`,
      wood: `fill="#8a5f36" ${L}`, tape: `fill="${paper}" ${L}`, catcher: `${wash("#E2B65A")} ${L}`, pocket: `fill="${hatch}"`,
      shield: `${wash(tk.tabard)} ${L}`, shieldRim: `fill="none" stroke="${tk.trim}" stroke-width="1"`, cross: `fill="none" stroke="${tk.cross}" stroke-width="1.5"`,
      padline: `fill="none" stroke="${blk}" stroke-width=".9"`, sabaton: `fill="${blk}"`, runner: `fill="none" stroke="${paper}" stroke-width="1.3"`,
      streak: `fill="${blk}"`, puck: `fill="${blk}" stroke="${paper}" stroke-width="1.6" paint-order="stroke"`, donut: `fill="#E9A4B8" fill-rule="evenodd" ${L}`,
    });
    const helm = helmSvg(F, wash("#E2B65A"), `stroke="${blk}" stroke-width="${(1.5 / F.helm.s).toFixed(2)}"`,
      `<path d="${F.helm.shade}" fill="${hatch}"/><path d="${F.helm.visor}" fill="${blk}"/><path d="${F.helm.breaths}" stroke="${blk}" stroke-width=".6"/>`);
    // Ground: cut tufts and a few strokes of ice; a double rule frame and a cut cloud
    return `${G.svgOpen(F.A.pose, opts)}<defs><pattern id="${id}" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><path d="M0 1.1H2.2" stroke="${blk}" stroke-width=".9"/></pattern></defs>
      <rect width="100" height="100" fill="${paper}"/><rect x="5" y="5" width="90" height="90" fill="${mix(tk.tabard, 0.82)}" fill-opacity=".55"/>
      <path d="M14 22c2-5 9-5 11-1 3-3 9-2 9 2 3 0 4 4 1 5H15c-4 0-4-5-1-6Z" fill="${paper}" stroke="${blk}" stroke-width="1.1"/>
      <path d="M5 84H95V95H5Z" fill="${paper}"/><path d="M5 84H95" stroke="${blk}" stroke-width="1.4"/>
      <path d="M10 88h10M30 90.5h16M58 88.5h12M78 91h10" stroke="${blk}" stroke-width=".9" stroke-linecap="round"/>
      <g transform="${F.fit(84)}">${body}${helm}${GD.crest(team.code, F.helm.crown, F.helm.dir, tk, F.crestK)}
      ${numberSvg(F, num, `font: 600 8px Cinzel, Georgia, serif; fill: ${tk.number}; paint-order: stroke; stroke: ${tk.numberEdge}; stroke-width: 1.3`)}</g>
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="${blk}" stroke-width="2"/><rect x="2" y="2" width="96" height="96" fill="none" stroke="${blk}" stroke-width="1"/></svg>`;
  }

  /* H4 · Marginalia. A knight doodled in the margin of a manuscript page, the way scribes drew odd little
     figures beside the text: brown ink and pale washes on vellum, beside ruled lines and a gilded ivy border. */
  function marginalia(poseKey, team, num, opts = {}) {
    const F = figure(poseKey, { cape: true, hs: 1.3 }), tk = { ...GD.tokens(team), ...(opts.tk || {}) };
    const brown = "#4A2E1C", vellum = "#F4EAD3", gilt = "#D2A23A";
    const L = `stroke="${brown}" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round"`;
    const body = paint(F, {
      net: `fill="${vellum}" ${L}`, shadow: `fill="${brown}" opacity=".18"`, cape: `fill="${tk.tabard}" fill-opacity=".55" ${L}`,
      metal: `fill="#E9D7A6" ${L}`, shade: `fill="${brown}" opacity=".16"`, shine: "",
      tabard: `fill="${tk.tabard}" ${L}`, hem: `fill="none" stroke="${tk.trim}" stroke-width="1.1"`, pauldron: `fill="#E9D7A6" ${L}`,
      wood: `fill="#9a6a3c" ${L}`, tape: `fill="${vellum}" ${L}`, catcher: `fill="#E9D7A6" ${L}`, pocket: `fill="${brown}" opacity=".2"`,
      shield: `fill="${tk.tabard}" ${L}`, shieldRim: `fill="none" stroke="${tk.trim}" stroke-width=".9"`, cross: `fill="none" stroke="${tk.cross}" stroke-width="1.3"`,
      padline: `fill="none" stroke="${brown}" stroke-width=".5"`, sabaton: `fill="#8C8A86" ${L}`, runner: `fill="none" stroke="${brown}" stroke-width=".8"`,
      streak: `fill="${brown}" opacity=".5"`, puck: `fill="${brown}" stroke="${vellum}" stroke-width="1.6" paint-order="stroke"`, donut: `fill="#E9A4B8" fill-rule="evenodd" ${L}`,
    });
    const helm = helmSvg(F, `fill="#E9D7A6"`, `stroke="${brown}" stroke-width="${(.9 / F.helm.s).toFixed(2)}"`,
      `<path d="${F.helm.shade}" fill="${brown}" opacity=".16"/><path d="${F.helm.visor}" fill="${brown}"/>`);
    const lines = [12, 18, 24].map((y, i) => `<path d="M30 ${y}H${92 - i * 14}" stroke="${brown}" stroke-width="1.6" stroke-dasharray="${[3, 1.2, 5, 1.2, 2, 1.2].join(" ")}" opacity=".45"/>`).join("");
    const ivy = [20, 36, 52, 68].map((y, i) => `<path d="M7 ${y}c${i % 2 ? 4 : -1} -2 5 -6 3 -8 -3 1 -4 5 -3 8Z" fill="${gilt}" stroke="${brown}" stroke-width=".4"/>`).join("");
    return `${G.svgOpen(F.A.pose, opts)}<rect width="100" height="100" fill="${vellum}"/>
      <rect x="18" y="5" width="9" height="9" fill="${tk.tabard}"/><text x="22.5" y="12.6" text-anchor="middle" style="font: 600 8px Cinzel, Georgia, serif; fill: ${gilt}">G</text>${lines}
      <path d="M6 6V94" stroke="${gilt}" stroke-width="1.6"/><path d="M6 10c3 8-3 12 0 20s-3 12 0 20 -3 12 0 20 -3 12 0 20" fill="none" stroke="${brown}" stroke-width=".6"/>${ivy}
      <path d="M14 85C30 83 50 86 92 84" fill="none" stroke="${brown}" stroke-width=".8"/>
      <g transform="${F.fit(85, 16)}">${body}${helm}${GD.crest(team.code, F.helm.crown, F.helm.dir, tk, F.crestK)}
      ${numberSvg(F, num, `font: 600 8px Cinzel, Georgia, serif; fill: ${tk.number}; paint-order: stroke; stroke: ${tk.numberEdge}; stroke-width: 1.2`)}</g>
      <rect x=".5" y=".5" width="99" height="99" fill="none" stroke="#C9B48A"/></svg>`;
  }

  const STYLES = {
    illuminated: { name: "Illuminated Miniature", conceit: "A knight painted in a Book of Hours: gold leaf, flat colour with white highlights, on a diapered ground in team colour.", draw: illuminated },
    tapestry: { name: "Tapestry", conceit: "Stitched into the Bayeux Tapestry: wool on linen, a stitched outline, border bands and a Latin caption.", draw: tapestry },
    woodcut: { name: "Woodcut", conceit: "A hand-coloured woodcut from an early printed chronicle: heavy cut line and hatching, washed in team colour.", draw: woodcut },
    marginalia: { name: "Marginalia", conceit: "A knight doodled in a manuscript's margin: brown ink and pale washes beside the text and a gilded ivy border.", draw: marginalia },
  };
  return { figure, STYLES, LATIN, TAP, tapTokens };
});
