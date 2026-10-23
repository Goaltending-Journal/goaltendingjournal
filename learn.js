// Coaches learning path: the module list, and the page chrome shared by coaches.html and the five module pages.
// Done marks live only in this browser (localStorage), since the site has no accounts.
const LEARN = [
  { n: 1, href: "coaches-cla.html", title: "What the constraints-led approach is, and isn't", short: "The constraints-led approach", min: 8, grade: "Borrowed",
    blurb: "Coach the problem, not the movement. Where the idea comes from, what the trials show and what the critics get right.",
    outcome: "Explain the approach to a skeptical coach in two minutes." },
  { n: 2, href: "coaches-constraints.html", title: "Constraints: individual, task, environment", short: "Three kinds of constraint", min: 7, grade: "Borrowed",
    blurb: "Newell's three levers, and a menu of goalie changes for tracking, lateral plays, depth and rebounds.",
    outcome: "Change one constraint in a drill instead of giving one more cue." },
  { n: 3, href: "coaches-representative.html", title: "Representative practice: reps that look like games", short: "Representative practice", min: 8, grade: "Borrowed",
    blurb: "Why shot volume is not the same as game information, and how to audit a drill against real game shots.",
    outcome: "Score a drill for how game-like it is, and move it one step." },
  { n: 4, href: "coaches-post.html", title: "Designing a session with PoST", short: "Designing a session (PoST)", min: 10, grade: "Practice wisdom",
    blurb: "Otte's stages, two dials and a session sheet, translated for hockey: hip load, starter and backup weeks, and planned feedback.",
    outcome: "Label last week's practice and plan one session on the sheet." },
  { n: 5, href: "coaches-learning.html", title: "Is it working? Learning vs performance", short: "Is it working?", min: 7, grade: "Borrowed",
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
    box.innerHTML = `<strong>The path</strong><ol>` + LEARN.map((m) =>
      `<li><a href="${m.href}"${m.n === here ? ' aria-current="page"' : ""}${done.has(m.n) ? ' class="done"' : ""}><span>${done.has(m.n) ? "✓" : "0" + m.n}</span>${m.short}</a></li>`).join("") + `</ol>`;
  }
  paintRail();

  // Module footer: mark as done, previous and next
  const btn = $("done-btn");
  if (btn && here) {
    const paint = () => {
      const on = learnDone().has(here);
      btn.setAttribute("aria-pressed", on);
      btn.textContent = on ? "✓ Done" : "Mark module as done";
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
      (prev ? `<a href="${prev.href}"><span>‹ Module ${prev.n}</span><b>${prev.short}</b></a>` : `<a href="coaches.html"><span>‹ Back to</span><b>The learning path</b></a>`) +
      (next ? `<a class="nx" href="${next.href}"><span>Module ${next.n} ›</span><b>${next.short}</b></a>` : `<a class="nx" href="coaches.html#apply"><span>Finished ›</span><b>Apply it in a brief</b></a>`);
  }
})();
