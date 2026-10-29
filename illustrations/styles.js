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
  const inset = (A) => {
    const k = Math.min(0.82, 72 / (G.GROUND - A.top));
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

  /* D · Illuminated plate. Conceit: a page from the GRJ's book of keepers, flat colour in ink outline inside a gilded frame. */
  function illuminated(poseKey, t, num, opts = {}) {
    const A = G.parts(poseKey), gear = trim(t), ink = "#14152a", gold = "#C9A54A", field = "#262B63";
    const id = `dia-${poseKey}`;
    const body = A.parts.map((p) => {
      if (p.role === "shadow") return `<path d="${p.d}" fill="#000" opacity=".3"/>`;
      let fill = roleFill(p.role, t, gear);
      if (p.role === "pad") fill = "#F7F3E6";
      if (p.role === "net") fill = gold;
      return `<path d="${p.d}" fill="${fill}" fill-rule="evenodd" stroke="${ink}" stroke-width="1.1" stroke-linejoin="round"/>`;
    }).join("");
    return `${G.svgOpen(A.pose, opts)}<defs><pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M4 2.4L5.6 4 4 5.6 2.4 4Z" fill="${gold}" opacity=".45"/></pattern></defs>
      <rect width="100" height="100" fill="${gold}"/><rect x="3" y="3" width="94" height="94" fill="${field}"/><rect x="3" y="3" width="94" height="94" fill="url(#${id})"/>
      <rect x="5.5" y="5.5" width="89" height="89" fill="none" stroke="${gold}" stroke-width=".8"/>
      ${[[3, 3], [97, 3], [3, 97], [97, 97]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${gold}" stroke="${ink}" stroke-width=".6"/>`).join("")}
      <path d="M5.5 ${(7 + 0.82 * G.GROUND).toFixed(1)}H94.5V94.5H5.5Z" fill="#3a417f"/><g transform="${inset(A)}">${body}
      ${number(A, num, `font: 600 8.5px Jost, Futura, sans-serif; fill: #fff; paint-order: stroke; stroke: ${ink}; stroke-width: 1.2`)}</g></svg>`;
  }

  return {
    mix, lum, trim, ink2Of,
    STYLES: {
      glass: { name: "Stained Glass", conceit: "Each goalie is a cathedral window: lead lines and panes of team colour.", draw: glass },
      plate: { name: "Research Plate", conceit: "A figure from the journal: each goalie drafted in white line on a plate of team colour.", draw: plate },
      riso: { name: "Two-Ink Print", conceit: "A club-room risograph in two team inks, with halftone pads and a little misregistration.", draw: riso },
      illuminated: { name: "Illuminated Plate", conceit: "A page from the GRJ's book of keepers: flat colour in ink outline, inside a gilded frame.", draw: illuminated },
    },
  };
});
