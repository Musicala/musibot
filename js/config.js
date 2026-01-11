// config.js
// ============================
// Configuración central de MusiBot (v3.1)
// Enfoque: FLOW puro + UI i18n + guardado incremental a Google Sheets (leadSync)
// - Sin chips globales abajo (FAQ/Inicio/Reiniciar/WhatsApp) ✅
// - WhatsApp y utilidades SOLO en botón superior ✅
// - Matching más “humano” para texto libre ✅

export const CONFIG = {
  /* =========================
     DATA / RUTAS
  ========================= */
  FLOW_URL: "./webflow.json",
  KB_URL: "./kb.json",

  /* =========================
     STORAGE
  ========================= */
  LS_KEY: "musibot_flow_v3",
  MAX_HISTORY: 140,
  INTRO_ONCE: true,

  /* =========================
     BRANDING / TEXTOS BASE
  ========================= */
  APP_NAME: "MusiBot",
  BRAND_NAME: "Musicala",

  GREETING_FALLBACK_ES:
    "Gracias por escribir a Musicala 🎶 ¿Con quién tenemos el gusto de hablar?",
  GREETING_FALLBACK_EN:
    "Thanks for contacting Musicala 🎶 Who do I have the pleasure of speaking with?",

  /* =========================
     GOOGLE SHEETS (Lead Sync)
     - URL del Web App de Apps Script (termina en /exec)
     - Si está vacío, leadSync se desactiva (el bot sigue funcionando).
  ========================= */
  SHEETS_API_URL: "https://script.google.com/macros/s/AKfycbwZF1HzBMOfZUs3uhIgFXp5QOdWeI0b-DdPWqtAY5iSKkyIq9Wuh5UwnFd5iwv1gy-PuA/exec",

  /* =========================
     WHATSAPP (SOLO BOTÓN SUPERIOR)
     Nota: ya NO se usa como chip abajo.
  ========================= */
  // Número que pediste: 3195477475 -> formato internacional sin +:
  WHATSAPP_NUMBER: "573193529475",
  WHATSAPP_TEXT_ES: "Hola, quiero información sobre clases en Musicala 🙌",
  WHATSAPP_TEXT_EN: "Hi, I want information about classes at Musicala 🙌",

  /* =========================
     MOTOR DEL FLUJO
  ========================= */
  FLOW_SPECIAL: {
    HOME_NODE_ID: null,
    FALLBACK_NODE_ID: null,
    CAPTURE_NODE_ID: null
  },

  /* =========================
     MATCHING (texto libre vs opciones)
  ========================= */
  MATCHING: {
    ENABLED: true,

    // Orden típico:
    // 1) exacto  2) contiene  3) tokens  4) fallback
    EXACT_MATCH: true,
    CONTAINS_MATCH: true,
    TOKEN_MATCH: true,

    THRESHOLDS: {
      TOKEN_SIMILARITY: 0.56,
      MIN_CHARS_FOR_SMART: 3
    },

    // Alias por texto (no chips). Si no quieres comandos, deja arrays vacíos.
    ALIASES: {
      MENU: ["menu", "menú", "inicio", "home", "volver", "volver al menu", "volver al menú"],
      RESET: ["reiniciar", "reset", "empezar de nuevo", "borrar chat", "borrar conversación"],
      FAQ: ["preguntas frecuentes", "faq", "preguntas", "dudas frecuentes", "ayuda"],
      WHATSAPP: ["whatsapp", "hablar con alguien", "asesor", "asesora", "humano", "persona", "chatear"]
    }
  },

  /* =========================
     ACCIONES GLOBALES
     Desactivadas para que NO aparezcan chips de utilidades abajo ✅
  ========================= */
  GLOBAL_ACTIONS: {
    ENABLED: false,
    CHIPS: {
      FAQ: { es: "Preguntas frecuentes", en: "FAQ" },
      MENU: { es: "Inicio", en: "Home" },
      RESET: { es: "Reiniciar", en: "Restart" },
      WHATSAPP: { es: "Hablar por WhatsApp", en: "WhatsApp" }
    }
  },

  /* =========================
     NORMALIZACIÓN DE TEXTO
  ========================= */
  NORMALIZE: {
    REMOVE_ACCENTS: true,
    TRIM: true,
    LOWERCASE: true,
    COLLAPSE_SPACES: true
  },

  /* =========================
     UX / REGLAS DE INTERFAZ
  ========================= */
  UX: {
    CAPTURE_FORCE_TEXT_INPUT: true,
    FLOW_CHIPS_ONLY: true
  },

  /* =========================
     DEBUG
  ========================= */
  DEBUG: {
    ENABLED: false,
    FLOW: false,
    MATCHING: false,
    UI: false,
    LEAD_SYNC: false
  }
};
