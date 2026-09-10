(() => {
  const root = document.documentElement;
  const storageKey = "site-theme";
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  const readSavedTheme = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === "dark" || saved === "light" ? saved : null;
    } catch (_) {
      return null;
    }
  };

  const saveTheme = (theme) => {
    try {
      localStorage.setItem(storageKey, theme);
    } catch (_) {
      // The visual switch still works when storage is unavailable.
    }
  };

  const preferredTheme = () => readSavedTheme() || (systemTheme.matches ? "dark" : "light");
  root.dataset.theme = preferredTheme();

  const start = () => {
    const nav = document.querySelector(".site-nav");
    if (!nav || nav.querySelector(".theme-toggle")) return;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    const toggle = document.createElement("button");
    toggle.className = "theme-toggle";
    toggle.type = "button";
    toggle.innerHTML = '<span class="theme-icon" aria-hidden="true"></span><span class="theme-label"></span>';
    nav.appendChild(toggle);

    const icon = toggle.querySelector(".theme-icon");
    const label = toggle.querySelector(".theme-label");

    const render = (theme) => {
      const next = theme === "dark" ? "light" : "dark";
      const traditional = root.dataset.script === "traditional";
      root.dataset.theme = theme;
      icon.textContent = next === "light" ? "☼" : "☾";
      label.textContent = next === "light" ? "DAY" : "NIGHT";
      toggle.setAttribute(
        "aria-label",
        traditional
          ? `切換至${next === "light" ? "日間" : "夜間"}模式`
          : `切换至${next === "light" ? "日间" : "夜间"}模式`,
      );
      toggle.title = toggle.getAttribute("aria-label");
      if (themeColor) themeColor.content = getComputedStyle(document.body).getPropertyValue("--bg").trim();
    };

    render(root.dataset.theme);
    toggle.addEventListener("click", () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      saveTheme(next);
      render(next);
    });
    systemTheme.addEventListener("change", (event) => {
      if (!readSavedTheme()) render(event.matches ? "dark" : "light");
    });
    window.addEventListener("site-script-change", () => render(root.dataset.theme));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
