// ─────────────────────────────────────────────────────────────────────────────
// ENDURO V1.21.x — Bibliothèque de séances enrichie
// Source de vérité pour tous les textes coach, intentions et structures.
// Importé par generator.js. Ne contient PAS de logique de génération.
//
// Structure de chaque famille :
//   { name, session_type, coach_intro, session_goal, buildBlocks(params) }
//
// buildBlocks reçoit : { durationMin, zones, reps, isRecoveryWeek, taperPhase }
// ─────────────────────────────────────────────────────────────────────────────

// ─── COURSE À PIED — Familles A à F ─────────────────────────────────────────

const RUN_SESSIONS = {

  // ── Famille A : Endurance fondamentale ──────────────────────────────────

  endurance: {
    name: 'Footing endurance',
    session_type: 'endurance',
    coach_intro: 'Sortie sans pression. L\'allure doit être suffisamment facile pour que tu puisses raconter ta journée en courant. Si tu dois reprendre ton souffle entre deux phrases, ralentis de 10 secondes par km.',
    session_goal: 'Construire ton socle aérobie. Ces footings faciles sont la fondation sur laquelle tout le reste s\'appuie — sans eux, les séances difficiles n\'ont pas d\'effet.',
    buildBlocks({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return [
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
          description: 'Trot très léger, presque de la marche. Laisse la respiration revenir au calme d\'elle-même.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z1[1]} bpm` : null,
        },
      ];
    },
  },

  recovery_active: {
    name: 'Récupération active',
    session_type: 'recovery',
    coach_intro: 'Tu sors pour récupérer, pas pour t\'entraîner. La différence semble subtile — elle ne l\'est pas. Cette sortie doit te laisser plus frais à la fin qu\'au début.',
    session_goal: 'La récupération active est plus efficace que le repos complet pour éliminer les déchets métaboliques. Elle prépare les jambes à la prochaine séance sans les charger.',
    buildBlocks({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return [
        {
          name: 'Footing très facile',
          duration_min: durationMin,
          zone_label: z('z1'),
          description: 'Zone 1 uniquement. Terrain plat. Si tu as envie d\'aller plus vite, c\'est que tu vas trop vite. Aucun objectif de vitesse.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null,
        },
      ];
    },
  },

  // ── Famille B : Tempo contrôlé ──────────────────────────────────────────

  tempo: {
    name: 'Tempo fractionné',
    session_type: 'tempo',
    coach_intro: 'Tu vas travailler à une intensité soutenue — pas de la souffrance, mais un effort que tu remarques. L\'allure doit être identique sur tous les blocs. Si le dernier est nettement plus difficile que le premier, tu es parti trop fort.',
    session_goal: 'Développer ta capacité à courir longtemps à allure modérément exigeante. C\'est l\'intensité qui fera la différence sur la deuxième partie de ta course.',
    buildBlocks({ durationMin, zones, reps }) {
      const z = zones.zoneLabel;
      const warmup  = 12;
      const cooldown = 8;
      const repDur  = reps?.duration_min || Math.max(10, Math.round((durationMin - warmup - cooldown) * 0.65));
      const repCount = reps?.count || 2;
      const recov   = reps?.recovery_min || 3;
      return [
        {
          name: 'Échauffement',
          duration_min: warmup,
          zone_label: z('z1'),
          description: 'Trot facile, puis 3 accélérations progressives de 20 secondes. Les jambes doivent être réveillées avant le premier bloc.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null,
        },
        {
          name: `${repCount} × ${repDur} min — Zone 3`,
          duration_min: repCount * repDur + (repCount - 1) * recov,
          zone_label: z('z3'),
          description: 'Effort soutenu et régulier. Tu peux dire une phrase entière — pas deux. Résiste à l\'envie de regarder ta vitesse. Cours au ressenti.',
          target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
          reps: `${repCount} × ${repDur} min`,
          recovery: `${recov} min trot léger`,
        },
        {
          name: 'Retour au calme',
          duration_min: cooldown,
          zone_label: z('z1'),
          description: 'Trot très léger.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
        },
      ];
    },
  },

  tempo_continu: {
    name: 'Tempo continu',
    session_type: 'tempo',
    coach_intro: 'Version longue et continue du tempo. Elle demande plus de maîtrise que le fractionné — partir trop vite se paie en fin de bloc. C\'est justement cet apprentissage qui est précieux.',
    session_goal: 'Tenir un effort soutenu sur une longue durée sans décrocher. Développer la capacité à réguler l\'intensité — compétence clé sur tous les formats de course.',
    buildBlocks({ durationMin, zones }) {
      const z = zones.zoneLabel;
      const warmup   = 15;
      const cooldown = 10;
      const tempoDur = Math.max(15, durationMin - warmup - cooldown);
      return [
        {
          name: 'Échauffement',
          duration_min: warmup,
          zone_label: z('z1'),
          description: 'Zone 1–2, très facile.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null,
        },
        {
          name: `${tempoDur} min de tempo continu`,
          duration_min: tempoDur,
          zone_label: z('z3'),
          description: 'Phrase entière difficile — pas impossible. Résistance régulière du début à la fin. Pas d\'accélération finale.',
          target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
        },
        {
          name: 'Retour au calme',
          duration_min: cooldown,
          zone_label: z('z1'),
          description: 'Zone 1, progressif.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
        },
      ];
    },
  },

  // ── Famille C : Seuil ───────────────────────────────────────────────────

  threshold: {
    name: 'Intervalles seuil',
    session_type: 'threshold',
    coach_intro: 'Séance qualité centrale. Difficile par conception. L\'objectif n\'est pas de survivre au dernier bloc — c\'est de finir le dernier dans le même état que le premier. Si tu t\'effondres sur la fin, tu es parti trop fort.',
    session_goal: 'Repousser le seuil anaérobie. Chaque bloc bien réalisé déplace légèrement ton plafond vers le haut. C\'est une progression lente — et très solide.',
    buildBlocks({ durationMin, zones, reps }) {
      const z = zones.zoneLabel;
      const warmup   = 15;
      const cooldown = 8;
      const repDur   = reps?.duration_min || 6;
      const repCount = reps?.count || Math.max(3, Math.min(5, Math.round((durationMin - warmup - cooldown) / (repDur + 3))));
      const recov    = reps?.recovery_min || 3;
      return [
        {
          name: 'Échauffement',
          duration_min: warmup,
          zone_label: z('z1'),
          description: 'Trot facile 10 min, puis 4 accélérations progressives de 20 s. Les jambes doivent être vraiment réveillées avant de commencer.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[1]} bpm` : null,
        },
        {
          name: `${repCount} × ${repDur} min — Zone 4`,
          duration_min: repCount * repDur + (repCount - 1) * recov,
          zone_label: z('z4'),
          description: `Zone 4 — effort dur, régulier. Tu peux dire ton prénom et la ville. Pas beaucoup plus. Récupération ${recov} min de trot très léger entre chaque bloc.`,
          target_hr: zones.hasHr ? `${zones.bpm.z4[0]}–${zones.bpm.z4[1]} bpm` : null,
          target_pace: zones.runZ4 || 'allure seuil',
          reps: `${repCount} × ${repDur} min`,
          recovery: `${recov} min trot léger`,
        },
        {
          name: 'Retour au calme',
          duration_min: cooldown,
          zone_label: z('z1'),
          description: 'Trot très léger. Étire quadriceps et mollets après l\'arrêt.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
        },
      ];
    },
  },

  threshold_long: {
    name: 'Seuil long',
    session_type: 'threshold',
    coach_intro: 'Version longue du seuil — blocs de 15 à 20 minutes. La difficulté est de partir à la bonne intensité : ni trop fort pour tenir 18 minutes, ni trop facile pour avoir un effet.',
    session_goal: 'Développer la capacité à tenir le seuil sur des durées longues — proche des conditions réelles d\'un semi-marathon ou d\'un marathon rapide.',
    buildBlocks({ durationMin, zones, reps }) {
      const z = zones.zoneLabel;
      const warmup   = 15;
      const cooldown = 12;
      const repDur   = reps?.duration_min || 18;
      const repCount = reps?.count || 2;
      const recov    = reps?.recovery_min || 6;
      return [
        {
          name: 'Échauffement',
          duration_min: warmup,
          zone_label: z('z1'),
          description: 'Trot + 4 accélérations progressives.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[1]} bpm` : null,
        },
        {
          name: `${repCount} × ${repDur} min — Zone 4`,
          duration_min: repCount * repDur + (repCount - 1) * recov,
          zone_label: z('z4'),
          description: `Zone 4, régulier du premier au dernier kilomètre. Sur ${repDur} minutes, la tentation d\'accélérer en fin de bloc est forte. Résiste — la régularité est le seul critère. Récupération ${recov} min de récup active.`,
          target_hr: zones.hasHr ? `${zones.bpm.z4[0]}–${zones.bpm.z4[1]} bpm` : null,
          target_pace: zones.runZ4 || 'allure seuil',
          reps: `${repCount} × ${repDur} min`,
          recovery: `${recov} min récup active`,
        },
        {
          name: 'Retour au calme',
          duration_min: cooldown,
          zone_label: z('z1'),
          description: 'Trot très léger progressif.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
        },
      ];
    },
  },

  // ── Famille D : Sortie longue ───────────────────────────────────────────

  long_run: {
    name: 'Sortie longue',
    session_type: 'long',
    coach_intro: 'La séance de la semaine. Elle n\'est pas là pour te fatiguer — elle est là pour que tu apprennes à gérer l\'effort sur la durée. La progression finale est ton baromètre : si tu peux accélérer après 75% du parcours, ta gestion d\'effort était juste.',
    session_goal: 'Développer l\'endurance profonde et apprendre à courir fatigué. La progression finale simule les derniers kilomètres de ta course — et c\'est précisément ce qu\'on cherche.',
    buildBlocks({ durationMin, zones }) {
      const z = zones.zoneLabel;
      const startup   = Math.round(durationMin * 0.17);
      const main      = Math.round(durationMin * 0.60);
      const progress  = Math.round(durationMin * 0.23);
      return [
        {
          name: 'Mise en route',
          duration_min: startup,
          zone_label: z('z1'),
          description: 'Zone 1 — presque trop facile. Résiste à l\'envie d\'aller plus vite pendant les premières minutes. Les 20 premières minutes doivent te sembler légères.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null,
        },
        {
          name: 'Corps de sortie',
          duration_min: main,
          zone_label: z('z2'),
          description: 'Zone 2 régulier. Alimentation toutes les 20 à 25 minutes si la sortie dépasse 1h15 — ne pas attendre d\'avoir faim. Bois régulièrement.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
          target_pace: zones.runZ2 || 'allure confortable',
        },
        {
          name: 'Progression finale',
          duration_min: progress,
          zone_label: z('z3'),
          description: 'Monte doucement vers Zone 3. Pas un sprint — une montée progressive et continue. À la fin, tu dois être à un effort soutenu, pas épuisé. Sens que tu pourrais encore accélérer si nécessaire.',
          target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
        },
      ];
    },
  },

  long_run_specific: {
    name: 'Sortie longue spécifique',
    session_type: 'long',
    coach_intro: 'Version spécifique de la longue — avec un cœur à allure cible. Tu testes ton allure et ton alimentation dans les mêmes conditions que la course. C\'est une répétition générale, pas une compétition.',
    session_goal: 'Ancrer la sensation de l\'allure cible dans le corps fatigué. La spécificité se construit en courant à allure de course dans un contexte de fatigue — c\'est exactement ce que fait cette séance.',
    buildBlocks({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return [
        {
          name: 'Mise en route',
          duration_min: Math.round(durationMin * 0.18),
          zone_label: z('z1'),
          description: 'Zone 1–2 très facile.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null,
        },
        {
          name: 'Endurance de base',
          duration_min: Math.round(durationMin * 0.30),
          zone_label: z('z2'),
          description: 'Zone 2 pour installer le rythme. Commence l\'alimentation.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
        },
        {
          name: 'Bloc allure cible',
          duration_min: Math.round(durationMin * 0.30),
          zone_label: z('z3'),
          description: 'Cours à ton allure de course. Si tu as un temps visé, c\'est cette allure. Sinon : un effort qui te paraît "soutenable sur ta distance cible" — entre Z2 et Z3. Teste ton alimentation simultanément.',
          target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
          target_pace: zones.runZ4 ? `proche de ${zones.runZ4}` : 'allure cible',
        },
        {
          name: 'Endurance de retour',
          duration_min: Math.round(durationMin * 0.15),
          zone_label: z('z2'),
          description: 'Zone 2, jambes chargées. Note comment tu te sens — c\'est de l\'information.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
        },
        {
          name: 'Retour au calme',
          duration_min: Math.round(durationMin * 0.07),
          zone_label: z('z1'),
          description: 'Zone 1, progressif.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
        },
      ];
    },
  },

  // ── Famille E : VMA et intensités courtes ───────────────────────────────

  vma_30_30: {
    name: 'VMA — 30/30',
    session_type: 'threshold',
    coach_intro: 'Séance rapide. Très rapide. Des efforts de 30 secondes à vitesse maximale, avec 30 secondes de récupération. Simple sur le papier, exigeant dans les jambes. Contre-intuitivement, travailler plus vite que ton allure de course améliore ton allure de course.',
    session_goal: 'Développer la vitesse maximale aérobie. En quelques semaines, une allure qui était difficile devient gérable.',
    buildBlocks({ durationMin, zones, reps }) {
      const z = zones.zoneLabel;
      const warmup   = 15;
      const cooldown = 10;
      const series1Reps = reps?.series1 || Math.max(8, Math.round((durationMin - warmup - cooldown - 5) * 0.55 / 1));
      const series2Reps = reps?.series2 || Math.max(5, Math.round((durationMin - warmup - cooldown - 5) * 0.45 / 2.5));
      return [
        {
          name: 'Échauffement',
          duration_min: warmup,
          zone_label: z('z1'),
          description: 'Trot facile 10 min, puis 6 accélérations progressives de 20 s. Les jambes doivent être parfaitement réveillées — sans ça, le risque de blessure augmente.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z3[0]} bpm` : null,
        },
        {
          name: `Série 1 — ${series1Reps} × 30 s / 30 s`,
          duration_min: Math.round(series1Reps * 1),
          zone_label: z('z5'),
          description: 'Zone 5 — tu ne peux plus parler du tout. Cours nettement plus vite que ton allure de 10 km. Les 30 s de récup : vraie récupération, marche si nécessaire.',
          reps: `${series1Reps} × 30 s`,
          recovery: '30 s marche ou trot très lent',
        },
        {
          name: 'Transition',
          duration_min: 5,
          zone_label: z('z1'),
          description: 'Trot facile entre les deux séries.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null,
        },
        {
          name: `Série 2 — ${series2Reps} × 1 min / 1 min 30`,
          duration_min: Math.round(series2Reps * 2.5),
          zone_label: z('z5'),
          description: 'Même principe — efforts plus longs. L\'intensité doit rester maximale. La récupération longue te permet de repartir à pleine intensité à chaque fois.',
          reps: `${series2Reps} × 1 min`,
          recovery: '1 min 30 — utilise-la vraiment',
        },
        {
          name: 'Retour au calme',
          duration_min: cooldown,
          zone_label: z('z1'),
          description: 'Trot très léger. Ne t\'arrête pas net — laisse le corps redescendre progressivement.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z2[0]} bpm` : null,
        },
      ];
    },
  },

  // ── Famille F : Technique et économie ───────────────────────────────────

  technique: {
    name: 'Éducatifs et technique de course',
    session_type: 'endurance',
    coach_intro: 'Séance légère en intensité, sérieuse en concentration. Tu vas travailler la qualité de ta foulée — comment ton pied touche le sol, comment tes bras travaillent, comment ton bassin se place. Ces détails font la différence sur un marathon.',
    session_goal: 'Améliorer l\'économie de course. Un athlète 8% plus économique court comme s\'il avait 8% de moteur en plus — sans aucun entraînement physique supplémentaire.',
    buildBlocks({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return [
        {
          name: 'Échauffement',
          duration_min: 15,
          zone_label: z('z1'),
          description: 'Footing très facile. Sens ton corps, pas ta montre.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null,
        },
        {
          name: 'Éducatifs de course',
          duration_min: 15,
          zone_label: z('z1'),
          description: '6 exercices sur 30 à 40 mètres — marche de retour entre chaque.\n\n• Montées de genoux : genoux à hauteur des hanches, bras actifs en opposition.\n• Talons-fesses : talons vers les fesses, buste droit.\n• Pas chassés latéraux : croisé-décroisé, 20 m puis change de côté.\n• Foulées bondissantes : pousse fort, cherche la hauteur.\n• Course sur pointes : contact sol minimal.\n• Course bras exagérés : exagère l\'amplitude des bras — les jambes suivent.',
        },
        {
          name: 'Strides',
          duration_min: 5,
          zone_label: z('z3'),
          description: '4 accélérations progressives de 80 mètres. De 70% à 90% de ta vitesse maximale. Jamais à fond — tu cherches la fluidité, pas la vitesse.',
        },
        {
          name: 'Footing retour',
          duration_min: durationMin - 35,
          zone_label: z('z1'),
          description: 'Footing très léger. Concentre-toi sur ce que tu ressens différemment par rapport au début de la séance.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null,
        },
      ];
    },
  },

  // ── Affûtage : rappel allure course ─────────────────────────────────────

  race_pace_recall: {
    name: 'Rappel allure course',
    session_type: 'tempo',
    coach_intro: 'La séance la plus précieuse de la semaine S-2. Tu vas courir quelques minutes à ton allure cible. Pas pour te tester — pour retrouver la sensation. Pour que le jour J, cette allure soit une vieille connaissance, pas une abstraction.',
    session_goal: 'Ancrer la sensation de l\'allure cible dans le corps. Un rappel d\'allure à J-7 garantit que tu arrives sur la ligne avec ce ressenti frais en mémoire.',
    buildBlocks({ durationMin, zones, reps }) {
      const z = zones.zoneLabel;
      const repCount = reps?.count || 2;
      const repDur   = reps?.duration_min || 5;
      const recov    = reps?.recovery_min || 2;
      return [
        {
          name: 'Échauffement',
          duration_min: 12,
          zone_label: z('z1'),
          description: 'Zone 1–2, 3 accélérations progressives de 20 s.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[0]} bpm` : null,
        },
        {
          name: `${repCount} × ${repDur} min — allure cible`,
          duration_min: repCount * repDur + (repCount - 1) * recov,
          zone_label: z('z3'),
          description: 'Cours à ton allure de course. Pas plus vite, même si ça semble facile. L\'objectif n\'est pas la performance — c\'est la calibration. Note comment tu te sens.',
          target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
          target_pace: zones.runZ4 ? `proche de ${zones.runZ4}` : 'allure cible course',
          reps: `${repCount} × ${repDur} min`,
          recovery: `${recov} min trot léger`,
        },
        {
          name: 'Retour au calme',
          duration_min: durationMin - 12 - repCount * repDur - (repCount - 1) * recov,
          zone_label: z('z1'),
          description: 'Zone 1, très progressif.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z1[1]} bpm` : null,
        },
      ];
    },
  },
};

// ─── TRAIL — Familles A à F ──────────────────────────────────────────────────

const TRAIL_SESSIONS = {

  // ── Famille A : Endurance terrain varié ─────────────────────────────────

  endurance: {
    name: 'Sortie trail endurance',
    session_type: 'endurance',
    coach_intro: 'Tu sors en nature, tu cours et tu marches selon le terrain. Ton seul indicateur : la respiration. Conversationnelle en permanence. En trail, la marche rapide dans les montées est une technique compétitive — pas un échec.',
    session_goal: 'Construire l\'endurance spécifique trail — capacité à alterner course et marche sur terrain irrégulier, gestion de l\'effort sur le temps, adaptation des appuis.',
    buildBlocks({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return [
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
          description: 'Alternance naturelle course et marche. Quand la pente dépasse 15–20% : marche rapide, bras actifs, buste légèrement incliné. Ce n\'est pas de la récupération. C\'est une autre façon de monter. Zone 2 en permanence.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z2[1]} bpm` : null,
        },
        {
          name: 'Bloc descente',
          duration_min: Math.round(durationMin * 0.10),
          zone_label: z('z2'),
          description: 'Descente contrôlée. Foulées courtes, regard loin (3 à 5 mètres devant), bras légèrement écartés. Les quadriceps gèrent l\'impact — pas les genoux.',
        },
        {
          name: 'Retour au calme',
          duration_min: Math.round(durationMin * 0.05),
          zone_label: z('z1'),
          description: 'Marche active. Étire quadriceps et mollets.',
        },
      ];
    },
  },

  // ── Famille B : Côtes fractionnées courtes ───────────────────────────────

  hill_short: {
    name: 'Côtes fractionnées courtes',
    session_type: 'threshold',
    coach_intro: 'Tu vas monter la même côte plusieurs fois de suite à effort soutenu. La descente est de la récupération — fais-la lentement, attentivement. Entre la première et la dernière montée, le temps ne doit pas varier de plus de 10%.',
    session_goal: 'Développer la puissance spécifique en montée, la force des mollets et des fessiers. C\'est la VMA du trail.',
    buildBlocks({ durationMin, zones, reps }) {
      const z = zones.zoneLabel;
      const warmup   = 20;
      const cooldown = 10;
      const repCount = reps?.count || Math.max(5, Math.min(10, Math.round((durationMin - warmup - cooldown) / 3)));
      const repDur   = reps?.duration_seconds || 75; // secondes
      return [
        {
          name: 'Échauffement',
          duration_min: warmup,
          zone_label: z('z1'),
          description: 'Footing facile sur terrain plat, puis 5 min de marche rapide en montée douce pour préparer les muscles spécifiques.',
        },
        {
          name: `${repCount} × montée ${Math.round(repDur)}s — Zone 4`,
          duration_min: Math.round(durationMin - warmup - cooldown),
          zone_label: z('z4'),
          description: `Montée de ${Math.round(repDur)} secondes à effort soutenu. Zone 4 — tu peux dire ton prénom. Pas beaucoup plus. Redescente en marchant ou trot très léger — ne cours pas pour aller plus vite au prochain départ.`,
          target_hr: zones.hasHr ? `${zones.bpm.z4[0]}–${zones.bpm.z4[1]} bpm` : null,
          reps: `${repCount} × ${Math.round(repDur)} s`,
          recovery: 'descente marchée — récup complète',
        },
        {
          name: 'Retour au calme',
          duration_min: cooldown,
          zone_label: z('z1'),
          description: 'Marche et footing très léger sur terrain plat.',
        },
      ];
    },
  },

  // ── Famille C : Côtes longues ────────────────────────────────────────────

  hill_long: {
    name: 'Montée longue en régularité',
    session_type: 'threshold',
    coach_intro: 'Tu vas monter une côte longue 3 à 4 fois à allure régulière. La difficulté n\'est pas l\'intensité — c\'est la régularité. Partir trop fort en début de montée se paie en fin. Si tu dois marcher de plus en plus souvent au fil des passages, tu es parti trop vite.',
    session_goal: 'Développer la capacité à maintenir un effort soutenu sur une montée longue — la réalité des trails médium et long où les montées durent 20 à 40 minutes.',
    buildBlocks({ durationMin, zones, reps }) {
      const z = zones.zoneLabel;
      const warmup   = 20;
      const cooldown = 10;
      const repCount = reps?.count || 3;
      const repDur   = Math.round((durationMin - warmup - cooldown) / repCount * 0.55);
      const descDur  = Math.round((durationMin - warmup - cooldown) / repCount * 0.45);
      return [
        {
          name: 'Échauffement',
          duration_min: warmup,
          zone_label: z('z1'),
          description: 'Footing facile sur terrain plat.',
        },
        {
          name: `${repCount} × montée longue — Zone 3`,
          duration_min: durationMin - warmup - cooldown,
          zone_label: z('z3'),
          description: `Montée de ${repDur} min en Zone 3 — phrase entière difficile. Alterne course et marche rapide selon la pente. En haut : 2 min de récupération. Descente de ${descDur} min : contrôlée, technique, récup active.`,
          target_hr: zones.hasHr ? `${zones.bpm.z3[0]}–${zones.bpm.z3[1]} bpm` : null,
          reps: `${repCount} × ${repDur} min`,
          recovery: 'descente en récup active',
        },
        {
          name: 'Retour au calme',
          duration_min: cooldown,
          zone_label: z('z1'),
          description: 'Marche sur terrain plat.',
        },
      ];
    },
  },

  // ── Famille D : Accumulation D+ ──────────────────────────────────────────

  dplus_accumulation: {
    name: 'Accumulation de D+',
    session_type: 'long',
    coach_intro: 'La séance la plus spécifique de ta préparation trail. Tu vas accumuler du dénivelé sur la même montée, en plusieurs passages. Ce n\'est pas de la randonnée — c\'est un travail de force et d\'endurance très ciblé. La fatigue que tu ressentiras dans les quadriceps en descente est exactement celle de la compétition.',
    session_goal: 'Habituer le corps au dénivelé cumulé. Un trail de 50 km avec 3000 m D+ se prépare en accumulant du dénivelé à l\'entraînement. Il n\'y a pas de raccourci.',
    buildBlocks({ durationMin, zones, targetDplus }) {
      const z = zones.zoneLabel;
      const passCount = Math.max(3, Math.round(durationMin / 35));
      return [
        {
          name: 'Mise en route',
          duration_min: 15,
          zone_label: z('z1'),
          description: 'Marche active en montée douce. Progressivement.',
        },
        {
          name: `${passCount} passages aller-retour`,
          duration_min: durationMin - 30,
          zone_label: z('z2'),
          description: `Montée en alternant course et marche selon la pente. Quand ça dépasse 20% : marche vite, bras actifs. En haut : 2 min de récupération obligatoire, alimentation. Descente : contrôlée, foulées courtes, regard loin. Zone 2 en descente — ne te laisse pas emporter par la gravité. Objectif D+ : ~${targetDplus || '???'} m`,
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
        },
        {
          name: 'Retour au calme',
          duration_min: 15,
          zone_label: z('z1'),
          description: 'Marche active sur terrain plat. Étire quadriceps et mollets.',
        },
      ];
    },
  },

  // ── Famille E : Marche rapide en montée ─────────────────────────────────

  fast_walk: {
    name: 'Marche rapide active en montée',
    session_type: 'endurance',
    coach_intro: 'Tu vas marcher dans toutes les montées pendant toute la séance. Oui, marcher. Efficacement, rapidement, les bras travaillant. Sur les trails longs et ultra, la marche rapide est une technique compétitive — pas un repli. Elle s\'entraîne.',
    session_goal: 'Apprendre à maintenir une intensité cardiaque utile en marchant. Les ultra-trailers qui savent marcher vite récupèrent mieux dans les montées et courent mieux sur le reste.',
    buildBlocks({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return [
        {
          name: 'Marche active en montée',
          duration_min: durationMin,
          zone_label: z('z2'),
          description: 'Technique : buste légèrement incliné vers l\'avant, bras à 90° et actifs en opposition aux pieds, foulée compacte et régulière, poussée sur l\'avant du pied. Sur les replats et légères descentes : trot très léger. Zone 2 en permanence — si tu t\'essouffles en marchant, tu vas trop vite.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
        },
      ];
    },
  },

  // ── Famille F : Descente technique ──────────────────────────────────────

  descent_technique: {
    name: 'Travail de descente technique',
    session_type: 'endurance',
    coach_intro: 'Tu vas descendre la même pente 6 à 8 fois, en progressant sur la vitesse et la confiance. Ce n\'est pas une course — c\'est de l\'apprentissage. La confiance en descente se construit par la répétition, pas par l\'audace.',
    session_goal: 'Améliorer la technique de descente, réduire le risque de chute, préparer les quadriceps aux impacts répétés. La descente en trail est une compétence — elle se travaille.',
    buildBlocks({ durationMin, zones }) {
      const z = zones.zoneLabel;
      const warmup   = 15;
      const cooldown = 10;
      const repCount = Math.max(5, Math.round((durationMin - warmup - cooldown) / 5));
      return [
        {
          name: 'Échauffement',
          duration_min: warmup,
          zone_label: z('z1'),
          description: 'Montée progressive pour s\'échauffement, puis 2 descentes lentes en observant tes appuis.',
        },
        {
          name: `${repCount} descentes progressives`,
          duration_min: durationMin - warmup - cooldown,
          zone_label: z('z2'),
          description: `5 points techniques : regard loin (3–5 m), foulées courtes et rapides, bras légèrement écartés, contact sol sous le centre de gravité, accepter l\'irrégularité.\n\n• ${Math.round(repCount * 0.3)} descentes à 60% : observe les appuis.\n• ${Math.round(repCount * 0.35)} descentes à 75% : fluidifie.\n• ${Math.round(repCount * 0.35)} descentes à 85% : confiance, pas à 100%.\n\nRemontée à pied entre chaque passage.`,
        },
        {
          name: 'Retour au calme',
          duration_min: cooldown,
          zone_label: z('z1'),
          description: 'Footing très léger sur terrain plat.',
        },
      ];
    },
  },
};

// ─── TRIATHLON — Séances natation enrichies ──────────────────────────────────

const SWIM_SESSIONS = {

  technique: {
    name: 'Natation technique',
    session_type: 'endurance',
    coach_intro: 'Séance calme, concentrée. Pas de chrono, pas d\'allure — uniquement du geste. Un athlète qui nage mieux dépense moins d\'énergie pour la même vitesse. Cette énergie sera disponible sur le vélo et la course.',
    session_goal: 'Améliorer l\'économie de nage. La technique se travaille à intensité légère avec une concentration maximale sur le geste.',
    buildBlocks({ durationMin, zones }) {
      const z = zones.zoneLabel;
      return [
        {
          name: 'Échauffement',
          duration_min: 8,
          zone_label: z('z1'),
          description: '300 m en crawl très facile. Sens l\'eau, ajuste ta position.',
          distance_m: 300,
        },
        {
          name: 'Éducatif — Rattrapé',
          duration_min: 8,
          zone_label: z('z1'),
          description: '4 × 50 m. Nage avec un seul bras à la fois, l\'autre tendu devant dans le prolongement du corps. Attends que ta main "rattrape" le mouvement avant de changer. Objectif : sentir l\'allongement avant le cycle de bras.',
          reps: '4 × 50 m',
          recovery: '20 s',
          distance_m: 200,
        },
        {
          name: 'Éducatif — Battements planche',
          duration_min: 6,
          zone_label: z('z1'),
          description: '4 × 25 m. Planche en main, jambes seules. Chevilles relâchées — l\'effort vient des hanches, pas des genoux.',
          reps: '4 × 25 m',
          recovery: '15 s',
          distance_m: 100,
        },
        {
          name: 'Éducatif — Respiration bilatérale',
          duration_min: 8,
          zone_label: z('z1'),
          description: '4 × 50 m. Respire alternativement à droite et à gauche toutes les 3 nages. Ça déséquilibre au début — c\'est exactement l\'objectif.',
          reps: '4 × 50 m',
          recovery: '20 s',
          distance_m: 200,
        },
        {
          name: 'Nage libre',
          duration_min: durationMin - 35,
          zone_label: z('z2'),
          description: 'Crawl en Zone 2. Concentration sur l\'allongement du corps après chaque cycle. Pas de chrono.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
          distance_m: Math.round((durationMin - 35) * 40),
        },
        {
          name: 'Retour au calme',
          duration_min: 5,
          zone_label: z('z1'),
          description: '200 m dos très lent.',
          distance_m: 200,
        },
      ];
    },
  },

  endurance_series: {
    name: 'Natation endurance — séries',
    session_type: 'threshold',
    coach_intro: 'Travail d\'endurance en séries. L\'enjeu est la régularité — chaque série doit être parcourue à la même allure. Si la dernière est nettement plus difficile que la première, tu es parti trop fort.',
    session_goal: 'Développer la capacité à tenir une allure de nage soutenue sur la durée du segment natation en compétition.',
    buildBlocks({ durationMin, zones, reps }) {
      const z = zones.zoneLabel;
      const repCount = reps?.count || 6;
      const distPerRep = reps?.distance_m || 200;
      return [
        {
          name: 'Échauffement',
          duration_min: 10,
          zone_label: z('z1'),
          description: '400 m avec 2 × 25 m de battements planche.',
          distance_m: 400,
        },
        {
          name: `${repCount} × ${distPerRep} m — Zone 3–4`,
          duration_min: Math.round(durationMin * 0.55),
          zone_label: z('z4'),
          description: 'Allure soutenue mais régulière. Récupération 30 s entre chaque. Pas d\'accélération sur la dernière — la régularité est le critère.',
          target_hr: zones.hasHr ? `${zones.bpm.z3[1]}–${zones.bpm.z4[1]} bpm` : null,
          reps: `${repCount} × ${distPerRep} m`,
          recovery: '30 s',
          distance_m: repCount * distPerRep,
        },
        {
          name: 'Nage libre',
          duration_min: Math.round(durationMin * 0.20),
          zone_label: z('z2'),
          description: 'Zone 2, allure confortable.',
          distance_m: Math.round(durationMin * 0.20 * 40),
        },
        {
          name: 'Retour au calme',
          duration_min: 5,
          zone_label: z('z1'),
          description: '200 m très lent.',
          distance_m: 200,
        },
      ];
    },
  },
};

// ─── VÉLO — Types enrichis ───────────────────────────────────────────────────

const BIKE_SESSIONS = {
  cadence: {
    name: 'Travail de cadence',
    session_type: 'endurance',
    coach_intro: 'Séance technique. Tu vas apprendre à pédaler vite et léger plutôt que lentement et fort. La haute cadence demande de la concentration — c\'est normal. Avec de la pratique, 92 rpm devient ton allure naturelle.',
    session_goal: 'Améliorer l\'économie de pédalage. En triathlon, une cadence élevée préserve les jambes pour la course à pied.',
    buildBlocks({ durationMin, zones, reps }) {
      const z = zones.zoneLabel;
      const repCount = reps?.count || 5;
      return [
        {
          name: 'Échauffement',
          duration_min: 15,
          zone_label: z('z1'),
          description: 'Pédalage léger, cadence libre.',
          target_hr: zones.hasHr ? `${zones.bpm.z1[0]}–${zones.bpm.z1[1]} bpm` : null,
        },
        {
          name: `${repCount} × (5 min haute cadence / 2 min normale)`,
          duration_min: repCount * 7,
          zone_label: z('z2'),
          description: 'Haute cadence = 100–110 rpm avec très peu de résistance. Si les jambes brûlent, la résistance est trop élevée. Cadence normale = 85–90 rpm — ce n\'est pas une récupération, c\'est une transition.',
          reps: `${repCount} × (5 min + 2 min)`,
        },
        {
          name: 'Endurance',
          duration_min: durationMin - 15 - repCount * 7 - 10,
          zone_label: z('z2'),
          description: 'Zone 2 à 90–95 rpm si possible.',
          target_hr: zones.hasHr ? `${zones.bpm.z2[0]}–${zones.bpm.z2[1]} bpm` : null,
        },
        {
          name: 'Retour au calme',
          duration_min: 10,
          zone_label: z('z1'),
          description: 'Pédalage très léger.',
          target_hr: zones.hasHr ? `< ${zones.bpm.z1[1]} bpm` : null,
        },
      ];
    },
  },
};

// ─── RÈGLES D'AFFÛTAGE ───────────────────────────────────────────────────────
// Source de vérité pour le moteur de génération.
// Référencé par generatePlan() pour les phases de taper.

const TAPER_RULES = {
  // ── Volume selon la sous-phase ──────────────────────────────────────────
  volume_multiplier: {
    s3: 0.80,   // S-3 : 80% du pic
    s2: 0.65,   // S-2 : 65% du pic
    s1: 0.45,   // S-1 : 40–50% du pic
  },

  // ── Types de séances autorisés par sous-phase ───────────────────────────
  allowed_types: {
    s3: ['endurance', 'tempo', 'threshold', 'long_run', 'recovery_active', 'technique'],
    s2: ['endurance', 'tempo', 'threshold', 'long_run', 'recovery_active', 'race_pace_recall'],
    s1: ['endurance', 'recovery_active', 'race_pace_recall'],
  },

  // ── Types INTERDITS en affûtage ──────────────────────────────────────────
  forbidden_always: ['vma_30_30'],

  // ── Règles spécifiques par discipline ───────────────────────────────────
  discipline_rules: {
    run: {
      s1_forbidden: ['vma_30_30', 'threshold', 'tempo', 'long_run'],
      s2_allowed_quality: ['threshold', 'race_pace_recall'], // max 2 blocs seuil
      long_run_max_s3_pct: 0.75,  // longue réduite à 75% de la normale en S-3
    },
    trail: {
      s2_forbidden: ['dplus_accumulation', 'descent_technique', 'hill_long'],
      s1_forbidden: ['dplus_accumulation', 'descent_technique', 'hill_long', 'hill_short', 'threshold'],
      // Priorité absolue : fraîcheur musculaire des quadriceps
      note: 'Aucun D+ cumulé en S-2/S-1. Aucune descente technique. Côtes courtes uniquement en S-3.',
    },
    triathlon: {
      s2_forbidden: ['brick'],  // pas de brick long en S-2
      s1_forbidden: ['brick', 'threshold', 'vma_30_30'],
      brick_max_duration_s3: 50, // brick compact uniquement en affûtage (min)
      note: 'Bricks très courts uniquement — rappel technique, pas fatigue croisée.',
    },
  },

  // ── Règles de réduction des blocs en affûtage ───────────────────────────
  block_reduction: {
    // En S-3 : même intensité, -1 répétition vs pic
    s3: { rep_multiplier: 0.75, intensity: 'maintained' },
    // En S-2 : même intensité, -2 répétitions vs pic
    s2: { rep_multiplier: 0.55, intensity: 'maintained' },
    // En S-1 : même intensité, blocs très courts
    s1: { rep_multiplier: 0.35, intensity: 'maintained' },
  },

  // ── Message d'intention par sous-phase ──────────────────────────────────
  phase_messages: {
    s3: 'La fatigue commence à se dissiper. Les séances qualité restent présentes — avec un bloc de moins. L\'intensité ne change pas.',
    s2: 'Le volume descend encore. Tu pourrais te sentir "plat" cette semaine — c\'est le bon signal. Le corps recharge.',
    s1: 'Ta forme de course est là. Elle est sous la fatigue. Ces séances très légères laissent la fatigue disparaître et la forme émerger. Tu n\'as rien à rattraper.',
  },
};

// ─── PATTERNS D'AFFÛTAGE PAR DISCIPLINE ─────────────────────────────────────
// Remplace getWeekPattern() pour la phase 'taper'.
// La sous-phase (s3/s2/s1) est calculée dans generatePlan().

const TAPER_PATTERNS = {
  run: {
    s3: [
      { day:0, discipline:'rest', type:'rest',             pct:0    },
      { day:1, discipline:'run',  type:'threshold',        pct:0.22 }, // seuil raccourci
      { day:2, discipline:'run',  type:'recovery_active',  pct:0.10 },
      { day:3, discipline:'rest', type:'rest',             pct:0    },
      { day:4, discipline:'run',  type:'tempo_continu',    pct:0.18 }, // tempo modéré
      { day:5, discipline:'run',  type:'long_run',         pct:0.32 }, // longue réduite
      { day:6, discipline:'rest', type:'rest',             pct:0    },
    ],
    s2: [
      { day:0, discipline:'rest', type:'rest',               pct:0    },
      { day:1, discipline:'run',  type:'threshold',          pct:0.22 }, // 2 blocs seuil
      { day:2, discipline:'run',  type:'recovery_active',    pct:0.12 },
      { day:3, discipline:'rest', type:'rest',               pct:0    },
      { day:4, discipline:'run',  type:'race_pace_recall',   pct:0.22 }, // rappel allure
      { day:5, discipline:'run',  type:'endurance',          pct:0.30 }, // légère
      { day:6, discipline:'rest', type:'rest',               pct:0    },
    ],
    s1: [
      { day:0, discipline:'rest', type:'rest',               pct:0    },
      { day:1, discipline:'run',  type:'race_pace_recall',   pct:0.35 }, // mini-rappel
      { day:2, discipline:'rest', type:'rest',               pct:0    },
      { day:3, discipline:'run',  type:'recovery_active',    pct:0.30 }, // très léger
      { day:4, discipline:'rest', type:'rest',               pct:0    },
      { day:5, discipline:'rest', type:'rest',               pct:0    },
      { day:6, discipline:'rest', type:'rest',               pct:0    },
    ],
  },

  trail: {
    s3: [
      { day:0, discipline:'rest',  type:'rest',             pct:0    },
      { day:1, discipline:'trail', type:'hill_short',       pct:0.22 }, // côtes courtes, -3 reps
      { day:2, discipline:'rest',  type:'rest',             pct:0    },
      { day:3, discipline:'trail', type:'endurance',        pct:0.20 }, // terrain facile
      { day:4, discipline:'rest',  type:'rest',             pct:0    },
      { day:5, discipline:'trail', type:'long_run',         pct:0.40 }, // longue réduite, pas D+
      { day:6, discipline:'trail', type:'recovery_active',  pct:0.18 },
    ],
    s2: [
      { day:0, discipline:'rest',  type:'rest',             pct:0    },
      { day:1, discipline:'trail', type:'hill_short',       pct:0.22 }, // 3 répétitions max
      { day:2, discipline:'rest',  type:'rest',             pct:0    },
      { day:3, discipline:'trail', type:'endurance',        pct:0.30 }, // terrain plat/léger
      { day:4, discipline:'rest',  type:'rest',             pct:0    },
      { day:5, discipline:'trail', type:'endurance',        pct:0.30 }, // sortie légère
      { day:6, discipline:'rest',  type:'rest',             pct:0    },
    ],
    s1: [
      { day:0, discipline:'rest',  type:'rest',             pct:0    },
      { day:1, discipline:'trail', type:'fast_walk',        pct:0.40 }, // marche active — zéro traumatisme
      { day:2, discipline:'rest',  type:'rest',             pct:0    },
      { day:3, discipline:'trail', type:'recovery_active',  pct:0.35 }, // terrain plat uniquement
      { day:4, discipline:'rest',  type:'rest',             pct:0    },
      { day:5, discipline:'rest',  type:'rest',             pct:0    },
      { day:6, discipline:'rest',  type:'rest',             pct:0    },
    ],
  },

  triathlon: {
    s3: [
      { day:0, discipline:'rest',  type:'rest',             pct:0    },
      { day:1, discipline:'run',   type:'threshold',        pct:0.14 },
      { day:2, discipline:'bike',  type:'threshold',        pct:0.28 },
      { day:3, discipline:'swim',  type:'technique',        pct:0.12 },
      { day:4, discipline:'rest',  type:'rest',             pct:0    },
      { day:5, discipline:'brick', type:'brick',            pct:0.28 }, // brick compact ≤50 min
      { day:6, discipline:'run',   type:'recovery_active',  pct:0.18 },
    ],
    s2: [
      { day:0, discipline:'rest',  type:'rest',             pct:0    },
      { day:1, discipline:'run',   type:'threshold',        pct:0.18 },
      { day:2, discipline:'swim',  type:'endurance_series', pct:0.14 },
      { day:3, discipline:'bike',  type:'tempo',            pct:0.30 },
      { day:4, discipline:'rest',  type:'rest',             pct:0    },
      { day:5, discipline:'brick', type:'brick',            pct:0.20 }, // brick micro ≤30 min
      { day:6, discipline:'rest',  type:'rest',             pct:0    },
    ],
    s1: [
      { day:0, discipline:'rest',  type:'rest',             pct:0    },
      { day:1, discipline:'swim',  type:'technique',        pct:0.25 },
      { day:2, discipline:'run',   type:'recovery_active',  pct:0.22 },
      { day:3, discipline:'bike',  type:'threshold',        pct:0.35 }, // 2 blocs de 3 min
      { day:4, discipline:'rest',  type:'rest',             pct:0    },
      { day:5, discipline:'rest',  type:'rest',             pct:0    },
      { day:6, discipline:'rest',  type:'rest',             pct:0    },
    ],
  },
};

module.exports = {
  RUN_SESSIONS,
  TRAIL_SESSIONS,
  SWIM_SESSIONS,
  BIKE_SESSIONS,
  TAPER_RULES,
  TAPER_PATTERNS,
};
