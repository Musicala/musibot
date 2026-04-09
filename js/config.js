// config.js
// ============================
// Configuración central de MusiBot (v3.5)
// Enfoque: FLOW puro + UI i18n + guardado incremental a Google Sheets (leadSync)
//
// ✅ Preparado para arquitectura modular (router + módulos)
// ✅ Compatible con modo antiguo (1 solo webflow.json)
// ✅ Sin chips globales abajo (FAQ/Inicio/Reiniciar/WhatsApp)
// ✅ WhatsApp y utilidades SOLO en botón superior (UI), pero el motor sí reconoce comandos globales
// ✅ Matching más “humano” para texto libre
// ✅ Fix loop “respuesta válida”: habilita reconocimiento de acciones MENU/RESET/FAQ/WHATSAPP
// ✅ HOME_NODE_ID apunta al MENÚ post-captura (no al saludo) para NO repetir nombre/teléfono
//
// Nota: Object.freeze es shallow. Para config es suficiente (no mutar), pero por favor no lo modifiquen en runtime 😅

export const CONFIG = Object.freeze({
  /* =========================
     DATA / ROUTES
     - FLOW_MODE:
       - "single": usa FLOW_URL (legacy)
       - "multi":  usa FLOW_URLS (router + módulos)
  ========================= */
  FLOW_MODE: "multi",

  // Legacy (compatibilidad): si tu engine aún solo soporta un flow, usa esto.
  FLOW_URL: "./webflow.json",

  // ✅ Nuevo: carga múltiple (router + módulos)
  // Orden recomendado: router primero, luego módulos.
  FLOW_URLS: [
    "./webflow_router.json",
    "./webflow_vacacional.json",
    "./webflow_presencial.json",
    "./webflow_virtual.json",
    "./webflow_domicilio.json",
    "./webflow_otrosservicios.json",
  ],

  KB_URL: "./kb.json",
  SEASONAL_WORKSHOPS_URL: "./talleres_temporada.json",

  /* =========================
     STORAGE
     - Recomendación: al cambiar de single a multi, usa una LS_KEY nueva
       para evitar que el historial viejo “ensucie” el estado.
  ========================= */
  LS_KEY: "musibot_flow_v3_5_multi",
  MAX_HISTORY: 140,

  // Si true: solo reproduce/ejecuta el saludo/intro 1 vez por sesión (según motor / state).
  INTRO_ONCE: true,

  /* =========================
     BRANDING / BASE COPY
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
  SHEETS_API_URL:
    "https://script.google.com/macros/s/AKfycbwZF1HzBMOfZUs3uhIgFXp5QOdWeI0b-DdPWqtAY5iSKkyIq9Wuh5UwnFd5iwv1gy-PuA/exec",

  /* =========================
     WHATSAPP (SOLO BOTÓN SUPERIOR)
     Nota: ya NO se usa como chip abajo.
  ========================= */
  WHATSAPP_NUMBER: "573193529475", // +57 319 352 9475 (sin +)
  WHATSAPP_TEXT_ES: "Hola, quiero información sobre clases en Musicala 🙌",
  WHATSAPP_TEXT_EN: "Hi, I want information about classes at Musicala 🙌",

  /* =========================
     FLOW ENGINE (special nodes)
     IMPORTANT:
     - HOME_NODE_ID debe ser el MENÚ PRINCIPAL post-captura (no el saludo).
     - Así “Volver al menú” NO repite nombre/teléfono ni vuelve al audio.
     - En modo multi, HOME_NODE_ID debe vivir en el router.
  ========================= */
  FLOW_SPECIAL: {
    // ✅ En tu router, el menú principal post-captura es este:
    HOME_NODE_ID: "show_program_options",

    // Nodo fallback específico (si tienes uno). Si null, el motor usa fallback interno.
    FALLBACK_NODE_ID: "menu_fallback",

    // Nodo especial de captura (si un día lo usan para saltos o recolección forzada).
    CAPTURE_NODE_ID: null,

    // Si true: cuando se detecta MENU, el motor hace jump al HOME_NODE_ID
    HARD_HOME_ON_MENU: true,

    // ✅ IMPORTANTÍSIMO (por tu hallazgo):
    // En modo multi, NO se deben deduplicar conexiones por default.
    // Si algún día quieres dedupe, actívalo explícitamente:
    //   FLOW_SPECIAL: { DEDUPE_CONNECTIONS: true }
    DEDUPE_CONNECTIONS: false,

    // Si necesitas “saltar” nodos (debug / hotfixes temporales)
    SKIP_NODE_IDS: [],
  },

  /* =========================
     MATCHING (free text vs options)
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
      MIN_CHARS_FOR_SMART: 3,
    },

    // Algunas respuestas deben “ganar” aunque el nodo esté esperando otra cosa,
    // para evitar loops tipo “responde válido 😵‍💫”.
    PRIORITIZE_GLOBAL_ACTIONS: true,

    // Alias por texto (no chips). Útil cuando el usuario escribe,
    // o cuando un botón manda algo tipo "MENU".
    ALIASES: {
      MENU: [
        "menu",
        "menú",
        "inicio",
        "home",
        "principal",
        "menu principal",
        "menú principal",
        "volver",
        "volver al menu",
        "volver al menú",
        "regresar",
        "regresar al menu",
        "regresar al menú",
        "volver al inicio",
        "ir al menu",
        "ir al menú",
      ],
      RESET: [
        "reiniciar",
        "reset",
        "restart",
        "empezar de nuevo",
        "comenzar de nuevo",
        "volver a empezar",
        "borrar chat",
        "borrar conversación",
        "borrar conversacion",
        "limpiar chat",
      ],
      FAQ: [
        "preguntas frecuentes",
        "faq",
        "preguntas",
        "dudas",
        "dudas frecuentes",
        "ayuda",
        "help",
      ],
      WHATSAPP: [
        "whatsapp",
        "wasap",
        "wpp",
        "hablar con alguien",
        "hablar con un humano",
        "asesor",
        "asesora",
        "persona",
        "humano",
        "chatear",
        "hablar por whatsapp",
        "contacto",
        "contactar",
      ],
    },
  },

  /* =========================
     GLOBAL ACTIONS
     ✅ Habilitadas para que el motor reconozca MENU/RESET/FAQ/WHATSAPP (evita loops)
     ✅ Pero la UI NO debe mostrar chips globales abajo (lo controlas con UX.FLOW_CHIPS_ONLY)
  ========================= */
  GLOBAL_ACTIONS: {
    ENABLED: true,

    // Si tu engine tiene “comandos” internos, esto ayuda a mapear.
    // Si no, igual se usa para matching + UI futura sin romper.
    ACTION_IDS: {
      MENU: "MENU",
      RESET: "RESET",
      FAQ: "FAQ",
      WHATSAPP: "WHATSAPP",
    },

    // Definición textual por si en algún momento vuelves a renderizar chips.
    CHIPS: {
      FAQ: { es: "Preguntas frecuentes", en: "FAQ" },
      MENU: { es: "Inicio", en: "Home" },
      RESET: { es: "Reiniciar", en: "Restart" },
      WHATSAPP: { es: "Hablar por WhatsApp", en: "WhatsApp" },
    },
  },

  /* =========================
     TEXT NORMALIZATION
  ========================= */
  NORMALIZE: {
    REMOVE_ACCENTS: true,
    TRIM: true,
    LOWERCASE: true,
    COLLAPSE_SPACES: true,

    // Extra: quita puntuación suave para matching más limpio.
    // Tu flowEngine lo soporta.
    REMOVE_PUNCTUATION: true,
  },

  /* =========================
     UX / UI RULES
  ========================= */
  UX: {
    // Forzar input en captura (name/phone) incluso si el flow tiene opciones.
    CAPTURE_FORCE_TEXT_INPUT: true,

    // IMPORTANT: evita chips globales; solo renderiza los chips del nodo actual del flow.
    FLOW_CHIPS_ONLY: true,

    // Si el usuario está en un nodo con allowFreeText false, pero escribe algo random,
    // deja que el motor intente matching inteligente en vez de quedarse en bucle.
    ALLOW_SMART_FALLBACK_ON_OPTION_NODES: true,
  },

  /* =========================
     WHATSAPP GATE
     - Controla CUÁNDO aparece el chip de WhatsApp dentro del flujo.
     - Default: solo en nodos cuyo name tenga "Cierre" (o similares).
  ========================= */
  WHATSAPP_GATE: {
    // Regex (string) para detectar nodos donde sí se permite el CTA.
    // Si ustedes renombran los nodos, cambian esto y listo.
    ALLOW_NODE_NAME_RE: "\\bcierre\\b|\\bfinal\\b|\\binscrip\\b",

    // Opcional: si quieren habilitar por bandera en memory.
    // Ej: "flags.whatsappReady". Si existe y es true, se permite.
    ALLOW_WHEN_FLAG_PATH: null,
  },

  /* =========================
     DEBUG
     Nota: tu engine revisa flags individuales (DEBUG.FLOW, etc).
     DEBUG.ENABLED queda como “switch” humano, por si lo usan en UI/otros módulos.
  ========================= */
  DEBUG: {
    ENABLED: false,
    FLOW: false,
    MATCHING: false,
    UI: false,
    LEAD_SYNC: false,
  },
});
