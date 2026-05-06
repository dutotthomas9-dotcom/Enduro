// ─────────────────────────────────────────────────────────────────────────────
// ENDURO V1.21.x — Catalogue des séances
//
// SOURCE DE VÉRITÉ pour tous les textes coach, structures et contraintes.
// Consommé par generator.js via buildSessionFromCatalog().
//
// Structure d'une entrée :
//   key          → identifiant unique utilisé dans les patterns
//   discipline   → 'run' | 'trail' | 'bike' | 'swim' | 'brick'
//   family       → famille bibliothèque (A–F)
//   session_type → 'endurance' | 'tempo' | 'threshold' | 'long' | 'recovery' | 'brick'
//   phases       → phases où la séance peut être générée
//   constraints  → règles d'exclusion
//   build(p)     → fonction qui retourne { name, coach_intro, session_goal, blocks[] }
//                  p = { durationMin, zones, repCount, weekType, taperSub }
// ─────────────────────────────────────────────────────────────────────────────

// ─── HELPERS PARTAGÉS ────────────────────────────────────────────────────────

function warm(durationMin, zones, label) {
  const z = zones.zoneLabel;
  return {
    name: 'Échauffement',
    duration_min: Math.max(10, Math.round(durationMin * 0.15)),
    zone_label: z('z1'),
    description: label || 'Trot facile 10 min, puis 3 à 4 accélérations progressives de 20 s.',
    target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null,
  };
}

function cool(durationMin, zones, label) {
  const z = zones.zoneLabel;
  return {
    name: 'Retour au calme',
    duration_min: Math.max(8, Math.round(durationMin * 0.10)),
    zone_label: z('z1'),
    description: label || 'Trot très léger. Laisse le corps redescendre progressivement.',
    target_hr: zones.hasHr ? `< ${zones.bpm.z1[1]} bpm` : null,
  };
}

// Calcul du nombre de répétitions en affûtage
// multiplier : 0.75 (S-3) / 0.55 (S-2) / 0.35 (S-1)
function taperReps(baseCount, taperSub) {
  const m = { s3: 0.75, s2: 0.55, s1: 0.35 }[taperSub] || 1;
  return Math.max(1, Math.round(baseCount * m));
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSE À PIED — Familles A à F
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_CATALOG = {

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILLE A — Endurance fondamentale
  // ══════════════════════════════════════════════════════════════════════════

  run_endurance: {
    discipline: 'run',
    family: 'A',
    session_type: 'endurance',
    phases: ['base', 'development', 'specific', 'taper'],
    constraints: { never: [], taper_reduce_duration: true },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return {
        name: 'Footing endurance',
        coach_intro: 'Sortie sans pression. L\'allure doit être suffisamment facile pour que tu puisses raconter ta journée en courant. Si tu dois reprendre ton souffle entre deux phrases, ralentis de 10 secondes par km.',
        session_goal: 'Construire ton socle aérobie. Ces footings faciles sont la fondation sur laquelle tout le reste tient — sans eux, les séances difficiles n\'ont pas d\'effet.',
        blocks: [
          {
            name: 'Mise en route',
            duration_min: Math.round(durationMin * 0.12),
            zone_label: z('z1'),
            description: 'Marche active, puis trot très léger. Laisse le corps trouver son équilibre.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null,
          },
          {
            name: 'Footing continu',
            duration_min: Math.round(durationMin * 0.78),
            zone_label: z('z2'),
            description: 'Allure conversationnelle du début à la fin. Si le terrain monte, ralentis pour garder le même ressenti — pas la même vitesse.',
            target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
            target_pace: zones.runZ2 || 'allure conversationnelle',
          },
          {
            name: 'Retour au calme',
            duration_min: Math.round(durationMin * 0.10),
            zone_label: z('z1'),
            description: 'Trot très léger, presque de la marche.',
            target_hr: zones.hasHr ? `< ${zones.bpm.z1[1]} bpm` : null,
          },
        ],
      };
    },
  },

  run_recovery: {
    discipline: 'run',
    family: 'A',
    session_type: 'recovery',
    phases: ['base', 'development', 'specific', 'taper'],
    constraints: { never: [], always_zone1: true },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return {
        name: 'Récupération active',
        coach_intro: 'Tu sors pour récupérer, pas pour t\'entraîner. La différence semble subtile — elle ne l\'est pas. Cette sortie doit te laisser plus frais à la fin qu\'au début.',
        session_goal: 'La récupération active est plus efficace que le repos complet pour éliminer les déchets métaboliques et préparer les jambes à la prochaine séance.',
        blocks: [
          {
            name: 'Footing très facile',
            duration_min: durationMin,
            zone_label: z('z1'),
            description: 'Zone 1 uniquement. Terrain plat. Si tu as envie d\'aller plus vite, c\'est que tu vas trop vite.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null,
          },
        ],
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILLE B — Tempo contrôlé
  // ══════════════════════════════════════════════════════════════════════════

  run_tempo: {
    discipline: 'run',
    family: 'B',
    session_type: 'tempo',
    phases: ['base', 'development', 'specific', 'taper'],
    constraints: {
      not_day_before: ['long_run'],
      taper_s1_forbidden: true,   // remplacé par race_pace_recall en S-1
    },
    build({ durationMin, zones, repCount, taperSub }) {
      const z = zones.zoneLabel;
      const warmupDur  = 12;
      const coolDur    = 8;
      const baseReps   = 2;
      const reps       = taperSub ? taperReps(baseReps + 1, taperSub) : baseReps;
      const repDur     = Math.max(10, Math.round((durationMin - warmupDur - coolDur - (reps - 1) * 3) / reps));
      return {
        name: 'Tempo fractionné',
        coach_intro: 'Tu vas travailler à une intensité soutenue — pas de la souffrance, mais un effort que tu remarques. L\'allure doit être identique sur tous les blocs. Si le dernier est nettement plus difficile que le premier, tu es parti trop fort.',
        session_goal: 'Développer ta capacité à courir longtemps à allure modérément exigeante — l\'intensité qui fera la différence sur la deuxième partie de ta course.',
        blocks: [
          {
            name: 'Échauffement',
            duration_min: warmupDur,
            zone_label: z('z1'),
            description: 'Trot facile, puis 3 accélérations progressives de 20 s.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null,
          },
          {
            name: `${reps} × ${repDur} min — Zone 3`,
            duration_min: reps * repDur + (reps - 1) * 3,
            zone_label: z('z3'),
            description: 'Effort soutenu et régulier. Tu peux dire une phrase entière — pas deux. Résiste à l\'envie de regarder ta vitesse.',
            target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
            reps: `${reps} × ${repDur} min`,
            recovery: '3 min trot léger',
          },
          {
            name: 'Retour au calme',
            duration_min: coolDur,
            zone_label: z('z1'),
            description: 'Trot très léger.',
            target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
          },
        ],
      };
    },
  },

  run_tempo_long: {
    discipline: 'run',
    family: 'B',
    session_type: 'tempo',
    phases: ['development', 'specific', 'taper'],
    constraints: {
      not_day_before: ['long_run'],
      taper_s1_forbidden: true,
    },
    build({ durationMin, zones, taperSub }) {
      const z = zones.zoneLabel;
      const warmupDur  = 15;
      const coolDur    = 10;
      // En affûtage : tempoDur réduit selon sous-phase
      const baseTempo  = durationMin - warmupDur - coolDur;
      const tempoDur   = taperSub ? Math.max(15, Math.round(baseTempo * { s3: 0.70, s2: 0.55, s1: 0.35 }[taperSub])) : baseTempo;
      return {
        name: 'Tempo continu',
        coach_intro: 'Version longue et continue du tempo. Elle demande plus de maîtrise que le fractionné — partir trop vite se paie en fin de bloc. C\'est justement cet apprentissage qui est précieux.',
        session_goal: 'Tenir un effort soutenu sur une longue durée sans décrocher. Développer la capacité à réguler l\'intensité — compétence clé sur tous les formats.',
        blocks: [
          {
            name: 'Échauffement',
            duration_min: warmupDur,
            zone_label: z('z1'),
            description: 'Zone 1–2, très facile.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null,
          },
          {
            name: `${tempoDur} min de tempo continu`,
            duration_min: tempoDur,
            zone_label: z('z3'),
            description: 'Phrase entière difficile — pas impossible. Résistance régulière du premier au dernier kilomètre. Pas d\'accélération finale.',
            target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
          },
          {
            name: 'Retour au calme',
            duration_min: coolDur,
            zone_label: z('z1'),
            description: 'Zone 1, progressif.',
            target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
          },
        ],
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILLE C — Seuil (intervalles)
  // ══════════════════════════════════════════════════════════════════════════

  run_threshold: {
    discipline: 'run',
    family: 'C',
    session_type: 'threshold',
    phases: ['development', 'specific', 'taper'],
    constraints: {
      not_day_before: ['long_run', 'vma_30_30'],
      max_per_week: 1,
      taper_s1_forbidden: true,  // CAP : pas de seuil en S-1
    },
    build({ durationMin, zones, taperSub }) {
      const z = zones.zoneLabel;
      const warmupDur  = 15;
      const coolDur    = 8;
      const baseCount  = Math.max(3, Math.min(5, Math.round((durationMin - warmupDur - coolDur) / 9)));
      const reps       = taperSub ? taperReps(baseCount, taperSub) : baseCount;
      const repDur     = 6; // minutes par bloc
      return {
        name: 'Intervalles seuil',
        coach_intro: 'Séance qualité centrale. Difficile par conception. L\'objectif n\'est pas de survivre au dernier bloc — c\'est de finir le dernier dans le même état que le premier. Si tu t\'effondres sur la fin, tu es parti trop fort.',
        session_goal: 'Repousser le seuil anaérobie. Chaque bloc bien réalisé déplace légèrement ton plafond vers le haut. C\'est une progression lente — et très solide.',
        blocks: [
          {
            name: 'Échauffement',
            duration_min: warmupDur,
            zone_label: z('z1'),
            description: 'Trot facile 10 min, puis 4 accélérations progressives de 20 s. Les jambes doivent être vraiment réveillées.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[1]} bpm` : null,
          },
          {
            name: `${reps} × ${repDur} min — Zone 4`,
            duration_min: reps * repDur + (reps - 1) * 3,
            zone_label: z('z4'),
            description: `Zone 4 — effort dur, régulier. Tu peux dire ton prénom et la ville. Pas beaucoup plus. Récupération 3 min de trot très léger entre chaque.${taperSub ? ` (${reps} blocs — affûtage)` : ''}`,
            target_hr: zones.hasHr ? `${zones.bpm.z4[0]}–${zones.bpm.z4[1]} bpm` : null,
            target_pace: zones.runZ4 || 'allure seuil',
            reps: `${reps} × ${repDur} min`,
            recovery: '3 min trot léger',
          },
          {
            name: 'Retour au calme',
            duration_min: coolDur,
            zone_label: z('z1'),
            description: 'Trot très léger. Étire quadriceps et mollets.',
            target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
          },
        ],
      };
    },
  },

  run_threshold_long: {
    discipline: 'run',
    family: 'C',
    session_type: 'threshold',
    phases: ['development', 'specific'],
    constraints: {
      not_day_before: ['long_run'],
      max_per_week: 1,
      taper_forbidden: true,  // jamais en affûtage
    },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return {
        name: 'Seuil long',
        coach_intro: 'Version longue du seuil — deux blocs de 15 à 20 minutes. La difficulté est de partir à la bonne intensité : ni trop fort pour tenir la durée, ni trop facile pour avoir un effet.',
        session_goal: 'Développer la capacité à tenir le seuil sur des durées longues — proche des conditions réelles d\'un semi-marathon ou marathon rapide.',
        blocks: [
          {
            name: 'Échauffement',
            duration_min: 15,
            zone_label: z('z1'),
            description: 'Trot + 4 accélérations progressives.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[1]} bpm` : null,
          },
          {
            name: '2 × 18 min — Zone 4',
            duration_min: 42,
            zone_label: z('z4'),
            description: 'Zone 4, régulier du premier au dernier kilomètre. Sur 18 minutes, la tentation d\'accélérer en fin de bloc est forte. Résiste — la régularité est le seul critère. Récupération 6 min de récup active entre les deux.',
            target_hr: zones.hasHr ? `${zones.bpm.z4[0]}–${zones.bpm.z4[1]} bpm` : null,
            target_pace: zones.runZ4 || 'allure seuil',
            reps: '2 × 18 min',
            recovery: '6 min récup active',
          },
          {
            name: 'Retour au calme',
            duration_min: 12,
            zone_label: z('z1'),
            description: 'Trot très léger progressif.',
            target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
          },
        ],
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILLE D — Sortie longue progressive
  // ══════════════════════════════════════════════════════════════════════════

  run_long: {
    discipline: 'run',
    family: 'D',
    session_type: 'long',
    phases: ['base', 'development', 'specific', 'taper'],
    constraints: {
      not_day_after: ['threshold', 'vma_30_30'],
      taper_reduce_duration: true,   // réduit à 75% en S-3, 65% en S-2
      taper_s1_forbidden: true,
    },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return {
        name: 'Sortie longue progressive',
        coach_intro: 'La séance de la semaine. Elle n\'est pas là pour te fatiguer — elle est là pour que tu apprennes à gérer l\'effort sur la durée. La progression finale est ton baromètre : si tu peux accélérer après 75% du parcours, ta gestion d\'effort était juste.',
        session_goal: 'Développer l\'endurance profonde et apprendre à courir fatigué. La progression finale simule les derniers kilomètres de ta course — et c\'est précisément ce qu\'on cherche.',
        blocks: [
          {
            name: 'Mise en route',
            duration_min: Math.round(durationMin * 0.17),
            zone_label: z('z1'),
            description: 'Zone 1 — presque trop facile. Résiste à l\'envie d\'aller plus vite pendant les premières minutes.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null,
          },
          {
            name: 'Corps de sortie',
            duration_min: Math.round(durationMin * 0.60),
            zone_label: z('z2'),
            description: 'Zone 2 régulier. Alimentation toutes les 20–25 min si la sortie dépasse 1h15.',
            target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
            target_pace: zones.runZ2 || 'allure confortable',
          },
          {
            name: 'Progression finale',
            duration_min: Math.round(durationMin * 0.23),
            zone_label: z('z3'),
            description: 'Monte doucement vers Zone 3. Pas un sprint — une montée progressive et continue. À la fin, tu dois être à un effort soutenu, pas épuisé.',
            target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
          },
        ],
      };
    },
  },

  run_long_specific: {
    discipline: 'run',
    family: 'D',
    session_type: 'long',
    phases: ['specific'],
    constraints: {
      not_day_after: ['threshold'],
      taper_forbidden: true,
    },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return {
        name: 'Sortie longue spécifique',
        coach_intro: 'Version spécifique avec un cœur à allure cible. Tu testes ton allure et ton alimentation dans les mêmes conditions que la course. C\'est une répétition générale, pas une compétition.',
        session_goal: 'Ancrer la sensation de l\'allure cible dans le corps fatigué. La spécificité se construit en courant à allure de course dans un contexte de fatigue.',
        blocks: [
          { name: 'Mise en route', duration_min: Math.round(durationMin * 0.18), zone_label: z('z1'),
            description: 'Zone 1–2 très facile.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null },
          { name: 'Endurance de base', duration_min: Math.round(durationMin * 0.28), zone_label: z('z2'),
            description: 'Zone 2 pour installer le rythme. Commence l\'alimentation.',
            target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null },
          { name: 'Bloc allure cible', duration_min: Math.round(durationMin * 0.30), zone_label: z('z3'),
            description: 'Cours à ton allure de course. Teste ton alimentation simultanément.',
            target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
            target_pace: zones.runZ4 ? `proche de ${zones.runZ4}` : 'allure cible' },
          { name: 'Endurance de retour', duration_min: Math.round(durationMin * 0.15), zone_label: z('z2'),
            description: 'Zone 2, jambes chargées. Note comment tu te sens.',
            target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null },
          { name: 'Retour au calme', duration_min: Math.round(durationMin * 0.09), zone_label: z('z1'),
            description: 'Zone 1, progressif.',
            target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null },
        ],
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILLE E — VMA et intensités courtes
  // ══════════════════════════════════════════════════════════════════════════

  run_vma: {
    discipline: 'run',
    family: 'E',
    session_type: 'threshold',
    phases: ['development', 'specific'],
    constraints: {
      not_day_before: ['long_run', 'threshold'],
      taper_forbidden: true,       // JAMAIS en affûtage
      sport_forbidden: [],         // interdit en S-1 CAP (géré par taper_forbidden)
      max_per_week: 1,
    },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      const warmup = 15;
      const cool   = 10;
      const body   = durationMin - warmup - cool - 5;
      const s1Count = Math.max(8,  Math.round(body * 0.55));
      const s2Count = Math.max(5, Math.round(body * 0.45 / 2.5));
      return {
        name: 'VMA — 30/30',
        coach_intro: 'Séance rapide. Très rapide. Des efforts de 30 secondes à vitesse maximale, avec 30 secondes de récupération. Contre-intuitivement, travailler plus vite que ton allure de course améliore ton allure de course.',
        session_goal: 'Développer la vitesse maximale aérobie. En quelques semaines, une allure qui était difficile devient gérable.',
        blocks: [
          {
            name: 'Échauffement',
            duration_min: warmup,
            zone_label: z('z1'),
            description: 'Trot facile 10 min, puis 6 accélérations progressives de 20 s. Les jambes doivent être parfaitement réveillées.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z3[0]} bpm` : null,
          },
          {
            name: `Série 1 — ${s1Count} × 30 s / 30 s`,
            duration_min: Math.round(s1Count * 1),
            zone_label: z('z5'),
            description: 'Zone 5 — tu ne peux plus parler du tout. Cours nettement plus vite que ton allure de 10 km. Les 30 s de récup : vraie récupération — marche si nécessaire.',
            reps: `${s1Count} × 30 s`,
            recovery: '30 s marche ou trot très lent',
          },
          {
            name: 'Transition',
            duration_min: 5,
            zone_label: z('z1'),
            description: 'Trot facile entre les deux séries.',
          },
          {
            name: `Série 2 — ${s2Count} × 1 min / 1 min 30`,
            duration_min: Math.round(s2Count * 2.5),
            zone_label: z('z5'),
            description: 'Même principe, efforts plus longs. L\'intensité doit rester maximale. La récupération longue te permet de repartir à pleine intensité.',
            reps: `${s2Count} × 1 min`,
            recovery: '1 min 30 — utilise-la vraiment',
          },
          {
            name: 'Retour au calme',
            duration_min: cool,
            zone_label: z('z1'),
            description: 'Trot très léger. Ne t\'arrête pas net.',
            target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
          },
        ],
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILLE F — Technique et économie
  // ══════════════════════════════════════════════════════════════════════════

  run_technique: {
    discipline: 'run',
    family: 'F',
    session_type: 'endurance',
    phases: ['base', 'development', 'specific', 'taper'],
    constraints: { taper_reduce_duration: false },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      const footingDur = Math.max(10, durationMin - 35);
      return {
        name: 'Éducatifs et technique de course',
        coach_intro: 'Séance légère en intensité, sérieuse en concentration. Tu vas travailler la qualité de ta foulée — comment ton pied touche le sol, comment tes bras travaillent, comment ton bassin se place. Ces détails font la différence sur un marathon.',
        session_goal: 'Améliorer l\'économie de course. Un athlète 8% plus économique court comme s\'il avait 8% de moteur en plus — sans aucun entraînement physique supplémentaire.',
        blocks: [
          {
            name: 'Échauffement',
            duration_min: 15,
            zone_label: z('z1'),
            description: 'Footing très facile. Sens ton corps.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null,
          },
          {
            name: 'Éducatifs de course',
            duration_min: 15,
            zone_label: z('z1'),
            description: '6 exercices sur 30 à 40 mètres — marche de retour entre chaque.\n• Montées de genoux : genoux à hauteur des hanches, bras actifs.\n• Talons-fesses : talons vers les fesses, buste droit.\n• Pas chassés latéraux : croisé-décroisé 20 m, change de côté.\n• Foulées bondissantes : pousse fort, cherche la hauteur.\n• Course sur pointes : contact sol minimal.\n• Course bras exagérés : amplitude exagérée — les jambes suivent.',
          },
          {
            name: 'Strides',
            duration_min: 5,
            zone_label: z('z3'),
            description: '4 accélérations progressives de 80 m. De 70% à 90% de ta vitesse max. Tu cherches la fluidité, pas la vitesse.',
          },
          {
            name: 'Footing retour',
            duration_min: footingDur,
            zone_label: z('z1'),
            description: 'Footing très léger. Concentre-toi sur ce que tu ressens différemment.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null,
          },
        ],
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AFFÛTAGE SPÉCIFIQUE — Rappel allure course
  // ══════════════════════════════════════════════════════════════════════════

  run_race_pace: {
    discipline: 'run',
    family: 'C',  // dérivé du seuil
    session_type: 'tempo',
    phases: ['taper'],
    constraints: { taper_only: true },
    build({ durationMin, zones, taperSub }) {
      const z = zones.zoneLabel;
      // S-2 : 2 × 5 min | S-1 : 3 × 1 min
      const reps   = taperSub === 's1' ? 3 : 2;
      const repDur = taperSub === 's1' ? 1 : 5;
      const recov  = taperSub === 's1' ? 2 : 2;
      return {
        name: 'Rappel allure course',
        coach_intro: 'La séance la plus précieuse de la semaine d\'affûtage. Tu vas courir quelques minutes à ton allure cible. Pas pour te tester — pour retrouver la sensation. Pour que le jour J, cette allure soit une vieille connaissance, pas une abstraction.',
        session_goal: 'Ancrer la sensation de l\'allure cible dans le corps. Un rappel d\'allure à J-7 garantit que tu arrives sur la ligne avec ce ressenti frais en mémoire.',
        blocks: [
          {
            name: 'Échauffement',
            duration_min: 12,
            zone_label: z('z1'),
            description: 'Zone 1–2, 3 accélérations progressives de 20 s.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null,
          },
          {
            name: `${reps} × ${repDur} min — allure cible`,
            duration_min: reps * repDur + (reps - 1) * recov,
            zone_label: z('z3'),
            description: 'Cours à ton allure de course. Pas plus vite, même si ça semble facile. L\'objectif n\'est pas la performance — c\'est la calibration.',
            target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
            target_pace: zones.runZ4 ? `proche de ${zones.runZ4}` : 'allure cible course',
            reps: `${reps} × ${repDur} min`,
            recovery: `${recov} min trot léger`,
          },
          {
            name: 'Retour au calme',
            duration_min: durationMin - 12 - reps * repDur - (reps - 1) * recov,
            zone_label: z('z1'),
            description: 'Zone 1, très progressif.',
            target_hr: zones.hasHr ? `< ${zones.bpm.z1[1]} bpm` : null,
          },
        ],
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRAIL — Familles A à F
  // ══════════════════════════════════════════════════════════════════════════

  trail_endurance: {
    discipline: 'trail',
    family: 'A',
    session_type: 'endurance',
    phases: ['base', 'development', 'specific', 'taper'],
    constraints: { taper_reduce_duration: true, no_dplus_in_taper: true },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return {
        name: 'Sortie trail endurance',
        coach_intro: 'Tu sors en nature, tu cours et tu marches selon le terrain. Ton seul indicateur : la respiration. Conversationnelle en permanence. En trail, la marche rapide dans les montées est une technique compétitive — pas un échec.',
        session_goal: 'Construire l\'endurance spécifique trail — capacité à alterner course et marche sur terrain irrégulier, gestion de l\'effort sur le temps.',
        blocks: [
          {
            name: 'Mise en route',
            duration_min: Math.round(durationMin * 0.10),
            zone_label: z('z1'),
            description: 'Marche active. Laisse le corps trouver son équilibre sur le terrain.',
          },
          {
            name: 'Corps de sortie',
            duration_min: Math.round(durationMin * 0.75),
            zone_label: z('z2'),
            description: 'Alternance naturelle course et marche. Quand la pente dépasse 15–20% : marche rapide, bras actifs, buste légèrement incliné. Ce n\'est pas de la récupération — c\'est une autre façon de monter.',
            target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[1]} bpm` : null,
          },
          {
            name: 'Bloc descente',
            duration_min: Math.round(durationMin * 0.10),
            zone_label: z('z2'),
            description: 'Descente contrôlée. Foulées courtes, regard loin, bras écartés. Les quadriceps gèrent l\'impact — pas les genoux.',
          },
          {
            name: 'Retour au calme',
            duration_min: Math.round(durationMin * 0.05),
            zone_label: z('z1'),
            description: 'Marche active. Étire quadriceps et mollets.',
          },
        ],
      };
    },
  },

  trail_hill_short: {
    discipline: 'trail',
    family: 'B',
    session_type: 'threshold',
    phases: ['base', 'development', 'specific', 'taper'],
    constraints: {
      taper_s2_max_reps: 3,    // max 3 répétitions en S-2
      taper_s1_forbidden: true, // INTERDIT en S-1 trail
    },
    build({ durationMin, zones, taperSub }) {
      const z = zones.zoneLabel;
      const warmup   = 20;
      const cooldown = 10;
      const baseCount = Math.max(5, Math.min(10, Math.round((durationMin - warmup - cooldown) / 3)));
      const reps      = taperSub ? Math.min(taperReps(baseCount, taperSub), taperSub === 's2' ? 3 : baseCount) : baseCount;
      return {
        name: 'Côtes fractionnées courtes',
        coach_intro: 'Tu vas monter la même côte plusieurs fois de suite à effort soutenu. La descente est de la récupération — fais-la lentement, attentivement. Entre la première et la dernière montée, le temps ne doit pas varier de plus de 10%.',
        session_goal: 'Développer la puissance spécifique en montée, la force des mollets et des fessiers. C\'est la VMA du trail.',
        blocks: [
          {
            name: 'Échauffement',
            duration_min: warmup,
            zone_label: z('z1'),
            description: 'Footing facile sur terrain plat, puis 5 min de marche rapide en montée douce pour préparer les muscles spécifiques.',
          },
          {
            name: `${reps} × montée ~75 s — Zone 4`,
            duration_min: Math.round(durationMin - warmup - cooldown),
            zone_label: z('z4'),
            description: `Montée de ~75 secondes à effort soutenu. Zone 4 — tu peux dire ton prénom. Redescente en marchant ou trot très léger.${taperSub === 's2' ? ' (3 répétitions — affûtage S-2)' : ''}`,
            target_hr: zones.hasHr ? `${zones.bpm.z4[0]}–${zones.bpm.z4[1]} bpm` : null,
            reps: `${reps} × ~75 s`,
            recovery: 'descente marchée — récup complète',
          },
          {
            name: 'Retour au calme',
            duration_min: cooldown,
            zone_label: z('z1'),
            description: 'Marche et footing très léger sur terrain plat.',
          },
        ],
      };
    },
  },

  trail_hill_long: {
    discipline: 'trail',
    family: 'C',
    session_type: 'threshold',
    phases: ['development', 'specific'],
    constraints: {
      taper_forbidden: true,  // INTERDIT en S-2 et S-1 trail
    },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      const warmup   = 20;
      const cooldown = 10;
      const repCount = 3;
      const repDur   = Math.round((durationMin - warmup - cooldown) / repCount * 0.55);
      const descDur  = Math.round((durationMin - warmup - cooldown) / repCount * 0.45);
      return {
        name: 'Montée longue en régularité',
        coach_intro: 'Tu vas monter une côte longue 3 fois à allure régulière. La difficulté n\'est pas l\'intensité — c\'est la régularité. Partir trop fort en début de montée se paie en fin.',
        session_goal: 'Développer la capacité à maintenir un effort soutenu sur une montée longue — la réalité des trails médium et long où les montées durent 20 à 40 minutes.',
        blocks: [
          { name: 'Échauffement', duration_min: warmup, zone_label: z('z1'),
            description: 'Footing facile sur terrain plat.' },
          {
            name: `${repCount} × montée longue — Zone 3`,
            duration_min: durationMin - warmup - cooldown,
            zone_label: z('z3'),
            description: `Montée de ${repDur} min en Zone 3 — phrase entière difficile. Alterne course et marche selon la pente. En haut : 2 min de récupération. Descente de ${descDur} min : contrôlée, récup active.`,
            target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
            reps: `${repCount} × ${repDur} min`,
            recovery: `descente ~${descDur} min en récup active`,
          },
          { name: 'Retour au calme', duration_min: cooldown, zone_label: z('z1'),
            description: 'Marche sur terrain plat.' },
        ],
      };
    },
  },

  trail_dplus: {
    discipline: 'trail',
    family: 'D',
    session_type: 'long',
    phases: ['base', 'development', 'specific'],
    constraints: {
      taper_forbidden: true,  // INTERDIT en S-3/S-2/S-1 trail
    },
    build({ durationMin, zones, targetDplus }) {
      const z = zones.zoneLabel;
      const passCount = Math.max(3, Math.round(durationMin / 35));
      return {
        name: 'Accumulation de D+',
        coach_intro: 'La séance la plus spécifique de ta préparation trail. Tu vas accumuler du dénivelé sur la même montée, en plusieurs passages. La fatigue que tu ressentiras dans les quadriceps en descente est exactement celle de la compétition.',
        session_goal: 'Habituer le corps au dénivelé cumulé. Un trail de 50 km avec 3000 m D+ se prépare en accumulant du dénivelé à l\'entraînement — il n\'y a pas de raccourci.',
        blocks: [
          { name: 'Mise en route', duration_min: 15, zone_label: z('z1'),
            description: 'Marche active en montée douce. Progressivement.' },
          {
            name: `${passCount} passages aller-retour`,
            duration_min: durationMin - 30,
            zone_label: z('z2'),
            description: `Montée en alternant course et marche selon la pente. Quand ça dépasse 20% : marche vite, bras actifs. En haut : 2 min de récupération obligatoire, alimentation. Descente : contrôlée, foulées courtes. Zone 2 en descente.${targetDplus ? ` Objectif D+ : ~${targetDplus} m.` : ''}`,
            target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
          },
          { name: 'Retour au calme', duration_min: 15, zone_label: z('z1'),
            description: 'Marche active sur terrain plat. Étire quadriceps et mollets.' },
        ],
      };
    },
  },

  trail_fast_walk: {
    discipline: 'trail',
    family: 'E',
    session_type: 'endurance',
    phases: ['base', 'development', 'specific', 'taper'],
    constraints: {
      taper_preferred_s1: true,  // préféré en S-1 trail (zéro traumatisme)
      no_dplus: true,
    },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return {
        name: 'Marche rapide active',
        coach_intro: 'Tu vas marcher dans toutes les montées pendant toute la séance. Oui, marcher. Efficacement, rapidement, les bras travaillant. Sur les trails longs et ultra, la marche rapide est une technique compétitive — pas un repli.',
        session_goal: 'Apprendre à maintenir une intensité cardiaque utile en marchant. Les ultra-trailers qui savent marcher vite récupèrent mieux dans les montées et courent mieux sur le reste.',
        blocks: [
          {
            name: 'Marche active en montée',
            duration_min: durationMin,
            zone_label: z('z2'),
            description: 'Technique : buste légèrement incliné vers l\'avant, bras à 90° et actifs, foulée compacte et régulière, poussée sur l\'avant du pied. Sur replats et légères descentes : trot très léger. Zone 2 en permanence.',
            target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
          },
        ],
      };
    },
  },

  trail_descent: {
    discipline: 'trail',
    family: 'F',
    session_type: 'endurance',
    phases: ['development', 'specific'],
    constraints: {
      taper_forbidden: true,  // INTERDIT en affûtage trail
    },
    build({ durationMin, zones }) {
      const z = zones.zoneLabel;
      const warmup   = 15;
      const cooldown = 10;
      const repCount = Math.max(5, Math.round((durationMin - warmup - cooldown) / 5));
      return {
        name: 'Travail de descente technique',
        coach_intro: 'Tu vas descendre la même pente 6 à 8 fois, en progressant sur la vitesse et la confiance. Ce n\'est pas une course — c\'est de l\'apprentissage. La confiance en descente se construit par la répétition, pas par l\'audace.',
        session_goal: 'Améliorer la technique de descente, réduire le risque de chute, préparer les quadriceps aux impacts répétés.',
        blocks: [
          { name: 'Échauffement', duration_min: warmup, zone_label: z('z1'),
            description: 'Montée progressive, puis 2 descentes lentes en observant les appuis.' },
          {
            name: `${repCount} descentes progressives`,
            duration_min: durationMin - warmup - cooldown,
            zone_label: z('z2'),
            description: `Regard loin (3–5 m), foulées courtes, bras écartés, contact sol sous le centre de gravité.\n• ${Math.round(repCount * 0.30)} descentes à 60% : observe.\n• ${Math.round(repCount * 0.35)} descentes à 75% : fluidifie.\n• ${Math.round(repCount * 0.35)} descentes à 85% : confiance.\nRemontée à pied entre chaque.`,
          },
          { name: 'Retour au calme', duration_min: cooldown, zone_label: z('z1'),
            description: 'Footing très léger sur terrain plat.' },
        ],
      };
    },
  },

  trail_long: {
    discipline: 'trail',
    family: 'D',
    session_type: 'long',
    phases: ['base', 'development', 'specific', 'taper'],
    constraints: {
      taper_reduce_duration: true,
      taper_s1_forbidden: true,
      no_dplus_in_taper: true,       // D+ supprimé en taper
      no_descent_work_in_taper: true, // bloc descente supprimé en taper
    },
    build({ durationMin, zones, taperSub, trailCategory }) {
      const z = zones.zoneLabel;
      const isLong = trailCategory === 'run_trail_long' || trailCategory === 'run_trail_ultra';
      const isTaper = !!taperSub;
      return {
        name: isTaper ? 'Sortie trail longue (affûtage)' : (isLong ? 'Sortie longue trail avec dénivelé' : 'Sortie longue trail'),
        coach_intro: isTaper
          ? 'La dernière sortie longue de ta préparation. Terrain connu, pas d\'objectif de performance. Elle doit te laisser frais, pas entamer la semaine suivante.'
          : (isLong ? 'LA séance de la semaine. Intègre du dénivelé positif. C\'est ici que le trail se gagne ou se perd.' : 'La sortie longue. Cherche des chemins avec quelques montées.'),
        session_goal: isTaper
          ? 'Entretenir le temps sur les pieds et les adaptations musculaires du terrain.'
          : (isLong ? 'Habituer tes quadriceps et chevilles aux descentes prolongées.' : 'Développer l\'endurance trail. Terrain et durée comptent plus que la vitesse.'),
        blocks: [
          { name: 'Mise en route', duration_min: 15, zone_label: z('z1'),
            description: 'Départ très progressif. Laisse ton corps trouver son rythme.' },
          {
            name: 'Corps de sortie',
            duration_min: Math.round(durationMin * (isTaper ? 0.80 : 0.70)),
            zone_label: z('z2'),
            description: isTaper
              ? 'Alternance course / marche selon le terrain. Zone 2 permanente. Pas de D+ à chercher — si le terrain monte, tu t\'adaptes.'
              : (isLong ? 'Alternance course / marche. Cherche des montées significatives. Marche en montée, contrôle en descente.' : 'Alternance course / marche. Gestion de l\'effort avant tout.'),
            target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
          },
          ...(!isTaper ? [{
            name: 'Bloc descentes',
            duration_min: Math.round(durationMin * 0.15),
            zone_label: z('z3'),
            description: 'Travail en descente — relâche les bras, courtes foulées, regard loin.',
          }] : []),
          {
            name: 'Retour au calme',
            duration_min: Math.round(durationMin * (isTaper ? 0.20 : 0.15)),
            zone_label: z('z1'),
            description: 'Trot ou marche très léger. Étire quadriceps et mollets.',
          },
        ],
      };
    },
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// FONCTION PRINCIPALE — buildSessionFromCatalog
//
// Remplace les buildRunSession / buildTrailSession dans generator.js
// pour les types qui ont une entrée dans le catalogue.
// Les types non couverts tombent sur les builders existants (fallback).
//
// params : { key, durationMin, zones, date, taperSub, trailCategory, targetDplus }
// ─────────────────────────────────────────────────────────────────────────────

function buildSessionFromCatalog(key, params) {
  const { durationMin, zones, date, taperSub, trailCategory, targetDplus } = params;

  const entry = SESSION_CATALOG[key];
  if (!entry) return null; // fallback vers builders existants

  // Vérifier les contraintes d'affûtage avant de construire
  if (taperSub) {
    if (entry.constraints?.taper_forbidden)              return null;
    if (entry.constraints?.taper_s1_forbidden && taperSub === 's1') return null;
    if (entry.constraints?.taper_s2_forbidden && taperSub === 's2') return null;
  }

  // Durée effective : réduction en affûtage si constraint active
  let effectiveDuration = durationMin;
  if (taperSub && entry.constraints?.taper_reduce_duration) {
    const multipliers = { s3: 0.75, s2: 0.65, s1: 0.50 };
    effectiveDuration = Math.round(durationMin * (multipliers[taperSub] || 1));
  }

  const built = entry.build({
    durationMin: effectiveDuration,
    zones,
    taperSub,
    trailCategory,
    targetDplus,
  });

  if (!built) return null;

  // Calcul distance
  let distKm = null, distM = null, dPlus = 0;
  if (entry.discipline === 'run' || entry.discipline === 'trail') {
    if (zones.runZ2) {
      const m = zones.runZ2.match(/(\d+):(\d+)/);
      if (m) {
        const secPerKm = parseInt(m[1]) * 60 + parseInt(m[2]);
        distKm = Math.round((effectiveDuration * 60 / secPerKm) * 10) / 10;
      }
    }
    if (!distKm) distKm = Math.round(effectiveDuration * 0.165 * 10) / 10;
  }

  const rpeMap = {
    endurance: 4, tempo: 6, threshold: 7, long: 6, recovery: 3, vma: 8,
  };

  return {
    discipline: entry.discipline,
    session_type: entry.session_type,
    name: built.name,
    date,
    day_of_week: date.getDay(),
    duration_minutes: effectiveDuration,
    distance_km: distKm,
    distance_m: distM,
    d_plus: dPlus,
    tss_estimated: Math.round(effectiveDuration * ({ threshold: 1.6, tempo: 1.3, long: 1.1, recovery: 0.5 }[entry.session_type] || 0.8)),
    rpe_target: rpeMap[entry.session_type] || 5,
    coach_intro: built.coach_intro,
    session_goal: built.session_goal,
    blocks: JSON.stringify(built.blocks),
    // Métadonnées pour le frontend
    family: entry.family,
    taper_sub: taperSub || null,
  };
}

module.exports = { SESSION_CATALOG, buildSessionFromCatalog };
