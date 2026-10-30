/* Archetypes on goalies.html: the twelve goalie types from goalie-types-data.js (build_goalie_types.py, nightly), each a
   compact card with a Light Box X-ray (illustrations/styles.js "skeletons-xray") in the team colours of the goalie who
   leads it. Cards are stills; a card plays its loop (illustrations/motion.js, 12 fps, prebuilt frames) only while it is
   hovered or focused, and never under reduced motion. Reuses the page's $, esc, byId and openGoalie.
   Data courtesy of Natural Stat Trick. */
(async () => {
  const D = window.GOALIE_TYPES, G = window.GoalieSkeleton, ST = window.GoalieStyles, MO = window.GoalieMotion;
  if (!D || !G || !ST || !MO) return;
  let TEAMS;
  try { TEAMS = (await (await fetch("illustrations/team-colours.json")).json()).teams; } catch { return; }
  const draw = ST.STYLES["skeletons-xray"].draw, FPS = 12, SIZE = 64;
  const NEUTRAL = { name: "League", primary: "#5563C4", secondary: "#FFFFFF", accent: "#AEB6F5", code: "NHL" };   // a type nobody holds yet
  // The value each trait type is ranked on (the z-scores in the data); titles have one holder
  const Z = { workhorse: "toi", "hd-stopper": "hd60", wall: "ldmd60", rebound: "reb100", siege: "sa60", crease: "hdshare" };
  const types = G.ORDER.map((k) => D.types.find((t) => t.key === k)).filter(Boolean);
  const members = (t) => D.goalies.filter((g) => g.type === t.key)
    .sort((a, b) => ((b.z || {})[Z[t.key]] ?? 0) - ((a.z || {})[Z[t.key]] ?? 0) || a.name.localeCompare(b.name));
  const colours = (g) => (g && TEAMS[g.team] ? { ...TEAMS[g.team], code: g.team } : NEUTRAL);
  const top = (k) => Math.min(...[0, 1, 2].map((i) => G.parts(MO.keyPose(k, i)).top));   // one scale per loop
  const who = (g) => `<button type="button" data-id="${g.id ?? ""}"${byId.has(g.id) ? "" : " disabled"}>${esc(g.name)}<span class="t">${esc(g.team)}</span></button>`;

  $("#tySec").hidden = false;
  $("#tyNote").innerHTML = `As of ${esc(D.asOf)} · Data: <a href="https://www.naturalstattrick.com">Natural Stat Trick</a>`;
  $("#tyGrid").innerHTML = types.map((t) => {
    const gs = members(t), g = gs[0];
    return `<li class="ty-card" data-k="${t.key}" tabindex="-1"><div class="ty-art">${draw(t.key, colours(g), "", { size: SIZE, topY: top(t.key), label: `${t.name}, drawn as an X-ray skeleton` })}</div>
      <div class="ty-txt"><h3>${esc(t.name)}</h3><p>${esc(t.trait)}</p>
      ${g ? `<div class="ty-row"><button type="button" class="ty-lead" data-id="${g.id ?? ""}"${byId.has(g.id) ? "" : " disabled"} title="${esc(g.name)}">${esc(g.name)}</button>${gs.length > 1 ? `<button type="button" class="ty-more" data-k="${t.key}" aria-label="All ${gs.length} ${esc(t.name)} goalies">+${gs.length - 1}</button>` : ""}</div>`
        : `<p>None yet</p>`}</div></li>`;
  }).join("");

  // The full list of a type, in a popover under its "+N" button
  const pop = document.createElement("div");
  pop.className = "ty-pop"; pop.setAttribute("popover", "auto"); document.body.append(pop);
  const canPop = typeof pop.showPopover === "function";
  $("#tyGrid").addEventListener("click", (e) => {
    const more = e.target.closest(".ty-more");
    if (more && canPop) {
      const t = types.find((x) => x.key === more.dataset.k), r = more.getBoundingClientRect();
      pop.innerHTML = `<h4>${esc(t.name)} · ${esc(t.rule)}</h4><ul>${members(t).map((g) => `<li>${who(g)}</li>`).join("")}</ul>`;
      Object.assign(pop.style, { position: "fixed", inset: "auto", top: `${Math.min(r.bottom + 6, innerHeight - 40)}px`, left: `${Math.max(8, Math.min(r.left - 120, innerWidth - 330))}px` });
      pop.showPopover();
      return;
    }
    const b = e.target.closest("button[data-id]");
    if (b && b.dataset.id) openGoalie(+b.dataset.id);
  });
  pop.addEventListener("click", (e) => { const b = e.target.closest("button[data-id]"); if (b && b.dataset.id) { pop.hidePopover(); openGoalie(+b.dataset.id); } });

  // Motion: the hovered or focused card plays its loop; leaving it shows the still again
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const frames = {}, tpl = document.createElement("template"), idle = window.requestIdleCallback || ((f) => setTimeout(() => f(null), 16));
  let live = null, t0 = 0, last = 0, still = null;
  function build(k) {
    if (frames[k]) return;
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
  const start = (card) => { if (!card || card === live) return; stop(); live = card; still = card.querySelector(".ty-art svg"); t0 = performance.now(); build(card.dataset.k); requestAnimationFrame(tick); };
  const stop = () => { if (live && still) live.querySelector(".ty-art").replaceChildren(still); live = null; };
  function tick(now) {
    if (!live) return;
    if (now - last >= 1000 / FPS) {
      last = now;
      const f = frames[live.dataset.k];
      if (f && f.ready) { const art = live.querySelector(".ty-art"), node = f[Math.floor((now - t0) * FPS / 1000) % f.length]; if (art.firstElementChild !== node) art.replaceChildren(node); }
    }
    requestAnimationFrame(tick);
  }
  const grid = $("#tyGrid");
  grid.addEventListener("pointerover", (e) => { if (e.pointerType === "mouse") start(e.target.closest(".ty-card")); });
  grid.addEventListener("pointerleave", stop);
  grid.addEventListener("focusin", (e) => start(e.target.closest(".ty-card")));
  grid.addEventListener("focusout", (e) => { if (!grid.contains(e.relatedTarget)) stop(); });
})();
