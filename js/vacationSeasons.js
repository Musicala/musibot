const BOGOTA_TZ = "America/Bogota";

const MONTH_NAMES = {
  es: [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre"
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ]
};

const SEASON_COPY = {
  holy_week: {
    es: {
      name: "Semana Santa",
      theme: "una pausa creativa para explorar musica, danza, teatro y artes plasticas con juego, expresion y mucho disfrute"
    },
    en: {
      name: "Holy Week",
      theme: "a creative pause to explore music, dance, theatre and visual arts through play, expression and joyful learning"
    }
  },
  mid_year: {
    es: {
      name: "Mitad de ano",
      theme: "una temporada ideal para descubrir nuevas habilidades, crear proyectos artisticos y aprovechar el receso largo con mucho arte"
    },
    en: {
      name: "Mid-year Break",
      theme: "an ideal season to discover new skills, build artistic projects and make the most of the longer school break"
    }
  },
  october_break: {
    es: {
      name: "Semana de receso de octubre",
      theme: "una experiencia corta pero poderosa para recargar energia, probar nuevas artes y vivir una semana diferente"
    },
    en: {
      name: "October Break",
      theme: "a short but powerful experience to recharge, try new arts and enjoy a different kind of creative week"
    }
  },
  year_end: {
    es: {
      name: "Fin de ano e inicio de ano",
      theme: "una temporada para cerrar y comenzar ciclo con arte, alegria, proyectos creativos y experiencias para compartir"
    },
    en: {
      name: "Year-end and New-year Season",
      theme: "a season to close and begin a new cycle with art, joy, creative projects and shared experiences"
    }
  }
};

function getBogotaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const read = (type) => Number(parts.find((p) => p.type === type)?.value || 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day")
  };
}

function toUtcDate(parts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function addDays(parts, deltaDays) {
  const d = toUtcDate(parts);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate()
  };
}

function toDateKey(parts) {
  return (parts.year * 10000) + (parts.month * 100) + parts.day;
}

function formatDateRange(start, end, lang = "es") {
  const names = MONTH_NAMES[lang] || MONTH_NAMES.es;
  const startMonth = names[start.month - 1];
  const endMonth = names[end.month - 1];

  if (lang === "en") {
    const startLabel = `${startMonth} ${start.day}`;
    const endLabel = `${endMonth} ${end.day}`;
    if (start.year === end.year) return `${startLabel} to ${endLabel}, ${end.year}`;
    return `${startLabel}, ${start.year} to ${endLabel}, ${end.year}`;
  }

  const startLabel = `${start.day} de ${startMonth}`;
  const endLabel = `${end.day} de ${endMonth}`;
  if (start.year === end.year) return `${startLabel} al ${endLabel} de ${end.year}`;
  return `${startLabel} de ${start.year} al ${endLabel} de ${end.year}`;
}

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
  const l = (32 + (2 * e) + (2 * i) - h - k) % 7;
  const m = Math.floor((a + (11 * h) + (22 * l)) / 451);
  const month = Math.floor((h + l - (7 * m) + 114) / 31);
  const day = ((h + l - (7 * m) + 114) % 31) + 1;

  return { year, month, day };
}

function buildSeasonForYear(id, year) {
  switch (id) {
    case "holy_week": {
      const easter = getEasterSunday(year);
      const start = addDays(easter, -7);
      const end = easter;
      return { id, start, end };
    }
    case "mid_year":
      return {
        id,
        start: { year, month: 6, day: 15 },
        end: { year, month: 7, day: 15 }
      };
    case "october_break":
      return {
        id,
        start: { year, month: 10, day: 5 },
        end: { year, month: 10, day: 12 }
      };
    case "year_end":
      return {
        id,
        start: { year, month: 12, day: 1 },
        end: { year: year + 1, month: 1, day: 31 }
      };
    default:
      return null;
  }
}

function buildComparableSeasons(anchorYear) {
  const ids = ["holy_week", "mid_year", "october_break", "year_end"];
  const years = [anchorYear - 1, anchorYear, anchorYear + 1];
  const out = [];

  years.forEach((year) => {
    ids.forEach((id) => {
      const season = buildSeasonForYear(id, year);
      if (!season) return;
      out.push({
        ...season,
        startKey: toDateKey(season.start),
        endKey: toDateKey(season.end)
      });
    });
  });

  return out.sort((a, b) => a.startKey - b.startKey);
}

function resolveVacationSeason(date = new Date()) {
  const today = getBogotaDateParts(date);
  const todayKey = toDateKey(today);
  const seasons = buildComparableSeasons(today.year);

  const active = seasons.find((season) => todayKey >= season.startKey && todayKey <= season.endKey);
  if (active) {
    return {
      status: "active",
      ...active
    };
  }

  const next = seasons.find((season) => season.startKey > todayKey) || seasons[0];
  return {
    status: "upcoming",
    ...next
  };
}

function getSeasonContext(lang = "es", date = new Date()) {
  const safeLang = lang === "en" ? "en" : "es";
  const resolved = resolveVacationSeason(date);
  const copy = SEASON_COPY[resolved.id]?.[safeLang] || SEASON_COPY.mid_year[safeLang];

  return {
    ...resolved,
    lang: safeLang,
    seasonName: copy.name,
    theme: copy.theme,
    dateRange: formatDateRange(resolved.start, resolved.end, safeLang)
  };
}

function buildMainVacationalText(ctx) {
  if (ctx.lang === "en") {
    const intro = ctx.status === "active"
      ? `Our ${ctx.seasonName} holiday season is currently active.`
      : `Our next holiday season will be ${ctx.seasonName}.`;

    return [
      intro,
      `Dates: ${ctx.dateRange}.`,
      `Theme: ${ctx.theme}.`,
      "",
      "Depending on the student's age, here you can explore:",
      "- Arts Holiday Program for ages 4 to 15",
      "- Intensive Courses by discipline for other ages or more focused goals",
      "",
      "Available modalities:",
      "- On-site (Pasadena)",
      "- At home",
      "- Live online",
      "",
      "Small groups or personalized classes.",
      "Tell us the student's age and I'll show you the best option."
    ].join("\n");
  }

  const intro = ctx.status === "active"
    ? `En este momento esta activa nuestra temporada de ${ctx.seasonName}.`
    : `Nuestra proxima temporada de vacacionales sera ${ctx.seasonName}.`;

  return [
    intro,
    `Fechas: ${ctx.dateRange}.`,
    `Tematica: ${ctx.theme}.`,
    "",
    "Segun la edad del estudiante, aqui puedes explorar:",
    "- Vacaciones Artisticas para 4 a 15 anos",
    "- Cursos Intensivos por disciplina para otras edades o procesos mas enfocados",
    "",
    "Modalidades disponibles:",
    "- En sede (Pasadena)",
    "- A domicilio",
    "- Virtual en vivo",
    "",
    "Grupos pequenos o clases personalizadas.",
    "Cuentanos la edad del estudiante y te comparto la mejor opcion."
  ].join("\n");
}

function buildVacacionesArtisticasOfferText(ctx) {
  if (ctx.lang === "en") {
    return [
      `For ${ctx.seasonName}, we have two great paths for this age range.`,
      "",
      "Arts Holiday Program",
      "4 hours of art each morning (Mon-Fri), with music, dance, theatre and visual arts activities.",
      "",
      "Intensive Courses",
      "Classes focused on one discipline, with flexible schedules and seasonal benefits.",
      "",
      `This season is inspired by ${ctx.theme}.`,
      "",
      "Which one interests you most?"
    ].join("\n");
  }

  return [
    `Para ${ctx.seasonName}, tenemos dos caminos buenisimos para esta edad.`,
    "",
    "Vacaciones Artisticas",
    "4 horas diarias de arte en la manana (lun a vie), con actividades de musica, danza, teatro y artes plasticas.",
    "",
    "Cursos Intensivos",
    "Clases enfocadas en una disciplina, con horarios flexibles y beneficios de temporada.",
    "",
    `Esta temporada esta pensada como ${ctx.theme}.`,
    "",
    "Cual te interesa mas?"
  ].join("\n");
}

function buildVacacionesArtisticasSummaryText(ctx) {
  if (ctx.lang === "en") {
    const intro = ctx.status === "active"
      ? `During ${ctx.dateRange}, children ages 4 to 15 enjoy an arts experience designed for ${ctx.seasonName}.`
      : `For ${ctx.seasonName} (${ctx.dateRange}), children ages 4 to 15 can enjoy an arts experience designed around this season.`;

    return [
      `Arts Holiday Program - ${ctx.seasonName}`,
      "",
      intro,
      `This season focuses on ${ctx.theme}.`,
      "",
      "Morning sessions: 9:00 a.m. to 1:00 p.m.",
      "- Visual arts: painting, sculpture and crafts",
      "- Music: rhythm, melodies and creation",
      "- Dance and theatre: body expression and confidence",
      "- Teamwork: cooperation and collaboration",
      "",
      "When you're ready, I can show you the plans."
    ].join("\n");
  }

  const intro = ctx.status === "active"
    ? `Durante ${ctx.dateRange}, ninos y ninas de 4 a 15 anos viven una experiencia creativa pensada para ${ctx.seasonName}.`
    : `Para ${ctx.seasonName} (${ctx.dateRange}), ninos y ninas de 4 a 15 anos pueden vivir una experiencia creativa inspirada en esta temporada.`;

  return [
    `Vacaciones Artisticas - ${ctx.seasonName}`,
    "",
    intro,
    `Esta temporada se vive como ${ctx.theme}.`,
    "",
    "Jornadas en la manana: 9:00 a.m. a 1:00 p.m.",
    "- Artes plasticas: pintura, escultura y manualidades",
    "- Musica: ritmo, melodias y creacion",
    "- Danza y teatro: expresion corporal y confianza",
    "- Trabajo en equipo: colaboracion y companerismo",
    "",
    "Cuando quieras, te muestro los planes."
  ].join("\n");
}

function buildVacacionesArtisticasPricingText(ctx) {
  if (ctx.lang === "en") {
    const intro = ctx.status === "active"
      ? `These are the plans currently available for ${ctx.seasonName}:`
      : `These are the reference plans we are using for ${ctx.seasonName}:`;
    const note = ctx.status === "active"
      ? "We also have benefits for siblings, cousins, referrals and continuity."
      : "If there is any final adjustment for this season, we confirm it before enrollment opens fully.";

    return [
      intro,
      `Dates: ${ctx.dateRange}.`,
      "",
      "- 16-hour plan: $424,000",
      "- 20-hour plan: $478,000",
      "",
      note,
      "",
      "Age groups:",
      "- Musicalitos (4 to 6)",
      "- Musikids (7 to 11)",
      "- Musiteens (12 to 15)",
      "",
      "If you want, I can show you the enrollment steps."
    ].join("\n");
  }

  const intro = ctx.status === "active"
    ? `Estos son los planes disponibles para ${ctx.seasonName}:`
    : `Estos son los planes de referencia que estamos manejando para ${ctx.seasonName}:`;
  const note = ctx.status === "active"
    ? "Tambien tenemos beneficios para hermanitos, primos, referidos y continuidad."
    : "Si hay algun ajuste final para esta temporada, te lo confirmamos antes de abrir inscripciones oficialmente.";

  return [
    intro,
    `Fechas: ${ctx.dateRange}.`,
    "",
    "- Plan de 16 horas: $424.000",
    "- Plan de 20 horas: $478.000",
    "",
    note,
    "",
    "Grupos por edades:",
    "- Musicalitos (4 a 6)",
    "- Musikids (7 a 11)",
    "- Musiteens (12 a 15)",
    "",
    "Si quieres, te paso el paso a paso para asegurar el cupo."
  ].join("\n");
}

function buildIntensivosText(ctx) {
  if (ctx.lang === "en") {
    const intro = ctx.status === "active"
      ? `If you want a more focused process during ${ctx.seasonName}, this is a great path.`
      : `If you want to prepare early for ${ctx.seasonName}, this is a great path.`;

    return [
      `Musicala Intensive Courses - ${ctx.seasonName}`,
      "",
      intro,
      `Dates: ${ctx.dateRange}.`,
      "",
      "A great option to learn, improve or return to what you love most: music, dance, theatre or visual arts.",
      "Flexible schedules, personalized classes or small groups, and seasonal benefits.",
      "",
      "What would you like to learn?"
    ].join("\n");
  }

  const intro = ctx.status === "active"
    ? `Si buscas un proceso mas enfocado durante ${ctx.seasonName}, esta es una gran opcion.`
    : `Si quieres prepararte desde ya para ${ctx.seasonName}, esta es una gran opcion.`;

  return [
    `Cursos Intensivos Musicala - ${ctx.seasonName}`,
    "",
    intro,
    `Fechas: ${ctx.dateRange}.`,
    "",
    "Una opcion perfecta para aprender, avanzar o retomar lo que mas te apasiona: musica, danza, teatro o artes plasticas.",
    "Horarios flexibles, clases personalizadas o en grupos pequenos, y beneficios de temporada.",
    "",
    "Que te gustaria aprender?"
  ].join("\n");
}

export function getSeasonalVacationalText(nodeId, lang = "es", date = new Date()) {
  const ctx = getSeasonContext(lang, date);

  switch (String(nodeId || "")) {
    case "flow_vacacionales":
      return buildMainVacationalText(ctx);
    case "vacacionales_4a15_offer":
      return buildVacacionesArtisticasOfferText(ctx);
    case "flow_vacaciones_artisticas":
      return buildVacacionesArtisticasSummaryText(ctx);
    case "vac_art_precios":
      return buildVacacionesArtisticasPricingText(ctx);
    case "vacacionales_intensivos_msg":
      return buildIntensivosText(ctx);
    default:
      return "";
  }
}

export function getCurrentVacationSeasonContext(lang = "es", date = new Date()) {
  return getSeasonContext(lang, date);
}
