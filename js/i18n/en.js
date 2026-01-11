// js/i18n/en.js (v2)
// English dictionary for MusiBot
// - Compatible with legacy structure (intro/buttons/menu/ui/help/faq)
// - Adds keys used by main.js UI i18n gate (langPrompt/langOptionES/langOptionEN + lead prompts)
// - Adds app.* keys commonly used via data-i18n

export default {
  meta: {
    lang: "en",
    name: "English"
  },

  /* =========================
     APP / TOP UI (data-i18n)
  ========================= */
  app: {
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
    introP1:
      "I’m Musicala’s assistant. Here you can learn about our services, schedules and get quick answers.",
    introP2: "Type your question or use the buttons to begin.",
    start: "Start"
  },

  /* =========================
     LANG GATE (main.js keys)
  ========================= */
  lang: {
    langPrompt: "Before we start, choose your language:",
    langOptionES: "Español",
    langOptionEN: "English"
  },

  /* =========================
     LEAD CAPTURE (main.js keys)
  ========================= */
  lead: {
    leadNamePrompt:
      "Thanks for contacting Musicala 🥰🎶💃🏽🎨. Before we start, what’s your name?",
    leadPhonePrompt:
      "What’s your phone number? (e.g., +57 300 123 4567)",
    leadSkip: "Prefer not to share",
    leadBadPhone:
      "That number looks odd 😅 Write it like +57 300 123 4567, or tap “Prefer not to share”.",
    waConfigMissing: "Set the WhatsApp number in config.js 🙃"
  },

  // =========================
  // Base messages / capture (legacy)
  // =========================
  intro: {
    firstMessage:
      "Thank you for contacting Musicala, an artistic training school 🥰🎶💃🏽🎨. Who do we have the pleasure of speaking with?",
    askNameAlt:
      "Thank you for contacting Musicala, an artistic training school 🥰🎶💃🏽🎨. Before we begin, could you tell us your name?",
    askPhone:
      "Could you now tell us your phone number? (e.g. +57 300 123 4567)",
    chooseLanguage:
      "Choose your language:"
  },

  // =========================
  // Buttons / short options (legacy)
  // =========================
  buttons: {
    // capture
    skip: "I prefer not to share it",

    // languages
    spanish: "Español",
    english: "English",

    // navigation / actions
    faq: "Frequently asked questions",
    home: "Home",
    restart: "Restart",
    whatsapp: "Chat on WhatsApp",
    talkToHuman: "Talk to a human"
  },

  // =========================
  // Main menu (large chips) (legacy)
  // =========================
  menu: {
    mainTitle: "How can we help you today?",
    options: {
      whatIsMusicala: "I want to know what Musicala is",
      classesForSomeone: "I'm looking for classes for someone",
      pricesAndModes: "Prices and modalities",
      meetAlekCata: "Meet Alek & Cata (and the dogs)",
      enrollHuman: "I want to enroll (talk to a human)"
    }
  },

  // =========================
  // UI texts (legacy)
  // =========================
  ui: {
    inputPlaceholder: "Type here...",
    chipsHintUp: "Use the buttons above 👆",
    send: "Send",
    chatTitle: "Chat",
    helpTitle: "Help",
    quickHelp: "Quick help",
    faqs: "FAQs",
    whatsappTop: "WhatsApp"
  },

  // =========================
  // Quick help (right panel) (legacy)
  // =========================
  help: {
    whatIsThis: {
      title: "What is this?",
      text:
        "MusiBot is Musicala's assistant for answering questions about classes, schedules and services."
    },
    howItWorks: {
      title: "How does it work?",
      text:
        "Type your question or use the quick buttons. MusiBot will guide you step by step."
    },
    whatCanIAsk: {
      title: "What can I ask MusiBot?",
      text:
        "Schedules, modalities (on-site/home/online), prices, methodology, trial class, certificates, companies/groups, events/performances and payments."
    },
    exactRecommendation: {
      title: "How can I get an exact recommendation?",
      text:
        "Tell me 3 things: 1) who it is for (child/teen/adult), 2) modality (on-site/home/online), 3) your ideal schedule. If you're ready, I can connect you with a person on WhatsApp."
    },
    whenWhatsapp: {
      title: "When should I go to WhatsApp?",
      text:
        "When you want to finalize enrollment/payment, confirm availability or request an exact quote (companies or groups). The WhatsApp button is at the top right 👆"
    }
  },

  // =========================
  // Base FAQ (right panel) (legacy)
  // =========================
  faq: [
    {
      q: "What schedules do you offer?",
      a:
        "It depends on the modality:\n• Personalized: Monday to Friday 10:00 a.m. – 8:00 p.m.; Saturdays 8:00 a.m. – 5:00 p.m.\n• Group (on-site): weekdays from 5:00 p.m.; Saturdays morning and afternoon sessions."
    },
    { q: "What modalities do you have?", a: "On-site, at home or online." },
    {
      q: "What is your methodology like?",
      a:
        "Clear learning path according to your level + guided practice + creativity, with close accompaniment."
    },
    {
      q: "Is there a trial class?",
      a: "Yes, you can start with a first experience to get to know the methodology."
    },
    {
      q: "Do you provide certificates or constancies?",
      a:
        "In training processes we can issue participation certificates depending on the program."
    },
    {
      q: "Do you offer classes for companies or groups?",
      a:
        "Yes: creative experiences for teams with goals of well-being, integration or creativity."
    },
    {
      q: "Can you prepare me for a performance or event?",
      a:
        "Of course. We design a path focused on staging, technique and stage preparation."
    },
    {
      q: "How do payments work?",
      a:
        "To confirm availability and payment, it is usually managed via WhatsApp (price, modality and schedule)."
    },
    {
      q: "What does the price depend on?",
      a: "Modality, age, level and type of experience (group or personalized)."
    },
    {
      q: "How do I enroll?",
      a:
        "I will guide you here and when you are ready I will connect you with a person to confirm availability, schedule and payment."
    }
  ]
};
