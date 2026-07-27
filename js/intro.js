// intro.js (v4.2)
// ============================
// Intro: video + overlay de texto
// ✅ SIEMPRE muestra "Elige tu idioma" (sin memoria de idioma)
// ✅ Luego muestra "Bienvenido" (según idioma) + Empezar
// ✅ Anti doble-init, fallback autoplay, reduce-motion, Skip, ESC, etc.
// ✅ No usa localStorage para idioma (LANG_KEY/LANG_SET_KEY eliminados)
// ============================

const INTRO_SEEN_KEY = "musibot_intro_seen_v4"; // (opcional: si quieres eliminar memoria del intro, mira abajo)
let introLocked = false;

export function initIntro(onFinish, opts = {}) {
  if (introLocked) return;
  introLocked = true;

  const overlay = document.getElementById("introOverlay");
  const video = document.getElementById("introVideo");
  const text = document.getElementById("introText");
  const startBtn = document.getElementById("startBot");

  const langGate = document.getElementById("langGate");
  const gateES = document.getElementById("gateES");
  const gateEN = document.getElementById("gateEN");
  const introWelcome = document.getElementById("introWelcome");
  const langSwitchTop = document.getElementById("langSwitchTop");

  const {
    showOnce = true,          // si true: el intro se muestra solo una vez (usa INTRO_SEEN_KEY)
    forceShow = false,        // si true: siempre muestra intro aunque ya "se haya visto"
    addSkipButton = true,
    enableEscClose = true,
    closeOnOverlayClick = false,
    rewindOnClose = true,

    // 👇 cuándo aparece el gate (durante el video)
    showLangGateAfterMs = 1500,

    // fallback si autoplay no funciona
    autoShowTextAfterMs = 900,

    // autocierre opcional
    autoCloseAfterMs = 0,

    // función opcional de traducción para "Saltar" / "Empezar"
    t = null
  } = opts;

  if (!overlay || !text || !startBtn) {
    console.warn("Intro no inicializado: faltan elementos del DOM");
    safeUnlock();
    if (typeof onFinish === "function") onFinish();
    return;
  }

  // Si se quiere mostrar solo una vez y ya se vio: cerrar de una
  // (Si quieres eliminar TOTALMENTE esta memoria, pon showOnce=false en initIntro,
  //  o comenta este bloque entero.)
  if (!forceShow && showOnce && hasSeenIntro()) {
    hideOverlay(overlay);
    safeUnlock();
    if (typeof onFinish === "function") onFinish();
    return;
  }

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  showOverlay(overlay);

  // i18n opcional para el botón empezar
  applyI18nToStart(startBtn, t);

  let skipBtn = null;
  if (addSkipButton) skipBtn = ensureSkipButton(overlay, t);

  let fallbackTimer = null;
  let gateTimer = null;
  let autoCloseTimer = null;

  const listeners = [];

  const cleanup = () => {
    clearTimeoutSafe(fallbackTimer);
    clearTimeoutSafe(gateTimer);
    clearTimeoutSafe(autoCloseTimer);

    for (const { el, type, fn } of listeners) {
      try { el.removeEventListener(type, fn); } catch {}
    }
    listeners.length = 0;

    document.body.style.overflow = prevOverflow || "";

    if (video) {
      try { video.pause(); } catch {}
      if (rewindOnClose) {
        try { video.currentTime = 0; } catch {}
      }
    }

    safeUnlock();
  };

  const closeIntro = () => {
    // Marca como visto (si showOnce=true y no forceShow)
    setSeenIntro(true);

    hideOverlay(overlay);
    cleanup();
    if (typeof onFinish === "function") onFinish();
  };

  // Start
  {
    const fn = () => closeIntro();
    startBtn.addEventListener("click", fn, { once: true });
    listeners.push({ el: startBtn, type: "click", fn });
  }

  // Skip
  if (skipBtn) {
    const fn = () => closeIntro();
    skipBtn.addEventListener("click", fn, { once: true });
    listeners.push({ el: skipBtn, type: "click", fn });
  }

  // ESC
  if (enableEscClose) {
    const fn = (e) => { if (e.key === "Escape") closeIntro(); };
    window.addEventListener("keydown", fn);
    listeners.push({ el: window, type: "keydown", fn });
  }

  // Click fuera
  if (closeOnOverlayClick) {
    const fn = (e) => { if (e.target === overlay) closeIntro(); };
    overlay.addEventListener("click", fn);
    listeners.push({ el: overlay, type: "click", fn });
  }

  // ✅ IMPORTANTE: el overlay de texto debe existir desde el inicio
  // para que el gate pueda recibir clicks encima del video.
  ensureTextVisible(text);

  // Estado inicial: ambos ocultos. El gate lo mostramos por timer (o ya mismo si reduce motion)
  applyLangGateStateInitial();

  // Bind clicks de idioma
  bindLanguageGate();

  // Video: reproducir con fallback
  const reduceMotion = prefersReducedMotion();

  if (video && !reduceMotion) {
    prepareVideo(video);

    // Fallback: si el video no arranca, igual mostramos gate
    fallbackTimer = setTimeout(() => {
      showGateNow();
    }, clampMs(autoShowTextAfterMs, 300, 6000, 900));

    // Intentar play
    tryPlay(video).then((played) => {
      if (!played) showGateNow();
    });

    // Programar gate durante el video
    gateTimer = setTimeout(() => {
      showGateNow();
    }, clampMs(showLangGateAfterMs, 300, 15000, 1500));

  } else {
    // reduce motion: no peleamos con video
    showGateNow();
  }

  // Autocierre opcional
  if (autoCloseAfterMs && autoCloseAfterMs > 0) {
    autoCloseTimer = setTimeout(() => closeIntro(), clampMs(autoCloseAfterMs, 1200, 60000, 0));
  }

  // -------- inner fns --------

  function showGateNow() {
    if (!langGate || !introWelcome) return;

    // Gate visible, welcome oculto
    langGate.classList.remove("is-hidden");
    introWelcome.classList.add("is-hidden");

    // Top lang switch oculto hasta que elijan idioma
    if (langSwitchTop) langSwitchTop.classList.add("is-hidden");
  }

  function bindLanguageGate() {
    if (!langGate || !introWelcome) return;

    if (gateES) {
      const fn = () => chooseLang("es");
      gateES.addEventListener("click", fn);
      listeners.push({ el: gateES, type: "click", fn });
    }

    if (gateEN) {
      const fn = () => chooseLang("en");
      gateEN.addEventListener("click", fn);
      listeners.push({ el: gateEN, type: "click", fn });
    }
  }

  function chooseLang(lang) {
    const safe = (lang === "en") ? "en" : "es";

    // Cambiar a bienvenida
    if (langGate) langGate.classList.add("is-hidden");
    if (introWelcome) introWelcome.classList.remove("is-hidden");
    if (langSwitchTop) langSwitchTop.classList.remove("is-hidden");

    // Notificar a main.js para aplicar i18n
    try {
      window.dispatchEvent(new CustomEvent("musibot:lang", { detail: { lang: safe } }));
    } catch {}
  }

  function applyLangGateStateInitial() {
    if (!langGate || !introWelcome) return;

    // Ocultamos ambos para que NO se vea "Bienvenido" antes del gate
    langGate.classList.add("is-hidden");
    introWelcome.classList.add("is-hidden");
    if (langSwitchTop) langSwitchTop.classList.add("is-hidden");
  }

  function safeUnlock() {
    introLocked = false;
  }

  function clearTimeoutSafe(id) {
    try { if (id) clearTimeout(id); } catch {}
  }
}

/* =========================
   Extra API
========================= */
export function resetIntroSeen() {
  // (Solo afecta la memoria del intro, no hay memoria de idioma ya)
  try { localStorage.removeItem(INTRO_SEEN_KEY); } catch {}
}

/* =========================
   Helpers
========================= */
function hasSeenIntro() {
  try { return localStorage.getItem(INTRO_SEEN_KEY) === "1"; }
  catch { return false; }
}
function setSeenIntro(value) {
  try { localStorage.setItem(INTRO_SEEN_KEY, value ? "1" : "0"); } catch {}
}

function prefersReducedMotion() {
  try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}

function prepareVideo(video) {
  if (!video) return;
  try {
    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.preload = "auto";
  } catch {}
}

async function tryPlay(video) {
  try {
    const p = video.play();
    if (p && typeof p.then === "function") { await p; return true; }
    return !video.paused;
  } catch { return false; }
}

function ensureTextVisible(textEl) {
  if (!textEl) return;
  textEl.classList.remove("hidden");
  textEl.classList.remove("is-hidden");
  textEl.style.display = "";
  textEl.style.visibility = "visible";
  textEl.style.opacity = "1";
  textEl.style.pointerEvents = "auto";
}

function showOverlay(overlay) {
  overlay.style.display = "flex";
  overlay.style.visibility = "visible";
  overlay.style.opacity = "1";
}

function hideOverlay(overlay) {
  overlay.style.display = "none";
}

function clampMs(v, min, max, fallback) {
  const n = Number(v);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function applyI18nToStart(startBtn, t) {
  if (typeof t !== "function") return;
  try { startBtn.textContent = t("app.start", "Empezar"); } catch {}
}

function ensureSkipButton(overlay, t) {
  let btn = overlay.querySelector("[data-intro-skip]");
  if (btn) return btn;

  btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = (typeof t === "function") ? t("lead.leadSkip", "Saltar") : "Saltar";
  btn.setAttribute("data-intro-skip", "1");

  btn.style.position = "absolute";
  btn.style.top = "14px";
  btn.style.right = "14px";
  btn.style.border = "1px solid rgba(255,255,255,.35)";
  btn.style.background = "rgba(15,18,34,.55)";
  btn.style.color = "#fff";
  btn.style.padding = "8px 12px";
  btn.style.borderRadius = "999px";
  btn.style.cursor = "pointer";
  btn.style.backdropFilter = "blur(6px)";
  btn.style.webkitBackdropFilter = "blur(6px)";
  btn.style.fontFamily = "inherit";
  btn.style.fontSize = "0.85rem";
  btn.style.zIndex = "9999";

  overlay.appendChild(btn);
  return btn;
}
