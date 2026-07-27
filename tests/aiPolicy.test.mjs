import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseAIResponse,
  sanitizeUserText,
  selectKnowledgeContext,
  shouldAttemptAI,
} from "../js/aiPolicy.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const kb = JSON.parse(
  fs.readFileSync(path.join(here, "..", "kb.json"), "utf8")
);

test("la IA no se activa cuando el flujo local sí respondió", () => {
  const result = shouldAttemptAI({
    userText: "Quiero clases de piano",
    botReply: { text: "Tenemos clases presenciales y virtuales.", _flow: {} },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "local_answer_available");
});

test("la IA se activa únicamente ante el fallback local", () => {
  const result = shouldAttemptAI({
    userText: "¿Cómo puedo motivar a mi hijo para practicar música?",
    botReply: {
      text: "No te entendí del todo. Elige una opción.",
      _flow: { nodeId: "menu_fallback" },
    },
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "local_fallback");
});

test("la IA no interrumpe la captura de datos", () => {
  const result = shouldAttemptAI({
    userText: "Mi nombre es Alek",
    captureStage: "name",
    botReply: { text: "No te entendí del todo." },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "capture_active");
});

test("se eliminan datos sensibles antes de construir el prompt", () => {
  const clean = sanitizeUserText(
    "Mi correo es persona@example.com, mi celular +57 310 555 1234 y mira https://example.com"
  );
  assert.equal(clean.includes("persona@example.com"), false);
  assert.equal(clean.includes("310 555 1234"), false);
  assert.equal(clean.includes("https://example.com"), false);
  assert.match(clean, /\[correo omitido\]/);
  assert.match(clean, /\[telefono omitido\]/);
});

test("solo se envían fragmentos relevantes del conocimiento", () => {
  const context = selectKnowledgeContext(
    kb,
    "¿Hasta qué zonas llegan las clases a domicilio?",
    "es"
  );
  assert.ok(context.length > 0);
  assert.ok(context.some((item) => item.includes("coverage_home")));
  assert.ok(context.join("\n").length <= 4500);
});

test("la respuesta estructurada de Gemini se valida", () => {
  const parsed = parseAIResponse(
    '{"answer":"Podemos orientarte con una respuesta breve.","confidence":"medium","needsHuman":false}'
  );
  assert.deepEqual(parsed, {
    answer: "Podemos orientarte con una respuesta breve.",
    confidence: "medium",
    needsHuman: false,
  });
});

test("una salida que no sea JSON no llega al usuario", () => {
  assert.equal(parseAIResponse("respuesta libre sin estructura"), null);
});
