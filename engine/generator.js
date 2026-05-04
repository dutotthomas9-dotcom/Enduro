// ─────────────────────────────────────────────────────────────────────────────
// ENDURO — Moteur de génération de plan
// Règles déterministes. Aucune IA. Chaque décision est explicable.
// ─────────────────────────────────────────────────────────────────────────────

// Volume hebdomadaire maximum par distance (en minutes)
const PEAK_VOLUMES = {
  triathlon_sprint:  300,   // 5h
  triathlon_olympic: 480,   // 8h
  triathlon_half:    780,   // 13h
  triathlon_full:   1080,   // 18h
};

// Distribution par discipline (% du volume hebdo)
const DISCIPLINE_SPLIT = { swim: 0.20, bike: 0.50, run: 0.30 };

// Structure des blocs selon le nombre de semaines disponibles
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

// ─── CALCUL DES ZONES DE L'ATHLÈTE ───────────────────────────────────────────

function computeZones(athlete) {
  const hrMax = athlete.hr_max || 185;

  // Zones de fréquence cardiaque
  const hr = {
    z1: [Math.round(hrMax * 0.60), Math.round(hrMax * 0.65)],
    z2: [Math.round(hrMax * 0.65), Math.round(hrMax * 0.75)],
    z3: [Math.round(hrMax * 0.75), Math.round(hrMax * 0.83)],
    z4: [Math.round(hrMax * 0.83), Math.round(hrMax * 0.90)],
    z5: [Math.round(hrMax * 0.90), Math.round(hrMax * 0.96)],
  };

  // Allures CAP (secondes/km)
  let runZ2 = null, runZ4 = null;
  if (athlete.run_10k_pace_seconds) {
    const p = athlete.run_10k_pace_seconds;
    runZ2 = secToPace(Math.round(p * 1.22));
    runZ4 = secToPace(Math.round(p * 1.04));
  }

  // CSS natation (s/100m)
  let swimZ2 = null, swimZ4 = null;
  if (athlete.swim_css_seconds) {
    const c = athlete.swim_css_seconds;
    swimZ2 = `${secToPace(Math.round(c * 1.18))}/100m`;
    swimZ4 = `${secToPace(Math.round(c * 1.04))}/100m`;
  }

  // FTP vélo
  let bikeZ2 = null, bikeZ4 = null;
  if (athlete.ftp_watts) {
    bikeZ2 = `${Math.round(athlete.ftp_watts * 0.68)}–${Math.round(athlete.ftp_watts * 0.76)} W`;
    bikeZ4 = `${Math.round(athlete.ftp_watts * 0.88)}–${Math.round(athlete.ftp_watts * 0.95)} W`;
  }

  return { hr, runZ2, runZ4, swimZ2, swimZ4, bikeZ2, bikeZ4 };
}

function secToPace(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── TEMPLATES DE SÉANCES ────────────────────────────────────────────────────

function buildRestSession(date) {
  return {
    discipline: 'rest', session_type: 'rest',
    name: 'Repos complet',
    date, day_of_week: date.getDay(),
    duration_minutes: 0, distance_km: 0, tss_estimated: 0, rpe_target: 0,
    coach_intro: 'Journée sans entraînement. La récupération fait partie du plan — elle n\'est pas optionnelle.',
    session_goal: 'Laisser ton corps assimiler les entraînements de la semaine.',
    blocks: JSON.stringify([]),
  };
}

function buildSwimSession(type, durationMin, zones, date) {
  const templates = {
    endurance: {
      name: 'Natation endurance',
      session_type: 'endurance',
      coach_intro: 'Séance de fond. L\'objectif est de nager longtemps à une allure où tu te sens à l\'aise, pas de te fatiguer.',
      session_goal: 'Construire ta base aérobie en eau. La régularité compte plus que l\'intensité.',
      blocks: [
        { name: 'Échauffement', duration_min: Math.round(durationMin * 0.18),
          intensity: 'Z1-Z2', description: '400m en nage libre, très facile. Sens l\'eau, pas de chrono.',
          target_hr: `${zones.hr.z1[0]}–${zones.hr.z1[1]} bpm`,
          target_pace: zones.swimZ2 || 'allure confortable' },
        { name: 'Corps de séance', duration_min: Math.round(durationMin * 0.64),
          intensity: 'Z2', description: 'Nage continue en endurance. Tu dois pouvoir te concentrer sur ta technique entre chaque respiration.',
          target_hr: `${zones.hr.z2[0]}–${zones.hr.z2[1]} bpm`,
          target_pace: zones.swimZ2 || 'allure soutenue mais confortable' },
        { name: 'Retour au calme', duration_min: Math.round(durationMin * 0.18),
          intensity: 'Z1', description: '200m dos ou crawl très lent. Laisse ta fréquence cardiaque redescendre.',
          target_hr: `< ${zones.hr.z1[1]} bpm` },
      ],
    },
    technique_threshold: {
      name: 'Technique + seuil CSS',
      session_type: 'threshold',
      coach_intro: 'Séance qualité en natation. La première partie travaille ta technique, la seconde ton moteur aérobie.',
      session_goal: 'Améliorer ton économie de nage et ta capacité à tenir un effort soutenu — les deux comptent sur un triathlon.',
      blocks: [
        { name: 'Échauffement + éducatifs', duration_min: Math.round(durationMin * 0.22),
          intensity: 'Z1-Z2', description: '400m en nage libre facile, puis 4×50m d\'éducatifs (rattrapé, unilatéral). Concentration sur le placement du bras.',
          target_hr: `${zones.hr.z1[0]}–${zones.hr.z2[0]} bpm` },
        { name: 'Séries seuil', duration_min: Math.round(durationMin * 0.56),
          intensity: 'Z4', description: '8×100m à ton allure seuil. Récupération 15 secondes entre chaque. L\'effort doit être soutenu mais régulier — même allure sur les 8 séries.',
          target_hr: `${zones.hr.z4[0]}–${zones.hr.z4[1]} bpm`,
          target_pace: zones.swimZ4 || 'allure seuil',
          reps: '8 × 100m', recovery: '15 s récup' },
        { name: 'Retour au calme', duration_min: Math.round(durationMin * 0.22),
          intensity: 'Z1', description: '200m très lent. Concentre-toi sur le relâchement des épaules.',
          target_hr: `< ${zones.hr.z1[1]} bpm` },
      ],
    },
    recovery: {
      name: 'Natation récupération',
      session_type: 'recovery',
      coach_intro: 'Séance légère. L\'objectif est de maintenir le rythme de nage sans créer de fatigue supplémentaire.',
      session_goal: 'Entretenir ta technique et favoriser la récupération active après les efforts de la semaine.',
      blocks: [
        { name: 'Nage libre facile', duration_min: durationMin,
          intensity: 'Z1-Z2', description: 'Nage continue, allure très confortable. Focus sur la technique : allongement du corps, entrée de main dans l\'axe. Aucune urgence.',
          target_hr: `${zones.hr.z1[0]}–${zones.hr.z2[0]} bpm`,
          target_pace: zones.swimZ2 || 'allure très confortable' },
      ],
    },
  };

  const t = templates[type] || templates.endurance;
  return {
    discipline: 'swim', session_type: t.session_type,
    name: t.name, date, day_of_week: date.getDay(),
    duration_minutes: durationMin,
    distance_km: Math.round(durationMin * 0.045 * 10) / 10,
    tss_estimated: Math.round(durationMin * (type === 'threshold' ? 1.4 : 0.75)),
    rpe_target: type === 'threshold' ? 7 : type === 'recovery' ? 4 : 5,
    coach_intro: t.coach_intro, session_goal: t.session_goal,
    blocks: JSON.stringify(t.blocks),
  };
}

function buildBikeSession(type, durationMin, zones, date) {
  const templates = {
    endurance: {
      name: 'Vélo endurance fondamentale',
      session_type: 'endurance',
      coach_intro: 'Sortie en endurance. Le vélo se travaille d\'abord à basse intensité — résiste à l\'envie d\'accélérer.',
      session_goal: 'Développer ton moteur aérobie et habituer tes jambes à pédaler longtemps. C\'est la base de tout.',
      blocks: [
        { name: 'Mise en route', duration_min: 15,
          intensity: 'Z1-Z2', description: 'Pédale très légèrement les 15 premières minutes. Cadence 85–90 rpm, résistance minimale.',
          target_hr: `${zones.hr.z1[0]}–${zones.hr.z2[0]} bpm`,
          target_power: zones.bikeZ2 ? `< ${zones.bikeZ2.split('–')[0]} W` : null },
        { name: 'Corps de séance', duration_min: durationMin - 25,
          intensity: 'Z2', description: 'Endurance continue. Tu dois pouvoir chanter ou tenir une conversation. Si tu dois souffler, réduis la résistance.',
          target_hr: `${zones.hr.z2[0]}–${zones.hr.z2[1]} bpm`,
          target_power: zones.bikeZ2 || null },
        { name: 'Retour au calme', duration_min: 10,
          intensity: 'Z1', description: 'Les 10 dernières minutes en pédalage très léger. Cadence libre, résistance minimale.',
          target_hr: `< ${zones.hr.z1[1]} bpm` },
      ],
    },
    threshold: {
      name: 'Vélo intervalles seuil',
      session_type: 'threshold',
      coach_intro: 'Séance qualité. Tu vas travailler à l\'intensité qui correspond à ton effort maximal sur 1 heure. C\'est inconfortable — c\'est voulu.',
      session_goal: 'Améliorer ta puissance seuil. Sur un Ironman, tu passeras 4 à 5 heures juste en-dessous de cette intensité.',
      blocks: [
        { name: 'Échauffement', duration_min: 20,
          intensity: 'Z1-Z2', description: 'Pédalage facile, monte progressivement. 2×30 secondes d\'accélération légère à 15 min.',
          target_hr: `${zones.hr.z1[0]}–${zones.hr.z2[1]} bpm` },
        { name: 'Intervalles seuil', duration_min: Math.round(durationMin * 0.55),
          intensity: 'Z4', description: 'Effort soutenu mais constant. Tu dois tenir l\'allure sur tous les intervalles — si tu décroches sur le dernier, c\'est que tu es parti trop fort.',
          target_hr: `${zones.hr.z4[0]}–${zones.hr.z4[1]} bpm`,
          target_power: zones.bikeZ4 || null,
          reps: `${Math.round(durationMin * 0.55 / 11)} × 8 min`, recovery: '3 min récup facile' },
        { name: 'Retour au calme', duration_min: 10,
          intensity: 'Z1', description: 'Pédale très légèrement. Étire les quadriceps après l\'arrêt.',
          target_hr: `< ${zones.hr.z1[1]} bpm` },
      ],
    },
    long_ride: {
      name: 'Sortie longue vélo',
      session_type: 'long',
      coach_intro: 'C\'est LA séance de la semaine. Elle simule la partie vélo de ta course. Gère ton effort et ton alimentation dès le départ.',
      session_goal: 'Habituer ton corps et ton mental à pédaler longtemps. La gestion de l\'énergie et de l\'hydratation s\'apprend ici.',
      blocks: [
        { name: 'Échauffement', duration_min: 20,
          intensity: 'Z1-Z2', description: 'Montée en température progressive sur les premiers kilomètres. Résiste à l\'envie de partir fort.',
          target_hr: `${zones.hr.z1[0]}–${zones.hr.z2[0]} bpm` },
        { name: 'Corps de séance — endurance', duration_min: Math.round(durationMin * 0.65),
          intensity: 'Z2', description: 'Endurance continue. Mange et bois régulièrement — toutes les 20 minutes minimum. Ne pas attendre d\'avoir faim ou soif.',
          target_hr: `${zones.hr.z2[0]}–${zones.hr.z2[1]} bpm`,
          target_power: zones.bikeZ2 || null },
        { name: 'Bloc seuil inclus', duration_min: 20,
          intensity: 'Z3-Z4', description: '20 min à allure légèrement plus soutenue en milieu de sortie. Sens comment tu réagis à l\'effort quand les jambes sont déjà chargées.',
          target_hr: `${zones.hr.z3[0]}–${zones.hr.z4[0]} bpm` },
        { name: 'Retour au calme', duration_min: 15,
          intensity: 'Z1-Z2', description: 'Réduis progressivement. Les 10 derniers km très légers.',
          target_hr: `${zones.hr.z1[0]}–${zones.hr.z2[0]} bpm` },
      ],
    },
  };

  const t = templates[type] || templates.endurance;
  return {
    discipline: 'bike', session_type: t.session_type,
    name: t.name, date, day_of_week: date.getDay(),
    duration_minutes: durationMin,
    distance_km: Math.round(durationMin * 0.58 * 10) / 10,
    tss_estimated: Math.round(durationMin * (type === 'threshold' ? 1.5 : type === 'long_ride' ? 1.1 : 0.8)),
    rpe_target: type === 'threshold' ? 8 : type === 'long_ride' ? 6 : 5,
    coach_intro: t.coach_intro, session_goal: t.session_goal,
    blocks: JSON.stringify(t.blocks),
  };
}

function buildRunSession(type, durationMin, zones, date) {
  const repCount = Math.max(3, Math.min(6, Math.round((durationMin - 25) / 8)));
  const templates = {
    endurance: {
      name: 'Footing endurance',
      session_type: 'endurance',
      coach_intro: 'Sortie facile. L\'allure doit être conversationnelle du début à la fin. C\'est une séance de récupération active et de volume.',
      session_goal: 'Construire ton volume de course à pied sans créer de fatigue. Les jambes qui font des km faciles progressent aussi.',
      blocks: [
        { name: 'Footing continu', duration_min: durationMin,
          intensity: 'Z1-Z2', description: 'Allure très facile. Tu dois pouvoir tenir une conversation entière sans effort. Si tu accélères malgré toi, c\'est normal — résiste.',
          target_hr: `${zones.hr.z1[0]}–${zones.hr.z2[1]} bpm`,
          target_pace: zones.runZ2 || 'allure conversationnelle' },
      ],
    },
    threshold: {
      name: 'Intervalles seuil',
      session_type: 'threshold',
      coach_intro: 'Séance qualité. Elle va t\'apprendre à tenir un effort soutenu sans t\'épuiser — exactement ce que tu devras faire en course.',
      session_goal: 'Améliorer ta capacité à courir vite longtemps. Sur le run d\'un triathlon, c\'est cette filière qui fait la différence.',
      blocks: [
        { name: 'Échauffement', duration_min: 15,
          intensity: 'Z1-Z2', description: 'Trot très facile 10 min, puis 4×20 secondes d\'accélérations progressives. Laisse les jambes se réveiller.',
          target_hr: `${zones.hr.z1[0]}–${zones.hr.z2[1]} bpm` },
        { name: `${repCount} × 6 min seuil`, duration_min: repCount * 8,
          intensity: 'Z4', description: 'Effort soutenu mais maîtrisé. Tu dois pouvoir dire une phrase courte, pas plus. Si tu ne peux plus parler du tout, ralentis de 5 secondes par km.',
          target_hr: `${zones.hr.z4[0]}–${zones.hr.z4[1]} bpm`,
          target_pace: zones.runZ4 || 'allure seuil',
          reps: `${repCount} × 6 min`, recovery: '2 min trot très léger' },
        { name: 'Retour au calme', duration_min: 10,
          intensity: 'Z1', description: 'Trot très léger, reviens à une respiration normale. Étire les quadriceps et les mollets — 30 secondes par jambe, sans forcer.',
          target_hr: `< ${zones.hr.z2[0]} bpm` },
      ],
    },
    long_run: {
      name: 'Sortie longue course à pied',
      session_type: 'long',
      coach_intro: 'La sortie longue de la semaine. Objectif : tenir l\'effort sur la durée. Pas d\'allure imposée — écoute tes jambes.',
      session_goal: 'Développer ton endurance de fond en course à pied. Le simple fait de courir longtemps améliore ta capacité à courir un marathon après le vélo.',
      blocks: [
        { name: 'Sortie longue continue', duration_min: Math.round(durationMin * 0.75),
          intensity: 'Z2', description: 'Allure endurance, conversationnelle. Mange et bois si la sortie dépasse 1h15. Ne pas attendre d\'avoir faim.',
          target_hr: `${zones.hr.z2[0]}–${zones.hr.z2[1]} bpm`,
          target_pace: zones.runZ2 || 'allure confortable' },
        { name: 'Progression finale', duration_min: Math.round(durationMin * 0.25),
          intensity: 'Z3', description: 'Accélère légèrement sur la fin — pas à fond, juste sentir que tu peux encore accélérer. C\'est un signe que ta gestion d\'effort était bonne.',
          target_hr: `${zones.hr.z3[0]}–${zones.hr.z3[1]} bpm` },
      ],
    },
  };

  const t = templates[type] || templates.endurance;
  return {
    discipline: 'run', session_type: t.session_type,
    name: t.name, date, day_of_week: date.getDay(),
    duration_minutes: durationMin,
    distance_km: Math.round(durationMin * 0.175 * 10) / 10,
    tss_estimated: Math.round(durationMin * (type === 'threshold' ? 1.6 : type === 'long_run' ? 1.1 : 0.8)),
    rpe_target: type === 'threshold' ? 7 : type === 'long_run' ? 6 : 4,
    coach_intro: t.coach_intro, session_goal: t.session_goal,
    blocks: JSON.stringify(t.blocks),
  };
}

function buildBrickSession(bikeDuration, runDuration, zones, date) {
  return {
    discipline: 'brick', session_type: 'brick',
    name: 'Enchaînement vélo → course',
    date, day_of_week: date.getDay(),
    duration_minutes: bikeDuration + runDuration,
    distance_km: Math.round((bikeDuration * 0.58 + runDuration * 0.175) * 10) / 10,
    tss_estimated: Math.round((bikeDuration * 1.0 + runDuration * 1.3)),
    rpe_target: 7,
    coach_intro: 'Séance de transition. Elle t\'apprend à courir alors que tes jambes ont déjà pédalé — une sensation spécifique au triathlon qu\'on ne peut apprendre qu\'en le faisant.',
    session_goal: 'Habituer ton système neuromusculaire à changer de discipline. Plus tu t\'y entraînes, plus la transition devient naturelle le jour J.',
    blocks: JSON.stringify([
      { name: `Vélo — ${bikeDuration} min`,
        duration_min: bikeDuration, intensity: 'Z2-Z3',
        description: `Roule en endurance (${bikeDuration - 15} min), puis monte légèrement en intensité sur les 15 dernières minutes. Pense déjà à ta transition.`,
        target_hr: `${zones.hr.z2[0]}–${zones.hr.z3[1]} bpm`,
        target_power: zones.bikeZ2 || null },
      { name: 'Transition T2',
        duration_min: 3, intensity: 'repos',
        description: 'Change de chaussures, bois un peu. Note mentalement tes sensations dans les jambes.' },
      { name: `Course — ${runDuration} min`,
        duration_min: runDuration, intensity: 'Z2-Z3',
        description: 'Les premières minutes seront étranges — c\'est normal. Tes jambes se souviennent de comment courir au bout de 3 à 5 min. Commence léger et monte progressivement.',
        target_hr: `${zones.hr.z2[0]}–${zones.hr.z3[0]} bpm`,
        target_pace: zones.runZ2 || 'allure progressive' },
    ]),
  };
}

// ─── PATTERN DE SÉANCES PAR PHASE ────────────────────────────────────────────

function getWeekPattern(phase, weekVolMin, brickMandatory) {
  // Returns array of {slot, discipline, type, pct} for each day (Mon=0 to Sun=6)
  const base = [
    { day: 0, discipline: 'rest',  type: 'rest',                pct: 0 },
    { day: 1, discipline: 'run',   type: 'endurance',           pct: 0.11 },
    { day: 2, discipline: 'bike',  type: 'endurance',           pct: 0.22 },
    { day: 3, discipline: 'swim',  type: 'endurance',           pct: 0.12 },
    { day: 4, discipline: 'run',   type: 'endurance',           pct: 0.09 },
    { day: 5, discipline: 'bike',  type: 'long_ride',           pct: 0.28 },
    { day: 6, discipline: 'swim',  type: 'endurance',           pct: 0.18 },
  ];

  const development = [
    { day: 0, discipline: 'rest',  type: 'rest',                pct: 0 },
    { day: 1, discipline: 'run',   type: 'threshold',           pct: 0.12 },
    { day: 2, discipline: 'bike',  type: 'endurance',           pct: 0.22 },
    { day: 3, discipline: 'swim',  type: 'technique_threshold', pct: 0.12 },
    { day: 4, discipline: 'run',   type: 'endurance',           pct: 0.09 },
    { day: 5, discipline: 'bike',  type: 'long_ride',           pct: 0.30 },
    { day: 6, discipline: 'brick', type: 'brick',               pct: 0.15 },
  ];

  const specific = [
    { day: 0, discipline: 'rest',  type: 'rest',                pct: 0 },
    { day: 1, discipline: 'run',   type: 'threshold',           pct: 0.11 },
    { day: 2, discipline: 'bike',  type: 'threshold',           pct: 0.20 },
    { day: 3, discipline: 'swim',  type: 'technique_threshold', pct: 0.12 },
    { day: 4, discipline: 'run',   type: 'endurance',           pct: 0.08 },
    { day: 5, discipline: 'bike',  type: 'long_ride',           pct: 0.32 },
    { day: 6, discipline: 'brick', type: 'brick',               pct: 0.17 },
  ];

  const taper = [
    { day: 0, discipline: 'rest',  type: 'rest',   pct: 0 },
    { day: 1, discipline: 'run',   type: 'threshold', pct: 0.13 },
    { day: 2, discipline: 'bike',  type: 'endurance', pct: 0.30 },
    { day: 3, discipline: 'swim',  type: 'recovery',  pct: 0.14 },
    { day: 4, discipline: 'rest',  type: 'rest',      pct: 0 },
    { day: 5, discipline: 'bike',  type: 'endurance', pct: 0.25 },
    { day: 6, discipline: 'run',   type: 'endurance', pct: 0.18 },
  ];

  const patterns = { base, development, specific, taper };
  return patterns[phase] || base;
}

// ─── GÉNÉRATEUR PRINCIPAL ─────────────────────────────────────────────────────

function generatePlan(athlete, objective) {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const raceDate = new Date(objective.race_date);

  const totalWeeks = Math.max(2, Math.floor((raceDate - startDate) / (7 * 24 * 60 * 60 * 1000)));
  const blocks = computeBlocks(totalWeeks);
  const zones = computeZones(athlete);

  const baseVol = (athlete.weekly_hours_current || 6) * 60;
  const peakVol = Math.min(baseVol * 1.5, PEAK_VOLUMES[objective.discipline] || 780);

  const weeks = [];
  let rollingVol = baseVol;

  for (let w = 0; w < totalWeeks; w++) {
    const block = getPhaseForWeek(w, blocks);
    const isRecovery = w > 0 && (w + 1) % 3 === 0 && block.phase !== 'taper';
    const isTaper = block.phase === 'taper';

    let weekVol;
    if (isTaper) {
      const taperIdx = w - (totalWeeks - blocks.find(b => b.phase === 'taper').weeks);
      weekVol = peakVol * (taperIdx === 0 ? 0.60 : 0.42);
    } else if (isRecovery) {
      weekVol = rollingVol * 0.65;
    } else {
      weekVol = Math.min(rollingVol * 1.08, peakVol);
      rollingVol = weekVol;
    }
    weekVol = Math.round(weekVol);

    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + w * 7);

    const weekType = isTaper ? 'taper' : isRecovery ? 'recovery' : 'charge';
    const brickMandatory = (block.phase === 'specific' || block.phase === 'development') && w > 4;
    const pattern = getWeekPattern(block.phase, weekVol, brickMandatory);

    const sessions = pattern.map(slot => {
      const sessionDate = new Date(weekStart);
      sessionDate.setDate(weekStart.getDate() + slot.day);

      if (slot.discipline === 'rest') return buildRestSession(sessionDate);

      const durMin = Math.max(20, Math.round(weekVol * slot.pct));

      if (slot.discipline === 'swim') return buildSwimSession(slot.type, durMin, zones, sessionDate);
      if (slot.discipline === 'bike') return buildBikeSession(slot.type, durMin, zones, sessionDate);
      if (slot.discipline === 'run')  return buildRunSession(slot.type, durMin, zones, sessionDate);
      if (slot.discipline === 'brick') {
        const bikeDur = Math.round(durMin * 0.60);
        const runDur  = Math.round(durMin * 0.40);
        return buildBrickSession(bikeDur, runDur, zones, sessionDate);
      }
    }).filter(Boolean);

    weeks.push({
      week_number: w + 1,
      phase: block.phase,
      phase_name: block.name,
      week_type: weekType,
      start_date: weekStart.toISOString().split('T')[0],
      target_volume_minutes: weekVol,
      sessions,
    });
  }

  return { total_weeks: totalWeeks, start_date: startDate.toISOString().split('T')[0], weeks };
}

// ─── ANALYSE DE FAISABILITÉ ───────────────────────────────────────────────────

function analyzeFeasibility(athlete, objective) {
  const raceDate = new Date(objective.race_date);
  const weeksAvailable = Math.floor((raceDate - new Date()) / (7 * 24 * 60 * 60 * 1000));
  const baseVol = (athlete.weekly_hours_current || 6) * 60;
  const peakRequired = PEAK_VOLUMES[objective.discipline] || 780;
  const minWeeks = { triathlon_sprint: 6, triathlon_olympic: 8, triathlon_half: 12, triathlon_full: 16 };

  let score = 100;
  const issues = [];

  // Temps disponible
  const minW = minWeeks[objective.discipline] || 12;
  if (weeksAvailable < minW * 0.6) { score -= 40; issues.push('temps_critique'); }
  else if (weeksAvailable < minW)    { score -= 20; issues.push('temps_juste'); }

  // Volume actuel vs requis
  const volRatio = baseVol / peakRequired;
  if (volRatio < 0.35) { score -= 30; issues.push('volume_trop_bas'); }
  else if (volRatio < 0.55) { score -= 15; issues.push('volume_bas'); }

  // Blessures
  const injuryZones = JSON.parse(athlete.injury_zones || '[]');
  if (injuryZones.length > 0) score -= 10;

  let verdict, message, suggestion;
  if (score >= 75) {
    verdict = 'realistic';
    message = `${weeksAvailable} semaines de préparation depuis ton niveau actuel, c'est suffisant. Le plan sera exigeant mais réaliste si tu es régulier.`;
    suggestion = null;
  } else if (score >= 45) {
    verdict = 'ambitious';
    message = `${weeksAvailable} semaines depuis ton volume actuel, c'est ambitieux. Ce n'est pas impossible — mais ça ne laisse aucune marge si tu rates des semaines.`;
    suggestion = getAlternativeObjective(objective);
  } else {
    verdict = 'risky';
    message = `${weeksAvailable} semaines avec ton niveau actuel, c'est trop court pour préparer cette distance sans risque de blessure. Je te recommande fortement l'objectif ci-dessous.`;
    suggestion = getAlternativeObjective(objective);
  }

  return { score, verdict, weeks_available: weeksAvailable, message, suggestion, issues };
}

function getAlternativeObjective(objective) {
  const fallback = {
    triathlon_full:    { discipline: 'triathlon_half',    name: 'Half-Ironman (70.3)' },
    triathlon_half:    { discipline: 'triathlon_olympic', name: 'Distance Olympique' },
    triathlon_olympic: { discipline: 'triathlon_sprint',  name: 'Distance Sprint' },
    triathlon_sprint:  null,
  };
  const alt = fallback[objective.discipline];
  if (!alt) return null;
  return { ...alt, message: `Préparer un ${alt.name} dans le même délai est nettement plus sûr et te donnera les bases pour viser plus long ensuite.` };
}

module.exports = { generatePlan, analyzeFeasibility };
