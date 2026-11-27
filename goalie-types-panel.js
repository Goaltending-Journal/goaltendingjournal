/* Archetypes on goalies.html (Goldy, 2026-11-26): the twelve goalie types from goalie-types-data.js (build_goalie_types.py,
   nightly) take turns in the rail card at the top left, in place of the mini NHL Oracle; the Archetypes view is gone.
   Each type shows its Light Box X-ray (illustrations/styles.js "skeletons-xray") in the team colours of the goalie who
   leads it, playing its loop (illustrations/motion.js, 12 fps, prebuilt frames). The card moves on every few seconds,
   pauses while pointed at or focused, and the dots pick a type. Reduced motion: stills only, no auto-advance.
   Reuses the page's $, esc, byId and openGoalie. Data courtesy of Natural Stat Trick. */
(async () => {
  const D = window.GOALIE_TYPES, G = window.GoalieSkeleton, ST = window.GoalieStyles, MO = window.GoalieMotion;
  const box = $("#tyRot");
  if (!box || !D || !G || !ST || !MO) return;
  let TEAMS;
  try { TEAMS = (await (await fetch("illustrations/team-colours.json")).json()).teams; } catch { return; }
  const draw = ST.STYLES["skeletons-xray"].draw, FPS = 12, SIZE = 64, HOLD = 6000;
  const NEUTRAL = { name: "League", primary: "#4B706A", secondary: "#FFFFFF", accent: "#A4C7C1", code: "NHL" };   // a type nobody holds yet
  // The value each trait type is ranked on (the z-scores in the data); titles have one holder
  const Z = { workhorse: "toi", "hd-stopper": "hd60", wall: "ldmd60", rebound: "reb100", siege: "sa60", crease: "hdshare" };
  const types = G.ORDER.map((k) => D.types.find((t) => t.key === k)).filter(Boolean);
  if (!types.length) return;
  const members = (t) => D.goalies.filter((g) => g.type === t.key)
    .sort((a, b) => ((b.z || {})[Z[t.key]] ?? 0) - ((a.z || {})[Z[t.key]] ?? 0) || a.name.localeCompare(b.name));
  const colours = (g) => (g && TEAMS[g.team] ? { ...TEAMS[g.team], code: g.team } : NEUTRAL);
  const top = (k) => Math.min(...[0, 1, 2].map((i) => G.parts(MO.keyPose(k, i)).top));   // one scale per loop

  box.innerHTML = `<div class="ty-k">NHL Archetypes</div><div class="ty-art" aria-hidden="true"></div>
    <div class="ty-txt" aria-live="polite"></div>
    <div class="ty-dots" role="group" aria-label="Pick an archetype">${types.map((t, i) => `<button type="button" data-i="${i}" aria-label="${esc(t.name)}"></button>`).join("")}</div>
    <div class="ty-src">As of ${esc(D.asOf)} · <a href="https://www.naturalstattrick.com" target="_blank" rel="noopener noreferrer">Natural Stat Trick</a></div>`;
  box.hidden = false;
  const art = box.querySelector(".ty-art"), txt = box.querySelector(".ty-txt"), dots = [...box.querySelectorAll(".ty-dots button")];

  let cur = 0;
  function showType(i) {
    cur = (i + types.length) % types.length;
    const t = types[cur], gs = members(t), g = gs[0];
    art.innerHTML = draw(t.key, colours(g), "", { size: SIZE, topY: top(t.key), label: "" });
    txt.innerHTML = `<h4>${esc(t.name)}</h4><p>${esc(t.trait)}</p>` + (g
      ? `<button type="button" class="ty-lead" data-id="${g.id ?? ""}"${byId.has(g.id) ? "" : " disabled"}>${esc(g.name)}<span class="t">${esc(g.team)}</span></button>${gs.length > 1 ? `<span class="ty-n">+${gs.length - 1} more</span>` : ""}`
      : `<p class="ty-none">None yet</p>`);
    dots.forEach((d, n) => d.setAttribute("aria-current", String(n === cur)));
    t0 = performance.now(); shown = Date.now();
    build(t.key);
  }
  box.addEventListener("click", (e) => {
    const d = e.target.closest(".ty-dots button"); if (d) { showType(+d.dataset.i); return; }
    const b = e.target.closest("button[data-id]"); if (b && b.dataset.id) openGoalie(+b.dataset.id);
  });

  // Motion: the shown type plays its loop; frames are built in idle time, one type at a time
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frames = {}, tpl = document.createElement("template"), idle = window.requestIdleCallback || ((f) => setTimeout(() => f(null), 16));
  let t0 = 0, last = 0, shown = 0, paused = false;
  function build(k) {
    if (reduce || frames[k]) return;
    const out = (frames[k] = []), n = Math.round(MO.loopMs(k) * FPS / 1000), tk = colours(members(types.find((t) => t.key === k))[0]), y = top(k);
    const step = (dl) => {
      while (out.length < n && (!dl || dl.timeRemaining() > 2)) {
        tpl.innerHTML = draw(MO.poseAt(k, out.length * 1000 / FPS), tk, "", { size: SIZE, topY: y, label: "" });
        out.push(tpl.content.firstElementChild);
        if (!dl) break;
      }
      if (out.length < n) idle(step); else out.ready = true;
    };
    idle(step);
  }
  showType(0);
  if (reduce) return;
  box.addEventListener("pointerenter", () => { paused = true; });
  box.addEventListener("pointerleave", () => { paused = false; shown = Date.now(); });
  box.addEventListener("focusin", () => { paused = true; });
  box.addEventListener("focusout", () => { paused = false; shown = Date.now(); });
  function tick(now) {
    if (!paused && !document.hidden && Date.now() - shown > HOLD) showType(cur + 1);
    if (now - last >= 1000 / FPS) {
      last = now;
      const f = frames[types[cur].key];
      if (f && f.ready) { const node = f[Math.floor((now - t0) * FPS / 1000) % f.length]; if (art.firstElementChild !== node) art.replaceChildren(node); }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
