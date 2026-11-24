/* NHL Goaltending Oracle on goalies.html: every goalie in the Natural Stat Trick all-situations file (data/nst/, loaded by
   goalies-advanced.js) as a turning armillary globe, built like the Scholarly Oracle on research.html. Five tilted rings weave
   around a glowing core, one per GSAA level from jade (well above average) to copper (well below); goalies ride their ring in
   GSAA order and the best goalie on each ring glows brightest. Mark size is shots faced. Drag to spin; point at a goalie to read
   their line, click to pin it; arrow keys step through the goalies from best to worst GSAA. Reduced motion draws still frames;
   drawing stops while the view is hidden or off screen. Data courtesy of Natural Stat Trick. */
(function () {
  const sec = document.getElementById("orSec"); if (!sec) return;
  const cv = document.getElementById("or-cv"), box = document.getElementById("or"), tip = document.getElementById("or-tip"), cardEl = document.getElementById("or-card"), cx = cv.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches, TAU = Math.PI * 2;
  const BANDS = [[5, "Well above average", "+5 or more"], [4, "Above average", "+1.5 to +5"], [3, "Around average", "−1.5 to +1.5"], [2, "Below average", "−5 to −1.5"], [1, "Well below average", "below −5"]];
  const band = (g) => g >= 5 ? 5 : g >= 1.5 ? 4 : g > -1.5 ? 3 : g > -5 ? 2 : 1;
  const sgn = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2);
  const sv = (v) => v == null ? "–" : v.toFixed(3).replace(/^0/, "");
  const html = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  document.getElementById("or-key").innerHTML = BANDS.map(([b, t, r]) => `<li><i style="--c:var(--or${b})"></i>${t} <small>${r}</small></li>`).join("");
  let items = [], ring = {}, slot = [], head = new Set(), maxSA = 1, bands = [];
  let W = 0, H = 0, R = 0, rot = 0, rotX = -0.35, t = 0, pos = [], hover = null, sel = 0, drag = null, col = {}, dark = false, fg = "#000";
  let raf = 0, last = 0, on = false;

  function load() {
    const rows = (typeof nst !== "undefined" && nst.data && nst.data.all) || [];
    items = rows.filter((r) => r.name && r.gsaa != null && r.sa > 0).sort((a, b) => b.gsaa - a.gsaa);
    if (!items.length) { box.hidden = true; cardEl.hidden = true; return false; }
    box.hidden = false; cardEl.hidden = false;
    maxSA = Math.max(...items.map((r) => r.sa));
    bands = [5, 4, 3, 2, 1].filter((b) => items.some((r) => band(r.gsaa) === b));
    ring = Object.fromEntries(bands.map((b, a) => [b, { a, ids: items.map((r, i) => i).filter((i) => band(items[i].gsaa) === b),
      ax: a / bands.length * Math.PI, tl: 0.35 + ((a * 0.618) % 1) * 0.9 }]));   // each ring's own heading and tilt
    slot = items.map((r, i) => { const g = ring[band(r.gsaa)]; return [g, g.ids.indexOf(i)]; });
    head = new Set(bands.map((b) => ring[b].ids[0]));
    sel = 0; return true;
  }
  function theme() {
    const cs = getComputedStyle(sec);
    [5, 4, 3, 2, 1].forEach((b) => (col[b] = cs.getPropertyValue("--or" + b).trim()));
    dark = getComputedStyle(document.documentElement).colorScheme === "dark"; fg = cs.getPropertyValue("--fg").trim() || "#172120";
  }
  function size() {
    const w = box.getBoundingClientRect().width; if (!w) return false;
    const d = Math.min(2, devicePixelRatio || 1);
    W = w; H = Math.round(Math.max(340, Math.min(560, w * 0.72))); R = Math.min(W, H) * 0.42;
    cv.style.height = H + "px"; cv.width = Math.round(W * d); cv.height = Math.round(H * d); cx.setTransform(d, 0, 0, d, 0, 0);
    return true;
  }
  // A point on ring g at u (0 = best GSAA on the ring, 1 = lowest): a horizontal circle, tipped by the ring's tilt around its heading
  function onRing(g, u) {
    const lon = u * TAU * 0.9 + g.a * 1.1 + (still ? 0 : t * 0.00012 * (g.a % 2 ? 1 : -1));
    let x = Math.cos(lon), y = 0, z = Math.sin(lon);
    const c = Math.cos(g.ax), s = Math.sin(g.ax), ct = Math.cos(g.tl), st = Math.sin(g.tl);
    let X = x * c + z * s, Z = -x * s + z * c; y = -Z * st; Z = Z * ct;
    return [X * c - Z * s, y, X * s + Z * c];
  }
  function proj([x, y, z]) {
    const cy = Math.cos(rot), sy = Math.sin(rot), c2 = Math.cos(rotX), s2 = Math.sin(rotX);
    [x, z] = [x * cy - z * sy, x * sy + z * cy]; [y, z] = [y * c2 - z * s2, y * s2 + z * c2];
    const f = 2.6 / (2.6 + z); return [W / 2 + x * R * f, H / 2 + y * R * f, z];
  }
  const uOf = (g, j) => (g.ids.length > 1 ? j / (g.ids.length - 1) : 0);
  function place() { pos = items.map((r, i) => { const [g, j] = slot[i]; return proj(onRing(g, uOf(g, j))); }); }
  const depth = (z) => 0.25 + 0.75 * (1 - z) / 2;
  const sz = (i) => 2.2 + 4.2 * Math.sqrt(items[i].sa / maxSA);
  const colOf = (i) => col[band(items[i].gsaa)];
  function glow(x, y, r, c, a) { const g = cx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, c + "00"); cx.globalAlpha = a; cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill(); }
  function draw() {
    if (!W || !items.length) return;
    cx.clearRect(0, 0, W, H); cx.lineCap = "round";
    cx.globalAlpha = 0.1; cx.strokeStyle = fg; cx.lineWidth = 1; cx.beginPath(); cx.arc(W / 2, H / 2, R * 0.97, 0, TAU); cx.stroke();
    cx.globalCompositeOperation = dark ? "lighter" : "source-over";
    // The core: a soft bloom in every GSAA colour
    bands.forEach((b, a) => { const an = a / bands.length * TAU + (still ? 0 : t * 0.0003); glow(W / 2 + Math.cos(an) * R * 0.05, H / 2 + Math.sin(an) * R * 0.05, R * 0.28, col[b], dark ? 0.16 : 0.05); });
    // Each ring: a faint full circle, and a brighter thread through its goalies that is strongest at the best goalie
    bands.forEach((b) => {
      const g = ring[b]; cx.strokeStyle = col[b];
      let p = proj(onRing(g, -0.06));
      for (let s = 1; s <= 90; s++) {
        const f = s / 90, q = proj(onRing(g, -0.06 + 1.06 * f)), d = Math.max(0.08, depth((p[2] + q[2]) / 2));
        cx.globalAlpha = (0.55 - 0.4 * f) * d; cx.lineWidth = 2.4 - 1.6 * f;
        cx.beginPath(); cx.moveTo(p[0], p[1]); cx.lineTo(q[0], q[1]); cx.stroke(); p = q;
      }
      p = proj(onRing(g, 0));
      for (let s = 1; s <= 60; s++) {
        const q = proj(onRing(g, s / 60 * 1.111)); cx.globalAlpha = 0.1 * depth((p[2] + q[2]) / 2); cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(p[0], p[1]); cx.lineTo(q[0], q[1]); cx.stroke(); p = q;
      }
    });
    const ord = items.map((r, i) => i).sort((a, b) => pos[b][2] - pos[a][2]);
    ord.forEach((i) => { const [x, y, z] = pos[i], h = head.has(i); glow(x, y, (h ? 20 : 7 + sz(i) * 1.6) * (1.2 - z * 0.3), colOf(i), (h ? 0.6 : 0.2) * depth(z)); });
    cx.globalCompositeOperation = "source-over";
    cx.globalAlpha = 0.8; cx.strokeStyle = fg; cx.lineWidth = 1.3; cx.beginPath(); cx.arc(W / 2, H / 2, 5, 0, TAU); cx.stroke();
    ord.forEach((i) => {
      const [x, y, z] = pos[i], h = head.has(i);
      cx.globalAlpha = depth(z); cx.strokeStyle = colOf(i); cx.lineWidth = h ? 2.4 : 1.6;
      cx.beginPath(); cx.arc(x, y, sz(i) * (1.2 - z * 0.3), 0, TAU); cx.stroke();
    });
    const foc = hover ?? sel;
    if (foc != null && pos[foc]) { const [x, y, z] = pos[foc]; cx.globalAlpha = z > 0.3 ? 0.4 : 1; cx.strokeStyle = fg; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, sz(foc) + 6, 0, TAU); cx.stroke(); }
    cx.globalAlpha = 1;
  }
  function card(i) {
    const r = items[i]; if (!r) return; const b = band(r.gsaa), B = BANDS.find((x) => x[0] === b);
    cardEl.innerHTML = `<div class="dt">${html(r.team)}<span class="tag" style="--c:var(--or${b})">${B[1]}</span></div><h3>${html(r.name)}</h3>` +
      `<div class="stats"><span>GSAA <b>${sgn(r.gsaa)}</b></span><span>SV% <b>${sv(r.svp)}</b></span><span>Games <b>${r.gp ?? "–"}</b></span>` +
      `<span>Shots faced <b>${r.sa}</b></span><span>High-danger shots <b>${r.hdsa ?? "–"}</b></span></div>`;
  }
  // The globe turns and the rings drift; both hold still while a goalie is pointed at or the globe is dragged
  function step(dt) { if (still || hover != null || drag) return; t += dt; rot += 0.0022 * dt / 16; }
  function loop(now) { const dt = Math.min(50, now - (last || now)); if (now - last > 30 || !last) { last = now; step(dt); place(); draw(); } raf = requestAnimationFrame(loop); }
  const visible = () => sec.classList.contains("on");
  const start = () => { if (!raf && on && !still && !document.hidden && visible() && items.length) { last = 0; raf = requestAnimationFrame(loop); } }, stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const redraw = () => { if (!raf && W) { place(); draw(); } };
  function refresh() { theme(); if (visible() && size()) { place(); draw(); } start(); }
  function pick(e) {
    const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    let best = null, gap = 12; pos.forEach((p, i) => { if (p[2] > 0.3) return; const d = Math.hypot(p[0] - x, p[1] - y); if (d < gap) { gap = d; best = i; } });
    return best;
  }
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      drag.x = e.clientX; drag.y = e.clientY; rot += dx * 0.006; rotX = Math.max(-1.2, Math.min(1.2, rotX + dy * 0.006));
      box.classList.add("grabbing"); tip.hidden = true; redraw(); return;
    }
    const i = pick(e); cv.style.cursor = i == null ? "grab" : "pointer";
    if (i !== hover) { hover = i; card(i ?? sel); redraw(); }
    if (i == null) { tip.hidden = true; return; }
    const r = items[i]; tip.innerHTML = `<i style="background:${colOf(i)}"></i>${html(r.name)} · GSAA ${sgn(r.gsaa)}`;
    tip.hidden = false; tip.style.left = Math.max(8, Math.min(W - tip.offsetWidth - 8, pos[i][0] + 14)) + "px"; tip.style.top = pos[i][1] - 40 + "px";
  });
  const release = (e) => {
    const d = drag; drag = null; box.classList.remove("grabbing"); if (!d || d.moved || e.type === "pointercancel") return;
    const i = pick(e); if (i != null) { sel = i; card(sel); redraw(); }
  };
  cv.addEventListener("pointerup", release); cv.addEventListener("pointercancel", release);
  cv.addEventListener("pointerleave", () => { if (drag) return; hover = null; tip.hidden = true; card(sel); redraw(); });
  cv.addEventListener("keydown", (e) => {
    const to = { ArrowLeft: sel - 1, ArrowUp: sel - 1, ArrowRight: sel + 1, ArrowDown: sel + 1, Home: 0, End: items.length - 1 }[e.key];
    if (to == null || !items.length) return; e.preventDefault(); sel = Math.max(0, Math.min(items.length - 1, to)); card(sel); redraw();
  });
  function ready() { if (load()) { card(sel); refresh(); } }
  addEventListener("grj-nst", ready);
  if (typeof nst !== "undefined" && nst.data && nst.data.all) ready();
  new ResizeObserver(() => { if (visible() && size()) redraw(); }).observe(box);
  new MutationObserver(() => { if (visible()) refresh(); else stop(); }).observe(sec, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(() => { theme(); redraw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { theme(); redraw(); });
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { on = e.isIntersecting; on ? start() : stop(); }).observe(box); else on = true;
  document.addEventListener("visibilitychange", () => { document.hidden ? stop() : start(); });
})();

/* Mini NHL Oracle in the rail (Goldy, 2026-11-24, in place of the Season leader card): the same five GSAA rings and goalies,
   small and slowly turning; clicking it opens the NHL Oracle view. Holds still with reduced motion and pauses when off screen. */
(function () {
  const btn = document.getElementById("miniOr"), cv = document.getElementById("miniOrCv"); if (!btn || !cv) return;
  const cx = cv.getContext("2d"), TAU = Math.PI * 2, still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const band = (g) => g >= 5 ? 5 : g >= 1.5 ? 4 : g > -1.5 ? 3 : g > -5 ? 2 : 1;
  let items = [], rings = [], col = {}, W = 0, H = 0, R = 0, rot = 0, t = 0, raf = 0, last = 0, on = true, dark = true;
  btn.addEventListener("click", () => { if (window.grjShowView) window.grjShowView("orSec"); });
  function load() {
    const rows = (typeof nst !== "undefined" && nst.data && nst.data.all) || [];
    items = rows.filter((r) => r.name && r.gsaa != null && r.sa > 0).sort((a, b) => b.gsaa - a.gsaa);
    const bands = [5, 4, 3, 2, 1].filter((b) => items.some((r) => band(r.gsaa) === b)), maxSA = Math.max(1, ...items.map((r) => r.sa));
    rings = bands.map((b, a) => ({ b, ax: a / bands.length * Math.PI, tl: 0.35 + ((a * 0.618) % 1) * 0.9, a,
      g: items.filter((r) => band(r.gsaa) === b).map((r) => 1.2 + 2.6 * Math.sqrt(r.sa / maxSA)) }));
    return items.length > 0;
  }
  function theme() {
    const cs = getComputedStyle(btn); [5, 4, 3, 2, 1].forEach((b) => (col[b] = cs.getPropertyValue("--or" + b).trim() || "#8a9a97"));
    dark = getComputedStyle(document.documentElement).colorScheme === "dark";
  }
  function size() {
    const w = cv.getBoundingClientRect().width; if (!w) return false;
    const d = Math.min(2, devicePixelRatio || 1); W = w; H = 180; R = Math.min(W, H) * 0.4;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d); cx.setTransform(d, 0, 0, d, 0, 0); return true;
  }
  function P(g, u) {
    const lon = u * TAU * 0.9 + g.a * 1.1 + t * 0.00012 * (g.a % 2 ? 1 : -1);
    let x = Math.cos(lon), z = Math.sin(lon);
    const c = Math.cos(g.ax), s = Math.sin(g.ax), ct = Math.cos(g.tl), st = Math.sin(g.tl);
    let X = x * c + z * s, Z = -x * s + z * c; const y = -Z * st; Z = Z * ct;
    x = X * c - Z * s; z = X * s + Z * c;
    const cy = Math.cos(rot), sy = Math.sin(rot), c2 = Math.cos(-0.35), s2 = Math.sin(-0.35);
    [x, z] = [x * cy - z * sy, x * sy + z * cy]; const y2 = y * c2 - z * s2; z = y * s2 + z * c2;
    const f = 2.6 / (2.6 + z); return [W / 2 + x * R * f, H / 2 - 6 + y2 * R * f, z];
  }
  function draw() {
    if (!W || !items.length) return;
    cx.clearRect(0, 0, W, H); cx.globalCompositeOperation = dark ? "lighter" : "source-over";
    const core = cx.createRadialGradient(W / 2, H / 2 - 6, 0, W / 2, H / 2 - 6, R * 0.35);
    core.addColorStop(0, col[5] + "66"); core.addColorStop(1, col[5] + "00"); cx.fillStyle = core; cx.beginPath(); cx.arc(W / 2, H / 2 - 6, R * 0.35, 0, TAU); cx.fill();
    rings.forEach((g) => {
      cx.strokeStyle = col[g.b]; cx.lineWidth = 1; let p = P(g, 0);
      for (let s = 1; s <= 60; s++) { const q = P(g, s / 60 * 1.111); cx.globalAlpha = 0.08 + 0.3 * (1 - (p[2] + q[2] + 2) / 4); cx.beginPath(); cx.moveTo(p[0], p[1]); cx.lineTo(q[0], q[1]); cx.stroke(); p = q; }
      g.g.forEach((r, j) => { const [x, y, z] = P(g, g.g.length > 1 ? j / (g.g.length - 1) : 0), d = 0.25 + 0.75 * (1 - z) / 2;
        cx.globalAlpha = d * (j === 0 ? 1 : 0.8); cx.lineWidth = j === 0 ? 1.8 : 1.1; cx.beginPath(); cx.arc(x, y, r * (j === 0 ? 1.3 : 1), 0, TAU); cx.stroke(); });
    });
    cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
  }
  function loop(now) { const dt = Math.min(50, now - (last || now)); if (now - last > 40 || !last) { last = now; t += dt; rot += 0.0016 * dt / 16; draw(); } raf = requestAnimationFrame(loop); }
  const start = () => { if (!raf && on && !still && !document.hidden && items.length && W) { last = 0; raf = requestAnimationFrame(loop); } }, stop = () => { cancelAnimationFrame(raf); raf = 0; };
  function ready() { if (load()) { theme(); if (size()) draw(); start(); } }
  addEventListener("grj-nst", ready);
  if (typeof nst !== "undefined" && nst.data && nst.data.all) ready();
  new ResizeObserver(() => { if (size()) { draw(); start(); } else stop(); }).observe(cv);
  new MutationObserver(() => { theme(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { theme(); draw(); });
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { on = e.isIntersecting; on ? start() : stop(); }).observe(cv);
  document.addEventListener("visibilitychange", () => { document.hidden ? stop() : start(); });
})();
