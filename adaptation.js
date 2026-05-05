// ─────────────────────────────────────────────────────────────────────────────
// ENDURO — Moteur d'adaptation
// Chaque règle est explicite, lisible et testable.
// L'adaptation porte au maximum sur 1 séance à la fois.
// ─────────────────────────────────────────────────────────────────────────────

function computeAdaptation(feedback, session, nextSessions, allSessionsThisWeek) {
  // nextSessions : séances à venir (même semaine ou suivante)
  // allSessionsThisWeek : TOUTES les séances de la semaine courante (pour compter les jours de repos)

  // ── Cas 1 : séance non réalisée ──────────────────────────────────────────
  if (feedback.status === 'skipped') {
    // Compter les jours sans séance dans la semaine (= jours de repos réels)
    const sessionDates = (allSessionsThisWeek || [])
      .filter(s => s.discipline !== 'rest' && s.status !== 'skipped')
      .map(s => s.date?.toString().split('T')[0]);

    const uniqueSessionDays = new Set(sessionDates);
    const restDaysCount = 7 - uniqueSessionDays.size;

    // Chercher un jour sans séance parmi les prochains (≤ 5 jours)
    // Un "jour libre" = aucune séance planifiée ce jour-là
    // Construire la map des dates occupées (nextSessions + allSessionsThisWeek non-repos)
    const sessionsByDate = {};
    const allOccupied = [
      ...nextSessions,
      ...(allSessionsThisWeek || []).filter(s => s.discipline !== 'rest' && s.status !== 'skipped'),
    ];
    for (const s of allOccupied) {
      const d = s.date?.toString().split('T')[0];
      if (d) sessionsByDate[d] = (sessionsByDate[d] || 0) + 1;
    }

    let freeDate = null;
    const skippedDate = new Date(session.date);
    for (let i = 1; i <= 5; i++) {
      const d = new Date(skippedDate);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      if (!sessionsByDate[ds]) { freeDate = ds; break; }
    }

    // N'utiliser le créneau libre QUE s'il reste au moins un autre jour de repos après
    const wouldConsumeLastRest = restDaysCount <= 1;

    if (freeDate && !wouldConsumeLastRest) {
      return {
        change_type: 'reschedule',
        target_session_id: null, // sera ajouté comme nouvelle séance
        target_date: freeDate,
        original_type: session.session_type,
        new_type: session.session_type,
        original_duration: session.duration_minutes,
        new_duration: Math.round(session.duration_minutes * 0.85),
        change_description: `Séance déplacée au ${formatDate(freeDate)}`,
        change_reason: `Tu n'as pas pu faire ta séance ${disciplineLabel(session.discipline)} de ${formatDate(session.date)}. J'ai trouvé un créneau libre ${formatDate(freeDate)} — version raccourcie à 85 % pour ne pas surcharger la semaine.`,
      };
    }

    // Pas de créneau sans sacrifier le repos — on note et on passe
    return {
      change_type: 'none',
      change_description: 'Séance manquée enregistrée',
      change_reason: restDaysCount <= 1
        ? `Séance manquée enregistrée. Je ne reprogramme pas — il ne te reste qu'un jour de repos cette semaine, et celui-ci est non négociable. Le plan continue.`
        : `Séance manquée enregistrée. Pas de créneau libre dans les 5 prochains jours — le plan continue normalement.`,
    };
  }

  // ── Cas 2 : douleur signalée ──────────────────────────────────────────────
  if (feedback.pain_reported && feedback.pain_zones) {
    const zones = JSON.parse(feedback.pain_zones || '[]');
    if (zones.length > 0) {
      const impactSessions = nextSessions
        .filter(s => isHighImpactForZone(s.discipline, zones))
        .slice(0, 3); // maximum 3 séances impactées

      if (impactSessions.length > 0) {
        const target = impactSessions[0];
        const newType = target.discipline === 'run' ? 'recovery_swim' : 'endurance';
        return {
          change_type: 'replace_discipline',
          target_session_id: target.id,
          original_type: target.session_type,
          new_type: 'endurance',
          original_duration: target.duration_minutes,
          new_duration: Math.round(target.duration_minutes * 0.85),
          change_description: `Séance du ${formatDate(target.date)} adaptée`,
          change_reason: `Tu as signalé une douleur (${zones.join(', ')}). J'ai retiré la séance à fort impact du ${formatDate(target.date)} et l'ai remplacée par quelque chose de plus léger. Si la douleur persiste plus de 48h, consulte un kiné.`,
        };
      }
    }
  }

  // ── Cas 3 : RPE très élevé (séance très difficile) ────────────────────────
  if (feedback.rpe >= 9) {
    const nextQuality = nextSessions.find(s =>
      (s.session_type === 'threshold' || s.session_type === 'long' || s.session_type === 'brick') &&
      s.discipline !== 'rest'
    );
    if (nextQuality) {
      const reduction = feedback.rpe === 10 ? 0.75 : 0.85;
      return {
        change_type: 'reduce_duration',
        target_session_id: nextQuality.id,
        original_type: nextQuality.session_type,
        new_type: nextQuality.session_type,
        original_duration: nextQuality.duration_minutes,
        new_duration: Math.round(nextQuality.duration_minutes * reduction),
        change_description: `Séance du ${formatDate(nextQuality.date)} allégée`,
        change_reason: `Ta séance était vraiment éprouvante (RPE ${feedback.rpe}/10). J'ai allégé la prochaine séance qualité du ${formatDate(nextQuality.date)} pour te laisser récupérer. Ça ne compromet pas la progression.`,
      };
    }
  }

  // ── Cas 4 : RPE modéré-élevé (séance chargée) ────────────────────────────
  if (feedback.rpe >= 8) {
    const nextIntense = nextSessions.find(s =>
      s.session_type === 'threshold' && s.discipline !== 'rest'
    );
    if (nextIntense) {
      return {
        change_type: 'reduce_duration',
        target_session_id: nextIntense.id,
        original_type: nextIntense.session_type,
        new_type: nextIntense.session_type,
        original_duration: nextIntense.duration_minutes,
        new_duration: Math.round(nextIntense.duration_minutes * 0.90),
        change_description: `Séance du ${formatDate(nextIntense.date)} légèrement allégée`,
        change_reason: `Ta séance était bien chargée (RPE ${feedback.rpe}/10). J'ai raccourci de 10% la prochaine séance de même type. C'est normal en début de bloc — le corps s'adapte.`,
      };
    }
  }

  // ── Cas 5 : Séance partielle ──────────────────────────────────────────────
  if (feedback.status === 'partial') {
    return {
      change_type: 'none',
      change_description: 'Plan conservé',
      change_reason: `Séance partiellement réalisée enregistrée. Le plan continue normalement — une séance partiellement faite vaut mieux qu'une séance sautée. Je surveille la suite.`,
    };
  }

  // ── Cas 6 : Tout va bien (RPE ≤ 7, séance réalisée) ──────────────────────
  return {
    change_type: 'none',
    change_description: 'Aucun ajustement nécessaire',
    change_reason: `Séance bien réalisée, RPE ${feedback.rpe}/10 — c'est exactement là où on voulait être. Le plan continue comme prévu.`,
  };
}

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────

function isHighImpactForZone(discipline, painZones) {
  const impactMap = {
    genou:              ['run', 'brick'],
    mollet:             ['run', 'brick'],
    'tendon d\'Achille': ['run', 'brick'],
    hanche:             ['run', 'brick', 'bike'],
    pied:               ['run', 'brick'],
    lombaires:          ['bike', 'run'],
    autre:              ['run'],
  };
  return painZones.some(zone => (impactMap[zone] || []).includes(discipline));
}

function daysBetween(d1, d2) {
  return Math.abs(new Date(d2) - new Date(d1)) / (24 * 60 * 60 * 1000);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function disciplineLabel(d) {
  return { swim: 'natation', bike: 'vélo', run: 'course à pied', brick: 'brick' }[d] || d;
}

module.exports = { computeAdaptation };
