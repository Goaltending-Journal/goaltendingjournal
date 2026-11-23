/* GRJ homepage journey (Goldy, 2026-11-18): scroll (or press Play) to fly through the journal. Each node is a stop on the way:
   the Mission, the Features (Briefs, Peer Reviews, Conferences), the Oracles, the nine research topics, then NHL DataViz, ending at
   the doors. Oracle, Feature and NHL cards each carry a live mini visual.
   Each node has a glowing Oracle orb in its topic colour. The opening frame offers Skip to end and View the Oracles. Study cards
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
    hip: "The butterfly is one of the most demanding movements in sports, and longevity is crucial to the position. This topic is one of the most important research areas in ice hockey goaltending.",
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
    { id: "start", nav: "GRJ", hero: 1, kick: "Welcome to", name: "The Goaltending Research Journal", c: JADE, orb: "all",
      summary: "An open-source research journal dedicated to ice hockey goaltending." },
    { id: "mission", nav: "Mission", kick: "Why we exist", name: "Our Mission", c: JADE, orb: "jade",
      summary: "The GRJ is dedicated to making evidence-based goaltending research more accessible to the wider hockey community. Through our platform, we aim to bridge the gap between the research and the rink through coaching conversation and peer reviews." },
    { id: "features", nav: "Features", step: 640, kick: "For coaches and programs", name: "Features", c: JADE, orb: "jade",
      summary: "The GRJ includes a few features that focus on supporting goalie coaches and programs. These include Briefs, Peer Reviews, and Conferences.",
      cards: [
        ["Briefs", "Coaching breakdowns of goalie studies from the Oracles: what the study did, what it found, and how to use it.", "briefs.html", "briefs"],
        ["Peer Reviews", "Monthly video sessions where peers read a new study together and turn it into practice ideas.", "reviews.html", "reviews"],
        ["Conferences", "An online conference on goaltending research, open to the public, with speakers and breakout groups.", "conference.html", "conference"]
      ] },
    { id: "research", nav: "Research", kick: "What we study", name: "Research", c: JADE, orb: "all",
      summary: "Our living research Oracles follow nine essential categories in ice hockey goaltending." },
    { id: "oracles", nav: "Oracles", step: 640, kick: "Where the research lives", name: "The Oracles", c: JADE, orb: "armillary",
      summary: "Every evidence-based research study on goaltending, easily accessible via our interactive learning visualizers.",
      cards: [
        ["Master Oracle", "Every study and researcher in one globe, one ribbon of light per study.", "research.html#master", "master"],
        ["Researcher Oracle", "The people behind the research and who they work with.", "research.html#researchers", "people"],
        ["Evidence Oracle", "Verified, evidence-based goaltending studies in a sunflower, oldest at the centre.", "research.html#evidence", "sunflower"],
        ["Coaching Oracle", "Evidence-based research on ecological dynamics, skill acquisition and practice design, one region per theme.", "research.html#coaching", "coach"]
      ] },
    { id: "topics", nav: "Topics", kick: "What the Oracles track", name: "Research Topics", c: JADE,
      summary: "Every study falls within one of our main research topics, each with its own color across the GRJ. Fly through them to learn more." }
  ].concat(TOPICS.map(([k, n]) => ({ id: k, nav: n.split(" ")[0].replace(/&$/, ""), kick: "Research topic", name: n.replace(/\b[a-z]/g, (m) => m.toUpperCase()), c: `var(--t-${k})`, orb: "topic",
      summary: ABOUT[k] || "", studies: studies(k) })))
  .concat([
    { id: "nhl", nav: "NHL", kick: "The data, daily", name: "NHL DataViz", c: JADE, orb: "armillary",
      summary: "Every NHL goalie, updated every day with data from the NHL and Natural Stat Trick: the NHL Goaltending Oracle, goalie archetypes and more.",
      cards: [
        ["NHL Goaltending Oracle", "Every NHL goalie this season on five rings, from the top band of goals saved above average to the bottom.", "goalies.html", "nhl"]
      ] },
    { id: "enter", nav: "Enter", kick: "Your turn", name: "Step Inside the GRJ", c: JADE, end: 1,
      summary: "Pick a section.",
      doors: [["Oracles", "research.html"], ["Briefs", "briefs.html"], ["Reviews", "reviews.html"], ["Conference", "conference.html"], ["NHL DataViz", "goalies.html"], ["About", "about.html"]] }
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
      (e.hero ? `<div class="skipper"><span>Been here before?</span><button type="button" data-skip="end">Skip to end</button><a href="research.html">View the Oracles</a></div><div class="hint">Or scroll to explore<i></i></div>` : "") +
      (e.doors ? `<nav class="doors" aria-label="Sections">${e.doors.map(([l, u]) => `<a href="${u}">${esc(l)}</a>`).join("")}</nav>` : ""),
      "title" + (e.hero ? " hero" : "") + (e.end ? " end" : ""), { c: e.c, fo: e.end ? 9e9 : -40, out: e.end ? 9e9 : 250, far: e.hero ? 9e9 : 1900 });
    if (e.orb) {
      const n = NODES.indexOf(e), it = add(`<canvas class="oc" aria-hidden="true"></canvas>`, "orb", { c: e.c, d: depth + (e.hero ? 1100 : 1500), sx: e.hero ? 0.62 : n % 2 ? 0.78 : -0.78, sy: e.hero ? -0.02 : -0.2, size: 1, fo: 500, out: 1200, far: 3600, max: 1 });
      it.orb = { kind: e.orb, seed: n * 1.7, cv: it.el.firstChild };
    }
    depth += e.hero ? 900 : 760;
    const beats = [], gate = e.d + 200;   // cards wait for this node's title to fade (Goldy, 2026-11-18)
    (e.studies || []).forEach((r) => beats.push(["study", r]));
    (e.cards || []).forEach((c) => beats.push(["card", c]));
    if (e.go) beats.push(["go", e.go]);
    beats.forEach(([t, v], n) => {
      const s = side(), sy = SIDE_Y[n % 6];
      if (t === "study") {
        add(`<a class="card ev" href="${esc(href(v))}" target="_blank" rel="noopener noreferrer"><div class="tag">${esc(e.name)}<span class="n">${esc(v.yl)}</span></div><h3>${esc(v.t)}</h3><p>${esc(v.a)}${v.j ? " · " + esc(v.j.split(/[0-9(]/)[0].trim()) : ""}</p><span class="more">Read the study ↗</span></a>`, "", { c: e.c, sx: s * 0.28, sy, ry: -s * 14, gate });
      } else if (t === "card") {
        const [h, p, u, mini] = v;
        const it = add(`${u ? `<a class="card ev${mini ? " oracle" : ""}" href="${u}">` : `<article class="card ev">`}${mini ? `<canvas class="mini" aria-hidden="true"></canvas>` : ""}<div class="tx"><div class="tag">${esc(mini && e.id !== "oracles" ? h === "NHL Goaltending Oracle" ? "Visualizer" : "Feature" : e.name)}</div><h3>${esc(h)}</h3><p>${esc(p)}</p>${u ? `<span class="more">Open →</span>` : ""}</div>${u ? `</a>` : `</article>`}`, "", { c: e.c, sx: s * (mini ? 0.34 : 0.28), sy, ry: -s * 14, gate });
        if (mini) it.mini = { kind: mini, cv: it.el.querySelector(".mini"), seed: n };
      } else {
        add(`<a class="card go" href="${v[1]}"><span>${esc(v[0])}</span><b>→</b></a>`, "", { c: e.c, sx: s * 0.2, sy: sy * 0.6, ry: -s * 10, gate });
      }
      depth += e.step || 430;
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
      if (it.gate != null) o *= sm((cam - it.gate) / 200);
      if (Math.abs(o - it.op) > 0.012) { it.op = o; it.el.style.opacity = o.toFixed(3); }
      const live = rel > -900 && rel < it.out - 100 && o > 0.5;
      if (live !== it.live) { it.live = live; it.el.classList.toggle("live", live); }
    }
    for (const it of items) if (it.orb && it.vis && it.op > 0.02) drawOrb(it, now);
    for (const it of items) if (it.mini && it.vis && it.op > 0.02) drawMini(it.mini, now);
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

  /* ---------- mini Oracles: a small live preview of each Oracle on its card ---------- */
  const MINI_PX = 360;
  const FIB9 = Array.from({ length: 9 }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / 9, r = Math.sqrt(1 - y * y), th = i * 2.39996; return [Math.cos(th) * r, y, Math.sin(th) * r]; });
  const BASIS9 = FIB9.map((c) => { const up = Math.abs(c[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; let a = [up[1] * c[2] - up[2] * c[1], up[2] * c[0] - up[0] * c[2], up[0] * c[1] - up[1] * c[0]]; const l = Math.hypot(...a); a = a.map((v) => v / l);
    return [a, [c[1] * a[2] - c[2] * a[1], c[2] * a[0] - c[0] * a[2], c[0] * a[1] - c[1] * a[0]]]; });
  const PEOPLE = (() => { const n = 64, pts = []; for (let i = 0; i < n; i++) { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = i * 2.39996; pts.push([Math.cos(th) * r, y, Math.sin(th) * r, i % 9]); }
    const links = []; pts.forEach((a, i) => { pts.map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2]).filter(([j]) => j > i).sort((x, y) => x[1] - y[1]).slice(0, (i * 7) % 3).forEach(([j]) => links.push([i, j])); });
    return { pts, links }; })();
  const RIBBONS = Array.from({ length: 90 }, (_, i) => ({ k: i % 9, r: 0.12 + ((i * 37) % 23) / 23 * 0.22, ph: (i * 2.39996) % 6.283, sp: 0.7 + ((i * 13) % 7) / 10 }));
  // Coaching Oracle mini: 180 works scattered around three theme anchors, like coaching-oracle.js
  const COACH = (() => { let sd = 11; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647, A = [[1, 0.25, 0], [-0.5, -0.3, 0.866], [-0.5, 0.2, -0.866]];
    return Array.from({ length: 180 }, (_, i) => { const k = i % 3, g2 = () => (rn() + rn() + rn() - 1.5) * 0.7, v = [A[k][0] + g2(), A[k][1] + g2(), A[k][2] + g2()], l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l, k]; }); })();
  function drawMini(m, now) {
    const cv = m.cv;
    if (!m.ctx) { cv.width = cv.height = MINI_PX; m.ctx = cv.getContext("2d"); m.all = TOPIC_RGB(); m.base = hex(getComputedStyle(document.body).getPropertyValue("--j-accent") || "#a4c7c1"); }
    const g = m.ctx, S = MINI_PX, C = S / 2, R = S * 0.36, t = reduce ? m.seed * 1000 : now + m.seed * 1000, all = m.all;
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, a).toFixed(3)})`;
    const rot = t * 0.00022, tX = 0.38, cX = Math.cos(tX), sX = Math.sin(tX);
    const P = (x, y, z) => { const c = Math.cos(rot), s = Math.sin(rot); [x, z] = [x * c + z * s, -x * s + z * c]; [y, z] = [y * cX - z * sX, y * sX + z * cX]; const f = 2.6 / (2.6 + z); return [C + x * R * f, C - y * R * f, z, f]; };
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    let gr = g.createRadialGradient(C, C, 0, C, C, R * 1.5); gr.addColorStop(0, rgba(m.base, 0.22)); gr.addColorStop(1, rgba(m.base, 0));
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = "lighter";
    if (m.kind === "master" || m.kind === "people") { g.strokeStyle = rgba(m.base, 0.2); g.lineWidth = 1; g.beginPath(); g.arc(C, C, R, 0, 6.283); g.stroke(); }
    if (m.kind === "master") {   // one ribbon of light per study, circling inside its topic's region
      for (const rb of RIBBONS) {
        const c0 = FIB9[rb.k], [t1, t2] = BASIS9[rb.k], head = rb.ph + t * 0.0009 * rb.sp; let prev = null;
        for (let q = 0; q <= 14; q++) {
          const u = head - q * 0.12, x = Math.cos(u) * rb.r, y = Math.sin(u) * rb.r;
          const v = [c0[0] + t1[0] * x + t2[0] * y, c0[1] + t1[1] * x + t2[1] * y, c0[2] + t1[2] * x + t2[2] * y], l = Math.hypot(...v), p = P(v[0] / l, v[1] / l, v[2] / l);
          if (prev) { const d = 0.5 - p[2] / 2; g.strokeStyle = rgba(all[rb.k], (1 - q / 14) * (0.2 + 0.8 * d)); g.lineWidth = 2.4 * p[3]; g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke(); }
          else if (p[2] < 0.2) { g.fillStyle = rgba(all[rb.k], 0.9); g.beginPath(); g.arc(p[0], p[1], 2.2 * p[3], 0, 6.283); g.fill(); }
          prev = p;
        }
      }
    } else if (m.kind === "people") {   // researchers as lights, linked to who they published with
      const pr = PEOPLE.pts.map(([x, y, z]) => P(x, y, z));
      for (const [a, b] of PEOPLE.links) { const d = 0.5 - (pr[a][2] + pr[b][2]) / 4; g.strokeStyle = rgba(all[PEOPLE.pts[a][3]], 0.05 + 0.3 * d); g.lineWidth = 0.9; g.beginPath(); g.moveTo(pr[a][0], pr[a][1]); g.lineTo(pr[b][0], pr[b][1]); g.stroke(); }
      pr.forEach((p, i) => { const d = 0.5 - p[2] / 2, col = all[PEOPLE.pts[i][3]], r = (1.4 + (i % 5) * 0.5) * p[3];
        g.fillStyle = rgba(col, 0.15 + 0.85 * d); g.beginPath(); g.arc(p[0], p[1], r, 0, 6.283); g.fill();
        if (i % 7 === 0 && d > 0.5) { g.fillStyle = rgba(col, 0.16); g.beginPath(); g.arc(p[0], p[1], r * 4, 0, 6.283); g.fill(); } });
    } else if (m.kind === "coach") {   // the Coaching Oracle: works gathered in three theme regions (ecological dynamics, skill acquisition, practice design)
      g.strokeStyle = rgba(m.base, 0.2); g.lineWidth = 1; g.beginPath(); g.arc(C, C, R, 0, 6.283); g.stroke();
      COACH.forEach(([x, y, z, k], i) => { const p = P(x, y, z), d = 0.5 - p[2] / 2, col = all[[3, 5, 2][k]], r = (1.1 + (i % 4) * 0.45) * p[3];
        g.fillStyle = rgba(col, 0.12 + 0.85 * d); g.beginPath(); g.arc(p[0], p[1], r, 0, 6.283); g.fill(); });
      gr = g.createRadialGradient(C, C, 0, C, C, R * 0.3); gr.addColorStop(0, rgba([233, 240, 238], 0.5)); gr.addColorStop(1, rgba(m.base, 0)); g.fillStyle = gr; g.beginPath(); g.arc(C, C, R * 0.3, 0, 6.283); g.fill();
    } else if (m.kind === "sunflower") {   // golden-angle seeds, oldest at the centre, newest at the edge
      const n = 150, spin = t * 0.00008;
      for (let i = 0; i < n; i++) { const a = i * 2.39996 + spin, rr = Math.sqrt(i / n) * R * 1.02, x = C + Math.cos(a) * rr, y = C + Math.sin(a) * rr;
        const pulse = reduce ? 1 : 0.7 + 0.3 * Math.sin(t * 0.003 - i * 0.12), col = all[(i * 5) % 9];
        g.fillStyle = rgba(col, (0.35 + 0.55 * i / n) * pulse); g.beginPath(); g.arc(x, y, 1.3 + 2.6 * (i / n), 0, 6.283); g.fill(); }
    } else if (m.kind === "briefs") {   // a study turned into a brief: pages fanning out from the source
      for (let k = 4; k >= 0; k--) {
        const a = (k - 2) * 0.16 + (reduce ? 0 : Math.sin(t * 0.0012 + k) * 0.04), w = R * 1.0, h = R * 1.3;
        g.save(); g.translate(C, C + R * 0.05); g.rotate(a); g.globalAlpha = 0.35 + 0.15 * (4 - k);
        g.fillStyle = rgba(m.base, 0.05); g.strokeStyle = rgba(m.base, 0.55); g.lineWidth = 1.2;
        g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 6); g.fill(); g.stroke();
        if (k === 0) { for (let l = 0; l < 7; l++) { const lw = w * (l === 0 ? 0.55 : 0.7 - (l % 3) * 0.12), y = -h / 2 + 18 + l * 13; g.strokeStyle = rgba(l === 0 ? [233, 240, 238] : m.base, l === 0 ? 0.9 : 0.5); g.lineWidth = l === 0 ? 3 : 1.6; g.beginPath(); g.moveTo(-w / 2 + 14, y); g.lineTo(-w / 2 + 14 + lw, y); g.stroke(); }
          const ky = h / 2 - 22, glow = reduce ? 1 : 0.6 + 0.4 * Math.sin(t * 0.003); g.fillStyle = rgba(all[(Math.floor(t / 1600) % 9 + 9) % 9], glow); g.beginPath(); g.arc(-w / 2 + 18, ky, 4, 0, 6.283); g.fill(); }
        g.restore();
      }
      g.globalAlpha = 1;
    } else if (m.kind === "reviews") {   // peers around one study, talking it through
      const n = 7, spin = t * 0.00025;
      g.fillStyle = rgba([233, 240, 238], 0.9); g.beginPath(); g.arc(C, C, 6, 0, 6.283); g.fill();
      for (let i = 0; i < n; i++) {
        const a = spin + i / n * 6.283, x = C + Math.cos(a) * R * 0.92, y = C + Math.sin(a) * R * 0.62, col = all[(i * 4) % 9];
        const talk = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.002 + i * 1.7);
        g.strokeStyle = rgba(col, 0.12 + 0.45 * talk); g.lineWidth = 1.2; g.beginPath(); g.moveTo(C, C); g.lineTo(x, y); g.stroke();
        const j = (i + 2) % n, b = spin + j / n * 6.283; g.strokeStyle = rgba(m.base, 0.08 + 0.2 * talk); g.beginPath(); g.moveTo(x, y); g.lineTo(C + Math.cos(b) * R * 0.92, C + Math.sin(b) * R * 0.62); g.stroke();
        g.fillStyle = rgba(col, 0.8); g.beginPath(); g.arc(x, y, 5 + 2 * talk, 0, 6.283); g.fill();
        g.fillStyle = rgba(col, 0.15 * talk); g.beginPath(); g.arc(x, y, 16, 0, 6.283); g.fill();
      }
    } else if (m.kind === "conference") {   // a stage broadcasting outward in rings
      for (let k = 0; k < 5; k++) {
        const ph = reduce ? k / 5 : ((t * 0.00025 + k / 5) % 1), r = R * 0.2 + ph * R * 1.0;
        g.strokeStyle = rgba(all[(k * 2) % 9], 0.55 * (1 - ph)); g.lineWidth = 1.6; g.beginPath(); g.ellipse(C, C + R * 0.15, r, r * 0.42, 0, 0, 6.283); g.stroke();
      }
      for (let i = 0; i < 24; i++) { const a = i * 2.39996, rr = R * (0.55 + (i % 4) * 0.12), x = C + Math.cos(a) * rr, y = C + R * 0.15 + Math.sin(a) * rr * 0.42; g.fillStyle = rgba(m.base, 0.35 + 0.3 * ((i % 3) / 2)); g.beginPath(); g.arc(x, y, 2, 0, 6.283); g.fill(); }
      gr = g.createRadialGradient(C, C - R * 0.05, 0, C, C - R * 0.05, R * 0.4); gr.addColorStop(0, rgba([233, 240, 238], 0.85)); gr.addColorStop(0.4, rgba(m.base, 0.35)); gr.addColorStop(1, rgba(m.base, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(C, C - R * 0.05, R * 0.4, 0, 6.283); g.fill();
    } else if (m.kind === "nhl") {   // the NHL Goaltending Oracle: five tilted rings, one per band of goals saved above average
      const OR = [[127, 211, 192], [164, 199, 193], [138, 154, 151], [227, 169, 138], [240, 122, 90]];
      OR.forEach((col, k) => {
        const tilt = 0.35 + ((k * 0.618) % 1) * 0.9, head = k / 5 * Math.PI, ct = Math.cos(tilt), st = Math.sin(tilt), ch = Math.cos(head), sh = Math.sin(head), rr = 0.95;
        const pt = (u) => { let x = Math.cos(u) * rr, z = Math.sin(u) * rr, y = 0; [y, z] = [-z * st, z * ct]; [x, z] = [x * ch - z * sh, x * sh + z * ch]; return P(x, y, z); };
        let p = pt(0); for (let q = 1; q <= 72; q++) { const r2 = pt(q / 72 * 6.283), d = 0.5 - (p[2] + r2[2]) / 4; g.strokeStyle = rgba(col, 0.1 + 0.45 * d); g.lineWidth = 1.2; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(r2[0], r2[1]); g.stroke(); p = r2; }
        const n = 6 + (k % 3) * 2; for (let b = 0; b < n; b++) { const q = pt(b / n * 6.283 + t * 0.0004 * (k % 2 ? 1 : -1)), d = 0.5 - q[2] / 2; g.fillStyle = rgba(col, 0.25 + 0.75 * d); g.beginPath(); g.arc(q[0], q[1], (b === 0 ? 4.2 : 2.4) * q[3], 0, 6.283); g.fill(); }
      });
      gr = g.createRadialGradient(C, C, 0, C, C, R * 0.28); gr.addColorStop(0, rgba([233, 240, 238], 0.7)); gr.addColorStop(1, rgba(m.base, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(C, C, R * 0.28, 0, 6.283); g.fill();
    } else {   // armillary: one tilted ring per topic, hollow marks for unverified works
      for (let k = 0; k < 9; k++) {
        const tilt = 0.3 + k * 0.33, head = k * 0.7, ct = Math.cos(tilt), st = Math.sin(tilt), ch = Math.cos(head), sh = Math.sin(head), rr = 0.92 + (k % 3) * 0.05;
        const pt = (u) => { let x = Math.cos(u) * rr, z = Math.sin(u) * rr, y = 0; [y, z] = [-z * st, z * ct]; [x, z] = [x * ch - z * sh, x * sh + z * ch]; return P(x, y, z); };
        let p = pt(0); for (let q = 1; q <= 60; q++) { const r2 = pt(q / 60 * 6.283), d = 0.5 - (p[2] + r2[2]) / 4; g.strokeStyle = rgba(all[k], 0.08 + 0.4 * d); g.lineWidth = 1; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(r2[0], r2[1]); g.stroke(); p = r2; }
        for (let b = 0; b < 3; b++) { const q = pt(t * 0.0005 * (k % 2 ? 1 : -1) + b * 2.1 + k), d = 0.5 - q[2] / 2; g.strokeStyle = rgba(all[k], 0.3 + 0.7 * d); g.lineWidth = 1.3; g.beginPath(); g.arc(q[0], q[1], 3 * q[3], 0, 6.283); g.stroke(); }
      }
      gr = g.createRadialGradient(C, C, 0, C, C, R * 0.3); gr.addColorStop(0, rgba([233, 240, 238], 0.7)); gr.addColorStop(1, rgba(m.base, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(C, C, R * 0.3, 0, 6.283); g.fill();
    }
    g.globalCompositeOperation = "source-over";
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
