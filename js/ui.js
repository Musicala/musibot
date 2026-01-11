// ui.js (v5.9)
// ============================
// Render de interfaz (chat + chips del FLOW + gate de idioma)
// Objetivo 2026:
// ✅ Abajo SOLO hay chips del flujo. Nada de FAQ/Inicio/Reiniciar/WhatsApp.
// ✅ Idioma: gate con chips ui:lang (value: "es" | "en") que sí dispara acción en main.js.
// ✅ ComposerMode automático (text vs chips) basado en último botMsg y/o msg._flow.allowFreeText.
// ✅ Mejor manejo teclado móvil: al enviar o tocar chip, se cierra teclado y se mantiene visible el chat.
// ✅ Soporte de media robusto (audio/image/video/link) + estados (loading/error).
// ✅ Autoplay "best effort": intenta reproducir audio al renderizar;
//    si el navegador bloquea, se reproduce automáticamente en la primera interacción del usuario.
// ✅ v5.7:
//    - Si un mensaje trae IMAGEN (y NO trae audio/video), renderiza IMAGEN primero y luego TEXTO.
//    - Imágenes más pequeñas (maxWidth/maxHeight) para que no se coman el chat.
// ✅ v5.8:
//    - FAQ en acordeón: se abre/cierra y solo una abierta a la vez.
//    - FAQ soporta *negrita* _cursiva_ y saltos de línea.
// ✅ v5.9:
//    - FAQ soporta directiva @img:URL (renderiza imagen, no texto).
//    - Soporte opcional @link:URL|Texto (renderiza link bonito).
//    - Sanitización mínima de URLs en FAQ para evitar rutas raras.
// ✅ Sin lógica de negocio: solo UI.
// ============================

/* =========================
   REFERENCIAS DOM
========================= */
const $chat   = document.getElementById("chat");
const $quick  = document.getElementById("quick");
const $form   = document.getElementById("form");
const $input  = document.getElementById("input");
const $submit = $form ? $form.querySelector('button[type="submit"]') : null;

const $btnReset = document.getElementById("btnReset");
const $faqBody  = document.getElementById("faqBody");

// Placeholder original
const DEFAULT_PLACEHOLDER = $input ? ($input.getAttribute("placeholder") || "") : "";

/* =========================
   AUTOPLAY STATE
========================= */
// Para no intentar autoplay infinitamente al re-renderizar historial.
const AUTO_PLAYED = new Set(); // urls ya reproducidas o intentadas
let PENDING_AUTOPLAY = null;   // { audioEl, url, statusEl, buttonEl }

function armAutoplayOnFirstUserGesture() {
  if (armAutoplayOnFirstUserGesture._armed) return;
  armAutoplayOnFirstUserGesture._armed = true;

  const tryPlay = async () => {
    if (!PENDING_AUTOPLAY?.audioEl) return;

    const { audioEl, url, statusEl, buttonEl } = PENDING_AUTOPLAY;

    try {
      await audioEl.play();
      if (statusEl) statusEl.textContent = "";
      if (buttonEl) buttonEl.style.display = "none";
      PENDING_AUTOPLAY = null;
      AUTO_PLAYED.add(url);
    } catch {
      // Si falla incluso con gesto, queda el botón/control nativo
    }
  };

  window.addEventListener("pointerdown", tryPlay, { passive: true });
  window.addEventListener("touchstart", tryPlay, { passive: true });
  window.addEventListener("keydown", tryPlay, { passive: true });
}

/* =========================
   COMPOSER MODE
========================= */
export function setComposerMode(mode = "chips") {
  const allowText = mode === "text";

  if ($input) {
    $input.disabled = !allowText;

    if (!allowText) {
      $input.setAttribute("placeholder", getBlockedPlaceholder());
    } else {
      if (DEFAULT_PLACEHOLDER) $input.setAttribute("placeholder", DEFAULT_PLACEHOLDER);
    }
  }

  if ($submit) $submit.disabled = !allowText;

  if (allowText) focusInput();
}

/* =========================
   HELPERS UI
========================= */
export function scrollToBottom(smooth = true) {
  if (!$chat) return;
  try {
    const top = $chat.scrollHeight;
    if (smooth && typeof $chat.scrollTo === "function") {
      $chat.scrollTo({ top, behavior: "smooth" });
    } else {
      $chat.scrollTop = top;
    }
  } catch {
    $chat.scrollTop = $chat.scrollHeight;
  }
}

export function focusInput() {
  if (!$input || $input.disabled) return;
  try {
    $input.focus({ preventScroll: true });
  } catch {
    $input.focus();
  }
}

function blurInput() {
  try { $input?.blur(); } catch {}
}

function getLangFromDOM() {
  const root = document.documentElement;
  const lang = (root?.dataset?.lang || root?.lang || "es").toLowerCase();
  return lang === "en" ? "en" : "es";
}

function getBlockedPlaceholder() {
  const lang = getLangFromDOM();
  return lang === "en" ? "Use the buttons above 👆" : "Usa los botones de arriba 👆";
}

function nowTime(ts) {
  try {
    return new Date(ts || Date.now()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function isCaptureStage(state) {
  return Boolean(state?.memory?.capture?.stage);
}

function isLangGate(state) {
  return state?.memory?.ui?.stage === "lang";
}

/* =========================
   COMPOSER AUTO MODE (v5.7+)
========================= */
// Regla principal:
// - si el último botMsg dice _flow.allowFreeText === true => habilitar texto
// - si hay opciones en el último botMsg => solo botones
// - fallback: texto habilitado (para no romper capturas antiguas)
function applyComposerModeFromState(state) {
  const history = state?.history || [];

  const lastBot = [...history].reverse().find((m) => m?.from === "bot");
  const hasOptions = Array.isArray(lastBot?.options) && lastBot.options.length > 0;

  const flowAllow =
    lastBot?._flow?.allowFreeText === true ? true :
    lastBot?._flow?.allowFreeText === false ? false :
    null;

  // Gate de idioma: siempre chips
  if (isLangGate(state)) {
    setComposerMode("chips");
    return;
  }

  // Si flow dictó explícito
  if (flowAllow === true) {
    setComposerMode("text");
    return;
  }
  if (flowAllow === false) {
    setComposerMode("chips");
    return;
  }

  // Fallback: si hay opciones, chips; si no, texto
  if (hasOptions) setComposerMode("chips");
  else setComposerMode("text");
}

/* =========================
   RENDER
========================= */

// Render inicial (historial completo)
export function renderAll(state) {
  if (!$chat) return;
  $chat.innerHTML = "";
  (state?.history || []).forEach((m) => appendMessage(m, { fromRenderAll: true }));

  renderChips(state);
  applyComposerModeFromState(state);

  scrollToBottom(false);
}

// Helper: inserta media y trackea el último audio para autoplay
function appendMedia(bubble, mediaList, track) {
  if (!mediaList.length) return;

  const mediaWrap = document.createElement("div");
  mediaWrap.className = "msgmedia";

  mediaList.forEach((m) => {
    const item = document.createElement("div");
    item.className = "mediaitem";

    if (m.type === "audio") {
      const { el, audioEl, statusEl, playBtnEl } = renderAudio(m.url);
      item.appendChild(el);

      // Autoplay: best-effort sobre el último audio del mensaje
      track.lastAudioEl = audioEl;
      track.lastAudioUrl = m.url;
      track.lastAudioStatusEl = statusEl;
      track.lastAudioBtnEl = playBtnEl;
    } else if (m.type === "image") {
      item.appendChild(renderImage(m.url, { maxWidth: 600, maxHeight: 360 }));
    } else if (m.type === "video") {
      item.appendChild(renderVideo(m.url));
    } else {
      item.appendChild(renderLink(m.url));
    }

    mediaWrap.appendChild(item);
  });

  bubble.appendChild(mediaWrap);
}

// Render incremental (un solo mensaje)
export function appendMessage(msg, opts = {}) {
  if (!$chat || !msg) return;

  const row = document.createElement("div");
  row.className = `row ${msg.from || "bot"}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${msg.from || "bot"}`;

  // Media list (lo calculamos antes para decidir orden)
  const mediaList = normalizeMedia(msg.media);

  // v5.7: si hay IMAGEN y NO hay audio/video => media primero
  const hasImage = mediaList.some(m => m.type === "image");
  const hasAudio = mediaList.some(m => m.type === "audio");
  const hasVideo = mediaList.some(m => m.type === "video");
  const mediaFirst = hasImage && !hasAudio && !hasVideo;

  // Track para autoplay de audio
  const track = {
    lastAudioEl: null,
    lastAudioUrl: "",
    lastAudioStatusEl: null,
    lastAudioBtnEl: null
  };

  // 1) Media primero (si aplica)
  if (mediaFirst) {
    appendMedia(bubble, mediaList, track);
  }

  // 2) Texto
  const text = String(msg.text || "");
  if (text) {
    bubble.appendChild(renderRichText(text));
  }

  // 3) Media después (si no aplicó mediaFirst)
  if (!mediaFirst) {
    appendMedia(bubble, mediaList, track);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = nowTime(msg.ts);

  row.appendChild(bubble);
  row.appendChild(meta);
  $chat.appendChild(row);

  scrollToBottom(false);

  // Autoplay best-effort SOLO en mensajes nuevos (no al reconstruir historial)
  if (!opts.fromRenderAll && track.lastAudioEl && track.lastAudioUrl) {
    tryAutoplayAudio(track.lastAudioEl, track.lastAudioUrl, track.lastAudioStatusEl, track.lastAudioBtnEl);
  }
}

/* =========================
   AUTOPLAY LOGIC
========================= */
async function tryAutoplayAudio(audioEl, url, statusEl, buttonEl) {
  if (!audioEl || !url) return;
  if (AUTO_PLAYED.has(url)) return;

  armAutoplayOnFirstUserGesture();

  try {
    audioEl.preload = "auto";
    await audioEl.play();

    if (statusEl) statusEl.textContent = "";
    if (buttonEl) buttonEl.style.display = "none";

    AUTO_PLAYED.add(url);
    PENDING_AUTOPLAY = null;
  } catch {
    if (statusEl) statusEl.textContent = "Toca la pantalla o el botón para escuchar 🎧";
    if (buttonEl) buttonEl.style.display = "inline-flex";
    PENDING_AUTOPLAY = { audioEl, url, statusEl, buttonEl };
  }
}

/* =========================
   CHIPS
========================= */
export function renderChips(state) {
  if (!$quick) return;
  $quick.innerHTML = "";

  // 0) Gate de idioma (prioridad absoluta)
  if (isLangGate(state)) {
    const current = getLangFromDOM();
    const langLabel = (code) => {
      if (code === "es") return current === "en" ? "Spanish (ES)" : "Español (ES)";
      return current === "en" ? "English (EN)" : "Inglés (EN)";
    };

    $quick.appendChild(makeChip(langLabel("es"), "ui:lang", "es"));
    $quick.appendChild(makeChip(langLabel("en"), "ui:lang", "en"));
    return;
  }

  // 1) Opciones del último mensaje del bot con options
  const history = state?.history || [];
  const lastBotWithOptions = [...history]
    .reverse()
    .find((m) => m?.from === "bot" && Array.isArray(m.options) && m.options.length);

  const options = normalizeOptions(lastBotWithOptions?.options);

  // Si estamos en captura, no distraemos con chips salvo que el flow los haya puesto.
  if (isCaptureStage(state) && options.length === 0) return;

  options.forEach((opt) => {
    $quick.appendChild(makeChip(opt.label, opt.kind || "option", opt.value));
  });
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => {
      if (typeof o === "string") return { label: o, value: o, kind: "option" };
      if (o && typeof o === "object") {
        const label = String(o.label || o.text || o.value || "").trim();
        const value = String(o.value ?? label).trim();
        const kind  = String(o.kind || "option");
        if (!label) return null;
        return { label, value, kind };
      }
      return null;
    })
    .filter(Boolean);
}

/* =========================
   EVENTOS
========================= */

// Mantener conversación visible cuando aparece teclado móvil
function bindViewportGuard() {
  if (!("visualViewport" in window) || !window.visualViewport) return;
  const vv = window.visualViewport;

  let t = null;
  const onChange = () => {
    clearTimeout(t);
    t = setTimeout(() => scrollToBottom(false), 50);
  };

  vv.addEventListener("resize", onChange, { passive: true });
  vv.addEventListener("scroll", onChange, { passive: true });
}

export function bindForm(onSubmit) {
  if (!$form || !$input) return;

  if ($form.dataset.bound === "1") return;
  $form.dataset.bound = "1";

  bindViewportGuard();

  $form.addEventListener("submit", (e) => {
    e.preventDefault();
    if ($input.disabled) return;

    const value = $input.value.trim();
    if (!value) return;

    onSubmit(value);
    $input.value = "";

    // Cerrar teclado móvil y mantener conversación visible
    blurInput();
    scrollToBottom(false);
  });

  $input.addEventListener("focus", () => {
    setTimeout(() => scrollToBottom(false), 50);
  });
}

// Botón reiniciar (topbar)
export function bindReset(onReset) {
  if (!$btnReset) return;

  if ($btnReset.dataset.bound === "1") return;
  $btnReset.dataset.bound = "1";

  $btnReset.addEventListener("click", () => onReset());
}

// Manejo de clicks en chips
export function bindChips(onChip) {
  if (!$quick) return;

  if ($quick.dataset.bound === "1") return;
  $quick.dataset.bound = "1";

  $quick.addEventListener("click", (e) => {
    const btn = e.target.closest("button.chip");
    if (!btn) return;

    const value = btn.dataset.value;
    const kind  = btn.dataset.kind;
    if (!value) return;

    // Cerrar teclado móvil y mantener conversación visible
    blurInput();

    // Bonus: si hay autoplay pendiente, intentamos reproducir en este gesto
    if (PENDING_AUTOPLAY?.audioEl) {
      try { PENDING_AUTOPLAY.audioEl.play(); } catch {}
    }

    onChip(value, kind);
    scrollToBottom(false);
  });
}

/* =========================
   HOOK: re-apply composer mode
========================= */
export function syncComposerMode(state) {
  applyComposerModeFromState(state);
}

/* =========================
   FAQ (Acordeón v5.9)
========================= */
export function renderFAQ(items = []) {
  if (!$faqBody) return;
  $faqBody.innerHTML = "";

  const escHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const safeUrl = (url) => {
    const u = String(url || "").trim();
    if (!u) return "";
    // Permitimos rutas relativas y http(s). Bloqueamos javascript: por obvias razones.
    const low = u.toLowerCase();
    if (low.startsWith("javascript:")) return "";
    return u;
  };

  // Formato mínimo: *negrita* _cursiva_ y saltos de línea
  // + Directivas:
  // - @img:./assets/Ubicación.jpeg
  // - @link:https://...|Texto opcional
  const formatFAQ = (txt = "") => {
    const raw = String(txt || "").trim();

    // ✅ Directiva imagen
    if (raw.startsWith("@img:")) {
      const url = safeUrl(raw.slice(5).trim());
      if (!url) return "<em>Imagen no disponible</em>";
      // Usamos el mismo renderer de imágenes, pero en HTML string
      // (manteniendo estilos con clase para CSS)
      return `<img src="${escHtml(url)}" alt="Ubicación Musicala" class="faq-img" loading="lazy" decoding="async">`;
    }

    // ✅ Directiva link (opcional)
    if (raw.startsWith("@link:")) {
      const rest = raw.slice(6).trim();
      const [urlRaw, labelRaw] = rest.split("|");
      const url = safeUrl((urlRaw || "").trim());
      const label = String((labelRaw || urlRaw || "Abrir enlace").trim());
      if (!url) return "<em>Enlace no disponible</em>";
      return `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">${escHtml(label)}</a>`;
    }

    // Markdown simple
    let out = escHtml(raw);
    out = out.replace(/\*(.+?)\*/g, "<strong>$1</strong>");
    out = out.replace(/_(.+?)_/g, "<em>$1</em>");
    out = out.replace(/\n/g, "<br>");
    return out;
  };

  (items || []).forEach((it, idx) => {
    const details = document.createElement("details");
    details.className = "faq-item";
    details.dataset.idx = String(idx);

    const summary = document.createElement("summary");
    summary.className = "faq-q";
    summary.innerHTML = formatFAQ(it?.q || "");

    const answer = document.createElement("div");
    answer.className = "faq-a";
    answer.innerHTML = formatFAQ(it?.a || "");

    details.appendChild(summary);
    details.appendChild(answer);
    $faqBody.appendChild(details);

    // Acordeón: solo una abierta
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      [...$faqBody.querySelectorAll("details.faq-item[open]")].forEach((d) => {
        if (d !== details) d.open = false;
      });
    });
  });
}

/* =========================
   MEDIA RENDERERS
========================= */
function renderAudio(url) {
  const wrap = document.createElement("div");
  wrap.className = "media-audio";

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "metadata";
  audio.src = url;

  const status = document.createElement("div");
  status.className = "mediastatus";
  status.textContent = "";

  // Botón extra
  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "chip";
  playBtn.textContent = "Reproducir";
  playBtn.style.display = "none";

  playBtn.addEventListener("click", async () => {
    try {
      await audio.play();
      status.textContent = "";
      playBtn.style.display = "none";
      AUTO_PLAYED.add(url);
      if (PENDING_AUTOPLAY?.url === url) PENDING_AUTOPLAY = null;
    } catch {
      // queda control nativo
    }
  });

  audio.addEventListener("error", () => {
    status.textContent = "No pude cargar el audio 😅 (revisa la ruta del archivo)";
    playBtn.style.display = "none";
  });

  audio.addEventListener("play", () => {
    if (status.textContent && status.textContent.includes("escuchar")) status.textContent = "";
    playBtn.style.display = "none";
  });

  wrap.appendChild(audio);
  wrap.appendChild(status);
  wrap.appendChild(playBtn);

  return { el: wrap, audioEl: audio, statusEl: status, playBtnEl: playBtn };
}

function renderImage(url, opts = {}) {
  const img = document.createElement("img");
  img.src = url;
  img.alt = "Imagen";
  img.loading = "lazy";
  img.decoding = "async";

  const maxWidth  = opts.maxWidth  ?? 600;
  const maxHeight = opts.maxHeight ?? 360;

  // Tamaño controlado (tarjeta, no sábana)
  img.style.width = "100%";
  img.style.maxWidth = `${maxWidth}px`;
  img.style.maxHeight = `${maxHeight}px`;
  img.style.objectFit = "contain";
  img.style.display = "block";
  img.style.margin = "8px auto 0";

  img.addEventListener("error", () => {
    img.alt = "No se pudo cargar la imagen";
  });

  return img;
}

function renderVideo(url) {
  const video = document.createElement("video");
  video.controls = true;
  video.preload = "metadata";
  video.src = url;
  video.playsInline = true;
  video.addEventListener("error", () => {
    video.replaceWith(renderLink(url));
  });
  return video;
}

function renderLink(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = url;
  return a;
}

/* =========================
   UTILS
========================= */
function makeChip(text, kind, valueOverride) {
  const label = String(text ?? "").trim();
  const value = String(valueOverride ?? label).trim();

  const btn = document.createElement("button");
  btn.className = "chip";
  btn.type = "button";
  btn.textContent = label;

  btn.dataset.value = value;
  btn.dataset.kind  = kind;
  btn.setAttribute("aria-label", label);

  return btn;
}

// Texto con URLs clicables (chat)
function renderRichText(text) {
  const frag = document.createDocumentFragment();
  const parts = splitByUrls(String(text || ""));

  parts.forEach((part) => {
    if (part.type === "url") {
      const a = document.createElement("a");
      a.href = part.value;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = part.value;
      frag.appendChild(a);
    } else {
      frag.appendChild(document.createTextNode(part.value));
    }
  });

  return frag;
}

function splitByUrls(text) {
  const out = [];
  const re = /(https?:\/\/[^\s]+)/gi;
  let last = 0;
  let m;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "url", value: m[1] });
    last = m.index + m[1].length;
  }

  if (last < text.length) out.push({ type: "text", value: text.slice(last) });

  return out.length ? out : [{ type: "text", value: text }];
}

function normalizeMedia(media) {
  if (!media) return [];

  const arr = Array.isArray(media) ? media : [media];

  return arr
    .map((m) => {
      if (m && typeof m === "object") {
        const url = String(m.url || m.src || m.href || "").trim();
        if (!url) return null;
        const type = String(m.type || inferMediaType(url)).trim();
        return { type, url };
      }
      if (typeof m === "string") {
        const url = m.trim();
        if (!url) return null;
        return { type: inferMediaType(url), url };
      }
      return null;
    })
    .filter(Boolean);
}

function inferMediaType(url = "") {
  const u = String(url).toLowerCase().split("?")[0];

  if (u.endsWith(".mp3") || u.endsWith(".wav") || u.endsWith(".ogg") || u.endsWith(".m4a")) return "audio";
  if (u.endsWith(".png") || u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".webp") || u.endsWith(".gif")) return "image";
  if (u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov")) return "video";
  return "link";
}
