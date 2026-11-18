/* GRJ homepage journey (Goldy, 2026-11-18): scroll (or press Play) to fly through the journal. Each node is a stop on the way:
   the Oracles, the nine research topics they track, then the Mission, Briefs, Peer Reviews and the Conference, ending at the doors.
   Each node has a glowing Oracle orb in its topic colour. The opening frame offers Skip to the end and Go to the Oracles. Study cards
   come from data.js (REC) and topic names from topics.js, so the journey always shows the newest goalie studies.
   The camera moves along one axis; cards sit at depths along it and fade in and out as it passes. Arrow keys and the rail
   jump between nodes; Space plays and pauses. Reduced motion turns off the easing and the starfield drift. */
(function () {
  const $ = (s) => document.querySelector(s);
  const world = $("#world"), tilt = $("#tilt");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const TOPICS = window.GRJ_TOPICS || [];
  const RECS = typeof REC !== "undefined" ? REC : [];
  const JADE = "var(--j-accent)";

  const ABOUT = {
    hip: "The butterfly asks more of the hip than almost any move in sport. This research looks at hip shape, range of motion and the wear that comes with the position.",
    inj: "Which injuries goalies get, how often, and what keeps them on the ice, from youth hockey to the NHL.",
    eq: "Pads, skates, nets and sizing: how equipment shapes the way goalies move and how well it protects them.",
    vis: "Where goalies look, when they pick up the puck, and how they read a shooter before the release.",
    phy: "The fitness behind the position: power, agility, recovery and how goalies train for them.",
    bio: "Stances, pushes and the butterfly, measured: how goalies move and what makes that movement efficient.",
    psy: "Confidence, stress, focus and motivation: the mental side of the most pressured position on the ice.",
    dev: "How goalies learn and how coaches teach them: pathways, practice design and coaching education.",
    stats: "Measuring goaltending: save percentage, expected goals and the models that try to separate the goalie from the team."
  };
  // Newest goalie studies per topic, each study shown once across the whole journey
  const used = new Set();
  const studies = (k) => RECS.filter((r) => (r.tp || []).includes(k) && r.sc === "goaltending" && !used.has(r.i))
    .sort((a, b) => b.y - a.y || b.i - a.i).slice(0, 2).map((r) => { used.add(r.i); return r; });
  const href = (r) => r.doi ? "https://doi.org/" + r.doi : r.pmid ? "https://pubmed.ncbi.nlm.nih.gov/" + r.pmid + "/" : r.link || "research.html";

  const NODES = [
    { id: "start", nav: "GRJ", hero: 1, kick: "An open journal", name: "The Goaltending Research Journal", c: JADE, orb: "all",
      summary: "Bridging the gap between ice hockey goaltending research and the people who coach and play the position." },
    { id: "oracles", nav: "Oracles", kick: "Where the research lives", name: "The Oracles", c: JADE, orb: "armillary",
      summary: "Every study we track lives in the Oracles: turning globes of research you can explore by topic, by researcher and by year.",
      cards: [
        ["Master Oracle", "Every study and researcher in one globe, one ribbon of light per study.", "research.html#master"],
        ["Researcher Oracle", "The people behind the research and who they work with.", "research.html#researchers"],
        ["Evidence Oracle", "Verified, evidence-based goaltending studies, oldest at the centre.", "research.html#evidence"],
        ["Scholarly Oracle", "Wider scholarly work still waiting to be verified.", "research.html#scholarly"]
      ] },
    { id: "topics", nav: "9 topics", kick: "What the Oracles track", name: "Nine research topics", c: JADE,
      summary: "Every study carries one or more of nine topics, each with its own colour across the journal. Fly through them one by one." }
  ].concat(TOPICS.map(([k, n]) => ({ id: k, nav: n.split(" ")[0].replace(/&$/, ""), kick: "Research topic", name: n, c: `var(--t-${k})`, orb: "topic",
      summary: ABOUT[k] || "", studies: studies(k) })))
  .concat([
    { id: "mission", nav: "Mission", kick: "Why we exist", name: "Our Mission", c: JADE, orb: "jade",
      summary: "The GRJ is an open-sourced sports journal dedicated to bridging the gap between ice hockey goaltending research and the general public.",
      cards: [
        ["The Vision", "To build a professional sports journal that is dedicated to supporting the researchers and the goalie coaching community at large."],
        ["The Promise", "To provide a free and accurate resource that continually refines its knowledge base in order to support learning, sharing, and creativity in the goaltending community."]
      ] },
    { id: "briefs", nav: "Briefs", kick: "Research, translated", name: "Briefs", c: JADE, orb: "jade",
      summary: "Coaching breakdowns of goalie studies from the Oracles: what the study did, what it found, and what to try on the ice.",
      go: ["Read the Briefs", "briefs.html"] },
    { id: "reviews", nav: "Peer Reviews", kick: "Read it together", name: "Peer Reviews", c: JADE, orb: "jade",
      summary: "Monthly video sessions where goalie coaches read one study together and turn it into practice ideas, led by peer reviewers from 15 countries.",
      go: ["See the sessions", "reviews.html"] },
    { id: "conference", nav: "Conference", kick: "Open to everyone", name: "Virtual Conference", c: JADE, orb: "jade",
      summary: "An online conference on goaltending research, open to the public, with a full lineup of speakers and breakout groups.",
      go: ["Visit the Conference", "conference.html"] },
    { id: "enter", nav: "Enter", kick: "Your turn", name: "Step into the journal", c: JADE, end: 1,
      summary: "Pick a door.",
      doors: [["Oracles", "research.html"], ["Briefs", "briefs.html"], ["Coaching", "coaching.html"], ["Reviews", "reviews.html"], ["Conference", "conference.html"], ["NHL DataViz", "goalies.html"], ["About", "about.html"]] }
  ]);

  /* ---------- build ---------- */
  const items = []; let depth = 0;
  const SIDE_Y = [-0.14, 0.1, -0.04, 0.16, -0.1, 0.06];
  function add(html, cls, o) {
    const el = document.createElement("div");
    el.className = "it " + cls; el.innerHTML = html;
    if (o.c) el.style.setProperty("--c", o.c);
    world.appendChild(el);
    const it = Object.assign({ el, d: depth, sx: 0, sy: 0, ry: 0, fo: 10, out: 220, far: 3000, max: 1, vis: false, op: -1 }, o);
    items.push(it); return it;
  }
  NODES.forEach((e) => {
    let k = 0; const side = () => (++k % 2 ? -1 : 1);
    e.d = depth;
    add(`<div class="kick">${esc(e.kick)}</div><h2>${esc(e.name)}</h2><p>${esc(e.summary)}</p><div class="bar"></div>` +
      (e.hero ? `<div class="skipper"><span>Been here before?</span><button type="button" data-skip="end">Skip to the end</button><a href="research.html">Go to the Oracles</a></div><div class="hint">Or scroll to explore<i></i></div>` : "") +
      (e.doors ? `<nav class="doors" aria-label="Sections">${e.doors.map(([l, u]) => `<a href="${u}">${esc(l)}</a>`).join("")}</nav>` : ""),
      "title" + (e.hero ? " hero" : "") + (e.end ? " end" : ""), { c: e.c, fo: e.end ? 9e9 : -40, out: e.end ? 9e9 : 250, far: e.hero ? 9e9 : 1900 });
    if (e.orb) {
      const n = NODES.indexOf(e), it = add(`<canvas class="oc" aria-hidden="true"></canvas>`, "orb", { c: e.c, d: depth + (e.hero ? 1100 : 1500), sx: e.hero ? 0.62 : n % 2 ? 0.78 : -0.78, sy: e.hero ? -0.02 : -0.2, size: 1, fo: 500, out: 1200, far: 3600, max: 1 });
      it.orb = { kind: e.orb, seed: n * 1.7, cv: it.el.firstChild };
    }
    depth += e.hero ? 900 : 760;
    const beats = [];
    (e.studies || []).forEach((r) => beats.push(["study", r]));
    (e.cards || []).forEach((c) => beats.push(["card", c]));
    if (e.go) beats.push(["go", e.go]);
    beats.forEach(([t, v], n) => {
      const s = side(), sy = SIDE_Y[n % 6];
      if (t === "study") {
        add(`<a class="card ev" href="${esc(href(v))}" target="_blank" rel="noopener noreferrer"><div class="tag">${esc(e.name)}<span class="n">${esc(v.yl)}</span></div><h3>${esc(v.t)}</h3><p>${esc(v.a)}${v.j ? " · " + esc(v.j.split(/[0-9(]/)[0].trim()) : ""}</p><span class="more">Read the study ↗</span></a>`, "", { c: e.c, sx: s * 0.25, sy, ry: -s * 14 });
      } else if (t === "card") {
        const [h, p, u] = v;
        add(`${u ? `<a class="card ev" href="${u}">` : `<article class="card ev">`}<div class="tag">${esc(e.name)}</div><h3>${esc(h)}</h3><p>${esc(p)}</p>${u ? `<span class="more">Open →</span></a>` : `</article>`}`, "", { c: e.c, sx: s * 0.25, sy, ry: -s * 14 });
      } else {
        add(`<a class="card go" href="${v[1]}"><span>${esc(v[0])}</span><b>→</b></a>`, "", { c: e.c, sx: s * 0.2, sy: sy * 0.6, ry: -s * 10 });
      }
      depth += 430;
    });
    depth += e.end ? 0 : 1050;
  });
  const TOTAL = depth;

  /* ---------- rail ---------- */
  const railOl = $("#rail ol");
  NODES.forEach((e, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" style="--c:${e.c}">${esc(e.nav)}</button>`;
    li.firstChild.onclick = () => go(i); railOl.appendChild(li); e.btn = li.firstChild;
  });

  /* ---------- camera ---------- */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = innerWidth, H = innerHeight, cam = 0, cur = -1, mx = 0, my = 0, tx = 0, ty = 0;
  function layout() {
    W = innerWidth; H = innerHeight; const narrow = W < 760;
    $("#spacer").style.height = TOTAL + H + "px";
    for (const it of items) {
      const x = it.sx * W * (it.size ? (narrow ? 0.75 : 1) : narrow ? 0.16 : 1), y = it.sy * H * (it.size ? (narrow ? 1.25 : 1) : narrow ? 0.5 : 1), ry = it.ry * (narrow ? 0.35 : 1);
      if (it.size) it.el.style.setProperty("--s", Math.round(Math.min(W, H) * (narrow ? 0.8 : 1.0)) + "px");
      it.el.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${-it.d}px) rotateY(${ry}deg)${it.rx ? ` rotateX(${it.rx}deg)` : ""}`;
    }
    sizeSky();
  }
  const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  function go(i) { const y = Math.max(0, NODES[i].d); if (playing) { autoY = y; scrollTo(0, y); } else scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" }); }
  const BASE = 110, SPEEDS = [1, 1.5, 2]; let playing = false, autoY = 0, spdI = 0, lastT = 0;
  const playB = $("#play"), spdB = $("#spd");
  function setPlay(on) {
    if (on && scrollY >= TOTAL - 2) scrollTo(0, 0);
    playing = on; autoY = scrollY; lastT = 0;
    playB.setAttribute("aria-pressed", on); playB.textContent = on ? "❚❚ Pause" : "▶ Play"; spdB.hidden = !on;
  }
  playB.onclick = () => setPlay(!playing);
  spdB.onclick = () => { spdI = (spdI + 1) % SPEEDS.length; spdB.textContent = SPEEDS[spdI] + "×"; };
  function frame(now) {
    if (playing) {
      const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0; lastT = now;
      autoY += BASE * SPEEDS[spdI] * dt;
      if (autoY >= TOTAL) { autoY = TOTAL; scrollTo(0, autoY); setPlay(false); } else scrollTo(0, autoY);
    }
    const target = scrollY, prev = cam;
    cam = reduce ? target : cam + (target - cam) * 0.085;
    if (Math.abs(target - cam) < 0.05) cam = target;
    const vel = cam - prev;
    tx += (mx - tx) * 0.05; ty += (my - ty) * 0.05;
    world.style.transform = `translateZ(${cam.toFixed(1)}px)`;
    tilt.style.transform = `rotateY(${(tx * 4.4).toFixed(3)}deg) rotateX(${(-ty * 3.2).toFixed(3)}deg)`;
    for (const it of items) {
      const rel = cam - it.d, on = rel > -it.far && rel < it.out;
      if (on !== it.vis) { it.vis = on; it.el.style.visibility = on ? "visible" : "hidden"; }
      if (!on) continue;
      let o = Math.min(sm((rel + it.far) / 900), 1 - sm((rel - it.fo) / (it.out - it.fo)));
      o *= 0.22 + 0.78 * sm((rel + 2500) / 1700); o *= it.max;
      if (Math.abs(o - it.op) > 0.012) { it.op = o; it.el.style.opacity = o.toFixed(3); }
      const live = rel > -900 && rel < it.out - 100 && o > 0.5;
      if (live !== it.live) { it.live = live; it.el.classList.toggle("live", live); }
    }
    for (const it of items) if (it.orb && it.vis && it.op > 0.02) drawOrb(it, now);
    let c = 0; for (let i = 0; i < NODES.length; i++) if (cam >= NODES[i].d - 700) c = i;
    if (c !== cur) {
      cur = c; const e = NODES[c];
      document.documentElement.style.setProperty("--accent", e.c);
      $("#nowKick").textContent = e.kick; $("#nowName").textContent = e.name;
      NODES.forEach((x, i) => x.btn.setAttribute("aria-current", i === c));
      e.btn.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
      try { history.replaceState(null, "", c ? "#" + e.id : location.pathname); } catch (_) {}
    }
    $("#prog i").style.width = (Math.min(1, cam / TOTAL) * 100).toFixed(2) + "%";
    drawSky(vel);
    requestAnimationFrame(frame);
  }


  /* ---------- Oracle orbs ----------
     Each stop's orb is a small Oracle: a turning sphere of points of light in the stop's colour, threaded by three tilted
     orbits with beads riding them and a soft bloom at the core. The opening orb carries all nine topic colours; the Oracles
     stop is an armillary of four rings, one per Oracle. Drawn on a canvas inside the orb, only while the orb is on screen. */
  const hex = (c) => { c = c.trim(); if (c.startsWith("#")) { c = c.slice(1); if (c.length === 3) c = [...c].map((x) => x + x).join(""); return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)); } const m = c.match(/\d+/g); return m ? m.slice(0, 3).map(Number) : [164, 199, 193]; };
  const TOPIC_RGB = () => TOPICS.map(([k]) => hex(getComputedStyle(document.body).getPropertyValue("--t-" + k)));
  const FIB = (() => { const n = 360, out = []; for (let i = 0; i < n; i++) { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = i * 2.39996; out.push([Math.cos(th) * r, y, Math.sin(th) * r, (i * 7919) % 97 / 97]); } return out; })();
  const ORB_PX = 520;
  function drawOrb(it, now) {
    const o = it.orb, cv = o.cv;
    if (!o.ctx) { cv.width = cv.height = ORB_PX; o.ctx = cv.getContext("2d"); o.rgb = hex(getComputedStyle(it.el).getPropertyValue("--c")); o.all = TOPIC_RGB(); }
    const g = o.ctx, S = ORB_PX, C = S / 2, R = S * 0.3, t = reduce ? o.seed * 900 : now + o.seed * 900;
    const rot = t * 0.00016, tiltX = 0.42, cX = Math.cos(tiltX), sX = Math.sin(tiltX);
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
    const P = (x, y, z, ry) => { const c = Math.cos(ry), s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c]; [y, z] = [y * cX - z * sX, y * sX + z * cX]; const f = 2.8 / (2.8 + z); return [C + x * R * f, C - y * R * f, z, f]; };
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    const base = o.rgb;
    // bloom
    let gr = g.createRadialGradient(C, C, 0, C, C, R * 1.65);
    gr.addColorStop(0, rgba(base, 0.34)); gr.addColorStop(0.35, rgba(base, 0.12)); gr.addColorStop(1, rgba(base, 0));
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = "lighter";
    // glass body
    gr = g.createRadialGradient(C - R * 0.35, C - R * 0.4, R * 0.05, C, C, R * 1.02);
    gr.addColorStop(0, rgba([255, 255, 255], 0.10)); gr.addColorStop(0.5, rgba(base, 0.06)); gr.addColorStop(1, rgba(base, 0.02));
    g.fillStyle = gr; g.beginPath(); g.arc(C, C, R, 0, 6.283); g.fill();
    // orbits (armillary: four rings, one per Oracle; otherwise three)
    const rings = o.kind === "armillary" ? [[0.2, 0], [1.1, 0.8], [1.9, 1.6], [0.75, 2.4]] : [[0.35, 0.3], [1.25, 1.4], [2.2, 2.5]];
    rings.forEach(([tilt, head], ri) => {
      const rr = o.kind === "armillary" ? 1.08 + ri * 0.07 : 1.18 + ri * 0.06, spin = rot * (ri % 2 ? -1.4 : 1.1) + head;
      const ct = Math.cos(tilt), st = Math.sin(tilt), ch = Math.cos(head), sh = Math.sin(head);
      const pt = (u) => { let x = Math.cos(u) * rr, z = Math.sin(u) * rr, y = 0; [y, z] = [-z * st, z * ct]; [x, z] = [x * ch - z * sh, x * sh + z * ch]; return P(x, y, z, rot * 0.6); };
      const col = o.kind === "all" ? o.all[(ri * 3) % o.all.length] : base;
      let p = pt(0);
      for (let k = 1; k <= 96; k++) { const q = pt((k / 96) * 6.283); const d = 0.5 - (p[2] + q[2]) / 4; g.strokeStyle = rgba(col, (o.kind === "armillary" ? 0.5 : 0.28) * d + 0.04); g.lineWidth = 1.4 * ((p[3] + q[3]) / 2); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); p = q; }
      for (let b = 0; b < (o.kind === "armillary" ? 1 : 2); b++) { // beads riding the orbit, with a short tail
        for (let tl = 6; tl >= 0; tl--) { const q = pt(spin + b * 3.1 - tl * 0.05); const a = (1 - tl / 7) * (0.55 - q[2] * 0.4); g.fillStyle = rgba(col, a); g.beginPath(); g.arc(q[0], q[1], (tl ? 2.2 : 4.2) * q[3], 0, 6.283); g.fill(); }
      }
    });
    // points of light on the sphere
    if (o.kind !== "armillary") {
      for (let i = 0; i < FIB.length; i++) {
        const [x, y, z, w] = FIB[i], q = P(x, y, z, rot), d = 0.5 - q[2] / 2, tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * 0.002 + i);
        const col = o.kind === "all" ? o.all[i % o.all.length] : base;
        const a = (0.1 + 0.8 * d) * tw * (0.5 + 0.5 * w), r = (0.7 + 1.5 * w) * q[3] * (0.6 + 0.6 * d);
        g.fillStyle = rgba(col, a); g.beginPath(); g.arc(q[0], q[1], r, 0, 6.283); g.fill();
        if (w > 0.93 && d > 0.55) { g.fillStyle = rgba(col, 0.18 * tw); g.beginPath(); g.arc(q[0], q[1], r * 5, 0, 6.283); g.fill(); }
      }
    } else { // armillary core: a bright seed
      gr = g.createRadialGradient(C, C, 0, C, C, R * 0.35); gr.addColorStop(0, rgba([233, 240, 238], 0.9)); gr.addColorStop(0.3, rgba(base, 0.5)); gr.addColorStop(1, rgba(base, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(C, C, R * 0.35, 0, 6.283); g.fill();
    }
    // rim light
    g.globalCompositeOperation = "source-over";
    g.strokeStyle = rgba(base, 0.22); g.lineWidth = 1.2; g.beginPath(); g.arc(C, C, R * 1.0, 0, 6.283); g.stroke();
  }

  /* ---------- ice-crystal starfield ---------- */
  const sky = $("#skyfield"), g = sky.getContext("2d"); let stars = [], dpr = 1;
  function sizeSky() {
    dpr = Math.min(2, devicePixelRatio || 1); sky.width = W * dpr; sky.height = H * dpr;
    const n = Math.round(Math.min(900, (W * H) / 1700));
    stars = Array.from({ length: n }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), s: Math.random() }));
  }
  function drawSky(vel) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const cx = W / 2 + tx * 36, cy = H / 2 + ty * 28, sp = vel * 0.00016 + (reduce ? 0 : 0.0001), R = Math.max(W, H) * 0.9;
    g.lineCap = "round";
    for (const s of stars) {
      const pz = s.z; s.z -= sp;
      if (s.z <= 0.02) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; continue; }
      if (s.z > 1) { s.z = 0.03; continue; }
      const x = cx + (s.x / s.z) * R * 0.5, y = cy + (s.y / s.z) * R * 0.5;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      const a = Math.min(1, (1 - s.z) * 1.4) * (0.3 + 0.6 * s.s), r = (1 - s.z) * 1.5 + 0.3;
      const px = cx + (s.x / pz) * R * 0.5, py = cy + (s.y / pz) * R * 0.5, len = Math.hypot(x - px, y - py);
      g.strokeStyle = g.fillStyle = `rgba(${200 + 30 * s.s | 0},235,228,${a.toFixed(3)})`;
      if (len > 1.5) { g.lineWidth = r; g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); }
      else { g.beginPath(); g.arc(x, y, r * 0.6, 0, 6.283); g.fill(); }
    }
  }

  /* ---------- input ---------- */
  addEventListener("click", (e) => {
    const b = e.target.closest("[data-skip]"); if (!b) return;
    if (playing) setPlay(false);
    const y = NODES[NODES.length - 1].d; scrollTo(0, y); cam = y - 600;
  });
  addEventListener("resize", layout);
  addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; mx = (e.clientX / W) * 2 - 1; my = (e.clientY / H) * 2 - 1; }, { passive: true });
  addEventListener("wheel", () => { if (playing) setPlay(false); }, { passive: true });
  addEventListener("touchmove", () => { if (playing) setPlay(false); }, { passive: true });
  addEventListener("keydown", (e) => {
    if (e.target.closest("button,a,input")) return;
    if (e.key === " ") { e.preventDefault(); setPlay(!playing); return; }
    if (playing && ["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) setPlay(false);
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(Math.min(NODES.length - 1, cur + 1)); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(Math.max(0, cur - 1)); }
  });
  function fromHash() { const i = NODES.findIndex((e) => "#" + e.id === location.hash); if (i > 0) { scrollTo(0, NODES[i].d); cam = NODES[i].d - 600; } }
  addEventListener("hashchange", () => { const i = NODES.findIndex((e) => "#" + e.id === location.hash); if (i >= 0 && i !== cur) go(i); });
  layout(); fromHash(); requestAnimationFrame(frame);
})();
