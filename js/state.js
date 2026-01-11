// state.js (v3.6)
// ============================
// Manejo de estado y memoria (localStorage)
// - Estado inicial consistente
// - Carga con migración/normalización (soporta versiones anteriores)
// - Guardado con trim de historial
// - Utilidades: mergeMemory, setLang, setLead, setCaptureStage, setFlowStarted, setHydrated
// ✅ FIX: normalizeState NO borra llaves extra en memory (preserva datos del flow)
// ✅ FIX: flags preserva extras (ej: leadSync)
// ✅ NUEVO: memory.lead incluye edad/arte (pero sin pisar memory.edad/arte legacy)
// ✅ NUEVO: normalizeMessage preserva _flow (para composerMode desde último bot msg)
// ✅ NUEVO: normaliza lastUserText (si lo usan en flowEngine)
// ============================

import { CONFIG } from "./config.js";

/* =========================
   CONSTANTES
========================= */

const STATE_VERSION = 3.6;

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
      lead: { name: "", phone: "", edad: "", arte: "" }, // ✅ extendido
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
  try { localStorage.removeItem(CONFIG.LS_KEY); } catch (e) {}
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
  const base = (s && typeof s === "object") ? s : {};

  // history
  const history = Array.isArray(base.history) ? base.history : [];
  const cleanHistory = history
    .filter(m => m && typeof m === "object")
    .map(m => normalizeMessage(m));

  // node pointers
  const currentNodeId = safeId(base.currentNodeId);
  const awaitingNodeId = safeId(base.awaitingNodeId);

  // lastOptions
  const lastOptions = Array.isArray(base.lastOptions)
    ? base.lastOptions.filter(x => typeof x === "string").slice(0, 24)
    : [];

  // lastUserText (si existe)
  const lastUserText = safeStr(base.lastUserText ?? "", 4000);

  // memory (migración suave)
  const memoryIn = (base.memory && typeof base.memory === "object") ? base.memory : {};

  // ✅ PRESERVAR llaves extra en memory (flowEngine guarda cosas planas)
  const memoryOut = (memoryIn && typeof memoryIn === "object")
    ? { ...memoryIn }
    : {};

  // ui
  const uiIn = (memoryIn.ui && typeof memoryIn.ui === "object") ? memoryIn.ui : {};
  const uiStage = (uiIn.stage === "lang") ? "lang" : null;
  const uiLang = normalizeLang(uiIn.lang ?? memoryIn.lang ?? memoryIn.language ?? null);
  const composerMode = (uiIn.composerMode === "text" || uiIn.composerMode === "chips") ? uiIn.composerMode : null;
  memoryOut.ui = { stage: uiStage, lang: uiLang, composerMode };

  // lead (extendido)
  const leadIn = (memoryIn.lead && typeof memoryIn.lead === "object") ? memoryIn.lead : {};

  const leadName = safeStr(
    leadIn.name ?? leadIn.nombre ?? memoryIn.name ?? memoryIn.nombre ?? "",
    80
  );

  const leadPhone = safeStr(
    leadIn.phone ?? leadIn.cel ?? leadIn.celular ?? memoryIn.phone ?? memoryIn.cel ?? memoryIn.celular ?? "",
    32
  );

  // edad: prioriza lead.edad, luego memory.edad legacy
  const leadEdad = safeStr(
    leadIn.edad ?? leadIn.age ?? memoryIn.edad ?? memoryIn.age ?? "",
    40
  );

  // arte: prioriza lead.arte, luego memory.arte legacy
  const leadArte = safeStr(
    leadIn.arte ?? leadIn.art ?? memoryIn.arte ?? memoryIn.art ?? "",
    80
  );

  memoryOut.lead = { ...leadIn, name: leadName, phone: leadPhone, edad: leadEdad, arte: leadArte };

  // capture
  const captureIn = (memoryIn.capture && typeof memoryIn.capture === "object") ? memoryIn.capture : {};
  const capStage = normalizeCaptureStage(captureIn.stage ?? memoryIn.captureStage ?? null);
  memoryOut.capture = { ...captureIn, stage: capStage };

  // flags
  const flagsIn = (memoryIn.flags && typeof memoryIn.flags === "object") ? memoryIn.flags : {};
  const flowStarted = !!(flagsIn.flowStarted ?? memoryIn.flowStarted);
  const hydrated = !!(flagsIn.hydrated ?? memoryIn.hydrated);

  // ✅ PRESERVAR flags extra (leadSync, etc.)
  memoryOut.flags = {
    ...(flagsIn && typeof flagsIn === "object" ? { ...flagsIn } : {}),
    flowStarted,
    hydrated
  };

  // boot
  const bootIn = (base.boot && typeof base.boot === "object") ? base.boot : {};
  const bootDone = !!bootIn.done;
  const bootV = safeNum(bootIn.v, STATE_VERSION);

  const normalized = {
    history: cleanHistory,
    currentNodeId,
    awaitingNodeId,
    lastOptions,
    lastUserText,
    memory: memoryOut,
    boot: { done: bootDone, v: bootV }
  };

  // upgrade suave si venía sin boot
  if (!base.boot) {
    normalized.boot.done = false;
    normalized.boot.v = STATE_VERSION;
  }

  return normalized;
}

function normalizeMessage(m) {
  const from = (m.from === "bot" || m.from === "user") ? m.from : "bot";
  const text = safeStr(m.text, 8000);

  const ts = (typeof m.ts === "number" && isFinite(m.ts))
    ? m.ts
    : Date.now();

  const options = Array.isArray(m.options)
    ? m.options.filter(x => typeof x === "string").slice(0, 24)
    : [];

  // media: puede venir como array de objetos (tipo/url) en tu flow. Preservamos.
  const media = Array.isArray(m.media)
    ? m.media.filter(Boolean).slice(0, 12)
    : [];

  // Preservar TODO extra (incluye _flow)
  const extra = {};
  for (const k of Object.keys(m)) {
    if (k === "from" || k === "text" || k === "ts" || k === "options" || k === "media") continue;
    extra[k] = m[k];
  }

  return { from, text, ts, options, media, ...extra };
}

/* =========================
   TRIM DE HISTORIAL
========================= */

function trimHistory(state) {
  if (!state || !Array.isArray(state.history)) return state;

  const max = clampInt(CONFIG.MAX_HISTORY, 20, 800, 140);
  if (state.history.length <= max) return state;

  const sliced = state.history.slice(-max);
  return { ...state, history: sliced };
}

/* =========================
   UTILIDADES (string/num/id)
========================= */

function safeStr(v, maxLen = 200) {
  const s = (v == null) ? "" : String(v);
  const trimmed = s.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function safeNum(v, fallback) {
  const n = Number(v);
  return (isFinite(n) && n > 0) ? n : fallback;
}

function safeId(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeCaptureStage(v) {
  if (v === "name" || v === "phone") return v;
  return null;
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
  const p = (patch && typeof patch === "object") ? patch : {};

  const pUi = (p.ui && typeof p.ui === "object") ? p.ui : null;
  const pLead = (p.lead && typeof p.lead === "object") ? p.lead : null;
  const pCapture = (p.capture && typeof p.capture === "object") ? p.capture : null;
  const pFlags = (p.flags && typeof p.flags === "object") ? p.flags : null;

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

export function setLang(state, lang /* "es" | "en" */) {
  const s = normalizeState(state || getInitialState());
  const normalizedLang = normalizeLang(lang);
  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      ui: { ...s.memory.ui, lang: normalizedLang, stage: null }
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

export function setCaptureStage(state, stage /* "name" | "phone" | null */) {
  const s = normalizeState(state || getInitialState());
  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      capture: { ...s.memory.capture, stage: normalizeCaptureStage(stage) }
    }
  });
}

export function setFlowStarted(state, value = true) {
  const s = normalizeState(state || getInitialState());
  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      flags: { ...s.memory.flags, flowStarted: !!value }
    }
  });
}

export function setHydrated(state, value = true) {
  const s = normalizeState(state || getInitialState());
  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      flags: { ...s.memory.flags, hydrated: !!value }
    }
  });
}

export function setComposerMode(state, mode /* "text" | "chips" | null */) {
  const s = normalizeState(state || getInitialState());
  const m = (mode === "text" || mode === "chips") ? mode : null;
  return normalizeState({
    ...s,
    memory: {
      ...s.memory,
      ui: { ...s.memory.ui, composerMode: m }
    }
  });
}
