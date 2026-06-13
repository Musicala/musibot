// main.js (v3.12.0)
// ============================
// Orquestador principal de MusiBot (modo FLOW puro)
//
// Lo que queda fijo (según lo que pidieron):
// ✅ Botón WhatsApp TOP (arriba a la derecha) = SIEMPRE visible + SIEMPRE activo (salida libre)
// ✅ WhatsApp “chip” abajo (en el chat) = SOLO al final (lo filtra UI) y envía resumen mínimo (edad/arte/modalidad/servicio)
// ✅ main.js NO decide visibilidad del chip; solo sabe abrir WhatsApp con el texto correcto cuando se dispara la acción.
//
// Notas:
// - TOP WA usa mensaje genérico (data-attributes en index.html o CONFIG fallback)
// - FINAL WA (chip) usa resumen mínimo desde state.memory (sin nombre/teléfono)
// - Se mantiene: i18n UI, flow engine, leadSync debounce, FAQ loader, reset limpio.

import { CONFIG } from "./config.js";
import {
  getInitialState,
  loadState,
  saveState,
  makeBotMessage,
  makeUserMessage,
  resetConversationKeepMemory
} from "./state.js";
import {
  renderAll,
  appendMessage,
  renderChips,
  bindForm,
  bindReset,
  bindChips,
  focusInput,
  renderFAQ,
  setComposerMode,
  syncComposerMode
} from "./ui.js";
import {
  loadFlow,
  startFlow,
  runNode,
  handleUserInput,
  relocalizeHistory
} from "./flowEngine.js";
import { initIntro } from "./intro.js";
import { applySeasonSkin } from "./seasonSkin.js";

// ✅ Lead sync (Google Sheets)
import { createLeadSync } from "./leadStore.js";
import { logEvent, logKnowledgeGap, saveSessionFields } from "./firebaseClient.js";

// Diccionarios UI ES/EN (labels / panel ayuda / placeholders)
import I18N_ES_RAW from "./i18n/es.js";
import I18N_EN_RAW from "./i18n/en.js";

// Estado global
let state = null;

// Idioma UI (visual)
let uiLang = "es";

// Cache kb.json para FAQ bilingüe
let kbCache = null;
let seasonalWorkshopsCache = null;

/* =========================
   DEBUG HELPERS
========================= */
function isDebugEnabled() {
  return !!(CONFIG?.DEBUG?.ENABLED);
}
function isLeadDebug() {
  return !!(CONFIG?.DEBUG?.ENABLED && CONFIG?.DEBUG?.LEAD_SYNC);
}

/* =========================
   LEAD SYNC (Sheets)
========================= */

const leadSync = (() => {
  try {
    // Ahora el backend es Firestore (ver leadStore.js / firebaseClient.js).
    return createLeadSync({
      debug: isLeadDebug()
    });
  } catch (e) {
    console.warn("[MusiBot] LeadSync (Firestore) no pudo inicializar:", e?.message || e);
    return null;
  }
})();

/**
 * Helper: toma el primer valor "no vacío" de una lista.
 */
function pickFirstNonEmpty(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

/**
 * Normaliza valores para evitar guardar basura como "Volver al menú".
 */
function normalizeChoiceValue(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";

  const low = s.toLowerCase();
  const ignore = [
    "volver al menú", "volver", "menu", "menú", "inicio", "home",
    "menu inicial", "menú inicial"
  ];
  if (ignore.some(x => low.includes(x))) return "";

  return s;
}

function normalizeEdadValue(v) { return normalizeChoiceValue(v); }
function normalizeArteValue(v) { return normalizeChoiceValue(v); }
function normalizeModalidadValue(v) { return normalizeChoiceValue(v); }
function normalizeServicioValue(v) { return normalizeChoiceValue(v); }

function inferModalidadFromServicio(servicio) {
  const raw = String(servicio ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("on-site")) return "On-site";
  if (raw.includes("presencial")) return "En sede";
  if (raw.includes("hogar") || raw.includes("domicilio")) return "Musicala Hogar";
  if (raw.includes("virtual")) return "Virtual";
  return "";
}

/**
 * Lee campos del lead desde state.memory soportando:
 * - Nuevo: memory.lead.*
 * - Legacy: memory.nombre / memory.cel / memory.servicio / memory.edad / memory.arte / memory.modalidad
 * - Alias comunes
 */
function readLeadFieldsFromState() {
  const mem = state?.memory || {};
  const lead = (mem.lead && typeof mem.lead === "object") ? mem.lead : {};

  const nombre = pickFirstNonEmpty(
    lead.name,
    lead.nombre,
    lead.Nombre,
    lead.fullName,
    mem.nombre,
    mem.name,
    mem.Nombre,
    mem.fullName
  );

  const cel = pickFirstNonEmpty(
    lead.phone,
    lead.cel,
    lead.celular,
    lead.telefono,
    lead["teléfono"],
    mem.cel,
    mem.celular,
    mem.telefono,
    mem["teléfono"],
    mem.phone
  );

  const servicioRaw = pickFirstNonEmpty(
    lead.servicio,
    lead.service,
    mem.servicio,
    mem.service
  );
  const servicio = normalizeServicioValue(servicioRaw);

  const edadRaw = pickFirstNonEmpty(
    lead.edad,
    lead.age,
    lead.rangoEdad,
    lead.rango_edad,
    mem.edad,
    mem.age,
    mem.rangoEdad,
    mem.rango_edad,
    mem.rangoedad,
    mem.ageRange
  );
  const edad = normalizeEdadValue(edadRaw);

  const arteRaw = pickFirstNonEmpty(
    lead.arte,
    lead.art,
    lead.disciplina,
    lead.discipline,
    mem.arte,
    mem.art,
    mem.disciplina,
    mem.discipline
  );
  const arte = normalizeArteValue(arteRaw);

  const modalidadRaw = pickFirstNonEmpty(
    lead.modalidad,
    lead.mode,
    lead.modalidad_clase,
    lead.classMode,
    mem.modalidad,
    mem.mode,
    mem.modalidad_clase,
    mem.classMode
  );
  const modalidad =
    normalizeModalidadValue(modalidadRaw) ||
    inferModalidadFromServicio(servicioRaw || servicio);

  return { nombre, cel, servicio, edad, arte, modalidad };
}

function getLeadFirstMemory() {
  state.memory = state.memory || {};
  state.memory.leadFirst = state.memory.leadFirst || {
    firstInquiryText: "",
    firstService: "",
    firstAge: "",
    firstArt: "",
    firstModality: "",
    firstNodeId: "",
    firstNodeName: "",
    firstSource: ""
  };

  return state.memory.leadFirst;
}

function readFirstLeadFieldsFromState() {
  const first = getLeadFirstMemory();

  return {
    firstInquiryText: pickFirstNonEmpty(first.firstInquiryText),
    firstService: normalizeServicioValue(first.firstService),
    firstAge: normalizeEdadValue(first.firstAge),
    firstArt: normalizeArteValue(first.firstArt),
    firstModality: normalizeModalidadValue(first.firstModality),
    firstNodeId: pickFirstNonEmpty(first.firstNodeId),
    firstNodeName: pickFirstNonEmpty(first.firstNodeName),
    firstSource: pickFirstNonEmpty(first.firstSource)
  };
}

function hasRememberedLeadPhone() {
  const { cel } = readLeadFieldsFromState();
  return Boolean(cel);
}

function hasRememberedLeadName() {
  const { nombre } = readLeadFieldsFromState();
  return Boolean(nombre);
}

function getPreferredFlowStartNodeId() {
  if (hasRememberedLeadPhone()) return "show_program_options";
  if (hasRememberedLeadName()) return "ask_phone";
  return "";
}

function shouldFreezeInquiryText(text = "") {
  const raw = String(text || "").trim();
  const clean = normalizeLite(raw);
  if (!clean) return false;
  if (!hasRememberedLeadPhone()) return false;

  const blocked = new Set([
    "prefiero no dejarlo",
    "prefer not to share",
    "menu",
    "menú",
    "inicio",
    "home",
    "reiniciar",
    "reset",
    "faq"
  ]);

  return !blocked.has(clean);
}

function freezeFirstLeadSnapshot({ userText = "" } = {}) {
  if (!state) return;

  const first = getLeadFirstMemory();
  const current = readLeadFieldsFromState();
  const hasBusinessSignal = Boolean(
    current.servicio ||
    current.edad ||
    current.arte ||
    current.modalidad
  );

  if (!first.firstInquiryText && shouldFreezeInquiryText(userText)) {
    first.firstInquiryText = String(userText || "").trim();
  }

  if (!first.firstService && current.servicio) first.firstService = current.servicio;
  if (!first.firstAge && current.edad) first.firstAge = current.edad;
  if (!first.firstArt && current.arte) first.firstArt = current.arte;
  if (!first.firstModality && current.modalidad) first.firstModality = current.modalidad;

  if (hasBusinessSignal) {
    if (!first.firstNodeId && state?.progress?.lastNodeId) {
      first.firstNodeId = String(state.progress.lastNodeId).trim();
    }
    if (!first.firstNodeName && state?.progress?.lastNodeName) {
      first.firstNodeName = String(state.progress.lastNodeName).trim();
    }
    if (!first.firstSource && state?.progress?.lastSource) {
      first.firstSource = String(state.progress.lastSource).trim();
    }
  }
}

function clearLeadExplorationMemory() {
  state.memory = state.memory || {};
  state.memory.lead = state.memory.lead || {};

  Object.assign(state.memory.lead, {
    edad: "",
    arte: "",
    modalidad: "",
    servicio: ""
  });

  Object.assign(state.memory, {
    edad: "",
    age: "",
    rangoEdad: "",
    rango_edad: "",
    rangoedad: "",
    ageRange: "",
    arte: "",
    art: "",
    disciplina: "",
    discipline: "",
    modalidad: "",
    mode: "",
    modalidad_clase: "",
    classMode: "",
    servicio: "",
    service: "",
    plan: "",
    detalle_arte: "",
    vacacionales_tipo: ""
  });
}

function rememberUserQuestion(text = "") {
  if (!state) return;
  const value = String(text || "").trim().replace(/\s+/g, " ");
  if (!value) return;

  const blocked = new Set([
    "menu",
    "menÃº",
    "inicio",
    "home",
    "volver",
    "volver al menÃº",
    "prefiero no dejarlo",
    "prefer not to share"
  ]);
  if (blocked.has(normalizeLite(value))) return;

  state.memory = state.memory || {};
  state.memory.training = state.memory.training || {};

  const items = Array.isArray(state.memory.training.userQuestions)
    ? state.memory.training.userQuestions
    : [];
  const last = items[items.length - 1];
  if (last?.text && normalizeLite(last.text) === normalizeLite(value)) return;

  items.push({
    text: value.slice(0, 220),
    at: new Date().toISOString()
  });

  state.memory.training.userQuestions = items.slice(-12);
  state.memory.training.lastUserQuestion = value.slice(0, 220);
  state.memory.training.userMessageCount = Number(state.memory.training.userMessageCount || 0) + 1;
}

function getTrainingMemorySummary() {
  const training = state?.memory?.training || {};
  const items = Array.isArray(training.userQuestions) ? training.userQuestions : [];
  const questions = items
    .map((item) => String(item?.text || "").trim())
    .filter(Boolean);

  return {
    lastUserQuestion: String(training.lastUserQuestion || "").trim(),
    userMessageCount: Number(training.userMessageCount || questions.length || 0),
    userQuestionsSummary: questions.map((q, idx) => `${idx + 1}. ${q}`).join("\n")
  };
}

// Dedupe extra en memoria para evitar llamadas repetidas en loops raros
function getLeadSyncFlags() {
  if (!state) return {};
  state.memory = state.memory || {};
  state.memory.flags = state.memory.flags || {};
  state.memory.flags.leadSync = state.memory.flags.leadSync || {};
  return state.memory.flags.leadSync;
}

// Debounce simple
let leadSyncTimer = null;
function scheduleLeadSync() {
  if (!leadSync || !state) return;
  if (leadSyncTimer) clearTimeout(leadSyncTimer);
  leadSyncTimer = setTimeout(() => {
    syncLeadFromState().catch(() => {});
  }, Number(CONFIG?.LEAD_SYNC_DEBOUNCE_MS ?? 250));
}

async function syncLeadFromState() {
  if (!leadSync || !state) return;

  const { nombre, cel, servicio, edad, arte, modalidad } = readLeadFieldsFromState();
  const {
    firstInquiryText,
    firstService,
    firstAge,
    firstArt,
    firstModality,
    firstNodeId,
    firstNodeName,
    firstSource
  } = readFirstLeadFieldsFromState();
  const {
    lastUserQuestion,
    userMessageCount,
    userQuestionsSummary
  } = getTrainingMemorySummary();
  const flags = getLeadSyncFlags();

  if (isLeadDebug()) {
    console.log("[MusiBot] syncLeadFromState() ->", {
      read: { nombre, cel, servicio, edad, arte, modalidad },
      frozen: {
        firstInquiryText,
        firstService,
        firstAge,
        firstArt,
        firstModality,
        firstNodeId,
        firstNodeName,
        firstSource
      },
      training: {
        lastUserQuestion,
        userMessageCount,
        userQuestionsSummary
      },
      memLead: state?.memory?.lead,
      memLegacy: {
        nombre: state?.memory?.nombre,
        cel: state?.memory?.cel,
        phone: state?.memory?.phone,
        servicio: state?.memory?.servicio,
        edad: state?.memory?.edad,
        age: state?.memory?.age,
        arte: state?.memory?.arte,
        disciplina: state?.memory?.disciplina,
        modalidad: state?.memory?.modalidad
      },
      flags: { ...flags }
    });
  }

  try {
    // Ojo: Sheets puede seguir queriendo nombre/cel. Si no existen, no se mandan.
    if (nombre && flags.nombre !== nombre) {
      await leadSync.saveField("nombre", nombre);
      flags.nombre = nombre;
    }
    if (cel && flags.cel !== cel) {
      await leadSync.saveField("cel", cel);
      flags.cel = cel;
    }
    if (servicio && flags.servicio !== servicio) {
      await leadSync.saveField("servicio", servicio);
      flags.servicio = servicio;
    }
    if (edad && flags.edad !== edad) {
      await leadSync.saveField("edad", edad);
      flags.edad = edad;
    }
    if (arte && flags.arte !== arte) {
      await leadSync.saveField("arte", arte);
      flags.arte = arte;
    }
    if (modalidad && flags.modalidad !== modalidad) {
      await leadSync.saveField("modalidad", modalidad);
      flags.modalidad = modalidad;
    }
    if (firstInquiryText && flags.primer_texto_usuario !== firstInquiryText) {
      await leadSync.saveField("primer_texto_usuario", firstInquiryText, { maxLen: 500 });
      flags.primer_texto_usuario = firstInquiryText;
    }
    if (firstService && flags.primer_servicio !== firstService) {
      await leadSync.saveField("primer_servicio", firstService);
      flags.primer_servicio = firstService;
    }
    if (firstAge && flags.primer_edad !== firstAge) {
      await leadSync.saveField("primer_edad", firstAge);
      flags.primer_edad = firstAge;
    }
    if (firstArt && flags.primer_arte !== firstArt) {
      await leadSync.saveField("primer_arte", firstArt);
      flags.primer_arte = firstArt;
    }
    if (firstModality && flags.primera_modalidad !== firstModality) {
      await leadSync.saveField("primera_modalidad", firstModality);
      flags.primera_modalidad = firstModality;
    }
    if (firstNodeId && flags.primer_node_id !== firstNodeId) {
      await leadSync.saveField("primer_node_id", firstNodeId, { maxLen: 160 });
      flags.primer_node_id = firstNodeId;
    }
    if (firstNodeName && flags.primer_node_name !== firstNodeName) {
      await leadSync.saveField("primer_node_name", firstNodeName, { maxLen: 220 });
      flags.primer_node_name = firstNodeName;
    }
    if (firstSource && flags.primer_origen !== firstSource) {
      await leadSync.saveField("primer_origen", firstSource, { maxLen: 120 });
      flags.primer_origen = firstSource;
    }
    if (lastUserQuestion && flags.ultimo_texto_usuario !== lastUserQuestion) {
      await leadSync.saveField("ultimo_texto_usuario", lastUserQuestion, { maxLen: 280 });
      flags.ultimo_texto_usuario = lastUserQuestion;
    }
    if (userMessageCount && flags.conteo_mensajes_usuario !== userMessageCount) {
      await leadSync.saveField("conteo_mensajes_usuario", String(userMessageCount), { maxLen: 20 });
      flags.conteo_mensajes_usuario = userMessageCount;
    }
    if (userQuestionsSummary && flags.historial_usuario !== userQuestionsSummary) {
      await leadSync.saveField("historial_usuario", userQuestionsSummary, { maxLen: 1600 });
      flags.historial_usuario = userQuestionsSummary;
    }
  } catch (e) {
    console.warn("[MusiBot] No se pudo sincronizar lead:", e?.message || e);
  }
}

/* =========================
   UI I18N (interfaz general)
========================= */

function normalizeLang(lang) {
  return lang === "en" ? "en" : "es";
}
function getLang() {
  return normalizeLang(uiLang);
}
function setLang(lang) {
  uiLang = normalizeLang(lang);
  // persist in memory
  if (state?.memory) {
    state.memory.ui = state.memory.ui || {};
    state.memory.ui.lang = uiLang;
  }
}

function mapI18nFlat(raw = {}) {
  const app = raw.app || {};
  const labels = raw.labels || {};
  const help = raw.help || {};
  const intro = raw.intro || {};

  const flat = {
    language: app.language || labels.language,
    brandSub: app.brandSub || labels.brandSub,
    chatTitle: app.chatTitle || labels.chatTitle,
    reset: app.reset || labels.reset,
    inputPlaceholder: app.inputPlaceholder || labels.inputPlaceholder,
    send: app.send || labels.send,
    helpTitle: app.helpTitle || labels.helpTitle,
    helpQuick: app.helpQuick || labels.quickHelp,
    faqTitle: app.faqTitle || labels.faqs,
    videoNotSupported: app.videoNotSupported || labels.videoNotSupported,

    introTitle: intro.title,
    introP1: intro.p1,
    introP2: intro.p2,
    introSkip: intro.skip,
    start: intro.start,
    introMutedHint: intro.mutedHint,

    helpWhatIsTitle: help?.whatIsThis?.title,
    helpWhatIsText: help?.whatIsThis?.text,

    helpHowTitle: help?.howItWorks?.title,
    helpHowText: help?.howItWorks?.text,

    helpAskTitle: help?.whatCanIAsk?.title,
    helpAskText: help?.whatCanIAsk?.text,

    helpExactTitle: help?.exactRecommendation?.title,
    helpExactText: help?.exactRecommendation?.text,

    helpWhatsappTitle: help?.whatsapp?.title,
    helpWhatsappText: help?.whatsapp?.text
  };

  Object.keys(flat).forEach((k) => {
    if (flat[k] == null || flat[k] === "") delete flat[k];
  });

  return flat;
}

function initI18nGlobals() {
  if (typeof window === "undefined") return;

  const mappedES = mapI18nFlat(I18N_ES_RAW);
  const mappedEN = mapI18nFlat(I18N_EN_RAW);

  window.I18N_ES = { ...mappedES, ...(window.I18N_ES || {}) };
  window.I18N_EN = { ...mappedEN, ...(window.I18N_EN || {}) };
}
initI18nGlobals();

function dict(lang) {
  const wES = (typeof window !== "undefined" && window.I18N_ES) ? window.I18N_ES : {};
  const wEN = (typeof window !== "undefined" && window.I18N_EN) ? window.I18N_EN : {};

  const fallbackES = {
    language: "Idioma",
    brandSub: "Asistente • Musicala",
    chatTitle: "Chat",
    reset: "Reiniciar",
    inputPlaceholder: "Escribe aquí...",
    send: "Enviar",
    helpTitle: "Ayuda",
    helpQuick: "Ayuda rápida",
    faqTitle: "Preguntas frecuentes",
    siteShort: "Sitio web",
    videoNotSupported: "Tu navegador no soporta video.",
    introTitle: "Bienvenido a MusiBot 🎵",
    introP1: "Soy tu asistente de Musicala.",
    introP2: "Usa los botones o escribe para comenzar.",
    start: "Empezar",
    waConfigMissing: "Configura el número de WhatsApp en config.js 🙃",
    waTopFallback: "Hola 😊 Quiero hablar con un asesor de Musicala.",
    waFinalFallback: "Hola 😊 Quiero información para clases."
  };

  const fallbackEN = {
    language: "Language",
    brandSub: "Assistant • Musicala",
    chatTitle: "Chat",
    reset: "Reset",
    inputPlaceholder: "Type here...",
    send: "Send",
    helpTitle: "Help",
    helpQuick: "Quick help",
    faqTitle: "FAQ",
    siteShort: "Website",
    videoNotSupported: "Your browser doesn’t support video.",
    introTitle: "Welcome to MusiBot 🎵",
    introP1: "I’m Musicala’s assistant.",
    introP2: "Use the buttons or type to start.",
    start: "Start",
    waConfigMissing: "Set the WhatsApp number in config.js 🙃",
    waTopFallback: "Hi 😊 I’d like to talk to a Musicala advisor.",
    waFinalFallback: "Hi 😊 I’d like info about classes."
  };

  const base = lang === "en" ? fallbackEN : fallbackES;
  const extra = lang === "en" ? wEN : wES;
  return { ...base, ...extra };
}

function t(key) {
  return dict(getLang())[key] ?? key;
}

function applyUILang(lang) {
  const safe = normalizeLang(lang);
  setLang(safe);

  const root = document.documentElement;
  if (root) {
    root.lang = safe;
    root.dataset.lang = safe;
  }

  const btnES = document.getElementById("langBtnES");
  const btnEN = document.getElementById("langBtnEN");
  if (btnES) btnES.classList.toggle("active", safe === "es");
  if (btnEN) btnEN.classList.toggle("active", safe === "en");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (!k) return;
    el.textContent = t(k);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const k = el.getAttribute("data-i18n-placeholder");
    if (!k) return;
    el.setAttribute("placeholder", t(k));
  });

  // WhatsApp TOP siempre listo y con texto del idioma
  setupWhatsAppTopBtn();
  setupWebsiteTopBtn();

  if (state) {
    try {
      relocalizeHistory(state);
      renderAll(state);
      updateComposerModeFromFlow();
    } catch {}
  }

  renderFAQFromKB();
  try { saveState(state); } catch {}
}

function bindLangUI() {
  const btnES = document.getElementById("langBtnES");
  const btnEN = document.getElementById("langBtnEN");
  if (btnES) btnES.addEventListener("click", () => applyUILang("es"));
  if (btnEN) btnEN.addEventListener("click", () => applyUILang("en"));
}

/* =========================
   HELP PANEL (compatibilidad)
========================= */

function openHelpPanel(target = "") {
  const help = document.getElementById("helpDetails");
  if (!help) return;

  logAction("open_panel", { panel: target === "faq" ? "faq" : "help" });

  help.open = true;

  if (target === "faq") {
    const faq = document.getElementById("faqDetails");
    if (faq) faq.open = true;
  }

  help.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* =========================
   FAQ: abrir una pregunta específica
========================= */

function normalizeLite(s = "") {
  try {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

const COLOMBIAN_GREETING_PATTERNS = Object.freeze([
  "hola",
  "holaa",
  "holaaa",
  "holas",
  "holis",
  "holi",
  "hello",
  "hi",
  "hey",
  "buenas",
  "buenas tardes",
  "buenos dias",
  "buen dia",
  "buenas noches",
  "que mas",
  "que mas pues",
  "q mas",
  "q mas pues",
  "qmas",
  "qmas pues",
  "que hubo",
  "que hubo pues",
  "q hubo",
  "qhubo",
  "kiubo",
  "kubo",
  "quiubo",
  "quiubo pues",
  "quihubo",
  "quihubo pues",
  "que onda",
  "como estan",
  "como estas",
  "como van",
  "como vamos"
]);

function isGreetingOnlyText(text = "") {
  const clean = normalizeLite(text);
  if (!clean) return false;

  const filler = new Set(["pues", "parce", "musicala", "equipo", "buenas"]);
  if (/^hola+s?$/.test(clean)) return true;
  if (COLOMBIAN_GREETING_PATTERNS.includes(clean)) return true;

  return COLOMBIAN_GREETING_PATTERNS.some((greeting) => {
    if (!clean.startsWith(`${greeting} `)) return false;
    const rest = clean.slice(greeting.length).trim();
    const restWords = rest.split(" ").filter(Boolean);
    return restWords.length > 0 && restWords.length <= 2 && restWords.every((word) => filler.has(word));
  });
}

/* =========================
   MEMORIA CONVERSACIONAL
========================= */

function getConversationalSession() {
  state.memory = state.memory || {};
  state.memory.session = state.memory.session || {};
  state.memory.session.collected = state.memory.session.collected || {};

  const session = state.memory.session;
  const collected = session.collected;

  session.lastMenu = String(session.lastMenu || "").trim();
  session.expectedInput = String(session.expectedInput || "").trim();

  collected.name = pickFirstNonEmpty(collected.name, state.memory?.lead?.name, state.memory?.nombre);
  collected.phone = pickFirstNonEmpty(collected.phone, state.memory?.lead?.phone, state.memory?.cel, state.memory?.phone);
  collected.age = pickFirstNonEmpty(collected.age, state.memory?.lead?.edad, state.memory?.edad, state.memory?.age);
  collected.art = pickFirstNonEmpty(collected.art, state.memory?.lead?.arte, state.memory?.arte, state.memory?.art);
  collected.service = pickFirstNonEmpty(collected.service, state.memory?.lead?.servicio, state.memory?.servicio);
  collected.modality = pickFirstNonEmpty(collected.modality, state.memory?.lead?.modalidad, state.memory?.modalidad);
  collected.intent = String(collected.intent || "").trim();

  return session;
}

function rememberCollectedField(field, value) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return;

  const session = getConversationalSession();
  session.collected[field] = cleanValue;

  state.memory.lead = state.memory.lead || {};

  if (field === "name") {
    state.memory.lead.name = cleanValue;
    state.memory.nombre = cleanValue;
  }
  if (field === "phone") {
    state.memory.lead.phone = cleanValue;
    state.memory.cel = cleanValue;
    state.memory.phone = cleanValue;
  }
  if (field === "age") {
    state.memory.lead.edad = cleanValue;
    state.memory.edad = cleanValue;
    state.memory.age = cleanValue;
  }
  if (field === "art") {
    state.memory.lead.arte = cleanValue;
    state.memory.arte = cleanValue;
  }
  if (field === "service") {
    state.memory.lead.servicio = cleanValue;
    state.memory.servicio = cleanValue;
  }
  if (field === "modality") {
    state.memory.lead.modalidad = cleanValue;
    state.memory.modalidad = cleanValue;
  }
  if (field === "intent") {
    state.memory.intent = cleanValue;
  }
}

function normalizePhoneCandidate(text = "") {
  const raw = String(text || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return raw.replace(/[^\d+()\-\s]/g, "").replace(/\s+/g, " ").trim().slice(0, 32);
}

function extractPhoneFromText(text = "") {
  const matches = String(text || "").match(/(?:\+?\d[\d\s().-]{5,}\d)/g) || [];
  for (const match of matches) {
    const phone = normalizePhoneCandidate(match);
    if (phone) return phone;
  }
  return "";
}

function extractAgeFromText(text = "") {
  const clean = normalizeLite(text);
  const patterns = [
    /\b(?:tengo|para|for)\s+(?:un|una|mi)?\s*(?:bebe|beb[eé]|pequeno|pequeño|hija|hijo|nina|niña|nino|niño|estudiante)?\s*(?:de)?\s*(\d{1,2})\s*(?:anos|years?)?\b/,
    /\b(?:tiene|de|edad|age|aged)\s+(\d{1,2})\s*(?:anos|years?)?\b/,
    /\b(\d{1,2})\s*(?:anos|years?)\b/
  ];

  for (const re of patterns) {
    const match = clean.match(re);
    if (!match) continue;
    const age = Number(match[1]);
    if (Number.isFinite(age) && age >= 0 && age <= 99) return `${age} años`;
  }

  return "";
}

function extractArtFromText(text = "") {
  const clean = normalizeLite(text);
  if (!clean) return "";

  const arts = [
    ["Piano/Teclado", ["piano", "teclado"]],
    ["Canto", ["canto", "voz", "vocal"]],
    ["Violin", ["violin"]],
    ["Guitarra", ["guitarra"]],
    ["Bateria", ["bateria", "percusion"]],
    ["Danza", ["danza", "baile", "ballet", "hip hop"]],
    ["Teatro", ["teatro", "actuacion"]],
    ["Artes plasticas", ["artes plasticas", "pintura", "dibujo", "manualidades"]]
  ];

  const hit = arts.find(([, patterns]) => patterns.some((pattern) => clean.includes(pattern)));
  return hit?.[0] || "";
}

function extractModalityFromText(text = "") {
  const clean = normalizeLite(text);
  if (!clean) return "";
  if (/\b(en sede|sede|presencial|pasadena)\b/.test(clean)) return "En sede";
  if (/\b(domicilio|hogar|casa)\b/.test(clean)) return "A domicilio";
  if (/\b(virtual|online|linea|en vivo)\b/.test(clean)) return "Virtual";
  return "";
}

function extractBetterAgeFromText(text = "") {
  const clean = normalizeLite(text);
  const pair = clean.match(/\b(\d{1,2})\s+y\s+(\d{1,2})\s*(?:anos|years?)?\b/);
  if (pair) {
    const ages = pair.slice(1).map((item) => Number(item)).filter((age) => Number.isFinite(age) && age >= 0 && age <= 99);
    if (ages.length > 1) return ages.map((age) => `${age} anos`).join(" y ");
  }

  const family = clean.match(/\b(?:mi\s+)?(?:hija|hijo|nina|nino|estudiante)\s+(?:tiene|de)?\s*(\d{1,2})\s*(?:anos|years?)?\b/);
  if (family) {
    const age = Number(family[1]);
    if (Number.isFinite(age) && age >= 0 && age <= 99) return `${age} anos`;
  }

  return "";
}

function isSoftFlowInterrupt(text = "") {
  const clean = normalizeLite(text);
  if (!clean) return false;

  return (
    isPriceQuestionText(clean) ||
    /\b(ubicacion|direccion|donde estan|donde quedan|donde se ubican|ciudad|pasadena|maps)\b/.test(clean) ||
    /\b(horario|horarios|dias|disponibilidad|a que horas|schedule|hours)\b/.test(clean) ||
    /\b(academia de arte|escuela de arte|que ensenan|que artes|artes|musica|danza|teatro|artes plasticas|piano|canto|violin|bateria|guitarra|dibujo)\b/.test(clean) ||
    /\b(virtual|online|domicilio|hogar|presencial|sede|on site|on-site|at home)\b/.test(clean) ||
    /\b(whatsapp|whapst|wsp|asesor|asesora|humano|agendar|inscripcion|matricula)\b/.test(clean) ||
    /\b(clase de prueba|cortesia|gratis|prueba)\b/.test(clean)
  );
}

function extractNameFromText(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (isGreetingOnlyText(raw)) return "";

  const asciiRaw = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const match = asciiRaw.match(/\b(?:me\s+llamo|mi\s+nombre\s+es|soy)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3})/i);
  if (match?.[1]) {
    return match[1]
      .replace(/\b(?:mi|hija|hijo|tiene|anos|que|costos?|precios?|vale|valor)\b.*$/i, "")
      .replace(/\b(?:ni\s+hija|ni\s+hijo|mi\s+hija|mi\s+hijo)\b.*$/i, "")
      .replace(/\b(?:mi|ni)\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  const clean = normalizeLite(raw);
  const expected = String(state?.memory?.session?.expectedInput || state?.memory?.capture?.stage || "").toLowerCase();
  if (expected === "phone" && /^[a-zA-Z]+(?:\s+[a-zA-Z]+){0,3}$/.test(asciiRaw) && !isPoliteSkipInput(clean)) {
    return raw.slice(0, 80);
  }

  return "";
}

function isPoliteSkipInput(cleanText = "") {
  return [
    "prefiero no dejarlo",
    "no",
    "despues",
    "sin datos",
    "continuar sin dejarlo",
    "prefer not to share"
  ].some((item) => cleanText === item || cleanText.includes(item));
}

function detectConversationalIntent(text = "") {
  const clean = normalizeLite(text);
  if (!clean) return "";

  if (/\b(precio|precios|costo|costos|tarifa|tarifas|valor|cuanto vale|cuanto cuesta|pricing|price|cost)\b/.test(clean)) return "prices";
  if (/\b(usd|dolar|dolares|dólar|dólares|aprox en usd|approx in usd|conversion|conversi[oó]n)\b/.test(clean)) return "usd";
  if (/\b(vacacional|vacacionales|vacacionalea|vacasional|vacasionales|vacaciones|vacaciones artisticas|curso vacaciones|holiday)\b/.test(clean)) return "vacacionales";
  if (/\b(ubicacion|direccion|donde estan|donde quedan|donde se ubican|ciudad|maps|location|address)\b/.test(clean)) return "location";
  if (/\b(horario|horarios|dias|disponibilidad|a que horas|schedule|hours)\b/.test(clean)) return "schedules";
  if (/\b(virtual|online|plataforma|clases virtuales|live online)\b/.test(clean)) return "virtual";
  if (/\b(domicilio|hogar|en casa|a casa|at home|home classes)\b/.test(clean)) return "home";
  if (/\b(presencial|sede|en sede|pasadena|on site|on-site|in person)\b/.test(clean)) return "onsite";
  if (/\b(academia de arte|escuela de arte|artes plasticas|musica danza arte teatro|clases de piano|clases de canto|clases de violin|clases de bateria|curso de bateria|curso de dibujo|dibujo|piano|canto|violin|bateria|guitarra|art academy)\b/.test(clean)) return "arts";
  if (/\b(clase de prueba|clase gratis|cortesia|prueba|trial|free class)\b/.test(clean)) return "trial";
  if (/\b(whatsapp|whapst|wsp|asesor|asesora|agendar|cupo|disponibilidad|pagar|pago|inscripcion|matricula|advisor)\b/.test(clean)) return "advisor";

  return "";
}

function rememberConversationContextFromBot(botReply) {
  if (!botReply || !state) return;

  const options = Array.isArray(botReply.options) ? botReply.options : [];
  const session = getConversationalSession();
  const labels = options.map((opt) => normalizeLite(opt?.label || opt?.value || opt)).filter(Boolean);

  if (labels.length) {
    session.expectedInput = "menu_option";
    if (
      labels.some((label) => label.includes("cursos vacacionales")) &&
      labels.some((label) => label.includes("clases presenciales")) &&
      labels.some((label) => label.includes("clases virtuales"))
    ) {
      session.lastMenu = "main_menu";
    } else {
      session.lastMenu = String(botReply?._flow?.nodeId || state.currentNodeId || "flow_menu").trim();
    }
  } else if (botReply?._flow?.allowFreeText === true) {
    session.expectedInput = state?.memory?.capture?.stage || "free_text";
  }
}

function buildMainMenuReply(prefix = "") {
  const text = [
    prefix || "Te dejo las opciones principales:",
    "1. Cursos Vacacionales",
    "2. Clases Presenciales",
    "3. Clases Virtuales",
    "4. Clases a Domicilio",
    "5. Otros Servicios",
    "6. Ver precios",
    "7. Hablar con un asesor por WhatsApp"
  ].join("\n");

  const msg = makeBotMessage(text, [
    { label: "Cursos Vacacionales", value: "1", kind: "option" },
    { label: "Clases Presenciales", value: "2", kind: "option" },
    { label: "Clases Virtuales", value: "3", kind: "option" },
    { label: "Clases a Domicilio", value: "4", kind: "option" },
    { label: "Otros Servicios", value: "5", kind: "option" },
    { label: "Ver precios", value: "6", kind: "option" },
    { label: "Hablar por WhatsApp", value: "WHATSAPP", kind: "global:WHATSAPP" }
  ]);
  msg._flow = { allowFreeText: true, conversationalMenu: true };

  const session = getConversationalSession();
  session.lastMenu = "main_menu";
  session.expectedInput = "menu_option";

  return msg;
}

function buildGreetingReply() {
  return buildMainMenuReply("¡Hola! Qué bueno tenerte por aquí. ¿Qué te gustaría conocer de Musicala?");
}

function resolveMainMenuOption(cleanText = "") {
  const option = String(cleanText || "").trim();

  if (option === "6") return buildConversationalPricesReply();
  if (option === "7") {
    const msg = makeBotMessage(
      "Para continuar por WhatsApp con nuestro equipo, puedes escribirnos al 319 3529475.",
      [{ label: "Hablar por WhatsApp", value: "WHATSAPP", kind: "global:WHATSAPP" }]
    );
    msg._flow = { allowFreeText: true, isClosing: true, action: "WHATSAPP" };
    return msg;
  }

  if (/^[1-5]$/.test(option)) {
    try {
      state.currentNodeId = "show_program_options";
      state.awaitingNodeId = "show_program_options";
      return handleUserInput(option, state);
    } catch {
      return null;
    }
  }

  return null;
}

function resolveNumberFromVisibleOptions(cleanText = "") {
  const number = Number(String(cleanText || "").trim());
  if (!Number.isFinite(number) || number < 1) return null;

  const lastBotWithOptions = getLastBotWithOptions();
  const options = Array.isArray(lastBotWithOptions?.options) ? lastBotWithOptions.options : [];
  const option = options[number - 1];
  if (!option) return null;

  const value =
    typeof option === "string"
      ? option
      : String(option.value || option.label || option.text || "").trim();
  if (!value) return null;

  return handleUserInput(value, state);
}

function buildConversationalPricesReply() {
  const session = getConversationalSession();
  const name = session.collected.name;
  const age = session.collected.age;
  const art = session.collected.art;
  const modality = session.collected.modality;
  const greeting = name ? `Gracias, ${name}. ` : "";
  const context = [
    age ? `edad: ${age}` : "",
    art ? `arte: ${art}` : "",
    modality ? `modalidad: ${modality}` : ""
  ].filter(Boolean);
  const ageHint = context.length
    ? `Con lo que me cuentas (${context.join(", ")}), puedo orientarte mejor.\n\n`
    : "";
  const missingContext = [
    !art ? "el arte que le interesa" : "",
    !modality ? "si prefieren sede, domicilio o virtual" : "",
    !age ? "la edad del estudiante" : ""
  ].filter(Boolean);
  const recommendationPrompt = missingContext.length
    ? `Para recomendarte bien, dime ${joinHumanList(missingContext)}.`
    : "Con esos datos ya podemos aterrizar mejor el plan ideal; si quieres, te paso con un asesor para confirmar cupos y horario.";

  const msg = makeBotMessage(
    `${greeting}${ageHint}Tenemos opciones desde $56.000 y la matrícula anual cuesta $60.000.\n\n` +
      "Rangos principales:\n" +
      "- Virtual / Automusicala: desde $56.000\n" +
      "- A domicilio / Musifamiliar: desde $288.000\n" +
      "- En sede, grupales o personalizadas: desde $280.000\n" +
      "- Preuniversitario / talleres creativos: desde $150.000\n\n" +
      recommendationPrompt,
    [
      { label: "Cursos Vacacionales", value: "vacacionales", kind: "option" },
      { label: "Clases en sede", value: "presencial", kind: "option" },
      { label: "Clases virtuales", value: "virtual", kind: "option" },
      { label: "Hablar por WhatsApp", value: "WHATSAPP", kind: "global:WHATSAPP" }
    ]
  );
  msg._flow = { allowFreeText: true, inlineKnowledge: true, knowledgeIntentId: "prices" };
  return msg;
}

function buildLocationReply() {
  const msg = makeBotMessage(
    getLang() === "en"
      ? "We are in *Bogotá*, in Pasadena: *Carrera 45A #103B-34*.\n\nOn Maps you can search: _MUSICALA ESCUELA DE MUSICA, DANZA Y ARTE_.\nPhone/WhatsApp: *+57 319 3529475*.\n\nWe are close to Calle 106 TransMilenio, with motorcycle and bike parking."
      : "Estamos en *Bogotá*, barrio Pasadena: *Carrera 45A #103B-34*.\n\nEn Maps nos encuentras como: _MUSICALA ESCUELA DE MUSICA, DANZA Y ARTE_.\nTel/WhatsApp: *319 3529475*.\n\nEstamos cerca de TransMilenio calle 106 y hay parqueo para moto y bici.",
    [
      { label: getLang() === "en" ? "See schedules" : "Ver horarios", value: "horarios", kind: "option" },
      { label: getLang() === "en" ? "Talk on WhatsApp" : "Hablar por WhatsApp", value: "WHATSAPP", kind: "global:WHATSAPP" }
    ]
  );
  msg._flow = { allowFreeText: true, inlineKnowledge: true, knowledgeIntentId: "location" };
  return msg;
}

function buildSchedulesReply() {
  const msg = makeBotMessage(
    getLang() === "en"
      ? "*Support:* Mon-Fri 8:00 a.m.-6:00 p.m.; Sat 9:00 a.m.-1:00 p.m.\n\n*Online and at-home classes:* Mon-Sun 8:00 a.m.-8:00 p.m.\n\n*On-site classes:* personalized classes Mon-Fri 11:00 a.m.-8:00 p.m. and Sat 8:00 a.m.-5:00 p.m.; group classes are scheduled Mon-Sat by age and level.\n\nTell me the student's age and the days that work for you, and I can guide you better."
      : "*Atención:* lunes a viernes 8:00 a.m.-6:00 p.m.; sábados 9:00 a.m.-1:00 p.m.\n\n*Virtual y Hogar:* lunes a domingo 8:00 a.m.-8:00 p.m.\n\n*En sede:* personalizadas lunes a viernes 11:00 a.m.-8:00 p.m. y sábados 8:00 a.m.-5:00 p.m.; grupales de lunes a sábado según edad y nivel.\n\nSi me dices la edad y qué días te sirven, te oriento mejor.",
    [
      { label: getLang() === "en" ? "See prices" : "Ver precios", value: "precios", kind: "option" },
      { label: getLang() === "en" ? "Talk on WhatsApp" : "Hablar por WhatsApp", value: "WHATSAPP", kind: "global:WHATSAPP" }
    ]
  );
  msg._flow = { allowFreeText: true, inlineKnowledge: true, knowledgeIntentId: "schedules" };
  return msg;
}

function buildModalityDetailReply(intent = "") {
  const lang = getLang();
  let text = "";
  let rememberedModality = "";

  if (intent === "virtual") {
    rememberedModality = "Virtual";
    text = lang === "en"
      ? "For *online classes*, we have live guidance and, depending on the program, online platform options. Scheduling can usually be coordinated from 8:00 a.m. to 8:00 p.m.\n\nIt works well for music, visual arts, theatre and some dance processes when the goal and age fit the format."
      : "En *clases virtuales* tenemos acompañamiento en vivo y, según el programa, opciones de plataforma online. Normalmente se pueden coordinar horarios entre 8:00 a.m. y 8:00 p.m.\n\nFunciona bien para música, artes plásticas, teatro y algunos procesos de danza cuando la edad y el objetivo encajan con el formato.";
  } else if (intent === "home") {
    rememberedModality = "A domicilio";
    text = lang === "en"
      ? "For *at-home classes*, we coordinate according to neighborhood, teacher availability and the student's goal. We cover Bogotá and nearby areas, subject to logistics.\n\nShare neighborhood/municipality, art area and age so an advisor can confirm availability and final price."
      : "En *clases a domicilio*, coordinamos según barrio, disponibilidad docente y objetivo del estudiante. Cubrimos Bogotá y alrededores, sujeto a logística.\n\nLo ideal es compartir barrio/municipio, arte y edad para confirmar disponibilidad y precio final.";
  } else {
    rememberedModality = "En sede";
    text = lang === "en"
      ? "For *on-site classes*, we welcome students at our Pasadena location. There are personalized and small-group options depending on age, art area and level.\n\nThe exact schedule depends on the program, but on-site personalized classes usually run Mon-Fri and Saturdays."
      : "En *clases presenciales*, atendemos en nuestra sede de Pasadena. Hay opciones personalizadas y grupos pequeños según edad, arte y nivel.\n\nEl horario exacto depende del programa; las personalizadas en sede suelen funcionar entre semana y sábados.";
  }

  rememberCollectedField("modality", rememberedModality);
  const msg = makeBotMessage(text, [
    { label: lang === "en" ? "See prices" : "Ver precios", value: "precios", kind: "option" },
    { label: lang === "en" ? "Talk on WhatsApp" : "Hablar por WhatsApp", value: "WHATSAPP", kind: "global:WHATSAPP" }
  ]);
  msg._flow = { allowFreeText: true, inlineKnowledge: true, knowledgeIntentId: intent || "modalities" };
  return msg;
}

function buildArtsReply() {
  const session = getConversationalSession();
  const art = session.collected.art;
  const age = session.collected.age;
  const prefix = art
    ? `Sí, manejamos *${art}* en Musicala. `
    : "En Musicala trabajamos música, danza, teatro y artes plásticas. ";
  const ageLine = age
    ? `Para ${age}, lo importante es elegir formato y ritmo adecuados. `
    : "";
  const msg = makeBotMessage(
    `${prefix}${ageLine}Podemos orientar el proceso según edad, modalidad y objetivo: explorar, iniciar desde cero, reforzar técnica o preparar un proyecto.\n\n` +
      "Si me dices si prefieren sede, virtual o domicilio, te recomiendo el camino más lógico.",
    [
      { label: "En sede", value: "presencial", kind: "option" },
      { label: "Virtual", value: "virtual", kind: "option" },
      { label: "A domicilio", value: "domicilio", kind: "option" },
      { label: "Ver precios", value: "precios", kind: "option" }
    ]
  );
  msg._flow = { allowFreeText: true, inlineKnowledge: true, knowledgeIntentId: "arts" };
  return msg;
}

function buildTrialReply() {
  const msg = makeBotMessage(
    "Tenemos dos caminos:\n\n1. *Clase de prueba con valor* de 60 minutos, disponible durante el año.\n2. *Clase de cortesía gratis* de 60 minutos cuando hay fechas o promociones especiales.\n\nPara confirmar si hoy aplica cortesía, lo mejor es validar cupo y modalidad con un asesor.",
    [
      { label: "Hablar por WhatsApp", value: "WHATSAPP", kind: "global:WHATSAPP" },
      { label: "Ver precios", value: "precios", kind: "option" }
    ]
  );
  msg._flow = { allowFreeText: true, inlineKnowledge: true, knowledgeIntentId: "trial_or_courtesy" };
  return msg;
}

function buildUsdApproxFallbackReply() {
  const lang = getLang();
  const msg = makeBotMessage(
    lang === "en"
      ? "Approximate conversion using *COP 4,000 = USD 1*:\n\n- Virtual / online from COP $56,000: about *USD $14*\n- On-site from COP $280,000: about *USD $70*\n- At home from COP $288,000: about *USD $72*\n- Personalized 4-class plans around COP $314,000: about *USD $79*\n- At-home 24-class plans around COP $1,912,000: about *USD $478*\n\nIt is an estimate; the final COP price is the official reference."
      : "Conversión aproximada usando *COP 4.000 = USD 1*:\n\n- Virtual / online desde $56.000: aprox. *USD $14*\n- En sede desde $280.000: aprox. *USD $70*\n- A domicilio desde $288.000: aprox. *USD $72*\n- Planes personalizados de 4 clases alrededor de $314.000: aprox. *USD $79*\n- Planes hogar de 24 clases alrededor de $1.912.000: aprox. *USD $478*\n\nEs una referencia; el precio oficial final se confirma en COP.",
    [
      { label: lang === "en" ? "Talk on WhatsApp" : "Hablar por WhatsApp", value: "WHATSAPP", kind: "global:WHATSAPP" },
      { label: lang === "en" ? "See prices" : "Ver precios", value: "precios", kind: "option" }
    ]
  );
  msg._flow = { allowFreeText: true, inlineKnowledge: true, knowledgeIntentId: "usd_approx" };
  return msg;
}

function buildVacationCoursesReply() {
  const msg = makeBotMessage(
    "Creo que te refieres a Cursos Vacacionales. Para mitad de año tendremos Vacaciones Artísticas del 9 de junio al 6 de agosto de 2026, para niños, niñas y jóvenes de 4 a 15 años.\n\n" +
      "Tenemos opciones en sede Pasadena, a domicilio y virtual en vivo.\n\n" +
      "Para orientarte bien, dime la edad del estudiante.",
    [
      { label: "Ver precios vacacionales", value: "precios vacacionales", kind: "option" },
      { label: "En sede Pasadena", value: "vacacionales sede", kind: "option" },
      { label: "A domicilio", value: "vacacionales domicilio", kind: "option" },
      { label: "Hablar por WhatsApp", value: "WHATSAPP", kind: "global:WHATSAPP" }
    ]
  );
  msg._flow = { allowFreeText: true, inlineKnowledge: true, knowledgeIntentId: "vacacionales" };
  rememberCollectedField("service", "Cursos Vacacionales");
  return msg;
}

function buildAdvisorReply(prefix = "") {
  const msg = makeBotMessage(
    [
      prefix || "Claro. Si prefieres que una persona del equipo te ayude, puedes continuar por WhatsApp.",
      "Te recomiendo enviar: edad del estudiante, arte de interes y modalidad preferida para que te respondan mas rapido."
    ].join("\n\n"),
    [
      { label: "Hablar por WhatsApp", value: "WHATSAPP", kind: "global:WHATSAPP" },
      { label: "Ver programas", value: "menu", kind: "global:MENU" }
    ]
  );
  msg._flow = { allowFreeText: true, isClosing: true, action: "WHATSAPP", conversationalAdvisor: true };
  return msg;
}

function handleConversationalStateBeforeFlow(text = "") {
  const raw = String(text || "").trim();
  const clean = normalizeLite(raw);
  if (!clean) return null;

  const session = getConversationalSession();
  const captureStage = String(state?.memory?.capture?.stage || "").trim().toLowerCase();

  if (/^\d{1,2}$/.test(clean) && !captureStage && getLastBotWithOptions()) {
    const routed = resolveNumberFromVisibleOptions(clean) || handleUserInput(clean, state);
    if (routed) return { botReply: routed, handled: true };
  }

  if (/^\d{1,2}$/.test(clean) && session.lastMenu === "main_menu") {
    const resolved = resolveMainMenuOption(clean);
    if (resolved) return { botReply: resolved, handled: true };
  }

  const phone = extractPhoneFromText(raw);
  if (phone) {
    const wasCollectingPhone =
      String(state?.awaitingNodeId || state?.currentNodeId || "").trim() === "ask_phone" ||
      String(state?.memory?.capture?.stage || "").trim().toLowerCase() === "phone";
    rememberCollectedField("phone", phone);
    state.memory.capture = state.memory.capture || {};
    state.memory.capture.stage = null;
    state.awaitingNodeId = null;

    if (wasCollectingPhone) {
      try {
        return { botReply: runNode("show_program_options", state), handled: true };
      } catch {}
    }

    const msg = makeBotMessage(
      "Gracias. Guardé ese número como contacto. Ahora seguimos justo donde íbamos.",
      getLastBotWithOptions()?.options || []
    );
    msg._flow = { allowFreeText: true, conversationalCapture: "phone" };
    return { botReply: msg, handled: true };
  }

  const name = extractNameFromText(raw);
  if (name && !session.collected.name) {
    rememberCollectedField("name", name);
  }

  const age = extractBetterAgeFromText(raw) || extractAgeFromText(raw);
  if (age) rememberCollectedField("age", age);

  const art = extractArtFromText(raw);
  if (art) rememberCollectedField("art", art);

  const modality = extractModalityFromText(raw);
  if (modality) rememberCollectedField("modality", modality);

  if (isPoliteSkipInput(clean)) {
    state.memory.capture = state.memory.capture || {};
    state.memory.capture.stage = null;
    session.expectedInput = "free_text";
  }

  const intent = detectConversationalIntent(raw);
  if (intent) rememberCollectedField("intent", intent);

  if (!intent && isGreetingOnlyText(raw)) {
    return { botReply: buildGreetingReply(), handled: true };
  }

  if (intent === "advisor") {
    return { botReply: buildAdvisorReply(), handled: true };
  }

  if (name && String(state?.memory?.capture?.stage || session.expectedInput).toLowerCase() === "phone") {
    state.memory.capture = state.memory.capture || {};
    state.memory.capture.stage = null;
    state.awaitingNodeId = null;
    const msg = makeBotMessage(
      `Gracias, ${name}. Ya guardé tu nombre. Si quieres, también puedes dejar tu celular para que un asesor te contacte, o puedes seguir sin dejarlo.`,
      [
        { label: "Prefiero no dejarlo", value: "Prefiero no dejarlo", kind: "option" },
        { label: "Ver programas", value: "menu", kind: "global:MENU" }
      ]
    );
    msg._flow = { allowFreeText: true, conversationalCapture: "name" };
    return { botReply: msg, handled: true };
  }

  if (/^\d{1,2}$/.test(clean) && !getLastBotWithOptions() && !session.lastMenu) {
    return {
      botReply: buildMainMenuReply("Creo que elegiste una opción del menú, pero necesito retomarlo para ubicarte bien."),
      handled: true
    };
  }

  if (intent === "prices") return { botReply: buildConversationalPricesReply(), handled: true };
  if (intent === "usd") return { botReply: buildUsdApproxFallbackReply(), handled: true };
  if (intent === "vacacionales") return { botReply: buildVacationCoursesReply(), handled: true };
  if (intent === "location") return { botReply: buildLocationReply(), handled: true };
  if (intent === "schedules") return { botReply: buildSchedulesReply(), handled: true };
  if (intent === "virtual" || intent === "home" || intent === "onsite") return { botReply: buildModalityDetailReply(intent), handled: true };
  if (intent === "arts") return { botReply: buildArtsReply(), handled: true };
  if (intent === "trial") return { botReply: buildTrialReply(), handled: true };

  if (isSoftFlowInterrupt(raw)) {
    const knowledgeInterrupt = handleInlineKnowledgeInterrupt(raw);
    if (knowledgeInterrupt?.botReply) {
      return { botReply: knowledgeInterrupt.botReply, handled: true };
    }
  }

  return { handled: false };
}

function openFAQQuestionContains(qNeedle = "") {
  openHelpPanel("faq");

  // Espera un beat para que el DOM del acordeón esté listo
  setTimeout(() => {
    const body = document.getElementById("faqBody");
    if (!body) return;

    const needle = normalizeLite(qNeedle);
    const items = Array.from(body.querySelectorAll("details.faq-item"));

    const hit = items.find((d) => {
      const sum = d.querySelector("summary");
      const txt = sum ? sum.textContent : "";
      return normalizeLite(txt).includes(needle);
    });

    if (hit) {
      hit.open = true;
      hit.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 80);
}

const FAQ_TITLE_BY_INTENT = {
  location: { es: "Ubicacion", en: "Location" },
  arts: { es: "Artes que ensenamos", en: "Arts we teach" },
  schedules: { es: "Horarios", en: "Schedules" },
  modalities: { es: "Modalidades", en: "Modalities" },
  coverage_home: { es: "Zonas de cobertura", en: "Coverage areas" },
  ages_programs: { es: "Edades", en: "Ages" },
  prices: { es: "Precios", en: "Pricing" },
  teachers: { es: "Docentes", en: "Teachers" },
  methodology: { es: "Metodologia", en: "Methodology" },
  payments: { es: "Metodos de pago", en: "Payment methods" },
  enrollment_dates: { es: "Fechas de inscripcion", en: "Enrollment dates" },
  trial_or_courtesy: { es: "Clase de prueba", en: "Trial" },
  other_services: { es: "Otros servicios", en: "Other services" },
  human_advisor: { es: "asesor humano", en: "human advisor" },
  work_with_us: { es: "trabajar con nosotros", en: "work with us" }
};

const KNOWLEDGE_SUGGESTION_EXCLUDED_IDS = new Set([
  "about_musicala",
  "human_advisor",
  "work_with_us"
]);

function getKBIntents() {
  return Array.isArray(kbCache?.intents) ? kbCache.intents : [];
}

function getLastBotWithOptions() {
  const history = Array.isArray(state?.history) ? state.history : [];
  return [...history].reverse().find(
    (m) => m?.from === "bot" && Array.isArray(m.options) && m.options.length
  ) || null;
}

function getFAQItemsForLang(lang = getLang()) {
  const faq = kbCache?.faq;
  if (Array.isArray(faq)) return faq;
  if (faq && Array.isArray(faq[lang])) return faq[lang];
  return [];
}

function getLocalizedKBText(value, lang = getLang()) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return String(value?.[lang] || value?.es || value?.en || "").trim();
  }
  return "";
}

function getLocalizedStringArray(value, lang = getLang()) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "object") {
    const localized = value?.[lang] ?? value?.es ?? value?.en;
    if (Array.isArray(localized)) {
      return localized.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof localized === "string") {
      const single = localized.trim();
      return single ? [single] : [];
    }
  }

  if (typeof value === "string") {
    const single = value.trim();
    return single ? [single] : [];
  }

  return [];
}

function getSeasonalWorkshopItems() {
  const items = seasonalWorkshopsCache?.workshops;
  return Array.isArray(items) ? items.filter((item) => item && typeof item === "object") : [];
}

function getActiveSeasonalWorkshops() {
  return getSeasonalWorkshopItems().filter((item) => item.active !== false);
}

function getSeasonalWorkshopGenericPatterns(lang = getLang()) {
  const configured = getLocalizedStringArray(seasonalWorkshopsCache?.genericPatterns, lang);
  if (configured.length) return configured;

  return lang === "en"
    ? ["workshop", "workshops", "seasonal workshop", "seasonal workshops", "monthly workshop"]
    : ["taller", "talleres", "taller de temporada", "talleres de temporada", "taller del mes"];
}

function getSeasonalWorkshopSuggestionLabel(workshop, lang = getLang()) {
  return (
    getLocalizedKBText(workshop?.suggestionLabel, lang) ||
    getLocalizedKBText(workshop?.shortName, lang) ||
    getLocalizedKBText(workshop?.name, lang)
  );
}

function getSeasonalWorkshopPatterns(workshop, lang = getLang()) {
  const raw = [
    ...getLocalizedStringArray(workshop?.patterns, lang),
    getLocalizedKBText(workshop?.name, lang),
    getLocalizedKBText(workshop?.shortName, lang),
    getSeasonalWorkshopSuggestionLabel(workshop, lang)
  ].filter(Boolean);

  return raw.filter(
    (item, idx, arr) =>
      arr.findIndex((candidate) => normalizeLite(candidate) === normalizeLite(item)) === idx
  );
}

function buildSeasonalWorkshopFacts(workshop, lang = getLang()) {
  const lines = [];
  const date = getLocalizedKBText(workshop?.date, lang);
  const time = getLocalizedKBText(workshop?.time, lang);
  const price = getLocalizedKBText(workshop?.price, lang);
  const location = getLocalizedKBText(workshop?.location, lang);

  if (date) lines.push(lang === "en" ? `Date: *${date}*` : `Fecha: *${date}*`);
  if (time) lines.push(lang === "en" ? `Time: *${time}*` : `Horario: *${time}*`);
  if (price) lines.push(lang === "en" ? `Price: *${price}*` : `Valor: *${price}*`);
  if (location) lines.push(lang === "en" ? `Location: *${location}*` : `Lugar: *${location}*`);

  getLocalizedStringArray(workshop?.highlights, lang).forEach((item) => {
    lines.push(`- ${item}`);
  });

  getLocalizedStringArray(workshop?.links, lang).forEach((item) => {
    lines.push(`- ${item}`);
  });

  return lines;
}

function buildSeasonalWorkshopResponse(workshop, lang = getLang()) {
  const custom = getLocalizedKBText(workshop?.response, lang);
  if (custom) return custom;

  const label = getSeasonalWorkshopSuggestionLabel(workshop, lang);
  if (!label) return "";

  const intro =
    lang === "en"
      ? `Yes. Right now we have *${label}* available.`
      : `Si. En este momento tenemos disponible *${label}*.`;

  return [intro, ...buildSeasonalWorkshopFacts(workshop, lang)]
    .filter(Boolean)
    .join("\n");
}

function buildSeasonalWorkshopsListResponse(workshops = [], lang = getLang()) {
  const active = Array.isArray(workshops) ? workshops.filter(Boolean) : [];
  if (!active.length) return "";

  const intro =
    lang === "en"
      ? "Yes. These are the seasonal workshops we currently have active:"
      : "Si. En este momento estos son los talleres de temporada que tenemos activos:";

  const lines = active.map((workshop, index) => {
    const label = getSeasonalWorkshopSuggestionLabel(workshop, lang) || `Workshop ${index + 1}`;
    const date = getLocalizedKBText(workshop?.date, lang);
    const time = getLocalizedKBText(workshop?.time, lang);
    const extra = [date, time].filter(Boolean).join(" | ");
    return extra ? `${index + 1}. *${label}* - ${extra}` : `${index + 1}. *${label}*`;
  });

  const outro =
    lang === "en"
      ? "Tell me the workshop name and I will share the details, or you can go straight to WhatsApp to reserve."
      : "Dime el nombre del taller y te comparto los detalles, o si prefieres puedes ir directo a WhatsApp para reservar.";

  return [intro, ...lines, outro].filter(Boolean).join("\n");
}

function buildSeasonalWorkshopFAQItems(lang = getLang()) {
  const active = getActiveSeasonalWorkshops();
  if (!active.length) return [];

  if (active.length === 1) {
    const workshop = active[0];
    const label = getSeasonalWorkshopSuggestionLabel(workshop, lang);
    const title =
      getLocalizedKBText(workshop?.faqTitle, lang) ||
      (lang === "en" ? `Seasonal workshop: ${label}` : `Taller de temporada: ${label}`);
    const answer = [
      buildSeasonalWorkshopResponse(workshop, lang),
      getLocalizedKBText(workshop?.advisorPrompt, lang)
    ]
      .filter(Boolean)
      .join("\n\n");

    return [{ q: title, a: answer }];
  }

  return [
    {
      q: lang === "en" ? "Seasonal workshops" : "Talleres de temporada",
      a: buildSeasonalWorkshopsListResponse(active, lang)
    }
  ];
}

function makeSeasonalWorkshopHit(workshop, lang = getLang(), score = 0) {
  const label = getSeasonalWorkshopSuggestionLabel(workshop, lang);

  return {
    id: `seasonal_workshop_${String(workshop?.id || label || "active").trim()}`,
    category: "seasonal_workshop",
    score,
    response: buildSeasonalWorkshopResponse(workshop, lang),
    advisorPrompt: getLocalizedKBText(workshop?.advisorPrompt, lang),
    suggestionLabel: label,
    faqTitle: getLocalizedKBText(workshop?.faqTitle, lang),
    serviceName: workshop?.serviceName,
    workshopName: workshop?.name
  };
}

function makeSeasonalWorkshopListHit(workshops = [], lang = getLang(), score = 0) {
  const first = Array.isArray(workshops) ? workshops[0] : null;

  return {
    id: "seasonal_workshops_active",
    category: "seasonal_workshop",
    score,
    response: buildSeasonalWorkshopsListResponse(workshops, lang),
    advisorPrompt:
      lang === "en"
        ? "If you want to reserve or confirm spots, an advisor can help you on WhatsApp."
        : "Si quieres reservar o confirmar cupos, un asesor puede ayudarte por WhatsApp.",
    suggestionLabel: lang === "en" ? "Seasonal workshops" : "Talleres de temporada",
    faqTitle: lang === "en" ? "Seasonal workshops" : "Talleres de temporada",
    serviceName: first?.serviceName || { es: "talleres de temporada", en: "seasonal workshops" }
  };
}

function findInlineSeasonalWorkshopIntent(text = "") {
  if (shouldBypassKnowledgeInterrupt(text)) return null;

  const lang = getLang();
  const active = getActiveSeasonalWorkshops();
  if (!active.length) return null;

  let best = null;

  active.forEach((workshop) => {
    const patterns = getSeasonalWorkshopPatterns(workshop, lang);
    patterns.forEach((pattern) => {
      const score = Math.max(
        scoreIntentPattern(text, pattern),
        scoreIntentPatternLoose(text, pattern)
      );
      if (!score) return;

      const boosted = score + (workshop?.featured ? 20 : 0);
      if (!best || boosted > best.score) {
        best = { workshop, score: boosted };
      }
    });
  });

  if (best && best.score >= 160) {
    return makeSeasonalWorkshopHit(best.workshop, lang, best.score);
  }

  const genericScore = getSeasonalWorkshopGenericPatterns(lang).reduce((max, pattern) => {
    return Math.max(max, scoreIntentPattern(text, pattern), scoreIntentPatternLoose(text, pattern));
  }, 0);

  if (genericScore >= 160) {
    if (active.length === 1) return makeSeasonalWorkshopHit(active[0], lang, genericScore);
    return makeSeasonalWorkshopListHit(active, lang, genericScore);
  }

  return null;
}

function findNearbySeasonalWorkshopTopics(text = "", limit = 2) {
  if (shouldBypassKnowledgeInterrupt(text)) return [];

  const lang = getLang();

  return getActiveSeasonalWorkshops()
    .map((workshop) => {
      const score = getSeasonalWorkshopPatterns(workshop, lang).reduce((max, pattern) => {
        return Math.max(max, scoreIntentPatternLoose(text, pattern));
      }, 0);

      return {
        label: getSeasonalWorkshopSuggestionLabel(workshop, lang),
        score
      };
    })
    .filter((item) => item.score > 0 && item.label)
    .sort((a, b) => b.score - a.score)
    .filter(
      (item, idx, arr) =>
        arr.findIndex((candidate) => normalizeLite(candidate.label) === normalizeLite(item.label)) === idx
    )
    .slice(0, limit);
}

function applyInlineKnowledgeLeadHint(hit) {
  if (!hit || !state) return;

  state.memory = state.memory || {};
  state.memory.lead = state.memory.lead || {};

  if (String(hit?.id || "") === "prices" && !normalizeServicioValue(state.memory.lead.servicio)) {
    state.memory.lead.servicio = getLang() === "en" ? "pricing inquiry" : "consulta de precios";
    state.memory.servicio = state.memory.servicio || state.memory.lead.servicio;
    return;
  }

  if (String(hit?.category || "") !== "seasonal_workshop") return;

  const lang = getLang();
  const serviceName =
    getLocalizedKBText(hit?.serviceName, lang) ||
    (lang === "en" ? "seasonal workshops" : "talleres de temporada");
  const workshopName = getLocalizedKBText(hit?.workshopName, lang);

  if (serviceName && !normalizeServicioValue(state.memory.lead.servicio)) {
    state.memory.lead.servicio = serviceName;
  }
  if (serviceName && !normalizeServicioValue(state.memory.servicio)) {
    state.memory.servicio = serviceName;
  }
  if (workshopName && !String(state.memory.workshop_name || "").trim()) {
    state.memory.workshop_name = workshopName;
  }
  if (workshopName && !String(state.memory.lead.workshopName || "").trim()) {
    state.memory.lead.workshopName = workshopName;
  }
}

function getFAQTitleForIntent(intentOrId, lang = getLang()) {
  const intentId =
    typeof intentOrId === "object"
      ? String(intentOrId?.id || "").trim()
      : String(intentOrId || "").trim();

  if (typeof intentOrId === "object") {
    const directTitle = getLocalizedKBText(intentOrId?.faqTitle, lang);
    if (directTitle) return directTitle;
  }

  const mapped = FAQ_TITLE_BY_INTENT[intentId]?.[lang];
  if (mapped) return mapped;

  const items = getFAQItemsForLang(lang);
  const fallback = items.find((item) =>
    normalizeLite(item?.id || item?.q || "").includes(normalizeLite(intentId))
  );

  return String(fallback?.q || "").trim();
}

function isCurrentFlowOptionText(text = "") {
  const clean = normalizeLite(text);
  if (!clean) return false;

  const lastBotWithOptions = getLastBotWithOptions();
  const options = Array.isArray(lastBotWithOptions?.options) ? lastBotWithOptions.options : [];

  return options.some((opt) => {
    const rawValues =
      typeof opt === "string"
        ? [opt]
        : [opt?.label, opt?.value, opt?.text];

    return rawValues.some((value) => normalizeLite(value || "") === clean);
  });
}

function shouldBypassKnowledgeInterrupt(text = "") {
  const clean = normalizeLite(text);
  if (!clean) return true;
  if (
    /^\d{1,2}$/.test(clean) &&
    !String(state?.memory?.capture?.stage || "").trim() &&
    getLastBotWithOptions()
  ) return true;

  if (clean === "menu" || clean === "menú" || clean === "home" || clean === "inicio") return true;
  if (clean === "reset" || clean === "reiniciar") return true;
  if (clean === "faq") return true;
  if (clean.includes("whatsapp") || clean.includes("whats app") || clean.includes("wa.me")) return true;
  if (isCurrentFlowOptionText(clean)) return true;

  return false;
}

function scoreIntentPattern(inputText = "", pattern = "") {
  const input = normalizeLite(inputText);
  const needle = normalizeLite(pattern);

  if (!input || !needle || needle.length < 3) return 0;
  if (input === needle) return 1000 + needle.length;

  const paddedInput = ` ${input} `;
  const paddedNeedle = ` ${needle} `;
  if (paddedInput.includes(paddedNeedle)) return 900 + needle.length;
  if (input.includes(needle)) return 800 + needle.length;

  if (input.length >= 5 && needle.includes(input)) return 250 + input.length;

  return 0;
}

function tokenizeLite(text = "") {
  return normalizeLite(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scoreIntentPatternLoose(inputText = "", pattern = "") {
  const direct = scoreIntentPattern(inputText, pattern);
  if (direct) return direct;

  const inputTokens = tokenizeLite(inputText);
  const patternTokens = tokenizeLite(pattern);
  if (!inputTokens.length || !patternTokens.length) return 0;

  const shared = patternTokens.filter((token) => inputTokens.includes(token));
  if (!shared.length) return 0;

  const ratio = shared.length / patternTokens.length;
  const coverage = shared.length / inputTokens.length;
  if (shared.length < 2 && ratio < 0.6 && coverage < 0.6) return 0;

  return Math.round(140 + (shared.length * 18) + (ratio * 40) + (coverage * 30));
}

function getKnowledgeCategory(intent) {
  return String(intent?.category || "faq").trim().toLowerCase() || "faq";
}

function getIntentScoreBoost(intent) {
  const n = Number(intent?.scoreBoost || 0);
  return Number.isFinite(n) ? n : 0;
}

function getIntentSuggestionLabel(intent, lang = getLang()) {
  const explicit = getLocalizedKBText(intent?.suggestionLabel, lang);
  if (explicit) return explicit;

  const faqTitle = getFAQTitleForIntent(intent, lang);
  if (faqTitle) return faqTitle;

  const patterns = Array.isArray(intent?.patterns?.[lang]) ? intent.patterns[lang] : [];
  return String(patterns[0] || intent?.id || "").trim();
}

function isPriceQuestionText(text = "") {
  const clean = normalizeLite(text);
  if (!clean) return false;

  const priceSignals = [
    "cuanto cuesta",
    "cuanto vale",
    "precio",
    "precios",
    "valor",
    "tarifa",
    "costo",
    "costos",
    "how much",
    "price",
    "cost",
    "pricing"
  ];

  return priceSignals.some((signal) => clean.includes(signal));
}

function makePriceQuestionHit(text = "") {
  if (!kbCache?.intents || shouldBypassKnowledgeInterrupt(text) || !isPriceQuestionText(text)) return null;

  const lang = getLang();
  const intent = getKBIntents().find((item) => String(item?.id || "") === "prices");
  const response = getLocalizedKBText(intent?.response, lang);
  if (!intent || !response) return null;

  return {
    intent,
    id: "prices",
    response,
    score: 2000,
    category: getKnowledgeCategory(intent),
    faqTitle: getFAQTitleForIntent(intent, lang),
    advisorPrompt: getLocalizedKBText(intent?.advisorPrompt, lang),
    suggestionLabel: getIntentSuggestionLabel(intent, lang)
  };
}

function findInlineKnowledgeIntent(text = "") {
  if (!kbCache?.intents || shouldBypassKnowledgeInterrupt(text)) return null;

  const lang = getLang();
  const intents = getKBIntents();
  let best = null;

  intents.forEach((intent) => {
    const patterns = Array.isArray(intent?.patterns?.[lang]) ? intent.patterns[lang] : [];
    const response = getLocalizedKBText(intent?.response, lang);
    if (!patterns.length || !response) return;

    patterns.forEach((pattern) => {
      const baseScore = scoreIntentPattern(text, pattern);
      if (!baseScore) return;

      const score = baseScore + getIntentScoreBoost(intent);

      if (!best || score > best.score) {
        best = {
          intent,
          id: String(intent?.id || "").trim(),
          response,
          score
        };
      }
    });
  });

  if (!best) return null;

  return {
    ...best,
    category: getKnowledgeCategory(best.intent),
    faqTitle: getFAQTitleForIntent(best.intent, lang),
    advisorPrompt: getLocalizedKBText(best.intent?.advisorPrompt, lang),
    suggestionLabel: getIntentSuggestionLabel(best.intent, lang)
  };
}

function findNearbyKnowledgeTopics(text = "", limit = 3) {
  if (!kbCache?.intents || shouldBypassKnowledgeInterrupt(text)) return [];

  const lang = getLang();
  const ranked = [];

  getKBIntents().forEach((intent) => {
    const intentId = String(intent?.id || "").trim();
    if (!intentId || KNOWLEDGE_SUGGESTION_EXCLUDED_IDS.has(intentId)) return;

    const patterns = Array.isArray(intent?.patterns?.[lang]) ? intent.patterns[lang] : [];
    if (!patterns.length) return;

    const rawScore = patterns.reduce((max, pattern) => {
      return Math.max(max, scoreIntentPatternLoose(text, pattern));
    }, 0);

    if (!rawScore) return;

    const bestScore = rawScore + getIntentScoreBoost(intent);

    ranked.push({
      id: intentId,
      label: getIntentSuggestionLabel(intent, lang),
      score: bestScore,
      category: getKnowledgeCategory(intent)
    });
  });

  return ranked
    .sort((a, b) => b.score - a.score)
    .filter((item, idx, arr) =>
      Boolean(item.label) &&
      arr.findIndex((candidate) => normalizeLite(candidate.label) === normalizeLite(item.label)) === idx
    )
    .slice(0, limit);
}

function getSmartFallbackConfig(lang = getLang()) {
  const cfg = kbCache?.smartFallback;
  if (cfg && typeof cfg === "object" && cfg[lang] && typeof cfg[lang] === "object") {
    return cfg[lang];
  }
  return {};
}

function joinHumanList(items = [], lang = getLang()) {
  const list = items.filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return lang === "en" ? `${list[0]} and ${list[1]}` : `${list[0]} y ${list[1]}`;

  const last = list[list.length - 1];
  const rest = list.slice(0, -1);
  return lang === "en"
    ? `${rest.join(", ")} and ${last}`
    : `${rest.join(", ")} y ${last}`;
}

function getResumePromptAfterInterrupt() {
  const lang = getLang();
  const captureStage = String(state?.memory?.capture?.stage || "").toLowerCase();

  if (captureStage === "phone") {
    return lang === "en"
      ? "When you're ready, we can continue with your phone number."
      : "Cuando quieras, seguimos con tu número de celular.";
  }

  const lastBotWithOptions = getLastBotWithOptions();

  if (lastBotWithOptions) {
    return lang === "en"
      ? "We can keep going right where we left off. You can choose one of the options below or ask me something else."
      : "Podemos seguir justo donde vamos. Puedes elegir una de las opciones de abajo o hacerme otra pregunta.";
  }

  return lang === "en"
    ? "When you're ready, we can continue from the same point."
    : "Cuando quieras, seguimos desde el mismo punto.";
}

function isWaitingForLeadName() {
  const nodeId = String(state?.currentNodeId || state?.awaitingNodeId || "").trim();
  const stage = String(state?.memory?.capture?.stage || "").trim().toLowerCase();
  return nodeId === "ask_name" || stage === "name";
}

function skipLeadNameAfterInterrupt() {
  if (!state || !isWaitingForLeadName()) return null;

  state.memory = state.memory || {};
  state.memory.lead = state.memory.lead || {};
  state.memory.lead.nameSkipped = true;
  state.memory.capture = state.memory.capture || {};
  state.memory.capture.stage = null;
  state.awaitingNodeId = null;

  try {
    return runNode("ask_phone", state);
  } catch {
    return null;
  }
}

function buildInlineKnowledgeReply(hit) {
  const body = [
    String(hit?.response || "").trim(),
    String(hit?.advisorPrompt || "").trim(),
    getResumePromptAfterInterrupt()
  ]
    .filter(Boolean)
    .join("\n\n");

  const msg = makeBotMessage(body);
  msg._flow = {
    allowFreeText: true,
    inlineFAQ: hit?.category === "faq",
    inlineKnowledge: true,
    faqIntentId: hit?.id || "",
    knowledgeIntentId: hit?.id || "",
    knowledgeCategory: hit?.category || ""
  };
  return msg;
}

function handleInlineKnowledgeInterrupt(text = "") {
  const hit = makePriceQuestionHit(text) || findInlineSeasonalWorkshopIntent(text) || findInlineKnowledgeIntent(text);
  if (!hit) return null;

  applyInlineKnowledgeLeadHint(hit);

  return {
    hit,
    botReply: buildInlineKnowledgeReply(hit)
  };
}

function isGenericFlowFallbackReply(botReply) {
  if (!botReply) return false;
  if (botReply?._flow?.buttonsOnly) return true;

  const clean = normalizeLite(botReply?.text || "");
  if (!clean) return false;

  return (
    clean.includes("no te entendi") ||
    clean.includes("no te entendi del todo") ||
    clean.includes("didnt fully get") ||
    clean.includes("didn't fully get") ||
    clean.includes("use the buttons") ||
    clean.includes("elige una opcion")
  );
}

function buildKnowledgeFallbackReply(userText = "", seedReply = null) {
  const lang = getLang();
  const cfg = getSmartFallbackConfig(lang);
  const nearby = findNearbyKnowledgeTopics(userText, 3).map((item) => item.label).filter(Boolean);
  const nearbyWorkshops = findNearbySeasonalWorkshopTopics(userText, 2).map((item) => item.label).filter(Boolean);
  const defaults = Array.isArray(cfg?.defaultSuggestions)
    ? cfg.defaultSuggestions.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const suggestions = [...nearbyWorkshops, ...nearby, ...defaults]
    .filter(Boolean)
    .filter((item, idx, arr) => arr.findIndex((candidate) => normalizeLite(candidate) === normalizeLite(item)) === idx)
    .slice(0, 4);

  const intro =
    getLocalizedKBText(cfg?.message, lang) ||
    (lang === "en"
      ? "I didn't fully place it, but I can still help you with Musicala programs, modalities, extra services and basic guidance."
      : "No lo ubiqué del todo, pero igual puedo ayudarte con programas, modalidades, servicios adicionales y orientación básica.");

  const suggestionLine = suggestions.length
    ? (lang === "en"
        ? `Maybe it is closer to: ${joinHumanList(suggestions, lang)}.`
        : `De pronto va más por: ${joinHumanList(suggestions, lang)}.`)
    : "";

  const continueLine = seedReply?.options?.length
    ? (lang === "en"
        ? "Meanwhile, you can also continue with one of the options below."
        : "Mientras tanto, también puedes seguir con una de las opciones de abajo.")
    : (lang === "en"
        ? "If you tell me who it is for, the art area or the modality, I can guide you better."
        : "Si me dices para quién es, el área artística o la modalidad, puedo orientarte mejor.");

  const advisorLine =
    getLocalizedKBText(cfg?.advisorHint, lang) ||
    (lang === "en"
      ? "If you prefer, you can also speak with an advisor on WhatsApp."
      : "Si prefieres, también puedes hablar con un asesor por WhatsApp.");

  const text = [intro, suggestionLine, continueLine, advisorLine]
    .filter(Boolean)
    .join("\n\n");

  const msg = seedReply ? { ...seedReply, text } : makeBotMessage(text);
  msg._flow = {
    ...(seedReply?._flow || {}),
    smartFallback: true
  };
  return msg;
}

function enhanceBotReplyWithKnowledgeFallback(userText = "", botReply = null) {
  if (!botReply || !kbCache || !isGenericFlowFallbackReply(botReply)) return botReply;
  return buildKnowledgeFallbackReply(userText, botReply);
}

function applyUIHintsAfterBotReply() {
  const nodeId = String(state?.progress?.lastNodeId || "");
  if (!nodeId) return;

  // Caso específico: si el usuario eligió HOGAR en vacacionales,
  // abrimos automáticamente la FAQ de "Zonas de cobertura (Hogar)".
  if (nodeId === "flow_intensivos_hogar") {
    openFAQQuestionContains(getLang() === "en" ? "Coverage areas" : "Zonas de cobertura");
  }
}


/* =========================
   STATE SHAPE (defensivo)
========================= */

function normalizeStateShape(s) {
  s = s || {};
  s.memory = s.memory || {};
  s.memory.ui = s.memory.ui || { stage: null, lang: null };

  s.memory.lead = s.memory.lead || {
    name: "",
    phone: "",
    edad: "",
    arte: "",
    modalidad: "",
    servicio: ""
  };

  s.memory.leadFirst = s.memory.leadFirst || {
    firstInquiryText: "",
    firstService: "",
    firstAge: "",
    firstArt: "",
    firstModality: "",
    firstNodeId: "",
    firstNodeName: "",
    firstSource: ""
  };

  s.memory.capture = s.memory.capture || { stage: null };
  s.memory.flags = s.memory.flags || { flowStarted: false, hydrated: false };

  if (s.memory.arte == null) s.memory.arte = s.memory.arte || "";
  if (s.memory.modalidad == null) s.memory.modalidad = s.memory.modalidad || "";
  if (s.memory.servicio == null) s.memory.servicio = s.memory.servicio || "";

  s.currentNodeId = s.currentNodeId || null;
  s.awaitingNodeId = s.awaitingNodeId || null;
  s.lastUserText = s.lastUserText || "";

  s.history = Array.isArray(s.history) ? s.history : [];
  s.lastOptions = Array.isArray(s.lastOptions) ? s.lastOptions : [];

  // persist UI lang on load
  const persistedLang = normalizeLang(s.memory?.ui?.lang);
  if (persistedLang) uiLang = persistedLang;

  return s;
}

/* =========================
   FLOW CONTROL (puro)
========================= */

function updateComposerModeFromFlow() {
  try { syncComposerMode(state); } catch {}

  try {
    const history = state?.history || [];
    const lastBot = [...history].reverse().find((m) => m?.from === "bot");
    const allow = lastBot?._flow?.allowFreeText;

    if (allow === true) {
      setComposerMode("text");
      focusInput();
      return;
    }

    setComposerMode("chips");
  } catch {
    setComposerMode("chips");
  }
}

function startFlowIfNeeded() {
  state.memory = state.memory || {};
  state.memory.flags = state.memory.flags || {};

  if (state.memory.flags.flowStarted) {
    renderChips(state);
    updateComposerModeFromFlow();
    saveState(state);
    return;
  }

  const preferredStartNodeId = getPreferredFlowStartNodeId();
  const firstMsg = preferredStartNodeId
    ? runNode(preferredStartNodeId, state)
    : startFlow(state);

  state.memory.flags.flowStarted = true;

  if (firstMsg) {
    state.history.push(firstMsg);
    appendMessage(firstMsg);
    logBotView(firstMsg);
  }

  renderChips(state);
  updateComposerModeFromFlow();

  scheduleLeadSync();
  saveState(state);
}

/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    bindLangUI();

    // Skin de temporada (colores/detalles según la época del año)
    const activeSkin = applySeasonSkin();

    // Tracking: inicio de sesión (qué dispositivo, de dónde llega, etc.)
    logAction("session_start", {
      skin: activeSkin,
      url: (location?.href || "").slice(0, 500),
      referrer: (document?.referrer || "").slice(0, 500),
      user_agent: (navigator?.userAgent || "").slice(0, 300),
      screen: (typeof screen !== "undefined") ? `${screen.width}x${screen.height}` : null
    });

    // Estado
    state = normalizeStateShape(loadState() || getInitialState());

    // Idioma visual por defecto (o persistido)
    applyUILang(uiLang || "es");

    // Escuchar idioma elegido desde INTRO
    window.addEventListener("musibot:lang", (e) => {
      const lang = e?.detail?.lang;
      if (lang === "es" || lang === "en") {
        applyUILang(lang);
        logAction("lang_change", { lang, source: "intro" });
      }
    });

    // Render inicial (para que no se vea vacío mientras carga flow)
    renderAll(state);

    // Flow
    await loadFlow();

    // WhatsApp TOP: siempre activo
    setupWhatsAppTopBtn();

    // Intro
    initIntro(startApp, {
      showOnce: false,
      addSkipButton: true
    });

  } catch (err) {
    console.error("Error al iniciar MusiBot:", err);
    alert("Ocurrió un error al iniciar MusiBot 😅 Revisa consola.");
  }
});

function startApp() {
  renderAll(state);

  bindForm(onUserSubmit);
  bindReset(onReset);
  bindChips(onChipClick);

  loadFAQ(); // async

  startFlowIfNeeded();

  renderChips(state);
  updateComposerModeFromFlow();

  scheduleLeadSync();
  saveState(state);

  // Registrar cuándo el usuario abandona la página (cierra tab, cambia de pestaña, etc.)
  // OJO: en móvil, abrir WhatsApp u otra app también dispara "hidden".
  // Por eso registramos también "page_return": si hay un page_return después
  // del page_leave, la persona NO abandonó — solo se distrajo o fue a WhatsApp.
  document.addEventListener("visibilitychange", () => {
    if (!state) return;
    try {
      const { nombre, cel, servicio } = readLeadFieldsFromState();
      const payload = {
        last_node:   state?.progress?.lastNodeId  || null,
        last_node_n: state?.progress?.lastNodeName || null,
        has_name:    Boolean(nombre),
        has_phone:   Boolean(cel),
        has_service: Boolean(servicio),
      };
      if (document.visibilityState === "hidden") {
        logAction("page_leave", payload);
      } else if (document.visibilityState === "visible") {
        logAction("page_return", payload);
      }
    } catch {}
  });
}

/* =========================
   HANDLERS
========================= */

function onUserSubmit(text) {
  const value = String(text || "").trim();
  if (!value) return;

  // Nodo que el usuario está respondiendo (el último que vio antes de escribir).
  const answeredNode = {
    nodeId: String(state?.progress?.lastNodeId || state?.awaitingNodeId || state?.currentNodeId || "").trim() || null,
    nodeName: String(state?.progress?.lastNodeName || "").trim() || null,
  };

  const userMsg = makeUserMessage(value);
  state.history.push(userMsg);
  appendMessage(userMsg);
  rememberUserQuestion(value);

  const conversationalTurn = handleConversationalStateBeforeFlow(value);
  if (conversationalTurn?.botReply) {
    state.history.push(conversationalTurn.botReply);
    appendMessage(conversationalTurn.botReply);
    rememberConversationContextFromBot(conversationalTurn.botReply);
    logTurnEvent("user_message", value, conversationalTurn.botReply, answeredNode);
    logBotView(conversationalTurn.botReply);

    renderChips(state);
    updateComposerModeFromFlow();

    scheduleLeadSync();
    saveState(state);
    return;
  }

  const knowledgeInterrupt = handleInlineKnowledgeInterrupt(value);
  if (knowledgeInterrupt?.botReply) {
    state.history.push(knowledgeInterrupt.botReply);
    appendMessage(knowledgeInterrupt.botReply);
    rememberConversationContextFromBot(knowledgeInterrupt.botReply);

    try {
      logEvent("user_message", {
        text: String(value || "").slice(0, 500),
        node_id: answeredNode.nodeId,
        node_name: answeredNode.nodeName,
        answered_by: "knowledge",
        category: knowledgeInterrupt.hit?.category || null,
        lang: (typeof getLang === "function" ? getLang() : "es")
      });
    } catch {}

    logBotView(knowledgeInterrupt.botReply);
    freezeFirstLeadSnapshot({ userText: value });

    const nextLeadStep = skipLeadNameAfterInterrupt();
    if (nextLeadStep) {
      state.history.push(nextLeadStep);
      appendMessage(nextLeadStep);
      rememberConversationContextFromBot(nextLeadStep);
      logBotView(nextLeadStep);
    }

    if (knowledgeInterrupt.hit?.category === "faq" && knowledgeInterrupt.hit?.faqTitle) {
      openFAQQuestionContains(knowledgeInterrupt.hit.faqTitle);
    }

    renderChips(state);
    updateComposerModeFromFlow();

    scheduleLeadSync();
    saveState(state);
    return;
  }

  const botReply = enhanceBotReplyWithKnowledgeFallback(
    value,
    handleUserInput(value, state)
  );
  logTurnEvent("user_message", value, botReply, answeredNode);
  if (botReply) {
    state.history.push(botReply);
    appendMessage(botReply);
    rememberConversationContextFromBot(botReply);
    applyUIHintsAfterBotReply();
    freezeFirstLeadSnapshot({ userText: value });

    // Acción global (defensivo)
    const action = botReply?._flow?.action;
    if (action === "WHATSAPP") openWhatsAppFinal(); // 👈 SOLO cuando el flow lo pida (normalmente en cierre)
    if (action === "FAQ") openHelpPanel("faq");
    if (action === "MENU") openHelpPanel();

    logBotView(botReply);
  }

  renderChips(state);
  updateComposerModeFromFlow();

  scheduleLeadSync();
  saveState(state);
}

/* =========================
   TRACKING DE EVENTOS (Firestore)
========================= */

// Registra LO QUE EL USUARIO VE: cada mensaje/nodo que el bot le muestra.
function logBotView(msg) {
  try {
    if (!msg) return;
    const flow = msg._flow || {};
    const options = Array.isArray(msg.options)
      ? msg.options.map((o) => o?.label).filter(Boolean).slice(0, 20)
      : [];
    logEvent("bot_view", {
      node_id: flow.nodeId || null,
      node_name: flow.nodeName || null,
      text: String(msg.text || "").slice(0, 500),
      options_shown: options,
      has_media: Boolean(msg.media && msg.media.length),
      media: Array.isArray(msg.media)
        ? msg.media.map((m) => m?.url || m?.type).filter(Boolean).slice(0, 6)
        : [],
      lang: (typeof getLang === "function" ? getLang() : "es")
    });
  } catch {}
}

// Registra acciones varias (abrir panel, whatsapp, reset, idioma, inicio...).
function logAction(type, data = {}) {
  try {
    logEvent(type, {
      ...data,
      lang: (typeof getLang === "function" ? getLang() : "es")
    });
  } catch {}
}

function logTurnEvent(type, text, botReply, answeredNode = null) {
  try {
    const flow = botReply?._flow || {};
    logEvent(type, {
      text: String(text || "").slice(0, 500),
      // Nodo que el usuario estaba respondiendo (no el de la respuesta del bot)
      node_id: answeredNode?.nodeId || flow.nodeId || null,
      node_name: answeredNode?.nodeName || flow.nodeName || null,
      // Nodo al que llevó este mensaje (la respuesta del bot)
      reply_node_id: flow.nodeId || null,
      reply_node_name: flow.nodeName || null,
      lang: (typeof getLang === "function" ? getLang() : "es")
    });

    // ¿El bot NO entendió? -> guardamos como knowledge_gap para mejorar el kb.
    const fallbackId = CONFIG?.FLOW_SPECIAL?.FALLBACK_NODE_ID || "menu_fallback";
    const landedOnFallback = flow.nodeId && flow.nodeId === fallbackId;
    if (type === "user_message" && landedOnFallback) {
      // Ignorar textos sin sentido: 1 caracter, solo números (p.ej. "1", "2"),
      // o comandos de navegación que el motor no pudo rutear.
      const cleanGapText = normalizeLite(text || "");
      const isMeaningless = cleanGapText.length < 3 || /^\d+$/.test(cleanGapText.trim());

      if (!isMeaningless) {
        const { nombre, arte, servicio, modalidad } = readLeadFieldsFromState();
        logKnowledgeGap({
          text,
          lang: (typeof getLang === "function" ? getLang() : "es"),
          nodeId: flow.nodeId,
          nodeName: flow.nodeName,
          // Contexto: qué decía el bot justo antes y qué datos había dado el lead
          lastBotText: String(botReply?.text || "").slice(0, 500),
          nombre, arte, servicio, modalidad,
        });
      }
    }
  } catch (e) {
    // nunca rompemos la UX por tracking
  }
}

function onChipClick(value, kind, label) {
  if (!value) return;

  // Tracking: cada clic de chip (qué oprime el cliente),
  // con el nodo que estaba viendo al oprimirlo.
  try {
    logEvent("chip_click", {
      value: String(value).slice(0, 200),
      label: String(label || "").slice(0, 200),
      kind: kind || "option",
      node_id: String(state?.progress?.lastNodeId || "").trim() || null,
      node_name: String(state?.progress?.lastNodeName || "").trim() || null,
      lang: (typeof getLang === "function" ? getLang() : "es")
    });
  } catch {}

  // Chips UI: idioma
  if (kind === "ui:lang") {
    if (value === "es" || value === "en") applyUILang(value);
    return;
  }

  // Acciones UI (si existen)
  if (kind === "global:FAQ") { openHelpPanel("faq"); return; }
  if (kind === "global:MENU") { openHelpPanel(); return; }

  // OJO: el chip WHATSAPP de abajo SOLO aparece al final (lo filtra ui.js).
  // Aquí solo ejecutamos la acción.
  if (kind === "global:WHATSAPP") { openWhatsAppFinal(); return; }
  if (kind === "global:USD_APPROX") {
    const visibleValue = String(label || value);
    const userMsg = makeUserMessage(visibleValue);
    state.history.push(userMsg);
    appendMessage(userMsg);
    rememberUserQuestion(visibleValue);

    let botReply = handleUserInput(value, state);
    if (
      !botReply ||
      /no logr[eÃ©] identificar|couldn.t identify|todav[iÃ­]a no pude calcular|couldn.t calculate/i.test(String(botReply?.text || ""))
    ) {
      botReply = buildUsdApproxFallbackReply();
    }
    if (botReply) {
      state.history.push(botReply);
      appendMessage(botReply);
      rememberConversationContextFromBot(botReply);
      applyUIHintsAfterBotReply();
      logBotView(botReply);
    }

    renderChips(state);
    updateComposerModeFromFlow();
    scheduleLeadSync();
    saveState(state);
    return;
  }

  // Chip como input de conversación
  const visibleValue = String(label || value);
  const userMsg = makeUserMessage(visibleValue);
  state.history.push(userMsg);
  appendMessage(userMsg);
  rememberUserQuestion(visibleValue);

  const botReply = handleUserInput(value, state);
  if (botReply) {
    state.history.push(botReply);
    appendMessage(botReply);
    rememberConversationContextFromBot(botReply);
    applyUIHintsAfterBotReply();
    freezeFirstLeadSnapshot({ userText: visibleValue });

    const action = botReply?._flow?.action;
    if (action === "WHATSAPP") openWhatsAppFinal();
    if (action === "FAQ") openHelpPanel("faq");
    if (action === "MENU") openHelpPanel();

    logBotView(botReply);
  }

  renderChips(state);
  updateComposerModeFromFlow();

  scheduleLeadSync();
  saveState(state);
}

function onReset() {
  logAction("reset", {});
  state = normalizeStateShape(resetConversationKeepMemory(state));
  state.memory.ui = state.memory.ui || {};
  state.memory.ui.lang = getLang();

  clearLeadExplorationMemory();
  state.memory.capture = state.memory.capture || {};
  state.memory.capture.stage = null;
  state.memory.flags.flowStarted = false;
  state.currentNodeId = null;
  state.awaitingNodeId = null;
  state.lastUserText = "";
  state.progress = null;

  renderAll(state);

  startFlowIfNeeded();

  renderChips(state);
  updateComposerModeFromFlow();

  focusInput();

  saveState(state);

  // TOP sigue activo siempre
  setupWhatsAppTopBtn();
}

/* =========================
   WHATSAPP
========================= */

function normalizeWhatsAppNumber(raw) {
  return String(raw || "").replace(/[^\d]/g, "");
}

function getWhatsAppNumberOrWarn() {
  const number = normalizeWhatsAppNumber(CONFIG.WHATSAPP_NUMBER);
  if (!number || number.includes("XXXXXXXX")) return "";
  return number;
}

/**
 * TOP WA = salida libre, mensaje genérico.
 * - Preferencia: data attributes del <a id="waBtnTop"> en index.html
 * - Fallback: CONFIG.WHATSAPP_TEXT_ES/EN o i18n fallback
 */
function getTopWhatsAppText() {
  const lang = getLang();
  const el = document.getElementById("waBtnTop");

  const fromData =
    lang === "en"
      ? (el?.getAttribute("data-wa-text-en") || "")
      : (el?.getAttribute("data-wa-text-es") || "");

  const fromConfig =
    lang === "en"
      ? (CONFIG.WHATSAPP_TOP_TEXT_EN || CONFIG.WHATSAPP_TEXT_EN || "")
      : (CONFIG.WHATSAPP_TOP_TEXT_ES || CONFIG.WHATSAPP_TEXT_ES || "");

  const fallback = lang === "en" ? t("waTopFallback") : t("waTopFallback");
  return pickFirstNonEmpty(fromData, fromConfig, fallback);
}

let waTopGuardBound = false;
function setupWhatsAppTopBtn() {
  const el = document.getElementById("waBtnTop");
  if (!el) return;

  const number = getWhatsAppNumberOrWarn();
  const text = getTopWhatsAppText();

  if (!number) {
    el.href = "#";
    if (!waTopGuardBound) {
      waTopGuardBound = true;
      el.addEventListener("click", (e) => {
        if (el.getAttribute("href") === "#") {
          e.preventDefault();
          alert(t("waConfigMissing"));
        }
      });
    }
    return;
  }

  el.setAttribute("aria-disabled", "false");
  el.classList.remove("muted");

  el.href = `https://wa.me/${number}?text=${encodeURIComponent(String(text).trim())}`;

  if (!waTopLogBound) {
    waTopLogBound = true;
    el.addEventListener("click", () => {
      if (el.getAttribute("href") !== "#") {
        logAction("whatsapp_click", { source: "top_button" });
        saveSessionFields({ whatsapp_clicked: true }).catch(() => {});
      }
    });
  }
}
let waTopLogBound = false;

function getWebsiteUrl() {
  const url = String(CONFIG.WEBSITE_URL || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function setupWebsiteTopBtn() {
  const el = document.getElementById("siteBtnTop");
  if (!el) return;

  const url = getWebsiteUrl();
  if (!url) {
    el.setAttribute("href", "#");
    el.setAttribute("aria-disabled", "true");
    return;
  }

  el.setAttribute("href", url);
  el.setAttribute("aria-disabled", "false");
}

/**
 * FINAL WA (chip) = resumen mínimo sin nombre/teléfono.
 * “Hola, quiero clases de X para una persona de Y años. Modalidad: Z.”
 * - Si faltan campos, se arma igual sin sonar raro.
 */
function buildWhatsAppFinalText() {
  const lang = getLang();
  const { servicio, edad, arte, modalidad } = readLeadFieldsFromState();

  const svc = servicio ? String(servicio).trim() : "";
  const art = arte ? String(arte).trim() : "";
  const age = edad ? String(edad).trim() : "";
  const mode = modalidad ? String(modalidad).trim() : "";

  if (lang === "en") {
    const head = (CONFIG.WHATSAPP_FINAL_TEXT_EN || "").trim();
    const start = head || t("waFinalFallback"); // fallback EN
    const parts = [];

    // Preferimos "classes of {arte}" si hay arte, si no, servicio
    const what = art || svc;
    if (what && age) parts.push(`I want ${what} classes for someone aged ${age}.`);
    else if (what) parts.push(`I want ${what} classes.`);
    else if (age) parts.push(`I want classes for someone aged ${age}.`);

    if (mode) parts.push(`Mode: ${mode}.`);

    // Si no hay nada, al menos "I want info"
    const body = parts.length ? parts.join(" ") : "I’d like information about classes.";
    return `${start}\n\n${body}`.trim();
  }

  // ES
  const head = (CONFIG.WHATSAPP_FINAL_TEXT_ES || "").trim();
  const start = head || t("waFinalFallback");

  const parts = [];
  const what = art || svc;

  if (what && age) parts.push(`Quiero clases de ${what} para una persona de ${age}.`);
  else if (what) parts.push(`Quiero clases de ${what}.`);
  else if (age) parts.push(`Quiero clases para una persona de ${age}.`);

  if (mode) parts.push(`Modalidad: ${mode}.`);

  const body = parts.length ? parts.join(" ") : "Quiero información sobre clases.";
  return `${start}\n\n${body}`.trim();
}

function openWhatsAppFinal() {
  const number = getWhatsAppNumberOrWarn();
  if (!number) {
    alert(t("waConfigMissing"));
    return;
  }

  const text = buildWhatsAppFinalText();
  const href = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  logAction("whatsapp_click", { source: "flow", node_id: state?.currentNodeId || null });
  saveSessionFields({ whatsapp_clicked: true }).catch(() => {});
  window.open(href, "_blank", "noopener");
}

/* =========================
   FAQ (bilingüe)
========================= */

function renderFAQFromKB() {
  const lang = getLang();
  let items = [];
  const faq = kbCache?.faq;

  if (Array.isArray(faq)) items = faq;
  else if (faq && Array.isArray(faq[lang])) items = faq[lang];

  const workshopItems = buildSeasonalWorkshopFAQItems(lang);
  if (workshopItems.length) {
    items = [...workshopItems, ...items];
  }

  if (Array.isArray(items) && items.length) renderFAQ(items);
}

async function loadFAQ() {
  const kbUrl = String(CONFIG.KB_URL || "").trim();
  const workshopsUrl = String(CONFIG.SEASONAL_WORKSHOPS_URL || "").trim();

  const tasks = [];

  if (kbUrl) {
    tasks.push(
      fetch(kbUrl, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          kbCache = json;
        })
        .catch((err) => {
          console.warn("No se pudo cargar kb.json:", err);
        })
    );
  }

  if (workshopsUrl) {
    tasks.push(
      fetch(workshopsUrl, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          seasonalWorkshopsCache = json;
        })
        .catch((err) => {
          console.warn("No se pudo cargar talleres_temporada.json:", err);
        })
    );
  }

  if (!tasks.length) return;

  await Promise.allSettled(tasks);
  renderFAQFromKB();
}
