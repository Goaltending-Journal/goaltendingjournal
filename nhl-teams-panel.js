/* Depth Charts view on goalies.html (Goldy, 2026-11-26, renamed 2026-11-27; layout after the Parallel "Choose your Paragon" screen).
   Left: the 32 clubs in four rows, one per division, as slanted tiles in their team colours (abbreviations, never logos).
   Pointing at a tile previews the club on the right: a Light Box X-ray goalie in its colours, its name and division,
   its starter and the team's save % and GAA this season. Clicking a tile opens the club's goalie depth chart:
   NHL goalies live from goalies-data.js, then AHL, ECHL and prospects from nhl-teams-data.js (NHL feed roster and
   prospect lists, via build_nhl_teams.py), with the club's confirmed goaltending staff. Under the stage, the club's 5v5 team
   defence from Natural Stat Trick: where it ranks on shots, expected goals and high-danger chances against, and what kind of
   defensive support its goalies get (shot volume against shot quality, split at the league medians).
   Reuses the page's $, esc, DATA, byId and openGoalie. */
(async () => {
  const T = window.NHL_TEAMS, G = window.GoalieSkeleton, ST = window.GoalieStyles, MO = window.GoalieMotion;
  const grid = $("#tmGrid"), stage = $("#tmStage"), adv = $("#tmAdv");
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
    build(c); defence(c);
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
      ${staffList(c)}
      <p class="tm-src">NHL goalies: NHL stats feed, ${esc(DATA.asOf)}. AHL, ECHL and prospects: the club's roster and prospect lists in the NHL feed, ${esc(T.asOf)}.${(T.staffLinks || {})[c] ? ` Staff: the club's own staff ${T.staffLinks[c].length > 1 ? "pages" : "page"} (${T.staffLinks[c].map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${T.staffLinks[c].length > 1 ? i + 1 : "link"}</a>`).join(", ")}), confirmed roles only, ${esc(T.staffAsOf)}.` : ""}</p></div>`;
    stage.querySelector(".tm-back").focus({ preventScroll: true });
  }

  // Goaltending staff: only roles the club's own staff page confirms this season
  const LVL = { NHL: "NHL", AHL: "AHL", ECHL: "ECHL", Org: "Organisation" };
  function staffList(c) {
    const l = (T.staff || {})[c] || [];
    return `<div class="tm-staff"><h4>Goaltending staff</h4>${l.length
      ? `<ul>${l.map((p) => `<li><b>${esc(p.name)}</b><span>${esc(p.title)}<em>${LVL[p.level] || esc(p.level)}</em></span></li>`).join("")}</ul>`
      : `<p class="tm-none">No goaltending staff confirmed on the club's staff page yet</p>`}</div>`;
  }

  // Team defence under the stage (Natural Stat Trick, 5v5, per 60 minutes); lower is better on every measure
  const DF = T.defence || {}, clubs = Object.keys(DF);
  const M = [
    { k: "sa60", h: "Shots against", u: "per 60", w: "fewest", d: 1 },
    { k: "xga60", h: "Expected goals against", u: "per 60", w: "lowest", d: 2 },
    { k: "hdca60", h: "High-danger chances against", u: "per 60", w: "fewest", d: 1 },
    { k: "xgs", h: "Expected goals per shot", u: "shot quality", w: "lowest", d: 3 },
  ];
  clubs.forEach((c) => (DF[c].xgs = DF[c].xga60 / DF[c].sa60));
  const med = (k) => { const v = clubs.map((c) => DF[c][k]).sort((a, b) => a - b), n = v.length; return n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2; };
  const ext = (k) => { const v = clubs.map((c) => DF[c][k]); return [Math.min(...v), Math.max(...v)]; };
  const ord = (n) => n + (n % 100 > 10 && n % 100 < 14 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
  const KIND = {
    ll: ["Shielded", "fewer shots than most clubs allow, and less dangerous ones"],
    hl: ["Kept to the outside", "more shots than most clubs allow, but less dangerous ones"],
    lh: ["Few but dangerous", "fewer shots than most clubs allow, but more dangerous ones"],
    hh: ["Under siege", "more shots than most clubs allow, and more dangerous ones"],
  };
  const kind = (c) => KIND[(DF[c].sa60 > med("sa60") ? "h" : "l") + (DF[c].xgs > med("xgs") ? "h" : "l")];
  function strip(m, c) {
    const [lo, hi] = ext(m.k), W = 300, x = (v) => 8 + (v - lo) / (hi - lo || 1) * (W - 16);
    return `<svg viewBox="0 0 ${W} 26" aria-hidden="true"><line class="tl" x1="8" x2="${W - 8}" y1="13" y2="13"/>
      <line class="md" x1="${x(med(m.k))}" x2="${x(med(m.k))}" y1="4" y2="22"/>
      ${clubs.filter((o) => o !== c).map((o) => `<circle class="o" cx="${x(DF[o][m.k]).toFixed(1)}" cy="13" r="3.4"/>`).join("")}
      <circle class="me" cx="${x(DF[c][m.k]).toFixed(1)}" cy="13" r="7"/></svg>`;
  }
  function scatter(c) {
    const W = 420, H = 310, L = 44, R = 12, Tp = 14, B = 40, pad = (lo, hi, f) => [lo - (hi - lo) * f, hi + (hi - lo) * f];
    const [x0, x1] = pad(...ext("sa60"), 0.08), [y0, y1] = pad(...ext("xgs"), 0.16);   // room for the corner labels
    const px = (v) => L + (v - x0) / (x1 - x0 || 1) * (W - L - R), py = (v) => H - B - (v - y0) / (y1 - y0 || 1) * (H - Tp - B);
    const mx = px(med("sa60")), my = py(med("xgs"));
    const q = (x, y, a, t) => `<text class="q" x="${x}" y="${y}" text-anchor="${a}">${t}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Every club's 5v5 shots against per 60 and expected goals per shot. ${esc(c)} is highlighted.">
      <rect class="fr" x="${L}" y="${Tp}" width="${W - L - R}" height="${H - Tp - B}"/>
      <line class="md" x1="${mx}" x2="${mx}" y1="${Tp}" y2="${H - B}"/><line class="md" x1="${L}" x2="${W - R}" y1="${my}" y2="${my}"/>
      ${q(L + 8, H - B - 8, "start", KIND.ll[0])}${q(W - R - 8, H - B - 8, "end", KIND.hl[0])}${q(L + 8, Tp + 16, "start", KIND.lh[0])}${q(W - R - 8, Tp + 16, "end", KIND.hh[0])}
      ${clubs.filter((o) => o !== c).map((o) => `<g class="o" data-c="${o}"><circle cx="${px(DF[o].sa60).toFixed(1)}" cy="${py(DF[o].xgs).toFixed(1)}" r="4.5"/><text x="${(px(DF[o].sa60) + 7).toFixed(1)}" y="${(py(DF[o].xgs) + 3.5).toFixed(1)}">${o}</text></g>`).join("")}
      <g class="me"><circle cx="${px(DF[c].sa60).toFixed(1)}" cy="${py(DF[c].xgs).toFixed(1)}" r="9"/><text x="${(px(DF[c].sa60) + 13).toFixed(1)}" y="${(py(DF[c].xgs) + 4.5).toFixed(1)}">${c}</text></g>
      <text class="ax" x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle">Shots against per 60 → more</text>
      <text class="ax" transform="translate(13 ${(Tp + H - B) / 2}) rotate(-90)" text-anchor="middle">Expected goals per shot → more dangerous</text></svg>`;
  }
  function defence(c) {
    if (!adv || !DF[c]) { if (adv) adv.hidden = true; return; }
    const k = TEAMS[c], d = DF[c], [kn, kt] = kind(c);
    const rank = (m) => 1 + clubs.filter((o) => DF[o][m.k] < d[m.k]).length;
    adv.hidden = false;
    adv.style.cssText = `--p:${k.primary};--s:${k.secondary};--a:${k.accent}`;
    adv.innerHTML = `<div class="sec-h"><h3>Team defence in front of the goalies</h3><span class="note">${esc(k.name)} · 5v5 · as of ${esc(T.defenceAsOf)} · Data courtesy of <a href="https://www.naturalstattrick.com" target="_blank" rel="noopener noreferrer">Natural Stat Trick</a></span></div>
      <div class="tm-adv-g">
        <div class="panel"><div class="panel-h"><div><h3>Where the club ranks</h3><p>Every club is a dot; the line is the league median. Lower is better on all four.</p></div></div>
          <ul class="tm-strips">${M.map((m) => `<li><div class="tm-sh"><b>${m.h}</b><span>${m.u}</span></div><div class="tm-sv"><strong>${d[m.k].toFixed(m.d)}</strong><span>${ord(rank(m))} ${m.w} of ${clubs.length}</span></div>${strip(m, c)}</li>`).join("")}</ul>
        </div>
        <div class="panel"><div class="panel-h"><div><h3>Defensive support</h3><p>How many shots the goalies face, against how dangerous they are. The dashed lines are the league medians. Click a club to switch.</p></div></div>
          <div class="tm-sc">${scatter(c)}</div>
          <p class="tm-kind"><b>${kn}.</b> At 5v5, the ${esc(k.name)} allow ${kt}.</p>
        </div>
      </div>`;
  }
  adv && adv.addEventListener("click", (e) => { const g = e.target.closest("g.o[data-c]"); if (g && !open) preview(g.dataset.c); else if (g) depth(g.dataset.c); });

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
