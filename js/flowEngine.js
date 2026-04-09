// flowEngine.js (v4.3.0)
// ============================
// Motor REAL para webflows (router + módulos o single)
//
// Tipos soportados:
// - webhook (solo para detectar inicio)
// - autobotAction (mensaje + opciones, waitResponse, media/audio/video/image)
// - filter (router por condiciones)
// - transferConversation (handoff)
//
// Mejoras v4.3.0:
// ✅ FIX real: options del bot conservan {label,value,kind} en msg.options (no solo labels).
//    -> Esto evita que la UI pierda el "kind" (ej global:WHATSAPP) y termine ruteando mal.
// ✅ Unifica match: chip clicks y texto pasan por el mismo motor de matching.
// ✅ Gating de WhatsApp más consistente: (1) por nodo cierre, (2) por msg._flow.isClosing, (3) por config flag.
// ✅ Hardening: fallback si faltan edges por índice, guard de loops más claro.
// ✅ Mejor logging (cuando DEBUG.FLOW) sin spamear tanto.
// ✅ handleUserInput más predecible: respeta allowFreeText y waitResponse sin depender de awaitingNodeId para el texto.
//
// Nota: Este engine asume que ui.js manda kind/value del chip.
//       Con el fix de msg.options, ui.js ya no “pierde” el kind.
//
// ============================

import { CONFIG } from "./config.js";
import { makeBotMessage } from "./state.js";
import FLOW_I18N from "./flowI18n.js";
import { getSeasonalVacationalText } from "./vacationSeasons.js";

/* =========================
   FLOW CACHE
========================= */
let FLOW = null;
const MAX_STEPS_PER_TURN = 30;

function getStateLang(state) {
  const lang = String(
    state?.memory?.ui?.lang ||
    state?.memory?.lang ||
    ""
  ).toLowerCase();

  return lang === "en" ? "en" : "es";
}

function getFlowMessages(state) {
  const lang = getStateLang(state);
  return FLOW_I18N?.[lang]?.messages || {};
}

function flowText(state, key, fallback) {
  return String(getFlowMessages(state)?.[key] || fallback || "");
}

function isAdvisorIntentText(text = "") {
  const clean = normalize(text || "");
  if (!clean) return false;

  const patterns = [
    "asesor",
    "asesora",
    "hablar con asesor",
    "continuar a asesor",
    "humano",
    "humana",
    "hablar con humano",
    "advisor",
    "adviser",
    "talk to an advisor",
    "talk to a human",
    "human"
  ];

  return patterns.some((p) => {
    const needle = normalize(p);
    return clean === needle || wordBoundaryIncludes(clean, needle);
  });
}

function makeWhatsAppReadyMessage(state, mode = "ready") {
  const isEn = getStateLang(state) === "en";
  const text =
    mode === "advisor"
      ? (isEn
          ? "Perfect. If you'd rather talk to an advisor, here is the WhatsApp option."
          : "Perfecto. Si prefieres hablar con un asesor, aquí tienes la opción de WhatsApp.")
      : (isEn
          ? "All set. Tap the WhatsApp option and I'll take you there directly."
          : "Listo. Toca la opción de WhatsApp y te llevo directo.");

  const waLabel = isEn ? "Talk on WhatsApp" : "💬 Hablar por WhatsApp";
  const menuLabel = isEn ? "Back to menu" : "Volver al menú";

  const msg = makeBotMessage(text);
  msg.options = [
    { label: waLabel, value: "WHATSAPP", kind: "global:WHATSAPP" },
    { label: menuLabel, value: menuLabel, kind: "option" }
  ];
  msg._flow = {
    isClosing: true,
    allowFreeText: false,
    hasOptions: true
  };

  return msg;
}

function getNodeTranslation(nodeId, state) {
  const lang = getStateLang(state);
  if (lang !== "en") return null;
  return FLOW_I18N?.[lang]?.nodes?.[String(nodeId || "")] || null;
}

function localizeNodeOption(baseOption, translatedOption) {
  if (!translatedOption) return baseOption;

  if (typeof baseOption === "string") {
    if (typeof translatedOption === "string") {
      return { label: translatedOption, value: baseOption, kind: null };
    }

    if (translatedOption && typeof translatedOption === "object") {
      const label = String(
        translatedOption.label ||
        translatedOption.text ||
        translatedOption.value ||
        baseOption
      ).trim();
      const value =
        translatedOption.value != null
          ? String(translatedOption.value).trim()
          : String(baseOption).trim();
      const kind =
        translatedOption.kind != null
          ? String(translatedOption.kind).trim()
          : null;

      return { label, value, kind };
    }

    return baseOption;
  }

  if (baseOption && typeof baseOption === "object") {
    const fallbackValue = String(
      baseOption.value ??
      baseOption.label ??
      baseOption.text ??
      ""
    ).trim();

    if (typeof translatedOption === "string") {
      return {
        ...baseOption,
        label: translatedOption,
        value: fallbackValue
      };
    }

    if (translatedOption && typeof translatedOption === "object") {
      const label = String(
        translatedOption.label ||
        translatedOption.text ||
        baseOption.label ||
        baseOption.text ||
        fallbackValue
      ).trim();
      const value =
        translatedOption.value != null
          ? String(translatedOption.value).trim()
          : fallbackValue;
      const kind =
        translatedOption.kind != null
          ? String(translatedOption.kind).trim()
          : baseOption.kind;

      return {
        ...baseOption,
        ...translatedOption,
        label,
        value,
        kind
      };
    }
  }

  return baseOption;
}

function localizeNodeOptions(options, translatedOptions) {
  if (!Array.isArray(options) || !Array.isArray(translatedOptions)) return options;
  return options.map((opt, idx) => localizeNodeOption(opt, translatedOptions[idx]));
}

function getRawNodeOptions(node) {
  const p = node?.parameters || node?.data?.parameters || {};
  return p.options || p || {};
}

/* =========================
   LOAD FLOW(S)
========================= */
export async function loadFlow() {
  const mode = String(CONFIG.FLOW_MODE || "").toLowerCase().trim();
  const urls = Array.isArray(CONFIG.FLOW_URLS) ? CONFIG.FLOW_URLS.filter(Boolean) : [];

  if (mode === "multi" && urls.length) return loadFlows(urls);
  return loadSingleFlow(CONFIG.FLOW_URL);
}

async function loadSingleFlow(url) {
  if (!url) throw new Error("CONFIG.FLOW_URL está vacío");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar flow: ${url}`);

  const raw = await res.json();
  const parsed = parseFlowLike(raw, url);

  FLOW = buildFlowIndex({
    raw: [raw],
    nodes: parsed.nodes,
    connections: parsed.connections,
    sourceByNodeId: parsed.sourceByNodeId,
  });

  validateFlowGraph(FLOW);
  if (CONFIG.DEBUG?.FLOW) console.log("[flow] loaded (single)", { nodes: Object.keys(FLOW.nodeMap).length, edges: (FLOW.connections || []).length });
  return FLOW;
}

async function loadFlows(urls) {
  const results = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`No se pudo cargar flow: ${url}`);
      const raw = await res.json();
      const parsed = parseFlowLike(raw, url);
      return { url, raw, nodes: parsed.nodes, connections: parsed.connections, sourceByNodeId: parsed.sourceByNodeId };
    })
  );

  const mergedNodes = [];
  const mergedConnections = [];

  const seenIds = new Map(); // id -> url
  const sourceByNodeId = {};

  for (const r of results) {
    for (const n of r.nodes) {
      if (!n || !n.id) continue;
      const id = String(n.id);

      if (seenIds.has(id)) {
        const first = seenIds.get(id);
        throw new Error(
          `ID duplicado en flows: "${id}" aparece en:\n- ${first}\n- ${r.url}\n\nSolución: renombra el id en UNO de los JSON (no en los dos).`
        );
      }

      seenIds.set(id, r.url);
      sourceByNodeId[id] = r.url;
      mergedNodes.push(n);
    }

    for (const c of r.connections) mergedConnections.push(c);
  }

  const wantDedupe = Boolean(CONFIG.FLOW_SPECIAL?.DEDUPE_CONNECTIONS);
  const finalConnections = wantDedupe
    ? dedupeConnections(mergedConnections)
    : cleanConnections(mergedConnections);

  FLOW = buildFlowIndex({
    raw: results.map((x) => x.raw),
    nodes: mergedNodes,
    connections: finalConnections,
    sourceByNodeId,
  });

  validateFlowGraph(FLOW);
  if (CONFIG.DEBUG?.FLOW) console.log("[flow] loaded (multi)", { nodes: Object.keys(FLOW.nodeMap).length, edges: (FLOW.connections || []).length });
  return FLOW;
}

function parseFlowLike(raw, urlLabel = "flow") {
  const nodes =
    (Array.isArray(raw?.nodes) && raw.nodes) ||
    (Array.isArray(raw?.data?.nodes) && raw.data.nodes) ||
    (Array.isArray(raw?.flow?.nodes) && raw.flow.nodes) ||
    null;

  const connections =
    (Array.isArray(raw?.connections) && raw.connections) ||
    (Array.isArray(raw?.edges) && raw.edges) ||
    (Array.isArray(raw?.data?.connections) && raw.data.connections) ||
    (Array.isArray(raw?.data?.edges) && raw.data.edges) ||
    (Array.isArray(raw?.flow?.connections) && raw.flow.connections) ||
    (Array.isArray(raw?.flow?.edges) && raw.flow.edges) ||
    null;

  if (!nodes || !connections) {
    throw new Error(`${urlLabel} no tiene {nodes, connections} (o equivalente)`);
  }

  const sourceByNodeId = {};
  nodes.forEach((n) => {
    if (n?.id) sourceByNodeId[String(n.id)] = urlLabel;
  });

  return { nodes, connections, sourceByNodeId };
}

function buildFlowIndex({ raw, nodes, connections, sourceByNodeId }) {
  const nodeMap = {};
  nodes.forEach((n) => {
    if (!n || !n.id) return;
    nodeMap[n.id] = n;
  });

  const edgesFrom = {};
  const edgeMeta = {};

  connections.forEach((c) => {
    const source = readEdgeSource(c);
    const target = readEdgeTarget(c);
    if (!source || !target) return;

    if (!edgesFrom[source]) edgesFrom[source] = [];
    edgesFrom[source].push(target); // keep duplicates (index mapping)

    if (!edgeMeta[source]) edgeMeta[source] = [];
    edgeMeta[source].push({ targetId: target, rawEdge: c });
  });

  const webhook =
    nodes.find((n) => String(n.type || "").toLowerCase() === "webhook") ||
    nodes.find((n) => /webhook/i.test(String(n.name || "")));

  if (!webhook) throw new Error("No se encontró nodo webhook (router debe tenerlo)");

  const startTargets = edgesFrom[webhook.id];
  if (!startTargets?.length) throw new Error("El webhook no tiene salida");

  return {
    raw,
    nodes,
    connections,
    nodeMap,
    edgesFrom,
    edgeMeta,
    startNodeId: startTargets[0],
    sourceByNodeId: sourceByNodeId || {},
  };
}

/* =========================
   CONNECTION CLEANUP
========================= */
function cleanConnections(connections) {
  const out = [];
  for (const c of connections || []) {
    const source = readEdgeSource(c);
    const target = readEdgeTarget(c);
    if (!source || !target) continue;
    out.push(c);
  }
  return out;
}

function dedupeConnections(connections) {
  const out = [];
  const seen = new Set();

  for (const c of connections || []) {
    const source = readEdgeSource(c);
    const target = readEdgeTarget(c);
    if (!source || !target) continue;

    const key = `${source}=>${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function readEdgeSource(c) {
  return (
    c?.source ??
    c?.from ??
    c?.sourceId ??
    c?.sourceNodeId ??
    c?.source_node_id ??
    c?.sourceNode ??
    c?.fromNodeId ??
    null
  );
}

function readEdgeTarget(c) {
  return (
    c?.target ??
    c?.to ??
    c?.targetId ??
    c?.targetNodeId ??
    c?.target_node_id ??
    c?.targetNode ??
    c?.toNodeId ??
    null
  );
}

/* =========================
   FLOW VALIDATION (warnings only)
========================= */
function validateFlowGraph(flow) {
  if (!flow?.nodeMap) return;

  const warn = (...args) => {
    if (CONFIG.DEBUG?.FLOW) console.warn(...args);
  };

  for (const [src, targets] of Object.entries(flow.edgesFrom || {})) {
    if (!flow.nodeMap[src]) {
      warn(`[flow] edge source missing: ${src} (source file=${flow.sourceByNodeId?.[src] || "?"})`);
    }
    for (const t of targets || []) {
      if (!flow.nodeMap[t]) {
        warn(`[flow] edge target missing: ${src} -> ${t} (src file=${flow.sourceByNodeId?.[src] || "?"})`);
      }
    }
  }

  for (const nodeId of Object.keys(flow.nodeMap)) {
    const node = flow.nodeMap[nodeId];
    if (node?.type !== "autobotAction") continue;

    const p = getNodeOptions(node);
    const options = normalizeOptions(p.options);
    const nextIds = flow.edgesFrom?.[nodeId] || [];

    const usesButtons = Boolean(options.length) && (p.allowFreeText === false || Boolean(p.waitResponse));
    if (usesButtons && options.length && nextIds.length && options.length !== nextIds.length) {
      const src = flow.sourceByNodeId?.[nodeId] || "?";
      warn(
        `[flow] mismatch options vs edges: node=${nodeId} options=${options.length} edges=${nextIds.length} (src=${src})`,
        { options: options.map((o) => o.label), edges: nextIds.slice() }
      );
    }
  }
}

/* =========================
   PUBLIC API
========================= */
export function startFlow(state) {
  if (!FLOW) throw new Error("Flujo no cargado");
  state.currentNodeId = FLOW.startNodeId;
  state.awaitingNodeId = null;
  state.lastUserText = "";
  ensureProgressState(state);
  return safeRun(state.currentNodeId, state);
}

export function runNode(nodeId, state) {
  if (!FLOW) throw new Error("Flujo no cargado");
  ensureProgressState(state);
  return safeRun(nodeId, state);
}

export function relocalizeHistory(state) {
  if (!FLOW || !Array.isArray(state?.history)) return state;

  state.history = state.history.map((msg) => {
    if (!msg || msg.from !== "bot") return msg;

    const nodeId = msg?._flow?.nodeId;
    if (!nodeId) return msg;

    const node = getNode(nodeId);
    if (!node) return msg;

    if (msg?._flow?.buttonsOnly) {
      return buildButtonsOnlyFallback(node, state, msg);
    }

    return buildAutobotReply(node, state, msg);
  });

  return state;
}

/**
 * handleUserInput recibe texto normalizado (o label de chip).
 * Nota: La UI manda clicks de chip como input también.
 */
export function handleUserInput(text, state) {
  ensureProgressState(state);

  const clean = normalize(text);
  state.lastUserText = clean;

  // 0) Acciones globales por texto (menú, whatsapp, reset, faq)
  const action = matchGlobalAction(clean);
  if (action) return handleGlobalAction(action, state);

  // 1) Si hay un nodo esperando respuesta, lo procesamos ahí
  if (state.awaitingNodeId) {
    return handleAwaitedResponse(clean, state);
  }

  // 2) Si estamos en un nodo autobotAction, intentamos match contra sus options
  const node = getNode(state.currentNodeId);
  if (node?.type === "autobotAction") {
    const options = getAutobotOptions(node, state);
    const nextIds = getNext(node.id);
    const allowFreeText = isFreeTextAllowed(node);

    const match = matchOptionsToTargets(clean, options, nextIds);
    if (match) {
      if (match.type === "global") return handleGlobalAction(match.action, state);
      if (match.type === "node") return safeRun(match.targetNodeId, state);
    }

    // Si no permite texto y hay opciones, devolvemos fallback y seteamos awaiting
    const smartFallback = Boolean(CONFIG.UX?.ALLOW_SMART_FALLBACK_ON_OPTION_NODES);
    if (!allowFreeText && options?.length) {
      state.awaitingNodeId = node.id;

      if (smartFallback) {
        const fuzzy = fuzzyMatchOptionToTargets(clean, options, nextIds);
        if (fuzzy) {
          if (fuzzy.type === "global") return handleGlobalAction(fuzzy.action, state);
          if (fuzzy.type === "node") return safeRun(fuzzy.targetNodeId, state);
        }
      }

      return buildButtonsOnlyFallback(node, state);
    }

    // Si no hay match pero solo hay 1 salida, avanzamos
    if (nextIds?.length === 1) return safeRun(nextIds[0], state);
  }
  return makeBotMessage(
    flowText(
      state,
      "notUnderstood",
      "No te entendi del todo. Usa los botones, o escribe 'menu' para volver."
    )
  );

  return makeBotMessage("No te entendí del todo 😅 Usa los botones, o escribe “menú” para volver.");
}

/* =========================
   SAFE RUN (previene loops)
========================= */
function safeRun(startNodeId, state) {
  let nodeId = startNodeId;
  let steps = 0;

  while (nodeId && steps < MAX_STEPS_PER_TURN) {
    steps++;

    const node = getNode(nodeId);
    if (!node) {
      const src = FLOW?.sourceByNodeId?.[nodeId] ? ` (desde ${FLOW.sourceByNodeId[nodeId]})` : "";
      return makeBotMessage(
        `${flowText(state, "missingNode", "Ups... no encontre ese paso.")} (${nodeId})${src}`
      );
      return makeBotMessage(`Ups… no encontré ese nodo 😅 (${nodeId})${src}`);
    }

    state.currentNodeId = nodeId;

    if (shouldSkipNode(node)) {
      const out = getNext(nodeId);
      if (CONFIG.DEBUG?.FLOW) console.log("[flow] skip node", nodeId, node?.name, "->", out?.[0]);
      nodeId = out?.[0] || null;
      continue;
    }

    if (node.type === "filter") {
      const next = handleFilterInternal(node, state);
      if (typeof next === "string") {
        nodeId = next;
        continue;
      }
      return next;
    }

    if (node.type === "autobotAction") return handleAutobotAction(node, state);
    if (node.type === "transferConversation") return handleTransfer(node, state);

    // Otros nodos: seguimos primer edge si existe
    const out = getNext(nodeId);
    if (out?.length) {
      nodeId = out[0];
      continue;
    }
    return makeBotMessage(
      `${flowText(state, "unsupportedNode", "Este tipo de nodo aun no esta soportado:")} ${node.type}`
    );

    return makeBotMessage(`Este tipo de nodo aún no está soportado: ${node.type} 🤖`);
  }

  if (steps >= MAX_STEPS_PER_TURN) {
    console.warn("[flow] detenido por posible loop. Node:", nodeId);
    return makeBotMessage(
      flowText(
        state,
        "loopDetected",
        "Me quede dando vueltas. Toca 'menu' para reiniciar el hilo."
      )
    );
  return makeBotMessage("Me quedé dando vueltas 😵‍💫 Toca “menú” para reiniciar el hilo.");
  }

  return makeBotMessage("Ok 😊");
}

/* =========================
   NODE HANDLERS
========================= */
function handleAutobotAction(node, state) {
  const p = getNodeOptions(node, state);

  const typeMessage = String(p.typeMessage || "").trim().toLowerCase();
  const textRaw = String(p.textMessage || p.message || "").trim();

  // Opciones del nodo (chips), con gating UX (WhatsApp solo al cierre)
  const options = gateOptionsForUX(normalizeOptions(p.options), node, state);

  const wait = Boolean(p.waitResponse);
  state.awaitingNodeId = wait ? node.id : null;

  const media = p.hideMedia ? [] : extractMediaFromAutobotOptions(p);

  let text =
    textRaw ||
    (typeMessage === "audio" ? "🎧 Reproduciendo audio…" : "") ||
    (media.length ? "📎 Te comparto un archivo…" : "");

  text =
    textRaw ||
    (typeMessage === "audio"
      ? flowText(state, "playingAudio", "Reproduciendo audio...")
      : "") ||
    (media.length
      ? flowText(state, "sharingFile", "Te comparto un archivo...")
      : "");

  // Progress trace (para resumen luego)
  updateProgress(state, node);

  // ✅ FIX v4.3.0: preservar options completas (no solo labels)
  // Para compatibilidad: también generamos labels fallback.
  const msg = makeBotMessage(text, options.map((o) => o.label));
  msg.options = options.map((o) => ({
    label: o.label,
    value: o.value,
    kind: o.kind || "option"
  }));

  if (media.length) msg.media = media;

  const allowFreeText = isFreeTextAllowed(node);
  const isClosing = allowWhatsAppNow(node, state) || isCierreNode(node);

  msg._flow = {
    nodeId: node.id,
    nodeName: String(node.name || ""),
    allowFreeText,
    hasOptions: Boolean(options.length),
    source: FLOW?.sourceByNodeId?.[node.id] || null,
    waitResponse: wait,
    isClosing
  };

  if (CONFIG.DEBUG?.FLOW) {
    console.log("[flow] autobotAction", node.id, {
      text: text.slice(0, 120),
      options: msg.options.map((o) => ({ label: o.label, kind: o.kind, value: o.value })),
      mediaCount: media.length,
      wait,
      allowFreeText,
      src: msg._flow.source
    });
  }

  return msg;
}

function buildAutobotReply(node, state, seed = null) {
  const p = getNodeOptions(node, state);
  const typeMessage = String(p.typeMessage || "").trim().toLowerCase();
  const textRaw = String(p.textMessage || p.message || "").trim();
  const options = gateOptionsForUX(normalizeOptions(p.options), node, state);
  const wait = Boolean(p.waitResponse);
  const media = p.hideMedia ? [] : extractMediaFromAutobotOptions(p);

  const text =
    textRaw ||
    (typeMessage === "audio"
      ? flowText(state, "playingAudio", "Reproduciendo audio...")
      : "") ||
    (media.length
      ? flowText(state, "sharingFile", "Te comparto un archivo...")
      : "");

  const msg = seed
    ? { ...seed, text }
    : makeBotMessage(text, options.map((o) => o.label));

  msg.options = options.map((o) => ({
    label: o.label,
    value: o.value,
    kind: o.kind || "option"
  }));

  if (media.length) msg.media = media;
  else delete msg.media;

  const allowFreeText = isFreeTextAllowed(node);
  const isClosing = allowWhatsAppNow(node, state) || isCierreNode(node);

  msg._flow = {
    nodeId: node.id,
    nodeName: String(node.name || ""),
    allowFreeText,
    hasOptions: Boolean(options.length),
    source: FLOW?.sourceByNodeId?.[node.id] || null,
    waitResponse: wait,
    isClosing
  };

  return msg;
}

/* =========================
   UX GATING (WhatsApp solo al cierre)
========================= */
function isWhatsAppOption(opt) {
  const kind = String(opt?.kind || "").toLowerCase().trim();
  const value = String(opt?.value || "").toUpperCase().trim();
  const label = String(opt?.label || "").toLowerCase();
  return kind === "global:whatsapp" || value === "WHATSAPP" || label.includes("whatsapp");
}

function isCierreNode(node) {
  const name = String(node?.name || "").toLowerCase();
  if (!name) return false;
  const re = CONFIG.WHATSAPP_GATE?.ALLOW_NODE_NAME_RE
    ? new RegExp(CONFIG.WHATSAPP_GATE.ALLOW_NODE_NAME_RE, "i")
    : /\bcierre\b|\bfinal\b|\binscrip\b/i;
  return re.test(name);
}

function isMenuLikeOption(opt) {
  const aliases = Array.isArray(CONFIG.MATCHING?.ALIASES?.MENU)
    ? CONFIG.MATCHING.ALIASES.MENU
    : [];

  const values = [
    normalize(String(opt?.value || "")),
    normalize(String(opt?.label || ""))
  ].filter(Boolean);

  return values.some((v) => {
    if (v === "menu" || v === "home" || v === "main menu") return true;

    return aliases.some((alias) => {
      const a = normalize(String(alias || ""));
      if (!a) return false;
      return v === a || wordBoundaryIncludes(v, a);
    });
  });
}

function isFinalWhatsAppNode(node, state) {
  const options = getAutobotOptions(node, state);
  if (!options.length) return false;

  const waOptions = options.filter((o) => isWhatsAppOption(o));
  if (!waOptions.length) return false;

  const nonWaOptions = options.filter((o) => !isWhatsAppOption(o));
  if (!nonWaOptions.length) return true;

  return nonWaOptions.every((o) => isMenuLikeOption(o));
}

function allowWhatsAppNow(node, state) {
  if (isCierreNode(node)) return true;
  if (isFinalWhatsAppNode(node, state)) return true;

  // señal “suave”: si el progreso ya está en cierre
  const progName = String(state?.progress?.lastNodeName || "").toLowerCase();
  if (/\bcierre\b|\bfinal\b|\binscrip\b/i.test(progName)) return true;

  // flag configurable: memory path (true)
  const flagPath = CONFIG.WHATSAPP_GATE?.ALLOW_WHEN_FLAG_PATH;
  if (flagPath) {
    const v = getMemoryByPath(state, flagPath);
    if (v === true || v === "true") return true;
  }

  return false;
}

function gateOptionsForUX(options, node, state) {
  if (!Array.isArray(options) || !options.length) return [];
  if (!allowWhatsAppNow(node, state)) return options.filter((o) => !isWhatsAppOption(o));
  return options;
}

/* =========================
   FILTER
========================= */
function handleFilterInternal(node, state) {
  const p = getNodeOptions(node);

  const conditions = Array.isArray(p.filterConditions) ? p.filterConditions : [];
  const def =
    p?.filterDefaultCondition?.targetNodeId ||
    p?.filterDefaultCondition?.targetId ||
    p?.defaultTargetNodeId ||
    p?.defaultTargetId ||
    null;

  const last = state.lastUserText || "";

  for (const c of conditions) {
    const op = String(c.operator || "").trim();
    const target = c.targetNodeId || c.targetId || c.to;
    if (!target) continue;

    const right = normalize(c.value ?? "");
    const ok = evalOperator(op, last, right);

    if (ok) {
      if (c.storeResponseInMemory && c.labelInMemory) {
        setMemoryByPath(state, String(c.labelInMemory), last);
      }

      if (!getNode(target)) {
        const src = FLOW?.sourceByNodeId?.[node.id] || "?";
        console.warn(`[flow] filter target missing: node=${node.id} -> ${target} (src=${src})`, c);
      } else {
        if (CONFIG.DEBUG?.FLOW) console.log("[flow] filter route", node.id, "->", target, { op, right });
        return target;
      }
    }
  }

  if (def) {
    if (!getNode(def)) {
      const src = FLOW?.sourceByNodeId?.[node.id] || "?";
      console.warn(`[flow] filter default target missing: node=${node.id} -> ${def} (src=${src})`);
    } else {
      if (CONFIG.DEBUG?.FLOW) console.log("[flow] filter default", node.id, "->", def);
      return def;
    }
  }

  const next = getNext(node.id);
  if (next?.length) {
    if (!getNode(next[0])) {
      const src = FLOW?.sourceByNodeId?.[node.id] || "?";
      console.warn(`[flow] filter fallback edge target missing: node=${node.id} -> ${next[0]} (src=${src})`);
    } else {
      if (CONFIG.DEBUG?.FLOW) console.log("[flow] filter fallback edge", node.id, "->", next[0]);
      return next[0];
    }
  }

  return makeBotMessage("No encontré a dónde rutear 😅");
}

/* =========================
   TRANSFER
========================= */
function handleTransfer(node, state) {
  const p = getNodeOptions(node);
  const text = String(p.onlineMessage || p.textMessage || "").trim() || "Listo ✅ Te paso con un humano.";
  state.awaitingNodeId = null;
  updateProgress(state, node);
  return makeBotMessage(text);
}

/* =========================
   RESPONSE HANDLING (waitResponse)
========================= */
function handleAwaitedResponse(cleanText, state) {
  const awaiting = getNode(state.awaitingNodeId);
  const awaitingId = state.awaitingNodeId;
  state.awaitingNodeId = null;

  state.lastUserText = cleanText;

  if (CONFIG.DEBUG?.FLOW) console.log("[flow] awaitedResponse", awaitingId, cleanText);

  if (awaiting?.type === "autobotAction") {
    const options = getAutobotOptions(awaiting, state);
    const next = getNext(awaiting.id);
    const allowFreeText = isFreeTextAllowed(awaiting);

    const match = matchOptionsToTargets(cleanText, options, next);
    if (match) {
      if (match.type === "global") return handleGlobalAction(match.action, state);
      if (match.type === "node") return safeRun(match.targetNodeId, state);
    }

    const smartFallback = Boolean(CONFIG.UX?.ALLOW_SMART_FALLBACK_ON_OPTION_NODES);
    if (!allowFreeText && options?.length) {
      state.awaitingNodeId = awaiting.id;

      if (smartFallback) {
        const fuzzy = fuzzyMatchOptionToTargets(cleanText, options, next);
        if (fuzzy) {
          if (fuzzy.type === "global") return handleGlobalAction(fuzzy.action, state);
          if (fuzzy.type === "node") return safeRun(fuzzy.targetNodeId, state);
        }
      }

      return buildButtonsOnlyFallback(awaiting, state);
    }

    if (next?.length) return safeRun(next[0], state);
    return makeBotMessage(flowText(state, "doneWhatElse", "Listo. Que mas necesitas?"));
    return makeBotMessage("Listo 😊 ¿Qué más necesitas?");
  }

  return makeBotMessage("Ok 😊");
}

/* =========================
   GLOBAL ACTIONS
========================= */
function matchGlobalAction(cleanText) {
  if (!CONFIG.GLOBAL_ACTIONS?.ENABLED) return null;

  const aliases = CONFIG.MATCHING?.ALIASES || {};
  for (const action in aliases) {
    const hits = aliases[action] || [];
    for (const k of hits) {
      const kk = normalize(k);
      if (!kk) continue;
      if (cleanText === kk) return action;
      if (wordBoundaryIncludes(cleanText, kk)) return action;
    }
  }
  return null;
}

function wordBoundaryIncludes(text, needle) {
  const tokens = String(text).split(" ").filter(Boolean);
  const needleTokens = String(needle).split(" ").filter(Boolean);

  if (!needleTokens.length) return false;
  if (needleTokens.length === 1) return tokens.includes(needleTokens[0]);

  for (let i = 0; i <= tokens.length - needleTokens.length; i++) {
    let ok = true;
    for (let j = 0; j < needleTokens.length; j++) {
      if (tokens[i + j] !== needleTokens[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function handleGlobalAction(action, state) {
  switch (action) {
    case "MENU":
      return goHome(state);

    case "RESET":
      state.awaitingNodeId = null;
      state.lastUserText = "";
      return startFlow(state);

    case "FAQ":
      return makeBotMessage(flowText(state, "faqPrompt", "Dale click en FAQ en el panel de ayuda."));
      return makeBotMessage("Dale click a ‘Preguntas frecuentes’ en el panel de ayuda 👇");

    case "WHATSAPP": {
      const currentNode = getNode(state?.currentNodeId);
      const advisorIntent = isAdvisorIntentText(state?.lastUserText || "");
      if (advisorIntent) {
        return makeWhatsAppReadyMessage(state, "advisor");
      }
      if (!allowWhatsAppNow(currentNode, state)) {
        return makeBotMessage(
          flowText(
            state,
            "whatsappLater",
            "Te paso a WhatsApp al final para mandarlo todo ordenado.\n\nSigamos con estos 1-2 pasos y ya aparece el boton."
          )
        );
        return makeBotMessage(
          "Te paso a WhatsApp al final para mandarlo todo ordenado ✅\n\nSigamos con estos 1-2 pasitos y ya te aparece el botón 💬"
        );
      }
      return makeBotMessage("Listo 💬 Dale al botón de WhatsApp y te llevo directo. Ya tengo tu info y el punto donde vas ✅");
    }

    default:
      return makeBotMessage(flowText(state, "defaultMenu", "Ok... menu?"));
      return makeBotMessage("Ok… ¿menú? 😅");
  }
}

function goHome(state) {
  const homeId = CONFIG.FLOW_SPECIAL?.HOME_NODE_ID;
  if (homeId && getNode(homeId)) return safeRun(homeId, state);
  return startFlow(state);
}

/* =========================
   SKIP NODES
========================= */
function shouldSkipNode(node) {
  const skip = CONFIG.FLOW_SPECIAL?.SKIP_NODE_IDS;
  if (Array.isArray(skip) && skip.includes(node.id)) return true;
  return false;
}

/* =========================
   MATCHING OPTIONS → TARGETS
========================= */
function getAutobotOptions(node, state) {
  const p = getNodeOptions(node, state);
  return normalizeOptions(p.options);
}

/**
 * Returns:
 *  - null
 *  - { type:"node", targetNodeId }
 *  - { type:"global", action:"WHATSAPP"|"MENU"|... }
 */
function matchOptionsToTargets(cleanText, options, nextIds) {
  if (!options?.length) return null;
  const safeNext = Array.isArray(nextIds) ? nextIds : [];

  // 0) Choice por número: "1" -> primera opción
  const n = parseChoiceNumber(cleanText);
  if (n != null) {
    const idx = n - 1;
    const opt = options[idx];
    if (opt) {
      const ga = readGlobalActionFromOption(opt);
      if (ga) return { type: "global", action: ga };
      if (safeNext[idx]) return { type: "node", targetNodeId: safeNext[idx] };
      // Si no hay edge en ese índice, caemos a no-match
    }
  }

  const clean = normalizeForMatch(cleanText);

  // 1) Exact match con label/value
  const idxExact = options.findIndex((o) => {
    const v = normalizeForMatch(o.value);
    const l = normalizeForMatch(o.label);
    return (v && v === clean) || (l && l === clean);
  });

  if (idxExact >= 0) {
    const opt = options[idxExact];
    const ga = readGlobalActionFromOption(opt);
    if (ga) return { type: "global", action: ga };
    if (safeNext[idxExact]) return { type: "node", targetNodeId: safeNext[idxExact] };
    return null;
  }

  // 1.5) Match por fragmento util del texto: "piano" -> "Piano/Teclado"
  const idxFragment = findBestFragmentOptionIndex(clean, options);
  if (idxFragment >= 0) {
    const opt = options[idxFragment];
    const ga = readGlobalActionFromOption(opt);
    if (ga) return { type: "global", action: ga };
    if (safeNext[idxFragment]) return { type: "node", targetNodeId: safeNext[idxFragment] };
    return null;
  }

  // 2) Contains match
  const idxContains = options.findIndex((o) => {
    const v = normalizeForMatch(o.value);
    const l = normalizeForMatch(o.label);
    return (v && clean.includes(v)) || (l && clean.includes(l));
  });

  if (idxContains >= 0) {
    const opt = options[idxContains];
    const ga = readGlobalActionFromOption(opt);
    if (ga) return { type: "global", action: ga };
    if (safeNext[idxContains]) return { type: "node", targetNodeId: safeNext[idxContains] };
    return null;
  }

  return null;
}

function fuzzyMatchOptionToTargets(cleanText, options, nextIds) {
  if (!options?.length) return null;
  const safeNext = Array.isArray(nextIds) ? nextIds : [];

  const clean = normalizeForMatch(cleanText);
  const tokens = clean.split(" ").filter(Boolean);
  if (!tokens.length) return null;

  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    const label = normalizeForMatch(o.label);
    const value = normalizeForMatch(o.value);
    const hay = (label + " " + value).trim();
    if (!hay) continue;

    const score = tokenOverlapScore(tokens, hay.split(" ").filter(Boolean));
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const threshold = Number(CONFIG.MATCHING?.THRESHOLDS?.TOKEN_SIMILARITY ?? 0.56);
  if (bestIdx >= 0 && bestScore >= threshold) {
    const opt = options[bestIdx];
    const ga = readGlobalActionFromOption(opt);
    if (ga) return { type: "global", action: ga };
    if (safeNext[bestIdx]) return { type: "node", targetNodeId: safeNext[bestIdx] };
  }

  return null;
}

function tokenOverlapScore(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const denom = Math.max(a.size, b.size) || 1;
  return inter / denom;
}

function readGlobalActionFromOption(opt) {
  const kind = String(opt?.kind || "").trim();
  if (kind.toLowerCase().startsWith("global:")) {
    const action = kind.split(":")[1] || "";
    const upper = String(action).trim().toUpperCase();
    return upper || null;
  }

  const v = String(opt?.value || "").trim().toUpperCase();
  const actionIds = CONFIG.GLOBAL_ACTIONS?.ACTION_IDS || {};
  const known = new Set(Object.values(actionIds).map((x) => String(x).toUpperCase()));
  if (known.has(v)) return v;

  return null;
}

function tokenizeOptionText(text = "") {
  return normalizeForMatch(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scoreOptionFragmentAgainstText(cleanText, haystackText = "") {
  const clean = normalizeForMatch(cleanText);
  const haystack = normalizeForMatch(haystackText);
  if (!clean || !haystack || clean.length < 3) return 0;

  const cleanTokens = tokenizeOptionText(clean);
  const hayTokens = tokenizeOptionText(haystack);
  if (!cleanTokens.length || !hayTokens.length) return 0;

  const shared = cleanTokens.filter((token) => hayTokens.includes(token));
  const prefixShared = cleanTokens.filter((token) =>
    hayTokens.some((hayToken) => hayToken.startsWith(token) || token.startsWith(hayToken))
  );

  let score = 0;

  if (shared.length) {
    const coverage = shared.length / cleanTokens.length;
    const precision = shared.length / hayTokens.length;
    score = Math.round((coverage * 100) + (precision * 30));
    if (coverage === 1) score += 20;
    if (clean.length >= 4 && haystack.includes(clean)) score += 20;
  } else if (
    prefixShared.length === cleanTokens.length &&
    cleanTokens.every((token) => token.length >= 4)
  ) {
    const precision = prefixShared.length / hayTokens.length;
    score = Math.round(88 + (precision * 18));
  }

  if (cleanTokens.length === 1 && cleanTokens[0].length >= 4) {
    const token = cleanTokens[0];
    if (hayTokens.includes(token)) score += 25;
    else if (hayTokens.some((hayToken) => hayToken.startsWith(token))) score += 14;
  }

  return score;
}

function scoreOptionFragmentMatch(cleanText, option) {
  return Math.max(
    scoreOptionFragmentAgainstText(cleanText, option?.label || ""),
    scoreOptionFragmentAgainstText(cleanText, option?.value || "")
  );
}

function findBestFragmentOptionIndex(cleanText, options) {
  if (!Array.isArray(options) || !options.length) return -1;

  const ranked = options
    .map((option, idx) => ({
      idx,
      score: scoreOptionFragmentMatch(cleanText, option)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return -1;

  const best = ranked[0];
  const second = ranked[1];
  if (best.score < 88) return -1;
  if (second && (best.score - second.score) < 18) return -1;

  return best.idx;
}

function normalizeForMatch(s) {
  let t = normalize(s || "");
  t = t.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
  return t;
}

function parseChoiceNumber(cleanText) {
  const numericText = String(cleanText || "").trim();
  const m = numericText.match(/^(?:opcion|option|numero|number|respuesta)?\s*#?(\d{1,2})$/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const map = {
    uno: 1,
    one: 1,
    primera: 1,
    primero: 1,
    dos: 2,
    two: 2,
    segunda: 2,
    segundo: 2,
    tres: 3,
    three: 3,
    tercera: 3,
    tercero: 3,
    cuatro: 4,
    four: 4,
    cuarta: 4,
    cuarto: 4,
    cinco: 5,
    five: 5,
    quinta: 5,
    quinto: 5,
    seis: 6,
    six: 6,
    sexta: 6,
    sexto: 6,
    siete: 7,
    seven: 7,
    septima: 7,
    septimo: 7,
    ocho: 8,
    eight: 8,
    novena: 9,
    noveno: 9,
    nueve: 9,
    nine: 9,
    decima: 10,
    decimo: 10,
    diez: 10,
    ten: 10
  };
  for (const k in map) {
    if (numericText === k || wordBoundaryIncludes(numericText, k)) return map[k];
  }
  return null;
}

/* =========================
   OPERATORS
========================= */
function evalOperator(opRaw, leftRaw, rightRaw) {
  const op = String(opRaw || "");
  const left = String(leftRaw || "");
  const right = String(rightRaw || "");

  const ln = toNumberMaybe(left);
  const rn = toNumberMaybe(right);

  switch (op) {
    case "equalsCaseInsensitive":
    case "equals":
      return left === right;

    case "notEqualsCaseInsensitive":
    case "notEquals":
      return left !== right;

    case "containsCaseInsensitive":
    case "contains":
      return right ? left.includes(right) : false;

    case "startsWithCaseInsensitive":
    case "startsWith":
      return right ? left.startsWith(right) : false;

    case "endsWithCaseInsensitive":
    case "endsWith":
      return right ? left.endsWith(right) : false;

    case "matchesRegexCaseInsensitive":
    case "matchesRegex": {
      try {
        const re = new RegExp(right, "i");
        return re.test(left);
      } catch {
        return false;
      }
    }

    case "isEmpty":
      return !left.trim();

    case "notEmpty":
      return Boolean(left.trim());

    case "alwaysTrue":
    case "always":
      return true;

    case "gt":
      return ln != null && rn != null ? ln > rn : false;
    case "gte":
      return ln != null && rn != null ? ln >= rn : false;
    case "lt":
      return ln != null && rn != null ? ln < rn : false;
    case "lte":
      return ln != null && rn != null ? ln <= rn : false;

    default:
      return false;
  }
}

function toNumberMaybe(s) {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* =========================
   FREE TEXT RULES
========================= */
function isFreeTextAllowed(node) {
  const p = getNodeOptions(node);
  const explicit = p?.allowFreeText;

  if (explicit === true) return true;
  if (explicit === false) return false;

  const opts = normalizeOptions(p.options);
  if (opts.length) return false;
  return true;
}

function buildButtonsOnlyFallback(node, state, seed = null) {
  const p = getNodeOptions(node, state);
  const opts = normalizeOptions(p.options);

  let fallbackText =
    String(p.buttonsOnlyMessage || "").trim() ||
    "Para continuar, elige una opcion con los botones, escribe el nombre o envia el numero.";

  // ✅ Aquí también preservamos options completas
  fallbackText =
    String(p.buttonsOnlyMessage || "").trim() ||
    flowText(state, "buttonsOnly", "Para continuar, elige una opcion con los botones, escribe el nombre o envia el numero.");

  const msg = seed
    ? { ...seed, text: fallbackText }
    : makeBotMessage(fallbackText, opts.map((o) => o.label));
  msg.options = opts.map(o => ({ label: o.label, value: o.value, kind: o.kind || "option" }));
  msg._flow = { nodeId: node.id, buttonsOnly: true, allowFreeText: false };
  return msg;
}

/* =========================
   HELPERS
========================= */
function getNode(id) {
  return FLOW?.nodeMap?.[id] || null;
}

function getNext(id) {
  return FLOW?.edgesFrom?.[id] || [];
}

function getNodeOptions(node, state = null) {
  const base = getRawNodeOptions(node);
  const lang = getStateLang(state);
  const localized = { ...base };

  if (!state) {
    const seasonalText = getSeasonalVacationalText(node?.id, lang);
    if (seasonalText) localized.textMessage = seasonalText;
    return localized;
  }

  const translated = getNodeTranslation(node?.id, state);
  if (translated) {
    if (typeof translated.text === "string") localized.textMessage = translated.text;
    if (typeof translated.message === "string") localized.message = translated.message;
    if (typeof translated.onlineMessage === "string") localized.onlineMessage = translated.onlineMessage;
    if (typeof translated.buttonsOnlyMessage === "string") localized.buttonsOnlyMessage = translated.buttonsOnlyMessage;
    if (translated.hideMedia === true) localized.hideMedia = true;
    if (Array.isArray(translated.media)) localized.media = translated.media;

    if (Array.isArray(base.options) && Array.isArray(translated.options)) {
      localized.options = localizeNodeOptions(base.options, translated.options);
    }
  }

  const seasonalText = getSeasonalVacationalText(node?.id, lang);
  if (seasonalText) localized.textMessage = seasonalText;

  return localized;
}

function normalize(text = "") {
  let t = String(text);

  if (CONFIG.NORMALIZE?.TRIM !== false) t = t.trim();
  if (CONFIG.NORMALIZE?.LOWERCASE !== false) t = t.toLowerCase();

  if (CONFIG.NORMALIZE?.REMOVE_ACCENTS !== false) {
    try {
      t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch {}
  }

  if (CONFIG.NORMALIZE?.COLLAPSE_SPACES !== false) {
    t = t.replace(/\s+/g, " ");
  }

  if (CONFIG.NORMALIZE?.REMOVE_PUNCTUATION) {
    t = t.replace(/[.,;:!?¡¿()[\]{}"'`~^*_=<>/\\|+-]/g, " ");
    t = t.replace(/\s+/g, " ").trim();
  }

  return t;
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => {
      if (typeof o === "string") {
        const s = o.trim();
        return s ? { label: s, value: s, kind: null } : null;
      }
      if (o && typeof o === "object") {
        const label = String(o.label || o.text || o.value || "").trim();
        const value = String(o.value ?? label).trim();
        const kind = o.kind != null ? String(o.kind).trim() : null;
        if (!label) return null;
        return { label, value, kind };
      }
      return null;
    })
    .filter(Boolean);
}

/* =========================
   MEDIA
========================= */
function extractMediaFromAutobotOptions(p) {
  const mediaList = [];

  pushMediaAny(mediaList, p.media);
  pushMediaAny(mediaList, p.attachments);
  pushMediaAny(mediaList, p.files);

  pushMediaUrl(mediaList, "audio", p.audioSrc);
  pushMediaUrl(mediaList, "audio", p.audioUrl);

  pushMediaUrl(mediaList, "image", p.imageSrc);
  pushMediaUrl(mediaList, "image", p.imageUrl);

  pushMediaUrl(mediaList, "video", p.videoSrc);
  pushMediaUrl(mediaList, "video", p.videoUrl);

  const tm = String(p.typeMessage || "").toLowerCase().trim();
  if (tm === "audio") {
    const url = p.audioSrc || p.audioUrl || p.src || p.url;
    pushMediaUrl(mediaList, "audio", url);
  } else if (tm === "image") {
    const url = p.imageSrc || p.imageUrl || p.src || p.url;
    pushMediaUrl(mediaList, "image", url);
  } else if (tm === "video") {
    const url = p.videoSrc || p.videoUrl || p.src || p.url;
    pushMediaUrl(mediaList, "video", url);
  }

  const clean = mediaList.map((m) => normalizeOneMedia(m)).filter(Boolean);

  const seen = new Set();
  const unique = [];
  for (const m of clean) {
    const key = `${m.type}::${m.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(m);
  }

  return unique;
}

function pushMediaAny(out, media) {
  if (!media) return;
  const arr = Array.isArray(media) ? media : [media];
  arr.forEach((m) => out.push(m));
}

function pushMediaUrl(out, forcedType, url) {
  if (!url) return;
  out.push({ type: forcedType, url: String(url) });
}

function normalizeOneMedia(m) {
  if (!m) return null;

  if (typeof m === "string") {
    const url = m.trim();
    if (!url) return null;
    return { type: inferMediaType(url), url };
  }

  if (m && typeof m === "object") {
    const url = String(m.url || m.src || m.href || "").trim();
    if (!url) return null;
    const type = String(m.type || inferMediaType(url)).trim();
    return { type, url };
  }

  return null;
}

function inferMediaType(url = "") {
  const u = String(url).toLowerCase().split("?")[0];

  if (u.endsWith(".mp3") || u.endsWith(".wav") || u.endsWith(".ogg") || u.endsWith(".m4a")) return "audio";
  if (u.endsWith(".png") || u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".webp") || u.endsWith(".gif")) return "image";
  if (u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov")) return "video";
  return "link";
}

/* =========================
   MEMORY
========================= */
function setMemoryByPath(state, path, value) {
  if (!state.memory) state.memory = {};
  const parts = String(path || "")
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return;

  let obj = state.memory;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!obj[k] || typeof obj[k] !== "object") obj[k] = {};
    obj = obj[k];
  }
  obj[parts[parts.length - 1]] = value;
}

function getMemoryByPath(state, path) {
  const parts = String(path || "")
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return undefined;

  let obj = state?.memory;
  for (const k of parts) {
    if (obj == null || typeof obj !== "object") return undefined;
    obj = obj[k];
  }
  return obj;
}

/* =========================
   PROGRESS TRACE (para resumen)
========================= */
function ensureProgressState(state) {
  if (!state) return;
  if (!state.progress || typeof state.progress !== "object") {
    state.progress = {
      lastNodeId: null,
      lastNodeName: null,
      lastSource: null,
      updatedAt: null,
    };
  }
}

function updateProgress(state, node) {
  ensureProgressState(state);
  state.progress.lastNodeId = String(node?.id || "");
  state.progress.lastNodeName = String(node?.name || "");
  state.progress.lastSource = FLOW?.sourceByNodeId?.[node?.id] || null;
  state.progress.updatedAt = new Date().toISOString();
}
