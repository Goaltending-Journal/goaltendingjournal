// Fills every <time data-today> on the page with the visitor's current date, e.g. "Sunday 18 October 2026".
// Rechecks each minute so a page left open past midnight rolls over to the new day.
(function () {
  const fmt = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  function fill() {
    const now = new Date();
    const text = now.toLocaleDateString("en-GB", fmt).replace(",", "");
    const iso = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    document.querySelectorAll("time[data-today]").forEach((el) => {
      if (el.textContent !== text) { el.textContent = text; el.setAttribute("datetime", iso); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill);
  else fill();
  setInterval(fill, 60000);
})();
