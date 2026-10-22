// Light/dark switch in every page footer. With no saved choice the page follows the device setting.
// Loaded in <head> so a saved choice applies before the page paints. Fires "themechange" for pages that draw in JS.
(function () {
  const KEY = "grj-theme", root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  const dark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3"/></svg>';
  const MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1Z"/></svg>';
  function paint() {
    const d = dark();
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
      b.innerHTML = (d ? SUN : MOON) + `<span>${d ? "Light mode" : "Dark mode"}</span>`;
      b.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode");
    });
  }
  function ready() {
    paint();
    document.addEventListener("click", (e) => {
      if (!e.target.closest("[data-theme-toggle]")) return;
      const next = dark() ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch (e) {}
      paint();
      dispatchEvent(new Event("themechange"));
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!root.dataset.theme) { paint(); dispatchEvent(new Event("themechange")); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
