/* Spotify's official iFrame API supplies playback state; no audio is hosted here.
   https://developer.spotify.com/documentation/embeds/references/iframe-api */
(() => {
  "use strict";
  const room = document.getElementById("records");
  if (!room) return;
  const albums = [...room.querySelectorAll(".echo-album")];
  const host = room.querySelector(".echo-embed-source");
  const play = room.querySelector(".echo-play");
  const playText = room.querySelector(".echo-play-text");
  const status = room.querySelector(".echo-player-status");
  const motion = room.querySelector(".echo-motion");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let active = albums[0], api, controller, generation = 0, apiFailed = false;
  let timeout, requestTimeout, state = "loading", still = false, hasPlayed = false;
  let converter;
  const translate = text => {
    if (document.documentElement.dataset.script !== "traditional" || !window.OpenCC) return text;
    converter ||= window.OpenCC.Converter({ from: "cn", to: "tw" });
    return converter(text);
  };
  const messages = {
    loading: "播放器加载中…",
    ready: "",
    waiting: "正在播放…",
    playing: "正在播放",
    paused: "已暂停",
    buffering: "缓冲中…",
    ended: "播放结束",
    blocked: "没有开始播放。可以通过专辑链接打开 Spotify。",
    fallback: "播放器没能加载。可以通过专辑链接打开 Spotify。"
  };

  function render() {
    const playing = state === "playing";
    room.classList.toggle("is-playing", playing);
    room.dataset.still = String(still || reducedMotion.matches);
    const label = playing ? "起针" : hasPlayed ? "继续" : "落针";
    playText.textContent = translate(label);
    play.firstElementChild.textContent = playing ? "Ⅱ" : "▷";
    play.setAttribute("aria-label", translate(playing ? "起针" : hasPlayed ? "继续播放" : "落针播放"));
    play.disabled = ["loading", "fallback"].includes(state);
    status.textContent = translate(messages[state]);
    motion.hidden = !hasPlayed || reducedMotion.matches;
    motion.textContent = translate(still ? "恢复动画" : "停止动画");
    motion.setAttribute("aria-pressed", String(still));
    motion.setAttribute("aria-label", translate(still ? "恢复唱片动画" : "停止唱片动画，音乐继续播放"));
  }
  function setState(next) {
    state = next;
    render();
  }
  function updateAlbum() {
    room.dataset.record = active.dataset.record;
    for (const album of albums) album.setAttribute("aria-pressed", String(album === active));
    room.querySelector(".echo-label-title").textContent = active.querySelector("strong").textContent;
    room.querySelector(".echo-label-artist").textContent = active.querySelector("small").textContent;
    room.querySelector(".echo-label-side").textContent = active === albums[0] ? "SIDE A" : "SIDE B";
  }
  function clearPlayer() {
    clearTimeout(timeout); clearTimeout(requestTimeout);
    if (controller) {
      try { controller.pause(); } catch (_) {}
      try { controller.destroy(); } catch (_) {}
    }
    controller = null;
    host.replaceChildren();
  }
  function fallback(version) {
    if (version !== generation) return;
    if (!api) apiFailed = true;
    // Invalidate late events from a failed controller before removing it.
    generation++;
    clearPlayer();
    const iframe = document.createElement("iframe");
    iframe.src = "https://open.spotify.com/embed/album/" + active.dataset.uri.split(":").pop();
    iframe.title = "Spotify · " + active.querySelector("strong").textContent;
    iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.setAttribute("allowfullscreen", "");
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    host.append(iframe);
    setState("fallback");
  }
  function mount() {
    const version = ++generation;
    clearPlayer();
    hasPlayed = false;
    setState("loading");
    if (!api && apiFailed) { fallback(version); return; }
    timeout = setTimeout(() => fallback(version), 15000);
    if (!api) return;
    const slot = document.createElement("div");
    host.append(slot);
    try {
      api.createController(slot, { uri: active.dataset.uri, width: "100%", height: 352 }, embed => {
        if (version !== generation) { embed.destroy(); return; }
        controller = embed;
        const frame = host.querySelector("iframe");
        if (frame) frame.title = "Spotify · " + active.querySelector("strong").textContent;
        embed.addListener("ready", () => {
          if (version !== generation) return;
          clearTimeout(timeout);
          // Loading an album never starts it automatically.
          if (state === "loading") setState("ready");
        });
        embed.addListener("playback_update", event => {
          if (version !== generation) return;
          const data = event.data;
          if (!data || typeof data.isPaused !== "boolean") return;
          clearTimeout(timeout);
          if (data.isBuffering) { setState("buffering"); return; }
          const ended = data.duration > 0 && data.position >= data.duration;
          if (!data.isPaused && !ended) {
            hasPlayed = true;
            clearTimeout(requestTimeout);
            setState("playing");
          } else if (hasPlayed) {
            clearTimeout(requestTimeout);
            setState(ended ? "ended" : "paused");
          } else if (state === "loading") setState("ready");
        });
      });
    } catch (_) { fallback(version); }
  }

  for (const album of albums) {
    album.disabled = false;
    album.addEventListener("click", () => {
      if (album === active) return;
      active = album;
      updateAlbum();
      // Destroy the old embed first, so two records cannot play at once.
      mount();
    });
  }
  play.addEventListener("click", () => {
    if (!controller || play.disabled) return;
    clearTimeout(requestTimeout);
    const version = generation;
    try {
      if (state === "playing") {
        controller.pause();
      } else {
        controller.togglePlay();
        setState("waiting");
        requestTimeout = setTimeout(() => {
          if (version === generation && ["waiting", "buffering"].includes(state)) setState("blocked");
        }, 8000);
      }
    } catch (_) { setState("blocked"); }
    // Animation starts only on an actual playback_update, not on a button click.
  });
  motion.addEventListener("click", () => { still = !still; render(); });
  reducedMotion.addEventListener?.("change", render);
  window.addEventListener("site-script-change", render);
  window.addEventListener("pagehide", () => {
    generation++;
    clearPlayer();
    setState("paused");
  });
  window.addEventListener("pageshow", event => { if (event.persisted) mount(); });

  window.onSpotifyIframeApiReady = IFrameAPI => { api = IFrameAPI; apiFailed = false; mount(); };
  updateAlbum();
  mount();
  const script = document.createElement("script");
  script.src = "https://open.spotify.com/embed/iframe-api/v1";
  script.async = true;
  script.addEventListener("error", () => fallback(generation), { once: true });
  document.head.append(script);
})();
