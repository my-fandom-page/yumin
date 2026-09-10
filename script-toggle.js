(() => {
  const root = document.documentElement;
  const storageKey = "site-script";

  const readSavedScript = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === "traditional" || saved === "simplified" ? saved : null;
    } catch (_) {
      return null;
    }
  };

  const saveScript = (script) => {
    try {
      localStorage.setItem(storageKey, script);
    } catch (_) {
      // The switch still works when storage is unavailable.
    }
  };

  const initialScript = readSavedScript() || "simplified";
  root.dataset.script = initialScript;

  const start = () => {
    const nav = document.querySelector(".site-nav");
    if (!nav || !window.OpenCC) return;

    const convert = OpenCC.Converter({ from: "cn", to: "tw" });
    const toTraditional = (text) => {
      const protectedText = text.replaceAll("齐豫", "__CHYI_YU__");
      return convert(protectedText)
        .replaceAll("__CHYI_YU__", "齊豫")
        .replaceAll("“", "「")
        .replaceAll("”", "」")
        .replace(/‘([^’]*[\u3400-\u9fff][^’]*)’/g, "『$1』");
    };
    const pageConverter = OpenCC.HTMLConverter(
      toTraditional,
      document.documentElement,
      "zh-CN",
      "zh-TW",
    );

    const toggle = document.createElement("button");
    toggle.className = "script-toggle ignore-opencc";
    toggle.type = "button";
    toggle.innerHTML = '<span data-script-option="simplified">简</span><span class="script-divider" aria-hidden="true">/</span><span data-script-option="traditional">繁</span>';
    nav.insertBefore(toggle, nav.querySelector(".theme-toggle"));

    const renderToggle = (script) => {
      const traditional = script === "traditional";
      toggle.querySelector('[data-script-option="simplified"]').textContent = traditional ? "簡" : "简";
      toggle.querySelector('[data-script-option="traditional"]').textContent = "繁";
      toggle.setAttribute("aria-label", traditional ? "切換為簡體中文" : "切换为繁体中文");
      toggle.title = toggle.getAttribute("aria-label");
      toggle.setAttribute("aria-pressed", String(traditional));
    };

    const apply = (script) => {
      if (script === "traditional") pageConverter.convert();
      else pageConverter.restore();
      root.dataset.script = script;
      renderToggle(script);
      window.dispatchEvent(new CustomEvent("site-script-change", { detail: { script } }));
    };

    apply(initialScript);
    toggle.addEventListener("click", () => {
      const next = root.dataset.script === "traditional" ? "simplified" : "traditional";
      saveScript(next);
      apply(next);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
