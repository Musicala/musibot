// main.js (v3.10.4)
// ============================
// Orquestador principal de MusiBot (modo FLOW puro)
// ✅ Conversación controlada SOLO por webflow.json
// ✅ NO lead-capture hardcodeado aquí: solo "sync" de state.memory -> Google Sheets
// ✅ Idioma elegido en INTRO (evento "musibot:lang" desde intro.js)
// ✅ UI i18n (ES/EN) solo interfaz (labels/ayuda/FAQ)
// ✅ Chips UI "ui:lang" (value: "es" | "en") desde ui.js
// ✅ Reset limpio: reinicia estado + re-arranca flow sin duplicar mensajes
// ✅ Integración con leadSync.js (upsert por sessionId)
// ✅ FIX real: LeadSync lee TODOS los lugares posibles (memory.lead.* + legacy + aliases)
// ✅ Sincroniza edad (rango) a Sheets (field: "edad")
// ✅ Sincroniza "arte" a Sheets (field: "arte")
// ✅ NUEVO: sincroniza "modalidad" a Sheets (field: "modalidad")
// ✅ ComposerMode preferente desde UI sync (msg._flow.allowFreeText + options)
// ✅ FIX definitivo: NO se habilita texto por awaitingNodeId (solo nodos que lo permiten)

import { CONFIG } from "./config.js";
import {
  getInitialState,
  loadState,
  saveState,
  makeUserMessage,
  resetState
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
  handleUserInput
} from "./flowEngine.js";
import { initIntro } from "./intro.js";

// ✅ Lead sync (Google Sheets)
import { createLeadSync } from "./leadSync.js";

// Diccionarios UI ES/EN (labels / panel ayuda / placeholders)
import I18N_ES_RAW from "./i18n/es.js";
import I18N_EN_RAW from "./i18n/en.js";

// Estado global
let state = null;

// Idioma UI (visual)
let uiLang = "es";

// Cache kb.json para FAQ bilingüe
let kbCache = null;

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
  const url = (CONFIG.SHEETS_API_URL || "").trim();
  if (!url) {
    console.warn("[MusiBot] CONFIG.SHEETS_API_URL no está configurado. LeadSync deshabilitado.");
    return null;
  }
  try {
    return createLeadSync({
      apiUrl: url,
      debug: isLeadDebug()
    });
  } catch (e) {
    console.warn("[MusiBot] LeadSync no pudo inicializar:", e?.message || e);
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
  const ignore = ["volver al menú", "volver", "menu", "menú"];
  if (ignore.some(x => low.includes(x))) return "";

  return s;
}

/**
 * Normaliza un posible valor de "edad/rango" para guardarlo en Sheets.
 */
function normalizeEdadValue(v) {
  return normalizeChoiceValue(v);
}

/**
 * Normaliza un posible valor de "arte" (disciplina) para guardarlo en Sheets.
 */
function normalizeArteValue(v) {
  return normalizeChoiceValue(v);
}

/**
 * Normaliza un posible valor de "modalidad" para guardarlo en Sheets.
 * - Acepta labels humanos con emoji ("🏫 En sede", "🏠 Musicala Hogar", "💻 Virtual")
 */
function normalizeModalidadValue(v) {
  const s = normalizeChoiceValue(v);
  if (!s) return "";

  // Si algún día quieren estandarizar a "sede/hogar/virtual", se puede mapear acá.
  return s;
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

  // NOMBRE
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

  // CEL
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

  // SERVICIO
  const servicio = pickFirstNonEmpty(
    lead.servicio,
    lead.service,
    mem.servicio,
    mem.service
  );

  // EDAD / RANGO
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

  // ARTE / DISCIPLINA
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

  // MODALIDAD (nuevo)
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
  const modalidad = normalizeModalidadValue(modalidadRaw);

  return { nombre, cel, servicio, edad, arte, modalidad };
}

// Dedupe extra en memoria para evitar llamadas repetidas en loops raros
function getLeadSyncFlags() {
  if (!state) return {};
  state.memory = state.memory || {};
  state.memory.flags = state.memory.flags || {};
  state.memory.flags.leadSync = state.memory.flags.leadSync || {};
  return state.memory.flags.leadSync;
}

async function syncLeadFromState() {
  if (!leadSync || !state) return;

  const { nombre, cel, servicio, edad, arte, modalidad } = readLeadFieldsFromState();
  const flags = getLeadSyncFlags();

  if (isLeadDebug()) {
    console.log("[MusiBot] syncLeadFromState() ->", {
      read: { nombre, cel, servicio, edad, arte, modalidad },
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

    // ✅ NUEVO: modalidad
    if (modalidad && flags.modalidad !== modalidad) {
      await leadSync.saveField("modalidad", modalidad);
      flags.modalidad = modalidad;
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
}

/**
 * Mapea diccionario anidado a llaves planas usadas por data-i18n
 */
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

    helpWhatItsTitle: help?.whatIsThis?.title,
    helpWhatItsText: help?.whatIsThis?.text,

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
    videoNotSupported: "Tu navegador no soporta video.",
    introTitle: "Bienvenido a MusiBot 🎵",
    introP1: "Soy tu asistente de Musicala.",
    introP2: "Usa los botones o escribe para comenzar.",
    start: "Empezar",
    waConfigMissing: "Configura el número de WhatsApp en config.js 🙃"
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
    videoNotSupported: "Your browser doesn’t support video.",
    introTitle: "Welcome to MusiBot 🎵",
    introP1: "I’m Musicala’s assistant.",
    introP2: "Use the buttons or type to start.",
    start: "Start",
    waConfigMissing: "Set the WhatsApp number in config.js 🙃"
  };

  const base = lang === "en" ? fallbackEN : fallbackES;
  const extra = lang === "en" ? wEN : wES;
  return { ...base, ...extra };
}

function t(key) {
  return dict(getLang())[key] ?? key;
}

/**
 * Aplica idioma a la UI (HTML + data-i18n + placeholders)
 */
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

  setupWhatsAppBtn();
  renderFAQFromKB();
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

  help.open = true;

  if (target === "faq") {
    const faq = document.getElementById("faqDetails");
    if (faq) faq.open = true;
  }

  help.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* =========================
   STATE SHAPE (defensivo)
========================= */

function normalizeStateShape(s) {
  s = s || {};
  s.memory = s.memory || {};
  s.memory.ui = s.memory.ui || { stage: null, lang: null };

  // lead.* existe por consistencia (aunque tu webflow guarda directo en memory.*)
  s.memory.lead = s.memory.lead || {
    name: "",
    phone: "",
    edad: "",
    arte: "",
    modalidad: ""
  };

  s.memory.capture = s.memory.capture || { stage: null };
  s.memory.flags = s.memory.flags || { flowStarted: false, hydrated: false };

  if (s.memory.arte == null) s.memory.arte = s.memory.arte || "";
  if (s.memory.modalidad == null) s.memory.modalidad = s.memory.modalidad || "";

  s.currentNodeId = s.currentNodeId || null;
  s.awaitingNodeId = s.awaitingNodeId || null;
  s.lastUserText = s.lastUserText || "";

  s.history = Array.isArray(s.history) ? s.history : [];
  s.lastOptions = Array.isArray(s.lastOptions) ? s.lastOptions : [];
  return s;
}

/* =========================
   FLOW CONTROL (puro)
========================= */

/**
 * ✅ ComposerMode: la fuente de verdad es el último bot msg:
 * - msg._flow.allowFreeText === true  -> text
 * - msg._flow.allowFreeText === false -> chips
 * - si no existe _flow -> chips por defecto
 */
function updateComposerModeFromFlow() {
  try {
    syncComposerMode(state);
  } catch {}

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

/**
 * Arranca el flow si aún no ha arrancado.
 */
function startFlowIfNeeded() {
  state.memory = state.memory || {};
  state.memory.flags = state.memory.flags || {};

  if (state.memory.flags.flowStarted) {
    renderChips(state);
    updateComposerModeFromFlow();
    saveState(state);
    return;
  }

  const firstMsg = startFlow(state);
  state.memory.flags.flowStarted = true;

  if (firstMsg) {
    state.history.push(firstMsg);
    appendMessage(firstMsg);
  }

  renderChips(state);
  updateComposerModeFromFlow();

  syncLeadFromState();
  saveState(state);
}

/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    bindLangUI();

    // Idioma visual por defecto
    applyUILang("es");

    // Escuchar idioma elegido desde INTRO
    window.addEventListener("musibot:lang", (e) => {
      const lang = e?.detail?.lang;
      if (lang === "es" || lang === "en") applyUILang(lang);
    });

    // Estado
    state = normalizeStateShape(loadState() || getInitialState());

    // Flow
    await loadFlow();

    // WhatsApp
    setupWhatsAppBtn();

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

  loadFAQ();

  startFlowIfNeeded();

  renderChips(state);
  updateComposerModeFromFlow();

  syncLeadFromState();
  saveState(state);
}

/* =========================
   HANDLERS
========================= */

function onUserSubmit(text) {
  const value = String(text || "").trim();
  if (!value) return;

  // Si el último bot msg no permite texto, ignoramos envíos por teclado.
  try {
    const history = state?.history || [];
    const lastBot = [...history].reverse().find((m) => m?.from === "bot");
    const allow = lastBot?._flow?.allowFreeText;

    if (allow !== true) return;
  } catch {
    return;
  }

  // Guard extra: si no hay awaitingNodeId, no aceptamos texto libre
  if (!state?.awaitingNodeId) return;

  const userMsg = makeUserMessage(value);
  state.history.push(userMsg);
  appendMessage(userMsg);

  const botReply = handleUserInput(value, state);
  if (botReply) {
    state.history.push(botReply);
    appendMessage(botReply);
  }

  renderChips(state);
  updateComposerModeFromFlow();

  syncLeadFromState();
  saveState(state);
}

function onChipClick(value, kind) {
  if (!value) return;

  // Chips UI: idioma
  if (kind === "ui:lang") {
    if (value === "es" || value === "en") applyUILang(value);
    return;
  }

  // Acciones UI (si existen)
  if (kind === "global:FAQ") { openHelpPanel("faq"); return; }
  if (kind === "global:MENU") { openHelpPanel(); return; }
  if (kind === "global:WHATSAPP") {
    const waBtn = document.getElementById("waBtn");
    if (waBtn && waBtn.href) window.open(waBtn.href, "_blank", "noopener");
    return;
  }

  // Chip como input de conversación
  const userMsg = makeUserMessage(value);
  state.history.push(userMsg);
  appendMessage(userMsg);

  const botReply = handleUserInput(value, state);
  if (botReply) {
    state.history.push(botReply);
    appendMessage(botReply);
  }

  renderChips(state);
  updateComposerModeFromFlow();

  syncLeadFromState();
  saveState(state);
}

function onReset() {
  state = normalizeStateShape(resetState());

  state.memory.flags.flowStarted = false;

  // reset flags de sync
  state.memory.flags.leadSync = {};

  renderAll(state);

  startFlowIfNeeded();

  renderChips(state);
  updateComposerModeFromFlow();

  // Solo focus si realmente está en modo texto
  try {
    const history = state?.history || [];
    const lastBot = [...history].reverse().find((m) => m?.from === "bot");
    if (lastBot?._flow?.allowFreeText === true) focusInput();
  } catch {}

  saveState(state);
}

/* =========================
   WHATSAPP
========================= */

let waGuardBound = false;

function setupWhatsAppBtn() {
  const waBtn = document.getElementById("waBtn");
  if (!waBtn) return;

  const number = (CONFIG.WHATSAPP_NUMBER || "").replace(/[^\d]/g, "");
  const lang = getLang();

  const rawText =
    lang === "en"
      ? (CONFIG.WHATSAPP_TEXT_EN || CONFIG.WHATSAPP_TEXT_ES || "Hi 👋")
      : (CONFIG.WHATSAPP_TEXT_ES || "Hola 👋");

  const text = encodeURIComponent(rawText);

  if (!number || number.includes("XXXXXXXX")) {
    waBtn.href = "#";
    if (!waGuardBound) {
      waGuardBound = true;
      waBtn.addEventListener("click", (e) => {
        if (waBtn.getAttribute("href") === "#") {
          e.preventDefault();
          alert(t("waConfigMissing"));
        }
      });
    }
    return;
  }

  waBtn.href = `https://wa.me/${number}?text=${text}`;
}

/* =========================
   FAQ (bilingüe)
========================= */

function renderFAQFromKB() {
  if (!kbCache) return;

  const lang = getLang();
  const faq = kbCache.faq;

  let items = [];
  if (Array.isArray(faq)) items = faq;
  else if (faq && Array.isArray(faq[lang])) items = faq[lang];

  if (Array.isArray(items) && items.length) renderFAQ(items);
}

async function loadFAQ() {
  try {
    const res = await fetch(CONFIG.KB_URL, { cache: "no-store" });
    if (!res.ok) return;

    kbCache = await res.json();
    renderFAQFromKB();
  } catch (err) {
    console.warn("No se pudo cargar kb.json:", err);
  }
}
