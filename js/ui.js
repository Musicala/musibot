// ui.js (v6.3.0)
// ============================
// Render de interfaz (chat + chips del FLOW + gate de idioma)
//
// Objetivo 2026:
// ✅ Abajo SOLO hay chips del flujo. Nada de FAQ/Inicio/Reiniciar/WhatsApp “manual”.
// ✅ Idioma: gate con chips ui:lang (value: "es" | "en") que dispara acción en main.js.
// ✅ ComposerMode automático (text vs chips) basado en último botMsg y/o msg._flow.allowFreeText.
// ✅ Mejor manejo teclado móvil: al enviar o tocar chip, se cierra teclado y se mantiene visible el chat.
// ✅ Soporte media robusto (audio/image/video/link) + estados (loading/error).
// ✅ Autoplay "best effort": intenta reproducir audio al renderizar;
//    si el navegador bloquea, se reproduce en la primera interacción del usuario.
//
// Mejoras clave v6.3.0:
// ✅ FIX: en captura de nombre/teléfono, si no vienen options, se renderiza fallback estable:
//    "Prefiero no dejarlo" / "Prefer not to share"
// ✅ FIX: si options vienen como strings u objetos, se normalizan igual.
// ✅ FIX: heurística de composer mode más robusta durante captura.
// ✅ MEJORA: filtro WhatsApp más defensivo.
// ✅ MEJORA: render de media y links más tolerante.
// ============================

/* =========================
   REFERENCIAS DOM
========================= */
const $chat   = document.getElementById("chat");
const $quick  = document.getElementById("quick");
const $composer = document.querySelector(".composer");
const $quickPickerWrap = document.getElementById("quickPickerWrap");
const $quickPicker = document.getElementById("quickPicker");
const $form   = document.getElementById("form");
const $input  = document.getElementById("input");
const $submit = $form ? $form.querySelector('button[type="submit"]') : null;

const $btnReset = document.getElementById("btnReset");
const $faqBody  = document.getElementById("faqBody");

// Placeholder original
const DEFAULT_PLACEHOLDER = $input ? ($input.getAttribute("placeholder") || "") : "";
let LAST_QUICK_OPTIONS = [];
let FORM_BUSY = false;

/* =========================
   AUTOPLAY STATE
========================= */
const AUTO_PLAYED = new Set();
let PENDING_AUTOPLAY = null; // { audioEl, url, statusEl, buttonEl }

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
      // si falla incluso con gesto, queda el control nativo
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
    // El compositor permanece escribible siempre; el modo solo cambia la guia visual.
    $input.disabled = FORM_BUSY;

    if (!allowText) {
      $input.setAttribute("placeholder", getBlockedPlaceholder());
    } else if (DEFAULT_PLACEHOLDER) {
      $input.setAttribute("placeholder", DEFAULT_PLACEHOLDER);
    }
  }

  if ($submit) $submit.disabled = FORM_BUSY;

  if (allowText) focusInput();
}

export function setComposerBusy(busy = false) {
  FORM_BUSY = Boolean(busy);
  if ($composer) {
    $composer.classList.toggle("is-ai-busy", FORM_BUSY);
    $composer.setAttribute("aria-busy", FORM_BUSY ? "true" : "false");
  }
  if ($input) {
    $input.disabled = FORM_BUSY;
    if (FORM_BUSY) {
      $input.setAttribute("placeholder", "Revisando la mejor respuesta...");
    } else if (DEFAULT_PLACEHOLDER) {
      $input.setAttribute("placeholder", DEFAULT_PLACEHOLDER);
    }
  }
  if ($submit) {
    $submit.disabled = FORM_BUSY;
    $submit.classList.toggle("is-loading", FORM_BUSY);
  }
}

/* =========================
   HELPERS UI
========================= */
let _scrollT = null;

export function scrollToBottom(smooth = true) {
  if (!$chat) return;

  if (_scrollT) cancelAnimationFrame(_scrollT);
  _scrollT = requestAnimationFrame(() => {
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
  });
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

function setInputActive(active) {
  const isActive = Boolean(active && isMobileViewport());
  const root = document.documentElement;
  if (root) root.classList.toggle("is-input-active", isActive);
  if ($composer) $composer.classList.toggle("is-typing", isActive);
}

function keepComposerVisible() {
  if (!$composer) return;

  requestAnimationFrame(() => {
    try {
      $composer.scrollIntoView({ block: "end", inline: "nearest" });
    } catch {}
    scrollToBottom(false);
  });
}

function applyViewportMetrics() {
  const root = document.documentElement;
  if (!root) return;

  const vv = window.visualViewport;
  const visibleHeight = Math.round(vv?.height || window.innerHeight || root.clientHeight || 0);
  const layoutHeight = Math.max(
    window.innerHeight || 0,
    root.clientHeight || 0
  );
  const keyboardInset = vv
    ? Math.max(0, Math.round(layoutHeight - vv.height - vv.offsetTop))
    : 0;

  root.style.setProperty("--app-height", `${visibleHeight || 0}px`);
  root.style.setProperty("--keyboard-offset", `${keyboardInset}px`);
  root.classList.toggle("keyboard-open", isMobileViewport() && keyboardInset > 120);

  if (document.activeElement === $input) {
    keepComposerVisible();
  }
}

function getLangFromDOM() {
  const root = document.documentElement;
  const lang = (root?.dataset?.lang || root?.lang || "es").toLowerCase();
  return lang === "en" ? "en" : "es";
}

function t(es, en) {
  return getLangFromDOM() === "en" ? en : es;
}

function normalizeEmojiText(text = "") {
  try {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  } catch {
    return String(text || "").toLowerCase().trim();
  }
}

function hasEmoji(text = "") {
  if (!hasEmoji._re) {
    try {
      hasEmoji._re = new RegExp("\\p{Extended_Pictographic}", "u");
    } catch {
      hasEmoji._re = /[\u{1F300}-\u{1FAFF}]/u;
    }
  }

  return hasEmoji._re.test(String(text || ""));
}

const EMOJI_RULES = [
  { emoji: "\u{1F44B}", patterns: [/^hola\b/, /^hello\b/, /\bbienvenid/, /\bwelcome\b/] },
  { emoji: "\u2728", patterns: [/^gracias\b/, /^thanks\b/, /^perfect\b/, /^genial\b/, /^great\b/, /^super\b/] },
  { emoji: "\u{1F3B6}", patterns: [/\bmusica\b/, /\bmusic\b/, /\binstrument/, /\bcanto\b/, /\bvocal\b/] },
  { emoji: "\u{1F483}", patterns: [/\bdanza\b/, /\bdance\b/, /\bbaile\b/, /\bballet\b/, /\bhip hop\b/] },
  { emoji: "\u{1F3AD}", patterns: [/\bteatro\b/, /\btheatre\b/, /\btheater\b/, /\bactuacion\b/, /\bimpro\b/] },
  { emoji: "\u{1F3A8}", patterns: [/\bartes plasticas\b/, /\bvisual arts\b/, /\bpintura\b/, /\bdibujo\b/, /\bmanualidades\b/, /\bart\b/] },
  { emoji: "\u{1F4CD}", patterns: [/\bubicacion\b/, /\blocation\b/, /\bdireccion\b/, /\bmaps\b/, /\bdonde\b/] },
  { emoji: "\u{1F552}", patterns: [/\bhorarios\b/, /\bschedule\b/, /\bhours\b/, /\bdisponibilidad\b/, /\bavailability\b/] },
  { emoji: "\u{1F4B8}", patterns: [/\bprecios\b/, /\bpricing\b/, /\bprice\b/, /\bcosto\b/, /\bcost\b/, /\bvalor\b/] },
  { emoji: "\u{1F4DD}", patterns: [/\binscripcion\b/, /\benrollment\b/, /\bmatricula\b/, /\bformulario\b/, /\bform\b/, /\bregistro\b/] },
  { emoji: "\u{1F4B3}", patterns: [/\bpago\b/, /\bpayments?\b/, /\bpayment\b/, /\btransferencia\b/, /\bcard\b/, /\btarjeta\b/] },
  { emoji: "\u{1F469}\u200D\u{1F3EB}", patterns: [/\bdocentes\b/, /\bteachers\b/, /\bprofes\b/, /\bprofessors?\b/, /\bmaestros?\b/] },
  { emoji: "\u{1F680}", patterns: [/\bmetodologia\b/, /\bmethodology\b/, /\bmetodo\b/, /\bcrea\b/, /\bruta\b/, /\bpath\b/] },
  { emoji: "\u{1F476}", patterns: [/\b1 a 3\b/, /\b1 to 3\b/, /\bmusibabies\b/] },
  { emoji: "\u{1F9D2}", patterns: [/\b4 a 6\b/, /\b4 to 6\b/, /\bmusicalitos\b/] },
  { emoji: "\u{1F392}", patterns: [/\b7 a 11\b/, /\b7 to 11\b/, /\bmusikids\b/] },
  { emoji: "\u{1F525}", patterns: [/\b12 a 15\b/, /\b12 to 15\b/, /\bmusiteens\b/] },
  { emoji: "\u{1F3AF}", patterns: [/\b16 a 50\b/, /\b16 to 50\b/, /\bmusigrandes\b/, /\bobjetivo\b/, /\bgoal\b/] },
  { emoji: "\u{1F31F}", patterns: [/\b50 en adelante\b/, /\b50 and up\b/, /\bmusiadultos\b/] },
  { emoji: "\u{1F3EB}", patterns: [/\ben sede\b/, /\bon-site\b/, /\bpresencial\b/, /\bcampus\b/] },
  { emoji: "\u{1F3E0}", patterns: [/\bhogar\b/, /\bat home\b/, /\ba domicilio\b/] },
  { emoji: "\u{1F4BB}", patterns: [/\bvirtual\b/, /\bonline\b/, /\bplataforma\b/, /\blive classes\b/] },
  { emoji: "\u2744\uFE0F", patterns: [/\bvacacional/, /\bholiday\b/, /\bvacaciones\b/, /\bbreak\b/] },
  { emoji: "\u{1F39F}\uFE0F", patterns: [/\bplan(es)?\b/, /\bpackage\b/, /\bpackages\b/, /\bplanes\b/, /\bcupos\b/, /\bspots\b/] },
  { emoji: "\u{1F389}", patterns: [/\botros servicios\b/, /\bother services\b/, /\beventos\b/, /\bevents\b/, /\btienda\b/, /\bstore\b/] },
  { emoji: "\u{1F4AC}", patterns: [/\bwhatsapp\b/, /\basesor\b/, /\badvisor\b/, /\bhumano\b/, /\bhuman\b/, /\bcontacto\b/] },
  { emoji: "\u{1F914}", patterns: [/\bfaq\b/, /\bpreguntas frecuentes\b/, /\bquestions\b/, /\bhelp\b/, /\bayuda\b/] },
  { emoji: "\u21A9\uFE0F", patterns: [/\bvolver\b/, /\bback\b/, /\bmenu\b/, /\bhome\b/, /\bregresar\b/] }
];

function detectEmojiForText(text = "") {
  const clean = normalizeEmojiText(text);
  if (!clean) return "";

  const rule = EMOJI_RULES.find(({ patterns }) =>
    patterns.some((re) => re.test(clean))
  );

  return rule?.emoji || "";
}

function decorateLineWithEmoji(line = "") {
  const raw = String(line || "");
  if (!raw.trim()) return raw;
  if (hasEmoji(raw)) return raw;
  if (/^\s*(https?:\/\/|www\.|@img:|@link:)/i.test(raw)) return raw;

  const match = raw.match(/^(\s*(?:[-*\u2022]\s+|\d+[.)]\s+)?)(.*)$/);
  const prefix = match?.[1] || "";
  const body = match?.[2] || raw;
  const emoji = detectEmojiForText(body);
  if (!emoji) return raw;

  return `${prefix}${emoji} ${body}`;
}

function decorateVisibleText(text = "", mode = "multiline") {
  const raw = String(text || "");
  if (!raw.trim()) return raw;

  if (mode === "single") {
    if (hasEmoji(raw)) return raw;
    return decorateLineWithEmoji(raw);
  }

  return raw
    .split("\n")
    .map((line) => decorateLineWithEmoji(line))
    .join("\n");
}

function getBlockedPlaceholder() {
  return t(
    "Usa los botones de arriba o escribe tu pregunta 👆",
    "Use the buttons above or type your question 👆"
  );
}

function isMobileViewport() {
  try {
    return window.matchMedia("(max-width: 899px)").matches;
  } catch {
    return false;
  }
}

function toQuickLabel(text = "") {
  return decorateVisibleText(text, "single").replace(/\s+/g, " ").trim();
}

function updateMobileQuickPicker(options = []) {
  const safeOptions = Array.isArray(options) ? options.filter(Boolean) : [];
  const useSelect = Boolean($quickPickerWrap && $quickPicker && isMobileViewport() && safeOptions.length >= 3);

  if ($composer) {
    $composer.dataset.quickUi = useSelect ? "select" : "chips";
  }

  if (!$quickPickerWrap || !$quickPicker) return;

  $quickPickerWrap.hidden = !useSelect;
  $quickPicker.innerHTML = "";

  if (!useSelect) return;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("Elegir una opción rápida...", "Choose a quick option...");
  placeholder.disabled = true;
  placeholder.selected = true;
  $quickPicker.appendChild(placeholder);

  safeOptions.forEach((opt) => {
    const label = toQuickLabel(opt?.label || opt?.value || "");
    const value = String(opt?.value ?? label).trim();
    if (!label || !value) return;

    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.dataset.kind = String(opt?.kind || "option");
    option.dataset.label = label;
    $quickPicker.appendChild(option);
  });

  $quickPicker.selectedIndex = 0;
}

function renderQuickTargets(options = []) {
  const safeOptions = Array.isArray(options) ? options.filter(Boolean) : [];
  LAST_QUICK_OPTIONS = safeOptions;

  updateMobileQuickPicker(safeOptions);

  if (!$quick) return;

  $quick.innerHTML = "";
  safeOptions.forEach((opt) => {
    $quick.appendChild(makeChip(opt.label, opt.kind || "option", opt.value));
  });
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

function getCaptureStage(state) {
  const stage = state?.memory?.capture?.stage;
  return stage === "name" || stage === "phone" ? stage : null;
}

function isLangGate(state) {
  return state?.memory?.ui?.stage === "lang";
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/* =========================
   WHATSAPP CHIP VISIBILITY
========================= */
function isWhatsAppChip(opt) {
  const kind = String(opt?.kind || "").toLowerCase();
  const label = String(opt?.label || "").toLowerCase();
  const value = String(opt?.value || "").toLowerCase();

  if (kind === "global:whatsapp") return true;
  if (label.includes("whatsapp")) return true;
  if (value.includes("whatsapp")) return true;
  if (label.includes("wa.me")) return true;
  if (value.includes("wa.me")) return true;

  return false;
}

function isFlowClosing(state) {
  const name = String(
    state?.progress?.lastNodeName ||
    state?.progress?.lastNodeId ||
    state?.currentNodeId ||
    ""
  ).toLowerCase();

  if (/\bcierre\b|\bfinal\b|\binscrip\b|\bconfirm\b|\bpago\b|\bcupo\b|\bready\b/.test(name)) {
    return true;
  }

  try {
    const history = Array.isArray(state?.history) ? state.history : [];
    const lastBot = [...history].reverse().find(m => m?.from === "bot");
    const flow = isObj(lastBot?._flow) ? lastBot._flow : {};

    if (flow.isClosing === true) return true;

    const hints = Array.isArray(flow.actionHints) ? flow.actionHints : [];
    const hintText = hints.join(" ").toLowerCase();
    if (
      hintText.includes("close") ||
      hintText.includes("cierre") ||
      hintText.includes("whatsapp_ready") ||
      hintText.includes("ready_for_whatsapp")
    ) {
      return true;
    }

    const action = String(flow.action || "").toUpperCase();
    if (action === "WHATSAPP") return true;
  } catch {}

  return false;
}

/* =========================
   COMPOSER AUTO MODE
========================= */
function applyComposerModeFromState(state) {
  const history = Array.isArray(state?.history) ? state.history : [];
  const lastBot = [...history].reverse().find((m) => m?.from === "bot");

  const hasOptions = Array.isArray(lastBot?.options) && lastBot.options.length > 0;

  const flowAllow =
    lastBot?._flow?.allowFreeText === true ? true :
    lastBot?._flow?.allowFreeText === false ? false :
    null;

  if (isLangGate(state)) {
    setComposerMode("chips");
    return;
  }

  // Durante captura, normalmente se espera texto, aunque exista un chip de omitir.
  if (getCaptureStage(state)) {
    setComposerMode("text");
    return;
  }

  if (flowAllow === true) {
    setComposerMode("text");
    return;
  }

  if (flowAllow === false) {
    setComposerMode("chips");
    return;
  }

  if (hasOptions) setComposerMode("chips");
  else setComposerMode("text");
}

/* =========================
   RENDER
========================= */
export function renderAll(state) {
  if (!$chat) return;

  $chat.innerHTML = "";
  (state?.history || []).forEach((m) => appendMessage(m, { fromRenderAll: true }));

  renderChips(state);
  applyComposerModeFromState(state);
  scrollToBottom(false);
}

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

      track.lastAudioEl = audioEl;
      track.lastAudioUrl = m.url;
      track.lastAudioStatusEl = statusEl;
      track.lastAudioBtnEl = playBtnEl;
    } else if (m.type === "image") {
      item.appendChild(renderImage(m.url, { maxWidth: 560, maxHeight: 340 }));
    } else if (m.type === "video") {
      item.appendChild(renderVideo(m.url));
    } else {
      item.appendChild(renderLink(m.url));
    }

    mediaWrap.appendChild(item);
  });

  bubble.appendChild(mediaWrap);
}

export function appendMessage(msg, opts = {}) {
  if (!$chat || !msg) return;

  const row = document.createElement("div");
  row.className = `row ${msg.from || "bot"}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${msg.from || "bot"}`;

  const mediaList = normalizeMedia(msg.media);

  const hasImage = mediaList.some(m => m.type === "image");
  const hasAudio = mediaList.some(m => m.type === "audio");
  const hasVideo = mediaList.some(m => m.type === "video");
  const mediaFirst = hasImage && !hasAudio && !hasVideo;

  const track = {
    lastAudioEl: null,
    lastAudioUrl: "",
    lastAudioStatusEl: null,
    lastAudioBtnEl: null
  };

  if (mediaFirst) appendMedia(bubble, mediaList, track);

  const text = String(msg.text || "");
  const visibleText = msg?.from === "bot" ? decorateVisibleText(text) : text;
  if (visibleText) bubble.appendChild(renderRichText(visibleText));

  if (!mediaFirst) appendMedia(bubble, mediaList, track);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = nowTime(msg.ts);

  row.appendChild(bubble);
  row.appendChild(meta);
  $chat.appendChild(row);

  scrollToBottom(false);

  if (!opts.fromRenderAll && track.lastAudioEl && track.lastAudioUrl) {
    tryAutoplayAudio(
      track.lastAudioEl,
      track.lastAudioUrl,
      track.lastAudioStatusEl,
      track.lastAudioBtnEl
    );
  }
}

/* =========================
   AUTOPLAY LOGIC
========================= */
async function tryAutoplayAudio(audioEl, url, statusEl, buttonEl) {
  if (!audioEl || !url) return;
  if (AUTO_PLAYED.has(url)) return;

  armAutoplayOnFirstUserGesture();

  PENDING_AUTOPLAY = { audioEl, url, statusEl, buttonEl };

  try {
    audioEl.preload = "auto";
    await audioEl.play();

    if (statusEl) statusEl.textContent = "";
    if (buttonEl) buttonEl.style.display = "none";

    AUTO_PLAYED.add(url);
    PENDING_AUTOPLAY = null;
  } catch {
    if (statusEl) {
      statusEl.textContent = t(
        "Toca la pantalla o el botón para escuchar 🎧",
        "Tap the screen or the button to play 🎧"
      );
    }
    if (buttonEl) buttonEl.style.display = "inline-flex";
  }
}

/* =========================
   CHIPS
========================= */
export function renderChips(state) {
  if (!$quick && !$quickPickerWrap) return;

  // 0) Gate de idioma
  if (isLangGate(state)) {
    const current = getLangFromDOM();
    const langLabel = (code) => {
      if (code === "es") return current === "en" ? "Spanish (ES)" : "Español (ES)";
      return current === "en" ? "English (EN)" : "Inglés (EN)";
    };

    renderQuickTargets([
      { label: langLabel("es"), kind: "ui:lang", value: "es" },
      { label: langLabel("en"), kind: "ui:lang", value: "en" }
    ]);
    return;
  }

  const history = Array.isArray(state?.history) ? state.history : [];
  const lastBotWithOptions = [...history]
    .reverse()
    .find((m) => m?.from === "bot" && Array.isArray(m.options) && m.options.length);

  const options = normalizeOptions(lastBotWithOptions?.options);
  const captureStage = getCaptureStage(state);
  const closing = isFlowClosing(state);

  // 1) En captura de nombre o teléfono: SIEMPRE dejar un botón visible.
  //    Si el flow trae opciones, se usan. Si no, fallback estable.
  if (captureStage === "name" || captureStage === "phone") {
    const safeCaptureOptions = options.filter((opt) => !isWhatsAppChip(opt));

    if (safeCaptureOptions.length) {
      renderQuickTargets(safeCaptureOptions);
      return;
    }

    const skipLabel = t("Prefiero no dejarlo", "Prefer not to share");
    renderQuickTargets([{ label: skipLabel, kind: "option", value: skipLabel }]);
    return;
  }

  // 2) Flujo normal
  renderQuickTargets(
    options.filter((opt) => !(isWhatsAppChip(opt) && !closing))
  );
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];

  return options
    .map((o) => {
      if (typeof o === "string") {
        const s = o.trim();
        return s ? { label: s, value: s, kind: "option" } : null;
      }

      if (o && typeof o === "object") {
        const label = String(o.label || o.text || o.title || o.value || "").trim();
        const value = String(o.value ?? label).trim();
        const kind  = String(o.kind || "option").trim() || "option";

        if (!label) return null;

        return {
          ...o,
          label,
          value,
          kind
        };
      }

      return null;
    })
    .filter(Boolean);
}

/* =========================
   EVENTOS
========================= */
function bindViewportGuard() {
  let tmr = null;

  const onChange = () => {
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      applyViewportMetrics();
      scrollToBottom(false);
    }, 50);
  };

  applyViewportMetrics();

  if ("visualViewport" in window && window.visualViewport) {
    const vv = window.visualViewport;
    vv.addEventListener("resize", onChange, { passive: true });
    vv.addEventListener("scroll", onChange, { passive: true });
  }

  window.addEventListener("resize", onChange, { passive: true });
}

export function bindForm(onSubmit) {
  if (!$form || !$input) return;
  if ($form.dataset.bound === "1") return;

  $form.dataset.bound = "1";
  bindViewportGuard();

  $form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (FORM_BUSY) return;

    const value = $input.value.trim();
    if (!value) return;

    $input.value = "";
    setInputActive(false);
    blurInput();
    scrollToBottom(false);

    setComposerBusy(true);
    try {
      await Promise.resolve(onSubmit(value));
    } finally {
      setComposerBusy(false);
      scrollToBottom(false);
    }
  });

  $input.addEventListener("focus", () => {
    setInputActive(true);
    applyViewportMetrics();
    setTimeout(() => keepComposerVisible(), 50);
    setTimeout(() => keepComposerVisible(), 180);
  });

  $input.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.activeElement !== $input) {
        setInputActive(false);
        applyViewportMetrics();
        scrollToBottom(false);
      }
    }, 120);
  });
}

export function bindReset(onReset) {
  if (!$btnReset) return;
  if ($btnReset.dataset.bound === "1") return;

  $btnReset.dataset.bound = "1";
  $btnReset.addEventListener("click", () => onReset());
}

export function bindChips(onChip) {
  if (!$quick && !$quickPicker) return;

  if (bindChips._resizeBound !== "1") {
    bindChips._resizeBound = "1";
    window.addEventListener("resize", () => updateMobileQuickPicker(LAST_QUICK_OPTIONS), { passive: true });
  }

  const handleQuickPick = async ({ value, kind, label }) => {
    const safeValue = String(value || "").trim();
    if (!safeValue) return;

    blurInput();

    if (PENDING_AUTOPLAY?.audioEl) {
      try { await PENDING_AUTOPLAY.audioEl.play(); } catch {}
    }

    onChip(safeValue, String(kind || "option"), String(label || safeValue));
    scrollToBottom(false);
  };

  if ($quick && $quick.dataset.bound !== "1") {
    $quick.dataset.bound = "1";

    $quick.addEventListener("click", async (e) => {
      const btn = e.target.closest("button.chip");
      if (!btn) return;

      await handleQuickPick({
        value: btn.dataset.value,
        kind: btn.dataset.kind,
        label: btn.dataset.label || btn.textContent || btn.dataset.value
      });
    });
  }

  if ($quickPicker && $quickPicker.dataset.bound !== "1") {
    $quickPicker.dataset.bound = "1";

    $quickPicker.addEventListener("change", async () => {
      const selected = $quickPicker.selectedOptions?.[0];
      const value = String(selected?.value || "").trim();
      if (!value) return;

      await handleQuickPick({
        value,
        kind: selected?.dataset?.kind || "option",
        label: selected?.dataset?.label || selected?.textContent || value
      });

      $quickPicker.selectedIndex = 0;
    });
  }
}

/* =========================
   HOOK: re-apply composer mode
========================= */
export function syncComposerMode(state) {
  applyComposerModeFromState(state);
}

/* =========================
   FAQ (Acordeón)
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
    if (u.toLowerCase().startsWith("javascript:")) return "";
    return u;
  };

  function cleanUrlEnd(url) {
    let u = String(url || "");
    while (u.length && /[)\].,;:!?]+$/.test(u)) u = u.slice(0, -1);
    return u;
  }

  function linkifyHtmlString(html) {
    const re = /((https?:\/\/|www\.)[^\s<]+)/gi;

    return html.replace(re, (match) => {
      const cleaned = cleanUrlEnd(match);
      const href = cleaned.startsWith("www.") ? `https://${cleaned}` : cleaned;
      if (/^javascript:/i.test(href)) return match;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${cleaned}</a>`;
    });
  }

  const formatFAQ = (txt = "") => {
    const raw = String(txt || "").trim();

    if (raw.startsWith("@img:")) {
      const url = safeUrl(raw.slice(5).trim());
      if (!url) return "<em>Imagen no disponible</em>";
      return `<img src="${escHtml(url)}" alt="Imagen" class="faq-img" loading="lazy" decoding="async">`;
    }

    if (raw.startsWith("@link:")) {
      const rest = raw.slice(6).trim();
      const [urlRaw, labelRaw] = rest.split("|");
      const url = safeUrl((urlRaw || "").trim());
      const label = String((labelRaw || urlRaw || "Abrir enlace").trim());
      if (!url) return "<em>Enlace no disponible</em>";
      return `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">${escHtml(label)}</a>`;
    }

    let out = escHtml(raw);
    out = out.replace(/\*(.+?)\*/g, "<strong>$1</strong>");
    out = out.replace(/_(.+?)_/g, "<em>$1</em>");
    out = out.replace(/\n/g, "<br>");
    out = linkifyHtmlString(out);
    return out;
  };

  (items || []).forEach((it, idx) => {
    const details = document.createElement("details");
    details.className = "faq-item";
    details.dataset.idx = String(idx);

    const summary = document.createElement("summary");
    summary.className = "faq-q";
    summary.innerHTML = formatFAQ(decorateVisibleText(it?.q || "", "single"));

    const answer = document.createElement("div");
    answer.className = "faq-a";
    const rawAnswer = String(it?.a || "");
    const visibleAnswer = rawAnswer.startsWith("@") ? rawAnswer : decorateVisibleText(rawAnswer);
    answer.innerHTML = formatFAQ(visibleAnswer);

    details.appendChild(summary);
    details.appendChild(answer);
    $faqBody.appendChild(details);

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

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "chip";
  playBtn.textContent = t("Reproducir", "Play");
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
    status.textContent = t(
      "No pude cargar el audio 😅 (revisa la ruta del archivo)",
      "Couldn’t load the audio 😅 (check the file URL)"
    );
    playBtn.style.display = "none";
  });

  audio.addEventListener("play", () => {
    if (status.textContent && (status.textContent.includes("escuchar") || status.textContent.includes("Tap"))) {
      status.textContent = "";
    }
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

  const maxWidth = opts.maxWidth ?? 560;
  const maxHeight = opts.maxHeight ?? 340;

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
  video.style.width = "100%";

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
  const visibleLabel = decorateVisibleText(label, "single");

  const btn = document.createElement("button");
  btn.className = "chip";

  if (
    label.toLowerCase().includes("whatsapp") ||
    String(kind || "").toLowerCase() === "global:whatsapp"
  ) {
    btn.classList.add("chip--wa");
  }

  btn.type = "button";
  btn.textContent = visibleLabel;
  btn.dataset.value = value;
  btn.dataset.label = visibleLabel;
  btn.dataset.kind = String(kind || "option");
  btn.setAttribute("aria-label", visibleLabel);

  return btn;
}

/* =========================
   RICH TEXT (CHAT)
========================= */
function renderRichText(text) {
  const container = document.createElement("div");
  container.className = "msgtext";

  const lines = String(text || "").split("\n");

  lines.forEach((line, idx) => {
    const parts = splitByUrls(line);

    parts.forEach((part) => {
      if (part.type === "url") {
        const a = document.createElement("a");
        a.href = part.value;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = part.label || part.value;
        container.appendChild(a);
      } else {
        container.appendChild(document.createTextNode(part.value));
      }
    });

    if (idx < lines.length - 1) {
      container.appendChild(document.createElement("br"));
    }
  });

  return container;
}

function splitByUrls(text) {
  const out = [];
  const re = /((https?:\/\/|www\.)[^\s]+)/gi;

  let last = 0;
  let m;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", value: text.slice(last, m.index) });
    }

    const raw = cleanUrlEnd(m[1]);
    const href = raw.startsWith("www.") ? `https://${raw}` : raw;

    out.push({ type: "url", value: href, label: raw });
    last = m.index + m[1].length;
  }

  if (last < text.length) {
    out.push({ type: "text", value: text.slice(last) });
  }

  return out.length ? out : [{ type: "text", value: text }];
}

function cleanUrlEnd(url) {
  let u = String(url || "");
  while (u.length && /[)\].,;:!?]+$/.test(u)) u = u.slice(0, -1);
  return u;
}

/* =========================
   MEDIA NORMALIZATION
========================= */
function normalizeMedia(media) {
  if (!media) return [];

  const arr = Array.isArray(media) ? media : [media];

  return arr
    .map((m) => {
      if (m && typeof m === "object") {
        const url = String(m.url || m.src || m.href || "").trim();
        if (!url) return null;

        const type = String(m.type || inferMediaType(url)).trim() || inferMediaType(url);

        return { ...m, type, url };
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
