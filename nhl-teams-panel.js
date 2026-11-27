/* NHL Teams view on goalies.html (Goldy, 2026-11-26; layout after the Parallel "Choose your Paragon" screen).
   Left: the 32 clubs in four rows, one per division, as slanted tiles in their team colours (abbreviations, never logos).
   Pointing at a tile previews the club on the right: a Light Box X-ray goalie in its colours, its name and division,
   its starter and the team's save % and GAA this season. Clicking a tile opens the club's goalie depth chart:
   NHL goalies live from goalies-data.js, then AHL, ECHL and prospects from nhl-teams-data.js (NHL feed roster and
   prospect lists, via build_nhl_teams.py). Reuses the page's $, esc, DATA, byId and openGoalie. */
(async () => {
  const T = window.NHL_TEAMS, G = window.GoalieSkeleton, ST = window.GoalieStyles, MO = window.GoalieMotion;
  const grid = $("#tmGrid"), stage = $("#tmStage");
  if (!T || !grid || !stage || !G || !ST || !MO) return;
  let TEAMS;
  try { TEAMS = (await (await fetch("illustrations/team-colours.json")).json()).teams; } catch { return; }
  const SEASON = "2026-27", POSE = "workhorse", FPS = 12;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const draw = ST.STYLES["skeletons-xray"].draw;
  const topY = Math.min(...[0, 1, 2].map((i) => G.parts(MO.keyPose(POSE, i)).top));
  const divOf = {}; T.divisions.forEach((d) => d.teams.forEach((c) => (divOf[c] = d)));

  // This season's NHL goalies by club, most starts first, with the team's combined save % and GAA
  const nhl = {};
  DATA.goalies.forEach((g) => { const s = (g.seasons || {})[SEASON]; if (s && s.gp) (nhl[s.team] ||= []).push({ g, s }); });
  Object.values(nhl).forEach((l) => l.sort((a, b) => (b.s.gs ?? b.s.gp) - (a.s.gs ?? a.s.gp)));
  const team = (c) => {
    const l = nhl[c] || [], sum = (k) => l.reduce((t, x) => t + (x.s[k] || 0), 0);
    const sa = sum("sa"), ga = sum("ga"), toi = sum("toi");
    return { list: l, svp: sa ? 1 - ga / sa : null, gaa: toi ? ga / (toi / 3600) : null };
  };
  const sv = (v) => (v == null ? "–" : v.toFixed(3).replace(/^0/, ""));

  // Left: four division rows of slanted tiles
  grid.innerHTML = T.divisions.map((d) => `<div class="tm-row" role="group" aria-label="${esc(d.name)} Division">
      <span class="tm-div">${esc(d.name)}</span>
      ${d.teams.map((c) => { const k = TEAMS[c] || {}; return `<button type="button" class="tm-t" data-c="${c}" style="--p:${k.primary};--s:${k.secondary};--a:${k.accent}" aria-label="${esc(k.name || c)}"><span>${c}</span></button>`; }).join("")}
    </div>`).join("");
  const tiles = [...grid.querySelectorAll(".tm-t")];

  let cur = null, open = false;
  function preview(c) {
    if (!c) return;
    cur = c; open = false;
    const k = TEAMS[c], d = divOf[c], t = team(c), st = t.list[0];
    tiles.forEach((b) => b.classList.toggle("on", b.dataset.c === c));
    build(c);
    stage.style.cssText = `--p:${k.primary};--s:${k.secondary};--a:${k.accent}`;
    stage.classList.remove("deep");
    stage.innerHTML = `<div class="tm-mark" aria-hidden="true">${c}</div><div class="tm-floor" aria-hidden="true"></div>
      <div class="tm-art" aria-hidden="true">${fig(POSE, c)}</div>
      <div class="tm-name"><i aria-hidden="true"></i><b>${esc(k.name)}</b><span>${esc(d.name)} Division</span></div>
      <div class="tm-low">
        <p class="tm-line">${st ? `${esc(st.g.name)} has made the most starts this season: ${st.s.gs ?? st.s.gp} of the team's games, with a ${sv(st.s.svp)} save %.` : "No goalie has played for the club yet this season."}</p>
        <button type="button" class="tm-go" data-depth="${c}">Depth chart</button>
        <dl class="tm-stats"><div><dt>NHL goalies</dt><dd>${t.list.length}</dd></div><div><dt>Team SV%</dt><dd>${sv(t.svp)}</dd></div><div><dt>Team GAA</dt><dd>${t.gaa == null ? "–" : t.gaa.toFixed(2)}</dd></div></dl>
      </div>`;
  }
  // The goalie stands on the stage itself (plain mode: no light-box square), in the team's colours, playing its loop
  const fig = (pose, c) => draw(pose, { ...TEAMS[c], code: c }, "", { size: 240, topY, label: "", plain: true });
  const frames = {}, idle = window.requestIdleCallback || ((f) => setTimeout(() => f(null), 16));
  let t0 = performance.now(), last = 0;
  function build(c) {
    if (reduce || frames[c]) return;
    const out = (frames[c] = []), n = Math.round(MO.loopMs(POSE) * FPS / 1000);
    const step = (dl) => { while (out.length < n && (!dl || dl.timeRemaining() > 2)) { out.push(fig(MO.poseAt(POSE, out.length * 1000 / FPS), c)); if (!dl) break; } if (out.length < n) idle(step); else out.ready = true; };
    idle(step);
  }
  function tick(now) {
    if (cur && now - last >= 1000 / FPS && !document.hidden) {
      last = now; const f = frames[cur], art = stage.querySelector(".tm-art");
      if (f && f.ready && art && !open) art.innerHTML = f[Math.floor((now - t0) * FPS / 1000) % f.length];
    }
    requestAnimationFrame(tick);
  }
  if (!reduce) requestAnimationFrame(tick);

  function depth(c) {
    preview(c); open = true; stage.classList.add("deep");
    const k = TEAMS[c], t = team(c), rest = (T.depth[c] || []).filter((r) => !t.list.some((x) => x.g.id === r.id));
    const row = (name, id, sub) => `<li>${id && byId.has(id) ? `<button type="button" data-id="${id}">${esc(name)}</button>` : `<b>${esc(name)}</b>`}<span>${sub}</span></li>`;
    const col = (h, items) => `<div class="tm-col"><h4>${h}</h4>${items.length ? `<ol>${items.join("")}</ol>` : `<p class="tm-none">None listed</p>`}</div>`;
    stage.querySelector(".tm-low").innerHTML = `<div class="tm-depth"><div class="tm-dh"><h3>Goalie depth chart</h3><button type="button" class="tm-back">Back to team</button></div>
      <div class="tm-cols">
        ${col("NHL", t.list.map(({ g, s }) => row(g.name, g.id, `${s.gp} GP · ${sv(s.svp)} · ${g.catches === "R" ? "Right" : "Left"}`)))}
        ${["AHL", "ECHL", "Prospects"].map((L) => col(L, rest.filter((r) => r.level === L).map((r) => row(r.name, r.id, esc([r.now, r.born && `Born ${r.born}`, r.draft].filter(Boolean).join(" · "))))) ).join("")}
      </div>
      <p class="tm-src">NHL goalies: NHL stats feed, ${esc(DATA.asOf)}. AHL, ECHL and prospects: the club's roster and prospect lists in the NHL feed, ${esc(T.asOf)}.</p></div>`;
    stage.querySelector(".tm-back").focus({ preventScroll: true });
  }

  const fine = matchMedia("(hover: hover)").matches;
  grid.addEventListener("pointerover", (e) => { const b = e.target.closest(".tm-t"); if (fine && b && !open && b.dataset.c !== cur) preview(b.dataset.c); });
  grid.addEventListener("focusin", (e) => { const b = e.target.closest(".tm-t"); if (b && !open) preview(b.dataset.c); });
  grid.addEventListener("click", (e) => { const b = e.target.closest(".tm-t"); if (b) depth(b.dataset.c); });
  stage.addEventListener("click", (e) => {
    const g = e.target.closest("[data-depth]"); if (g) { depth(g.dataset.depth); return; }
    if (e.target.closest(".tm-back")) { preview(cur); grid.querySelector(`.tm-t[data-c="${cur}"]`).focus({ preventScroll: true }); return; }
    const p = e.target.closest("button[data-id]"); if (p) openGoalie(+p.dataset.id);
  });
  preview(T.divisions[0].teams[0]);
})();
