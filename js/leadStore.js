// leadStore.js
// ============================
// Reemplazo de leadSync.js (Google Sheets) -> ahora guarda en Firestore.
// Mantiene la MISMA interfaz pública (createLeadSync) para no tocar main.js:
//   saveField, saveMemory, saveEdad, saveArte, saveModalidad,
//   flushQueue, getSessionId, resetSession, getStatus
//
// Cada saveField actualiza (merge) el documento sessions/{sessionId}.
// ============================

import {
  initFirebase,
  getSessionId as fbGetSessionId,
  resetSessionId,
  saveSessionFields
} from "./firebaseClient.js";

function safeString(v) {
  return String(v ?? "").trim();
}
function clampString(v, maxLen = 280) {
  const s = safeString(v);
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}
function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const p = safeString(path);
  if (!p) return undefined;
  if (!p.includes(".")) return obj?.[p];
  return p.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function createLeadSync({
  debug = false,
  ignoreValues = ["volver al menú", "volver", "menu", "menú"],
  allowEmpty = false
} = {}) {
  initFirebase({ debug });

  const IGNORE = (Array.isArray(ignoreValues) ? ignoreValues : [])
    .map((x) => safeString(x).toLowerCase())
    .filter(Boolean);

  function shouldIgnoreValue(v) {
    const s = safeString(v).toLowerCase();
    if (!s) return false;
    return IGNORE.some((iv) => s === iv || s.includes(iv));
  }

  async function saveField(field, value, { maxLen = 280 } = {}) {
    const f = safeString(field);
    const raw = safeString(value);

    if (!f) return { skipped: true, reason: "no-field" };
    if (shouldIgnoreValue(raw)) return { skipped: true, reason: "ignored" };

    const v = clampString(raw, maxLen);
    if (!allowEmpty && !v) return { skipped: true, reason: "empty" };

    if (debug) console.log("[leadStore] saveField", f, "=", v);
    return await saveSessionFields({ [f]: v });
  }

  async function saveMemory(memory = {}, mapping = {}, opts = {}) {
    const mem = memory || {};
    const map = mapping || {};
    const fields = {};

    for (const [memKeyOrPath, fieldName] of Object.entries(map)) {
      const raw = safeString(getByPath(mem, memKeyOrPath));
      if (shouldIgnoreValue(raw)) continue;

      let maxLen = 280;
      if (typeof opts?.maxLen === "number") maxLen = opts.maxLen;
      if (opts?.maxLen && typeof opts.maxLen === "object" && opts.maxLen[fieldName]) {
        maxLen = opts.maxLen[fieldName];
      }

      const v = clampString(raw, maxLen);
      if (!allowEmpty && !v) continue;
      fields[fieldName] = v;
    }

    if (!Object.keys(fields).length) return { success: true, skipped: true };
    return await saveSessionFields(fields);
  }

  return {
    saveField,
    saveMemory,
    saveEdad: (edad) => saveField("edad", edad),
    saveArte: (arte) => saveField("arte", arte),
    saveModalidad: (m) => saveField("modalidad", m),
    flushQueue: async () => {}, // Firestore reintenta solo (caché offline)
    getSessionId: fbGetSessionId,
    resetSession: ({ } = {}) => resetSessionId(),
    getStatus: () => ({ sessionId: fbGetSessionId(), backend: "firestore" })
  };
}
