/* Goalie Types on goalies.html: the twelve categories from goalie-types-data.js (build_goalie_types.py, nightly), each drawn
   as a Light Box X-ray (illustrations/styles.js "skeletons-xray") in the team colours of the goalie who leads it.
   Only the featured card moves (12 fps loop from illustrations/motion.js, prebuilt frames, on screen only, never under
   reduced motion); the tiles are stills. Reuses the page's $, esc, byId and openGoalie. Data courtesy of Natural Stat Trick. */
(async () => {
  const D = window.GOALIE_TYPES, G = window.GoalieSkeleton, ST = window.GoalieStyles, MO = window.GoalieMotion;
  if (!D || !G || !ST || !MO) return;
  let TEAMS;
  try { TEAMS = (await (await fetch("illustrations/team-colours.json")).json()).teams; } catch { return; }
  const draw = ST.STYLES["skeletons-xray"].draw, FPS = 12;
  const NEUTRAL = { name: "League", primary: "#5563C4", secondary: "#FFFFFF", accent: "#AEB6F5", code: "NHL" };     // a type nobody holds yet
  // The value each trait type is ranked on (the z-scores in the data); titles have one holder
  const Z = { workhorse: "toi", "hd-stopper": "hd60", wall: "ldmd60", rebound: "reb100", siege: "sa60", crease: "hdshare" };
  const types = G.ORDER.map((k) => D.types.find((t) => t.key === k)).filter(Boolean);
  const members = (t) => D.goalies.filter((g) => g.type === t.key)
    .sort((a, b) => ((b.z || {})[Z[t.key]] ?? 0) - ((a.z || {})[Z[t.key]] ?? 0) || a.name.localeCompare(b.name));
  const lead = (t) => members(t)[0];
  const colours = (g) => (g && TEAMS[g.team] ? { ...TEAMS[g.team], code: g.team } : NEUTRAL);
  // One scale per loop, from the highest point of its three keys, so the figure doesn't jump between frames
  const top = (k) => Math.min(...[0, 1, 2].map((i) => G.parts(MO.keyPose(k, i)).top));

  $("#tySec").hidden = false;
  $("#tyNote").innerHTML = `As of ${esc(D.asOf)} · Data: <a href="https://www.naturalstattrick.com">Natural Stat Trick</a>`;
  $("#tyTiles").innerHTML = types.map((t) => {
    const n = members(t).length;
    return `<button type="button" class="ty-tile" data-k="${t.key}" aria-pressed="false">${draw(t.key, colours(lead(t)), "", { size: 76, label: "" })}
      <b>${esc(t.name)}</b><span>${n ? `${n} goalie${n === 1 ? "" : "s"}` : "None yet"}</span></button>`;
  }).join("");

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, frames = {};
  let cur = null, t0 = 0, last = 0, onScreen = false, lit = false, tpl = document.createElement("template");
  function build(k) {
    if (frames[k] || reduce) return;
    const out = (frames[k] = []), n = Math.round(MO.loopMs(k) * FPS / 1000), tk = colours(lead(types.find((t) => t.key === k))), y = top(k);
    const idle = window.requestIdleCallback || ((f) => setTimeout(() => f(null), 16));
    const step = (dl) => {
      while (out.length < n && (!dl || dl.timeRemaining() > 2)) {
        tpl.innerHTML = draw(MO.poseAt(k, out.length * 1000 / FPS), tk, "", { topY: y, label: "" });
        out.push(tpl.content.firstElementChild);
        if (!dl) break;
      }
      if (out.length < n) idle(step); else out.ready = true;
    };
    idle(step);
  }
  function show(k) {
    const t = types.find((x) => x.key === k), gs = members(t);
    cur = k; t0 = performance.now();
    document.querySelectorAll(".ty-tile").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === k));
    $("#tyFeat").innerHTML = `<div class="ty-stage" id="tyStage">${draw(k, colours(gs[0]), "", { topY: top(k), label: `${t.name}, drawn as an X-ray skeleton` })}</div>
      <div><h3>${esc(t.name)}</h3><p class="ty-trait">${esc(t.trait)}</p><p class="ty-rule">${esc(t.rule)}</p>
      ${gs.length ? `<ul class="ty-who">${gs.map((g) => `<li><button type="button" data-id="${g.id ?? ""}"${byId.has(g.id) ? "" : " disabled"}>${esc(g.name)}<span class="t">${esc(g.team)}</span></button></li>`).join("")}</ul>`
        : `<p class="ty-none">No goalie meets this one yet.</p>`}</div>`;
    if (onScreen) build(k);
  }
  $("#tyTiles").addEventListener("click", (e) => { const b = e.target.closest(".ty-tile"); if (b) show(b.dataset.k); });
  $("#tyFeat").addEventListener("click", (e) => { const b = e.target.closest("button[data-id]"); if (b && b.dataset.id) openGoalie(+b.dataset.id); });
  new IntersectionObserver((es) => es.forEach((e) => {
    onScreen = e.isIntersecting;
    if (onScreen && !reduce) {
      if (!lit) { lit = true; $("#tyStage")?.classList.add("warm"); }
      build(cur);
    }
  }), { rootMargin: "100px" }).observe($("#tyFeat"));
  const first = types.find((t) => members(t).length) || types[0];          // open on a type someone holds
  show(first.key);
  if (reduce) return;
  (function tick(now) {
    if (onScreen && now - last >= 1000 / FPS) {
      last = now;
      const f = frames[cur], stage = $("#tyStage");
      if (f && f.ready && stage) { const node = f[Math.floor((now - t0) * FPS / 1000) % f.length]; if (stage.firstElementChild !== node) stage.replaceChildren(node); }
    }
    requestAnimationFrame(tick);
  })(performance.now());
})();
