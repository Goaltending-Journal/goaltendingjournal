// Practice Labs: the lab list, and the page chrome shared by coaching.html and the five lab pages.
// Done marks live only in this browser (localStorage), since the site has no accounts.
const LEARN = [
  { n: 1, href: "coaches-cla.html", theme: "Ecological dynamics", title: "What the constraints-led approach is, and isn't", short: "The constraints-led approach", min: 10, grade: "Borrowed",
    blurb: "Coach the problem, not the movement. Where the idea comes from, what the trials show and what the critics get right.",
    outcome: "Explain the approach to a skeptical coach in two minutes." },
  { n: 2, href: "coaches-constraints.html", theme: "Ecological dynamics", title: "Constraints: individual, task, environment", short: "Three kinds of constraint", min: 7, grade: "Borrowed",
    blurb: "Newell's three levers, and a menu of goalie changes for tracking, lateral plays, depth and rebounds.",
    outcome: "Change one constraint in a drill instead of giving one more cue." },
  { n: 3, href: "coaches-representative.html", theme: "Practice design", title: "Representative practice: reps that look like games", short: "Representative practice", min: 8, grade: "Borrowed",
    blurb: "Why shot volume is not the same as game information, and how to audit a drill against real game shots.",
    outcome: "Score a drill for how game-like it is, and move it one step." },
  { n: 4, href: "coaches-post.html", theme: "Practice design", title: "Designing a session with PoST", short: "Designing a session (PoST)", min: 10, grade: "Practice wisdom",
    blurb: "Otte's stages, two dials and a session sheet, translated for hockey: hip load, starter and backup weeks, and planned feedback.",
    outcome: "Label last week's practice and plan one session on the sheet." },
  { n: 5, href: "coaches-learning.html", theme: "Skill acquisition", title: "Is it working? Learning vs performance", short: "Is it working?", min: 7, grade: "Borrowed",
    blurb: "Why a sharp end-of-drill look proves little, and how to run a cold retention check and keep a simple goalie log.",
    outcome: "Run a retention block next week and log process, not save %." }
];
const LEARN_KEY = "grj-learn-done";
function learnDone() { try { return new Set(JSON.parse(localStorage.getItem(LEARN_KEY) || "[]")); } catch (e) { return new Set(); } }
function learnSave(set) { try { localStorage.setItem(LEARN_KEY, JSON.stringify([...set])); } catch (e) {} }

(function () {
  const $ = (id) => document.getElementById(id);
  const here = Number(document.body.dataset.module || 0);

  // Reading progress bar
  const bar = $("progress");
  if (bar) {
    const onScroll = () => { const max = document.documentElement.scrollHeight - innerHeight; bar.style.width = (max > 0 ? Math.min(1, scrollY / max) * 100 : 0) + "%"; };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  // "On this page": open on wide screens, highlight the section in view
  const toc = $("toc");
  if (toc) {
    const wide = matchMedia("(min-width:1001px)");
    const sync = () => { toc.open = wide.matches; };
    wide.addEventListener("change", sync); sync();
    toc.querySelector("summary").addEventListener("click", (e) => { if (wide.matches) e.preventDefault(); });
    const links = [...toc.querySelectorAll("a")];
    const targets = links.map((a) => document.querySelector(a.getAttribute("href")));
    const mark = () => {
      let i = 0;
      targets.forEach((t, k) => { if (t && t.getBoundingClientRect().top < 140) i = k; });
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) i = targets.length - 1;
      links.forEach((a, k) => a.toggleAttribute("aria-current", k === i));
    };
    addEventListener("scroll", mark, { passive: true }); mark();
  }

  // Path rail: all five modules, with done marks
  function paintRail() {
    const box = $("path-rail");
    if (!box) return;
    const done = learnDone();
    box.innerHTML = `<strong>Practice Labs</strong><ol>` + LEARN.map((m) =>
      `<li><a href="${m.href}"${m.n === here ? ' aria-current="page"' : ""}${done.has(m.n) ? ' class="done"' : ""}><span>${done.has(m.n) ? "✓" : "0" + m.n}</span>${m.short}</a></li>`).join("") + `</ol>`;
  }
  paintRail();

  // Module footer: mark as done, previous and next
  const btn = $("done-btn");
  if (btn && here) {
    const paint = () => {
      const on = learnDone().has(here);
      btn.setAttribute("aria-pressed", on);
      btn.textContent = on ? "✓ Done" : "Mark lab as done";
    };
    btn.addEventListener("click", () => {
      const d = learnDone();
      d.has(here) ? d.delete(here) : d.add(here);
      learnSave(d); paint(); paintRail();
    });
    paint();
  }
  const pn = $("pn");
  if (pn && here) {
    const prev = LEARN[here - 2], next = LEARN[here];
    pn.innerHTML =
      (prev ? `<a href="${prev.href}"><span>‹ Lab ${prev.n}</span><b>${prev.short}</b></a>` : `<a href="briefs.html#labs"><span>‹ Back to</span><b>Practice Labs</b></a>`) +
      (next ? `<a class="nx" href="${next.href}"><span>Lab ${next.n} ›</span><b>${next.short}</b></a>` : `<a class="nx" href="briefs.html#labs"><span>Finished ›</span><b>Back to Practice Labs</b></a>`);
  }
})();

// Practice Lab tools shared by the lab pages; everything saves in this browser only.
(function () {
  const get = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // One-change plan: a cue and a change become one sentence. Optional starters come from window.LAB_STARTS ([cue, change] pairs).
  document.querySelectorAll(".plan-tool[data-key]").forEach((box) => {
    const key = box.dataset.key, cue = box.querySelector(".pl-cue"), chg = box.querySelector(".pl-change"), out = box.querySelector(".plan-out"), list = box.querySelector(".pl-starts");
    const saved = get(key); cue.value = saved.cue || ""; chg.value = saved.change || "";
    const paint = () => {
      const c = cue.value.trim(), g = chg.value.trim();
      put(key, { cue: c, change: g });
      out.innerHTML = c && g ? `Instead of saying <b>“${esc(c.replace(/^["“]|["”]$/g, ""))}”</b>, I will change the drill: <b>${esc(g)}</b>.` : "";
      out.hidden = !(c && g);
    };
    const starts = window.LAB_STARTS || [];
    if (list && starts.length) {
      list.innerHTML = starts.map(([c], i) => `<li><button type="button" data-i="${i}">“${esc(c)}”</button></li>`).join("");
      list.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; [cue.value, chg.value] = starts[b.dataset.i]; paint(); });
    }
    cue.addEventListener("input", paint); chg.addEventListener("input", paint); paint();
  });
  // Check-it notes
  document.querySelectorAll(".notes[data-key]").forEach((box) => {
    const key = box.dataset.key, notes = get(key);
    box.querySelectorAll("textarea").forEach((t) => {
      t.value = notes[t.dataset.k] || "";
      t.addEventListener("input", () => { notes[t.dataset.k] = t.value; put(key, notes); });
    });
  });
  // A link to a section inside "Read the full case" opens the fold first
  const deeper = document.getElementById("deeper");
  if (deeper) {
    const openFor = () => { let t = null; try { t = location.hash && document.querySelector(location.hash); } catch (e) {} if (t && deeper.contains(t)) { deeper.open = true; t.scrollIntoView(); } };
    addEventListener("hashchange", openFor); openFor();
  }
})();
