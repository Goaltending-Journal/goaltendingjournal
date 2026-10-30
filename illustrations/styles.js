/* Goalie illustrations, Step 3: the styles library. Each style is a function
   (poseKey, team colours, sweater number, opts) -> SVG string, built on GoalieSkeleton.parts(),
   so every style reuses the same poses. Kept even when not chosen; see README.md.
   Works in the browser (window.GoalieStyles, after goalie-skeleton.js) and in Node (require). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./goalie-skeleton.js"));
  else root.GoalieStyles = factory(root.GoalieSkeleton);
})(typeof self !== "undefined" ? self : this, function (G) {
  "use strict";

  // Mix a hex colour toward white (t > 0) or black (t < 0)
  function mix(hex, t) {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
    const to = t > 0 ? 255 : 0, a = Math.abs(t);
    return "#" + c.map((v) => Math.round(v + (to - v) * a).toString(16).padStart(2, "0")).join("");
  }
  const wcag = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  // Gear trim: the team's second colour, unless it is white (the pads are already white) or too close to the jersey
  const trim = (t) => (t.secondary.toUpperCase() === "#FFFFFF" ? "#F4F5F8" : Math.abs(lum(t.secondary) - lum(t.primary)) < 0.02 ? t.accent : t.secondary);
  // A second ink that shows on paper and differs from the first: the gear colour, else the accent, else a tint
  const ink2Of = (t) => {
    const g = trim(t);
    if (lum(g) < 0.8 && lum(g) > 0.01) return g;
    return t.accent.toUpperCase() !== t.primary.toUpperCase() ? t.accent : mix(t.primary, 0.5);
  };
  // The figure sits inside each style's frame: ice at y = 82, the top no higher than y = 10
  // topY: one top for a whole motion loop, so the figure keeps its scale from frame to frame
  // Light Box: the gear outline, the team colour darkened until it reaches 3:1 on the box
  const XRAY_BOX = "#dde9f1";
  const xrayEdge = (hex) => { let e = mix(hex, -0.3); for (let k = 0.4; k < 1 && wcag(e, XRAY_BOX) < 3; k += 0.1) e = mix(hex, -k); return e; };
  const inset = (A, max = 0.82, topY) => {
    const k = Math.min(max, 72 / (G.GROUND - (topY ?? A.top)));
    return `translate(${(50 - 50 * k).toFixed(2)} ${(82.4 - G.GROUND * k).toFixed(2)}) scale(${k.toFixed(3)})`;
  };

  function number(A, text, attrs) {
    const [x, y] = A.chest;
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${A.torsoAngle + 90} ${x.toFixed(1)} ${y.toFixed(1)})" text-anchor="middle" dominant-baseline="central" style="${attrs}">${text}</text>`;
  }

  // Which colour each part takes in a flat-colour style
  function roleFill(role, t, gear) {
    return {
      net: "#C8102E", shadow: "#000", thigh: mix(t.primary, -0.35), pad: "#F4F5F8", skate: "#22232a",
      torso: t.primary, arm: t.primary, glove: gear, blocker: gear, mask: "#F4F5F8",
      shaft: "#2a2b33", paddle: "#2a2b33", blade: "#F4F5F8", puck: "#15161b", donut: "#E9A4B8", streak: "#9aa0b8",
    }[role];
  }

  /* A · Stained glass. Conceit: each goalie is a cathedral window, lead lines and panes of team colour. */
  function glass(poseKey, t, num, opts = {}) {
    const A = G.parts(poseKey), gear = trim(t), lead = "#17171f";
    const panes = [];
    // Background panes: a fixed irregular grid of glass in two cool tints
    const cols = [0, 22, 47, 71, 100], rows = [0, 26, 55, 78, 100];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const jig = ((i * 7 + j * 3) % 5) - 2;
      const x0 = cols[i], x1 = cols[i + 1], y0 = rows[j] + (i % 2 ? jig : 0), y1 = rows[j + 1] + (i % 2 ? 0 : jig);
      panes.push(`<path d="M${x0} ${y0}L${x1} ${rows[j] - jig}L${x1} ${y1}L${x0} ${rows[j + 1]}Z" fill="${(i + j) % 2 ? "#c9d3ef" : "#aebce6"}"/>`);
    }
    const body = A.parts.map((p) => {
      const fill = roleFill(p.role, t, gear);
      if (p.role === "shadow") return `<path d="${p.d}" fill="#000" opacity=".25"/>`;
      return `<path d="${p.d}" fill="${fill}" fill-rule="evenodd" stroke="${lead}" stroke-width="2" stroke-linejoin="round"/>`;
    }).join("");
    const arch = "M4 100V34A46 30 0 0 1 96 34V100Z";
    return `${G.svgOpen(A.pose, opts)}<defs><clipPath id="arch-${poseKey}"><path d="${arch}"/></clipPath></defs>
      <g clip-path="url(#arch-${poseKey})"><g stroke="${lead}" stroke-width="1.6">${panes.join("")}</g><g transform="${inset(A)}">${body}
      ${number(A, num, `font: 600 8.5px Jost, Futura, sans-serif; fill: #fff; paint-order: stroke; stroke: ${lead}; stroke-width: 1.6`)}</g></g>
      <path d="${arch}" fill="none" stroke="${lead}" stroke-width="4"/></svg>`;
  }

  /* B · Research plate. Conceit: a figure from the journal, each goalie drafted in white line on a team-colour plate. */
  function plate(poseKey, t, num, opts = {}) {
    const A = G.parts(poseKey), ground = mix(t.primary, -0.45), line = "#f4f6ff";
    const grid = [];
    for (let v = 10; v < 100; v += 10) grid.push(`<path d="M${v} 0V100M0 ${v}H100"/>`);
    const body = A.parts.filter((p) => p.role !== "shadow").map((p) =>
      `<path d="${p.d}" fill="${p.role === "torso" || p.role === "arm" ? mix(t.primary, -0.1) : ground}" fill-rule="evenodd" stroke="${line}" stroke-width="${p.role === "streak" ? 0.6 : 0.9}" stroke-linejoin="round"/>`).join("");
    const P = A.P, x = Math.max(P.toeL[0], P.toeR[0], P.ankleR[0]) + 6;
    const top = Math.min(P.head[1] - 5.6, ...A.parts.filter((p) => p.role === "glove").map(() => P.handGlove[1] - 6.6));
    const fig = `FIG. ${G.ORDER.indexOf(poseKey) + 1}  ${A.pose.name.toUpperCase()}`;
    return `${G.svgOpen(A.pose, opts)}<rect width="100" height="100" fill="${ground}"/>
      <g stroke="${line}" stroke-width=".25" opacity=".22">${grid.join("")}</g><g transform="${inset(A)}">${body}
      ${number(A, num, `font: 600 8px Jost, Futura, sans-serif; fill: none; stroke: ${line}; stroke-width: .6`)}
      <g stroke="${line}" stroke-width=".6" fill="none" opacity=".85"><path d="M${Math.min(x, 100)} ${top.toFixed(1)}V${G.GROUND}M${Math.min(x, 100) - 2} ${top.toFixed(1)}h4M${Math.min(x, 100) - 2} ${G.GROUND}h4"/></g></g>
      <text x="4" y="7" style="font: 500 4.2px Jost, Futura, sans-serif; letter-spacing: .12em; fill: ${line}">${fig}</text></svg>`;
  }

  /* C · Two-ink risograph. Conceit: a club-room print in two team inks, halftone shading and a little misregistration. */
  function riso(poseKey, t, num, opts = {}) {
    const A = G.parts(poseKey), paper = "#eceef6", ink1 = t.primary, ink2 = ink2Of(t);
    const id = `ht-${poseKey}`;
    const ink1Roles = ["torso", "arm", "thigh", "mask", "net"];
    const layer1 = A.parts.filter((p) => ink1Roles.includes(p.role)).map((p) => `<path d="${p.d}" fill-rule="evenodd"/>`).join("");
    const layer2 = A.parts.filter((p) => !ink1Roles.includes(p.role) && p.role !== "shadow").map((p) =>
      `<path d="${p.d}" fill-rule="evenodd" fill="${p.role === "pad" ? `url(#${id})` : ink2}"/>`).join("");
    return `${G.svgOpen(A.pose, opts)}<defs><pattern id="${id}" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="1.2" cy="1.2" r=".85" fill="${ink2}"/></pattern></defs>
      <rect width="100" height="100" fill="${paper}"/>
      <rect x="6" y="6" width="88" height="88" fill="${ink2}" opacity=".12"/>
      <g transform="${inset(A)}"><g style="mix-blend-mode: multiply" fill="${ink1}">${layer1}</g>
      <g style="mix-blend-mode: multiply" transform="translate(1.1 .7)" stroke="${ink2}" stroke-width=".9">${layer2}</g>
      ${number(A, num, `font: 600 8.5px Jost, Futura, sans-serif; fill: ${paper}`)}</g></svg>`;
  }

  /* C · Illuminated plate. Conceit: a page from the GRJ's book of keepers, flat colour in ink outline inside a gilded frame.
     Round 2: a pale gilded nimbus behind the figure lifts dark jerseys off the navy field. */
  function illuminated(poseKey, t, num, opts = {}) {
    const A = G.parts(poseKey), gear = trim(t), ink = "#14152a", gold = "#C9A54A", field = "#262B63";
    const id = `dia-${poseKey}`;
    const body = A.parts.map((p) => {
      if (p.role === "shadow") return `<path d="${p.d}" fill="#000" opacity=".3"/>`;
      let fill = roleFill(p.role, t, gear);
      if (p.role === "pad") fill = "#F7F3E6";
      if (p.role === "net") fill = gold;
      if (p.role === "glove" || p.role === "blocker") fill = lum(gear) < 0.02 ? gold : gear;
      return `<path d="${p.d}" fill="${fill}" fill-rule="evenodd" stroke="${ink}" stroke-width="1.1" stroke-linejoin="round"/>`;
    }).join("");
    return `${G.svgOpen(A.pose, opts)}<defs><pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M4 2.4L5.6 4 4 5.6 2.4 4Z" fill="${gold}" opacity=".45"/></pattern><radialGradient id="halo-${poseKey}" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#F3ECD2"/><stop offset=".72" stop-color="#E4D6A8"/><stop offset="1" stop-color="#E4D6A8" stop-opacity="0"/></radialGradient></defs>
      <rect width="100" height="100" fill="${gold}"/><rect x="3" y="3" width="94" height="94" fill="${field}"/><rect x="3" y="3" width="94" height="94" fill="url(#${id})"/>
      <rect x="5.5" y="5.5" width="89" height="89" fill="none" stroke="${gold}" stroke-width=".8"/>
      ${[[3, 3], [97, 3], [3, 97], [97, 97]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${gold}" stroke="${ink}" stroke-width=".6"/>`).join("")}
      <path d="M17 ${(7 + 0.82 * G.GROUND).toFixed(1)}V40A33 30 0 0 1 83 40V${(7 + 0.82 * G.GROUND).toFixed(1)}Z" fill="url(#halo-${poseKey})" stroke="${gold}" stroke-width=".8"/>
      <path d="M5.5 ${(7 + 0.82 * G.GROUND).toFixed(1)}H94.5V94.5H5.5Z" fill="#3a417f"/><g transform="${inset(A)}">${body}
      ${number(A, num, `font: 600 8.5px Jost, Futura, sans-serif; fill: #fff; paint-order: stroke; stroke: ${ink}; stroke-width: 1.2`)}</g></svg>`;
  }


  // Path helpers for styles that draw their own shapes from the skeleton's joints
  const fx = (n) => Math.round(n * 10) / 10;
  const P2 = (p) => `${fx(p[0])} ${fx(p[1])}`;
  const unit = (a, b) => { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]) || 1; return [d[0] / L, d[1] / L]; };
  const along = (p, u, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
  const circ = (c, r) => `M${fx(c[0] - r)} ${fx(c[1])}a${fx(r)} ${fx(r)} 0 1 0 ${fx(2 * r)} 0a${fx(r)} ${fx(r)} 0 1 0 ${fx(-2 * r)} 0Z`;
  const stad = (a, b, w) => {
    const u = unit(a, b), r = w / 2, n = [-u[1] * r, u[0] * r];
    return `M${P2([a[0] + n[0], a[1] + n[1]])}L${P2([b[0] + n[0], b[1] + n[1]])}A${fx(r)} ${fx(r)} 0 0 1 ${P2([b[0] - n[0], b[1] - n[1]])}L${P2([a[0] - n[0], a[1] - n[1]])}A${fx(r)} ${fx(r)} 0 0 1 ${P2([a[0] + n[0], a[1] + n[1]])}Z`;
  };
  // A long bone: a shaft with two knuckles at each end
  const bone = (a, b, w) => {
    const u = unit(a, b), n = [-u[1], u[0]], k = w * 0.55;
    return stad(along(a, u, w * 0.4), along(b, u, -w * 0.4), w * 0.55) +
      [[a, 1], [b, -1]].map(([p, sgn]) => circ(along(along(p, u, sgn * w * 0.25), n, k), w * 0.45) + circ(along(along(p, u, sgn * w * 0.25), n, -k), w * 0.45)).join("");
  };
  const LIMBS = [["shBlocker", "elbowBlocker"], ["elbowBlocker", "handBlocker"], ["shGlove", "elbowGlove"], ["elbowGlove", "handGlove"], ["hipL", "kneeL"], ["hipR", "kneeR"]];

  /* E · Skeletons. Conceit: the bone crew. Every goalie is a skeleton still suiting up, glowing in team colour after dark. */
  /* Variants: "night" (round 2), "xray" (a light box: see-through gear in team colour over the bones),
     "bold" (chunky one-piece bones and a light team-tint card, built to read at 32 px). */
  const skeletons = (variant = "night") => function (poseKey, t, num, opts = {}) {
    const A = G.parts(poseKey), P = A.P, glow = ink2Of(t) === "#000000" ? t.accent : mix(t.primary, 0.25);
    const xray = variant === "xray", bold = variant === "bold";
    // Light Box, round 2 (Goldy, 2026-10-30): a light cut below 100 px (denser gear, plain bones, no grid, label or number),
    // a gear outline darkened to 3:1 on the box, a bigger figure and a firm card edge
    const lite = xray && opts.size && opts.size < 100, BOX = XRAY_BOX;
    const edge = xray ? xrayEdge(t.primary) : mix(t.primary, -0.3);
    const ivory = xray ? "#FBFDFF" : "#EEE6CF", ink = xray ? "#1d3346" : "#0f1016";
    const keep = new Set(["net", "pad", "skate", "glove", "blocker", "shaft", "paddle", "blade", "puck", "donut", "streak", "torso"]);
    const gear = A.parts.map((p) => {
      if (p.role === "shadow") return `<path d="${p.d}" fill="${glow}" opacity=".35"/>`;
      if (!keep.has(p.role)) return "";
      const fill = { net: ivory, pad: t.primary, skate: ivory, glove: t.primary, blocker: t.primary, shaft: "#3a2e24", paddle: "#3a2e24", blade: ivory,
        puck: ivory, donut: "#E9A4B8", streak: glow, torso: t.primary }[p.role];
      const seeThrough = xray && ["pad", "glove", "blocker", "torso"].includes(p.role);
      return `<path d="${p.d}" fill="${fill}"${seeThrough ? ` fill-opacity="${lite ? ".85" : ".6"}"` : ""} fill-rule="evenodd" stroke="${p.role === "torso" && !xray ? ivory : xray ? edge : ink}" stroke-width="${bold ? 1.5 : p.role === "torso" ? 1 : 1.1}" stroke-linejoin="round"/>`;
    }).join("");
    // Pads get bone-white straps, the torso a ribcage over the jersey
    const straps = ["L", "R"].map((s) => {
      const k = P["knee" + s], a = P["ankle" + s], u = unit(k, a), n = [-u[1], u[0]];
      return [0.3, 0.65].map((f) => { const c = along(k, u, 20 * f); return `<path d="M${P2(along(c, n, -5.5))}L${P2(along(c, n, 5.5))}" stroke="${ivory}" stroke-width="1.4"/>`; }).join("");
    }).join("");
    const up = unit(P.pelvis, P.neck), side = [-up[1], up[0]];
    const spine = `<path d="M${P2(along(P.pelvis, up, 2))}L${P2(along(P.neck, up, -2))}" stroke="${xray ? ink : ivory}" stroke-width="${bold ? 2.4 : 1.8}" stroke-dasharray="${bold ? "2.4 1.1" : "1.6 .9"}"/>`;
    const ribs = [0.55, 0.68, 0.8].map((f) => {
      const c = along(P.pelvis, up, 24 * f), w = 7.5 - (f - 0.55) * 6;
      return `<path d="M${P2(along(along(c, side, -w), up, -2))}Q${P2(c)} ${P2(along(along(c, side, w), up, -2))}" fill="none" stroke="${xray ? ink : ivory}" stroke-width="${bold ? 2.3 : 1.5}" stroke-linecap="round"/>`;
    }).join("");
    const limb = (a, b, w) => bold || lite ? stad(a, b, lite ? 4.6 : 4.2) : bone(a, b, w);
    const bones = LIMBS.map(([a, b]) => `<path d="${limb(P[a], P[b], 4.6)}" fill="${ivory}" stroke="${ink}" stroke-width="${bold ? 1.2 : lite ? 1.1 : 0.7}"/>`).join("") +
      (xray && !lite ? ["L", "R"].map((s) => `<path d="${bone(P["knee" + s], P["ankle" + s], 3.6)}" fill="${ivory}" stroke="${ink}" stroke-width=".6"/>`).join("") : "");
    // Skull, facing the way the head points
    const h = P.head, hd = unit(P.neck, h), hn = [-hd[1], hd[0]];
    const eye = (sgn) => circ(along(along(h, hn, sgn * 2.1), hd, 0.6), 1.35);
    const skull = `<path d="${circ(h, 5.4)}" fill="${ivory}" stroke="${ink}" stroke-width=".8"/>
      <path d="${stad(along(h, hd, -5), along(h, hd, -6.4), 6)}" fill="${ivory}" stroke="${ink}" stroke-width=".7"/>
      <path d="${eye(1)}${eye(-1)}" fill="${ink}"/><path d="M${P2(along(h, hd, -1.4))}l.6 1.4h-1.2Z" fill="${ink}"/>`
      // On the light box the skull wears a goalie cage, in the gear's colour
      + (xray ? `<path d="${[-2.6, 0, 2.6].map((o) => `M${P2(along(along(h, hd, 0.4), hn, o))}L${P2(along(along(h, hd, -6.6), hn, o * 0.8))}`).join("")}${[-2.2, -4.6].map((o) => `M${P2(along(along(h, hd, o), hn, -4.2))}Q${P2(along(h, hd, o - 0.8))} ${P2(along(along(h, hd, o), hn, 4.2))}`).join("")}" fill="none" stroke="${edge}" stroke-width="${lite ? 1.1 : 0.8}" stroke-linecap="round"/>` : "");
    const gy = (7 + 0.82 * G.GROUND).toFixed(1);
    let ground;
    if (xray) {
      const lines = [];
      if (!lite) for (let v = 12.5; v < 100; v += 12.5) lines.push(`<path d="M${v} 0V100M0 ${v}H100"/>`);
      const tag = `${A.pose.name} · ${t.code || t.name}`.toUpperCase();
      ground = `<rect x=".6" y=".6" width="98.8" height="98.8" rx="3" fill="${BOX}" stroke="#5d7d95" stroke-width="1.2"/><g stroke="#b9cddb" stroke-width=".4">${lines.join("")}</g>
        ${lite ? "" : `<rect x="4" y="4" width="92" height="92" rx="2" fill="none" stroke="#9fb7c8" stroke-width="1"/><text x="7" y="93" style="font: 500 3.6px Jost, Futura, sans-serif; letter-spacing: .12em; fill: #56748a">${tag}</text><text x="93" y="11" text-anchor="end" style="font: 600 5px Jost, Futura, sans-serif; fill: #56748a">R</text>`}`;
    } else if (bold) {
      ground = `<rect width="100" height="100" fill="${mix(t.primary, 0.82)}"/><circle cx="50" cy="48" r="34" fill="${mix(t.primary, 0.92)}"/><path d="M0 ${gy}H100V100H0Z" fill="${mix(t.primary, 0.6)}"/>`;
    } else {
      ground = `<defs><radialGradient id="night-${poseKey}" cx="50%" cy="58%" r="62%"><stop offset="0" stop-color="${mix(glow, -0.25)}"/><stop offset=".55" stop-color="${mix(glow, -0.72)}"/><stop offset="1" stop-color="#0b0c12"/></radialGradient></defs>
        <rect width="100" height="100" fill="url(#night-${poseKey})"/><path d="M0 ${gy}H100V100H0Z" fill="#0b0c12" opacity=".6"/>`;
    }
    // On the light box the bones sit over the see-through gear; elsewhere the gear sits under them anyway
    return `${G.svgOpen(A.pose, opts)}${ground}
      <g transform="${inset(A, xray ? 0.86 : 0.82, opts.topY)}">${gear}${xray ? "" : straps}${bones}${spine}${ribs}${skull}
      ${lite ? "" : number(A, num, `font: 600 7.5px Jost, Futura, sans-serif; fill: ${xray ? mix(t.primary, -0.3) : ivory}; paint-order: stroke; stroke: ${xray ? "#fff" : ink}; stroke-width: ${xray ? 2.4 : 1.4}`)}</g></svg>`;
  };

  /* F · Knights. Conceit: the keeper as a knight of the crease, plate armour under a tabard in team colours, shield for a blocker. */
  /* Variants: "stone" (round 2), "tournament" (darker gunmetal armour against a light striped tilt-yard pavilion),
     "gilded" (gold armour on a deep team-colour heraldic field). */
  const STEEL = {
    stone: ["#F2F4F8", "#B8BECC", "#8D94A6"],
    tournament: ["#B9C0CE", "#6F7789", "#3E4454"],
    gilded: ["#FBEFB8", "#D8B256", "#9A6F1F"],
  };
  const knights = (variant = "stone") => function (poseKey, t, num, opts = {}) {
    const A = G.parts(poseKey), P = A.P, ink = "#1d1e26", trimC = t.accent.toUpperCase() !== t.primary.toUpperCase() ? t.accent : "#D9DCE4";
    const steel = `url(#steel-${variant}-${poseKey})`;
    const body = A.parts.map((p) => {
      if (p.role === "shadow") return `<path d="${p.d}" fill="#000" opacity=".3"/>`;
      if (p.role === "blocker" || p.role === "mask") return "";
      const fill = { net: "#8b5a2b", thigh: steel, pad: steel, skate: "#5d6170", torso: t.primary, arm: steel, glove: steel,
        shaft: "#6b4a2e", paddle: "#6b4a2e", blade: "#c9ced8", puck: ink, donut: "#E9A4B8", streak: "#c9ced8" }[p.role];
      return `<path d="${p.d}" fill="${fill}" fill-rule="evenodd" stroke="${p.role === "torso" ? trimC : ink}" stroke-width="${p.role === "torso" ? 1.6 : 1}" stroke-linejoin="round"/>`;
    }).join("");
    // Kite shield on the blocker hand, square to the forearm
    const hb = P.handBlocker, fu = unit(P.elbowBlocker, hb), fn = [-fu[1], fu[0]];
    const sh = [along(along(hb, fu, -6), fn, -6.5), along(along(hb, fu, -6), fn, 6.5), along(hb, fn, 6), along(along(hb, fu, 8), fn, 0), along(hb, fn, -6)];
    const shield = `<path d="M${P2(sh[0])}L${P2(sh[1])}L${P2(sh[2])}Q${P2(along(along(hb, fu, 5), fn, 4))} ${P2(sh[3])}Q${P2(along(along(hb, fu, 5), fn, -4))} ${P2(sh[4])}Z" fill="${t.primary}" stroke="${trimC}" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M${P2(along(hb, fu, -5))}L${P2(along(hb, fu, 6))}M${P2(along(along(hb, fu, -1), fn, -4.5))}L${P2(along(along(hb, fu, -1), fn, 4.5))}" stroke="${trimC}" stroke-width="1"/>`;
    // Great helm with a visor slit and a plume in the trim colour
    const h = P.head, hd = unit(P.neck, h), hn = [-hd[1], hd[0]];
    const c = (a, b) => along(along(h, hd, a), hn, b);
    const helm = `<path d="M${P2(c(5.5, 6))}Q${P2(c(9, 0))} ${P2(c(13, -3))}" fill="none" stroke="${trimC}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M${P2(c(5, -5))}L${P2(c(5, 5))}L${P2(c(-5.5, 5))}L${P2(c(-5.5, -5))}Z" fill="${steel}" stroke="${ink}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M${P2(c(1, -4))}L${P2(c(1, 4))}" stroke="${ink}" stroke-width="1.3"/><path d="M${P2(c(5, 0))}L${P2(c(-5.5, 0))}" stroke="${ink}" stroke-width=".5" opacity=".6"/>`;
    const gy = (7 + 0.82 * G.GROUND).toFixed(1), st = STEEL[variant];
    let ground;
    if (variant === "tournament") {
      const stripes = [];
      for (let x = 0; x < 100; x += 10) stripes.push(`<rect x="${x}" y="0" width="5" height="${gy}" fill="${mix(t.primary, 0.78)}"/>`);
      ground = `<rect width="100" height="100" fill="#fbfbfd"/>${stripes.join("")}
        <path d="M0 0H100V9Q87.5 15 75 9 62.5 15 50 9 37.5 15 25 9 12.5 15 0 9Z" fill="${t.primary}"/>
        <path d="M0 ${gy}H100V100H0Z" fill="#7d9a5a"/><path d="M0 ${gy}H100" stroke="#5f7a40" stroke-width="1"/>`;
    } else if (variant === "gilded") {
      const field = mix(t.primary, -0.45), stars = [];
      for (let y = 8; y < 80; y += 14) for (let x = (y / 14) % 2 ? 14 : 7; x < 100; x += 14) stars.push(`<path d="M${x} ${y - 2.2}L${x + .7} ${y - .7} ${x + 2.2} ${y} ${x + .7} ${y + .7} ${x} ${y + 2.2} ${x - .7} ${y + .7} ${x - 2.2} ${y} ${x - .7} ${y - .7}Z"/>`);
      ground = `<rect width="100" height="100" fill="${field}"/><g fill="#D8B256" opacity=".35">${stars.join("")}</g>
        <path d="M0 ${gy}H100V100H0Z" fill="${mix(t.primary, -0.65)}"/><rect x="2" y="2" width="96" height="96" fill="none" stroke="#D8B256" stroke-width="1.4"/>`;
    } else {
      const blocks = [];
      for (let y = 0; y < 84; y += 8) for (let x = (y / 8) % 2 ? -6 : 0; x < 100; x += 12) blocks.push(`<rect x="${x}" y="${y}" width="12" height="8"/>`);
      ground = `<rect width="100" height="100" fill="#a9a59a"/><g fill="#b7b3a7" stroke="#8d897e" stroke-width=".6">${blocks.join("")}</g>
        <path d="M38 0H62V30L50 24 38 30Z" fill="${t.primary}" stroke="${ink}" stroke-width=".8" opacity=".9"/><path d="M38 0H62V3H38Z" fill="${trimC}"/>
        <path d="M0 ${gy}H100V100H0Z" fill="#6e6a60"/>`;
    }
    return `${G.svgOpen(A.pose, opts)}<defs><linearGradient id="steel-${variant}-${poseKey}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${st[0]}"/><stop offset=".5" stop-color="${st[1]}"/><stop offset="1" stop-color="${st[2]}"/></linearGradient></defs>
      ${ground}
      <g transform="${inset(A)}">${body}${shield}${helm}
      ${number(A, num, `font: 600 8px Jost, Futura, sans-serif; fill: #fff; paint-order: stroke; stroke: ${ink}; stroke-width: 1.3`)}</g></svg>`;
  };

  /* G · High fantasy. Conceit: an epic-quest keeper, rune-lit armour and a team-colour cloak against a dusk sky over far mountains. */
  function fantasy(poseKey, t, num, opts = {}) {
    const A = G.parts(poseKey), P = A.P, ink = "#16112a", gold = "#E2B85A";
    const rune = mix(t.accent.toUpperCase() !== t.primary.toUpperCase() ? t.accent : t.primary, 0.45);
    const dark = mix(t.primary, -0.55);
    // A cloak from the shoulders, flaring behind the body toward the ice
    const up = unit(P.pelvis, P.neck), side = [-up[1], up[0]];
    const sb = P.shBlocker, sg = P.shGlove, foot = Math.max(P.ankleL[1], P.ankleR[1]) - 4;
    const cloak = `<path d="M${P2(sb)}C${P2([sb[0] - 10, sb[1] + 20])} ${P2([P.pelvis[0] - 20, foot - 6])} ${P2([P.pelvis[0] - 18, foot])}L${P2([P.pelvis[0] + 18, foot])}C${P2([P.pelvis[0] + 20, foot - 6])} ${P2([sg[0] + 10, sg[1] + 20])} ${P2(sg)}Z" fill="${dark}" stroke="${ink}" stroke-width="1"/>`;
    const body = A.parts.map((p) => {
      if (p.role === "shadow") return `<path d="${p.d}" fill="${rune}" opacity=".4"/>`;
      const fill = { net: gold, thigh: "#2f2846", pad: "#3b3358", skate: "#2f2846", torso: t.primary, arm: "#3b3358", glove: "#3b3358", blocker: "#3b3358",
        mask: "#3b3358", shaft: "#4a3a2a", paddle: "#4a3a2a", blade: gold, puck: ink, donut: "#E9A4B8", streak: rune }[p.role];
      const glowing = ["pad", "glove", "blocker", "mask", "paddle"].includes(p.role);
      return `<path d="${p.d}" fill="${fill}" fill-rule="evenodd" stroke="${glowing ? rune : p.role === "torso" ? gold : ink}" stroke-width="${glowing ? 1.2 : 1}" stroke-linejoin="round"${glowing ? ` filter="url(#glow-${poseKey})"` : ""}/>`;
    }).join("");
    // Pauldrons, and horns on the helm
    const pauldrons = [sb, sg].map((s) => `<path d="${circ(s, 5.2)}" fill="${gold}" stroke="${ink}" stroke-width="1"/>`).join("");
    const h = P.head, hd = unit(P.neck, h), hn = [-hd[1], hd[0]];
    const horn = (sgn) => { const b = along(along(h, hn, sgn * 4), hd, 2); return `<path d="M${P2(b)}Q${P2(along(along(b, hn, sgn * 6), hd, 1))} ${P2(along(along(b, hn, sgn * 5), hd, 8))}Q${P2(along(along(b, hn, sgn * 3), hd, 3))} ${P2(along(b, hd, -1.5))}Z" fill="#E9E1C8" stroke="${ink}" stroke-width=".8"/>`; };
    const eyes = `<path d="M${P2(along(along(h, hd, .5), hn, -2.6))}L${P2(along(along(h, hd, .5), hn, 2.6))}" stroke="${rune}" stroke-width="1.2" filter="url(#glow-${poseKey})"/>`;
    const gy = (7 + 0.82 * G.GROUND).toFixed(1);
    return `${G.svgOpen(A.pose, opts)}<defs><linearGradient id="dusk-${poseKey}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1440"/><stop offset=".55" stop-color="#5b2f6e"/><stop offset=".85" stop-color="#d98a52"/></linearGradient>
      <filter id="glow-${poseKey}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation=".9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect width="100" height="100" fill="url(#dusk-${poseKey})"/><circle cx="78" cy="20" r="7" fill="#F4E7C3" opacity=".9"/>
      <path d="M0 70L14 52 24 62 38 40 52 60 64 46 78 64 90 50 100 60V${gy}H0Z" fill="#2a1d48"/><path d="M0 76L18 64 30 72 46 60 60 72 76 62 100 74V${gy}H0Z" fill="#20163a"/>
      <path d="M0 ${gy}H100V100H0Z" fill="#140e26"/>
      <g transform="${inset(A)}">${cloak}${body}${pauldrons}${horn(1)}${horn(-1)}${eyes}
      ${number(A, num, `font: 600 8px Jost, Futura, sans-serif; fill: ${gold}; paint-order: stroke; stroke: ${ink}; stroke-width: 1.3`)}</g></svg>`;
  }

  return {
    mix, lum, wcag, trim, ink2Of, xrayEdge, XRAY_BOX,
    STYLES: {
      glass: { name: "Stained Glass", conceit: "Each goalie is a cathedral window: lead lines and panes of team colour.", draw: glass },
      plate: { name: "Research Plate", conceit: "A figure from the journal: each goalie drafted in white line on a plate of team colour.", draw: plate },
      riso: { name: "Two-Ink Print", conceit: "A club-room risograph in two team inks, with halftone pads and a little misregistration.", draw: riso },
      illuminated: { name: "Illuminated Plate", conceit: "A page from the GRJ's book of keepers: flat colour in ink outline, inside a gilded frame.", draw: illuminated },
      skeletons: { name: "Skeletons", conceit: "The bone crew: every goalie is a skeleton suiting up, glowing in team colour after dark.", draw: skeletons("night") },
      "skeletons-xray": { name: "Skeletons: Light Box", conceit: "An X-ray on the light box: see-through gear in team colour, the bones showing through.", draw: skeletons("xray") },
      "skeletons-bold": { name: "Skeletons: Bold Bones", conceit: "Chunky one-piece bones on a light team-tint card, cut back to read at leaderboard size.", draw: skeletons("bold") },
      knights: { name: "Knights", conceit: "Knights of the crease: plate armour under a team-colour tabard, with a kite shield for a blocker.", draw: knights("stone") },
      "knights-tournament": { name: "Knights: Tournament", conceit: "Tilt-yard day: gunmetal armour against a light pavilion striped in team colour.", draw: knights("tournament") },
      "knights-gilded": { name: "Knights: Gilded", conceit: "Gold armour on a deep team-colour field scattered with stars, like a herald's roll.", draw: knights("gilded") },
      fantasy: { name: "High Fantasy", conceit: "An epic-quest keeper: rune-lit armour and a team-colour cloak against a dusk sky over far mountains.", draw: fantasy },
    },
  };
});
