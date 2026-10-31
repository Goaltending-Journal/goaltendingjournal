/* The Topic Aurora on the home page: one ribbon of light per research topic, drawn from data.js (REC).
   Left to right is 1995 to now; a ribbon is thick in the years its topic had studies (smoothed, square-root scaled).
   Each study is a spark that drifts along its first topic's ribbon. The ribbons sway slowly and lean toward the pointer;
   hover a ribbon or a legend entry to light that topic. Colours come from the --t-* tokens in index.html.
   About 30 frames a second; reduced motion draws one still frame; drawing stops while the hero is off screen or the tab is hidden. */
(function () {
  const TOPICS = [
    ["hip", "Hip & groin"], ["inj", "Injury & safety"], ["eq", "Equipment"],
    ["vis", "Vision & anticipation"], ["phy", "Physiology & training"],
    ["bio", "Movement & biomechanics"], ["psy", "Psychology & cognition"],
    ["dev", "Development & coaching"], ["stats", "Performance analytics"]
  ];
  // Top to bottom: neighbours alternate warm and cool so overlapping ribbons stay distinct
  const LANES = ["hip", "inj", "vis", "eq", "bio", "phy", "psy", "dev", "stats"];
  const box = document.getElementById("aurora"), cv = document.getElementById("aurora-art");
  if (!box || !cv || typeof REC === "undefined") return;
  // Glow: the ribbon bodies drawn small on a second canvas, then stretched over the scene, which blurs them for free
  const glow = document.createElement("canvas"), gx = glow.getContext("2d"), G = 5;
  const cx = cv.getContext("2d"), tip = document.getElementById("aurora-tip"), legend = document.getElementById("legend");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const name = Object.fromEntries(TOPICS);
  const Y0 = 1995, Y1 = Math.max(new Date().getFullYear(), ...REC.map((r) => r.y || 0));
  const YEARS = Array.from({ length: Y1 - Y0 + 1 }, (_, i) => Y0 + i);

  // Studies per topic per year, Gaussian-smoothed, then square-root scaled against the busiest topic-year
  const total = {}, series = {};
  for (const k of LANES) {
    const raw = YEARS.map((y) => REC.filter((r) => r.y === y && (r.tp || []).includes(k)).length);
    total[k] = REC.filter((r) => (r.tp || []).includes(k)).length;
    series[k] = raw.map((_, i) => { let a = 0, w = 0; for (let d = -3; d <= 3; d++) { if (raw[i + d] === undefined) continue; const g = Math.exp(-d * d / 5); a += raw[i + d] * g; w += g; } return Math.sqrt(a / w); });
  }
  const peak = Math.max(...LANES.flatMap((k) => series[k]));
  const sparks = REC.filter((r) => r.y && r.tp && r.tp.length).map((r, i) => ({ k: r.tp[0], off: (i * 0.6180339) % 1, lane: ((i * 0.37) % 1) - 0.5, sp: 0.6 + ((i * 0.53) % 1) * 0.6 }));

  const n = document.getElementById("door-n"); if (n) n.textContent = `${REC.length} studies`;
  legend.innerHTML = LANES.map((k) => `<li data-k="${k}" style="--c: var(--t-${k})"><i></i>${name[k]}</li>`).join("");

  let W = 0, H = 0, colour = {}, dark = false, hot = null, pointer = null, lean = 0, t0 = performance.now(), raf = 0, visible = true, now = 0;
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    colour = Object.fromEntries(LANES.map((k) => [k, cs.getPropertyValue("--t-" + k).trim()]));
    dark = cs.colorScheme === "dark" || document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function size() {
    const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = Math.round(W * d); cv.height = Math.round(H * d); cx.setTransform(d, 0, 0, d, 0, 0);
    glow.width = Math.ceil(W / G); glow.height = Math.ceil(H / G); gx.setTransform(1 / G, 0, 0, 1 / G, 0, 0);
  }

  // A ribbon's centre line and half-width at x, at time t (ms)
  function at(k, x, t) {
    const i = LANES.indexOf(k), u = x / W, f = Math.max(0, Math.min(YEARS.length - 1, u * (YEARS.length - 1))), lo = Math.floor(f), m = f - lo;
    const v = series[k][lo] * (1 - m) + (series[k][Math.min(lo + 1, YEARS.length - 1)]) * m;
    const base = H * (0.14 + 0.68 * (i + 0.5) / LANES.length);
    const sway = Math.sin(u * 4.2 + t / 5200 + i * 1.7) * H * 0.075 + Math.sin(u * 9.5 - t / 3700 + i * 0.9) * H * 0.022;
    const pull = pointer ? (pointer[1] - base) * 0.12 * Math.exp(-Math.pow((x - pointer[0]) / (W * 0.18), 2)) : 0;
    return [base + sway + pull + lean * (u - 0.5) * H * 0.05, 1.2 + (v / peak) * Math.min(H, W * 0.75) * 0.055];
  }
  function path(k, t) { const pts = []; for (let x = -24; x <= W + 36; x += 12) { const [y, w] = at(k, x, t); pts.push([x, y, w]); } return pts; }
  function smooth(c, pts, side, k = 1, join = false) {
    c[join ? "lineTo" : "moveTo"](pts[0][0], pts[0][1] + side * pts[0][2] * k);
    for (let j = 1; j < pts.length - 1; j++) { const a = pts[j], b = pts[j + 1]; c.quadraticCurveTo(a[0], a[1] + side * a[2] * k, (a[0] + b[0]) / 2, (a[1] + side * a[2] * k + b[1] + side * b[2] * k) / 2); }
  }
  // The ribbon's body as one closed shape: upper edge left to right, lower edge back; k widens it
  function body(c, pts, k = 1) {
    c.beginPath(); smooth(c, pts, -1, k); smooth(c, pts.slice().reverse(), 1, k, true); c.closePath();
  }

  function draw(t) {
    now = t;
    cx.clearRect(0, 0, W, H);
    const intro = still ? 1 : Math.min(1, (t - t0) / 1800), reveal = 1 - Math.pow(1 - intro, 3);
    cx.save(); cx.beginPath(); cx.rect(0, 0, W * reveal + 60, H); cx.clip();
    const paths = Object.fromEntries(LANES.map((k) => [k, path(k, t)]));
    const fades = Object.fromEntries(LANES.map((k) => { const c = colour[k], g = cx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, c + "00"); g.addColorStop(0.14, c); g.addColorStop(0.9, c); g.addColorStop(1, c + "00"); return [k, g]; }));
    if (dark) {
      gx.clearRect(0, 0, W, H); gx.globalCompositeOperation = "lighter"; gx.filter = "blur(3px)";
      for (const k of LANES) { if (hot && hot !== k) continue; body(gx, paths[k], 1.6); gx.fillStyle = fades[k]; gx.globalAlpha = hot === k ? 0.6 : 0.28; gx.fill(); }
      cx.globalCompositeOperation = "screen"; cx.globalAlpha = 1; cx.imageSmoothingQuality = "high"; cx.drawImage(glow, 0, 0, glow.width * G, glow.height * G);
    }
    cx.globalCompositeOperation = dark ? "screen" : "multiply";
    for (const k of LANES) {
      const pts = paths[k], dim = hot && hot !== k, lit = hot === k;
      body(cx, pts); cx.fillStyle = fades[k];
      cx.globalAlpha = dim ? 0.07 : dark ? (lit ? 0.6 : 0.34) : (lit ? 0.42 : 0.24); cx.fill();
      // a bright core along the centre
      cx.beginPath(); smooth(cx, pts, 0); cx.strokeStyle = fades[k]; cx.lineWidth = lit ? 1.8 : 1; cx.globalAlpha = dim ? 0.12 : 0.85; cx.stroke();
    }
    // sparks: one per study, drifting along its topic
    cx.globalCompositeOperation = dark ? "lighter" : "source-over";
    for (const s of sparks) {
      const x = ((s.off + (t / 1000) * 0.012 * s.sp) % 1) * (W + 40) - 20, [y, w] = at(s.k, x, t), dim = hot && hot !== s.k;
      const edge = Math.min(1, x / (W * 0.12), (W - x) / (W * 0.1));
      if (edge <= 0) continue;
      cx.globalAlpha = (dim ? 0.15 : 0.9) * edge; cx.fillStyle = dark ? "#ffffff" : colour[s.k];
      cx.beginPath(); cx.arc(x, y + s.lane * w * 1.2, hot === s.k ? 2.2 : 1.5, 0, 6.3); cx.fill();
    }
    cx.restore(); cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
  }
  // about 30 frames a second: the motion is slow, so the eye cannot tell, and it halves the work
  let last = 0;
  function loop(t) { if (t - last > 30) { last = t; draw(t); } raf = visible && !still ? requestAnimationFrame(loop) : 0; }
  function start() { if (!raf && !still) raf = requestAnimationFrame(loop); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  function setHot(k) {
    hot = k; legend.classList.toggle("dim", !!k);
    legend.querySelectorAll("li").forEach((li) => li.classList.toggle("hot", li.dataset.k === k));
    if (still) draw(now);
  }
  box.addEventListener("pointermove", (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    pointer = [x, y]; lean = (x / W - 0.5) * 2;
    let best = null, gap = 14;
    for (const k of LANES) { const [cy, w] = at(k, x, now); const d = Math.abs(y - cy) - w; if (d < gap) { gap = d; best = k; } }
    setHot(best);
    if (best) {
      tip.innerHTML = `<i style="background:${colour[best]}"></i>${name[best]} · ${total[best]} ${total[best] === 1 ? "study" : "studies"}`;
      tip.style.left = Math.min(W - tip.offsetWidth - 8, x + 14) + "px"; tip.style.top = y - 38 + "px"; tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  box.addEventListener("pointerleave", () => { pointer = null; lean = 0; setHot(null); tip.style.opacity = 0; });
  legend.addEventListener("pointerover", (e) => { const li = e.target.closest("li"); if (li) setHot(li.dataset.k); });
  legend.addEventListener("pointerleave", () => setHot(null));

  readTheme(); size(); draw(t0);
  new ResizeObserver(() => { size(); draw(now); }).observe(cv);
  new MutationObserver(() => { readTheme(); draw(now); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTheme(); draw(now); });
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; visible ? start() : stop(); }).observe(box);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; visible ? start() : stop(); });
  start();
})();
