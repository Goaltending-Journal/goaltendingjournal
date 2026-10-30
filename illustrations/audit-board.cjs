/* Step 7 board test: at phone, tablet and desktop widths, every goalie on preview/board.html (figure, name plate and
   stat plate together) must stay inside its own cell, no two cells may overlap, no plate may be cut off, and the
   page must not scroll sideways. Writes audit/board.json. Run: NODE_PATH=$(npm root -g) node illustrations/audit-board.cjs */
const fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const WIDTHS = { phone: 390, tablet: 820, desktop: 1280 };
(async () => {
  const browser = await chromium.launch(), out = { checked: new Date().toISOString().slice(0, 10), widths: {}, failures: [] };
  for (const [name, w] of Object.entries(WIDTHS)) {
    for (const scheme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme });
      await page.goto("file://" + path.join(__dirname, "preview", "board.html"));
      const r = await page.evaluate(() => {
        const R = (el) => el.getBoundingClientRect(), bad = [];
        const cells = [...document.querySelectorAll(".subject")].map((c) => {
          const box = R(c), parts = [c.querySelector("svg"), c.querySelector(".name"), c.querySelector(".stat")];
          // The union of the figure and its plates, which must sit inside the cell
          const u = parts.map(R).reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }));
          const who = c.querySelector(".name").textContent;
          if (u.left < box.left - 0.5 || u.right > box.right + 0.5 || u.top < box.top - 0.5 || u.bottom > box.bottom + 0.5) bad.push(`${who}: plate or figure outside its cell`);
          for (const el of parts.slice(1)) if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) bad.push(`${who}: plate cut off`);
          return { who, u };
        });
        for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i].u, b = cells[j].u;
          if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) bad.push(`${cells[i].who} overlaps ${cells[j].who}`);
        }
        const hscroll = document.documentElement.scrollWidth - innerWidth;
        if (hscroll > 0) bad.push(`page scrolls sideways by ${hscroll}px`);
        return { subjects: cells.length, bad };
      });
      out.widths[`${name} ${w} ${scheme}`] = { subjects: r.subjects, problems: r.bad.length };
      out.failures.push(...r.bad.map((b) => `${name} ${scheme}: ${b}`));
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, "audit", "board.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.widths));
  console.log(out.failures.length ? out.failures.join("\n") : "No overlaps, clipping or sideways scroll.");
  process.exitCode = out.failures.length ? 1 : 0;
})();
