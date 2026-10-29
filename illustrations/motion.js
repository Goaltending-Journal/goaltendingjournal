/* Goalie illustrations, Step 5: motion. Each type's 3 to 5 second loop for the 240 px detail card, planned as key
   poses first. A key is a set of joint-angle changes on the type's pose (goalie-skeleton.js), so bones keep their
   length in every frame. Key A is always the type's still. The loop runs A, B, C and back to A.
   Works in the browser (window.GoalieMotion, after goalie-skeleton.js) and in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./goalie-skeleton.js"));
  else root.GoalieMotion = factory(root.GoalieSkeleton);
})(typeof self !== "undefined" ? self : this, function (G) {
  "use strict";

  // Per type: the action the loop shows, then keys B and C (A is the still). ms = how long each key holds
  // before moving to the next; the move between keys takes 300 ms (eased).
  const KEYS = {
    steady: { action: "Tracks the puck side to side", ms: [1400, 500, 500], keys: [
      { label: "Shift left", dx: -5, torso: -84, glove: [70, 30], l: [102, 86, 180], r: [86, 90, 0] },
      { label: "Shift right", dx: 5, torso: -96, blocker: [104, 74], l: [94, 90, 180], r: [78, 94, 0] }] },
    workhorse: { action: "Pushes post to post", ms: [1000, 700, 700], keys: [
      { label: "Push left", dx: -15, torso: -98, l: [132, 80, 180], r: [62, 100, 0] },
      { label: "Push right", dx: 15, torso: -82, l: [118, 80, 180], r: [48, 98, 0] }] },
    "hd-stopper": { action: "Drops into the butterfly on the doorstep chance", ms: [1400, 900, 600], keys: [
      { label: "Ready", head: -90, blocker: [118, 75], glove: [62, 20], l: [110, 88, 180], r: [70, 92, 0], stick: { blade: 180 } },
      { label: "Recover", l: [102, 176, 200], r: [70, 100, 0] }] },
    wall: { action: "Fills the net, arms to the posts", ms: [1400, 700, 700], keys: [
      { label: "Stretch", blocker: [190, 215], glove: [-10, -36] },
      { label: "Breathe", blocker: [150, 175], glove: [30, 6] }] },
    rebound: { action: "Dives on the puck and smothers it", ms: [1600, 500, 700], keys: [
      { label: "Dive", torso: -42, head: 0, blocker: [80, 100], glove: [40, 60] },
      { label: "Tuck", torso: -20, head: 25, blocker: [64, 92], glove: [60, 84] }] },
    siege: { action: "Kicks and snaps at shot after shot", ms: [1100, 600, 600], keys: [
      { label: "Blocker kick", blocker: [-170, -120], glove: [-10, -60] },
      { label: "Glove snap", torso: -92, blocker: [-130, -80], glove: [-50, -100] }] },
    crease: { action: "Peeks around the screen", ms: [1300, 700, 700], keys: [
      { label: "Back", torso: -100, head: -100 },
      { label: "Lean out", torso: -142, head: -172 }] },
    standout: { action: "Snaps the glove up", ms: [1500, 700, 400], keys: [
      { label: "Set", glove: [62, 20] },
      { label: "Snap", glove: [-55, -80] }] },
    "donut-king": { action: "Raises the donut like a crown", ms: [1500, 600, 600], keys: [
      { label: "Lower", blocker: [130, -60], glove: [50, -120] },
      { label: "Raise", airborne: 3, blocker: [-100, -88], glove: [-80, -92], l: [100, 90, 180], r: [80, 90, 0] }] },
    grandpa: { action: "Leans on the stick and straightens with a creak", ms: [1500, 900, 600], keys: [
      { label: "Hunch", torso: -40, head: 25 },
      { label: "Straighten", torso: -66, head: -15 }] },
    "young-gun": { action: "Springs into the air", ms: [1000, 600, 700], keys: [
      { label: "Crouch", airborne: 0, blocker: [120, 100], glove: [60, 80], l: [130, 62, 180], r: [50, 118, 0] },
      { label: "Peak", airborne: 14, blocker: [-150, -145], glove: [-30, -35], l: [150, 160, 200], r: [30, 20, -20] }] },
    "style-king": { action: "Struts with the stick across the shoulders", ms: [1100, 700, 700], keys: [
      { label: "Sway left", dx: -5, torso: -84, head: -100, l: [86, 106, 180], r: [96, 74, 0] },
      { label: "Sway right", dx: 5, torso: -96, head: -92, l: [76, 116, 180], r: [104, 66, 0] }] },
  };
  const MOVE = 300;

  /** Register key i (0 = A, the still) of a type as a pose and return its key, for any style's draw(). */
  function keyPose(type, i) {
    if (!i) return type;
    const name = `${type}#${i}`;
    if (!G.POSES[name]) { const { label, ...o } = KEYS[type].keys[i - 1]; G.POSES[name] = { ...G.POSES[type], pelvisX: G.skeleton(G.POSES[type]).pelvis[0], ...o }; }
    return name;
  }
  const loopMs = (type) => KEYS[type].ms.reduce((a, b) => a + b, 0) + 3 * MOVE;

  // In-betweens: every angle eased from one key to the next. Props and the stick come from the nearer key.
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2);
  const lerp = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : (a || 0) + ((b || 0) - (a || 0)) * t);
  const ANGLES = ["torso", "head", "blocker", "glove", "l", "r", "dx", "airborne"];
  /** The pose t ms into a type's loop, registered as "<type>@" and returned as its key. */
  function poseAt(type, t) {
    const K = KEYS[type], seq = [0, 1, 2].map((i) => G.POSES[keyPose(type, i)]);
    t %= loopMs(type);
    let from = 0, mix = 0;
    for (let i = 0; i < 3; i++) {
      if (t < K.ms[i]) { from = i; mix = 0; break; }
      t -= K.ms[i];
      if (t < MOVE) { from = i; mix = ease(t / MOVE); break; }
      t -= MOVE;
    }
    const A = seq[from], B = seq[(from + 1) % 3], pose = { ...(mix < 0.5 ? A : B), pelvisX: G.skeleton(G.POSES[type]).pelvis[0] };
    for (const k of ANGLES) if (A[k] !== undefined || B[k] !== undefined) pose[k] = lerp(A[k], B[k], mix);
    G.POSES[type + "@"] = pose;
    return type + "@";
  }

  return { KEYS, MOVE, keyPose, loopMs, poseAt };
});
