#!/usr/bin/env node
/**
 * scripts/validate-assets.js
 *
 * Valida que los archivos referenciados desde kb.json, webflow.json e index.html
 * existen en disco (ruta relativa al repo).
 *
 * Uso:
 *   node scripts/validate-assets.js
 *
 * Salida:
 * - Lista de referencias encontradas
 * - Lista de archivos faltantes (exit code 1 si hay faltantes)
 *
 * Nota: es un validador ligero (no parsea HTML/XML con librerías externas),
 * pero cubre patrones comunes: @img:..., ./assets/..., src="...", href="...", url(...) en CSS.
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function readJSONIfExists(relPath) {
  const p = path.join(ROOT, relPath);
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function readTextIfExists(relPath) {
  const p = path.join(ROOT, relPath);
  try {
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    return null;
  }
}

function collectFromKb(kb) {
  const found = new Set();
  if (!kb) return found;

  function walk(obj) {
    if (obj == null) return;
    if (typeof obj === "string") {
      // @img:./assets/foo.png
      const reImg = /@img:\s*([^\s'"]+)/g;
      let m;
      while ((m = reImg.exec(obj)) !== null) {
        found.add(normalizePath(m[1]));
      }
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    if (typeof obj === "object") {
      Object.values(obj).forEach(walk);
    }
  }

  walk(kb);
  return found;
}

function collectFromWebflow(raw) {
  const found = new Set();
  if (!raw) return found;
  const text = JSON.stringify(raw);
  // busca rutas relativas o /assets/...
  const re = /(?:@img:|["'])(\.\/assets\/[^\s"']+|\/assets\/[^\s"']+|assets\/[^\s"']+)["']/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    // m[1] puede contener "assets/..." o "./assets/..."
    const candidate = m[1].replace(/^["']|["']$/g, "");
    found.add(normalizePath(candidate));
  }

  // fallback: busco cualquier ./assets/... sin comillas
  const re2 = /(\.\/assets\/[^\s"',\]\}]+)/g;
  while ((m = re2.exec(text)) !== null) {
    found.add(normalizePath(m[1]));
  }

  return found;
}

function collectFromHtml(text) {
  const found = new Set();
  if (!text) return found;

  // src="..."
  const reSrc = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = reSrc.exec(text)) !== null) {
    const v = m[1];
    if (looksLikeAsset(v)) found.add(normalizePath(v));
  }

  // CSS url(...)
  const reUrl = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  while ((m = reUrl.exec(text)) !== null) {
    const v = m[1];
    if (looksLikeAsset(v)) found.add(normalizePath(v));
  }

  return found;
}

function looksLikeAsset(p) {
  if (!p) return false;
  // Consideramos assets: rutas relativas que incluyan "assets" o terminadas en extensiones medias
  if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("data:")) return false;
  if (p.includes("/assets/") || p.startsWith("./assets/") || p.startsWith("assets/")) return true;
  const ext = path.extname(p).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".mp3", ".wav", ".ogg"].includes(ext);
}

function normalizePath(p) {
  if (!p) return p;
  // eliminar fragmentos o query params simples
  const up = p.split("?")[0].split("#")[0];
  // normalizar "./assets/..." y "assets/..." a ./assets/...
  if (up.startsWith("/")) return up.slice(1);
  if (up.startsWith("assets/")) return "./" + up;
  return up;
}

function checkFiles(pathsSet) {
  const missing = [];
  const ok = [];
  for (const rel of Array.from(pathsSet).sort()) {
    const resolved = path.join(ROOT, rel);
    if (fs.existsSync(resolved)) ok.push(rel);
    else missing.push(rel);
  }
  return { ok, missing };
}

/* =========================
   Main
========================= */

function main() {
  console.log("Validando referencias a assets en este repositorio...\n");

  const refs = new Set();

  // kb.json
  const kb = readJSONIfExists("kb.json");
  if (kb) {
    console.log("- kb.json cargado");
    collectFromKb(kb).forEach((r) => refs.add(r));
  } else {
    console.log("- kb.json no encontrado o inválido (se omitirá)");
  }

  // webflow.json
  const wf = readJSONIfExists("webflow.json");
  if (wf) {
    console.log("- webflow.json cargado");
    collectFromWebflow(wf).forEach((r) => refs.add(r));
  } else {
    console.log("- webflow.json no encontrado o inválido (se omitirá)");
  }

  // index.html
  const idx = readTextIfExists("index.html");
  if (idx) {
    console.log("- index.html cargado");
    collectFromHtml(idx).forEach((r) => refs.add(r));
  } else {
    console.log("- index.html no encontrado (se omitirá)");
  }

  // styles.css (opcional)
  const css = readTextIfExists("styles.css");
  if (css) {
    const cssUrls = collectFromHtml(css); // reusar extractor url(...)
    cssUrls.forEach((r) => refs.add(r));
  }

  if (!refs.size) {
    console.log("\nNo se encontraron referencias a assets en kb.json, webflow.json ni index.html.");
    process.exit(0);
  }

  console.log(`\nReferencias encontradas: ${refs.size}\n`);

  const { ok, missing } = checkFiles(refs);

  if (ok.length) {
    console.log("Archivos existentes:");
    ok.forEach((p) => console.log("  ✓", p));
  }

  if (missing.length) {
    console.log("\nArchivos faltantes:");
    missing.forEach((p) => console.log("  ✗", p));
    console.log(`\nResultado: Faltan ${missing.length} archivo(s). Corrígelos o ejecuta 'git mv' para renombrarlos.`);
    process.exit(1);
  }

  console.log("\nResultado: todas las referencias a assets existen ✅");
  process.exit(0);
}

if (require.main === module) main();