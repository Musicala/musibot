// flowEngine.js (v3.9.0)
// ============================
// Motor REAL para webflow.json
// Tipos soportados:
// - webhook (solo para detectar inicio)
// - autobotAction (mensaje + opciones, waitResponse, media/audio/video/image)
// - filter (router por condiciones)
// - transferConversation (handoff)
//
// Mejoras v3.9.0:
// ✅ allowFreeText (por nodo) para forzar interacción SOLO por botones
//   - Se lee desde parameters.options.allowFreeText (true/false)
//   - Default inteligente: si hay opciones => false; si no hay opciones => true
// ✅ Si NO se permite texto y el usuario escribe algo que no coincide con opciones,
//    NO avanza y re-muestra un fallback "elige con los botones" (sin romper el flow)
// ✅ Mejor manejo cuando awaitingNodeId es un nodo con opciones (solo botones)
// ✅ Mantiene compatibilidad con v3.7 (media robusto, loops, tolerancia, etc.)
// ============================

import { CONFIG } from "./config.js";
import { makeBotMessage } from "./state.js";

/* =========================
   FLOW CACHE
========================= */
let FLOW = null;

const MAX_STEPS_PER_TURN = 30;

/* =========================
   LOAD FLOW
========================= */
export async function loadFlow() {
  const res = await fetch(CONFIG.FLOW_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar webflow.json");

  const raw = await res.json();

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
    throw new Error("webflow.json no tiene {nodes, connections} (o equivalente)");
  }

  const nodeMap = {};
  nodes.forEach((n) => {
    if (!n || !n.id) return;
    nodeMap[n.id] = n;
  });

  // edgesFrom: { [sourceId]: [targetId,...] }
  // edgeMeta:  { [sourceId]: [{targetId, rawEdge}, ...] }
  const edgesFrom = {};
  const edgeMeta = {};

  connections.forEach((c) => {
    const source =
      c?.source ??
      c?.from ??
      c?.sourceId ??
      c?.sourceNodeId ??
      c?.source_node_id ??
      c?.sourceNode ??
      c?.fromNodeId;

    const target =
      c?.target ??
      c?.to ??
      c?.targetId ??
      c?.targetNodeId ??
      c?.target_node_id ??
      c?.targetNode ??
      c?.toNodeId;

    if (!source || !target) return;

    if (!edgesFrom[source]) edgesFrom[source] = [];
    edgesFrom[source].push(target);

    if (!edgeMeta[source]) edgeMeta[source] = [];
    edgeMeta[source].push({ targetId: target, rawEdge: c });
  });

  // Buscar webhook (inicio)
  const webhook =
    nodes.find((n) => String(n.type || "").toLowerCase() === "webhook") ||
    nodes.find((n) => /webhook/i.test(String(n.name || "")));

  if (!webhook) throw new Error("No se encontró nodo webhook");

  const startTargets = edgesFrom[webhook.id];
  if (!startTargets?.length) throw new Error("El webhook no tiene salida");

  FLOW = {
    raw,
    nodes,
    connections,
    nodeMap,
    edgesFrom,
    edgeMeta,
    startNodeId: startTargets[0]
  };

  if (CONFIG.DEBUG?.FLOW) console.log("[flow] loaded", FLOW);
  return FLOW;
}

/* =========================
   PUBLIC API
========================= */
export function startFlow(state) {
  if (!FLOW) throw new Error("Flujo no cargado");
  state.currentNodeId = FLOW.startNodeId;
  state.awaitingNodeId = null;
  state.lastUserText = "";
  return safeRun(state.currentNodeId, state);
}

export function runNode(nodeId, state) {
  if (!FLOW) throw new Error("Flujo no cargado");
  return safeRun(nodeId, state);
}

export function handleUserInput(text, state) {
  const clean = normalize(text);
  state.lastUserText = clean;

  // Acciones globales
  const action = matchGlobalAction(clean);
  if (action) return handleGlobalAction(action, state);

  // Si estamos esperando respuesta (waitResponse)
  if (state.awaitingNodeId) {
    return handleAwaitedResponse(clean, state);
  }

  // Si el nodo actual tiene opciones, intentamos matchear
  const node = getNode(state.currentNodeId);
  if (node?.type === "autobotAction") {
    const options = getAutobotOptions(node);
    const nextIds = getNext(node.id);

    // ✅ En nodos "solo botones", no aceptamos texto libre que no matchee
    const allowFreeText = isFreeTextAllowed(node);

    const matchedTarget = matchOptionsToTargets(clean, options, nextIds);
    if (matchedTarget) return safeRun(matchedTarget, state);

    // Si NO matcheó y NO se permite texto libre => repite el nodo (no avanza)
    if (!allowFreeText && options?.length) {
      return makeButtonsOnlyFallback(node);
    }

    // Si no match, pero hay una sola salida, dejamos que el flow decida (ej filter)
    if (nextIds?.length === 1) return safeRun(nextIds[0], state);
  }

  // Fallback suave
  return makeBotMessage(
    "No te entendí del todo 😅 Usa los botones, o escribe “menú” para volver."
  );
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
    if (!node) return makeBotMessage("Ups… no encontré ese nodo 😅");

    state.currentNodeId = nodeId;

    // ✅ Saltar nodos por configuración
    if (shouldSkipNode(node)) {
      const out = getNext(nodeId);
      if (CONFIG.DEBUG?.FLOW) console.log("[flow] skip node", nodeId, node?.name, "->", out?.[0]);
      nodeId = out?.[0] || null;
      continue;
    }

    // Filters: rutean inmediatamente
    if (node.type === "filter") {
      const next = handleFilterInternal(node, state);
      if (typeof next === "string") {
        nodeId = next;
        continue;
      }
      return next;
    }

    // Mensaje/acción: devolvemos botMessage
    if (node.type === "autobotAction") {
      return handleAutobotAction(node, state);
    }

    if (node.type === "transferConversation") {
      return handleTransfer(node, state);
    }

    // Tipos no soportados: intentamos seguir por primera salida
    const out = getNext(nodeId);
    if (out?.length) {
      nodeId = out[0];
      continue;
    }

    return makeBotMessage(`Este tipo de nodo aún no está soportado: ${node.type} 🤖`);
  }

  if (steps >= MAX_STEPS_PER_TURN) {
    console.warn("[flow] detenido por posible loop. Node:", nodeId);
    return makeBotMessage("Me quedé dando vueltas 😵‍💫 Toca “menú” para reiniciar el hilo.");
  }

  return makeBotMessage("Ok 😊");
}

/* =========================
   NODE HANDLERS
========================= */

function handleAutobotAction(node, state) {
  const p = getNodeOptions(node);

  const typeMessage = String(p.typeMessage || "").trim().toLowerCase(); // "text" | "audio" | ...
  const textRaw = String(p.textMessage || p.message || "").trim();

  const options = normalizeOptions(p.options);

  // waitResponse
  const wait = Boolean(p.waitResponse);
  state.awaitingNodeId = wait ? node.id : null;

  // ✅ MEDIA: soporta p.media/attachments/files y también audioSrc/audioUrl, imageSrc, videoSrc...
  const media = extractMediaFromAutobotOptions(p);

  // Si viene un nodo de audio (o viene media sin texto), no dejemos el chat mudo.
  const text =
    textRaw ||
    (typeMessage === "audio" ? "🎧 Reproduciendo audio…" : "") ||
    (media.length ? "📎 Te comparto un archivo…" : "");

  const msg = makeBotMessage(text, options.map((o) => o.label));

  if (media.length) msg.media = media;

  // Metadata útil para UI (si la quieres usar allá)
  msg._flow = {
    nodeId: node.id,
    allowFreeText: isFreeTextAllowed(node),
    hasOptions: Boolean(options.length)
  };

  if (CONFIG.DEBUG?.FLOW) {
    console.log("[flow] autobotAction", node.id, {
      typeMessage,
      text: text.slice(0, 80),
      options: options.map((o) => o.label),
      media,
      wait,
      allowFreeText: msg._flow.allowFreeText
    });
  }

  return msg;
}

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
      if (CONFIG.DEBUG?.FLOW) console.log("[flow] filter route", node.id, "->", target, { op, right });
      return target;
    }
  }

  if (def) {
    if (CONFIG.DEBUG?.FLOW) console.log("[flow] filter default", node.id, "->", def);
    return def;
  }

  const next = getNext(node.id);
  if (next?.length) {
    if (CONFIG.DEBUG?.FLOW) console.log("[flow] filter fallback edge", node.id, "->", next[0]);
    return next[0];
  }

  return makeBotMessage("No encontré a dónde rutear 😅");
}

function handleTransfer(node, state) {
  const p = getNodeOptions(node);

  const text =
    String(p.onlineMessage || p.textMessage || "").trim() ||
    "Listo ✅ Te paso con un humano.";

  state.awaitingNodeId = null;
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

  // Si el nodo esperado es autobotAction:
  // - Si tiene opciones y NO permite texto libre, solo aceptamos si coincide con opción
  if (awaiting?.type === "autobotAction") {
    const options = getAutobotOptions(awaiting);
    const next = getNext(awaiting.id);
    const allowFreeText = isFreeTextAllowed(awaiting);

    // 1) Intentar match con opciones -> ruta
    const matchedTarget = matchOptionsToTargets(cleanText, options, next);
    if (matchedTarget) return safeRun(matchedTarget, state);

    // 2) Si no match y NO se permite texto libre y hay opciones -> repetir nodo con mensaje
    if (!allowFreeText && options?.length) {
      // Volvemos a poner awaitingNodeId porque seguimos esperando selección
      state.awaitingNodeId = awaiting.id;
      return makeButtonsOnlyFallback(awaiting);
    }

    // 3) Si sí se permite texto libre, avanzamos por la primera salida
    if (next?.length) return safeRun(next[0], state);

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
    if (hits.some((k) => cleanText.includes(normalize(k)))) return action;
  }
  return null;
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
      return makeBotMessage("Dale click a ‘Preguntas frecuentes’ en el panel de ayuda 👇");

    case "INFO":
      return makeBotMessage("¿Qué info necesitas: horarios, modalidades, precios o inscripciones?");

    case "WHATSAPP":
      return makeBotMessage("Toca el botón de WhatsApp arriba y te llevo directo 💬");

    default:
      return makeBotMessage("Ok… ¿menú? 😅");
  }
}

function goHome(state) {
  const homeId = CONFIG.FLOW_SPECIAL?.HOME_NODE_ID;
  if (homeId && getNode(homeId)) return safeRun(homeId, state);
  return startFlow(state);
}

/* =========================
   SKIP NODES (ej: idioma en chat)
========================= */

function shouldSkipNode(node) {
  const skip = CONFIG.FLOW_SPECIAL?.SKIP_NODE_IDS;
  if (Array.isArray(skip) && skip.includes(node.id)) return true;
  return false;
}

/* =========================
   MATCHING OPTIONS → TARGETS
========================= */

function getAutobotOptions(node) {
  const p = getNodeOptions(node);
  return normalizeOptions(p.options);
}

function matchOptionsToTargets(cleanText, options, nextIds) {
  if (!options?.length || !nextIds?.length) return null;

  // 0) Match por índice numérico: "1" -> primera opción, etc.
  const n = parseChoiceNumber(cleanText);
  if (n != null) {
    const idx = n - 1;
    if (idx >= 0 && idx < nextIds.length) return nextIds[idx];
  }

  // 1) Exact match con label/value
  const idxExact = options.findIndex(
    (o) => normalize(o.value) === cleanText || normalize(o.label) === cleanText
  );
  if (idxExact >= 0 && nextIds[idxExact]) return nextIds[idxExact];

  // 2) Contains match (solo si la opción tiene contenido real)
  const idxContains = options.findIndex((o) => {
    const v = normalize(o.value);
    const l = normalize(o.label);
    return (v && cleanText.includes(v)) || (l && cleanText.includes(l));
  });
  if (idxContains >= 0 && nextIds[idxContains]) return nextIds[idxContains];

  return null;
}

function parseChoiceNumber(cleanText) {
  const m = cleanText.match(/^(\d{1,2})$/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const map = {
    primera: 1,
    primero: 1,
    segunda: 2,
    segundo: 2,
    tercera: 3,
    tercero: 3,
    cuarta: 4,
    cuarto: 4,
    quinta: 5,
    quinto: 5
  };
  for (const k in map) {
    if (cleanText.includes(k)) return map[k];
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
   FREE TEXT RULES (v3.9.0)
========================= */

function isFreeTextAllowed(node) {
  const p = getNodeOptions(node);
  const explicit = p?.allowFreeText;

  // 1) Si viene explícito, manda.
  if (explicit === true) return true;
  if (explicit === false) return false;

  // 2) Default inteligente:
  const opts = normalizeOptions(p.options);
  // Si hay opciones, por defecto queremos "solo botones"
  if (opts.length) return false;

  // Si no hay opciones, texto libre permitido
  return true;
}

function makeButtonsOnlyFallback(node) {
  const p = getNodeOptions(node);
  const opts = normalizeOptions(p.options).map((o) => o.label);

  const fallbackText =
    String(p.buttonsOnlyMessage || "").trim() ||
    "Para continuar, elige una opción con los botones 👇";

  // Re-enviamos los mismos botones del nodo actual
  const msg = makeBotMessage(fallbackText, opts);
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

function getNodeOptions(node) {
  const p = node?.parameters || node?.data?.parameters || {};
  return p.options || p || {};
}

function normalize(text = "") {
  let t = String(text);

  if (CONFIG.NORMALIZE?.TRIM !== false) t = t.trim();
  if (CONFIG.NORMALIZE?.LOWERCASE !== false) t = t.toLowerCase();

  if (CONFIG.NORMALIZE?.REMOVE_ACCENTS !== false) {
    t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  if (CONFIG.NORMALIZE?.COLLAPSE_SPACES !== false) {
    t = t.replace(/\s+/g, " ");
  }

  return t;
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => {
      if (typeof o === "string") {
        const s = o.trim();
        return s ? { label: s, value: s } : null;
      }
      if (o && typeof o === "object") {
        const label = String(o.label || o.text || o.value || "").trim();
        const value = String(o.value ?? label).trim();
        if (!label) return null;
        return { label, value };
      }
      return null;
    })
    .filter(Boolean);
}

/* =========================
   MEDIA (v3.7 compatible)
========================= */

// Construye media[] desde:
// - media / attachments / files (string | object | array)
// - audioSrc/audioUrl, imageSrc/imageUrl, videoSrc/videoUrl
// - typeMessage + src directo (audioSrc en tu caso)
function extractMediaFromAutobotOptions(p) {
  const mediaList = [];

  // 1) Colecciones típicas
  pushMediaAny(mediaList, p.media);
  pushMediaAny(mediaList, p.attachments);
  pushMediaAny(mediaList, p.files);

  // 2) Rutas directas por tipo
  // Audio
  pushMediaUrl(mediaList, "audio", p.audioSrc);
  pushMediaUrl(mediaList, "audio", p.audioUrl);
  // Imagen
  pushMediaUrl(mediaList, "image", p.imageSrc);
  pushMediaUrl(mediaList, "image", p.imageUrl);
  // Video
  pushMediaUrl(mediaList, "video", p.videoSrc);
  pushMediaUrl(mediaList, "video", p.videoUrl);

  // 3) Caso especial: si el nodo trae typeMessage y un src suelto
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

  // 4) Normaliza, elimina vacíos y duplicados por (type,url)
  const clean = mediaList
    .map((m) => normalizeOneMedia(m))
    .filter(Boolean);

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
