/* Step 8 reference images for the chosen style, Skeletons: Light Box (styles.js "skeletons-xray").
   Renders every archetype at every size the site and boards use, in both page themes, and compares each picture
   pixel by pixel with the saved reference in golden/. Any change to a pose, the canon, a colour or the style fails
   the test until the references are rebuilt on purpose with --update.
     golden/<type>-<theme>.png   one archetype: sizes 32, 64, 76 and 240 (TOR, number 41), plus plain mode at 120
     golden/teams-<theme>.png    all 32 teams by all 12 archetypes at 64 px (the size of the Archetypes cards)
   A picture passes when at most 0.1% of its pixels differ by more than 8 (sum of R, G and B steps), so even a slight colour shift fails.
   Fonts load from nothing (the network is blocked), so the film label and number use Chromium's fallback sans;
   rebuild on the machine the references were made on, or expect the text to differ.
   Run:     NODE_PATH=$(npm root -g) node illustrations/golden.cjs
   Rebuild: NODE_PATH=$(npm root -g) node illustrations/golden.cjs --update */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const G = require("./goalie-skeleton.js"), S = require("./styles.js");
const TEAMS = require("./team-colours.json").teams;
const draw = S.STYLES["skeletons-xray"].draw, DIR = path.join(__dirname, "golden"), UPDATE = process.argv.includes("--update");
const THEMES = { light: "#f6f6fb", dark: "#11121d" }, SIZES = [32, 64, 76, 240], PX_STEP = 8, MAX_SHARE = 0.001;
const tor = { ...TEAMS.TOR, code: "TOR" };
const cell = (svg, s) => `<div style="width:${s}px;height:${s}px;line-height:0">${svg}</div>`;

// One sheet per archetype and theme, and one teams grid per theme
const sheets = [];
for (const [theme, bg] of Object.entries(THEMES)) {
  for (const k of G.ORDER) sheets.push({ name: `${k}-${theme}`, bg, html: `<div style="display:flex;gap:12px;align-items:flex-end">${
    SIZES.map((s) => cell(draw(k, tor, "41", { size: s }), s)).join("")}${cell(draw(k, tor, "41", { size: 120, plain: true }), 120)}</div>` });
  sheets.push({ name: `teams-${theme}`, bg, html: `<div style="display:grid;grid-template-columns:repeat(${G.ORDER.length},64px);gap:4px">${
    Object.entries(TEAMS).map(([code, t]) => G.ORDER.map((k) => cell(draw(k, { ...t, code }, "1", { size: 64 }), 64)).join("")).join("")}</div>` });
}

(async () => {
  if (UPDATE) fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  await page.route("**/*", (r) => (r.request().url().startsWith("data:") ? r.continue() : r.abort()));
  const results = [];
  for (const s of sheets) {
    await page.setContent(`<!doctype html><body style="margin:0;background:${s.bg}"><div id="s" style="display:inline-block;padding:12px;background:${s.bg}">${s.html}</div></body>`);
    const png = await page.locator("#s").screenshot({ animations: "disabled" }), file = path.join(DIR, `${s.name}.png`);
    if (UPDATE) { fs.writeFileSync(file, png); results.push({ name: s.name, status: "written" }); continue; }
    if (!fs.existsSync(file)) { results.push({ name: s.name, status: "missing" }); continue; }
    // Compare in the page: decode both PNGs onto canvases and count the pixels that moved
    const r = await page.evaluate(async ([a, b, step]) => {
      const load = async (src) => { const i = new Image(); i.src = "data:image/png;base64," + src; await i.decode(); return i; };
      const [A, B] = await Promise.all([load(a), load(b)]);
      if (A.width !== B.width || A.height !== B.height) return { size: [A.width, A.height, B.width, B.height] };
      const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
      const p = px(A), q = px(B); let n = 0;
      for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > step) n++;
      return { share: n / (p.length / 4) };
    }, [fs.readFileSync(file).toString("base64"), png.toString("base64"), PX_STEP]);
    if (r.size) results.push({ name: s.name, status: "size changed", from: r.size.slice(0, 2), to: r.size.slice(2) });
    else results.push({ name: s.name, status: r.share > MAX_SHARE ? "changed" : "ok", differs: `${(r.share * 100).toFixed(3)}%` });
  }
  await browser.close();
  const bad = results.filter((r) => !["ok", "written"].includes(r.status));
  for (const r of results) if (r.status !== "ok" || UPDATE) console.log(r.name, r.status, r.differs || r.from || "", r.to || "");
  console.log(`${results.length} pictures, ${UPDATE ? "references written" : `${results.length - bad.length} match, ${bad.length} differ`}`);
  if (bad.length) { console.log("If the change is meant, rebuild with --update and commit the new golden/ pictures."); process.exit(1); }
})();
