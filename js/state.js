// state.js (v3.7)
// ============================
// Manejo de estado y memoria (localStorage)
// - Estado inicial consistente
// - Carga con migración/normalización (soporta versiones anteriores)
// - Guardado con trim de historial
// - Utilidades: mergeMemory, setLang, setLead, setCaptureStage, setFlowStarted, setHydrated
//
// MEJORAS v3.7
// ✅ normalizeMessage soporta options como string u objeto {label,value,kind,...}
// ✅ normalizeState ya no destruye lastOptions si vienen como objetos
// ✅ Preserva _flow y otros metadatos extras por mensaje
// ✅ Sanitización más robusta para options/media/history
// ✅ Helpers públicos extra para leer/escribir options sin romper compatibilidad
// ✅ Normalización de memoria más tolerante con datos legacy
// ============================

import { CONFIG } from "./config.js";

/* =========================
   CONSTANTES
========================= */

const STATE_VERSION = 3.7;
const MAX_MSG_TEXT = 8000;
const MAX_USER_TEXT = 4000;
const MAX_OPTION_TEXT = 120;
const MAX_HISTORY_HARD = 800;
const MAX_OPTIONS = 24;
const MAX_MEDIA = 12;

/* =========================
   ESTADO INICIAL
========================= */

export function getInitialState() {
  return normalizeState({
    history: [],
    currentNodeId: null,
    awaitingNodeId: null,
    lastOptions: [],
    lastUserText: "",
    memory: {
      ui: { stage: null, lang: null, composerMode: null },
      lead: { name: "", phone: "", edad: "", arte: "" },
      capture: { stage: null },
      flags: { flowStarted: false, hydrated: false }
    },
    boot: { done: false, v: STATE_VERSION }
  });
}

/* =========================
   LOAD / SAVE
========================= */

export function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.LS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (err) {
    console.warn("No se pudo cargar el estado:", err);
    return null;
  }
}

export function saveState(state) {
  try {
    const normalized = normalizeState(state);
    const trimmed = trimHistory(normalized);
    localStorage.setItem(CONFIG.LS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("No se pudo guardar el estado:", err);
  }
}

export function resetState() {
  try {
    localStorage.removeItem(CONFIG.LS_KEY);
  } catch (e) {}
  return getInitialState();
}

/**
 * Resetea SOLO conversación (historial + opciones), pero mantiene memory.
 */
export function resetConversationKeepMemory(state) {
  const s = normalizeState(state || getInitialState());

  return normalizeState({
    ...s,
    history: [],
    lastOptions: [],
    currentNodeId: null,
    awaitingNodeId: null,
    lastUserText: "",
    boot: { ...s.boot, done: false }
  });
}

/* =========================
   NORMALIZACIÓN / MIGRACIÓN
========================= */

function normalizeState(s) {
  const base = isObj(s) ? s : {};

  // history
  const history = Array.isArray(base.history) ? base.history : [];
  const cleanHistory = history
    .filter(isObj)
    .map(normalizeMessage);

  // node pointers
  const currentNodeId = safeId(base.currentNodeId);
  const awaitingNodeId = safeId(base.awaitingNodeId);

  // lastOptions
  const lastOptions = normalizeOptionsList(base.lastOptions);

  // lastUserText
  const lastUserText = safeStr(base.lastUserText ?? "", MAX_USER_TEXT);

  // memory (migración suave)
  const memoryIn = isObj(base.memory) ? base.memory : {};
  const memoryOut = { ...memoryIn };

  // ui
  const uiIn = isObj(memoryIn.ui) ? memoryIn.ui : {};
  const uiStage = normalizeUiStage(uiIn.stage);
  const uiLang = normalizeLang(uiIn.lang ?? memoryIn.lang ?? memoryIn.language ?? null);
  const composerMode = normalizeComposerMode(uiIn.composerMode);

  memoryOut.ui = {
    ...uiIn,
    stage: uiStage,
    lang: uiLang,
    composerMode
  };

  // lead
  const leadIn = isObj(memoryIn.lead) ? memoryIn.lead : {};

  const leadName = safeStr(
    leadIn.name ?? leadIn.nombre ?? memoryIn.name ?? memoryIn.nombre ?? "",
    80
  );

  const leadPhone = safeStr(
    leadIn.phone ??
      leadIn.cel ??
      leadIn.celular ??
      memoryIn.phone ??
      memoryIn.cel ??
      memoryIn.celular ??
      "",
    32
  );

  const leadEdad = safeStr(
    leadIn.edad ?? leadIn.age ?? memoryIn.edad ?? memoryIn.age ?? "",
    40
  );

  const leadArte = safeStr(
    leadIn.arte ?? leadIn.art ?? memoryIn.arte ?? memoryIn.art ?? "",
    80
  );

  memoryOut.lead = {
    ...leadIn,
    name: leadName,
    phone: leadPhone,
    edad: leadEdad,
    arte: leadArte
  };

  // capture
  const captureIn = isObj(memoryIn.capture) ? memoryIn.capture : {};
  const capStage = normalizeCaptureStage(captureIn.stage ?? memoryIn.captureStage ?? null);

  memoryOut.capture = {
    ...captureIn,
    stage: capStage
  };

  // flags
  const flagsIn = isObj(memoryIn.flags) ? memoryIn.flags : {};
  const flowStarted = !!(flagsIn.flowStarted ?? memoryIn.flowStarted);
  const hydrated = !!(flagsIn.hydrated ?? memoryIn.hydrated);

  memoryOut.flags = {
    ...flagsIn,
    flowStarted,
    hydrated
  };

  // boot
  const bootIn = isObj(base.boot) ? base.boot : {};
  const bootDone = !!bootIn.done;
  const bootV = safeNum(bootIn.v, STATE_VERSION);

  const normalized = {
    history: cleanHistory,
    currentNodeId,
    awaitingNodeId,
    lastOptions,
    lastUserText,
    memory: memoryOut,
    boot: {
      done: bootDone,
      v: bootV
    }
  };

  if (!base.boot) {
    normalized.boot.done = false;
    normalized.boot.v = STATE_VERSION;
  }

  return normalized;
}

function normalizeMessage(m) {
  const from = m.from === "bot" || m.from === "user" ? m.from : "bot";
  const text = safeStr(m.text, MAX_MSG_TEXT);
  const ts = isFiniteNumber(m.ts) ? Number(m.ts) : Date.now();

  const options = normalizeOptionsList(m.options);
  const media = normalizeMediaList(m.media);

  // Preservar extras (_flow, nodeId, debug, etc.)
  const extra = {};
  for (const k of Object.keys(m)) {
    if (k === "from" || k === "text" || k === "ts" || k === "options" || k === "media") continue;
    extra[k] = m[k];
  }

  return {
    from,
    text,
    ts,
    options,
    media,
    ...extra
  };
}

/* =========================
   OPTIONS
========================= */

function normalizeOptionsList(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map(normalizeOption)
    .filter(Boolean)
    .slice(0, MAX_OPTIONS);
}

function normalizeOption(opt) {
  if (typeof opt === "string") {
    const s = safeStr(opt, MAX_OPTION_TEXT);
    return s || null;
  }

  if (!isObj(opt)) return null;

  const label = safeStr(opt.label ?? opt.text ?? opt.title ?? opt.value ?? "", MAX_OPTION_TEXT);
  const value = safeStr(opt.value ?? label, MAX_OPTION_TEXT);
  const kind = safeStr(opt.kind ?? "option", 80);

  if (!label) return null;

  const extra = {};
  for (const k of Object.keys(opt)) {
    if (k === "label" || k === "text" || k === "title" || k === "value" || k === "kind") continue;
    extra[k] = opt[k];
  }

  return {
    label,
    value,
    kind,
    ...extra
  };
}

/* =========================
   MEDIA
========================= */

function normalizeMediaList(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map(normalizeMediaItem)
    .filter(Boolean)
    .slice(0, MAX_MEDIA);
}

function normalizeMediaItem(item) {
  if (!item) return null;

  if (typeof item === "string") {
    const url = safeStr(item, 2000);
    return url ? { url, type: "unknown" } : null;
  }

  if (!isObj(item)) return null;

  const type = safeStr(item.type ?? item.kind ?? "unknown", 80);
  const url = safeStr(item.url ?? item.src ?? "", 2000);
  const alt = safeStr(item.alt ?? item.label ?? "", 200);

  const extra = {};
  for (const k of Object.keys(item)) {
    if (k === "type" || k === "kind" || k === "url" || k === "src" || k === "alt" || k === "label") continue;
    extra[k] = item[k];
  }

  if (!url && !type) return null;

  return {
    type: type || "unknown",
    url,
    alt,
    ...extra
  };
}

/* =========================
   TRIM DE HISTORIAL
========================= */

function trimHistory(state) {
  if (!state || !Array.isArray(state.history)) return state;

  const max = clampInt(CONFIG.MAX_HISTORY, 20, MAX_HISTORY_HARD, 140);
  if (state.history.length <= max) return state;

  return {
    ...state,
    history: state.history.slice(-max)
  };
}

/* =========================
   UTILIDADES INTERNAS
========================= */

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isFiniteNumber(v) {
  return typeof v === "number" && isFinite(v);
}

function safeStr(v, maxLen = 200) {
  const s = v == null ? "" : String(v);
  const trimmed = s.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function safeNum(v, fallback) {
  const n = Number(v);
  return isFinite(n) && n > 0 ? n : fallback;
}

function safeId(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeCaptureStage(v) {
  return v === "name" || v === "phone" ? v : null;
}

function normalizeUiStage(v) {
  return v === "lang" ? "lang" : null;
}

function normalizeComposerMode(v) {
  return v === "text" || v === "chips" ? v : null;
}

function normalizeLang(v) {
  if (!v) return null;

  const s = String(v).trim().toLowerCase();

  if (s === "es" || s === "spanish" || s === "español" || s === "espanol") return "es";
  if (s === "en" || s === "english" || s === "inglés" || s === "ingles") return "en";
  if (s.includes("espa")) return "es";
  if (s.includes("engl")) return "en";

  return null;
}

/* =========================
   UTILIDADES PÚBLICAS
========================= */

export function norm(str = "") {
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function makeBotMessage(text = "", options = [], media = []) {
  return normalizeMessage({
    from: "bot",
    text,
    ts: Date.now(),
    options: Array.isArray(options) ? options : [],
    media: Array.isArray(media) ? media : []
  });
}

export function makeUserMessage(text = "") {
  return normalizeMessage({
    from: "user",
    text,
    ts: Date.now()
  });
}

/**
 * Mezcla profunda y segura en state.memory, preservando llaves extra.
 * También permite patch plano (memory.edad, memory.arte, etc.) sin perder nada.
 */
export function mergeMemory(state, patch = {}) {
  const s = normalizeState(state || getInitialState());
  const p = isObj(patch) ? patch : {};

  const pUi = isObj(p.ui) ? p.ui : null;
  const pLead = isObj(p.lead) ? p.lead : null;
  const pCapture = isObj(p.capture) ? p.capture : null;
  const pFlags = isObj(p.flags) ? p.flags : null;

  const { ui, lead, capture, flags, ...rest } = p;

  const next = {
    ...s,
    memory: {
      ...s.memory,
      ...rest,
      ui: { ...s.memory.ui, ...(pUi || {}) },
      lead: { ...s.memory.lead, ...(pLead || {}) },
      capture: { ...s.memory.capture, ...(pCapture || {}) },
      flags: { ...s.memory.flags, ...(pFlags || {}) }
    }
  };

  return normalizeState(next);
}

export function setLang(state, lang) {
  const s = normalizeState(state || getInitialState());
  const normalizedLang = normalizeLang(lang);

  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      ui: {
        ...s.memory.ui,
        lang: normalizedLang,
        stage: null
      }
    }
  });
}

export function setLead(state, { name, phone, edad, arte } = {}) {
  const s = normalizeState(state || getInitialState());

  const nextLead = {
    ...s.memory.lead,
    name: safeStr(name ?? s.memory.lead.name, 80),
    phone: safeStr(phone ?? s.memory.lead.phone, 32)
  };

  if (edad !== undefined) nextLead.edad = safeStr(edad, 40);
  if (arte !== undefined) nextLead.arte = safeStr(arte, 80);

  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      lead: nextLead
    }
  });
}

export function setCaptureStage(state, stage) {
  const s = normalizeState(state || getInitialState());

  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      capture: {
        ...s.memory.capture,
        stage: normalizeCaptureStage(stage)
      }
    }
  });
}

export function setFlowStarted(state, value = true) {
  const s = normalizeState(state || getInitialState());

  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      flags: {
        ...s.memory.flags,
        flowStarted: !!value
      }
    }
  });
}

export function setHydrated(state, value = true) {
  const s = normalizeState(state || getInitialState());

  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      flags: {
        ...s.memory.flags,
        hydrated: !!value
      }
    }
  });
}

export function setComposerMode(state, mode) {
  const s = normalizeState(state || getInitialState());
  const m = normalizeComposerMode(mode);

  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      ui: {
        ...s.memory.ui,
        composerMode: m
      }
    }
  });
}

/* =========================
   HELPERS PÚBLICOS EXTRA
========================= */

/**
 * Devuelve las últimas options en formato normalizado.
 * Pueden ser strings o objetos.
 */
export function getLastOptions(state) {
  const s = normalizeState(state || getInitialState());
  return Array.isArray(s.lastOptions) ? s.lastOptions : [];
}

/**
 * Guarda lastOptions normalizadas sin romper compatibilidad.
 */
export function setLastOptions(state, options = []) {
  const s = normalizeState(state || getInitialState());

  return normalizeState({
    ...s,
    lastOptions: normalizeOptionsList(options)
  });
}

/**
 * Agrega mensaje al historial de forma segura.
 */
export function pushHistory(state, message) {
  const s = normalizeState(state || getInitialState());
  const msg = normalizeMessage(message || {});

  return trimHistory(
    normalizeState({
      ...s,
      history: [...s.history, msg]
    })
  );
}

/**
 * Actualiza lastUserText de forma segura.
 */
export function setLastUserText(state, text = "") {
  const s = normalizeState(state || getInitialState());

  return normalizeState({
    ...s,
    lastUserText: safeStr(text, MAX_USER_TEXT)
  });
}