// firebaseClient.js
// ============================
// Conexión a Firebase Firestore (solo ESCRITURA desde el front).
// Este proyecto NO lee ni muestra nada de Firestore: solo guarda.
// La lectura/explotación de los datos se hará en OTRO proyecto aparte.
//
// Colecciones que escribimos:
//   sessions/{sessionId}                -> snapshot del lead (nombre, cel, servicio, edad, arte, modalidad, etc.)
//   sessions/{sessionId}/events/{auto}  -> cada interacción (clics, mensajes, nodos, idioma...)
//   knowledge_gaps/{auto}               -> preguntas que el bot NO supo responder (para mejorar el kb)
//
// Persistencia offline: Firestore guarda en IndexedDB y reintenta solo cuando vuelve la red.
// ============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBq5m_SSK7pbPiMvU96HRhPgRbza8JuLLc",
  authDomain: "musibot-d75e6.firebaseapp.com",
  projectId: "musibot-d75e6",
  storageBucket: "musibot-d75e6.firebasestorage.app",
  messagingSenderId: "68110795748",
  appId: "1:68110795748:web:ed7312655333e032cc3df1"
};

const SESSION_KEY = "musibot_session_id";

// "dev" cuando se corre en local (pruebas), "prod" cuando está publicado.
// El Lector puede filtrar por este campo para no mezclar pruebas con leads reales.
function getEnv() {
  try {
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "" || location.protocol === "file:") return "dev";
  } catch {}
  return "prod";
}

let app = null;
let db = null;
let ready = false;

function makeUUID() {
  return (crypto?.randomUUID?.() || ("sid_" + Date.now() + "_" + Math.random().toString(16).slice(2)));
}

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = makeUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function resetSessionId() {
  localStorage.removeItem(SESSION_KEY);
  return getSessionId();
}

export function initFirebase({ debug = false } = {}) {
  if (ready) return { app, db };
  try {
    app = initializeApp(firebaseConfig);
    // Caché local persistente => funciona offline y reintenta al volver la red.
    db = initializeFirestore(app, { localCache: persistentLocalCache() });
    ready = true;
    if (debug) console.log("[Firebase] inicializado", firebaseConfig.projectId);
  } catch (e) {
    console.warn("[Firebase] no pudo inicializar:", e?.message || e);
    ready = false;
  }
  return { app, db };
}

function ensureDb() {
  if (!ready || !db) initFirebase();
  return db;
}

/* =========================
   SESSION (snapshot del lead)
   - merge: true => va completando el mismo documento sin pisar lo anterior.
========================= */
export async function saveSessionFields(fields = {}) {
  const database = ensureDb();
  if (!database) return { skipped: true, reason: "no-db" };

  const sid = getSessionId();
  const ref = doc(database, "sessions", sid);

  const payload = {
    session_id: sid,
    env: getEnv(),
    updated_at: serverTimestamp(),
    ...fields
  };

  // created_at: lo escribimos solo la primera vez de esta sesión (guard en localStorage).
  const createdKey = "musibot_session_created_" + sid;
  if (!localStorage.getItem(createdKey)) {
    payload.created_at = serverTimestamp();
    localStorage.setItem(createdKey, "1");
  }

  try {
    await setDoc(ref, payload, { merge: true });
    return { success: true };
  } catch (e) {
    console.warn("[Firebase] saveSessionFields falló:", e?.message || e);
    return { success: false, error: e?.message || "write-failed" };
  }
}

/* =========================
   EVENTS (comportamiento)
   type: "user_message" | "chip_click" | "node_enter" | "lang_change" | "whatsapp_click" | ...
========================= */
export async function logEvent(type, data = {}) {
  const database = ensureDb();
  if (!database) return;

  const sid = getSessionId();
  try {
    await addDoc(collection(database, "sessions", sid, "events"), {
      type: String(type || "event"),
      ...data,
      env: getEnv(),
      ts: serverTimestamp(),
      client_ts: new Date().toISOString()
    });
    // contador rápido de eventos por sesión (útil para métricas)
    await setDoc(
      doc(database, "sessions", sid),
      { session_id: sid, events_count: increment(1), updated_at: serverTimestamp() },
      { merge: true }
    ).catch(() => {});
  } catch (e) {
    // No rompemos la UX por un evento que no se pudo guardar.
    console.warn("[Firebase] logEvent falló:", e?.message || e);
  }
}

/* =========================
   KNOWLEDGE GAPS (lo que el bot no supo responder)
   - Cada documento es una pregunta sin respuesta clara.
   - Una IA/persona los revisa luego para mejorar kb.json.
========================= */
export async function logKnowledgeGap(data = {}) {
  const database = ensureDb();
  if (!database) return;

  const sid = getSessionId();
  try {
    await addDoc(collection(database, "knowledge_gaps"), {
      session_id: sid,
      env: getEnv(),
      text: String(data.text || "").slice(0, 1000),
      lang: data.lang || "es",
      node_id: data.nodeId || null,
      node_name: data.nodeName || null,
      // Contexto extra para entender el gap en el panel
      last_bot_text: String(data.lastBotText || "").slice(0, 500),
      nombre:    String(data.nombre    || ""),
      arte:      String(data.arte      || ""),
      servicio:  String(data.servicio  || ""),
      modalidad: String(data.modalidad || ""),
      reviewed: false,
      status: "new",          // new | reviewed | added_to_kb | ignored
      ts: serverTimestamp(),
      client_ts: new Date().toISOString()
    });
  } catch (e) {
    console.warn("[Firebase] logKnowledgeGap falló:", e?.message || e);
  }
}
