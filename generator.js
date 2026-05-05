// ─────────────────────────────────────────────────────────────────────────────
// ENDURO — Moteur de génération V1.21
// Trois sports : triathlon | course à pied route | trail
// Règles déterministes, explicables, ton coach.
// ─────────────────────────────────────────────────────────────────────────────

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

// Volume hebdomadaire cible au pic (minutes d'entraînement, HORS REPOS)
const PEAK_VOLUMES = {
  triathlon_sprint:   300,
  triathlon_olympic:  480,
  triathlon_half:     780,
  triathlon_full:    1080,
  run_10k:            200,
  run_semi:           300,
  run_marathon:       480,
  run_trail_short:    300,
  run_trail_medium:   480,
  run_trail_long:     720,
  run_trail_ultra:   1020,
};

// Semaines minimum de préparation
const MIN_WEEKS = {
  triathlon_sprint:    6,
  triathlon_olympic:   8,
  triathlon_half:     12,
  triathlon_full:     16,
  run_10k:             6,
  run_semi:            8,
  run_marathon:       14,
  run_trail_short:     8,
  run_trail_medium:   12,
  run_trail_long:     16,
  run_trail_ultra:    20,
};

// Dénivelé positif par heure selon le type de trail (m D+/h)
const TRAIL_DPLUS_PER_HOUR = {
  run_trail_short:  400,
  run_trail_medium: 500,
  run_trail_long:   600,
  run_trail_ultra:  700,
};

// Vitesse trail estimée (km/h) selon distance — terrain, pas route
const TRAIL_SPEED_KMH = {
  run_trail_short:  7.5,
  run_trail_medium: 6.5,
  run_trail_long:   5.5,
  run_trail_ultra:  5.0,
};

function getSportType(discipline) {
  if (!discipline) return 'triathlon';
  if (discipline.startsWith('triathlon'))  return 'triathlon';
  if (discipline.startsWith('run_trail')) return 'trail';
  if (discipline.startsWith('run_'))      return 'run';
  return 'triathlon';
}

// ─── ESTIMATION TEMPS CIBLE si non renseigné ────────────────────────────────

function estimateTargetTime(athlete, discipline) {
  const pace10k = athlete.run_10k_pace_seconds;
  if (!pace10k) return null;

  const sport = getSportType(discipline);

  if (sport === 'run') {
    const factors = { run_10k: 1.0, run_semi: 2.25, run_marathon: 4.65 };
    const factor = factors[discipline] || 2.25;
    return Math.round(pace10k * 10 * factor); // en secondes
  }

  if (sport === 'trail') {
    const speedKmh = TRAIL_SPEED_KMH[discipline] || 6.0;
    const distances = { run_trail_short: 25, run_trail_medium: 50, run_trail_long: 90, run_trail_ultra: 145 };
    const distKm = distances[discipline] || 50;
    return Math.round((distKm / speedKmh) * 3600);
  }

  // Triathlon — pas d'estimation allure-based simple
  return null;
}

// ─── BLOCS DE PÉRIODISATION ───────────────────────────────────────────────────

function computeBlocks(totalWeeks) {
  if (totalWeeks <= 6) {
    return [
      { phase: 'specific', name: 'Préparation directe', weeks: Math.floor(totalWeeks * 0.6) },
      { phase: 'taper',    name: 'Affûtage',            weeks: Math.ceil(totalWeeks * 0.4) },
    ];
  }
  if (totalWeeks <= 10) {
    return [
      { phase: 'base',        name: 'Construction aérobie', weeks: Math.floor(totalWeeks * 0.35) },
      { phase: 'development', name: 'Montée en puissance',  weeks: Math.floor(totalWeeks * 0.40) },
      { phase: 'taper',       name: 'Affûtage',             weeks: Math.ceil(totalWeeks * 0.25) },
    ];
  }
  return [
    { phase: 'base',        name: 'Construction aérobie', weeks: Math.round(totalWeeks * 0.28) },
    { phase: 'development', name: 'Montée en puissance',  weeks: Math.round(totalWeeks * 0.36) },
    { phase: 'specific',    name: 'Simulation course',    weeks: Math.round(totalWeeks * 0.22) },
    { phase: 'taper',       name: 'Affûtage',             weeks: Math.ceil(totalWeeks * 0.14) },
  ];
}

function getPhaseForWeek(weekIndex, blocks) {
  let cursor = 0;
  for (const block of blocks) {
    if (weekIndex < cursor + block.weeks) return block;
    cursor += block.weeks;
  }
  return blocks[blocks.length - 1];
}

// ─── VARIATION DE VOLUME (règle 6 : jamais identique d'une semaine à l'autre)
// Oscillation pseudo-périodique basée sur l'index de semaine.
// L'amplitude oscille entre -15% et +10% selon la position dans le cycle.

function weekVolumeVariation(weekIndex, weekType) {
  if (weekType === 'recovery') return 1.0; // volume de récup déjà calculé
  if (weekType === 'taper')    return 1.0;

  // Oscillation simple : légèrement variable mais jamais identique
  const variations = [1.00, 1.08, 0.95, 1.05, 0.92, 1.10, 0.97, 1.03];
  return variations[weekIndex % variations.length];
}

// ─── ZONES ATHLÈTE V1.21 ─────────────────────────────────────────────────────

function computeZones(athlete) {
  const hrMax = athlete.hr_max || 185;
  const hasHr = !!athlete.hr_max;

  const bpm = {
    z1: [Math.round(hrMax * 0.60), Math.round(hrMax * 0.65)],
    z2: [Math.round(hrMax * 0.65), Math.round(hrMax * 0.75)],
    z3: [Math.round(hrMax * 0.75), Math.round(hrMax * 0.83)],
    z4: [Math.round(hrMax * 0.83), Math.round(hrMax * 0.90)],
    z5: [Math.round(hrMax * 0.90), Math.round(hrMax * 0.96)],
  };

  function zoneLabel(z) {
    const labels = {
      z1: 'Zone 1 — récupération active',
      z2: 'Zone 2 — endurance confortable',
      z3: 'Zone 3 — tempo contrôlé',
      z4: 'Zone 4 — seuil soutenu',
      z5: 'Zone 5 — effort maximal court',
    };
    return hasHr ? `${labels[z]} (~${bpm[z][0]}–${bpm[z][1]} bpm)` : (labels[z] || z);
  }

  let runZ2 = null, runZ4 = null;
  if (athlete.run_10k_pace_seconds) {
    const p = athlete.run_10k_pace_seconds;
    runZ2 = `${secToPace(Math.round(p * 1.22))} /km`;
    runZ4 = `${secToPace(Math.round(p * 1.04))} /km`;
  }

  return { hr: bpm, bpm, hasHr, zoneLabel, runZ2, runZ4 };
}

function secToPace(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── REPOS ───────────────────────────────────────────────────────────────────
// Le repos n'est PAS une séance. Il ne compte pas dans le volume.
// Option : suggestion non comptée (mobilité / gainage léger).

function buildRestSession(date) {
  return {
    discipline: 'rest', session_type: 'rest', name: 'Repos complet',
    date, day_of_week: date.getDay(),
    // Volume = 0 — le repos ne compte jamais dans le total hebdomadaire
    duration_minutes: 0, distance_km: 0, distance_m: 0,
    d_plus: 0, tss_estimated: 0, rpe_target: 0,
    coach_intro: 'Journée sans entraînement. La récupération fait partie du plan — elle n\'est pas optionnelle.',
    session_goal: 'Laisser ton corps assimiler les entraînements de la semaine.',
    optional_suggestion: 'Si tu veux bouger légèrement : 15 min de mobilité articulaire ou gainage doux. Ce n\'est pas obligatoire.',
    blocks: JSON.stringify([]),
  };
}

// ─── NATATION ─────────────────────────────────────────────────────────────────
// Triathlon uniquement. Volume exprimé en temps + mètres.

function buildSwimSession(type, durationMin, zones, date) {
  const z = zones.zoneLabel;
  // Distance en mètres (natation)
  const distanceM = Math.round(durationMin * 45); // ~45 m/min en endurance

  const templates = {
    endurance: {
      name: 'Natation endurance', session_type: 'endurance',
      coach_intro: 'Séance de fond. Nager longtemps à allure confortable — pas se fatiguer. Un éducatif pendant que les bras sont encore frais.',
      session_goal: 'Construire ta base aérobie en eau. La régularité compte plus que l\'intensité.',
      blocks: [
        { name: 'Échauffement', duration_min: Math.round(durationMin * 0.16), zone_label: z('z1'),
          description: '300–400m en nage libre très facile. Relâche les épaules.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null },
        { name: 'Éducatif — rattrapé', duration_min: Math.round(durationMin * 0.12), zone_label: z('z1'),
          description: 'Nage avec un seul bras à la fois, l\'autre tendu devant. 4 × 25m, récupération 15 secondes.',
          reps: '4 × 25m', recovery: '15 s' },
        { name: 'Nage continue endurance', duration_min: Math.round(durationMin * 0.55), zone_label: z('z2'),
          description: 'Nage continue. Concentre-toi sur ta technique entre chaque respiration.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null },
        { name: 'Retour au calme', duration_min: Math.round(durationMin * 0.17), zone_label: z('z1'),
          description: '200m dos ou crawl très lent.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z1[1]} bpm` : null },
      ],
    },
    technique_threshold: {
      name: 'Natation technique + effort soutenu', session_type: 'threshold',
      coach_intro: 'Séance en deux temps : technique quand tu es frais, effort ensuite.',
      session_goal: 'Améliorer ton économie de nage et ta capacité à tenir un effort soutenu.',
      blocks: [
        { name: 'Échauffement', duration_min: Math.round(durationMin * 0.14), zone_label: z('z1'),
          description: '300m en nage libre facile.', target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null },
        { name: 'Éducatifs — 2 exercices', duration_min: Math.round(durationMin * 0.16), zone_label: z('z1'),
          description: '2 × 50m rattrapé · récup 15 s, puis 2 × 50m respiration bilatérale · récup 15 s.',
          reps: '4 × 50m', recovery: '15 s entre chaque' },
        { name: 'Séries effort soutenu', duration_min: Math.round(durationMin * 0.52), zone_label: z('z4'),
          description: 'Effort soutenu et régulier. Même allure sur toutes les répétitions. Récupération 20 s.',
          target_hr: zones.hasHr ? `${zones.bpm.z4[0]}–${zones.bpm.z4[1]} bpm` : null,
          reps: `${Math.round(durationMin * 0.52 / 10)} × 100m`, recovery: '20 s' },
        { name: 'Retour au calme', duration_min: Math.round(durationMin * 0.18), zone_label: z('z1'),
          description: '200m très lent.', target_hr: zones.hasHr ? `< ${zones.bpm.z1[1]} bpm` : null },
      ],
    },
    recovery: {
      name: 'Natation récupération', session_type: 'recovery',
      coach_intro: 'Séance très légère. Maintenir le rythme de nage sans créer de fatigue.',
      session_goal: 'Entretenir la sensation de l\'eau et favoriser la récupération active.',
      blocks: [
        { name: 'Éducatif — battements', duration_min: Math.round(durationMin * 0.20), zone_label: z('z1'),
          description: 'Planche en main, jambes seules. 4 × 25m, récupération libre.', reps: '4 × 25m', recovery: 'à ton rythme' },
        { name: 'Nage libre très facile', duration_min: Math.round(durationMin * 0.80), zone_label: z('z1'),
          description: 'Nage continue, allure conversationnelle.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null },
      ],
    },
  };

  const t = templates[type] || templates.endurance;
  return {
    discipline: 'swim', session_type: t.session_type, name: t.name, date, day_of_week: date.getDay(),
    duration_minutes: durationMin,
    distance_km: null,         // natation : pas de km
    distance_m: distanceM,     // natation : en mètres
    d_plus: 0,
    tss_estimated: Math.round(durationMin * (type === 'threshold' ? 1.4 : 0.75)),
    rpe_target: type === 'threshold' ? 7 : type === 'recovery' ? 4 : 5,
    coach_intro: t.coach_intro, session_goal: t.session_goal, blocks: JSON.stringify(t.blocks),
  };
}

// ─── VÉLO ────────────────────────────────────────────────────────────────────
// Triathlon uniquement. Volume en temps + kilomètres.

function buildBikeSession(type, durationMin, zones, date) {
  const z = zones.zoneLabel;
  const repCount = Math.max(2, Math.min(5, Math.round((durationMin - 30) / 12)));
  const distKm   = Math.round(durationMin * 0.58 * 10) / 10; // ~35 km/h

  const templates = {
    endurance: {
      name: 'Vélo endurance fondamentale', session_type: 'endurance',
      coach_intro: 'Sortie en endurance. Le vélo se travaille d\'abord à basse intensité — résiste à l\'envie d\'accélérer.',
      session_goal: 'Développer ton moteur aérobie et habituer tes jambes à pédaler longtemps.',
      blocks: [
        { name: 'Mise en route', duration_min: 15, zone_label: z('z1'),
          description: 'Pédale très légèrement. Cadence 85–90 rpm, résistance minimale.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null },
        { name: 'Endurance continue', duration_min: Math.max(20, durationMin - 25), zone_label: z('z2'),
          description: 'Allure conversationnelle. Si tu dois souffler pour parler, réduis la résistance. Mange et bois toutes les 20 minutes.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null },
        { name: 'Retour au calme', duration_min: 10, zone_label: z('z1'),
          description: 'Pédalage très léger. Cadence libre.', target_hr: zones.hasHr ? `< ${zones.bpm.z1[1]} bpm` : null },
      ],
    },
    tempo: {
      name: 'Vélo tempo contrôlé', session_type: 'tempo',
      coach_intro: 'Effort soutenu mais maîtrisable. Tu peux dire une phrase entière — pas une conversation.',
      session_goal: 'Travailler l\'intensité modérée que tu tiendras sur une bonne partie du vélo en triathlon.',
      blocks: [
        { name: 'Échauffement', duration_min: 15, zone_label: z('z1'),
          description: 'Pédalage très facile, monte progressivement.', target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null },
        { name: 'Effort tempo', duration_min: Math.max(20, durationMin - 25), zone_label: z('z3'),
          description: 'Effort soutenu et régulier. Résistance constante.',
          target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null },
        { name: 'Retour au calme', duration_min: 10, zone_label: z('z1'),
          description: 'Pédale très légèrement.', target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null },
      ],
    },
    threshold: {
      name: 'Vélo intervalles seuil', session_type: 'threshold',
      coach_intro: 'Séance qualité. Tu travailles à ton effort maximal sur une heure.',
      session_goal: 'Améliorer ta capacité à soutenir un effort élevé longtemps sur le vélo.',
      blocks: [
        { name: 'Échauffement', duration_min: 20, zone_label: z('z1'),
          description: 'Pédalage facile. 2 × 30 secondes d\'accélération légère à 15 min.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[1]} bpm` : null },
        { name: `${repCount} × 8 min seuil`, duration_min: Math.round(durationMin * 0.55), zone_label: z('z4'),
          description: 'Effort dur et régulier. Tu peux dire trois mots, pas plus. Récupération 3 min de pédalage léger.',
          target_hr: zones.hasHr ? `${zones.bpm.z4[0]}–${zones.bpm.z4[1]} bpm` : null,
          reps: `${repCount} × 8 min`, recovery: '3 min pédalage léger' },
        { name: 'Retour au calme', duration_min: 10, zone_label: z('z1'),
          description: 'Pédale très légèrement. Étire les quadriceps.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z1[1]} bpm` : null },
      ],
    },
    long_ride: {
      name: 'Sortie longue vélo', session_type: 'long',
      coach_intro: 'LA séance de la semaine. Simule la partie vélo de ta course. Gère ton effort et ton alimentation dès le départ.',
      session_goal: 'Habituer ton corps à pédaler longtemps. L\'alimentation et l\'hydratation s\'apprennent ici.',
      blocks: [
        { name: 'Mise en route', duration_min: 20, zone_label: z('z1'),
          description: 'Montée en température progressive.', target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null },
        { name: 'Endurance continue', duration_min: Math.round(durationMin * 0.62), zone_label: z('z2'),
          description: 'Allure conversationnelle. Mange toutes les 20 min, bois toutes les 15 min.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null },
        { name: 'Bloc tempo inclus', duration_min: 20, zone_label: z('z3'),
          description: '20 min légèrement plus soutenues. Sens comment tu réagis quand les jambes sont chargées.',
          target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null },
        { name: 'Retour au calme', duration_min: 15, zone_label: z('z1'),
          description: 'Réduis progressivement. Les 10 derniers km très légers.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null },
      ],
    },
  };

  const t = templates[type] || templates.endurance;
  return {
    discipline: 'bike', session_type: t.session_type, name: t.name, date, day_of_week: date.getDay(),
    duration_minutes: durationMin,
    distance_km: distKm, distance_m: null, d_plus: 0,
    tss_estimated: Math.round(durationMin * (type === 'threshold' ? 1.5 : type === 'long_ride' ? 1.1 : type === 'tempo' ? 1.2 : 0.8)),
    rpe_target: type === 'threshold' ? 8 : type === 'long_ride' ? 6 : type === 'tempo' ? 7 : 5,
    coach_intro: t.coach_intro, session_goal: t.session_goal, blocks: JSON.stringify(t.blocks),
  };
}

// ─── COURSE À PIED ROUTE ──────────────────────────────────────────────────────
// Volume en temps + kilomètres (calculés depuis l'allure réelle si dispo).

function buildRunSession(type, durationMin, zones, date) {
  const z = zones.zoneLabel;
  const repCount = Math.max(3, Math.min(6, Math.round((durationMin - 25) / 8)));

  // Distance km : utiliser l'allure Z2 si disponible, sinon estimation
  let distKm;
  if (zones.runZ2) {
    const paceMatch = zones.runZ2.match(/(\d+):(\d+)/);
    if (paceMatch) {
      const paceSecPerKm = parseInt(paceMatch[1]) * 60 + parseInt(paceMatch[2]);
      distKm = Math.round((durationMin * 60 / paceSecPerKm) * 10) / 10;
    }
  }
  if (!distKm) distKm = Math.round(durationMin * 0.175 * 10) / 10;

  const templates = {
    endurance: {
      name: 'Footing endurance', session_type: 'endurance',
      coach_intro: 'Sortie facile. L\'allure doit être conversationnelle du début à la fin.',
      session_goal: 'Construire ton volume de course sans créer de fatigue.',
      blocks: [
        { name: 'Footing continu', duration_min: durationMin, zone_label: z('z2'),
          description: 'Allure très facile. Tu dois pouvoir tenir une conversation entière sans effort.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[1]} bpm` : null,
          target_pace: zones.runZ2 || 'allure conversationnelle' },
      ],
    },
    threshold: {
      name: 'Intervalles seuil', session_type: 'threshold',
      coach_intro: 'Séance qualité. Tu vas apprendre à tenir un effort soutenu sans t\'épuiser.',
      session_goal: 'Améliorer ta capacité à courir vite longtemps.',
      blocks: [
        { name: 'Échauffement', duration_min: 15, zone_label: z('z1'),
          description: 'Trot très facile 10 min, puis 4×20 secondes d\'accélérations progressives.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[1]} bpm` : null },
        { name: `${repCount} × 6 min seuil`, duration_min: repCount * 8, zone_label: z('z4'),
          description: 'Effort soutenu mais maîtrisé. Tu dois pouvoir dire une phrase courte, pas plus.',
          target_hr: zones.hasHr ? `${zones.bpm.z4[0]}–${zones.bpm.z4[1]} bpm` : null,
          target_pace: zones.runZ4 || 'allure seuil', reps: `${repCount} × 6 min`, recovery: '2 min trot très léger' },
        { name: 'Retour au calme', duration_min: 10, zone_label: z('z1'),
          description: 'Trot très léger. Étire quadriceps et mollets.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null },
      ],
    },
    long_run: {
      name: 'Sortie longue', session_type: 'long',
      coach_intro: 'La sortie longue de la semaine. Objectif : tenir l\'effort sur la durée.',
      session_goal: 'Développer ton endurance de fond. La durée sur les pieds est irremplaçable.',
      blocks: [
        { name: 'Sortie longue continue', duration_min: Math.round(durationMin * 0.75), zone_label: z('z2'),
          description: 'Allure endurance, conversationnelle. Mange et bois si la sortie dépasse 1h15.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
          target_pace: zones.runZ2 || 'allure confortable' },
        { name: 'Progression finale', duration_min: Math.round(durationMin * 0.25), zone_label: z('z3'),
          description: 'Accélère légèrement sur la fin — sens que tu peux encore.',
          target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null },
      ],
    },
    tempo: {
      name: 'Tempo course', session_type: 'tempo',
      coach_intro: 'Effort soutenu et maîtrisé. Tu peux dire une phrase entière, mais tu ne pourrais pas chanter.',
      session_goal: 'Développer ta capacité à courir longtemps à allure modérément exigeante.',
      blocks: [
        { name: 'Échauffement', duration_min: 12, zone_label: z('z1'),
          description: 'Trot léger, monte progressivement.', target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null },
        { name: 'Effort tempo', duration_min: Math.max(15, durationMin - 22), zone_label: z('z3'),
          description: 'Allure soutenue et régulière. Constant du début à la fin.',
          target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null },
        { name: 'Retour au calme', duration_min: 10, zone_label: z('z1'),
          description: 'Trot très léger.', target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null },
      ],
    },
  };

  const t = templates[type] || templates.endurance;
  return {
    discipline: 'run', session_type: t.session_type, name: t.name, date, day_of_week: date.getDay(),
    duration_minutes: durationMin,
    distance_km: distKm, distance_m: null, d_plus: 0,
    tss_estimated: Math.round(durationMin * (type === 'threshold' ? 1.6 : type === 'long_run' ? 1.1 : type === 'tempo' ? 1.3 : 0.8)),
    rpe_target: type === 'threshold' ? 7 : type === 'long_run' ? 6 : type === 'tempo' ? 7 : 4,
    coach_intro: t.coach_intro, session_goal: t.session_goal, blocks: JSON.stringify(t.blocks),
  };
}

// ─── TRAIL — Discipline distincte avec D+ ────────────────────────────────────
// Volume en temps + km terrain + D+ estimé.

function buildTrailSession(type, durationMin, zones, date, trailCategory) {
  const z = zones.zoneLabel;
  const isLong   = trailCategory === 'run_trail_long' || trailCategory === 'run_trail_ultra';
  const repCount = Math.max(3, Math.min(5, Math.round((durationMin - 25) / 9)));

  // Distance km terrain (plus lent que route)
  const speedKmh = TRAIL_SPEED_KMH[trailCategory] || 6.0;
  const distKm   = Math.round((durationMin / 60) * speedKmh * 10) / 10;

  // D+ estimé selon durée et catégorie
  const dPlusPerHour = TRAIL_DPLUS_PER_HOUR[trailCategory] || 500;
  const dPlus = type === 'long_run'
    ? Math.round((durationMin / 60) * dPlusPerHour)
    : type === 'threshold'
    ? Math.round((durationMin / 60) * dPlusPerHour * 0.7)
    : Math.round((durationMin / 60) * dPlusPerHour * 0.4); // endurance/strength : moins de D+

  const templates = {
    endurance: {
      name: 'Sortie trail endurance', session_type: 'endurance',
      coach_intro: 'Sortie facile en nature. En trail, la marche rapide dans les montées est une technique, pas un échec.',
      session_goal: 'Construire ton volume de course en nature et habituer tes jambes aux irrégularités du terrain.',
      blocks: [
        { name: 'Sortie trail continue', duration_min: durationMin, zone_label: z('z2'),
          description: 'Allure facile. Marche dans les montées raides, trot dans les descentes. Priorité au temps sur les pieds, pas à la vitesse.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[1]} bpm` : null },
      ],
    },
    long_run: {
      name: isLong ? 'Sortie longue trail avec dénivelé' : 'Sortie longue trail',
      session_type: 'long',
      coach_intro: isLong
        ? 'LA séance de la semaine. Intègre du dénivelé positif. C\'est ici que le trail se gagne ou se perd.'
        : 'La sortie longue. Cherche des chemins avec quelques montées.',
      session_goal: isLong
        ? 'Habituer tes quadriceps et tes chevilles aux descentes prolongées.'
        : 'Développer ton endurance trail. Terrain et durée comptent plus que la vitesse.',
      blocks: [
        { name: 'Mise en route', duration_min: 15, zone_label: z('z1'),
          description: 'Départ très progressif. Laisse ton corps trouver son rythme.' },
        { name: 'Corps de sortie', duration_min: Math.round(durationMin * 0.70), zone_label: z('z2'),
          description: isLong
            ? 'Alternance course / marche selon le terrain. Cherche des montées significatives. Marche en montée, contrôle en descente.'
            : 'Alternance course / marche selon le terrain. Gestion de l\'effort avant tout.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null },
        { name: 'Bloc descentes', duration_min: Math.round(durationMin * 0.15), zone_label: z('z3'),
          description: 'Travail en descente — relâche les bras, courtes foulées, regard loin.' },
        { name: 'Retour au calme', duration_min: Math.round(durationMin * 0.15), zone_label: z('z1'),
          description: 'Trot ou marche très léger. Étire quadriceps et mollets.' },
      ],
    },
    threshold: {
      name: 'Séance qualité trail — côtes', session_type: 'threshold',
      coach_intro: 'Travail en côte. L\'objectif est de développer ta puissance en montée, pas ta vitesse sur le plat.',
      session_goal: 'Renforcer les muscles spécifiques au trail et améliorer ton économie en montée.',
      blocks: [
        { name: 'Échauffement', duration_min: 15, zone_label: z('z1'),
          description: 'Trot facile sur terrain plat. 2–3 min de marche rapide en fin d\'échauffement.' },
        { name: `${repCount} × montées`, duration_min: repCount * 9, zone_label: z('z4'),
          description: 'Monte une côte à effort soutenu (3–5 min). Marche ou trot léger en redescente.',
          target_hr: zones.hasHr ? `${zones.bpm.z4[0]}–${zones.bpm.z4[1]} bpm` : null,
          reps: `${repCount} × 3–5 min`, recovery: 'descente en trot léger' },
        { name: 'Retour au calme', duration_min: 10, zone_label: z('z1'),
          description: 'Trot très léger sur terrain plat. Étire mollets et quadriceps.' },
      ],
    },
    strength: {
      name: 'Renforcement spécifique trail', session_type: 'endurance',
      coach_intro: 'Séance de renforcement. Elle complète les sorties en ciblant les muscles stabilisateurs.',
      session_goal: 'Prévenir les blessures et améliorer ta stabilité en descente et sur terrain irrégulier.',
      blocks: [
        { name: 'Gainage et chevilles', duration_min: Math.round(durationMin * 0.35), zone_label: z('z1'),
          description: '3 × 45s gainage ventral, 3 × 15 squats unipodaux, 3 × 20 montées de cheville. Récup 30 s entre chaque série.' },
        { name: 'Foulées éducatives', duration_min: Math.round(durationMin * 0.40), zone_label: z('z2'),
          description: 'Trot léger en alternant terrain plat et petites montées. Concentration sur l\'appui du pied.' },
        { name: 'Étirements actifs', duration_min: Math.round(durationMin * 0.25), zone_label: z('z1'),
          description: 'Fentes, rotations de chevilles, mobilité de hanches. 30 secondes par mouvement.' },
      ],
    },
  };

  const t = templates[type] || templates.endurance;
  return {
    discipline: 'run', session_type: t.session_type, name: t.name, date, day_of_week: date.getDay(),
    duration_minutes: durationMin,
    distance_km: distKm, distance_m: null, d_plus: dPlus,
    tss_estimated: Math.round(durationMin * (type === 'long_run' ? 1.3 : type === 'threshold' ? 1.5 : 1.0)),
    rpe_target: type === 'threshold' ? 7 : type === 'long_run' ? 7 : 5,
    coach_intro: t.coach_intro, session_goal: t.session_goal, blocks: JSON.stringify(t.blocks),
  };
}

// ─── BRICK ────────────────────────────────────────────────────────────────────

function buildBrickSession(bikeDuration, runDuration, zones, date) {
  const z = zones.zoneLabel;
  const bikeKm = Math.round(bikeDuration * 0.58 * 10) / 10;
  const runKm  = Math.round(runDuration * 0.175 * 10) / 10;
  return {
    discipline: 'brick', session_type: 'brick', name: 'Enchaînement vélo → course',
    date, day_of_week: date.getDay(),
    duration_minutes: bikeDuration + runDuration,
    distance_km: Math.round((bikeKm + runKm) * 10) / 10,
    distance_m: null, d_plus: 0,
    tss_estimated: Math.round((bikeDuration * 1.0 + runDuration * 1.3)),
    rpe_target: 7,
    coach_intro: 'Séance de transition. Tu apprends à courir alors que tes jambes ont déjà pédalé — spécifique au triathlon.',
    session_goal: 'Habituer ton système neuromusculaire à changer de discipline.',
    blocks: JSON.stringify([
      { name: `Vélo — ${bikeDuration} min`, duration_min: bikeDuration, zone_label: z('z2'),
        description: `Endurance (${bikeDuration - 15} min), puis monte légèrement sur les 15 dernières minutes.`,
        target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z3[1]} bpm` : null },
      { name: 'Transition T2', duration_min: 3,
        description: 'Change de chaussures, bois un peu. Note tes sensations dans les jambes.' },
      { name: `Course — ${runDuration} min`, duration_min: runDuration, zone_label: z('z2'),
        description: 'Les premières minutes seront étranges — normal. Commence léger, monte progressivement.',
        target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z3[0]} bpm` : null,
        target_pace: zones.runZ2 || 'allure progressive' },
    ]),
  };
}

// ─── PATTERNS PAR SPORT ET PHASE ──────────────────────────────────────────────
// Règle 7 : TRIATHLON = 50% vélo / 30% course / 20% natation (STRICT)
// Règle 9 : doubles séances autorisées UNIQUEMENT en triathlon (séance légère + séance qualité)

function getWeekPattern(sport, phase) {

  // ── TRIATHLON ──────────────────────────────────────────────────────────────
  // Répartition stricte : bike 50% / run 30% / swim 20%
  // pct = proportion du volume hebdomadaire (hors repos)
  if (sport === 'triathlon') {
    const p = {
      base: [
        { day:0, discipline:'rest',  type:'rest',                pct:0    },
        { day:1, discipline:'run',   type:'endurance',           pct:0.15 }, // 15% run
        { day:2, discipline:'bike',  type:'endurance',           pct:0.25 }, // 25% bike
        { day:3, discipline:'swim',  type:'endurance',           pct:0.10 }, // 10% swim
        { day:3, discipline:'run',   type:'endurance',           pct:0.10 }, // double J3 (léger+léger) = 10% run → total run 30%
        { day:4, discipline:'bike',  type:'endurance',           pct:0.25 }, // 25% bike → total bike 50%
        { day:5, discipline:'swim',  type:'endurance',           pct:0.10 }, // 10% swim → total swim 20%
        { day:6, discipline:'rest',  type:'rest',                pct:0    },
      ],
      development: [
        { day:0, discipline:'rest',  type:'rest',                pct:0    },
        { day:1, discipline:'run',   type:'threshold',           pct:0.15 },
        { day:2, discipline:'bike',  type:'endurance',           pct:0.25 },
        { day:3, discipline:'swim',  type:'technique_threshold', pct:0.10 },
        { day:3, discipline:'run',   type:'endurance',           pct:0.10 }, // double : qualité swim matin + footing léger soir
        { day:4, discipline:'bike',  type:'tempo',               pct:0.25 },
        { day:5, discipline:'swim',  type:'endurance',           pct:0.10 },
        { day:6, discipline:'brick', type:'brick',               pct:0.05 }, // brick compact
      ],
      specific: [
        { day:0, discipline:'rest',  type:'rest',                pct:0    },
        { day:1, discipline:'run',   type:'threshold',           pct:0.15 },
        { day:2, discipline:'bike',  type:'threshold',           pct:0.25 },
        { day:3, discipline:'swim',  type:'technique_threshold', pct:0.10 },
        { day:3, discipline:'run',   type:'endurance',           pct:0.10 }, // double : qualité swim + footing léger
        { day:4, discipline:'bike',  type:'long_ride',           pct:0.15 },
        { day:5, discipline:'swim',  type:'recovery',            pct:0.10 },
        { day:6, discipline:'brick', type:'brick',               pct:0.15 },
      ],
      taper: [
        { day:0, discipline:'rest',  type:'rest',      pct:0    },
        { day:1, discipline:'run',   type:'threshold', pct:0.18 },
        { day:2, discipline:'bike',  type:'endurance', pct:0.30 },
        { day:3, discipline:'swim',  type:'recovery',  pct:0.14 },
        { day:4, discipline:'rest',  type:'rest',      pct:0    },
        { day:5, discipline:'bike',  type:'endurance', pct:0.20 },
        { day:6, discipline:'run',   type:'endurance', pct:0.18 },
      ],
    };
    return p[phase] || p.base;
  }

  // ── COURSE À PIED ROUTE ────────────────────────────────────────────────────
  // Run uniquement. Pas de vélo ni natation.
  if (sport === 'run') {
    const p = {
      base: [
        { day:0, discipline:'rest', type:'rest',      pct:0    },
        { day:1, discipline:'run',  type:'endurance', pct:0.20 },
        { day:2, discipline:'run',  type:'tempo',     pct:0.22 },
        { day:3, discipline:'rest', type:'rest',      pct:0    },
        { day:4, discipline:'run',  type:'endurance', pct:0.18 },
        { day:5, discipline:'run',  type:'long_run',  pct:0.28 },
        { day:6, discipline:'run',  type:'endurance', pct:0.12 },
      ],
      development: [
        { day:0, discipline:'rest', type:'rest',      pct:0    },
        { day:1, discipline:'run',  type:'threshold', pct:0.18 },
        { day:2, discipline:'run',  type:'endurance', pct:0.16 },
        { day:3, discipline:'rest', type:'rest',      pct:0    },
        { day:4, discipline:'run',  type:'tempo',     pct:0.18 },
        { day:5, discipline:'run',  type:'long_run',  pct:0.32 },
        { day:6, discipline:'run',  type:'endurance', pct:0.16 },
      ],
      specific: [
        { day:0, discipline:'rest', type:'rest',      pct:0    },
        { day:1, discipline:'run',  type:'threshold', pct:0.18 },
        { day:2, discipline:'run',  type:'endurance', pct:0.14 },
        { day:3, discipline:'rest', type:'rest',      pct:0    },
        { day:4, discipline:'run',  type:'threshold', pct:0.16 },
        { day:5, discipline:'run',  type:'long_run',  pct:0.36 },
        { day:6, discipline:'run',  type:'endurance', pct:0.16 },
      ],
      taper: [
        { day:0, discipline:'rest', type:'rest',      pct:0    },
        { day:1, discipline:'run',  type:'threshold', pct:0.24 },
        { day:2, discipline:'run',  type:'endurance', pct:0.22 },
        { day:3, discipline:'rest', type:'rest',      pct:0    },
        { day:4, discipline:'rest', type:'rest',      pct:0    },
        { day:5, discipline:'run',  type:'endurance', pct:0.30 },
        { day:6, discipline:'run',  type:'endurance', pct:0.24 },
      ],
    };
    return p[phase] || p.base;
  }

  // ── TRAIL ──────────────────────────────────────────────────────────────────
  if (sport === 'trail') {
    const p = {
      base: [
        { day:0, discipline:'rest',  type:'rest',      pct:0    },
        { day:1, discipline:'trail', type:'endurance', pct:0.18 },
        { day:2, discipline:'trail', type:'strength',  pct:0.14 },
        { day:3, discipline:'rest',  type:'rest',      pct:0    },
        { day:4, discipline:'trail', type:'endurance', pct:0.16 },
        { day:5, discipline:'trail', type:'long_run',  pct:0.36 },
        { day:6, discipline:'trail', type:'endurance', pct:0.16 },
      ],
      development: [
        { day:0, discipline:'rest',  type:'rest',      pct:0    },
        { day:1, discipline:'trail', type:'threshold', pct:0.16 },
        { day:2, discipline:'trail', type:'endurance', pct:0.14 },
        { day:3, discipline:'rest',  type:'rest',      pct:0    },
        { day:4, discipline:'trail', type:'strength',  pct:0.12 },
        { day:5, discipline:'trail', type:'long_run',  pct:0.38 },
        { day:6, discipline:'trail', type:'endurance', pct:0.20 },
      ],
      specific: [
        { day:0, discipline:'rest',  type:'rest',      pct:0    },
        { day:1, discipline:'trail', type:'threshold', pct:0.16 },
        { day:2, discipline:'trail', type:'endurance', pct:0.12 },
        { day:3, discipline:'rest',  type:'rest',      pct:0    },
        { day:4, discipline:'trail', type:'endurance', pct:0.14 },
        { day:5, discipline:'trail', type:'long_run',  pct:0.40 },
        { day:6, discipline:'trail', type:'endurance', pct:0.18 },
      ],
      taper: [
        { day:0, discipline:'rest',  type:'rest',      pct:0    },
        { day:1, discipline:'trail', type:'threshold', pct:0.24 },
        { day:2, discipline:'trail', type:'endurance', pct:0.20 },
        { day:3, discipline:'rest',  type:'rest',      pct:0    },
        { day:4, discipline:'rest',  type:'rest',      pct:0    },
        { day:5, discipline:'trail', type:'endurance', pct:0.32 },
        { day:6, discipline:'trail', type:'endurance', pct:0.24 },
      ],
    };
    return p[phase] || p.base;
  }

  return [];
}

// ─── GARDE D'INTENSITÉ POUR DOUBLES SÉANCES ──────────────────────────────────
// Règle 9 : en triathlon, si deux séances le même jour,
// une seule peut être intense (threshold/tempo/brick).
// L'autre doit être légère (endurance/recovery/technique).

function isIntenseSessionType(type) {
  return ['threshold', 'tempo', 'brick'].includes(type);
}

function sanitizeDoubleSessions(daySlots) {
  // Si plusieurs slots le même jour, au plus 1 peut être intense
  const intenseSlots = daySlots.filter(s => s.discipline !== 'rest' && isIntenseSessionType(s.type));
  if (intenseSlots.length <= 1) return daySlots; // OK

  // Garder la première séance intense, convertir les autres en endurance
  let keptIntense = false;
  return daySlots.map(slot => {
    if (slot.discipline === 'rest' || !isIntenseSessionType(slot.type)) return slot;
    if (!keptIntense) { keptIntense = true; return slot; }
    // Convertir en endurance légère
    return { ...slot, type: 'endurance' };
  });
}

// ─── GÉNÉRATEUR PRINCIPAL ─────────────────────────────────────────────────────

function generatePlan(athlete, objective) {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const raceDate   = new Date(objective.race_date);
  const sport      = getSportType(objective.discipline);
  const totalWeeks = Math.max(2, Math.floor((raceDate - startDate) / (7 * 24 * 60 * 60 * 1000)));
  const blocks     = computeBlocks(totalWeeks);
  const zones      = computeZones(athlete);

  // Volume de base = moyenne déclarée par l'athlète (règle 6)
  const baseVol = (athlete.weekly_hours_current || 5) * 60;
  const peakVol = Math.min(baseVol * 1.7, PEAK_VOLUMES[objective.discipline] || 480);

  const weeks = [];
  let rollingVol = baseVol;

  for (let w = 0; w < totalWeeks; w++) {
    const block      = getPhaseForWeek(w, blocks);
    const isRecovery = w > 0 && (w + 1) % 3 === 0 && block.phase !== 'taper';
    const isTaper    = block.phase === 'taper';

    let weekVol;
    if (isTaper) {
      const taperIdx = w - (totalWeeks - blocks.find(b => b.phase === 'taper').weeks);
      weekVol = peakVol * (taperIdx === 0 ? 0.60 : 0.42);
    } else if (isRecovery) {
      weekVol = rollingVol * 0.65;
    } else {
      // Progression avec variation (règle 6 : jamais identique)
      const variation = weekVolumeVariation(w, 'charge');
      weekVol = Math.min(rollingVol * 1.08 * variation, peakVol);
      rollingVol = Math.min(rollingVol * 1.08, peakVol); // progression de référence sans variation
    }
    weekVol = Math.round(weekVol);

    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + w * 7);
    const weekType  = isTaper ? 'taper' : isRecovery ? 'recovery' : 'charge';
    const pattern   = getWeekPattern(sport, block.phase);

    // Grouper les slots par jour, appliquer la garde d'intensité
    const slotsByDay = {};
    for (const slot of pattern) {
      if (!slotsByDay[slot.day]) slotsByDay[slot.day] = [];
      slotsByDay[slot.day].push(slot);
    }

    // Appliquer la garde d'intensité (doubles séances triathlon uniquement)
    if (sport === 'triathlon') {
      for (const day in slotsByDay) {
        slotsByDay[day] = sanitizeDoubleSessions(slotsByDay[day]);
      }
    }

    const sessions = [];
    const sortedDays = [...new Set(pattern.map(s => s.day))].sort((a, b) => a - b);

    for (const day of sortedDays) {
      const daySlots = slotsByDay[day];
      const sessionDate = new Date(weekStart);
      sessionDate.setDate(weekStart.getDate() + day);

      // Jour de repos pur (tous les slots sont rest)
      if (daySlots.every(s => s.discipline === 'rest')) {
        sessions.push(buildRestSession(sessionDate));
        continue;
      }

      for (const slot of daySlots) {
        if (slot.discipline === 'rest') continue; // ignorer les slots rest mélangés
        const durMin = Math.max(20, Math.round(weekVol * slot.pct));
        if (slot.discipline === 'swim')  sessions.push(buildSwimSession(slot.type, durMin, zones, sessionDate));
        else if (slot.discipline === 'bike')  sessions.push(buildBikeSession(slot.type, durMin, zones, sessionDate));
        else if (slot.discipline === 'run')   sessions.push(buildRunSession(slot.type, durMin, zones, sessionDate));
        else if (slot.discipline === 'trail') sessions.push(buildTrailSession(slot.type, durMin, zones, sessionDate, objective.discipline));
        else if (slot.discipline === 'brick') {
          sessions.push(buildBrickSession(Math.round(durMin * 0.60), Math.round(durMin * 0.40), zones, sessionDate));
        }
      }
    }

    // ── Volume réel (repos exclu) + D+ hebdomadaire agrégé ───────────────
    const trainingSessions = sessions.filter(s => s.discipline !== 'rest');
    const actualVol = trainingSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const weekDplus = trainingSessions.reduce((sum, s) => sum + (s.d_plus || 0), 0);
    const weekKm    = trainingSessions.reduce((sum, s) => sum + (s.distance_km || 0), 0);
    const weekDistM = trainingSessions.reduce((sum, s) => sum + (s.distance_m || 0), 0);

    weeks.push({
      week_number: w + 1, phase: block.phase, phase_name: block.name,
      week_type: weekType, start_date: weekStart.toISOString().split('T')[0],
      target_volume_minutes: actualVol,
      weekly_km:     Math.round(weekKm * 10) / 10,    // km totaux (vélo + CAP)
      weekly_d_plus: weekDplus,                         // D+ total (trail)
      weekly_dist_m: weekDistM,                         // mètres (natation)
      sessions,
    });
  }

  return { total_weeks: totalWeeks, start_date: startDate.toISOString().split('T')[0], weeks };
}

// ─── FAISABILITÉ V1.21 — contextualisée par sport, volume ET temps cible ─────

function analyzeFeasibility(athlete, objective) {
  const raceDate       = new Date(objective.race_date);
  const weeksAvailable = Math.max(0, Math.floor((raceDate - new Date()) / (7 * 24 * 60 * 60 * 1000)));
  const baseVol        = (athlete.weekly_hours_current || 5) * 60;
  const sport          = getSportType(objective.discipline);
  const peakRequired   = PEAK_VOLUMES[objective.discipline] || 480;
  const minW           = MIN_WEEKS[objective.discipline] || 10;
  const hPerWeek       = +(athlete.weekly_hours_current || 5).toFixed(1);

  let score = 100;
  const issues = [];

  // ── Temps disponible ───────────────────────────────────────────────────────
  if (weeksAvailable < minW * 0.6)      { score -= 40; issues.push('temps_critique'); }
  else if (weeksAvailable < minW * 0.85){ score -= 22; issues.push('temps_juste'); }

  // ── Volume actuel vs requis ────────────────────────────────────────────────
  // Contextualisé : 3h/sem peut suffire pour un 10k, pas pour un marathon
  const volRatio = baseVol / peakRequired;
  if (volRatio < 0.25)      { score -= 40; issues.push('volume_critique'); }
  else if (volRatio < 0.45) { score -= 25; issues.push('volume_trop_bas'); }
  else if (volRatio < 0.60) { score -= 12; issues.push('volume_bas'); }

  // ── Temps cible vs allure actuelle (règles 5 et 12) ─────────────────────
  let paceGapPenalty = 0;
  if (athlete.run_10k_pace_seconds && objective.target_time_sec) {
    const estimated = estimateTargetTime(athlete, objective.discipline);
    if (estimated) {
      // gap = % d'écart entre objectif temps et capacité actuelle
      // négatif = objectif plus rapide que le niveau → effort de progression requis
      const gapPct = (objective.target_time_sec - estimated) / estimated;
      if (gapPct < -0.25)      { paceGapPenalty = 35; issues.push('objectif_tres_ambitieux'); }
      else if (gapPct < -0.12) { paceGapPenalty = 20; issues.push('objectif_ambitieux'); }
      else if (gapPct < -0.05) { paceGapPenalty = 8;  issues.push('objectif_exigeant'); }
      score -= paceGapPenalty;
    }
  }

  // ── Blessures ──────────────────────────────────────────────────────────────
  const injuryZones = JSON.parse(athlete.injury_zones || '[]');
  if (injuryZones.length > 0) score -= 8;

  // ── Messages contextualisés par sport et volume ───────────────────────────
  const targetTimeStr = objective.target_time_sec ? formatDuration(objective.target_time_sec) : null;

  function buildMsg(state) {
    const timeCtx = targetTimeStr ? ` en ${targetTimeStr}` : '';
    if (sport === 'triathlon') {
      return {
        realistic: `${weeksAvailable} semaines depuis ton niveau actuel (${hPerWeek}h/sem), c'est suffisant. Le plan sera exigeant mais réaliste si tu es régulier.`,
        ambitious: `${weeksAvailable} semaines avec ${hPerWeek}h/sem pour ce triathlon${timeCtx}, c'est ambitieux. Pas impossible — mais ça ne laisse aucune marge.`,
        risky:     `${hPerWeek}h/sem avec ${weeksAvailable} semaines, c'est trop juste pour cette distance triathlon${timeCtx} sans risque de blessure.`,
      }[state];
    }
    if (sport === 'run') {
      return {
        realistic: `${hPerWeek}h/sem et ${weeksAvailable} semaines pour ${disciplineNameFr(objective.discipline)}${timeCtx} — c'est bien calibré. Le plan t'y amène progressivement.`,
        ambitious: `${hPerWeek}h/sem pour ${disciplineNameFr(objective.discipline)}${timeCtx}, c'est faisable — mais chaque séance compte. La régularité est décisive.`,
        risky:     `${hPerWeek}h/sem en ${weeksAvailable} semaines pour ${disciplineNameFr(objective.discipline)}${timeCtx}, c'est un peu serré. Je te suggère l'alternative ci-dessous.`,
      }[state];
    }
    if (sport === 'trail') {
      return {
        realistic: `${hPerWeek}h/sem et ${weeksAvailable} semaines pour ce trail${timeCtx} — adapté. Le dénivelé est intégré progressivement.`,
        ambitious: `${hPerWeek}h/sem pour ce trail${timeCtx}, c'est ambitieux. Le dénivelé demande plus que la distance seule — sois régulier.`,
        risky:     `${hPerWeek}h/sem avec ${weeksAvailable} semaines${timeCtx} — insuffisant pour ce trail sans risque. Le D+ est exigeant pour les muscles.`,
      }[state];
    }
    return '';
  }

  let verdict, message, suggestion;
  if (score >= 75)      { verdict = 'realistic'; message = buildMsg('realistic'); suggestion = null; }
  else if (score >= 48) { verdict = 'ambitious'; message = buildMsg('ambitious'); suggestion = getAlternativeObjective(objective); }
  else                  { verdict = 'risky';     message = buildMsg('risky');     suggestion = getAlternativeObjective(objective); }

  // Ajout du contexte temps cible si manquant
  let paceNote = null;
  if (athlete.run_10k_pace_seconds && !objective.target_time_sec) {
    const est = estimateTargetTime(athlete, objective.discipline);
    if (est) {
      paceNote = `D'après ton allure sur 10 km, tu peux viser environ ${formatDuration(est)} — c'est l'estimation que j'utilise pour calibrer ton plan.`;
    }
  }

  return { score, verdict, weeks_available: weeksAvailable, message, suggestion, issues, pace_note: paceNote };
}

function disciplineNameFr(discipline) {
  const names = {
    run_10k: '10 km', run_semi: 'semi-marathon', run_marathon: 'marathon',
    run_trail_short: 'trail court', run_trail_medium: 'trail 50 km',
    run_trail_long: 'trail long', run_trail_ultra: 'ultra-trail',
  };
  return names[discipline] || discipline;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

function getAlternativeObjective(objective) {
  const fallback = {
    triathlon_full:   { discipline: 'triathlon_half',    name: 'Half-Ironman (70.3)' },
    triathlon_half:   { discipline: 'triathlon_olympic', name: 'Distance Olympique' },
    triathlon_olympic:{ discipline: 'triathlon_sprint',  name: 'Distance Sprint' },
    triathlon_sprint: null,
    run_marathon:     { discipline: 'run_semi',          name: 'Semi-marathon' },
    run_semi:         { discipline: 'run_10k',           name: '10 km' },
    run_10k:          null,
    run_trail_ultra:  { discipline: 'run_trail_long',    name: 'Trail 80–100 km' },
    run_trail_long:   { discipline: 'run_trail_medium',  name: 'Trail 50 km' },
    run_trail_medium: { discipline: 'run_trail_short',   name: 'Trail 20–30 km' },
    run_trail_short:  null,
  };
  const alt = fallback[objective.discipline];
  if (!alt) return null;
  return { ...alt, message: `Préparer un ${alt.name} dans le même délai est nettement plus sûr et te donnera les bases pour aller plus loin ensuite.` };
}

module.exports = { generatePlan, analyzeFeasibility, estimateTargetTime };
