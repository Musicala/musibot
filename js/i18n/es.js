// js/i18n/es.js (v3.1)
// Diccionario Español para MusiBot (Musicala)
//
// ✅ Estructura consistente + compatible con legacy
// ✅ Incluye llaves usadas por main.js (gate idioma + lead capture + UI)
// ✅ Incluye helpWhatsappTitle/helpWhatsappText (bugfix del panel Ayuda)
// ✅ Mantiene textos útiles para ayuda/FAQ (panel derecho)
//
// Consejo: mantén el "contenido grande" (programas, edades, artes) en JSON aparte.
// Este archivo déjalo para UI + textos base + help/FAQ.

const ES = {
  meta: { lang: "es", name: "Español" },

  /* =========================
     APP / TOP UI (data-i18n)
  ========================= */
  app: {
    // Topbar / layout
    language: "Idioma",
    brandSub: "Asistente • Musicala",

    // Chat UI
    chatTitle: "Chat",
    reset: "Reiniciar",
    inputPlaceholder: "Escribe aquí...",
    send: "Enviar",

    // Help panel
    helpTitle: "Ayuda",
    helpQuick: "Ayuda rápida",
    faqTitle: "Preguntas frecuentes",

    // Media
    videoNotSupported: "Tu navegador no soporta video.",

    // Intro panel
    introTitle: "Bienvenido a MusiBot 🎵",
    introP1:
      "Soy tu asistente de Musicala. Aquí puedes conocer nuestros servicios, horarios y resolver tus dudas de forma rápida.",
    introP2: "Escribe tu pregunta o usa los botones para comenzar.",
    start: "Empezar",
  },

  /* =========================
     LANG GATE (estructura)
  ========================= */
  lang: {
    langPrompt: "Antes de empezar, elige tu idioma:",
    langOptionES: "Español",
    langOptionEN: "English",
  },

  /* =========================
     LEAD CAPTURE (estructura)
  ========================= */
  lead: {
    leadNamePrompt:
      "Gracias por comunicarte con Musicala, escuela de formación artística 🥰🎶💃🏽🎨. Antes de empezar, ¿podrías decirnos tu nombre?",
    leadPhonePrompt:
      "Podrías indicarnos ahora, ¿cuál es tu número de celular? (ej: +57 300 123 4567)",
    leadSkip: "Prefiero no dejarlo",
    leadBadPhone:
      "Ese número se ve raro 😅 Escríbelo como +57 300 123 4567, o toca “Prefiero no dejarlo”.",
    waConfigMissing: "Configura el número de WhatsApp en config.js 🙃",
    leadThanks:
      "Listo ✅ Gracias. Si quieres, cuéntame qué estás buscando (música, danza, artes visuales o teatro).",
  },

  /* =========================
     Legacy base (por compatibilidad)
  ========================= */
  intro: {
    firstMessage:
      "Gracias por comunicarte con Musicala, escuela de formación artística 🥰🎶💃🏽🎨. ¿Con quién tenemos el gusto de hablar?",
    askNameAlt:
      "Gracias por comunicarte con Musicala, escuela de formación artística 🥰🎶💃🏽🎨. Antes de empezar, ¿podrías decirnos tu nombre?",
    askPhone:
      "Podrías indicarnos ahora, ¿cuál es tu número de celular? (ej: +57 300 123 4567)",
    chooseLanguage: "Elige tu idioma:",
  },

  buttons: {
    skip: "Prefiero no dejarlo",
    spanish: "Español",
    english: "English",
    faq: "Preguntas frecuentes",
    home: "Inicio",
    restart: "Reiniciar",
    whatsapp: "Hablar por WhatsApp",
    talkToHuman: "Hablar con humano",
  },

  menu: {
    mainTitle: "¿En qué te ayudamos hoy?",
    options: {
      whatIsMusicala: "Quiero saber qué es Musicala",
      classesForSomeone: "Busco clases para alguien",
      pricesAndModes: "Precios y modalidades",
      meetAlekCata: "Conocer a Alek y Cata (y los perritos)",
      enrollHuman: "Quiero inscribirme (hablar con humano)",
    },
  },

  ui: {
    inputPlaceholder: "Escribe aquí...",
    chipsHintUp: "Usa los botones de arriba 👆",
    send: "Enviar",
    chatTitle: "Chat",
    helpTitle: "Ayuda",
    quickHelp: "Ayuda rápida",
    faqs: "Preguntas frecuentes",
    whatsappTop: "WhatsApp",
    openHelp: "Abrir ayuda",
    closeHelp: "Cerrar ayuda",
  },

  /* =========================
     Ayuda rápida (panel derecho)
  ========================= */
  help: {
    whatIsThis: {
      title: "¿Qué es esto?",
      text: "MusiBot es el asistente de Musicala para resolver dudas sobre clases, horarios y servicios.",
    },
    howItWorks: {
      title: "¿Cómo funciona?",
      text: "Escribe tu pregunta o usa los botones rápidos. MusiBot te guía paso a paso.",
    },
    whatCanIAsk: {
      title: "¿Qué puedo preguntarle a MusiBot?",
      text:
        "Horarios, modalidades (sede/hogar/virtual), precios, metodología, clase de prueba, constancias, empresas/grupos, eventos/presentaciones y pagos.",
    },
    exactRecommendation: {
      title: "¿Cómo consigo una recomendación exacta?",
      text:
        "Dime 3 cosas: 1) para quién es (niño/joven/adulto), 2) modalidad (sede/hogar/virtual), 3) tu horario ideal. Si ya estás listo, te paso con una persona por WhatsApp.",
    },
    whatsapp: {
      // 👇 estas dos son las que estabas necesitando (lógico y bonito)
      title: "¿Cuándo debo irme a WhatsApp?",
      text:
        "Cuando quieras cerrar inscripción/pago, confirmar cupos o pedir una cotización exacta (empresas o grupos). El botón de WhatsApp está arriba a la derecha 👆",
    },
  },

  /* =========================
     FAQ base (panel derecho)
  ========================= */
  faq: [
    {
      q: "¿Qué horarios manejan?",
      a:
        "Depende de la modalidad:\n" +
        "• Personalizado: lunes a viernes 10:00 a.m. – 8:00 p.m.; sábados 8:00 a.m. – 5:00 p.m.\n" +
        "• Grupales (en sede): entre semana desde las 5:00 p.m.; sábados jornada mañana y tarde.",
    },
    { q: "¿Qué modalidades tienen?", a: "En sede, a domicilio o virtual." },
    {
      q: "¿Cómo es la metodología?",
      a: "Ruta clara según tu nivel + práctica guiada + creatividad, con acompañamiento cercano.",
    },
    {
      q: "¿Hay clase de prueba?",
      a: "Sí. Puedes iniciar con una primera experiencia para conocer la metodología y definir tu ruta.",
    },
    {
      q: "¿Entregan certificados o constancias?",
      a: "En procesos formativos podemos emitir constancias de participación según el programa.",
    },
    {
      q: "¿Manejan clases para empresas o grupos?",
      a:
        "Sí: experiencias creativas para equipos con objetivos de bienestar, integración o creatividad.",
    },
    {
      q: "¿Me pueden preparar para una presentación o evento?",
      a: "Claro. Armamos una ruta enfocada en montaje, técnica y preparación escénica.",
    },
    {
      q: "¿Cómo funcionan los pagos?",
      a:
        "Para confirmar cupo y pago normalmente se gestiona por WhatsApp (valor, modalidad y horario).",
    },
    {
      q: "¿De qué depende el precio?",
      a: "Modalidad, edad, nivel y tipo de experiencia (grupal o personalizado).",
    },
    {
      q: "¿Cómo me inscribo?",
      a:
        "Te guío por aquí y cuando estés listo te paso con una persona para confirmar cupo, horario y pago.",
    },
  ],

  /* =========================
     FLAT KEYS (compatibilidad con main.js actual)
     - Si main.js usa t("language"), t("helpWhatsappTitle"), etc, esto lo cubre.
  ========================= */

  // UI general
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
  introP1:
    "Soy tu asistente de Musicala. Aquí puedes conocer nuestros servicios, horarios y resolver tus dudas de forma rápida.",
  introP2: "Escribe tu pregunta o usa los botones para comenzar.",
  start: "Empezar",

  // Gate idioma (llaves planas)
  langPrompt: "Antes de empezar, elige tu idioma:",
  langOptionES: "Español",
  langOptionEN: "English",

  // Lead capture (llaves planas)
  leadNamePrompt:
    "Gracias por comunicarte con Musicala, escuela de formación artística 🥰🎶💃🏽🎨. Antes de empezar, ¿podrías decirnos tu nombre?",
  leadPhonePrompt:
    "Podrías indicarnos ahora, ¿cuál es tu número de celular? (ej: +57 300 123 4567)",
  leadSkip: "Prefiero no dejarlo",
  leadBadPhone:
    "Ese número se ve raro 😅 Escríbelo como +57 300 123 4567, o toca “Prefiero no dejarlo”.",
  waConfigMissing: "Configura el número de WhatsApp en config.js 🙃",

  // ✅ FIX: llaves que te estaban apareciendo en pantalla
  helpWhatsappTitle: "¿Cuándo debo irme a WhatsApp?",
  helpWhatsappText:
    "Cuando quieras cerrar inscripción/pago, confirmar cupos o pedir una cotización exacta (empresas o grupos). El botón de WhatsApp está arriba a la derecha 👆",
};

export default ES;
