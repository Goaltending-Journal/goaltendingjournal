/* Goalie illustrations, Step 2: one shared skeleton, posed once per type.
   A pose is a set of joint angles, never free points, so every bone keeps the length fixed in CANON.
   Each art style is a function from the posed points to SVG; silhouette() below is the first one.
   Works in the browser (window.GoalieSkeleton) and in Node (require). See README.md for the canon. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoalieSkeleton = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Frame: 100 x 100 units, ice at y = GROUND. One head (the mask) is 11 units; a standing goalie is 7 heads.
  const GROUND = 92;
  const CANON = {
    head: 11, neck: 6.5, torso: 24, shoulder: 7.5, hip: 5,
    upperArm: 13, forearm: 12, thigh: 19, shin: 20, foot: 8, stick: 40,
  };

  const rad = (d) => (d * Math.PI) / 180;
  const dir = (d) => [Math.cos(rad(d)), Math.sin(rad(d))];
  const add = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];

  /* Angles are in degrees: 0 points right, 90 points down (SVG y runs down), -90 points up.
     "glove" and "blocker" are the arms on the viewer's right and left (a left-catching goalie facing us).
     "l" and "r" are the legs on the viewer's left and right. */
  const POSES = {
    steady: {
      name: "Steady", shape: "Compact upright rectangle, symmetric",
      torso: -90, head: -90,
      blocker: [100, 70], glove: [80, 40],
      l: [98, 88, 180], r: [82, 92, 0],
      stick: { blade: 180 },
    },
    workhorse: {
      name: "Workhorse", shape: "Square stance framed by the net behind",
      torso: -90, head: -90,
      blocker: [118, 75], glove: [62, 20],
      l: [122, 86, 180], r: [58, 94, 0],
      stick: { blade: 180 }, props: ["net"],
    },
    "hd-stopper": {
      name: "High-Danger Stopper", shape: "Low wide triangle, pads flat on the ice",
      torso: -90, head: -95,
      blocker: [140, 100], glove: [-25, -70],
      l: [102, 176, 200], r: [78, 4, -20],
      stick: { blade: 0, fromBlocker: 75 }, props: ["puck-doorstep"],
    },
    wall: {
      name: "The Wall", shape: "Tall wide box, arms out to both posts",
      torso: -90, head: -90,
      blocker: [168, 196], glove: [12, -16],
      l: [104, 94, 180], r: [76, 86, 0],
      stick: { blade: 180, fromBlocker: 96 },
    },
    rebound: {
      name: "Rebound Controller", shape: "Low round dome, folded over the puck",
      torso: -28, head: 15,
      blocker: [70, 96], glove: [52, 74],
      l: [95, 180, 180], r: [85, 178, 180],
      stick: null, props: ["puck-smother"],
    },
    siege: {
      name: "Under Siege", shape: "Hunched wide crouch, shots raining in",
      torso: -96, head: -100,
      blocker: [-150, -95], glove: [-30, -85],
      l: [130, 88, 180], r: [50, 92, 0],
      stick: null, props: ["shots"],
    },
    crease: {
      name: "Crease Battler", shape: "Hooked lean, head out past the screen",
      torso: -128, head: -150,
      blocker: [172, 128], glove: [-95, -55],
      l: [112, 100, 180], r: [58, 96, 0],
      stick: { blade: 180 },
    },
    standout: {
      name: "Standout", shape: "Upright with one spike: the glove held high",
      torso: -90, head: -90,
      blocker: [112, 70], glove: [-40, -58],
      l: [108, 88, 180], r: [72, 92, 0],
      stick: { blade: 180 },
    },
    "donut-king": {
      name: "Donut King", shape: "Ring held over the head",
      torso: -90, head: -90,
      blocker: [-112, -78], glove: [-68, -102],
      l: [110, 88, 180], r: [70, 92, 0],
      stick: null, props: ["donut"],
    },
    grandpa: {
      name: "Grandpa", shape: "Bent question mark, leaning on the stick",
      torso: -52, head: 5,
      blocker: [52, 18], glove: [128, 30],
      l: [104, 96, 180], r: [84, 102, 0],
      stick: { blade: 0, cane: true },
    },
    "young-gun": {
      name: "Young Gun", shape: "Airborne star, daylight under the skates",
      torso: -90, head: -88,
      blocker: [-140, -135], glove: [-40, -45],
      l: [135, 150, 200], r: [45, 30, -20],
      stick: null, airborne: 9,
    },
    "style-king": {
      name: "Style King", shape: "T-bar on top: stick across the shoulders",
      torso: -90, head: -96,
      blocker: [196, -95], glove: [-16, -85],
      l: [80, 112, 180], r: [100, 70, 0],
      stick: { yoke: true },
    },
  };

  /** Posed points for one pose, with the skates (or the shadow line) sitting on the ice. */
  function skeleton(pose) {
    const C = CANON;
    const build = (rootPt) => {
      const P = { pelvis: rootPt };
      const up = dir(pose.torso), perp = dir(pose.torso + 90);
      P.neck = add(P.pelvis, up, C.torso);
      P.head = add(P.neck, dir(pose.head), C.neck);
      const base = add(P.neck, up, -2.5);
      P.shBlocker = add(base, perp, -C.shoulder);
      P.shGlove = add(base, perp, C.shoulder);
      P.hipL = add(P.pelvis, perp, -C.hip);
      P.hipR = add(P.pelvis, perp, C.hip);
      P.elbowBlocker = add(P.shBlocker, dir(pose.blocker[0]), C.upperArm);
      P.handBlocker = add(P.elbowBlocker, dir(pose.blocker[1]), C.forearm);
      P.elbowGlove = add(P.shGlove, dir(pose.glove[0]), C.upperArm);
      P.handGlove = add(P.elbowGlove, dir(pose.glove[1]), C.forearm);
      P.kneeL = add(P.hipL, dir(pose.l[0]), C.thigh);
      P.ankleL = add(P.kneeL, dir(pose.l[1]), C.shin);
      P.toeL = add(P.ankleL, dir(pose.l[2]), C.foot);
      P.kneeR = add(P.hipR, dir(pose.r[0]), C.thigh);
      P.ankleR = add(P.kneeR, dir(pose.r[1]), C.shin);
      P.toeR = add(P.ankleR, dir(pose.r[2]), C.foot);
      return P;
    };
    const first = build([50, 50]);
    const low = Math.max(...["kneeL", "kneeR", "ankleL", "ankleR", "toeL", "toeR"].map((k) => first[k][1]));
    const lift = pose.airborne || 0;
    const P = build([50, 50 + GROUND - 2 - lift - low]);   // 2 units for the pad and skate thickness
    // Centre the figure on x = 50
    const xs = Object.values(P).map((p) => p[0]);
    const dx = 50 - (Math.min(...xs) + Math.max(...xs)) / 2;
    for (const k in P) P[k] = [P[k][0] + dx, P[k][1]];
    return P;
  }

  /** Bone lengths, for the drift check in the audit. */
  const BONES = [
    ["pelvis", "neck", "torso"], ["neck", "head", "neck"],
    ["shBlocker", "elbowBlocker", "upperArm"], ["elbowBlocker", "handBlocker", "forearm"],
    ["shGlove", "elbowGlove", "upperArm"], ["elbowGlove", "handGlove", "forearm"],
    ["hipL", "kneeL", "thigh"], ["kneeL", "ankleL", "shin"], ["ankleL", "toeL", "foot"],
    ["hipR", "kneeR", "thigh"], ["kneeR", "ankleR", "shin"], ["ankleR", "toeR", "foot"],
  ];

  const f = (n) => Math.round(n * 10) / 10;
  const pt = (p) => `${f(p[0])},${f(p[1])}`;

  // A thick rounded segment as a closed path
  function capsule(a, b, w) {
    return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  // A quadrilateral band from a to b, width wa at a and wb at b
  function band(a, b, wa, wb) {
    const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]) || 1;
    const n = [-d[1] / L, d[0] / L];
    const q = [add(a, n, wa / 2), add(b, n, wb / 2), add(b, n, -wb / 2), add(a, n, -wa / 2)];
    return `<polygon points="${q.map(pt).join(" ")}" stroke-linejoin="round" stroke-width="1.5"/>`;
  }

  /** Style 0: flat silhouette. Everything in one colour, so only shape can tell types apart. */
  function silhouette(poseKey, opts = {}) {
    const pose = POSES[poseKey], P = skeleton(pose), ink = opts.ink || "#000";
    const g = [];
    const props = pose.props || [];
    if (props.includes("net")) {
      // Goal frame behind the goalie: 6 ft by 4 ft, posts and crossbar only
      g.push(`<path d="M14 ${GROUND} V50 H86 V${GROUND}" fill="none" stroke-width="4.5" stroke-linejoin="round"/>`);
    }
    // Legs: thigh, then the pad from just above the knee to the boot, then the skate
    for (const s of ["L", "R"]) {
      const hip = P["hip" + s], knee = P["knee" + s], ankle = P["ankle" + s], toe = P["toe" + s];
      g.push(capsule(hip, knee, 11));
      const padTop = add(knee, [knee[0] - ankle[0], knee[1] - ankle[1]].map((v) => v / CANON.shin), 5);
      g.push(band(padTop, ankle, 12.5, 12));
      g.push(capsule(ankle, toe, 4));
    }
    // Torso: chest protector, wider at the shoulders
    g.push(band(P.pelvis, add(P.neck, dir(pose.torso), -1), 17, 23));
    // Arms
    g.push(capsule(P.shBlocker, P.elbowBlocker, 8.5), capsule(P.elbowBlocker, P.handBlocker, 7.5));
    g.push(capsule(P.shGlove, P.elbowGlove, 8.5), capsule(P.elbowGlove, P.handGlove, 7.5));
    // Mask
    g.push(`<circle cx="${f(P.head[0])}" cy="${f(P.head[1])}" r="5.6"/>`);
    // Stick
    if (pose.stick) {
      const h = P.handBlocker, S = pose.stick;
      let end;
      if (S.yoke) {
        const y = (h[1] + P.handGlove[1]) / 2;   // across the shoulders, hand to hand and a little past
        end = [P.handGlove[0] + 10, y];
        g.push(capsule([h[0] - 8, y], end, 3));
      } else if (S.cane) {
        end = [h[0] + 3, GROUND - 1];
        g.push(capsule(h, end, 3), capsule(end, add(end, dir(S.blade), 9), 3));
      } else {
        const d = dir(S.fromBlocker || 95);
        const len = Math.min(CANON.stick, (GROUND - 1 - h[1]) / d[1]);
        end = add(h, d, len);
        g.push(capsule(h, end, 3));
        g.push(band(add(h, d, len - 13), end, 5, 5));
        g.push(capsule(end, add(end, dir(S.blade), 10), 3));
      }
    }
    // Blocker: a board on the stick hand, square to the forearm
    {
      const d = dir(pose.blocker[1]);
      g.push(band(add(P.handBlocker, d, -4), add(P.handBlocker, d, 4), 12, 12));
    }
    // Glove: a round catcher with the cuff
    g.push(`<circle cx="${f(P.handGlove[0])}" cy="${f(P.handGlove[1])}" r="6.6"/>`);
    // Props that are part of the defining action
    if (props.includes("puck-doorstep")) g.push(`<ellipse cx="${f(P.toeR[0] - 14)}" cy="${GROUND - 9}" rx="3.2" ry="1.6"/>`);
    if (props.includes("puck-smother")) g.push(`<ellipse cx="${f(P.handGlove[0] + 5)}" cy="${GROUND - 1.5}" rx="3.2" ry="1.6"/>`);
    if (props.includes("donut")) {
      const c = [(P.handBlocker[0] + P.handGlove[0]) / 2, Math.min(P.handBlocker[1], P.handGlove[1]) - 11];
      g.push(`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="9.5" fill="none" stroke-width="7"/>`);
    }
    if (props.includes("shots")) {
      for (const [x, y, a] of [[14, 22, 30], [84, 18, 150], [10, 52, 5], [90, 48, 175], [50, 8, 90]]) {
        const tail = add([x, y], dir(a + 180), 7);
        g.push(`<line x1="${f(tail[0])}" y1="${f(tail[1])}" x2="${x}" y2="${y}" stroke-width="1.6" stroke-linecap="round"/>`);
        g.push(`<circle cx="${x}" cy="${y}" r="2.6"/>`);
      }
    }
    if (pose.airborne) g.push(`<ellipse cx="50" cy="${GROUND}" rx="16" ry="1.6" opacity=".35"/>`);
    const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${size} role="img" aria-label="${pose.name}"><g fill="${ink}" stroke="${ink}">${g.join("")}</g></svg>`;
  }

  return { GROUND, CANON, POSES, BONES, skeleton, silhouette, ORDER: Object.keys(POSES) };
});
