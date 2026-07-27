import { CONFIG } from "./config.js";
import { getFirebaseApp } from "./firebaseClient.js";
import {
  GoogleAIBackend,
  getAI,
  getGenerativeModel,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-ai.js";
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app-check.js";
import {
  fetchAndActivate,
  getBoolean,
  getNumber,
  getRemoteConfig,
  getString,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-remote-config.js";
import {
  buildAISystemInstruction,
  buildAIUserPrompt,
  parseAIResponse,
  sanitizeUserText,
  selectKnowledgeContext,
} from "./aiPolicy.mjs";

const AI_SESSION_USAGE_KEY = "musibot_ai_session_usage_v3";
const AI_DAY_USAGE_KEY = "musibot_ai_day_usage_v3";
const AI_LAST_CALL_KEY = "musibot_ai_last_call_v3";

let stackPromise = null;
let appCheckInitialized = false;

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function safeJSON(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readUsage() {
  const day = todayKey();
  let dayUsage = safeJSON(localStorage.getItem(AI_DAY_USAGE_KEY), {
    key: day,
    count: 0,
  });

  if (dayUsage.key !== day) {
    dayUsage = { key: day, count: 0 };
    localStorage.setItem(AI_DAY_USAGE_KEY, JSON.stringify(dayUsage));
  }

  return {
    dayUsage,
    sessionCount: Number(sessionStorage.getItem(AI_SESSION_USAGE_KEY) || 0),
    dayCount: Number(dayUsage.count || 0),
    lastCallAt: Number(localStorage.getItem(AI_LAST_CALL_KEY) || 0),
  };
}

function reserveUsage() {
  const usage = readUsage();
  sessionStorage.setItem(AI_SESSION_USAGE_KEY, String(usage.sessionCount + 1));
  const nextDayUsage = {
    key: todayKey(),
    count: usage.dayCount + 1,
  };
  localStorage.setItem(AI_DAY_USAGE_KEY, JSON.stringify(nextDayUsage));
  localStorage.setItem(AI_LAST_CALL_KEY, String(Date.now()));
}

export function resetAISessionUsage() {
  sessionStorage.removeItem(AI_SESSION_USAGE_KEY);
}

function getLocalAllowance(settings) {
  const usage = readUsage();
  if (usage.sessionCount >= settings.maxPerSession) {
    return { allowed: false, reason: "session_limit", usage };
  }
  if (usage.dayCount >= settings.maxPerDay) {
    return { allowed: false, reason: "browser_day_limit", usage };
  }
  if (Date.now() - usage.lastCallAt < settings.cooldownMs) {
    return { allowed: false, reason: "cooldown", usage };
  }
  return { allowed: true, reason: "available", usage };
}

function baseSettings() {
  const cfg = CONFIG?.AI || {};
  return {
    enabled: cfg.ENABLED !== false,
    model: String(cfg.MODEL || "gemini-3.5-flash-lite"),
    maxPerSession: Number(cfg.MAX_RESPONSES_PER_SESSION || 3),
    maxPerDay: Number(cfg.MAX_RESPONSES_PER_BROWSER_DAY || 10),
    cooldownMs: Number(cfg.COOLDOWN_SECONDS || 10) * 1000,
    maxUserChars: Number(cfg.MAX_USER_MESSAGE_CHARS || 1000),
    maxKnowledgeChars: Number(cfg.MAX_KNOWLEDGE_CONTEXT_CHARS || 4500),
    maxOutputTokens: Number(cfg.MAX_OUTPUT_TOKENS || 300),
  };
}

function applyRemoteSettings(remoteConfig, defaults) {
  if (!remoteConfig) return defaults;
  const model = getString(remoteConfig, "musibot_ai_model").trim();
  return {
    ...defaults,
    enabled: getBoolean(remoteConfig, "musibot_ai_enabled"),
    model: model || defaults.model,
    maxPerSession:
      getNumber(remoteConfig, "musibot_ai_session_limit") || defaults.maxPerSession,
    maxPerDay:
      getNumber(remoteConfig, "musibot_ai_browser_day_limit") || defaults.maxPerDay,
    cooldownMs:
      (getNumber(remoteConfig, "musibot_ai_cooldown_seconds") ||
        defaults.cooldownMs / 1000) * 1000,
  };
}

async function initializeAIStack() {
  if (stackPromise) return stackPromise;

  stackPromise = (async () => {
    const app = getFirebaseApp();
    if (!app) throw new Error("firebase_unavailable");

    if (!appCheckInitialized) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(
          String(CONFIG?.AI?.APP_CHECK_SITE_KEY || "")
        ),
        isTokenAutoRefreshEnabled: true,
      });
      appCheckInitialized = true;
    }

    const remoteConfig = getRemoteConfig(app);
    remoteConfig.settings.minimumFetchIntervalMillis = Number(
      CONFIG?.AI?.REMOTE_CONFIG_MIN_FETCH_MS || 300000
    );
    remoteConfig.settings.fetchTimeoutMillis = 8000;
    remoteConfig.defaultConfig = {
      musibot_ai_enabled: String(CONFIG?.AI?.ENABLED !== false),
      musibot_ai_model: String(CONFIG?.AI?.MODEL || "gemini-3.5-flash-lite"),
      musibot_ai_session_limit: String(CONFIG?.AI?.MAX_RESPONSES_PER_SESSION || 3),
      musibot_ai_browser_day_limit: String(
        CONFIG?.AI?.MAX_RESPONSES_PER_BROWSER_DAY || 10
      ),
      musibot_ai_cooldown_seconds: String(CONFIG?.AI?.COOLDOWN_SECONDS || 10),
    };

    try {
      await fetchAndActivate(remoteConfig);
    } catch (error) {
      console.warn("[MusiBot][AI] Remote Config no disponible; se usan límites locales.");
    }

    const ai = getAI(app, { backend: new GoogleAIBackend() });
    return { ai, remoteConfig };
  })();

  return stackPromise;
}

export async function getAIStatus() {
  try {
    const { remoteConfig } = await initializeAIStack();
    const settings = applyRemoteSettings(remoteConfig, baseSettings());
    const allowance = getLocalAllowance(settings);
    return {
      enabled: settings.enabled,
      available: settings.enabled && allowance.allowed,
      reason: settings.enabled ? allowance.reason : "disabled",
      model: settings.model,
      sessionUsed: allowance.usage.sessionCount,
      sessionLimit: settings.maxPerSession,
      browserDayUsed: allowance.usage.dayCount,
      browserDayLimit: settings.maxPerDay,
    };
  } catch (error) {
    return {
      enabled: false,
      available: false,
      reason: error?.message || "init_failed",
    };
  }
}

export async function requestAIAnswer({
  text = "",
  lang = "es",
  knowledgeBase = null,
} = {}) {
  let settings = baseSettings();

  try {
    const { ai, remoteConfig } = await initializeAIStack();
    settings = applyRemoteSettings(remoteConfig, settings);

    if (!settings.enabled) {
      return { ok: false, reason: "disabled" };
    }

    const allowance = getLocalAllowance(settings);
    if (!allowance.allowed) {
      return { ok: false, reason: allowance.reason };
    }

    const userText = sanitizeUserText(text, settings.maxUserChars);
    if (!userText) {
      return { ok: false, reason: "empty_after_sanitize" };
    }

    const knowledge = selectKnowledgeContext(knowledgeBase, userText, lang, {
      maxChars: settings.maxKnowledgeChars,
      maxItems: 6,
    });

    const model = getGenerativeModel(ai, {
      model: settings.model,
      systemInstruction: buildAISystemInstruction(lang),
      generationConfig: {
        temperature: 0.25,
        topP: 0.8,
        maxOutputTokens: settings.maxOutputTokens,
        responseMimeType: "application/json",
      },
    });

    reserveUsage();
    const startedAt = performance.now();
    const result = await model.generateContent(
      buildAIUserPrompt({ userText, lang, knowledge })
    );
    const latencyMs = Math.round(performance.now() - startedAt);
    const parsed = parseAIResponse(result?.response?.text?.() || "");
    const usage = result?.response?.usageMetadata || {};

    if (!parsed) {
      return {
        ok: false,
        reason: "invalid_response",
        latencyMs,
        usage,
      };
    }

    return {
      ok: true,
      reason: "answered",
      text: parsed.answer,
      confidence: parsed.confidence,
      needsHuman: parsed.needsHuman,
      model: settings.model,
      latencyMs,
      usage: {
        promptTokenCount: Number(usage.promptTokenCount || 0),
        candidatesTokenCount: Number(usage.candidatesTokenCount || 0),
        thoughtsTokenCount: Number(usage.thoughtsTokenCount || 0),
        totalTokenCount: Number(usage.totalTokenCount || 0),
      },
      knowledgeItems: knowledge.length,
    };
  } catch (error) {
    console.warn("[MusiBot][AI] consulta no disponible:", error?.message || error);
    const errorCode = String(error?.code || "").trim();
    const errorMessage = String(error?.message || "request_failed").trim();
    return {
      ok: false,
      reason: [errorCode, errorMessage]
        .filter((value, index, all) => value && all.indexOf(value) === index)
        .join(": ")
        .slice(0, 240),
    };
  }
}
