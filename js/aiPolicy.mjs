const GLOBAL_COMMANDS = new Set([
  "menu",
  "menú",
  "inicio",
  "home",
  "reset",
  "reiniciar",
  "faq",
  "ayuda",
  "help",
  "whatsapp",
  "asesor",
]);

export function normalizeAIText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeUserText(value = "", maxChars = 1000) {
  return String(value || "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[correo omitido]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[telefono omitido]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[enlace omitido]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(1, Number(maxChars) || 1000));
}

export function isMeaningfulAIQuestion(value = "") {
  const clean = normalizeAIText(value);
  if (clean.length < 4 || /^\d+$/.test(clean)) return false;
  if (GLOBAL_COMMANDS.has(clean)) return false;
  return /[\p{L}]/u.test(clean);
}

export function isGenericFallbackReply(botReply = null) {
  if (!botReply) return false;
  if (botReply?._flow?.buttonsOnly) return true;

  const clean = normalizeAIText(botReply?.text || "");
  return (
    clean.includes("no te entendi") ||
    clean.includes("no lo ubique") ||
    clean.includes("didnt fully get") ||
    clean.includes("use the buttons") ||
    clean.includes("elige una opcion")
  );
}

export function shouldAttemptAI({
  enabled = true,
  userText = "",
  botReply = null,
  captureStage = "",
} = {}) {
  if (!enabled) return { allowed: false, reason: "disabled" };
  if (String(captureStage || "").trim()) {
    return { allowed: false, reason: "capture_active" };
  }
  if (!isMeaningfulAIQuestion(userText)) {
    return { allowed: false, reason: "not_meaningful" };
  }
  if (!isGenericFallbackReply(botReply)) {
    return { allowed: false, reason: "local_answer_available" };
  }
  return { allowed: true, reason: "local_fallback" };
}

function tokenize(value = "") {
  return normalizeAIText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function overlapScore(queryTokens, candidate = "") {
  if (!queryTokens.length) return 0;
  const candidateTokens = new Set(tokenize(candidate));
  const common = queryTokens.filter((token) => candidateTokens.has(token)).length;
  return common / queryTokens.length;
}

function localized(value, lang = "es") {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  return String(value[lang] || value.es || value.en || "").trim();
}

export function selectKnowledgeContext(
  kb,
  userText,
  lang = "es",
  { maxChars = 4500, maxItems = 6 } = {}
) {
  if (!kb || typeof kb !== "object") return [];
  const queryTokens = tokenize(userText);
  if (!queryTokens.length) return [];

  const candidates = [];

  (Array.isArray(kb.intents) ? kb.intents : []).forEach((intent) => {
    const patterns = Array.isArray(intent?.patterns?.[lang])
      ? intent.patterns[lang]
      : Array.isArray(intent?.patterns?.es)
        ? intent.patterns.es
        : [];
    const response = localized(intent?.response, lang);
    if (!response) return;
    const searchable = [intent?.id, ...patterns, response].filter(Boolean).join(" ");
    const score = overlapScore(queryTokens, searchable);
    if (score > 0) {
      candidates.push({
        id: String(intent?.id || "intent"),
        text: response,
        score,
      });
    }
  });

  const faqItems = Array.isArray(kb?.faq?.[lang])
    ? kb.faq[lang]
    : Array.isArray(kb?.faq?.es)
      ? kb.faq.es
      : [];

  faqItems.forEach((item, index) => {
    const question = String(item?.q || "").trim();
    const answer = String(item?.a || "").trim();
    if (!question || !answer || answer.startsWith("@img:")) return;
    const score = overlapScore(queryTokens, `${question} ${answer}`);
    if (score > 0) {
      candidates.push({
        id: `faq-${index + 1}`,
        text: `${question}: ${answer}`,
        score: score + 0.02,
      });
    }
  });

  const selected = [];
  let usedChars = 0;

  candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Number(maxItems) || 6))
    .forEach((item) => {
      const line = `[${item.id}] ${item.text}`.trim();
      if (!line || usedChars + line.length > maxChars) return;
      selected.push(line);
      usedChars += line.length;
    });

  return selected;
}

export function buildAISystemInstruction(lang = "es") {
  if (lang === "en") {
    return [
      "You are MusiBot, Musicala's virtual assistant.",
      "The programmed flow and the verified knowledge base are authoritative.",
      "Use supplied verified knowledge for Musicala-specific facts.",
      "Never invent prices, schedules, availability, coverage, policies, or promises.",
      "You may answer general arts-education questions briefly when they do not require private Musicala facts.",
      "Do not ask for or repeat phone numbers, email addresses, documents, payment data, or other sensitive data.",
      "If verified knowledge is insufficient, say so clearly and recommend speaking with the Musicala team on WhatsApp.",
      "Keep the answer warm, useful, concise, and under three short paragraphs.",
      'Return JSON only: {"answer":"...","confidence":"high|medium|low","needsHuman":true|false}.',
    ].join("\n");
  }

  return [
    "Eres MusiBot, asistente virtual de Musicala.",
    "El flujo programado y la base de conocimiento verificada son la autoridad.",
    "Usa el conocimiento suministrado para los datos específicos de Musicala.",
    "Nunca inventes precios, horarios, disponibilidad, cobertura, políticas ni promesas.",
    "Puedes responder brevemente preguntas generales de educación artística cuando no requieran datos privados de Musicala.",
    "No solicites ni repitas teléfonos, correos, documentos, datos de pago ni otros datos sensibles.",
    "Si el conocimiento verificado no alcanza, dilo con claridad y recomienda hablar con el equipo de Musicala por WhatsApp.",
    "Responde de manera cálida, útil, concisa y en máximo tres párrafos cortos.",
    'Devuelve solo JSON: {"answer":"...","confidence":"high|medium|low","needsHuman":true|false}.',
  ].join("\n");
}

export function buildAIUserPrompt({
  userText = "",
  lang = "es",
  knowledge = [],
} = {}) {
  const verified = knowledge.length
    ? knowledge.join("\n\n")
    : lang === "en"
      ? "No directly related verified Musicala facts were found."
      : "No se encontraron datos verificados de Musicala directamente relacionados.";

  return [
    lang === "en" ? "Latest user question:" : "Pregunta más reciente del usuario:",
    userText,
    "",
    lang === "en" ? "Verified Musicala knowledge:" : "Conocimiento verificado de Musicala:",
    verified,
  ].join("\n");
}

export function parseAIResponse(raw = "") {
  const clean = String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  if (!clean) return null;

  let parsed = null;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(clean.slice(start, end + 1));
      } catch {}
    }
  }

  if (!parsed || typeof parsed !== "object") return null;
  const answer = String(parsed.answer || "").trim().slice(0, 1800);
  if (answer.length < 8) return null;

  const confidence = ["high", "medium", "low"].includes(parsed.confidence)
    ? parsed.confidence
    : "low";

  return {
    answer,
    confidence,
    needsHuman: parsed.needsHuman === true || confidence === "low",
  };
}
