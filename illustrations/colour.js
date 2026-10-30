/* Colour checks shared by the audits: WCAG 2 contrast, and colour-vision simulation (Machado et al. 2009, full
   severity) so a pair is judged for deuteranopia, protanopia and tritanopia as well as normal vision.
   Node only (require); the art itself never needs it. */
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => rgb(hex).map(lin).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const wcag = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const CVD = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const simulate = (hex, m) => {
  const c = rgb(hex).map(lin);
  return "#" + m.map((r) => { const v = Math.min(1, Math.max(0, r[0] * c[0] + r[1] * c[1] + r[2] * c[2]));
    return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)).toString(16).padStart(2, "0"); }).join("");
};
// The lowest contrast of a pair across normal vision and the three simulations
const wcagAll = (a, b) => Math.min(wcag(a, b), ...Object.values(CVD).map((m) => wcag(simulate(a, m), simulate(b, m))));
module.exports = { lum, wcag, CVD, simulate, wcagAll };
