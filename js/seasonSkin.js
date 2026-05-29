// seasonSkin.js
// ============================
// Skins (temáticas visuales) según la fecha del año: fiestas y temporadas.
// Tiene su PROPIO calendario (independiente de vacationSeasons.js), porque aquí
// celebramos fechas culturales (San Valentín, Halloween, Amor y Amistad, etc.).
//
// Cómo funciona:
// - Calcula qué fiesta/temporada está activa HOY (zona horaria Bogotá).
// - Pone <body data-season="..."> y styles.css aplica la paleta correspondiente.
// - Si no hay ninguna activa, usa el look "default" de Musicala.
//
// Cómo AGREGAR una fiesta nueva (2 pasos):
//   1) Agrega una entrada en buildCalendar() con su rango de fechas.
//   2) En styles.css agrega un bloque  body[data-season="<id>"] { --... }  con los colores.
//
// Probar manualmente (sin esperar la fecha):  ?skin=halloween  en la URL
//   (o localStorage.setItem("musibot_skin","halloween"))

const BOGOTA_TZ = "America/Bogota";
const SKIN_ATTR = "data-season";
const SKIN_LS_KEY = "musibot_skin";

// IDs válidos = los que tienen paleta en styles.css.
const VALID_SKINS = new Set([
  "default",
  "san_valentin",
  "dia_nino",
  "semana_santa",
  "dia_madre",
  "dia_padre",
  "amor_amistad",
  "halloween",
  "velitas",
  "ano_nuevo",
  "navidad"
]);

/* =========================
   Utilidades de fecha (Bogotá)
========================= */
function getBogotaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const read = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function dateKey(p) {
  return p.year * 10000 + p.month * 100 + p.day;
}

function addDays(p, delta) {
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  d.setUTCDate(d.getUTCDate() + delta);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// Domingo de Pascua (algoritmo de Gauss/Computus).
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

// N-ésimo día de semana de un mes. weekday: 0=domingo ... 6=sábado.
function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstDow = first.getUTCDay();
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return { year, month, day };
}

// Último día de semana de un mes (ej: último sábado de abril).
function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(Date.UTC(year, month, 0)); // día 0 del mes siguiente = último del mes
  const lastDom = last.getUTCDate();
  const lastDow = last.getUTCDay();
  const offset = (lastDow - weekday + 7) % 7;
  return { year, month, day: lastDom - offset };
}

/* =========================
   Calendario de skins
   - Cada entrada: { id, start, end }  (rango inclusivo en fechas Bogotá)
   - Fechas fijas o calculadas (Pascua, n-ésimo sábado, etc.)
========================= */
function buildCalendar(year) {
  const easter = getEasterSunday(year);
  // Día del Niño en Colombia: último sábado de abril.
  const diaNino = lastWeekdayOfMonth(year, 4, 6);
  // Día de la Madre en Colombia: segundo domingo de mayo.
  const diaMadre = nthWeekdayOfMonth(year, 5, 0, 2);
  // Día del Padre en Colombia: tercer domingo de junio.
  const diaPadre = nthWeekdayOfMonth(year, 6, 0, 3);
  // Amor y Amistad en Colombia: tercer sábado de septiembre.
  const amorAmistadSat = nthWeekdayOfMonth(year, 9, 6, 3);

  // NOTA: el orden importa. Velitas (7 dic) y Año Nuevo (31 dic–1 ene) caen
  // dentro del rango de Navidad, así que van ANTES para que tengan prioridad.
  return [
    // San Valentín: 7 al 14 de febrero
    { id: "san_valentin", start: { year, month: 2, day: 7 }, end: { year, month: 2, day: 14 } },

    // Día del Niño: la semana del último sábado de abril
    { id: "dia_nino", start: addDays(diaNino, -5), end: addDays(diaNino, 1) },

    // Semana Santa: Domingo de Ramos (Pascua - 7) hasta Domingo de Resurrección
    { id: "semana_santa", start: addDays(easter, -7), end: easter },

    // Día de la Madre: la semana previa al segundo domingo de mayo
    { id: "dia_madre", start: addDays(diaMadre, -6), end: diaMadre },

    // Día del Padre: la semana previa al tercer domingo de junio
    { id: "dia_padre", start: addDays(diaPadre, -6), end: diaPadre },

    // Amor y Amistad: la semana del tercer sábado de septiembre
    { id: "amor_amistad", start: addDays(amorAmistadSat, -6), end: addDays(amorAmistadSat, 1) },

    // Halloween: 24 al 31 de octubre
    { id: "halloween", start: { year, month: 10, day: 24 }, end: { year, month: 10, day: 31 } },

    // Velitas: 7 al 8 de diciembre  (antes que Navidad por prioridad)
    { id: "velitas", start: { year, month: 12, day: 7 }, end: { year, month: 12, day: 8 } },

    // Año Nuevo: 31 de diciembre al 1 de enero  (antes que Navidad por prioridad)
    { id: "ano_nuevo", start: { year, month: 12, day: 31 }, end: { year: year + 1, month: 1, day: 1 } },

    // Navidad / fin de año: 1 de diciembre al 6 de enero (Reyes)
    { id: "navidad", start: { year, month: 12, day: 1 }, end: { year: year + 1, month: 1, day: 6 } }
  ];
}

function getForcedSkin() {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("skin");
    if (fromUrl) return fromUrl.trim();
    const fromLS = localStorage.getItem(SKIN_LS_KEY);
    if (fromLS) return fromLS.trim();
  } catch {}
  return "";
}

export function resolveSeasonSkin(date = new Date()) {
  // 1) override manual (URL / localStorage)
  const forced = getForcedSkin();
  if (forced && VALID_SKINS.has(forced)) return forced;

  // 2) buscar fiesta activa hoy (consideramos el año actual y el anterior,
  //    para que Navidad de diciembre siga activa en los primeros días de enero).
  const today = getBogotaDateParts(date);
  const todayKey = dateKey(today);
  const candidates = [...buildCalendar(today.year), ...buildCalendar(today.year - 1)];

  for (const c of candidates) {
    if (todayKey >= dateKey(c.start) && todayKey <= dateKey(c.end)) {
      if (VALID_SKINS.has(c.id)) return c.id;
    }
  }

  return "default";
}

export function applySeasonSkin(date = new Date()) {
  const skin = resolveSeasonSkin(date);
  try {
    document.body.setAttribute(SKIN_ATTR, skin);
  } catch {}
  return skin;
}
