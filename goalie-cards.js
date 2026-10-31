/* Goalie Cards: a coach earns one card for each Coach Brief or Coaching Module they apply, by writing short answers to
   its three "Try it this week" questions, and files it in any empty slot of the 2026-27 Collection Binder. A "Check it"
   note logged 7+ days later turns the card's finish to foil. Everything stays in this browser (localStorage keys
   grj-cards and grj-reflect); nothing is sent anywhere, and the site never grades the answers.
   Data: goalie-cards-data.js (build_goalie_cards.py). Art: the Light Box skeletons (illustrations/styles.js) drawn in
   GRJ colours with no sweater number. Pages: a section marked data-reflect gets the answer form; an element with
   id="binder" gets the binder (Coaches page). Spec: "Goalie Cards: design spec", Goldy's picks of 31 Oct 2026. */
(function () {
  const D = window.GOALIE_CARDS;
  if (!D) return;
  const KEY = "grj-cards", RKEY = "grj-reflect", MIN_CHARS = 20, CHECK_DAYS = 7;
  const GRJ = { name: "GRJ", primary: "#9A7420", secondary: "#FFFFFF", accent: "#E2B955", code: D.edition };
  const content = Object.fromEntries(D.content.map((c) => [c.src, c]));
  const slotOf = new Map(D.slots.map((s) => [s.slot, s]));
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const surname = (n) => n.split(" ").slice(1).join(" ") || n;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- storage ----------
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const binder = () => { const b = read(KEY, null); return b && b.v === 1 && Array.isArray(b.cards) ? b : { v: 1, edition: D.edition, cards: [] }; };
  const reflections = () => read(RKEY, {});
  const cardFor = (src) => binder().cards.find((c) => c.src === src);
  function putCard(card) { const b = binder(); b.cards = b.cards.filter((c) => c.src !== card.src).concat(card); write(KEY, b); }

  // ---------- dates ----------
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const dayNum = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5;
  const addDays = (iso, n) => new Date((dayNum(iso) + n) * 864e5).toISOString().slice(0, 10);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const nice = (iso, year = true) => iso ? `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}${year ? " " + iso.slice(0, 4) : ""}` : "";

  // ---------- the card ----------
  const art = {};
  function drawArt(pose) {
    if (art[pose]) return art[pose];
    const ST = window.GoalieStyles;
    if (!ST) return "";
    let svg = ST.STYLES["skeletons-xray"].draw(pose, GRJ, "", { size: 240, label: "" });
    svg = svg.replace(/<text[^>]*>\s*<\/text>/g, "");                  // the empty sweater-number slot
    return (art[pose] = svg);
  }
  const fmtSv = (v) => v == null ? "–" : v.toFixed(3).replace(/^0/, "");
  const fmtGaa = (v) => v == null ? "–" : v.toFixed(2);
  const label = (s, c) => c
    ? `${s.name}, ${s.team}, card earned ${nice(c.earned, false)} from ${content[c.src]?.title || "a brief"}${c.tier === "checked" ? ", foil" : ""}`
    : `${s.name}, ${s.team}, empty slot`;

  // An earned card: a front (who) and a back (what the coach learned), flipped by tapping or Enter, Escape flips back
  function cardHTML(c) {
    const s = slotOf.get(c.slot) || { name: c.name, team: c.team, catches: "" }, it = content[c.src] || {}, st = c.stat || {};
    return `<div class="gc${c.tier === "checked" ? " foil" : ""}" data-slot="${esc(c.slot)}">
      <div class="gc-in">
        <button type="button" class="gc-front" aria-label="${esc(label(s, c))}. Show the back">
          <span class="gc-top"><span>${esc(D.edition)}</span><span>${c.tier === "checked" ? "Checked" : "Applied"}</span></span>
          <span class="gc-art" aria-hidden="true">${drawArt(c.pose || "streaky")}</span>
          <span class="gc-name">${esc(s.name)}</span>
          <span class="gc-meta">${esc(c.team || s.team)}${s.catches ? " · Catches " + esc(s.catches) : ""}</span>
        </button>
        <div class="gc-back" inert>
          <div class="gc-learn"><span class="gc-lbl">What you learned</span>${it.grade ? `<span class="gc-grade">${esc(it.grade)}</span>` : ""}</div>
          <p class="gc-take">${esc(it.takeaway || "")}</p>
          <p class="gc-stat"><span>GP <b>${st.gp ?? "–"}</b></span><span>SV% <b>${fmtSv(st.svp)}</b></span><span>GAA <b>${fmtGaa(st.gaa)}</b></span><small>NHL stats feed, as of ${esc(nice(st.asOf))}</small></p>
          <p class="gc-foot">Earned ${esc(nice(c.earned))} · ${c.tier === "checked" ? "Checked " + esc(nice(c.checked)) : "Applied"}<br><a href="${esc(it.href || "#")}">${esc(it.title || "")}</a></p>
          <button type="button" class="gc-flip" aria-label="Show the front of ${esc(s.name)}'s card">↺</button>
        </div>
      </div>
    </div>`;
  }
  const emptyHTML = (s) => `<button type="button" class="gc-empty" data-slot="${esc(s.slot)}" aria-label="${esc(label(s))}"><span class="gc-sur">${esc(surname(s.name))}</span><span class="gc-meta">${esc(s.team)}</span></button>`;

  function flip(card, on) {
    on = on ?? !card.classList.contains("flipped");
    card.classList.toggle("flipped", on);
    card.querySelector(".gc-back").inert = !on;
    card.querySelector(".gc-front").inert = on;
    (on ? card.querySelector(".gc-flip") : card.querySelector(".gc-front")).focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".gc");
    if (!card || e.target.closest("a")) return;
    if (e.target.closest(".gc-front, .gc-flip") || (card.classList.contains("flipped") && e.target.closest(".gc-back"))) flip(card);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const card = e.target.closest?.(".gc.flipped");
    if (card) { e.preventDefault(); e.stopPropagation(); flip(card, false); }
  }, true);

  // ---------- filing a card ----------
  let sheet;
  function openSheet(src, onDone) {
    sheet?.remove();
    sheet = document.createElement("dialog");
    sheet.className = "gc-sheet";
    sheet.setAttribute("aria-labelledby", "gc-sheet-h");
    const teams = D.divisions.map((d) => `<optgroup label="${d}">${[...new Set(D.slots.filter((s) => s.division === d).map((s) => s.team))].map((t) => `<option>${t}</option>`).join("")}</optgroup>`).join("");
    sheet.innerHTML = `<div class="gc-sheet-in">
      <div class="gc-sheet-h"><h2 id="gc-sheet-h">File this card</h2><button type="button" class="gc-x" aria-label="Close">×</button></div>
      <div class="gc-pick">
        <p>You applied <b>${esc(content[src]?.title || "")}</b>. Pick any empty slot in your ${esc(D.edition)} binder for the card. The choice is final.</p>
        <label class="gc-field">Team <select><option value="">All teams</option>${teams}</select></label>
        <div class="gc-slots" role="list"></div>
      </div>
    </div>`;
    document.body.append(sheet);
    const list = sheet.querySelector(".gc-slots"), sel = sheet.querySelector("select");
    const paint = () => {
      const taken = new Set(binder().cards.map((c) => c.slot));
      const open = D.slots.filter((s) => !taken.has(s.slot) && (!sel.value || s.team === sel.value));
      list.innerHTML = open.length ? open.map((s) => `<div role="listitem">${emptyHTML(s)}</div>`).join("") : `<p class="gc-none">No empty slots${sel.value ? " for " + sel.value : ""}.</p>`;
    };
    sel.addEventListener("change", paint); paint();
    list.addEventListener("click", (e) => {
      const b = e.target.closest(".gc-empty"); if (!b) return;
      const s = slotOf.get(b.dataset.slot), c = cardFor(src);
      if (!c || c.slot) return;
      Object.assign(c, { slot: s.slot, team: s.team, name: s.name, pose: s.pose, stat: { gp: s.gp, svp: s.svp, gaa: s.gaa, asOf: D.asOf } });
      putCard(c);
      const pick = sheet.querySelector(".gc-pick"), r = reflections()[src] || {};
      pick.outerHTML = `<div class="gc-filed">${cardHTML(c)}
        <div class="gc-after"><p><b>${esc(s.name)}</b> is in your binder. Tap the card to turn it over.</p>
          <fieldset class="gc-ran"><legend>Did you run this in practice yet?</legend>${["Yes", "Planned", "Not yet"].map((t) => `<button type="button" class="gc-btn" aria-pressed="${r.ran === t}">${t}</button>`).join("")}</fieldset>
          <p class="gc-actions"><a class="gc-btn primary" href="coaches.html#binder">Open the binder</a><button type="button" class="gc-btn gc-done">Done</button></p></div></div>`;
      const card = sheet.querySelector(".gc");
      if (!still) setTimeout(() => flip(card, true), 700); else flip(card, true);
      sheet.querySelector(".gc-ran").addEventListener("click", (e) => {
        const t = e.target.closest("button"); if (!t) return;
        const all = reflections(); all[src] = { ...(all[src] || {}), ran: t.textContent }; write(RKEY, all);
        t.parentNode.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === t));
      });
      sheet.querySelector(".gc-done").addEventListener("click", () => sheet.close());
      onDone?.();
    });
    sheet.querySelector(".gc-x").addEventListener("click", () => sheet.close());
    sheet.addEventListener("close", () => { sheet.remove(); onDone?.(); });
    sheet.showModal();
  }

  // ---------- the answer form, at the end of a brief or module ----------
  const host = document.querySelector("[data-reflect]");
  const page = location.pathname.split("/").pop() || "index.html";
  const item = host && D.content.find((c) => c.href === page);
  if (item) {
    const box = document.createElement("form");
    box.className = "gc-reflect";
    box.noValidate = true;
    host.append(box);
    const paintForm = () => {
      const r = reflections()[item.src] || {}, c = cardFor(item.src), opensOn = c && addDays(c.earned, CHECK_DAYS);
      const canCheck = c && !c.checked && dayNum(today()) >= dayNum(opensOn);
      box.innerHTML = `<h3>Your answers</h3><p class="gc-note">Saved in this browser only. Nobody else sees them, and nothing is graded.</p>
        ${item.questions.map((q, i) => `<label class="gc-q"><span>${esc(q)}</span><textarea rows="2" name="a${i}">${esc((r.answers || [])[i] || "")}</textarea></label>`).join("")}
        <p class="gc-row"><button type="submit" class="gc-btn primary">Save answers</button><span class="gc-msg" role="status"></span></p>
        ${c ? `<div class="gc-status">${c.slot
          ? `<span>Your card: <b>${esc(slotOf.get(c.slot)?.name || c.name || "")}</b>${c.tier === "checked" ? ", foil" : ""}.</span> <a href="coaches.html#binder">See it in your binder</a>`
          : `<span>You have a card to file.</span> <button type="button" class="gc-btn gc-file">File it</button>`}</div>` : ""}
        ${canCheck ? `<label class="gc-q gc-check"><span>Check it: a week on, what did the cold check show?</span><textarea rows="2" name="check">${esc(r.check || "")}</textarea></label>
          <p class="gc-row"><button type="button" class="gc-btn gc-log">Log the check</button><span class="gc-msg2" role="status"></span></p>`
          : c && !c.checked ? `<p class="gc-note">Check it opens on ${esc(nice(opensOn))}, a week after you applied it.</p>` : ""}`;
      box.querySelector(".gc-file")?.addEventListener("click", () => openSheet(item.src, paintForm));
      box.querySelector(".gc-log")?.addEventListener("click", () => {
        const v = box.querySelector("[name=check]").value.trim(), msg = box.querySelector(".gc-msg2");
        if (v.length < MIN_CHARS) { msg.textContent = "Write a line about what you saw (about 20 characters)."; return; }
        const all = reflections(); all[item.src] = { ...(all[item.src] || {}), check: v, checkedOn: today() }; write(RKEY, all);
        const card = cardFor(item.src); Object.assign(card, { tier: "checked", checked: today() }); putCard(card);
        paintForm(); box.querySelector(".gc-status")?.insertAdjacentHTML("beforeend", " <span>Logged: the card now has a foil finish.</span>");
      });
    };
    box.addEventListener("submit", (e) => {
      e.preventDefault();
      const answers = item.questions.map((_, i) => box.querySelector(`[name=a${i}]`).value.trim());
      const msg = box.querySelector(".gc-msg");
      if (answers.some((a) => a.length < MIN_CHARS)) { msg.textContent = "Write a line for each question (about 20 characters)."; return; }
      const all = reflections(), first = !cardFor(item.src);
      all[item.src] = { ...(all[item.src] || {}), answers, appliedOn: all[item.src]?.appliedOn || today() };
      if (!write(RKEY, all)) { msg.textContent = "This browser isn't saving site data, so your answers can't be kept."; return; }
      if (first) {
        putCard({ src: item.src, slot: null, tier: "applied", earned: today(), checked: null, team: null, name: null, pose: null, stat: null });
        paintForm(); openSheet(item.src, paintForm);
      } else { paintForm(); box.querySelector(".gc-msg").textContent = "Saved."; }
    });
    paintForm();
  }

  // ---------- the binder (Coaches page) ----------
  const B = document.getElementById("binder");
  if (!B) return;
  let division = D.divisions[0];
  B.innerHTML = `<p class="gc-progress" id="gc-progress"></p>
    <div id="gc-todo"></div>
    <h3 class="gc-h">Your cards</h3><div class="gc-mine" id="gc-mine"></div>
    <div class="gc-divs"><h3 class="gc-h">The binder</h3><div class="gc-seg" role="group" aria-label="Division">${D.divisions.map((d) => `<button type="button" data-d="${d}">${d}</button>`).join("")}</div></div>
    <div id="gc-teams"></div>
    <details class="gc-tools"><summary>Save or move your binder</summary>
      <p class="gc-note">Your binder lives in this browser. Clearing site data erases it unless you save a copy.</p>
      <label class="gc-tick"><input type="checkbox" id="gc-with"> Include my answers</label>
      <p class="gc-row"><button type="button" class="gc-btn" id="gc-copy">Copy binder code</button><button type="button" class="gc-btn" id="gc-dl">Download binder file</button><span class="gc-msg" role="status" id="gc-out-msg"></span></p>
      <label class="gc-q"><span>Load a binder: paste a code, or open a binder file</span><textarea rows="2" id="gc-code" spellcheck="false"></textarea></label>
      <p class="gc-row"><button type="button" class="gc-btn" id="gc-load">Load code</button><label class="gc-btn gc-filebtn">Open file<input type="file" id="gc-file" accept=".json,application/json"></label><span class="gc-msg" role="status" id="gc-in-msg"></span></p>
      <p class="gc-row gc-reset"><label class="gc-tick"><input type="checkbox" id="gc-also"> Also clear my answers</label><button type="button" class="gc-btn danger" id="gc-empty">Empty binder</button></p>
    </details>`;

  function paintBinder() {
    const b = binder(), bySlot = new Map(b.cards.filter((c) => c.slot).map((c) => [c.slot, c]));
    const filed = bySlot.size, all = D.slots.length;
    B.classList.toggle("complete", filed >= all);
    B.querySelector("#gc-progress").innerHTML = filed >= all ? `<b>Complete</b> · ${D.edition} Edition` : `${filed} of ${all} filed · ${D.edition} Edition`;
    const todo = b.cards.filter((c) => !c.slot);
    B.querySelector("#gc-todo").innerHTML = todo.map((c) => `<p class="gc-status"><span>A card from <b>${esc(content[c.src]?.title || "")}</b> is waiting to be filed.</span> <button type="button" class="gc-btn" data-file="${esc(c.src)}">File it</button></p>`).join("");
    const mine = b.cards.filter((c) => c.slot).sort((x, y) => (y.earned || "").localeCompare(x.earned || ""));
    B.querySelector("#gc-mine").innerHTML = mine.length ? mine.map(cardHTML).join("")
      : `<p class="gc-note">No cards yet. Cards arrive when you answer the three questions at the end of a module or brief.</p>`;
    B.querySelectorAll(".gc-seg button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.d === division));
    const teams = [...new Set(D.slots.filter((s) => s.division === division).map((s) => s.team))];
    B.querySelector("#gc-teams").innerHTML = teams.map((t) => {
      const ss = D.slots.filter((s) => s.team === t), full = ss.every((s) => bySlot.has(s.slot));
      return `<section class="gc-team${full ? " full" : ""}" aria-label="${t}"><h4>${t}<span>${ss.filter((s) => bySlot.has(s.slot)).length} of ${ss.length}</span></h4>
        <div class="gc-row-cards">${ss.map((s) => bySlot.has(s.slot) ? cardHTML(bySlot.get(s.slot)) : emptyHTML(s)).join("")}</div></section>`;
    }).join("");
  }
  B.addEventListener("click", (e) => {
    const d = e.target.closest(".gc-seg button"); if (d) { division = d.dataset.d; paintBinder(); return; }
    const f = e.target.closest("[data-file]"); if (f) { openSheet(f.dataset.file, paintBinder); return; }
    const empty = e.target.closest(".gc-empty");
    if (empty) {
      const waiting = binder().cards.find((c) => !c.slot);
      if (waiting) openSheet(waiting.src, paintBinder);
      else { const m = B.querySelector("#gc-todo"); m.innerHTML = `<p class="gc-status" role="status">To fill ${esc(slotOf.get(empty.dataset.slot).name)}'s slot, answer the three questions at the end of any module or brief.</p>`; }
    }
  });

  // Moving devices: GRJ1. + base64url(JSON), or the same JSON as a file. Answers only if the coach ticks the box.
  const pack = () => { const o = { ...binder() }; if (B.querySelector("#gc-with").checked) o.reflect = reflections(); return o; };
  const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
  const outMsg = (t) => { B.querySelector("#gc-out-msg").textContent = t; }, inMsg = (t) => { B.querySelector("#gc-in-msg").textContent = t; };
  B.querySelector("#gc-copy").addEventListener("click", async () => {
    const code = "GRJ1." + b64(JSON.stringify(pack()));
    try { await navigator.clipboard.writeText(code); outMsg("Code copied."); }
    catch (e) { const t = B.querySelector("#gc-code"); t.value = code; t.select(); outMsg("Copy the code from the box below."); }
  });
  B.querySelector("#gc-dl").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(pack(), null, 1)], { type: "application/json" }));
    a.download = `grj-binder-${D.edition}-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    outMsg("File saved.");
  });
  function load(o) {
    const ok = o && o.v === 1 && Array.isArray(o.cards) && o.cards.every((c) => c && typeof c.src === "string");
    if (!ok) { inMsg("That isn't a binder code or file."); return; }
    if (binder().cards.length && !confirm("Replace the cards in this browser with the loaded binder?")) return;
    const seen = new Set();
    const cards = o.cards.filter((c) => content[c.src] && !seen.has(c.src) && seen.add(c.src));
    write(KEY, { v: 1, edition: o.edition || D.edition, cards });
    if (o.reflect && typeof o.reflect === "object") write(RKEY, { ...reflections(), ...o.reflect });
    inMsg(`Loaded ${cards.length} card${cards.length === 1 ? "" : "s"}.`); paintBinder();
  }
  B.querySelector("#gc-load").addEventListener("click", () => {
    const v = B.querySelector("#gc-code").value.trim();
    try { load(JSON.parse(v.startsWith("GRJ1.") ? unb64(v.slice(5)) : v)); } catch (e) { inMsg("That isn't a binder code or file."); }
  });
  B.querySelector("#gc-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { load(JSON.parse(await f.text())); } catch (err) { inMsg("That isn't a binder code or file."); }
    e.target.value = "";
  });
  B.querySelector("#gc-empty").addEventListener("click", () => {
    const also = B.querySelector("#gc-also").checked;
    if (!confirm("Empty your binder? Every card in this browser will be removed.")) return;
    if (!confirm(also ? "Are you sure? Your cards and your answers will be deleted and can't be brought back." : "Are you sure? Your cards will be deleted and can't be brought back. Your answers stay.")) return;
    write(KEY, { v: 1, edition: D.edition, cards: [] }); if (also) write(RKEY, {});
    inMsg("Binder emptied."); paintBinder();
  });
  addEventListener("storage", (e) => { if (e.key === KEY) paintBinder(); });
  paintBinder();
})();
