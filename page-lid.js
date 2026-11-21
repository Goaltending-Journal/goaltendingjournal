// Page lids and the night sky (Goldy, 2026-11-21: the S1 "Slim lid" on every page, no subtitles).
// Each page title sits in a slim plate, <header class="lid" data-vis="…">, with a small live drawing cropped at its right edge,
// and the page ground carries a quiet starfield with a soft jade glow at the top, matching the homepage journey.
// Light mode keeps the glow and the drawing (in darker inks) and leaves out the stars. Drawings pause when off screen.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const TK = ["hip", "inj", "eq", "vis", "phy", "bio", "psy", "dev", "stats"];
  let dark = true, TC = [], J = [164, 199, 193], INK = "238,243,241";

  function readTheme() {
    dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const cs = getComputedStyle(root);
    TC = TK.map((k) => cs.getPropertyValue("--t-" + k).trim() || "#a4c7c1");
    J = dark ? [164, 199, 193] : [75, 112, 106];
    INK = dark ? "238,243,241" : "47,76,72";
  }
  const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`; };
  const jA = (a) => `rgba(${J[0]},${J[1]},${J[2]},${Math.max(0, a).toFixed(3)})`;
  const inkA = (a) => `rgba(${INK},${a})`;

  // Small 3D helpers shared by the globe and ring drawings
  const FIB = Array.from({ length: 150 }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / 150, r = Math.sqrt(1 - y * y), a = i * 2.39996; return [Math.cos(a) * r, y, Math.sin(a) * r, i % 9]; });
  function proj(x, y, z, rot, C, R) { const c = Math.cos(rot), s = Math.sin(rot), X = x * c + z * s, Z = -x * s + z * c, Y = y * 0.92 - Z * 0.4, ZZ = y * 0.4 + Z * 0.92, f = 2.6 / (2.6 + ZZ); return [C + X * R * f, C - Y * R * f, ZZ, f]; }
  function ring(g, C, R, tilt, head, rot, col, aMax, beads, t, k) {
    const ct = Math.cos(tilt), st = Math.sin(tilt), ch = Math.cos(head), sh = Math.sin(head);
    const pt = (u) => { let x = Math.cos(u), z = Math.sin(u), y = 0; [y, z] = [-z * st, z * ct]; [x, z] = [x * ch - z * sh, x * sh + z * ch]; return proj(x, y, z, rot, C, R); };
    let p = pt(0);
    for (let q = 1; q <= 64; q++) { const n = pt((q / 64) * 6.283), d = 0.5 - (p[2] + n[2]) / 4; g.strokeStyle = col(0.08 + aMax * d); g.lineWidth = 1.2; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(n[0], n[1]); g.stroke(); p = n; }
    for (let b = 0; b < beads; b++) { const q = pt((b / beads) * 6.283 + t * 0.0004 * (k % 2 ? 1 : -1)), d = 0.5 - q[2] / 2; g.fillStyle = col(0.25 + 0.75 * d); g.beginPath(); g.arc(q[0], q[1], ((b ? 2 : 3.6) * q[3] * C) / 110, 0, 6.283); g.fill(); }
  }

  // One drawing per page, all our own art: S is the square canvas size in pixels, t the time in ms
  const DRAW = {
    globe(g, S, t) { const C = S / 2, R = S * 0.32, rot = t * 0.0003;
      for (const [x, y, z, k] of FIB) { const q = proj(x, y, z, rot, C, R), d = 0.5 - q[2] / 2; g.fillStyle = hexA(TC[k], 0.12 + 0.88 * d); g.beginPath(); g.arc(q[0], q[1], ((1 + 1.8 * d) * S) / 220, 0, 6.283); g.fill(); }
      ring(g, C, R * 1.3, 1.2, 0.5, rot * 0.5, jA, 0.4, 1, t, 0); },
    briefs(g, S, t) { const C = S / 2, w = S * 0.36, h = S * 0.46;
      for (let k = 4; k >= 0; k--) {
        g.save(); g.translate(C, C + S * 0.02); g.rotate((k - 2) * 0.16 + (reduce ? 0 : Math.sin(t * 0.0012 + k) * 0.04)); g.globalAlpha = 0.35 + 0.15 * (4 - k);
        g.fillStyle = jA(0.05); g.strokeStyle = jA(0.6); g.lineWidth = 1.2; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 5); g.fill(); g.stroke();
        if (!k) for (let l = 0; l < 6; l++) { g.strokeStyle = l ? jA(0.5) : inkA(0.9); g.lineWidth = l ? 1.4 : 2.6; g.beginPath(); g.moveTo(-w / 2 + w * 0.12, -h / 2 + h * (0.16 + l * 0.12)); g.lineTo(-w / 2 + w * (0.12 + (l ? 0.7 - (l % 3) * 0.14 : 0.55)), -h / 2 + h * (0.16 + l * 0.12)); g.stroke(); }
        g.restore();
      }
      g.globalAlpha = 1; },
    coach(g, S, t) { const C = S / 2, R = S * 0.34, rot = t * 0.0003, cols = [`#${J.map((v) => v.toString(16).padStart(2, "0")).join("")}`, TC[4], TC[7]];
      cols.forEach((h, k) => ring(g, C, R, 0.5 + k * 0.7, k * 1.1, rot, (a) => hexA(h, a), 0.5, 4, t, k));
      const gr = g.createRadialGradient(C, C, 0, C, C, R * 0.35); gr.addColorStop(0, inkA(0.8)); gr.addColorStop(1, jA(0)); g.fillStyle = gr; g.beginPath(); g.arc(C, C, R * 0.35, 0, 6.283); g.fill(); },
    reviews(g, S, t) { const C = S / 2, R = S * 0.36, n = 7, spin = t * 0.00025;
      g.fillStyle = inkA(0.9); g.beginPath(); g.arc(C, C, S * 0.025, 0, 6.283); g.fill();
      for (let i = 0; i < n; i++) { const a = spin + (i / n) * 6.283, x = C + Math.cos(a) * R, y = C + Math.sin(a) * R * 0.66, talk = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.002 + i * 1.7), col = TC[(i * 4) % 9];
        g.strokeStyle = hexA(col, 0.12 + 0.45 * talk); g.lineWidth = 1.2; g.beginPath(); g.moveTo(C, C); g.lineTo(x, y); g.stroke();
        g.fillStyle = hexA(col, 0.85); g.beginPath(); g.arc(x, y, S * (0.02 + 0.01 * talk), 0, 6.283); g.fill(); } },
    conf(g, S, t) { const C = S / 2, R = S * 0.38;
      for (let k = 0; k < 5; k++) { const ph = reduce ? k / 5 : (t * 0.00025 + k / 5) % 1, r = R * 0.2 + ph * R; g.strokeStyle = hexA(TC[(k * 2) % 9], 0.6 * (1 - ph)); g.lineWidth = 1.5; g.beginPath(); g.ellipse(C, C + R * 0.15, r, r * 0.42, 0, 0, 6.283); g.stroke(); }
      const gr = g.createRadialGradient(C, C, 0, C, C, R * 0.4); gr.addColorStop(0, inkA(0.85)); gr.addColorStop(0.4, jA(0.35)); gr.addColorStop(1, jA(0)); g.fillStyle = gr; g.beginPath(); g.arc(C, C, R * 0.4, 0, 6.283); g.fill(); },
    nhl(g, S, t) { const C = S / 2, R = S * 0.34, rot = t * 0.0003, OR = dark ? ["#7fd3c0", "#a4c7c1", "#8a9a97", "#e3a98a", "#f07a5a"] : ["#2f8f7c", "#4b706a", "#6f7c7a", "#b86f4f", "#c8502f"];
      OR.forEach((h, k) => ring(g, C, R, 0.35 + ((k * 0.618) % 1) * 0.9, (k / 5) * Math.PI, rot, (a) => hexA(h, a), 0.45, 6 + (k % 3) * 2, t, k)); },
    sun(g, S, t) { const C = S / 2, R = S * 0.4, n = 160, spin = t * 0.00008;
      for (let i = 0; i < n; i++) { const a = i * 2.39996 + spin, r = Math.sqrt(i / n) * R, pulse = reduce ? 1 : 0.7 + 0.3 * Math.sin(t * 0.003 - i * 0.12);
        g.fillStyle = hexA(TC[(i * 5) % 9], (0.35 + (0.55 * i) / n) * pulse); g.beginPath(); g.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, ((1 + (2.4 * i) / n) * S) / 220, 0, 6.283); g.fill(); } }
  };

  // The night sky: a fixed canvas behind the page
  const sky = document.createElement("canvas");
  sky.className = "night-sky"; sky.setAttribute("aria-hidden", "true");
  document.body.prepend(sky); root.classList.add("has-sky");
  const sg = sky.getContext("2d");
  const STARS = Array.from({ length: 140 }, (_, i) => ({ x: (i * 0.618034) % 1, y: (i * 0.381966 + Math.sin(i) * 0.3 + 1) % 1, s: ((i * 7) % 10) / 10, p: i }));
  let sw = 0, sh = 0;
  function sizeSky() { const d = Math.min(2, devicePixelRatio || 1); sw = innerWidth; sh = innerHeight; sky.width = sw * d; sky.height = sh * d; sg.setTransform(d, 0, 0, d, 0, 0); }

  // Lid drawings
  const lids = [...document.querySelectorAll(".lid[data-vis]")].map((el) => {
    let cv = el.querySelector("canvas.lid-vis");
    if (!cv) { cv = document.createElement("canvas"); cv.className = "lid-vis"; cv.setAttribute("aria-hidden", "true"); el.prepend(cv); }
    const L = { el, cv, g: cv.getContext("2d"), draw: DRAW[el.dataset.vis], on: true };
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { L.on = e.isIntersecting; }).observe(el);
    return L;
  }).filter((L) => L.draw);
  function sizeLids() { const d = Math.min(2, devicePixelRatio || 1); for (const L of lids) { const s = Math.round(L.cv.getBoundingClientRect().width * d) || 440; L.cv.width = L.cv.height = s; } }

  function frame(t) {
    sg.clearRect(0, 0, sw, sh);
    if (dark) for (const s of STARS) { const tw = reduce ? 0.6 : 0.45 + 0.35 * Math.sin(t * 0.0008 + s.p); sg.fillStyle = `rgba(214,235,230,${(tw * (0.14 + 0.4 * s.s)).toFixed(3)})`; sg.beginPath(); sg.arc(s.x * sw, s.y * sh, 0.45 + 0.8 * s.s, 0, 6.283); sg.fill(); }
    for (const L of lids) {
      if (!L.on) continue;
      const { g, cv } = L, S = cv.width; g.clearRect(0, 0, S, S);
      const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5); gr.addColorStop(0, jA(dark ? 0.16 : 0.12)); gr.addColorStop(1, jA(0)); g.fillStyle = gr; g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = dark ? "lighter" : "source-over"; L.draw(g, S, t); g.globalCompositeOperation = "source-over";
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  const redraw = () => { if (reduce) requestAnimationFrame(frame); };
  readTheme(); sizeSky(); sizeLids();
  addEventListener("resize", () => { sizeSky(); sizeLids(); redraw(); });
  addEventListener("themechange", () => { readTheme(); redraw(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTheme(); redraw(); });
  requestAnimationFrame(frame);
})();
