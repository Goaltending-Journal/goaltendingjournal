/* Step 6 instrument audit for the chosen style, Skeletons: Light Box (styles.js "skeletons-xray"), on all 32 teams.
   Measures, against the budgets in the brief:
     1. separation: gear outline, bone outline and card edge against what they sit on (3:1, every vision type)
     2. labels: the sweater number against its halo, the film label on the box (3:1)
     3. silhouettes: pairwise overlap at 32 px after a 1 px blur (from audit/silhouettes.json; rerun audit-silhouettes.cjs)
     4. loop seam: the jump from a loop's last frame back to its first, against its biggest step between frames
     5. frame: how far the figure and its props reach outside the film (inner frame 4 to 96)
     6. bones: every bone's length in every frame of every loop against its canon length
     7. size and time: compressed still size (6 KB) and frame time at 6x CPU slowdown (8 ms)
   Writes audit/lightbox.json. Run: NODE_PATH=$(npm root -g) node illustrations/audit-lightbox.cjs */
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const { chromium } = require("playwright");
const G = require("./goalie-skeleton.js"), S = require("./styles.js"), MO = require("./motion.js"), GD = require("./colour.js");
const TEAMS = require("./team-colours.json").teams;
const draw = S.STYLES["skeletons-xray"].draw, FPS = 12, BOX = S.XRAY_BOX, r2 = (v) => +v.toFixed(2);
const out = { checked: new Date().toISOString().slice(0, 10), failures: [] };
const fail = (what, detail) => out.failures.push({ what, ...detail });

// 1 and 2: colour pairs, in normal vision and the three simulated colour-vision types
const all = (a, b) => [GD.wcag(a, b), ...Object.values(GD.CVD).map((m) => GD.wcag(GD.simulate(a, m), GD.simulate(b, m)))];
out.colour = {};
for (const [code, t] of Object.entries(TEAMS)) {
  const edge = S.xrayEdge(t.primary), row = { edge, "gear outline/box": r2(Math.min(...all(edge, BOX))), "number/halo": r2(Math.min(...all(edge, "#FFFFFF"))) };
  out.colour[code] = row;
  for (const k of ["gear outline/box", "number/halo"]) if (row[k] < 3) fail(k, { team: code, wcag: row[k] });
}
const fixed = { "bone outline/box": ["#1d3346", BOX], "film label/box": ["#56748a", BOX], "card edge/light page": ["#5d7d95", "#f6f6fb"], "card box/dark page": [BOX, "#11121d"] };
out.fixed = Object.fromEntries(Object.entries(fixed).map(([k, [a, b]]) => [k, r2(Math.min(...all(a, b)))]));
for (const [k, v] of Object.entries(out.fixed)) if (v < 3) fail(k, { wcag: v });

// 3: silhouettes
const sil = require("./audit/silhouettes.json");
out.silhouettes = { worst: sil.worst[0], limit: 0.85 };
if (sil.worst[0].overlap > 0.85) fail("silhouette overlap", sil.worst[0]);

// 6: bones in every frame
const frameKeys = (k) => Array.from({ length: Math.round(MO.loopMs(k) * FPS / 1000) }, (_, i) => i * 1000 / FPS);
let drift = 0;
for (const k of G.ORDER) for (const t of frameKeys(k)) {
  const P = G.skeleton(G.POSES[MO.poseAt(k, t)]);
  for (const [a, b, name] of G.BONES) drift = Math.max(drift, Math.abs(Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) - G.CANON[name]));
}
out.boneDrift = r2(drift);
if (drift > 0.01) fail("bone drift", { units: r2(drift) });

// 7a: compressed size of a still, full cut (240) and light cut (32), largest over types
const team = { ...TEAMS.TOR, code: "TOR" }, gz = (s) => zlib.gzipSync(s).length / 1024;
out.sizeKB = { full: r2(Math.max(...G.ORDER.map((k) => gz(draw(k, team, "41", { size: 240 }))))), lite: r2(Math.max(...G.ORDER.map((k) => gz(draw(k, team, "41", { size: 32 }))))) };
if (out.sizeKB.full > 6) fail("still size", { kb: out.sizeKB.full });

(async () => {
  const browser = await chromium.launch(), page = await browser.newPage();
  // 4 and 5: render every frame of every loop at 120 px; measure the figure's reach and the step between frames
  out.loops = {};
  for (const k of G.ORDER) {
    const top = Math.min(...[0, 1, 2].map((i) => G.parts(MO.keyPose(k, i)).top));
    const svgs = frameKeys(k).map((t) => draw(MO.poseAt(k, t), team, "41", { size: 120, topY: top }));
    const r = await page.evaluate(async (svgs) => {
      const c = document.createElement("canvas"); c.width = c.height = 120; const x = c.getContext("2d", { willReadFrequently: true });
      const px = [], reach = [1e9, 1e9, -1e9, -1e9];
      for (const s of svgs) {
        const d = document.createElement("div"); d.innerHTML = s; document.body.append(d);
        const g = d.querySelector("svg > g[transform]"), b = g.getBBox(), m = g.transform.baseVal.consolidate().matrix;
        reach[0] = Math.min(reach[0], m.a * b.x + m.e); reach[1] = Math.min(reach[1], m.d * b.y + m.f);
        reach[2] = Math.max(reach[2], m.a * (b.x + b.width) + m.e); reach[3] = Math.max(reach[3], m.d * (b.y + b.height) + m.f); d.remove();
        const img = new Image(); img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(s))); await img.decode();
        x.clearRect(0, 0, 120, 120); x.drawImage(img, 0, 0); px.push(x.getImageData(0, 0, 120, 120).data);
      }
      const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; return n / (a.length / 4); };
      const steps = px.slice(1).map((p, i) => diff(px[i], p));
      return { reach, seam: diff(px[px.length - 1], px[0]), maxStep: Math.max(...steps) };
    }, svgs);
    const over = Math.max(4 - r.reach[0], 4 - r.reach[1], r.reach[2] - 96, r.reach[3] - 96, 0);
    out.loops[k] = { frames: svgs.length, seam: r2(r.seam * 100), maxStep: r2(r.maxStep * 100), reach: r.reach.map((v) => r2(v)), outside: r2(over) };
    if (r.seam > r.maxStep + 1e-9) fail("loop seam", { type: k, seam: r2(r.seam * 100), maxStep: r2(r.maxStep * 100) });
    if (over > 0) fail("leaves the film", { type: k, units: r2(over) });
  }
  // 7b: frame time on the motion preview, CPU slowed 6x
  const p2 = await browser.newPage({ viewport: { width: 390, height: 700 } }), cdp = await p2.context().newCDPSession(p2);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await p2.goto("file://" + path.join(__dirname, "preview", "lightbox-motion.html"));
  await p2.evaluate(() => document.querySelector(".live").scrollIntoView({ block: "center" }));
  await p2.waitForTimeout(6000); await p2.evaluate(() => { window.__frameMs = []; }); await p2.waitForTimeout(4000);
  out.frameMs = await p2.evaluate(() => ({ avg: +(__frameMs.reduce((a, b) => a + b, 0) / __frameMs.length).toFixed(2), max: +Math.max(...__frameMs).toFixed(2) }));
  if (out.frameMs.max > 8) fail("frame time", out.frameMs);
  await browser.close();
  fs.writeFileSync(path.join(__dirname, "audit", "lightbox.json"), JSON.stringify(out, null, 1));
  const worst = (k) => Object.entries(out.colour).sort((a, b) => a[1][k] - b[1][k])[0];
  console.log(`Gear outline/box min ${worst("gear outline/box")[1]["gear outline/box"]} (${worst("gear outline/box")[0]}); number/halo min ${worst("number/halo")[1]["number/halo"]} (${worst("number/halo")[0]})`);
  console.log("Fixed pairs", JSON.stringify(out.fixed));
  console.log(`Silhouettes worst ${sil.worst[0].a}/${sil.worst[0].b} ${sil.worst[0].overlap}; bone drift ${out.boneDrift}; size full ${out.sizeKB.full} KB, lite ${out.sizeKB.lite} KB; frame ${JSON.stringify(out.frameMs)}`);
  for (const [k, v] of Object.entries(out.loops)) console.log(`  ${k.padEnd(11)} seam ${v.seam}% maxStep ${v.maxStep}% reach ${v.reach.join(",")} outside ${v.outside}`);
  console.log(out.failures.length ? "FAILURES:\n" + out.failures.map((f) => JSON.stringify(f)).join("\n") : "No failures.");
  process.exitCode = out.failures.length ? 1 : 0;
})();
