/* Rebuild the self-contained preview pages from their templates: each placeholder comment such as SKELETON is replaced by a file's
   contents, so a page opens with no server. Run: node illustrations/build-previews.cjs
   (preview/lightbox.html, the still sheet, is not built from a template.) */
const fs = require("fs"), path = require("path");
const at = (...p) => path.join(__dirname, ...p);
const FILES = { SKELETON: at("goalie-skeleton.js"), STYLES: at("styles.js"), MOTION: at("motion.js"), TEAMS: at("team-colours.json"),
  TYPES: at("..", "goalie-types-data.js"), AUDIT: at("audit", "silhouettes.json") };
for (const name of ["board", "lightbox-motion", "silhouettes", "styles"]) {
  let t = fs.readFileSync(at("preview", `${name}.tpl.html`), "utf8");
  t = t.replace(/\/\*([A-Z]+)\*\//g, (m, k) => (FILES[k] ? fs.readFileSync(FILES[k], "utf8") : m));
  fs.writeFileSync(at("preview", `${name}.html`), t);
  console.log(`preview/${name}.html`);
}
