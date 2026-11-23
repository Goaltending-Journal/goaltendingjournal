/* Coaching Oracle: ecological dynamics, skill acquisition and practice design (learning-data.js, plus the newest studies in
   research.js), shown as the Coaching Oracle tab on research.html. Every work is a point of light on a slowly turning globe. Each theme has its own region of the globe, and a work
   that spans two or three themes sits between them. A fine thread runs through each researcher's works in date order. The newest
   studies pulse. Drag to spin it; point at a work to read it, click to pin it; arrow keys step through the years; point at a theme
   in the key to light it, press it to show only its works. Reduced motion draws still frames; drawing stops while the tab is hidden or off screen. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const base = typeof LEARNING !== "undefined" ? LEARNING : [];
  const seen = new Set(base.map((w) => w.doi).filter(Boolean));
  const fresh = (typeof RESEARCH !== "undefined" ? RESEARCH : []).filter((r) => !(r.doi && seen.has(r.doi.toLowerCase())))
    .map((r) => ({ y: Number(r.d.slice(0, 4)), d: r.d, t: r.t, a: r.a, j: r.j, doi: r.doi, u: r.u, by: [], th: (r.tg || []).filter((k) => k === "ed" || k === "sa"), n: r.n, isNew: 1 }));
  // Evidence-only (Goldy, 2026-11-23): coaching-evidence.js lists the works the Research Agent cleared (DOI, or title when there is none).
  // Until that list exists (COACHING_EVIDENCE is null) every work shows.
  const cleared = typeof COACHING_EVIDENCE !== "undefined" && COACHING_EVIDENCE ? new Set(COACHING_EVIDENCE.map((x) => String(x).toLowerCase().trim())) : null;
  const evKey = (w) => [w.doi ? String(w.doi).split("](")[0].toLowerCase().trim() : null, String(w.t || "").toLowerCase().trim()];
  const items = base.concat(fresh).filter((w) => w.th && w.th.length && (!cleared || evKey(w).some((k) => k && cleared.has(k)))).sort((a, b) => a.y - b.y || (a.d || "").localeCompare(b.d || ""));
  if (!items.length || !$("lo-cv")) return;
  const THEMES = [["ed", "Ecological dynamics", "--t-vis"], ["sa", "Skill acquisition", "--t-bio"], ["pd", "Practice design", "--t-eq"]];
  const TNAME = Object.fromEntries(THEMES.map(([k, n]) => [k, n]));
  // A few DOIs in learning-data.js carry a pasted Markdown tail ("10.x/y](https://doi.org/10.x/y"); keep the part before it
  const link = (w) => (w.doi ? "https://doi.org/" + String(w.doi).split("](")[0] : w.u);
  const cv = $("lo-cv"), box = $("lo"), tip = $("lo-tip"), cx = cv.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches, TAU = Math.PI * 2;
  // Theme anchors sit 120 degrees apart, a little above and below the equator; each work is scattered around the mean of its themes
  const anchor = { ed: [1, 0.25, 0], sa: [-0.5, -0.3, 0.866], pd: [-0.5, 0.2, -0.866] };
  const norm = ([x, y, z]) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pts = items.map((w) => {
    const c = w.th.reduce((s, k) => [s[0] + anchor[k][0], s[1] + anchor[k][1], s[2] + anchor[k][2]], [0, 0, 0]);
    const spread = w.th.length === 1 ? 0.62 : 0.4, g = () => (rnd() + rnd() + rnd() - 1.5) * spread;
    return { s: norm([c[0] / w.th.length + g(), c[1] / w.th.length + g(), c[2] / w.th.length + g()]), ph: rnd() * 6.28, x: 0, y: 0, z: 0 };
  });
  // One thread per researcher, through their works in date order
  const trails = {};
  items.forEach((w, i) => w.by.forEach((p) => (trails[p] = trails[p] || []).push(i)));
  const links = []; Object.values(trails).forEach((ids) => { for (let j = 1; j < ids.length; j++) links.push([ids[j - 1], ids[j]]); });
  let W = 0, H = 0, R = 0, rotY = 0, rotX = -0.3, velY = 0.00107, t = 0, drag = null, hover = null, sel = items.length - 1, hot = null, only = new Set();
  let raf = 0, last = 0, on = false, colour = {}, dark = false, fg = "#000", bgc = "#fff", lbl = "sans-serif", sprites = {};
  function theme() {
    const cs = getComputedStyle(document.documentElement);
    colour = Object.fromEntries(THEMES.map(([k, , v]) => [k, cs.getPropertyValue(v).trim()]));
    dark = cs.colorScheme === "dark"; fg = cs.getPropertyValue("--fg").trim(); bgc = cs.getPropertyValue("--bg").trim(); lbl = cs.getPropertyValue("--label").trim();
    // a soft glow per theme, drawn once and stamped for every point
    sprites = Object.fromEntries(THEMES.map(([k]) => {
      const s = document.createElement("canvas"); s.width = s.height = 64; const g = s.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, colour[k]); r.addColorStop(1, colour[k] + "00"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return [k, s];
    }));
  }
  const tc = (i) => items[i].th[0];
  function size() {
    const w = box.getBoundingClientRect().width; if (!w) return false;
    const d = Math.min(2, devicePixelRatio || 1);
    W = w; H = Math.round(cv.getBoundingClientRect().height) || 480; R = Math.min(W * 0.9, H - 30) * 0.46;   // the same height and globe size as the Master Oracle (--oracle-h)
    cv.width = Math.round(W * d); cv.height = Math.round(H * d); cx.setTransform(d, 0, 0, d, 0, 0);
    return true;
  }
  function place() {
    const cy = Math.cos(rotY), sy = Math.sin(rotY), c2 = Math.cos(rotX), s2 = Math.sin(rotX);
    for (const p of pts) {
      let [x, y, z] = p.s; [x, z] = [x * cy - z * sy, x * sy + z * cy]; [y, z] = [y * c2 - z * s2, y * s2 + z * c2];
      const f = 2.6 / (2.6 + z); p.x = W / 2 + x * R * f; p.y = H / 2 + y * R * f; p.z = z; p.r = [x, y, z];
    }
  }
  const proj = ([x, y, z]) => { const f = 2.6 / (2.6 + z); return [W / 2 + x * R * f, H / 2 + y * R * f]; };
  const turn = ([x, y, z]) => { const cy = Math.cos(rotY), sy = Math.sin(rotY), c2 = Math.cos(rotX), s2 = Math.sin(rotX);
    [x, z] = [x * cy - z * sy, x * sy + z * cy]; [y, z] = [y * c2 - z * s2, y * s2 + z * c2]; return [x, y, z]; };
  // A thread follows the surface of the globe (a great-circle arc) instead of cutting through it
  function arc(a, b) {
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), om = Math.acos(dot), n = Math.max(2, Math.ceil(om * 8));
    cx.beginPath();
    for (let k = 0; k <= n; k++) {
      const u = k / n, s1 = om < 1e-3 ? 1 - u : Math.sin((1 - u) * om) / Math.sin(om), s2 = om < 1e-3 ? u : Math.sin(u * om) / Math.sin(om);
      const [x, y] = proj([a[0] * s1 + b[0] * s2, a[1] * s1 + b[1] * s2, a[2] * s1 + b[2] * s2]);
      k ? cx.lineTo(x, y) : cx.moveTo(x, y);
    }
    cx.stroke();
  }
  // Search words from the rail (title, authors, journal, year); a work is lit when it matches the search and the picked themes
  let q = [];
  const hay = items.map((w) => [w.t, w.a, w.j, w.y, (w.by || []).join(" ")].filter(Boolean).join(" ").toLowerCase());
  const keepIt = (i) => (!only.size || items[i].th.some((k) => only.has(k))) && q.every((x) => hay[i].includes(x));
  const lit = (i) => (!hot || items[i].th.includes(hot)) && keepIt(i);
  const depth = (z) => 0.25 + 0.75 * (1 - z) / 2;
  function draw() {
    if (!W) return;
    cx.clearRect(0, 0, W, H);
    const foc = hover ?? sel, mine = foc == null ? null : new Set(items[foc].by);
    // the globe itself: a soft limb, the equator and two meridians
    cx.globalAlpha = 1; cx.strokeStyle = fg; cx.lineWidth = 1;
    const lim = cx.createRadialGradient(W / 2, H / 2, R * 0.6, W / 2, H / 2, R * 1.12);
    lim.addColorStop(0, fg + "00"); lim.addColorStop(0.85, fg + (dark ? "10" : "0c")); lim.addColorStop(1, fg + "00");
    cx.fillStyle = lim; cx.beginPath(); cx.arc(W / 2, H / 2, R * 1.12, 0, TAU); cx.fill();
    for (const ring of [(u) => [Math.cos(u), 0, Math.sin(u)], (u) => [Math.cos(u), Math.sin(u), 0], (u) => [0, Math.sin(u), Math.cos(u)]]) {
      for (let k = 0; k < 96; k++) {
        const a = turn(ring(k / 96 * TAU)), b = turn(ring((k + 1) / 96 * TAU)), [x1, y1] = proj(a), [x2, y2] = proj(b);
        cx.globalAlpha = (a[2] < 0 ? 0.13 : 0.05); cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
      }
    }
    cx.globalCompositeOperation = dark ? "lighter" : "source-over";
    for (const [a, b] of links) {
      const p = pts[a], q = pts[b], own = mine && items[a].by.some((n) => mine.has(n)) && items[b].by.some((n) => mine.has(n));
      const dim = (hot || only.size) && !(lit(a) && lit(b)), d = Math.max(0.1, (1 - (p.z + q.z) / 2) / 2);
      cx.strokeStyle = colour[tc(a)]; cx.globalAlpha = (dim ? 0.02 : own ? 0.8 : 0.09) * d; cx.lineWidth = own ? 1.5 : 0.8;
      arc(p.r, q.r);
    }
    const order = pts.map((_, i) => i).sort((a, b) => pts[b].z - pts[a].z);
    for (const i of order) {
      const p = pts[i], w = items[i], d = depth(p.z), r = (w.isNew ? 4.6 : 2.2 + (w.gk ? 0.8 : 0)) * (1.25 - p.z * 0.35), on2 = lit(i);
      const pulse = w.isNew && !still ? 1 + 0.35 * Math.sin(t / 500 + p.ph) : 1, gr = r * (w.isNew ? 6 : 4) * pulse;
      cx.globalAlpha = (on2 ? (w.isNew ? 0.7 : 0.28) : 0.03) * d; cx.drawImage(sprites[tc(i)], p.x - gr, p.y - gr, gr * 2, gr * 2);
      cx.globalAlpha = (on2 ? 1 : 0.15) * d; cx.fillStyle = colour[tc(i)]; cx.beginPath(); cx.arc(p.x, p.y, r, 0, TAU); cx.fill();
      if (w.th.length > 1) { cx.strokeStyle = colour[w.th[1]]; cx.lineWidth = 1; cx.beginPath(); cx.arc(p.x, p.y, r + 1.8, 0, TAU); cx.stroke(); }
      if (w.isNew && on2) { cx.strokeStyle = fg; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(p.x, p.y, r + 4 * pulse, 0, TAU); cx.stroke(); }
    }
    cx.globalCompositeOperation = "source-over";
    // each theme's name floats over its region while that side faces you
    cx.font = "600 11px " + lbl; cx.textAlign = "center"; cx.letterSpacing = "1.5px";
    for (const [k, n] of THEMES) {
      const a = turn(norm(anchor[k])), [x, y] = proj(a.map((v) => v * 1.08)); if (a[2] > 0.15) continue;
      cx.globalAlpha = Math.min(1, (0.15 - a[2]) * 2) * ((hot && hot !== k) || (only.size && !only.has(k)) ? 0.25 : 0.9); cx.fillStyle = colour[k];
      cx.lineWidth = 4; cx.strokeStyle = bgc; cx.strokeText(n.toUpperCase(), x, y);
      cx.fillText(n.toUpperCase(), x, y);
    }
    if (foc != null) { const p = pts[foc]; cx.globalAlpha = p.z > 0.3 ? 0.4 : 1; cx.strokeStyle = fg; cx.lineWidth = 2; cx.beginPath(); cx.arc(p.x, p.y, 9, 0, TAU); cx.stroke(); }
    cx.globalAlpha = 1;
  }
  function card(i) {
    if (i == null) return; const w = items[i], href = link(w);
    $("lo-card").innerHTML = `<div class="dt">${esc(String(w.y))}${w.isNew ? `<span class="tag un">New</span>` : ""}${w.gk ? `<span class="tag">Goalkeeper study</span>` : ""}</div>` +
      `<h3>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(w.t)}</a>` : esc(w.t)}</h3>` +
      (w.n ? `<p>${esc(w.n)}</p>` : "") + `<div class="cite">${esc([w.a, w.j].filter(Boolean).join(" · "))}</div>` +
      `<div class="pills">${w.th.map((k) => `<span style="--c:var(${THEMES.find((x) => x[0] === k)[2]})"><i></i>${esc(TNAME[k])}</span>`).join("")}</div>`;
  }
  function step(dt) { if (still || hover != null || drag) return; t += dt; rotY += velY * dt / 16; velY += (0.00107 - velY) * 0.02; }
  function loop(now) { const dt = Math.min(50, now - (last || now)); if (now - last > 30 || !last) { last = now; step(dt); place(); draw(); } raf = requestAnimationFrame(loop); }
  const start = () => { if (!raf && on && !still && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } }, stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const redraw = () => { if (!raf && W) { place(); draw(); } };
  function pick(e) {
    const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    let best = null, gap = 10; pts.forEach((p, i) => { if (p.z > 0.3 || !lit(i)) return; const d = Math.hypot(p.x - x, p.y - y) - (items[i].isNew ? 3 : 0); if (d < gap) { gap = d; best = i; } });
    return best;
  }
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      drag.x = e.clientX; drag.y = e.clientY; rotY += dx * 0.006; velY = dx * 0.006; rotX = Math.max(-1.2, Math.min(1.2, rotX + dy * 0.006));
      box.classList.add("grabbing"); tip.hidden = true; redraw(); return;
    }
    const i = pick(e); cv.style.cursor = i == null ? "grab" : "pointer";
    if (i !== hover) { hover = i; card(i ?? sel); redraw(); }
    if (i == null) { tip.hidden = true; return; }
    const w = items[i]; tip.innerHTML = `<i style="background:${colour[tc(i)]}"></i>${esc(String(w.y))} · ${esc(w.by.length ? w.by.join(", ") : w.a || "")}`;
    tip.hidden = false; tip.style.left = Math.max(8, Math.min(W - tip.offsetWidth - 8, pts[i].x + 14)) + "px"; tip.style.top = pts[i].y - 40 + "px";
  });
  const release = (e) => {
    const d = drag; drag = null; box.classList.remove("grabbing"); if (!d || d.moved || e.type === "pointercancel") return;
    const i = pick(e); if (i != null) { sel = i; card(sel); redraw(); }
  };
  cv.addEventListener("pointerup", release); cv.addEventListener("pointercancel", release);
  cv.addEventListener("pointerleave", () => { if (drag) return; hover = null; tip.hidden = true; card(sel); redraw(); });
  cv.addEventListener("keydown", (e) => {
    const j = sel ?? items.length - 1, to = { ArrowLeft: j - 1, ArrowDown: j - 1, ArrowRight: j + 1, ArrowUp: j + 1, Home: 0, End: items.length - 1 }[e.key];
    if (to == null) return; e.preventDefault(); sel = Math.max(0, Math.min(items.length - 1, to)); card(sel); redraw();
  });
  // The rail's themes as light bars (Goldy, 2026-11-21, like the Oracles page): orb, name, count and a bar for its share of the works.
  // Point at a theme to light it on the globe; press it to show only its works on the globe and in the list below.
  const key = $("lo-key"), counts = THEMES.map(([k]) => items.filter((w) => w.th.includes(k)).length), most = Math.max(...counts);
  key.innerHTML = THEMES.map(([k, n, v], j) => `<li data-k="${k}" style="--c:var(${v}); --w:${(counts[j] / most * 100).toFixed(1)}%"><button type="button" aria-pressed="false"><span class="orb">${esc(n)}</span><span class="n">${counts[j]}</span><span class="tbar"><i></i></span></button></li>`).join("");
  function filtersChanged() {
    key.classList.toggle("picked", only.size > 0);
    if (!lit(sel)) { for (let i = items.length - 1; i >= 0; i--) if (lit(i)) { sel = i; break; } card(sel); }
    shown = PAGE; list(); redraw();
  }
  key.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const k = b.parentNode.dataset.k; only.has(k) ? only.delete(k) : only.add(k); b.setAttribute("aria-pressed", String(only.has(k)));
    filtersChanged();
  });
  key.addEventListener("pointerover", (e) => { const li = e.target.closest("li[data-k]"); hot = li ? li.dataset.k : null; key.querySelectorAll("li").forEach((x) => x.classList.toggle("hot", x.dataset.k === hot)); redraw(); });
  key.addEventListener("pointerleave", () => { hot = null; key.querySelectorAll("li").forEach((x) => x.classList.remove("hot")); redraw(); });
  // The search box and Clear filters are the page rail's own (#q, #reset on research.html; #lo-q, #lo-reset where the page has them)
  const qEl = $("lo-q") || $("q"), resetEl = $("lo-reset") || $("reset");
  if (qEl) qEl.addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase().split(/\s+/).filter(Boolean); filtersChanged(); });
  if (resetEl) resetEl.addEventListener("click", () => { only.clear(); q = []; if (qEl) qEl.value = ""; key.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); filtersChanged(); });

  // The works list under the globe, in its own panel like the Oracles page's study table
  const PAGE = 5; let shown = PAGE, order = "new";
  function list() {
    const out = $("lo-results"); if (!out) return;
    const rows = items.map((w, i) => i).filter(keepIt).sort((a, b) => order === "az" ? items[a].t.localeCompare(items[b].t) : order === "old" ? a - b : b - a);
    $("lo-count").textContent = rows.length ? `${Math.min(shown, rows.length) < rows.length ? `Showing ${Math.min(shown, rows.length)} of ` : ""}${rows.length}${rows.length === items.length ? "" : " matching"} ${rows.length === 1 ? "work" : "works"}` : "No matching works";
    out.innerHTML = rows.length ? rows.slice(0, shown).map((i) => {
      const w = items[i], href = link(w);
      return `<tr><td><h3 class="p-title">${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(w.t)}</a>` : esc(w.t)}</h3>` +
        `<div class="p-by">${esc([w.a, w.j].filter(Boolean).join(" · "))}</div><div class="p-line"><b>${esc(String(w.y))}</b>${w.isNew ? "<span>New</span>" : ""}${w.gk ? "<span>Goalkeeper study</span>" : ""}</div></td>` +
        `<td><div class="pills">${w.th.map((k) => `<span style="--c:var(${THEMES.find((x) => x[0] === k)[2]})"><i></i>${esc(TNAME[k])}</span>`).join("")}</div></td></tr>`;
    }).join("") : `<tr><td colspan="2" class="empty">No works match. Clear a theme or change the search.</td></tr>`;
    const left = rows.length - shown;
    $("lo-load").innerHTML = left > 0 ? `<button type="button" class="btn" id="lo-more">Load ${Math.min(PAGE, left)} more</button>` : "";
  }
  if ($("lo-load")) $("lo-load").addEventListener("click", (e) => { if (e.target.closest("#lo-more")) { shown += PAGE; list(); } });
  if ($("lo-sort")) $("lo-sort").addEventListener("change", (e) => { order = e.target.value; shown = PAGE; list(); });
  new ResizeObserver(() => { if (size()) { place(); draw(); } }).observe(box);
  new MutationObserver(() => { theme(); redraw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { theme(); redraw(); });
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { on = e.isIntersecting; on ? start() : stop(); }).observe(box); else { on = true; start(); }
  document.addEventListener("visibilitychange", () => { document.hidden ? stop() : start(); });
  theme(); if (size()) { place(); draw(); } card(sel); list();
})();
