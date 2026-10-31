/* Impact GSAx on goalies.html: goals saved above expected for each goalie, split by game situation (penalty kill,
   close late, close early, two-goal game, blowout), as a diverging heatmap next to plain GSAx and the Impact GSAx total.
   A value stat (which saves mattered), not a better skill rating. Data: impact-data.js, rebuilt each morning by
   build_impact.py from the NHL play-by-play feed. Reuses the page's $, esc, store, byId, openGoalie, showTip, hideTip,
   mix, lum and the --z-* heat-map tokens (zPalette, ZDIV). */
(function impact() {
  const D = window.IMPACT, sec = $("#impSec");
  if (!D || !D.goalies?.length) { sec.hidden = true; return; }
  const SHORT = { pk: "Penalty kill", late: "Close, late", early: "Close, early", two: "Two-goal game", blowout: "Blowout" };
  const CELL_MAX = 4;                  // goals saved above expected at which a cell reaches full colour
  const st = { min: store.get("imp:min", 100), sort: store.get("imp:sort", "impact") };
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(1);
  const fill = (d) => d >= 0 ? mix(ZDIV.mid, ZDIV.good, Math.min(1, d / CELL_MAX)) : mix(ZDIV.mid, ZDIV.bad, Math.min(1, -d / CELL_MAX));
  const ink = (bg) => lum(bg) > 0.35 ? "#1b1d2e" : "#f4f5fb";
  const maxShots = Math.max(...D.goalies.map((g) => g[3]));
  $("#impMin").max = Math.ceil(maxShots / 50) * 50; $("#impMin").value = st.min; $("#impMinV").textContent = st.min;
  $("#impNote").textContent = `${D.season} · ${D.games} games · to ${D.asOf}`;

  function render() {
    zPalette();
    const rows = D.goalies.filter((g) => g[3] >= st.min).sort((a, b) => st.sort === "gsax" ? b[5] - a[5] : b[6] - a[6]);
    $("#impSort").innerHTML = [["impact", "Impact GSAx"], ["gsax", "GSAx"]].map(([k, t]) => `<button type="button" data-v="${k}" aria-pressed="${k === st.sort}">${t}</button>`).join("");
    $("#impTbl thead").innerHTML = `<tr><th class="l" scope="col">Goalie</th>${D.situations.map(([k, n]) => `<th scope="col" title="${esc(n)}">${SHORT[k] || esc(n)}</th>`).join("")}<th scope="col" class="tot">GSAx</th><th scope="col" class="tot">Impact GSAx</th></tr>`;
    $("#impTbl tbody").innerHTML = rows.length ? rows.map((g) => {
      const [id, name, team, , , gsax, imp, cells] = g, known = byId.has(id);
      const who = known ? `<button type="button" class="imp-who" data-id="${id}">${esc(name)}</button>` : esc(name);
      return `<tr><th class="l" scope="row">${who}<small>${esc(team)}</small></th>${cells.map(([s, ga, xg], i) => {
        const d = xg - ga, bg = s ? fill(d) : "transparent";
        return `<td class="cell" data-g="${id}" data-i="${i}" style="background:${bg};color:${s ? ink(bg) : "var(--mute)"}">${s ? signed(d) : "–"}</td>`;
      }).join("")}<td class="tot">${signed(gsax)}</td><td class="tot imp">${signed(imp)}</td></tr>`;
    }).join("") : `<tr><td colspan="${D.situations.length + 3}" class="l">No goalie has faced ${st.min} shots yet. Lower the minimum.</td></tr>`;
    $("#impCount").textContent = `${rows.length} of ${D.goalies.length} goalies`;
    $("#impKey").innerHTML = `<span>Below expected</span><i style="background:linear-gradient(90deg,${ZDIV.bad},${ZDIV.mid},${ZDIV.good})"></i><span>Above expected</span>`;
  }

  $("#impSort").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st.sort = b.dataset.v; store.set("imp:sort", st.sort); render(); });
  $("#impMin").addEventListener("input", (e) => { st.min = +e.target.value; $("#impMinV").textContent = st.min; store.set("imp:min", st.min); render(); });
  const tbl = $("#impTbl");
  tbl.addEventListener("click", (e) => { const b = e.target.closest(".imp-who"); if (b) openGoalie(+b.dataset.id); });
  tbl.addEventListener("pointermove", (e) => {
    const td = e.target.closest("td.cell"); if (!td) return hideTip();
    const g = D.goalies.find((r) => r[0] === +td.dataset.g), [s, ga, xg] = g[7][+td.dataset.i];
    showTip(e, `<b>${esc(g[1])}</b>${esc(D.situations[+td.dataset.i][1])}<br>${s} shots · ${ga} goals · ${xg.toFixed(1)} expected<br>${signed(xg - ga)} saved above expected`);
  });
  tbl.addEventListener("pointerleave", hideTip);
  addEventListener("themechange", render);
  render();
})();
