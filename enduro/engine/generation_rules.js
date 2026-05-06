// ─────────────────────────────────────────────────────────────────────────────
// ENDURO V1.21.x — Règles de génération et patterns d'affûtage
//
// Consommé par generator.js.
// Contient :
//   - getWeekPatternV2()     : patterns enrichis par phase et sous-phase taper
//   - getTaperSubPhase()     : calcule s3/s2/s1 depuis l'index de semaine
//   - PHASE_RULES            : règles d'autorisation/interdiction par phase
//   - TAPER_EXCLUSIONS       : règles d'exclusion strictes par discipline
// ─────────────────────────────────────────────────────────────────────────────

// ─── CALCUL DE LA SOUS-PHASE D'AFFÛTAGE ─────────────────────────────────────
//
// Retourne 's3' | 's2' | 's1' | null
// Reçoit l'index de la semaine dans la phase taper (0, 1, 2, ...)
// et le nombre total de semaines de taper.

function getTaperSubPhase(taperIndex, taperTotalWeeks) {
  if (taperTotalWeeks <= 1) return 's1';
  if (taperTotalWeeks === 2) {
    return taperIndex === 0 ? 's2' : 's1';
  }
  // 3+ semaines : s3 → s2 → s1
  if (taperIndex === 0) return 's3';
  if (taperIndex === taperTotalWeeks - 1) return 's1';
  return 's2';
}

// ─── RÈGLES PAR PHASE ────────────────────────────────────────────────────────
//
// Définit pour chaque phase :
//   allowed_types : types autorisés
//   forbidden_types : types interdits
//   quality_max_per_week : nombre max de séances qualité (seuil + VMA + tempo)
//   long_run_required : la longue est obligatoire
//   vma_allowed : la VMA est autorisée

const PHASE_RULES = {
  base: {
    allowed_types: ['endurance', 'tempo', 'recovery', 'long', 'technique', 'strength'],
    forbidden_types: ['vma_30_30', 'threshold_long'],
    quality_max_per_week: 1,   // tempo uniquement
    long_run_required: true,
    vma_allowed: false,
    note: 'Endurance dominante. Pas de VMA. Maximum 1 séance qualité (tempo modéré).',
  },
  development: {
    allowed_types: ['endurance', 'tempo', 'threshold', 'vma_30_30', 'recovery', 'long', 'technique', 'strength', 'brick'],
    forbidden_types: [],
    quality_max_per_week: 2,
    long_run_required: true,
    vma_allowed: true,
    note: 'Introduction du seuil et de la VMA. Volume en progression. Max 2 séances qualité.',
  },
  specific: {
    allowed_types: ['endurance', 'tempo', 'threshold', 'threshold_long', 'vma_30_30', 'recovery', 'long', 'long_specific', 'technique', 'brick', 'dplus'],
    forbidden_types: [],
    quality_max_per_week: 2,
    long_run_required: true,
    vma_allowed: true,
    note: 'Séances proches des conditions de course. Longue spécifique avec blocs allure.',
  },
  taper: {
    // L'affûtage applique ses propres règles par sous-phase (s3/s2/s1)
    // Les types autorisés dépendent de TAPER_EXCLUSIONS ci-dessous
    quality_max_per_week: 1,
    long_run_required: false,
    vma_allowed: false,
    volume_rule: 'decreasing',
    note: 'Aucune séance nouvelle. Volume ↓. Intensité maintenue. Blocs raccourcis.',
  },
};

// ─── EXCLUSIONS D'AFFÛTAGE PAR DISCIPLINE ────────────────────────────────────
//
// Source de vérité pour toutes les règles d'exclusion en phase taper.
// Utilisé par getWeekPatternV2() pour filtrer les patterns.

const TAPER_EXCLUSIONS = {
  run: {
    s3: {
      forbidden_types: ['vma_30_30', 'threshold_long'],
      // S-3 : seuil raccourci (3 blocs max), tempo modéré, longue réduite
      max_threshold_reps: 3,
      long_run_multiplier: 0.75, // longue à 75% de la durée normale
      note: 'S-3 : seuil présent (raccourci), tempo présent, longue réduite.',
    },
    s2: {
      forbidden_types: ['vma_30_30', 'threshold_long', 'long_specific'],
      max_threshold_reps: 2,
      long_run_multiplier: 0.65,
      // Rappel allure course introduit en S-2
      preferred_types: ['threshold', 'race_pace_recall', 'endurance'],
      note: 'S-2 : 2 blocs seuil max, rappel allure course, longue légère.',
    },
    s1: {
      // Semaine de course — quasi-repos
      forbidden_types: ['vma_30_30', 'threshold', 'threshold_long', 'long', 'long_specific', 'tempo'],
      allowed_types: ['recovery', 'race_pace_recall', 'endurance'],
      max_threshold_reps: 0,
      note: 'S-1 : AUCUN seuil, AUCUNE VMA. Rappel allure court (3 × 1 min). Footing très léger.',
    },
  },

  trail: {
    s3: {
      // D+ : réduit (pas accumulé, séances endurance uniquement)
      forbidden_types: ['vma_30_30', 'dplus_accumulation', 'trail_hill_long'],
      // Côtes courtes autorisées mais raccourcies
      max_hill_short_reps: 5,
      long_run_multiplier: 0.75,
      no_dplus: true,          // le D+ n'est pas recherché volontairement
      no_descent_work: false,  // descente technique encore possible en S-3
      note: 'S-3 : pas d\'accumulation D+, côtes courtes raccourcies, longue réduite.',
    },
    s2: {
      forbidden_types: ['vma_30_30', 'dplus_accumulation', 'trail_hill_long', 'trail_descent'],
      max_hill_short_reps: 3,  // 3 répétitions MAXIMUM
      long_run_multiplier: 0.65,
      no_dplus: true,
      no_descent_work: true,   // INTERDIT en S-2 trail
      note: 'S-2 : côtes courtes 3 reps max, pas de descente technique, pas de D+.',
    },
    s1: {
      // Fraîcheur musculaire absolue des quadriceps et mollets
      forbidden_types: ['vma_30_30', 'dplus_accumulation', 'trail_hill_long', 'trail_hill_short', 'trail_descent', 'threshold'],
      allowed_types: ['trail_fast_walk', 'recovery', 'trail_endurance'],
      no_dplus: true,
      no_descent_work: true,
      no_hill_work: true,
      note: 'S-1 : marche active uniquement, terrain plat, zéro traumatisme quadriceps.',
    },
  },

  triathlon: {
    s3: {
      forbidden_types: ['vma_30_30'],
      // Brick autorisé mais compact (≤50 min)
      max_brick_duration_min: 50,
      note: 'S-3 : brick compact (≤50 min), seuil raccourci dans chaque discipline.',
    },
    s2: {
      forbidden_types: ['vma_30_30'],
      // Pas de brick long
      max_brick_duration_min: 30,  // brick micro ≤30 min
      note: 'S-2 : brick micro (≤30 min), rappels légers dans chaque discipline.',
    },
    s1: {
      forbidden_types: ['vma_30_30', 'brick', 'threshold'],
      // Rappels très légers dans chaque discipline
      allowed_disciplines: ['swim_technique', 'run_recovery', 'bike_threshold_short'],
      max_brick_duration_min: 0,  // AUCUN brick en S-1
      note: 'S-1 : aucun brick, rappels courts par discipline, zéro enchaînement.',
    },
  },
};

// ─── PATTERNS PAR SPORT, PHASE ET SOUS-PHASE D'AFFÛTAGE ─────────────────────
//
// Remplace getWeekPattern() dans generator.js pour la phase 'taper'.
// Pour les autres phases (base/development/specific), les patterns existants
// dans generator.js sont conservés.
//
// Clé du type → catalogue session_catalog.js (buildSessionFromCatalog)
// discipline 'trail' → buildTrailSession() + session_catalog si disponible

const TAPER_WEEK_PATTERNS = {

  // ── COURSE À PIED ─────────────────────────────────────────────────────────

  run: {
    s3: [
      // Vol ~80% du pic | Seuil 3 blocs | Tempo modéré | Longue réduite
      { day:0, discipline:'rest',   type:'rest',              pct:0    },
      { day:1, discipline:'run',    type:'run_threshold',     pct:0.23 },  // seuil raccourci
      { day:2, discipline:'run',    type:'run_recovery',      pct:0.10 },  // récup active
      { day:3, discipline:'rest',   type:'rest',              pct:0    },
      { day:4, discipline:'run',    type:'run_tempo',         pct:0.18 },  // 1 bloc tempo
      { day:5, discipline:'run',    type:'run_long',          pct:0.32 },  // longue réduite
      { day:6, discipline:'rest',   type:'rest',              pct:0    },
    ],
    s2: [
      // Vol ~65% du pic | Seuil 2 blocs | Rappel allure | Sortie légère
      { day:0, discipline:'rest',   type:'rest',              pct:0    },
      { day:1, discipline:'run',    type:'run_threshold',     pct:0.24 },  // 2 blocs seuil
      { day:2, discipline:'run',    type:'run_recovery',      pct:0.12 },
      { day:3, discipline:'rest',   type:'rest',              pct:0    },
      { day:4, discipline:'run',    type:'run_race_pace',     pct:0.24 },  // rappel allure
      { day:5, discipline:'run',    type:'run_endurance',     pct:0.30 },  // sortie légère
      { day:6, discipline:'rest',   type:'rest',              pct:0    },
    ],
    s1: [
      // Vol ~45% du pic | Aucun seuil | Rappel allure micro | Footing très léger
      { day:0, discipline:'rest',   type:'rest',              pct:0    },
      { day:1, discipline:'run',    type:'run_race_pace',     pct:0.40 },  // 3 × 1 min allure
      { day:2, discipline:'rest',   type:'rest',              pct:0    },
      { day:3, discipline:'run',    type:'run_recovery',      pct:0.35 },  // footing très léger
      { day:4, discipline:'rest',   type:'rest',              pct:0    },
      { day:5, discipline:'rest',   type:'rest',              pct:0    },
      { day:6, discipline:'rest',   type:'rest',              pct:0    },
    ],
  },

  // ── TRAIL ─────────────────────────────────────────────────────────────────

  trail: {
    s3: [
      // Vol ~80% | Côtes courtes raccourcies | Pas de D+ | Longue réduite
      { day:0, discipline:'rest',   type:'rest',               pct:0    },
      { day:1, discipline:'trail',  type:'trail_hill_short',   pct:0.22 },  // 5 reps max
      { day:2, discipline:'rest',   type:'rest',               pct:0    },
      { day:3, discipline:'trail',  type:'trail_endurance',    pct:0.20 },  // terrain facile
      { day:4, discipline:'rest',   type:'rest',               pct:0    },
      { day:5, discipline:'trail',  type:'trail_long',         pct:0.40 },  // longue réduite, pas D+
      { day:6, discipline:'run',    type:'run_recovery',       pct:0.18 },  // récup active légère
    ],
    s2: [
      // Vol ~65% | Côtes courtes 3 reps MAX | Pas de descente | Endurance légère
      { day:0, discipline:'rest',   type:'rest',               pct:0    },
      { day:1, discipline:'trail',  type:'trail_hill_short',   pct:0.24 },  // 3 reps MAXIMUM
      { day:2, discipline:'rest',   type:'rest',               pct:0    },
      { day:3, discipline:'trail',  type:'trail_endurance',    pct:0.32 },  // terrain plat/léger
      { day:4, discipline:'rest',   type:'rest',               pct:0    },
      { day:5, discipline:'trail',  type:'trail_endurance',    pct:0.30 },  // sortie légère
      { day:6, discipline:'rest',   type:'rest',               pct:0    },
    ],
    s1: [
      // Vol ~45% | ZÉRO traumatisme quadriceps | Marche active | Terrain plat
      { day:0, discipline:'rest',   type:'rest',               pct:0    },
      { day:1, discipline:'trail',  type:'trail_fast_walk',    pct:0.42 },  // marche active terrain plat
      { day:2, discipline:'rest',   type:'rest',               pct:0    },
      { day:3, discipline:'run',    type:'run_recovery',       pct:0.38 },  // terrain plat, pas de trail
      { day:4, discipline:'rest',   type:'rest',               pct:0    },
      { day:5, discipline:'rest',   type:'rest',               pct:0    },
      { day:6, discipline:'rest',   type:'rest',               pct:0    },
    ],
  },

  // ── TRIATHLON ─────────────────────────────────────────────────────────────

  triathlon: {
    s3: [
      // Vol ~80% | Seuil raccourci par discipline | Brick compact ≤50 min
      { day:0, discipline:'rest',  type:'rest',                pct:0    },
      { day:1, discipline:'run',   type:'run_threshold',       pct:0.14 },
      { day:2, discipline:'bike',  type:'threshold',           pct:0.28 },
      { day:3, discipline:'swim',  type:'endurance',           pct:0.12 },  // natation légère
      { day:4, discipline:'rest',  type:'rest',                pct:0    },
      { day:5, discipline:'brick', type:'brick',               pct:0.28 },  // brick ≤50 min
      { day:6, discipline:'run',   type:'run_recovery',        pct:0.18 },
    ],
    s2: [
      // Vol ~65% | Rappels courts par discipline | Brick micro ≤30 min
      { day:0, discipline:'rest',  type:'rest',                pct:0    },
      { day:1, discipline:'run',   type:'run_threshold',       pct:0.18 },  // 2 blocs
      { day:2, discipline:'swim',  type:'technique_threshold', pct:0.14 },
      { day:3, discipline:'bike',  type:'tempo',               pct:0.30 },
      { day:4, discipline:'rest',  type:'rest',                pct:0    },
      { day:5, discipline:'brick', type:'brick',               pct:0.22 },  // brick micro ≤30 min
      { day:6, discipline:'rest',  type:'rest',                pct:0    },
    ],
    s1: [
      // Vol ~45% | AUCUN brick | Rappels très légers | 1 sortie par discipline
      { day:0, discipline:'rest',  type:'rest',                pct:0    },
      { day:1, discipline:'swim',  type:'endurance',           pct:0.25 },  // natation technique uniquement
      { day:2, discipline:'run',   type:'run_recovery',        pct:0.22 },
      { day:3, discipline:'bike',  type:'threshold',           pct:0.35 },  // 2 blocs de 3 min SEULEMENT
      { day:4, discipline:'rest',  type:'rest',                pct:0    },
      { day:5, discipline:'rest',  type:'rest',                pct:0    },
      { day:6, discipline:'rest',  type:'rest',                pct:0    },
    ],
  },
};

// ─── PATTERNS HORS AFFÛTAGE ENRICHIS ─────────────────────────────────────────
//
// Complète / remplace les patterns de generator.js pour base/dev/specific.
// Ces patterns intègrent les nouvelles clés du catalogue (run_vma, run_long_specific, etc.)

const ENRICHED_WEEK_PATTERNS = {
  run: {
    base: [
      { day:0, discipline:'rest', type:'rest',              pct:0    },
      { day:1, discipline:'run',  type:'run_endurance',     pct:0.20 },
      { day:2, discipline:'run',  type:'run_tempo',         pct:0.22 },  // Famille B
      { day:3, discipline:'rest', type:'rest',              pct:0    },
      { day:4, discipline:'run',  type:'run_endurance',     pct:0.18 },
      { day:5, discipline:'run',  type:'run_long',          pct:0.28 },  // Famille D
      { day:6, discipline:'run',  type:'run_technique',     pct:0.12 },  // Famille F
    ],
    development: [
      { day:0, discipline:'rest', type:'rest',              pct:0    },
      { day:1, discipline:'run',  type:'run_threshold',     pct:0.18 },  // Famille C
      { day:2, discipline:'run',  type:'run_recovery',      pct:0.12 },  // Famille A récup
      { day:3, discipline:'rest', type:'rest',              pct:0    },
      { day:4, discipline:'run',  type:'run_tempo_long',    pct:0.18 },  // Famille B long
      { day:5, discipline:'run',  type:'run_long',          pct:0.32 },  // Famille D
      { day:6, discipline:'run',  type:'run_endurance',     pct:0.12 },
    ],
    development_vma: [
      // Variante développement avec VMA (semaines paires en phase dev)
      { day:0, discipline:'rest', type:'rest',              pct:0    },
      { day:1, discipline:'run',  type:'run_threshold',     pct:0.16 },
      { day:2, discipline:'run',  type:'run_recovery',      pct:0.12 },
      { day:3, discipline:'rest', type:'rest',              pct:0    },
      { day:4, discipline:'run',  type:'run_vma',           pct:0.16 },  // Famille E
      { day:5, discipline:'run',  type:'run_long',          pct:0.32 },
      { day:6, discipline:'run',  type:'run_endurance',     pct:0.14 },
    ],
    specific: [
      { day:0, discipline:'rest', type:'rest',              pct:0    },
      { day:1, discipline:'run',  type:'run_threshold',     pct:0.18 },
      { day:2, discipline:'run',  type:'run_endurance',     pct:0.12 },
      { day:3, discipline:'rest', type:'rest',              pct:0    },
      { day:4, discipline:'run',  type:'run_threshold_long',pct:0.16 }, // Famille C long
      { day:5, discipline:'run',  type:'run_long_specific', pct:0.36 }, // Famille D spécifique
      { day:6, discipline:'run',  type:'run_endurance',     pct:0.12 },
    ],
  },

  trail: {
    base: [
      { day:0, discipline:'rest',  type:'rest',              pct:0    },
      { day:1, discipline:'trail', type:'trail_endurance',   pct:0.18 },
      { day:2, discipline:'trail', type:'trail_fast_walk',   pct:0.14 }, // Famille E
      { day:3, discipline:'rest',  type:'rest',              pct:0    },
      { day:4, discipline:'trail', type:'trail_endurance',   pct:0.16 },
      { day:5, discipline:'trail', type:'trail_long',        pct:0.36 },
      { day:6, discipline:'trail', type:'trail_endurance',   pct:0.16 },
    ],
    development: [
      { day:0, discipline:'rest',  type:'rest',              pct:0    },
      { day:1, discipline:'trail', type:'trail_hill_short',  pct:0.16 }, // Famille B
      { day:2, discipline:'trail', type:'trail_endurance',   pct:0.14 },
      { day:3, discipline:'rest',  type:'rest',              pct:0    },
      { day:4, discipline:'trail', type:'trail_fast_walk',   pct:0.12 },
      { day:5, discipline:'trail', type:'trail_long',        pct:0.38 },
      { day:6, discipline:'trail', type:'trail_endurance',   pct:0.20 },
    ],
    development_dplus: [
      // Variante avec accumulation D+ (phase dev avancée)
      { day:0, discipline:'rest',  type:'rest',              pct:0    },
      { day:1, discipline:'trail', type:'trail_hill_short',  pct:0.14 },
      { day:2, discipline:'trail', type:'trail_endurance',   pct:0.12 },
      { day:3, discipline:'rest',  type:'rest',              pct:0    },
      { day:4, discipline:'trail', type:'trail_hill_long',   pct:0.14 }, // Famille C
      { day:5, discipline:'trail', type:'trail_dplus',       pct:0.40 }, // Famille D
      { day:6, discipline:'trail', type:'trail_endurance',   pct:0.20 },
    ],
    specific: [
      { day:0, discipline:'rest',  type:'rest',              pct:0    },
      { day:1, discipline:'trail', type:'trail_hill_short',  pct:0.14 },
      { day:2, discipline:'trail', type:'trail_endurance',   pct:0.10 },
      { day:3, discipline:'rest',  type:'rest',              pct:0    },
      { day:4, discipline:'trail', type:'trail_endurance',   pct:0.12 },
      { day:5, discipline:'trail', type:'trail_dplus',       pct:0.42 }, // D+ au pic
      { day:6, discipline:'trail', type:'trail_descent',     pct:0.22 }, // Famille F
    ],
  },
};

// ─── VOLUME EN AFFÛTAGE ───────────────────────────────────────────────────────
//
// Multiplicateurs de volume pour chaque sous-phase d'affûtage.
// Appliqués sur le volume de pic (peakVol).

const TAPER_VOLUME_MULTIPLIERS = {
  s3: 0.80,
  s2: 0.65,
  s1: 0.45,
};

// ─── SÉLECTION DU PATTERN DE SEMAINE ─────────────────────────────────────────
//
// Remplace getWeekPattern() dans generator.js.
// Intègre la détection des variantes (ex: development_vma si semaine paire).

function getWeekPatternV2(sport, phase, weekIndex, taperSub) {
  // Phase taper → patterns d'affûtage
  if (phase === 'taper' && taperSub) {
    const taperPatterns = TAPER_WEEK_PATTERNS[sport];
    if (taperPatterns?.[taperSub]) return taperPatterns[taperSub];
    // Fallback si sport non trouvé
    return TAPER_WEEK_PATTERNS.run?.[taperSub] || [];
  }

  // Phases hors affûtage — enrichies
  const enriched = ENRICHED_WEEK_PATTERNS[sport];
  if (!enriched) return null; // null = utiliser getWeekPattern() existant

  if (phase === 'base')     return enriched.base || null;
  if (phase === 'specific') return enriched.specific || null;

  if (phase === 'development') {
    // Alternance : semaines paires → variante VMA/D+, semaines impaires → standard
    const isAlternate = weekIndex % 2 === 0;
    if (sport === 'run'   && isAlternate && enriched.development_vma)   return enriched.development_vma;
    if (sport === 'trail' && isAlternate && enriched.development_dplus) return enriched.development_dplus;
    return enriched.development || null;
  }

  return null;
}

module.exports = {
  getTaperSubPhase,
  getWeekPatternV2,
  PHASE_RULES,
  TAPER_EXCLUSIONS,
  TAPER_WEEK_PATTERNS,
  TAPER_VOLUME_MULTIPLIERS,
  ENRICHED_WEEK_PATTERNS,
};
