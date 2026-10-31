/* The Constellation on the home page: every goalie researcher (researchers-data.js) is a point of light in the colour
   of their main topic, set on a slowly turning globe and linked to the people they published with; drag to spin it.
   Hover a light for the name, or a legend entry to light that topic. Below, "Since 1979" sets every study (data.js)
   as a dot by year in its first topic's colour. Colours come from the --t-* tokens in index.html.
   About 30 frames a second; reduced motion draws one still frame; drawing stops while the hero is off screen. */
(function () {
  const TOPICS = [
    ["hip", "Hip & groin"], ["inj", "Injury & safety"], ["eq", "Equipment"],
    ["vis", "Vision & anticipation"], ["phy", "Physiology & training"],
    ["bio", "Movement & biomechanics"], ["psy", "Psychology & cognition"],
    ["dev", "Development & coaching"], ["stats", "Performance analytics"]
  ];
  const name = Object.fromEntries(TOPICS), key = Object.fromEntries(TOPICS.map(([k, n]) => [n, k]));
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let colour = {}, dark = false;
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    colour = Object.fromEntries(TOPICS.map(([k]) => [k, cs.getPropertyValue("--t-" + k).trim()]));
    dark = cs.colorScheme === "dark";
  }
  readTheme();
  if (typeof REC !== "undefined") { const n = document.getElementById("door-n"); if (n) n.textContent = `${REC.length} studies`; }

  // The sky
  const box = document.getElementById("sky"), cv = document.getElementById("sky-art"), tip = document.getElementById("sky-tip"), legend = document.getElementById("legend");
  if (box && cv && typeof NETWORK !== "undefined") {
    const cx = cv.getContext("2d");
    const people = NETWORK.people.map((p, i) => ({ id: p.id, name: p.name, n: p.n, k: key[(p.tp || [])[0]] || "hip", ph: (i * 2.399) % 6.28 }));
    const at = Object.fromEntries(people.map((p, i) => [p.id, i]));
    const links = NETWORK.links.map(([a, b]) => [at[a], at[b]]).filter(([a, b]) => a !== undefined && b !== undefined);
    legend.innerHTML = TOPICS.map(([k, n]) => `<li data-k="${k}" style="--c: var(--t-${k})"><i></i>${n}</li>`).join("");
    let W = 0, H = 0, R = 0, pointer = null, hot = null, raf = 0, last = 0, now = 0;
    // Each researcher sits on a globe (an even Fibonacci spread) that turns slowly; drag to spin it
    people.forEach((p, i) => { const n = people.length, y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963; p.s = [Math.cos(a) * r, y, Math.sin(a) * r]; });
    let rotY = 0, rotX = -0.25, velY = 0.0022, drag = null;
    function size() {
      const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height; R = Math.min(W, H * 0.9) * 0.42; cv.width = Math.round(W * d); cv.height = Math.round(H * d); cx.setTransform(d, 0, 0, d, 0, 0);
      place();
    }
    function place() {
      const cy = Math.cos(rotY), sy = Math.sin(rotY), cxr = Math.cos(rotX), sxr = Math.sin(rotX);
      for (const p of people) {
        let [x, y, z] = p.s; [x, z] = [x * cy - z * sy, x * sy + z * cy]; [y, z] = [y * cxr - z * sxr, y * sxr + z * cxr];
        const f = 2.6 / (2.6 + z); p.x = W / 2 + x * R * f; p.y = H * 0.46 + y * R * f; p.z = z;
      }
    }
    // Points on the far side (z > 0) fade back; only the near side answers the pointer
    const near = (p) => pointer && p.z < 0.3 && Math.hypot(p.x - pointer[0], p.y - pointer[1]) < 110;
    function draw(t) {
      now = t; cx.clearRect(0, 0, W, H);
      cx.globalCompositeOperation = dark ? "lighter" : "source-over";
      for (const [a, b] of links) {
        const p = people[a], q = people[b], lit = near(p) || near(q) || (hot && (p.k === hot || q.k === hot)), dim = hot && p.k !== hot && q.k !== hot;
        const depth = Math.max(0.12, (1 - (p.z + q.z) / 2) / 2), mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        const g = cx.createLinearGradient(p.x, p.y, q.x, q.y); g.addColorStop(0, colour[p.k]); g.addColorStop(1, colour[q.k]);
        cx.strokeStyle = g; cx.globalAlpha = (dim ? 0.06 : lit ? 0.9 : 0.32) * depth; cx.lineWidth = lit ? 1.6 : 1;
        cx.beginPath(); cx.moveTo(p.x, p.y); cx.quadraticCurveTo(mx + (mx - W / 2) * 0.18, my + (my - H * 0.46) * 0.18, q.x, q.y); cx.stroke();
      }
      for (const p of people.slice().sort((a, b) => b.z - a.z)) {
        const c = colour[p.k], dim = hot && p.k !== hot, lit = near(p) || hot === p.k, depth = 0.25 + 0.75 * (1 - p.z) / 2;
        const r = (1.8 + Math.sqrt(p.n) * 1.6) * (1.25 - p.z * 0.35) * (1 + 0.15 * Math.sin(t / 900 + p.ph));
        const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4.5); g.addColorStop(0, c); g.addColorStop(1, c + "00");
        cx.globalAlpha = (dim ? 0.05 : lit ? 0.55 : 0.3) * depth; cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, r * 4.5, 0, 6.3); cx.fill();
        cx.globalAlpha = (dim ? 0.25 : 1) * depth; cx.fillStyle = c; cx.beginPath(); cx.arc(p.x, p.y, r, 0, 6.3); cx.fill();
      }
      cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
    }
    function step() { if (!drag) { rotY += velY; velY += (0.0022 - velY) * 0.02; } place(); }
    cv.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); box.classList.add("grabbing"); });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; drag = [e.clientX, e.clientY];
      rotY += dx * 0.006; velY = dx * 0.006; rotX = Math.max(-1.2, Math.min(1.2, rotX + dy * 0.006)); place(); if (still) draw(now);
    });
    const release = () => { drag = null; box.classList.remove("grabbing"); };
    cv.addEventListener("pointerup", release); cv.addEventListener("pointercancel", release);
    function loop(t) { if (t - last > 30) { last = t; step(); draw(t); } raf = requestAnimationFrame(loop); }
    const start = () => { if (!raf && !still) raf = requestAnimationFrame(loop); }, stop = () => { cancelAnimationFrame(raf); raf = 0; };
    function setHot(k) {
      hot = k; legend.classList.toggle("dim", !!k);
      legend.querySelectorAll("li").forEach((li) => li.classList.toggle("hot", li.dataset.k === k));
      if (still) draw(now);
    }
    box.addEventListener("pointermove", (e) => {
      const r = cv.getBoundingClientRect(); pointer = [e.clientX - r.left, e.clientY - r.top];
      let best = null, gap = 16; for (const p of people) { const d = Math.hypot(p.x - pointer[0], p.y - pointer[1]); if (d < gap && p.z < 0.3) { gap = d; best = p; } }
      if (best) {
        tip.innerHTML = `<i style="background:${colour[best.k]}"></i>${best.name} · ${best.n} ${best.n === 1 ? "study" : "studies"}`;
        tip.style.left = Math.max(8, Math.min(W - tip.offsetWidth - 8, best.x + 14)) + "px"; tip.style.top = best.y - 38 + "px"; tip.style.opacity = 1;
      } else tip.style.opacity = 0;
      if (still) draw(now);
    });
    box.addEventListener("pointerleave", () => { pointer = null; tip.style.opacity = 0; if (still) draw(now); });
    legend.addEventListener("pointerover", (e) => { const li = e.target.closest("li"); if (li) setHot(li.dataset.k); });
    legend.addEventListener("pointerleave", () => setHot(null));
    size(); draw(0);
    new ResizeObserver(() => { size(); draw(now); }).observe(cv);
    new MutationObserver(() => { readTheme(); draw(now); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTheme(); draw(now); });
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { e.isIntersecting && !document.hidden ? start() : stop(); }).observe(box);
    document.addEventListener("visibilitychange", () => { document.hidden ? stop() : start(); });
    start();
  }

  // Since 1979: every study as a dot by year, stacked, in its first topic's colour
  const svg = document.getElementById("since");
  if (svg && typeof REC !== "undefined") {
    const rows = REC.filter((r) => r.y).sort((a, b) => a.y - b.y), y0 = rows[0].y, y1 = Math.max(new Date().getFullYear(), rows[rows.length - 1].y);
    const X = (y) => 20 + (y - y0) / (y1 - y0) * 960, per = {}, esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    let s = `<line x1="20" y1="150" x2="980" y2="150" stroke="var(--rule)" stroke-width="2"/>`;
    for (let y = Math.ceil(y0 / 5) * 5; y <= y1; y += 5) s += `<text x="${X(y)}" y="172" text-anchor="middle">${y}</text>`;
    rows.forEach((r, i) => { per[r.y] = (per[r.y] || 0) + 1; const k = (r.tp || [])[0] || "stats";
      s += `<circle cx="${X(r.y)}" cy="${150 - per[r.y] * 11}" r="4.4" fill="var(--t-${k})" style="transition-delay:${i * 12}ms"><title>${r.y} · ${esc(r.t)}</title></circle>`; });
    svg.innerHTML = s;
    if (!still && "IntersectionObserver" in window) {
      svg.classList.add("wait");
      new IntersectionObserver(([e], o) => { if (e.isIntersecting) { svg.classList.remove("wait"); o.disconnect(); } }, { threshold: 0.4 }).observe(svg);
    }
  }
})();
