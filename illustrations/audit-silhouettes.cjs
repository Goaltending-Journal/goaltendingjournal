/* Step 2 audit: can every type be told apart by shape alone at the smallest size in the brief?
   Renders each silhouette at SIZE px in Chromium, blurs it (a Gaussian blur of BLUR px, roughly what a
   glance at a phone list gives), thresholds it, and measures the overlap of every pair:
   overlap = shared pixels / pixels in either (intersection over union). Pairs over LIMIT fail.
   Also checks that every bone in every pose keeps its canon length.

     NODE_PATH=$(npm root -g) node illustrations/audit-silhouettes.cjs
     NODE_PATH=$(npm root -g) node illustrations/audit-silhouettes.cjs masks   (the goalie masks, masks.js)

   Needs Playwright with Chromium. Writes illustrations/audit/silhouettes.json. */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const G = require("./goalie-skeleton.js");
const MK = require("./masks.js");
const MASKS = process.argv.includes("masks");

const SIZE = 32, BLUR = 1, LIMIT = 0.85;

function bones() {
  const bad = [];
  for (const k of G.ORDER) {
    const P = G.skeleton(G.POSES[k]);
    for (const [a, b, name] of G.BONES) {
      const len = Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]);
      if (Math.abs(len - G.CANON[name]) > 0.01) bad.push(`${k} ${name} ${len.toFixed(2)} vs ${G.CANON[name]}`);
    }
  }
  return bad;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const ORDER = MASKS ? MK.ORDER : G.ORDER;
  const svgs = Object.fromEntries(ORDER.map((k) => [k, MASKS ? MK.silhouette(k) : G.silhouette(k)]));
  const masks = await page.evaluate(async ({ svgs, SIZE, BLUR }) => {
    const out = {};
    for (const [k, svg] of Object.entries(svgs)) {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = SIZE;
      const x = c.getContext("2d");
      x.filter = `blur(${BLUR}px)`;
      x.drawImage(img, 0, 0, SIZE, SIZE);
      const a = x.getImageData(0, 0, SIZE, SIZE).data;
      const m = [];
      for (let i = 3; i < a.length; i += 4) m.push(a[i] >= 128 ? 1 : 0);
      out[k] = m;
    }
    return out;
  }, { svgs, SIZE, BLUR });
  await browser.close();

  const keys = ORDER, pairs = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = masks[keys[i]], b = masks[keys[j]];
      let both = 0, either = 0;
      for (let p = 0; p < a.length; p++) { both += a[p] & b[p]; either += a[p] | b[p]; }
      pairs.push({ a: keys[i], b: keys[j], overlap: +(both / either).toFixed(3) });
    }
  }
  pairs.sort((x, y) => y.overlap - x.overlap);
  const fails = pairs.filter((p) => p.overlap > LIMIT);
  const boneErrors = MASKS ? [] : bones();
  const result = { size: SIZE, blur: BLUR, limit: LIMIT, worst: pairs.slice(0, 5), fails, boneErrors, pairs };
  fs.mkdirSync(path.join(__dirname, "audit"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "audit", MASKS ? "mask-silhouettes.json" : "silhouettes.json"), JSON.stringify(result, null, 1) + "\n");
  console.log(`Closest pairs at ${SIZE}px, blurred ${BLUR}px (limit ${LIMIT}):`);
  for (const p of pairs.slice(0, 6)) console.log(`  ${p.overlap.toFixed(2)}  ${p.a} / ${p.b}`);
  console.log(fails.length ? `${fails.length} pair(s) over the limit` : "No pair over the limit");
  console.log(boneErrors.length ? `Bone drift: ${boneErrors.join("; ")}` : "Every bone keeps its canon length");
  process.exitCode = fails.length || boneErrors.length ? 1 : 0;
})();
