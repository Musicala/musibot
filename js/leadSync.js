// leadSync.js (v1.8-modalidad-batch)
// ============================
// Guardado incremental a Google Sheets (Apps Script WebApp)
// - sessionId estable (localStorage)
// - UP SERT por sessionId (lo maneja Apps Script)
// - dedupe opcional (por defecto OFF para permitir re-guardar)
// - fallback automático no-cors/cors para evitar bloqueos típicos
// - cola offline con reintentos (localStorage)
// - helpers para guardar desde state.memory (batch)
// - Normalización por campo (edad/arte/modalidad) + presets
// - saveMemory soporta nested paths ("lead.name")
// ============================

const SESSION_KEY = "musibot_session_id";
const SENT_KEY    = "musibot_sent_fields_v3";   // campo -> último valor enviado (dedupe)
const QUEUE_KEY   = "musibot_lead_queue_v1";

function nowISO() {
  return new Date().toISOString();
}

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function safeString(v) {
  return String(v ?? "").trim();
}

function clampString(v, maxLen = 280) {
  const s = safeString(v);
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function makeUUID() {
  return (crypto?.randomUUID?.() || ("sid_" + Date.now() + "_" + Math.random().toString(16).slice(2)));
}

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = makeUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/* =========================
   SENT MAP (dedupe) - opcional
========================= */
function getSentMap() {
  return safeJsonParse(localStorage.getItem(SENT_KEY) || "{}", {});
}
function markSent(field, value) {
  const map = getSentMap();
  map[field] = value;
  localStorage.setItem(SENT_KEY, JSON.stringify(map));
}
function wasSentSame(field, value) {
  const map = getSentMap();
  return map[field] === value;
}

/* =========================
   QUEUE (offline / retry)
========================= */
function getQueue() {
  return safeJsonParse(localStorage.getItem(QUEUE_KEY) || "[]", []);
}
function setQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(Array.isArray(q) ? q : []));
}
function queueHasSameItem(queue, item) {
  return queue.some((x) =>
    x?.sessionId === item.sessionId &&
    x?.field === item.field &&
    x?.value === item.value
  );
}
function enqueue(item) {
  const q = getQueue();
  if (!queueHasSameItem(q, item)) {
    q.push(item);
    setQueue(q);
  }
}

/* =========================
   NETWORK SEND
========================= */
async function sendPayload(apiUrl, payload, opts = {}) {
  const {
    timeoutMs = 8000,
    preferNoCors = true,
    debug = false,
    optimisticNoCors = true
  } = opts;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  const tryFetch = async (mode) => {
    if (debug) console.log("[LeadSync] POST", mode, payload);

    const res = await fetch(apiUrl, {
      method: "POST",
      mode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });

    // no-cors => respuesta opaque (no se puede leer)
    if (mode === "no-cors") {
      return optimisticNoCors
        ? { success: true, mode: "no-cors", opaque: true, assumed: true }
        : { success: false, mode: "no-cors", opaque: true, error: "opaque_response_no_cors" };
    }

    const json = await res.json().catch(() => ({}));
    return json && typeof json === "object"
      ? json
      : { success: false, error: "Respuesta inválida" };
  };

  try {
    const firstMode = preferNoCors ? "no-cors" : "cors";
    return await tryFetch(firstMode);
  } catch (e1) {
    try {
      const fallbackMode = preferNoCors ? "cors" : "no-cors";
      return await tryFetch(fallbackMode);
    } catch (e2) {
      if (debug) console.warn("[LeadSync] send failed", e1?.message || e1, e2?.message || e2);
      return { success: false, error: (e2?.message || e1?.message || "Network error") };
    }
  } finally {
    clearTimeout(t);
  }
}

/* =========================
   HELPERS: nested read
========================= */
function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const p = safeString(path);
  if (!p) return undefined;
  if (!p.includes(".")) return obj?.[p];

  return p.split(".").reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
}

/* =========================
   FACTORY
========================= */
export function createLeadSync({
  apiUrl,
  debug = false,
  timeoutMs = 8000,

  // primero no-cors (para despliegues fastidiosos)
  preferNoCors = true,

  // “si no explota, asumimos ok” en no-cors
  optimisticNoCors = true,

  enableQueue = true,

  // por defecto NO dedupeamos (para permitir re-guardar/actualizar siempre)
  enableDedupe = false,

  // por defecto NO guardamos vacíos
  allowEmpty = false,

  // ignorar ciertos valores
  ignoreValues = ["volver al menú", "volver", "menu", "menú"],

  // si true, intenta estandarizar modalidad a "sede" | "hogar" | "virtual"
  normalizeModalidadToCanonical = false
} = {}) {
  if (!apiUrl) throw new Error("createLeadSync: falta apiUrl");

  let flushing = false;
  let flushFailCount = 0;

  function normalizeIgnoreList(list) {
    return (Array.isArray(list) ? list : [])
      .map(x => safeString(x).toLowerCase())
      .filter(Boolean);
  }
  const IGNORE = normalizeIgnoreList(ignoreValues);

  function shouldIgnoreValue(v) {
    const s = safeString(v).toLowerCase();
    if (!s) return false;
    return IGNORE.some(iv => s === iv || s.includes(iv));
  }

  function stripLeadingEmojiLike(s) {
    // Quita emojis/íconos al inicio tipo "🏫 " "🎶 " etc (suave, no perfecto).
    // Ej: "🏫 En sede" -> "En sede"
    return String(s || "")
      .replace(/^[\p{Extended_Pictographic}\u200d\uFE0F\s]+/u, "")
      .trim();
  }

  function canonicalModalidad(raw) {
    const s = safeString(raw).toLowerCase();
    if (!s) return "";

    if (s.includes("sede") || s.includes("presencial")) return "sede";
    if (s.includes("hogar") || s.includes("domic") || s.includes("casa")) return "hogar";
    if (s.includes("virtual") || s.includes("online") || s.includes("en vivo")) return "virtual";

    return "";
  }

  // Normalización por campo (limpia, no inventa).
  function normalizeFieldValue(field, value) {
    const f = safeString(field).toLowerCase();
    const raw = safeString(value);

    if (!raw) return "";
    if (shouldIgnoreValue(raw)) return "";

    // Edad: rango, tal cual
    if (f === "edad") return raw;

    // Arte: tal cual (puede venir "🎶 Música")
    if (f === "arte") return raw;

    // Modalidad: tal cual, pero opcionalmente a canon
    if (f === "modalidad") {
      if (!normalizeModalidadToCanonical) return raw;

      const canon = canonicalModalidad(raw);
      return canon || raw; // si no detecta, no rompe
    }

    // Otros campos: quitamos emoji al inicio para que Sheets no quede tipo jeroglífico
    // (esto es opcional y suave: no les toca el contenido real si no tiene emoji)
    return stripLeadingEmojiLike(raw) || raw;
  }

  async function flushQueue() {
    if (!enableQueue) return;
    if (flushing) return;
    flushing = true;

    try {
      const q = getQueue();
      if (!q.length) {
        flushFailCount = 0;
        return;
      }

      const remaining = [];
      for (const item of q) {
        const r = await sendPayload(apiUrl, item, { timeoutMs, preferNoCors, debug, optimisticNoCors });

        if (!r?.success) {
          remaining.push(item);
        } else {
          if (enableDedupe) markSent(item.field, item.value);
        }
      }

      setQueue(remaining);

      if (remaining.length === 0) flushFailCount = 0;
      else flushFailCount = Math.min(flushFailCount + 1, 6);

      if (debug) console.log("[LeadSync] flush done. remaining:", remaining.length);
    } finally {
      flushing = false;
    }
  }

  window.addEventListener("online", () => {
    flushQueue().catch(() => {});
  });

  // Arranque inicial con backoff suave si falla
  (function scheduleInitialFlush() {
    const base = 400;
    const delay = base * Math.pow(2, flushFailCount); // 400, 800, 1600...
    setTimeout(() => {
      flushQueue()
        .catch(() => {})
        .finally(() => {
          // reintento suave si sigue habiendo cola
          const q = getQueue();
          if (q.length) scheduleInitialFlush();
        });
    }, delay);
  })();

  async function saveField(field, value, { maxLen = 280 } = {}) {
    const fRaw = safeString(field);
    const f = fRaw; // respetamos casing por si backend es sensible
    const vNorm = normalizeFieldValue(f, value);
    const v = clampString(vNorm, maxLen);

    if (!f) return { skipped: true, reason: "no-field" };
    if (!allowEmpty && !v) return { skipped: true, reason: "empty" };

    if (enableDedupe && wasSentSame(f, v)) {
      return { skipped: true, reason: "dedupe" };
    }

    const payload = {
      sessionId: getSessionId(),
      field: f,
      value: v,
      ts: nowISO()
    };

    // Offline -> queue
    if (enableQueue && typeof navigator !== "undefined" && navigator.onLine === false) {
      enqueue(payload);
      if (debug) console.warn("[LeadSync] offline -> queued", payload);
      return { queued: true, offline: true };
    }

    const res = await sendPayload(apiUrl, payload, { timeoutMs, preferNoCors, debug, optimisticNoCors });

    if (res?.success) {
      if (enableDedupe) markSent(payload.field, payload.value);
      flushQueue().catch(() => {});
      return res;
    }

    if (enableQueue) {
      enqueue(payload);
      if (debug) console.warn("[LeadSync] failed -> queued", res?.error, payload);
      return { queued: true, error: res?.error || "send failed" };
    }

    throw new Error(res?.error || "Error guardando en Sheets");
  }

  /**
   * Guardar varios campos desde un objeto memory (o cualquier objeto) de una.
   * mapping: { "memoryKeyOrPath": "sheetFieldName" }
   * Ej:
   *  {
   *    "name": "nombre",
   *    "phone": "cel",
   *    "service": "servicio",
   *    "edad": "edad",
   *    "arte": "arte",
   *    "modalidad": "modalidad"
   *  }
   *
   * También soporta paths:
   *  { "lead.name": "nombre" }
   *
   * opts:
   * - maxLen: number | { [sheetFieldName]: number }
   */
  async function saveMemory(memory = {}, mapping = {}, opts = {}) {
    const mem = memory || {};
    const map = mapping || {};
    const results = [];

    for (const [memKeyOrPath, sheetField] of Object.entries(map)) {
      const val = getByPath(mem, memKeyOrPath);

      let maxLen = 280;
      if (typeof opts?.maxLen === "number") maxLen = opts.maxLen;
      if (opts?.maxLen && typeof opts.maxLen === "object" && opts.maxLen[sheetField]) {
        maxLen = opts.maxLen[sheetField];
      }

      const r = await saveField(sheetField, val, { maxLen });
      results.push({ memKey: memKeyOrPath, field: sheetField, result: r });
    }

    return { success: true, results };
  }

  // Presets útiles
  async function saveEdad(edad) {
    return await saveField("edad", edad);
  }
  async function saveArte(arte) {
    return await saveField("arte", arte);
  }
  async function saveModalidad(modalidad) {
    return await saveField("modalidad", modalidad);
  }

  function resetSession({ clearQueue = false, clearSentMap = false } = {}) {
    localStorage.removeItem(SESSION_KEY);
    if (clearSentMap) localStorage.removeItem(SENT_KEY);
    if (clearQueue) localStorage.removeItem(QUEUE_KEY);
    return getSessionId();
  }

  function getStatus() {
    return {
      sessionId: getSessionId(),
      sent: getSentMap(),
      queue: getQueue(),
      settings: {
        enableDedupe,
        preferNoCors,
        optimisticNoCors,
        enableQueue,
        allowEmpty,
        ignoreValues: IGNORE,
        normalizeModalidadToCanonical
      }
    };
  }

  return {
    saveField,
    saveMemory,
    saveEdad,
    saveArte,
    saveModalidad,
    flushQueue,
    getSessionId,
    resetSession,
    getStatus
  };
}
