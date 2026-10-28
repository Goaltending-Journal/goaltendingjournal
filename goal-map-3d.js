/* 3D view of the Scoring Heat Map on goalies.html, drawn with three.js (loaded from jsDelivr when the 3D view is shown).
   Same data and filters as the flat map: each hexagon becomes a column whose height follows its goals (or shots),
   and each goal is a puck resting on top of the column it was shot from. Drag to orbit, scroll or pinch to zoom.
   Units are feet, in the flat map's coordinates: x across the ice (0-85), y down from the end boards,
   goal line at y=11, blue line at y=75. In 3D, X = x - 42.5, Z = y - 40, Y is up. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const CX = 42.5, CZ = 40;                       // map point that sits at the scene origin
const P = (x, y, h = 0) => new THREE.Vector3(x - CX, h, y - CZ);
const NET = P(42.5, 10);                        // centre of the goal mouth
const MAX_H = 12;                               // tallest column, in feet
const PUCK_R = 0.6, PUCK_H = 0.35;              // drawn bigger than a real puck so it reads from the point
export const VIEWS = [
  ["point", "From the point", P(42.5, 92, 26), P(42.5, 34, 0)],
  ["over", "Overhead", P(42.5, 38.5, 112), P(42.5, 38, 0)],
  ["goalie", "Goalie's eye", P(42.5, 1, 22), P(42.5, 46, 0)],
];

// Rink outline, same path as the flat map: straight sides, 28 ft corners, open at the blue line.
function rinkShape() {
  const s = new THREE.Shape();
  s.moveTo(0 - CX, 75 - CZ); s.lineTo(0 - CX, 28 - CZ);
  s.absarc(28 - CX, 28 - CZ, 28, Math.PI, 1.5 * Math.PI, false);
  s.lineTo(57 - CX, 0 - CZ);
  s.absarc(57 - CX, 28 - CZ, 28, 1.5 * Math.PI, 2 * Math.PI, false);
  s.lineTo(85 - CX, 75 - CZ); s.lineTo(0 - CX, 75 - CZ);
  return s;
}
const flatLine = (pts, mat, h = 0.03) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x, y]) => P(x, y, h))), mat);
// is a flat-map point on the ice? (keeps hex columns from spilling over the boards)
const onIce = (x, y) => x >= 0 && x <= 85 && y >= 0 && y <= 75 &&
  !(y < 28 && (x < 28 ? Math.hypot(x - 28, y - 28) > 28 : x > 57 && Math.hypot(x - 57, y - 28) > 28));
const arc = (cx, cy, r, a0, a1, n = 48) => [...Array(n + 1)].map((_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

export function create(host, api) {
  const cs = () => getComputedStyle(document.documentElement);
  const tok = (n) => cs().getPropertyValue(n).trim();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  host.appendChild(renderer.domElement);
  renderer.domElement.className = "gm3d-canvas";
  renderer.domElement.setAttribute("role", "img");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 600);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.minDistance = 6; controls.maxDistance = 170;
  controls.maxPolarAngle = Math.PI * 0.49;     // stay above the ice
  controls.screenSpacePanning = false;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-30, 70, 40);
  scene.add(hemi, sun);

  // Static rink: ice, boards, lines, crease and net. Rebuilt only when the theme changes.
  const rink = new THREE.Group(); scene.add(rink);
  function buildRink() {
    rink.clear();
    const ice = tok("--ice"), line = tok("--line"), chalk = tok("--chalk"), crease = tok("--crease"), bad = tok("--bad");
    scene.background = new THREE.Color(tok("--boards"));
    // shapes are drawn in x/y; rotating +90° about X lays them flat with shape y -> scene +z
    const iceMesh = new THREE.Mesh(new THREE.ShapeGeometry(rinkShape(), 48), new THREE.MeshStandardMaterial({ color: ice, roughness: 0.35, metalness: 0, side: THREE.DoubleSide }));
    iceMesh.rotation.x = Math.PI / 2; rink.add(iceMesh);
    const boards = new THREE.Mesh(new THREE.ExtrudeGeometry(rinkShape(), { depth: 3.5, bevelEnabled: false, curveSegments: 48 }),
      new THREE.MeshStandardMaterial({ color: line, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    boards.rotation.x = Math.PI / 2; boards.position.y = 3.5; rink.add(boards);
    const mk = new THREE.LineBasicMaterial({ color: chalk, transparent: true, opacity: 0.28 });
    const outline = rinkShape().getPoints(64).map((v) => [v.x + CX, v.y + CZ]);
    rink.add(flatLine(outline, mk, 3.5));
    rink.add(flatLine([[0, 11], [85, 11]], new THREE.LineBasicMaterial({ color: bad, transparent: true, opacity: 0.6 })));
    rink.add(flatLine([[0, 75], [85, 75]], new THREE.LineBasicMaterial({ color: crease })));
    rink.add(flatLine(arc(20.5, 31, 15, 0, 2 * Math.PI), mk), flatLine(arc(64.5, 31, 15, 0, 2 * Math.PI), mk));
    const creaseFill = new THREE.Mesh(new THREE.CircleGeometry(6, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: crease, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    creaseFill.rotation.x = Math.PI / 2; creaseFill.position.copy(P(42.5, 11, 0.02)); rink.add(creaseFill);
    // Net: posts and crossbar in red, mesh as faint lines. Mouth 6 ft wide, 4 ft high, 3.3 ft deep.
    const post = new THREE.MeshStandardMaterial({ color: bad, roughness: 0.4 });
    const tube = (a, b) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, d.length(), 10), post); m.position.copy(a).add(d.multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m; };
    const L0 = P(39.5, 11, 0), R0 = P(45.5, 11, 0), L1 = P(39.5, 11, 4), R1 = P(45.5, 11, 4);
    rink.add(tube(L0, L1), tube(R0, R1), tube(L1, R1));
    const back = new THREE.LineBasicMaterial({ color: chalk, transparent: true, opacity: 0.35 });
    const b = [P(39.5, 7.7, 0), P(45.5, 7.7, 0), P(39.5, 7.7, 2.2), P(45.5, 7.7, 2.2)];
    const seg = (pts) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), back);
    rink.add(seg([L1, b[2], R1, b[3], b[2], b[3], b[2], b[0], b[3], b[1], b[0], b[1], L0, b[0], R0, b[1]]));
  }

  // Data layers: one InstancedMesh for the hex columns and one for the pucks.
  let cols = null, pucks = null, cells = [], goals = [];
  const tmp = new THREE.Object3D(), col = new THREE.Color();
  function update(c, opts) {
    if (cols) { scene.remove(cols); cols.geometry.dispose(); cols.material.dispose(); cols = null; }
    if (pucks) { scene.remove(pucks); pucks.geometry.dispose(); pucks.material.dispose(); pucks = null; }
    const none = tok("--z-none") || tok("--glass");
    cells = c.list.filter((b) => b.n > 0 && onIce(b.x, b.y));
    const val = (b) => (opts.view === "goals" ? b.g : b.n);
    const maxV = Math.max(1, ...cells.map(val));
    const height = (b) => 0.25 + MAX_H * Math.pow(val(b) / maxV, 0.8);
    const geo = new THREE.CylinderGeometry(c.r * 0.95, c.r * 0.95, 1, 6); geo.translate(0, 0.5, 0);
    cols = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }), Math.max(1, cells.length));
    const top = new Map();
    cells.forEach((b, i) => {
      const h = opts.view === "goals" && !b.g ? 0.12 : height(b);
      tmp.position.copy(P(b.x, b.y)); tmp.scale.set(1, h, 1); tmp.rotation.set(0, 0, 0); tmp.updateMatrix();
      cols.setMatrixAt(i, tmp.matrix);
      cols.setColorAt(i, col.set(b.fill && !String(b.fill).startsWith("url") ? b.fill : none));
      top.set(b.k, h);
    });
    cols.count = cells.length; cols.instanceMatrix.needsUpdate = true; if (cols.instanceColor) cols.instanceColor.needsUpdate = true;
    scene.add(cols);
    goals = opts.dots ? c.shots.filter((s) => s[3] && s[1] >= 25) : [];
    if (goals.length) {
      const pg = new THREE.CylinderGeometry(PUCK_R, PUCK_R, PUCK_H, 20); pg.translate(0, PUCK_H / 2, 0);
      pucks = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: tok("--chalk"), emissive: tok("--chalk"), emissiveIntensity: 0.25, roughness: 0.3 }), goals.length);
      const stack = new Map();   // pucks from the same spot stack up instead of overlapping
      goals.forEach((s, i) => {
        const k = api.binKey(s, c.r), h = (top.get(k) || 0) + 0.02, x = api.mapX(s), y = api.mapY(s);
        const sk = Math.round(x) + "," + Math.round(y), n = stack.get(sk) || 0; stack.set(sk, n + 1);
        tmp.position.copy(P(x, y, h + n * (PUCK_H + 0.04))); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
        pucks.setMatrixAt(i, tmp.matrix);
      });
      pucks.instanceMatrix.needsUpdate = true; scene.add(pucks);
    }
    renderer.domElement.setAttribute("aria-label", `3D ${opts.view === "goals" ? "goals" : opts.view === "shots" ? "shots" : "save %"} map: ${cells.length} spots, ${goals.length} goals shown as pucks. Drag to turn, scroll to zoom.`);
    dirty = true;
  }

  // Hover: pucks first (who scored), then columns (goals on shots).
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (e.buttons) { api.hideTip(); return; }
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hp = pucks && ray.intersectObject(pucks)[0];
    if (hp) return api.puckTip(e, goals[hp.instanceId]);
    const hc = cols && ray.intersectObject(cols)[0];
    if (hc) return api.cellTip(e, cells[hc.instanceId]);
    api.hideTip();
  });
  renderer.domElement.addEventListener("pointerleave", () => api.hideTip());

  // Camera presets ease between views; reduced motion jumps.
  let fly = null;
  function view(k, instant) {
    const v = VIEWS.find((x) => x[0] === k) || VIEWS[0];
    const still = instant || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) { camera.position.copy(v[2]); controls.target.copy(v[3]); controls.update(); dirty = true; return; }
    fly = { t0: performance.now(), p0: camera.position.clone(), t0v: controls.target.clone(), p1: v[2], t1: v[3] };
  }

  let dirty = true, raf = 0, visible = true;
  controls.addEventListener("change", () => (dirty = true));
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    if (fly) {
      const u = Math.min(1, (now - fly.t0) / 900), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0v, fly.t1, e);
      if (u >= 1) fly = null;
      dirty = true;
    }
    controls.update();
    if (dirty) { renderer.render(scene, camera); dirty = false; }
  }
  function size() {
    const w = Math.max(240, host.clientWidth), h = Math.round(Math.min(w * 0.82, innerHeight * 0.72));
    renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px";
    camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
  }
  const ro = new ResizeObserver(size); ro.observe(host);
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) dirty = true; }); io.observe(renderer.domElement);
  buildRink(); size(); view("point", true); raf = requestAnimationFrame(tick);

  return {
    update, view,
    theme() { buildRink(); dirty = true; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
