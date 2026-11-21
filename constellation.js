/* The Master Oracle (research.html, first tab; the homepage globe until 2026-11-18): a turning glass globe on which every study in the Evidence Oracle (data.js) is one ribbon of light,
   with the study itself as the bead at its head. A study filed under one topic circles in its own faint lane inside that topic's
   region; a study filed under two topics loops out to the second region and back. Researchers (researchers-data.js) are quiet
   lights in the region of their main topic. Topics and colours come from topics.js and the --t-* tokens in site-nav.css, the
   same sources the Oracle page uses.
   Drag to spin it; hover a bead for its study or a light for its researcher; point at a topic in the page's rail (or the key, where a page has one) to light that
   topic and turn the globe to face it; the rail's filters dim every study that doesn't match. The canvas fills the whole panel, and the globe is centred on the empty #sky-orb box, which the page keeps
   clear of text. Reduced motion draws one still frame; drawing stops while the hero is off screen. */
(function () {
  const TOPICS = window.GRJ_TOPICS, KEYS = TOPICS.map((t) => t[0]), KI = Object.fromEntries(KEYS.map((k, i) => [k, i]));
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const box = document.getElementById("sky"), cv = document.getElementById("sky-art"), tip = document.getElementById("sky-tip"), legend = document.getElementById("legend");
  if (!box || !cv || typeof NETWORK === "undefined" || typeof REC === "undefined") return;
  const cx = cv.getContext("2d"), orb = document.getElementById("sky-orb");
  { const n = document.getElementById("door-n"); if (n) n.textContent = `${REC.length} studies`; }

  // ---------- small maths ----------
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const mul = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
  const fib = (i, n) => { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963; return [Math.cos(a) * r, y, Math.sin(a) * r]; };
  function slerp(a, b, u) {
    const w = Math.acos(Math.max(-1, Math.min(1, dot(a, b)))); if (w < 1e-4) return a;
    const s = Math.sin(w), p = Math.sin((1 - u) * w) / s, q = Math.sin(u * w) / s;
    return [a[0] * p + b[0] * q, a[1] * p + b[1] * q, a[2] * p + b[2] * q];
  }
  function basis(c) { const up = Math.abs(c[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0], t1 = norm(cross(up, c)); return [t1, cross(c, t1)]; }
  function capB(c, t1, t2, r, a) { const x = Math.cos(a) * r, y = Math.sin(a) * r; return norm([c[0] + t1[0] * x + t2[0] * y, c[1] + t1[1] * x + t2[1] * y, c[2] + t1[2] * x + t2[2] * y]); }
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

  // ---------- data ----------
  const people = NETWORK.people.map((p, i) => ({ id: p.id, name: p.name, n: p.n, k: grjPersonKey(p), home: p.home || [], ph: (i * 2.399) % 6.28 }));
  const at = Object.fromEntries(people.map((p, i) => [p.id, i]));
  const links = NETWORK.links.map(([a, b]) => [at[a], at[b]]).filter(([a, b]) => a !== undefined && b !== undefined);
  const studies = REC.slice().sort((a, b) => a.y - b.y || a.i - b.i).map((r, i) => ({ i, id: r.i, y: r.yl || r.y, t: r.t, a: r.a, tp: r.tp.filter((k) => k in KI), ph: i * 0.09 }));
  const tkey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60), sIdx = {};
  REC.forEach((r) => { const s = studies.find((q) => q.t === r.t && q.a === r.a); if (r.doi) sIdx[r.doi.toLowerCase()] = s; sIdx[tkey(r.t)] = s; });
  people.forEach((p) => { p.st = p.home.map((h) => sIdx[h]).filter(Boolean); });

  // Nine topic regions spread evenly over the globe; each researcher sits in the region of their main topic, busiest authors in the middle
  const CEN = KEYS.map((k, i) => { const c = fib(i, KEYS.length), [t1, t2] = basis(c); return { k, c, t1, t2, r: 0.3 }; });
  KEYS.forEach((k, i) => {
    const mine = people.filter((p) => p.k === k).sort((a, b) => b.n - a.n), C = CEN[i]; C.r = 0.15 + 0.068 * Math.sqrt(mine.length);
    mine.forEach((p, j) => { p.reg = capB(C.c, C.t1, C.t2, C.r * Math.sqrt((j + 0.3) / mine.length) * 1.15, j * 2.399963 + i); });
  });

  // ---------- theme, sprites ----------
  let colour = [], dark = false, bg = [247, 249, 248], jade = [75, 112, 106], sprites = [];
  const hex = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    colour = KEYS.map((k) => cs.getPropertyValue("--t-" + k).trim());
    dark = cs.colorScheme === "dark"; bg = hex(cs.getPropertyValue("--bg").trim()); jade = hex(cs.getPropertyValue("--accent").trim());
    sprites = colour.map((c) => {
      const s = document.createElement("canvas"); s.width = s.height = 64; const g = s.getContext("2d"), rg = hex(c);
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, rgba(rg, 1)); gr.addColorStop(0.25, rgba(rg, 0.45)); gr.addColorStop(0.6, rgba(rg, 0.1)); gr.addColorStop(1, rgba(rg, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return s;
    });
  }
  readTheme();

  // ---------- view ----------
  let W = 0, H = 0, R = 0, X0 = 0, Y0 = 0, scale = 0.46;
  let rotY = 0.6, rotX = -0.28, velY = 0.0009, drag = null, target = null, cy = 1, sy = 0, cxr = 1, sxr = 0;
  let keep = null;   // the Oracles rail filter: the study ids that match it, or null for every study
  let pointer = null, hot = null, hover = null, raf = 0, last = 0, now = 0, born = 0, intro = still ? 1 : 0;
  const BASE = 0.00013;   // radians per millisecond at rest: one turn in about 48 seconds
  function P(v) {
    const x1 = v[0] * cy - v[2] * sy, z1 = v[0] * sy + v[2] * cy, y2 = v[1] * cxr - z1 * sxr, z2 = v[1] * sxr + z1 * cxr, f = 2.6 / (2.6 + z2);
    return { x: X0 + x1 * R * f, y: Y0 + y2 * R * f, z: z2, f, nx: x1, ny: y2 };
  }
  const depth = (z) => 0.22 + 0.78 * clamp((1 - z) / 2, 0, 1);
  const glow = (x, y, r, ki, a) => { if (a <= 0.003 || r <= 0) return; cx.globalAlpha = Math.min(1, a); cx.drawImage(sprites[ki], x - r, y - r, r * 2, r * 2); };
  const disc = (x, y, r) => { cx.beginPath(); cx.arc(x, y, Math.max(0.2, r), 0, 6.2832); cx.fill(); };
  const blend = () => { cx.globalCompositeOperation = dark ? "lighter" : "source-over"; };
  // The body of the globe, drawn between the far side and the near side so the far side reads as behind glass
  function veil(strength, rim) {
    cx.globalCompositeOperation = "source-over"; cx.globalAlpha = 1;
    const keep = R; R = keep * 1.083;   // the globe's outline under this perspective
    let g = cx.createRadialGradient(X0 - R * 0.3, Y0 - R * 0.35, R * 0.05, X0, Y0, R);
    g.addColorStop(0, rgba(bg, strength * 0.7)); g.addColorStop(0.8, rgba(bg, strength)); g.addColorStop(1, rgba(bg, strength * 0.85));
    cx.fillStyle = g; cx.beginPath(); cx.arc(X0, Y0, R, 0, 6.2832); cx.fill();
    g = cx.createRadialGradient(X0, Y0, R * 0.7, X0, Y0, R * 1.3);
    g.addColorStop(0, rgba(jade, 0)); g.addColorStop(0.47, rgba(jade, rim)); g.addColorStop(0.5, rgba(jade, rim * 1.5)); g.addColorStop(0.54, rgba(jade, rim * 0.55)); g.addColorStop(1, rgba(jade, 0));
    cx.fillStyle = g; cx.beginPath(); cx.arc(X0, Y0, R * 1.3, 0, 6.2832); cx.fill();
    R = keep; blend();
  }
  const isHot = (ki) => hot !== null && ki === hot;
  const nearPtr = (s) => pointer && s.z < 0.3 && Math.hypot(s.x - pointer[0], s.y - pointer[1]) < 110;
  function drawPerson(p, pass, k) {   // a researcher: a soft halo and a bright core in their main topic's colour
    const s = p.s; if ((s.z > 0) !== (pass === 0)) return;
    const ki = KI[p.k], dim = hot !== null && ki !== hot && !p.lit, lit = p.lit || nearPtr(s) || isHot(ki), d = depth(s.z);
    const r = (1.5 + Math.sqrt(p.n) * 1.45) * s.f * (1 + 0.14 * Math.sin(now / 900 + p.ph)) * k * (R / 300 * 0.5 + 0.5);
    glow(s.x, s.y, r * (lit ? 6.5 : 4.6), ki, (dim ? 0.05 : lit ? 0.8 : 0.42) * d * k);
    cx.globalAlpha = (dim ? 0.22 : 1) * d * k; cx.fillStyle = colour[ki]; disc(s.x, s.y, r);
    if (hover === p) { cx.globalAlpha = 0.9; cx.strokeStyle = colour[ki]; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(s.x, s.y, r + 5, 0, 6.2832); cx.stroke(); }
  }
  const stagger = (i, n) => ease(intro * 1.9 - (i / n) * 0.9);

  function regions(pass, k) { CEN.forEach((c, ki) => { if ((c.s.z > 0) === (pass === 0)) glow(c.s.x, c.s.y, c.r * R * 2.2 * c.s.f, ki, (hot === null ? k : isHot(ki) ? k * 2.2 : 0.03) * depth(c.s.z) * intro); }); }
  const placePeople = () => { people.forEach((p) => { p.s = P(p.reg); p.lit = false; }); CEN.forEach((c) => { c.s = P(c.c); }); };
  const drawPeople = (pass, k) => people.slice().sort((a, b) => b.s.z - a.s.z).forEach((p, i) => drawPerson(p, pass, stagger(i, people.length) * k));
  // Coloured line segments are collected into buckets (side of the globe x topic x brightness) and stroked together
  const NB = 2 * 9 * 4, ALPHA = [0.95, 0.5, 0.2, 0.045];
  function strokeBuckets(buckets, pass, wide, am) {
    am = am || 1;
    cx.lineCap = "round";
    for (let ci = 0; ci < 9; ci++) for (let lvl = 0; lvl < 4; lvl++) {
      const b = buckets[pass * 36 + ci * 4 + lvl]; if (!b.length) continue;
      cx.strokeStyle = colour[ci]; cx.globalAlpha = ALPHA[lvl] * (pass ? 1 : 0.45) * (dark ? 1 : 0.9) * am; cx.lineWidth = (pass ? 1.15 : 0.8) * (lvl === 0 ? 1.25 : lvl === 1 ? 1 : 0.8) * wide;
      cx.beginPath(); for (let i = 0; i < b.length; i += 4) { cx.moveTo(b[i], b[i + 1]); cx.lineTo(b[i + 2], b[i + 3]); } cx.stroke();
    }
  }

  // ---------- the ribbons ----------
  // Exactly one ribbon per study. A one-topic study circles inside its topic; a two-topic study loops out to the second topic and back.
  function ribbons() {
    const rnd = rng(23), TAIL = 34, per = KEYS.map(() => 0), seen = KEYS.map(() => 0);
    studies.forEach((s) => { if (s.tp.length < 2) per[KI[s.tp[0]] || 0]++; });
    studies.forEach((s) => {
      const a = KI[s.tp[0]] || 0, b = s.tp[1] ? KI[s.tp[1]] : a, A = CEN[a], B = CEN[b]; s.ra = a; s.rb = b; s.u = rnd(); s.base = 0.015 + rnd() * 0.05; s.lit = false;
      if (a === b) { const j = seen[a]++; s.rad = A.r * (0.2 + 0.95 * (j + 0.5) / per[a]); s.ang = rnd() * 6.2832; s.dir = j % 2 ? -1 : 1; s.du = 1 / (15000 + rnd() * 12000); s.gap = 0.0085; }
      else {
        s.pa = capB(A.c, A.t1, A.t2, A.r * (0.2 + rnd() * 0.5), rnd() * 6.2832); s.pb = capB(B.c, B.t1, B.t2, B.r * (0.2 + rnd() * 0.5), rnd() * 6.2832);
        s.side = norm(cross(s.pa, s.pb)); s.amp = 0.14 + rnd() * 0.2; s.h = 0.03 + rnd() * 0.08; s.du = 1 / (17000 + rnd() * 10000); s.gap = 0.0062;
      }
    });
    function pos(s, u) {
      u = ((u % 1) + 1) % 1;
      if (s.ra === s.rb) { const C = CEN[s.ra]; return mul(capB(C.c, C.t1, C.t2, s.rad, s.ang + s.dir * u * 6.2832), 1 + s.base); }
      const back = u >= 0.5, v = back ? (u - 0.5) * 2 : u * 2, e = v * v * (3 - 2 * v), q = back ? slerp(s.pb, s.pa, e) : slerp(s.pa, s.pb, e), w = Math.sin(Math.PI * v) * (back ? -1 : 1);
      return mul(norm([q[0] + s.side[0] * s.amp * w, q[1] + s.side[1] * s.amp * w, q[2] + s.side[2] * s.amp * w]), 1 + s.base + s.h * Math.abs(w));
    }
    const side = (s, u) => { if (s.ra === s.rb) return s.ra; u = ((u % 1) + 1) % 1; return u < 0.25 || u >= 0.75 ? s.ra : s.rb; };
    const buckets = Array.from({ length: NB }, () => []), lanes = Array.from({ length: NB }, () => []);
    const paths = studies.map((s) => Array.from({ length: 73 }, (_, i) => pos(s, i / 72)));   // the full lane each study travels
    return {
      scale: 0.38, veil: [0.6, 0.14], targets: () => people.concat(studies), focus: (ki) => CEN[ki].c,
      step(dt) { for (const s of studies) s.u = (s.u + s.du * dt) % 1; },
      update() {
        placePeople(); buckets.forEach((b) => { b.length = 0; }); lanes.forEach((b) => { b.length = 0; });
        studies.forEach((s, n) => { const off = (hot !== null && s.ra !== hot && s.rb !== hot) || (keep && !keep.has(s.id)); let prev = P(paths[n][0]); for (let i = 1; i < 73; i++) { const q = P(paths[n][i]); lanes[((prev.z + q.z) > 0 ? 0 : 36) + side(s, i / 72) * 4 + (off ? 3 : 1)].push(prev.x, prev.y, q.x, q.y); prev = q; } });
        const grow = ease(intro * 1.3), len = Math.round(TAIL * (0.25 + 0.75 * grow));
        for (const s of studies) {
          s.lit = hover === s || (hover && hover.st && hover.st.includes(s));
          const off = (hot !== null && s.ra !== hot && s.rb !== hot) || (keep && !keep.has(s.id)) || (hover && hover.st && !s.lit);
          let prev = s.s = P(pos(s, s.u)); s.ki = side(s, s.u); s.off = off;
          for (let j = 1; j <= len; j++) {
            const u = s.u - j * s.gap, q = P(pos(s, u)), t = j / len, lvl = off ? 3 : s.lit ? 0 : t < 0.3 ? 0 : t < 0.65 ? 1 : 2;
            buckets[((prev.z + q.z) > 0 ? 0 : 36) + side(s, u) * 4 + lvl].push(prev.x, prev.y, q.x, q.y); prev = q;
          }
        }
        people.forEach((p) => { p.lit = hover && hover.t !== undefined && p.st.includes(hover); });
      },
      draw(pass) {
        regions(pass, 0.12); strokeBuckets(lanes, pass, 0.7, 0.3 * ease(intro * 1.6)); strokeBuckets(buckets, pass, 1.9);
        for (const s of studies) {   // the bead at the head of each ribbon is the study itself
          const q = s.s; if ((q.z > 0) !== (pass === 0)) continue; const d = depth(q.z), k = stagger(s.i, studies.length), r = (s.lit ? 3.6 : 2.4) * q.f * (R / 300 * 0.5 + 0.5);
          glow(q.x, q.y, r * (s.lit ? 6 : 4), s.ki, (s.off ? 0.04 : s.lit ? 0.9 : 0.6) * d * k);
          cx.globalAlpha = (s.off ? 0.15 : 1) * d * k; cx.fillStyle = dark ? "#fff" : colour[s.ki]; disc(q.x, q.y, r * (dark ? 0.55 : 0.8));
          if (hover === s) { cx.globalAlpha = 0.9; cx.strokeStyle = colour[s.ki]; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(q.x, q.y, r + 5, 0, 6.2832); cx.stroke(); }
        }
        drawPeople(pass, 0.8);
      }
    };
  }

  // ---------- the loop ----------
  let scene = null;
  function size() {
    const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; X0 = W / 2; Y0 = H * 0.5; R = Math.min(W, H) * scale;   // the globe is centred on the box the page keeps clear for it
    if (orb) { const b = orb.getBoundingClientRect(); X0 = b.left - r.left + b.width / 2; Y0 = b.top - r.top + b.height / 2; R = Math.min(b.width, b.height) * scale; }
    cv.width = Math.round(W * d); cv.height = Math.round(H * d); cx.setTransform(d, 0, 0, d, 0, 0);
  }
  function setRot() { cy = Math.cos(rotY); sy = Math.sin(rotY); cxr = Math.cos(rotX); sxr = Math.sin(rotX); }
  function draw(t) {
    now = t; setRot(); scene.update(); cx.clearRect(0, 0, W, H); blend();
    scene.draw(0); veil(scene.veil[0], scene.veil[1] * (dark ? 1.25 : 1)); scene.draw(1);
    cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
  }
  function step(dt) {
    if (!born) born = now; intro = still ? 1 : clamp((now - born) / 2600, 0, 1);
    if (drag) return;
    if (target) {   // turning to face a topic region
      let dy = target[0] - rotY; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); rotY += dy * Math.min(1, dt * 0.004); rotX += (target[1] - rotX) * Math.min(1, dt * 0.004); velY = 0;
    } else { rotY += velY * dt; velY += (BASE - velY) * Math.min(1, dt * 0.0016); rotX += (-0.28 - rotX) * Math.min(1, dt * 0.0004); }
    if (scene.step) scene.step(dt);
  }
  function loop(t) { const dt = Math.min(60, t - (last || t)); last = t; now = t; step(dt); draw(t); raf = requestAnimationFrame(loop); }
  const start = () => { if (!raf && !still) { last = 0; raf = requestAnimationFrame(loop); } }, stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const redraw = () => { if (still || !raf) draw(now); };
  function setHot(k) {
    hot = k === null || !(k in KI) ? null : KI[k];
    if (legend) { legend.classList.toggle("dim", k !== null); legend.querySelectorAll("li").forEach((li) => li.classList.toggle("hot", li.dataset.k === k)); }
    const c = hot === null ? null : scene.focus(hot);
    if (c) { const ry = Math.atan2(c[0], c[2]) + Math.PI, flat = Math.hypot(c[0], c[2]); target = [ry, clamp(Math.asin(-0.5) - Math.atan2(c[1], flat), -1.2, 1.2)]; } else target = null;
    redraw();
  }
  function showTip(o) {
    if (!o) { tip.style.opacity = 0; return; }
    const ki = KI[o.k || (o.tp && o.tp[0])] || 0, dotEl = document.createElement("i"); dotEl.style.background = colour[ki];
    const text = o.name ? `${o.name} · ${o.n} ${o.n === 1 ? "study" : "studies"}` : `${o.y} · ${o.a} · ${o.t.length > 54 ? o.t.slice(0, 52).trimEnd() + "…" : o.t}`;
    tip.replaceChildren(dotEl, text);
    tip.style.left = Math.max(8, Math.min(W - tip.offsetWidth - 8, o.s.x + 14)) + "px"; tip.style.top = o.s.y - 38 + "px"; tip.style.opacity = 1;
  }
  function point(e) {
    const r = cv.getBoundingClientRect(); pointer = [e.clientX - r.left, e.clientY - r.top];
    let best = null, gap = 18; for (const o of scene.targets()) { if (!o.s || o.s.z > 0.25) continue; const d = Math.hypot(o.s.x - pointer[0], o.s.y - pointer[1]) - (o.name ? 4 : 0); if (d < gap) { gap = d; best = o; } }
    hover = best; showTip(best); redraw();
  }
  cv.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY, performance.now()]; target = null; cv.setPointerCapture(e.pointerId); box.classList.add("grabbing"); point(e); });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1], t = performance.now(), dt = Math.max(8, t - drag[2]); drag = [e.clientX, e.clientY, t];
    rotY += dx * 0.006; velY = clamp(dx * 0.006 / dt, -0.02, 0.02); rotX = clamp(rotX + dy * 0.006, -1.2, 1.2); redraw();
  });
  const release = () => { drag = null; box.classList.remove("grabbing"); };
  cv.addEventListener("pointerup", release); cv.addEventListener("pointercancel", release);
  box.addEventListener("pointermove", point);
  box.addEventListener("pointerleave", () => { pointer = null; hover = null; showTip(null); redraw(); });
  if (legend) {
    legend.innerHTML = TOPICS.map(([k, n]) => `<li data-k="${k}" style="--c: var(--t-${k})"><i></i>${n}</li>`).join("");
    legend.addEventListener("pointerover", (e) => { const li = e.target.closest("li"); if (li) setHot(li.dataset.k); });
    legend.addEventListener("pointerleave", () => setHot(null));
  }
  // research.html drives the globe from its rail: pointing at a topic lights it and turns the globe to it; the filters dim every other study
  window.GRJ_MASTER = { hot: (k) => { if ((k === null ? null : KI[k]) !== hot) setHot(k); }, keep: (ids) => { keep = ids; redraw(); } };
  new ResizeObserver(() => { size(); draw(now); }).observe(cv);
  new MutationObserver(() => { readTheme(); draw(now); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTheme(); draw(now); });
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { e.isIntersecting && !document.hidden ? start() : stop(); }).observe(box);
  document.addEventListener("visibilitychange", () => { document.hidden ? stop() : start(); });
  velY = still ? BASE : 0.0042;   // the globe spins in and settles
  size(); scene = ribbons(); scale = scene.scale; size(); draw(0);
  start();
})();
