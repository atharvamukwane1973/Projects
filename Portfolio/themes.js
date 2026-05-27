(function () {
  "use strict";

  const STORAGE_KEY = "portfolio_theme";
  const DEFAULT_THEME = "aurora";
  const VALID = ["aurora", "sunrise", "ocean"];

  function applyTheme(themeId) {
    const id = VALID.indexOf(themeId) >= 0 ? themeId : DEFAULT_THEME;
    document.body.setAttribute("data-theme", id);
    document.body.classList.add("theme-transition");
    localStorage.setItem(STORAGE_KEY, id);

    document.querySelectorAll(".theme-option").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-theme") === id);
    });
  }

  function initThemePicker() {
    const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    applyTheme(saved);

    document.querySelectorAll(".theme-option").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const app = window.PortfolioApp;
        if (app && !app.isAdmin()) {
          if (app.requireAdmin) app.requireAdmin();
          return;
        }
        const theme = btn.getAttribute("data-theme");
        applyTheme(theme);
        if (app && app.showToast) {
          app.showToast("Theme updated!");
        }
      });
    });
  }

  initThemePicker();

  window.PortfolioThemes = { applyTheme: applyTheme, getTheme: function () {
    return document.body.getAttribute("data-theme") || DEFAULT_THEME;
  }};
})();
