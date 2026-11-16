/* Shared reading controls. Only production Kudos clicks send GoatCounter events. */
(() => {
  "use strict";
  const assetURL = document.currentScript.src;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("reading.css?v=20261114-6", assetURL);
  document.head.append(css);
  const SETTINGS = "fandom-reader:v1:settings";
  // Retire the old local bookmarks without touching typography preferences.
  try { localStorage.removeItem("fandom-reader:v1:bookmarks"); } catch (_) {}
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  };
  const canonical = path => path.replace(/^\/Yumin(?=\/|$)/, "/yumin").replace(/\/index\.html$/, "/").replace(/\/?$/, "/");
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));


  function start() {
    if (document.body.dataset.readerEnhanced) return;
    document.body.dataset.readerEnhanced = "true";
    const root = document.documentElement;
    const body = document.body;
    const path = canonical(location.pathname);
    const english = root.lang.startsWith("en");
    const t = (cn, en) => english ? en : cn;
    const originalUIText = new WeakMap();
    const originalUILabels = new WeakMap();
    let convertUI;
    function translateUI() {
      if (english || !window.OpenCC) return;
      convertUI ||= window.OpenCC.Converter({ from: "cn", to: "tw" });
      const traditional = root.dataset.script === "traditional";
      function visit(node) {
        if (node.nodeType === 3 && /[\u3400-\u9fff]/.test(node.textContent)) {
          if (!originalUIText.has(node)) originalUIText.set(node, node.textContent);
          const text = originalUIText.get(node);
          node.textContent = traditional ? convertUI(text) : text;
        }
        if (node.nodeType === 1 && node.hasAttribute("aria-label")) {
          if (!originalUILabels.has(node)) originalUILabels.set(node, node.getAttribute("aria-label"));
          const label = originalUILabels.get(node);
          node.setAttribute("aria-label", traditional ? convertUI(label) : label);
        }
        [...node.childNodes].forEach(visit);
      }
      document.querySelectorAll(".reading-tools, .reading-kudos, .reading-chapter-nav").forEach(visit);
    }
    window.addEventListener("site-script-change", translateUI);
    const garden = path.includes("/The-Garden-of-Forking-Paths/");
    const echo = path.includes("/After-the-Echo/");
    const sketch = path.includes("/Sketch/");
    const article = document.querySelector("article.prose");
    body.classList.add(garden ? "reader-garden" : sketch ? "reader-notes" : "reader-echo");

    if (!article && garden) {
      const host = document.querySelector(".chapter-grid > header");
      if (host) {
        const tape = make("div", "reading-cassette");
        tape.setAttribute("aria-label", "田野录音带 · 花莲，1983 年 8 月");
        tape.innerHTML = '<div class="reading-tape-label"><span>FIELD RECORDINGS</span><span>A</span></div><div class="reading-tape-reels" aria-hidden="true"><i></i><span></span><i></i></div><div class="reading-tape-caption"><span>HUALIEN</span><span>1983.08</span></div>';
        host.prepend(tape);
      }
    }
    if (!article && echo) {
      const timeline = document.querySelector(".timeline");
      if (timeline) {
        const sleeve = make("div", "reading-sleeve");
        const label = make("div", "reading-sleeve-label");
        label.append(make("span", "", "AFTER THE ECHO"), make("span", "", "07 + CODA"));
        timeline.before(sleeve); sleeve.append(label, timeline);
      }
    }
    if (!article) return;

    body.classList.add("reading-enhanced");
    const head = document.querySelector(".chapter-head, .article-head");
    const bottomNav = document.querySelector("nav.chapter-nav");
    if (head && bottomNav && (garden || echo)) {
      const chapterNav = bottomNav.cloneNode(true);
      chapterNav.className = "reading-chapter-nav ignore-opencc";
      chapterNav.setAttribute("aria-label", t("顶部章节导航", "Chapter navigation at the top"));
      const previous = chapterNav.firstElementChild;
      if (previous?.matches("a") && !/\/(?:Chapter-\d+|Afterword)\/$/.test(new URL(previous.href).pathname)) {
        const blank = make("span", "empty");
        blank.setAttribute("aria-hidden", "true");
        previous.replaceWith(blank);
      }
      const contents = chapterNav.querySelector(".home");
      if (contents) {
        const directoryURL = new URL(contents.href, location.href);
        directoryURL.hash = "";
        const picker = make("details", "reading-chapter-picker");
        const summary = make("summary");
        summary.append(make("span", "", t("目录", "Contents")), make("span", "reading-chapter-chevron", "⌄"));
        summary.lastElementChild.setAttribute("aria-hidden", "true");
        summary.setAttribute("aria-controls", "reading-chapters-panel");
        const panel = make("div", "reading-chapters-panel");
        panel.id = "reading-chapters-panel";
        panel.append(make("p", "reading-chapters-heading", t("选择章节", "Choose a chapter")));
        const status = make("p", "reading-chapters-status");
        status.setAttribute("role", "status");
        const list = make("ol", "reading-chapters-list");
        list.setAttribute("aria-label", t("全部章节", "All chapters"));
        const retry = make("button", "reading-chapters-retry", t("重试", "Retry"));
        retry.type = "button";
        retry.hidden = true;
        const home = contents.cloneNode(true);
        home.className = "home reading-chapters-home";
        home.textContent = t("返回作品主页 →", "Story homepage →");
        panel.append(status, list, retry, home);
        picker.append(summary, panel);
        contents.replaceWith(picker);

        let loaded = false;
        let loading = false;
        async function loadChapters() {
          if (loaded || loading) return;
          loading = true;
          status.hidden = false;
          status.textContent = t("正在读取章节…", "Loading chapters…");
          retry.hidden = true;
          list.setAttribute("aria-busy", "true");
          translateUI();
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          try {
            const response = await fetch(directoryURL.href, { cache: "no-cache", signal: controller.signal });
            if (!response.ok) throw new Error("Chapter index unavailable");
            const source = new DOMParser().parseFromString(await response.text(), "text/html");
            const entries = [];
            const seen = new Set();
            for (const link of source.querySelectorAll("#chapters a[href], #chapter a[href]")) {
              const url = new URL(link.getAttribute("href"), directoryURL);
              if (url.origin !== directoryURL.origin || !url.pathname.startsWith(directoryURL.pathname)) continue;
              const child = url.pathname.slice(directoryURL.pathname.length);
              if (!/^(?:Chapter-\d+|Afterword)\/(?:index\.html)?$/.test(child)) continue;
              const key = canonical(url.pathname);
              if (seen.has(key)) continue;
              seen.add(key);
              const title = link.querySelector(".log-title, h3")?.textContent.trim();
              if (!title) continue;
              const item = make("li");
              const chapter = make("a", "reading-chapter-link");
              chapter.href = url.href;
              chapter.append(make("span", "", title));
              if (key === path) {
                chapter.setAttribute("aria-current", "page");
                const current = make("small", "", t("正在读", "Reading"));
                current.setAttribute("aria-hidden", "true");
                chapter.append(current);
              }
              item.append(chapter);
              entries.push(item);
            }
            if (!entries.length) throw new Error("No published chapters found");
            list.replaceChildren(...entries);
            loaded = true;
            status.hidden = true;
          } catch (_) {
            status.textContent = t("暂时读不到目录，可以重试或返回作品主页。", "The index is unavailable. Retry or visit the story homepage.");
            retry.hidden = false;
          } finally {
            clearTimeout(timeout);
            loading = false;
            list.removeAttribute("aria-busy");
            translateUI();
          }
        }
        picker.addEventListener("toggle", async () => {
          if (!picker.open) return;
          await loadChapters();
          const current = list.querySelector('[aria-current="page"]');
          if (picker.open && current) {
            list.scrollTop = Math.max(0, current.offsetTop - list.offsetTop - (list.clientHeight - current.offsetHeight) / 2);
          }
        });
        retry.addEventListener("click", loadChapters);
        picker.addEventListener("click", event => {
          if (event.target.closest("a")) picker.open = false;
        });
        document.addEventListener("click", event => {
          if (picker.open && !picker.contains(event.target)) picker.open = false;
        });
        document.addEventListener("keydown", event => {
          if (event.key === "Escape" && picker.open) {
            picker.open = false;
            summary.focus();
          }
        });
        picker.addEventListener("focusout", event => {
          if (event.relatedTarget && !picker.contains(event.relatedTarget)) picker.open = false;
        });
      }
      const chapterEnding = chapterNav.querySelector(".locked");
      if (chapterEnding) {
        const complete = chapterEnding.classList.contains("complete") ||
          chapterEnding.textContent.trim() === "全文完";
        chapterEnding.textContent = complete ? t("全文完", "Complete") : t("待续", "To be continued");
      }
      head.before(chapterNav);
      // The saved script may have converted the source nav before we cloned it.
      // Keep prev/next labels in sync when the original page is restored.
      window.addEventListener("site-script-change", () => {
        for (const link of chapterNav.querySelectorAll(":scope > a")) {
          const original = [...bottomNav.querySelectorAll("a")].find(item => item.href === link.href);
          if (original) link.textContent = original.textContent;
        }
      });
    }
    if (head && (garden || sketch)) {
      const folio = make("div", "reading-folio");
      const chapter = path.match(/Chapter-(\d+)/);
      folio.append(make("span", "", garden ? "FIELD NOTES / 1983" : "LOOSE LEAF / NOTES"));
      folio.append(make("span", "", chapter ? "PATH " + chapter[1].padStart(2, "0") : "01"));
      head.prepend(folio);
    }

    // Do not select, restyle, move or replace music/video cards.
    const paragraphs = [...article.querySelectorAll("p")].filter(p =>
      !p.closest(".soundtrack, .adult-gate-panel, .adult-content-head, .adult-gate-form, .author-note"));
    paragraphs.forEach(p => p.classList.add("reading-text"));
    const first = paragraphs.find(p => p.getClientRects().length);
    if (!first) return;
    const original = getComputedStyle(first);
    const defaults = { size: parseFloat(original.fontSize), line: parseFloat(original.lineHeight) / parseFloat(original.fontSize) };
    let settings = read(SETTINGS, {});
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) settings = {};
    function applySettings() {
      if (Number.isFinite(settings.size)) body.style.setProperty("--reading-size", clamp(settings.size, 16, 28) + "px");
      else body.style.removeProperty("--reading-size");
      if (Number.isFinite(settings.line)) body.style.setProperty("--reading-leading", clamp(settings.line, 1.5, 2.5));
      else body.style.removeProperty("--reading-leading");
    }
    applySettings();

    const end = make("div", "reading-end reading-kudos ignore-opencc");
    end.id = "kudos";
    const rail = make("div", "reading-kudos-rail");
    const kudos = make("button", "reading-kudos-button");
    kudos.type = "button";
    kudos.setAttribute("aria-label", t("给这篇文一个 Kudos，可以重复点击", "Leave Kudos — as many times as you like"));
    const heart = make("span", "reading-kudos-heart", "♡");
    heart.setAttribute("aria-hidden", "true");
    kudos.append(heart, make("span", "", "Kudos"));
    const count = make("span", "reading-kudos-count");
    count.setAttribute("aria-hidden", "true");
    const thanks = make("p", "reading-kudos-thanks", t("喜欢的话就留一颗心吧～", "Leave a little love."));
    thanks.setAttribute("role", "status");
    thanks.setAttribute("aria-live", "polite");
    const sparks = make("span", "reading-kudos-sparks");
    sparks.setAttribute("aria-hidden", "true");
    rail.append(kudos, count, sparks);
    end.append(rail, thanks);
    article.after(end);
    if (location.hash === "#kudos") {
      const revealKudos = () => end.scrollIntoView({ block: "center", behavior: "instant" });
      if (css.sheet) revealKudos();
      else css.addEventListener("load", revealKudos, { once: true });
    }

    // Session-only UI count; no visitor ID, IP, cookies or local click history.
    // The existing GoatCounter script handles events on the published host only.
    const eventTitle = "Kudos · " + document.title;
    const production = location.protocol === "https:" && location.hostname === "my-fandom-page.github.io";
    let pending = 0;
    let eventTimer = null;
    let attempts = 0;
    function sendKudos() {
      eventTimer = null;
      const tracker = window.goatcounter;
      if (typeof tracker?.count === "function") {
        while (pending > 0) {
          pending--;
          try {
            tracker.count({ path: "kudos" + path, title: eventTitle, event: true, no_session: true });
          } catch (_) { /* A blocked counter must not break the reading UI. */ }
        }
        attempts = 0;
      } else if (pending && attempts++ < 20) {
        eventTimer = setTimeout(sendKudos, 500);
      } else {
        pending = 0;
        attempts = 0;
      }
    }
    function recordKudos() {
      if (!production) return;
      pending++;
      if (eventTimer === null) sendKudos();
    }
    function scatter(flowers = false) {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      if (flowers) sparks.replaceChildren();
      const amount = flowers ? 9 : 3;
      for (let i = 0; i < amount && sparks.childElementCount < 36; i++) {
        const spark = make("i", "reading-kudos-spark", flowers ? "✿" : "♡");
        spark.style.setProperty("--dx", (Math.random() * 150 - 75) + "px");
        spark.style.setProperty("--dy", (-45 - Math.random() * 65) + "px");
        spark.style.setProperty("--tilt", (Math.random() * 80 - 40) + "deg");
        sparks.append(spark);
        spark.addEventListener("animationend", () => spark.remove(), { once: true });
        setTimeout(() => spark.remove(), 1200);
      }
    }
    let clicks = 0;
    kudos.addEventListener("click", () => {
      clicks++;
      heart.textContent = "♥";
      count.textContent = t("本次 × ", "This visit × ") + clicks;
      let message;
      if (clicks === 1) message = t("谢谢你来读 ♡", "Thank you for reading ♡");
      else if (clicks === 10) message = t("好多颗心！谢谢你呀 ♡", "So much love. Thank you ♡");
      else if (clicks === 30) message = t("小花开了，送你一朵 ✿", "A little flower, just for you ✿");
      else if (clicks === 50) message = t("你怎么还在点，嘴一个！", "Still here? You're lovely.");
      else if (clicks % 100 === 0) message = t("又是一百颗心。送你一小束花 ✿", "Another hundred hearts. A little bouquet for you ✿");
      if (message) thanks.textContent = message;
      scatter(clicks === 30 || clicks % 100 === 0);
      recordKudos();
      translateUI();
    });

    // Native details keep correspondence readable without JavaScript controls.
    document.querySelectorAll(".reader-letter").forEach((letter, i) => {
      const author = letter.querySelector(".reader-letter-meta a")?.textContent.replace("↗", "").trim() || "";
      const date = letter.querySelector("time")?.textContent || "";
      const contents = make("div", "reading-letter-content");
      while (letter.firstChild) contents.append(letter.firstChild);
      const details = make("details");
      const summary = make("summary");
      const info = make("span", "reading-letter-info");
      info.append(make("span", "reading-eyebrow", "LETTER " + String(i + 1).padStart(2, "0")),
        make("strong", "", t("来自 " + author + " 的来信", "A letter from " + author)),
        make("small", "", date));
      summary.append(make("span", "reading-envelope", "✉"), info, make("span", "reading-letter-open", "+"));
      details.append(summary, contents);
      letter.append(details);
      letter.classList.add("reading-letter-folded");
    });

    const tools = make("div", "reading-tools ignore-opencc");
    const bar = make("nav", "reading-tool-row");
    bar.id = "reading-tool-row";
    bar.setAttribute("aria-label", t("阅读工具", "Reading tools"));
    const opener = make("button", "reading-tools-open", t("阅读工具 ↑", "Reading tools ↑"));
    opener.type = "button"; opener.hidden = true;
    opener.setAttribute("aria-expanded", "true");
    opener.setAttribute("aria-controls", bar.id);
    const directory = make("a", "reading-tool");
    directory.textContent = t("目录", "Index");
    const indexLink = document.querySelector(".chapter-nav .home, .article-nav .home") ||
      document.querySelector('.site-nav a[href*="#chapter"], .site-nav a');
    directory.href = indexLink?.href || new URL("../", location.href).href;
    function button(label, name) {
      const el = make("button", "reading-tool", label);
      el.type = "button";
      el.setAttribute("aria-label", name);
      return el;
    }
    const typography = button("Aa", t("字号与行距", "Text size and spacing"));
    typography.setAttribute("aria-expanded", "false");
    typography.setAttribute("aria-controls", "reading-settings");
    const toTop = button(t("顶部 ↑", "Top ↑"), t("回到页面最上面", "Back to the top of this page"));
    toTop.classList.add("reading-top");
    toTop.addEventListener("click", () => {
      setPanel(false);
      manuallyCollapsed = false;
      setCollapsed(false);
      const destination = document.querySelector(".reading-chapter-nav > a, .reading-chapter-nav summary, .chapter-head h1, .article-head h1");
      if (destination) {
        if (!destination.matches("a, summary")) destination.setAttribute("tabindex", "-1");
        destination.focus({ preventScroll: true });
      }
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
    });
    const collapse = button("↓", t("收起工具栏", "Collapse reading tools"));
    collapse.classList.add("reading-tools-collapse");
    collapse.title = t("收起工具栏", "Collapse reading tools");
    bar.append(directory, typography, toTop, collapse);
    const panel = make("section", "reading-settings");
    panel.id = "reading-settings"; panel.hidden = true;
    panel.setAttribute("aria-label", t("阅读设置", "Reading settings"));
    const panelHead = make("div", "reading-settings-head");
    panelHead.append(make("strong", "", t("阅读设置", "Reading settings")));
    const close = button("×", t("收起阅读设置", "Close reading settings"));
    panelHead.append(close); panel.append(panelHead);
    const inputs = [];
    function slider(label, prop, min, max, step, suffix) {
      const field = make("div", "reading-setting");
      const row = make("div", "reading-setting-label");
      const name = make("label", "", label);
      const output = make("output");
      const input = make("input");
      input.type = "range"; input.min = min; input.max = max; input.step = step;
      input.id = "reading-" + prop; output.htmlFor = input.id; name.htmlFor = input.id;
      const controls = make("div", "reading-setting-controls");
      const less = button("−", prop === "size" ? t("缩小字号", "Decrease text size") : t("减小行距", "Decrease line spacing"));
      const more = button("+", prop === "size" ? t("放大字号", "Increase text size") : t("增大行距", "Increase line spacing"));
      less.classList.add("reading-step"); more.classList.add("reading-step");
      less.dataset.step = "-1"; more.dataset.step = "1";
      less.setAttribute("aria-controls", input.id); more.setAttribute("aria-controls", input.id);
      function value() {
        const raw = Number.isFinite(settings[prop]) ? settings[prop] : defaults[prop];
        const bounded = clamp(Number.isFinite(raw) ? raw : min, min, max);
        return Number((min + Math.round((bounded - min) / step) * step).toFixed(2));
      }
      const render = () => {
        input.value = value();
        output.value = (prop === "line" ? value().toFixed(1) : String(value())) + suffix;
        less.disabled = value() <= min;
        more.disabled = value() >= max;
      };
      function update(next) {
        // Round to the range's step so repeated taps never accumulate decimal error.
        settings[prop] = Number(clamp(min + Math.round((next - min) / step) * step, min, max).toFixed(2));
        applySettings(); render(); write(SETTINGS, settings);
      }
      input.addEventListener("input", () => update(Number(input.value)));
      less.addEventListener("click", () => update(value() - step));
      more.addEventListener("click", () => update(value() + step));
      row.append(name, output); controls.append(less, input, more);
      field.append(row, controls); panel.append(field);
      inputs.push(render); render();
    }
    slider(t("字号", "Text size"), "size", 16, 28, 1, " px");
    slider(t("行距", "Line spacing"), "line", 1.5, 2.5, 0.1, "");
    const reset = button(t("恢复原来的排版", "Reset typography"), t("恢复原来的排版", "Reset typography"));
    reset.classList.add("reading-reset");
    reset.addEventListener("click", () => { settings = {}; write(SETTINGS, settings); applySettings(); inputs.forEach(fn => fn()); });
    panel.append(reset, make("p", "reading-local-note", t("字号与行距只保存在这台设备。", "Typography preferences stay on this device.")));
    tools.append(panel, bar, opener); body.append(tools);
    let manuallyCollapsed = false;
    function setCollapsed(value) {
      bar.hidden = value; opener.hidden = !value;
      opener.setAttribute("aria-expanded", String(!value));
    }
    function setPanel(open) {
      panel.hidden = !open;
      typography.setAttribute("aria-expanded", String(open));
      if (open) {
        manuallyCollapsed = false;
        setCollapsed(false);
        panel.querySelector("input").focus();
      }
    }
    opener.addEventListener("click", () => {
      manuallyCollapsed = false; setCollapsed(false); typography.focus();
    });
    collapse.addEventListener("click", () => {
      setPanel(false); manuallyCollapsed = true; setCollapsed(true); opener.focus();
    });
    typography.addEventListener("click", () => setPanel(panel.hidden));
    close.addEventListener("click", () => { setPanel(false); typography.focus(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !panel.hidden) { setPanel(false); typography.focus(); }
    });
    document.addEventListener("click", e => {
      if (!panel.hidden && !tools.contains(e.target)) setPanel(false);
    });
    let lastY = window.scrollY;
    window.addEventListener("scroll", () => {
      const nextY = window.scrollY;
      if (Math.abs(nextY - lastY) <= 12) return;
      const keyboardFocus = tools.contains(document.activeElement) &&
        document.activeElement.matches(":focus-visible");
      if (panel.hidden && !manuallyCollapsed && !keyboardFocus) {
        setCollapsed(nextY > lastY && nextY > 350);
      }
      lastY = nextY;
    }, { passive: true });
    translateUI();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
