// ─────────────────────────────────────────────────────────────────────────────
// ENDURO V1.2 — Moteur de faisabilité évolutive
//
// Réévalue chaque semaine l'état de faisabilité de l'objectif
// à partir des signaux réels : feedbacks, RPE, séances manquées.
//
// Trois états : 'coherent' | 'ambitious' | 'risky'
// Aucun recalcul magique de chrono. Aucun algorithme caché.
// ─────────────────────────────────────────────────────────────────────────────

// ─── COHÉRENCE ALLURE 10K / OBJECTIF TEMPS ───────────────────────────────────

// Temps prédit (secondes) depuis une allure 10k (secondes/km)
// pour les distances standard. Approximation coach, non normative.
const PREDICTED_TIMES = {
  // [allure 10k en s/km] → [semi en s, marathon en s]
  // On interpole linéairement entre les points de référence
  references: [
    { pace10k: 240, semi: 5280, full: 11100 },   // 4:00 → 1h28 / 3h05
    { pace10k: 270, semi: 6000, full: 12600 },   // 4:30 → 1h40 / 3h30
    { pace10k: 300, semi: 6720, full: 14100 },   // 5:00 → 1h52 / 3h55
    { pace10k: 330, semi: 7560, full: 15900 },   // 5:30 → 2h06 / 4h25
    { pace10k: 360, semi: 8520, full: 18000 },   // 6:00 → 2h22 / 5h00
    { pace10k: 420, semi:10200, full: 21600 },   // 7:00 → 2h50 / 6h00
  ],
};

function predictTime(pace10kSeconds, discipline) {
  const refs = PREDICTED_TIMES.references;
  const key  = discipline === 'run_marathon' ? 'full' : 'semi';

  // Borne basse
  if (pace10kSeconds <= refs[0].pace10k) return refs[0][key];
  // Borne haute
  if (pace10kSeconds >= refs[refs.length - 1].pace10k) return refs[refs.length - 1][key];

  // Interpolation linéaire
  for (let i = 0; i < refs.length - 1; i++) {
    if (pace10kSeconds >= refs[i].pace10k && pace10kSeconds <= refs[i + 1].pace10k) {
      const ratio = (pace10kSeconds - refs[i].pace10k) / (refs[i + 1].pace10k - refs[i].pace10k);
      return Math.round(refs[i][key] + ratio * (refs[i + 1][key] - refs[i][key]));
    }
  }
  return null;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

// ─── ÉVALUATION ALLURE VS OBJECTIF TEMPS ────────────────────────────────────

function evaluatePaceVsTarget(profile, objective) {
  if (!profile?.run_10k_pace_seconds || !objective?.target_time_sec) return null;
  if (!['run_semi', 'run_marathon', 'run_10k'].includes(objective.discipline)) return null;

  const predicted = predictTime(profile.run_10k_pace_seconds, objective.discipline);
  if (!predicted) return null;

  const target  = objective.target_time_sec;
  const gap_pct = (predicted - target) / predicted; // positif = objectif plus rapide que le niveau

  let coherence, message;

  if (gap_pct <= 0.05) {
    // Objectif ≤ 5% plus rapide que prédit → cohérent
    coherence = 'coherent';
    message = `Ton objectif de ${formatDuration(target)} est cohérent avec ton 10 km actuel. Le plan est calibré pour t'y amener progressivement.`;
  } else if (gap_pct <= 0.15) {
    // 5–15% plus rapide → ambitieux
    coherence = 'ambitious';
    message = `Tu vises ${formatDuration(target)}, mais ton 10 km actuel correspond plutôt à un résultat autour de ${formatDuration(predicted)}. C'est faisable — à condition de ne pas manquer les séances qualité. Le plan sera exigeant.`;
  } else {
    // >15% plus rapide → incohérence flagrante
    coherence = 'risky';
    message = `Ton objectif de ${formatDuration(target)} représente une progression importante par rapport à ton niveau actuel (prédit : ${formatDuration(predicted)}). Je te recommande de viser d'abord ${formatDuration(Math.round(predicted * 1.05))} comme première étape.`;
  }

  return { coherence, gap_pct: Math.round(gap_pct * 100), predicted, message };
}

// ─── CALCUL DE LA FAISABILITÉ ÉVOLUTIVE ─────────────────────────────────────

function computeEvolvingFeasibility(profile, objective, recentFeedbacks, recentSessions) {
  // recentFeedbacks : 14 derniers jours max
  // recentSessions  : séances de la même période

  let score = 0; // positif = vers "cohérent", négatif = vers "risqué"
  const signals = [];

  if (!recentFeedbacks || recentFeedbacks.length === 0) {
    // Pas encore de données terrain — on revient à la faisabilité initiale
    return {
      state: objective.feasibility_verdict || 'coherent',
      message: objective.feasibility_message || 'Le plan vient de démarrer. Les premières séances vont affiner cette évaluation.',
      signals: [],
      updated: false,
    };
  }

  // ── Signal 1 : séances clés réalisées ────────────────────────────────────
  const keySessions = recentSessions.filter(s =>
    ['threshold', 'long', 'brick'].includes(s.session_type)
  );
  const keyDone = recentFeedbacks.filter(f =>
    f.status === 'done' && keySessions.some(s => s.id === f.session_id)
  ).length;
  const keyMissed = recentFeedbacks.filter(f =>
    f.status === 'skipped' && keySessions.some(s => s.id === f.session_id)
  ).length;

  if (keyDone >= 2) { score += 2; signals.push({ type: 'positive', text: 'Séances clés réalisées régulièrement' }); }
  if (keyMissed >= 2) { score -= 3; signals.push({ type: 'negative', text: 'Plusieurs séances clés manquées' }); }

  // ── Signal 2 : RPE répété élevé ───────────────────────────────────────────
  const rpeValues = recentFeedbacks.map(f => f.rpe).filter(Boolean);
  const highRpeCount = rpeValues.filter(r => r >= 8).length;
  const consecutiveHighRpe = detectConsecutiveHighRpe(recentFeedbacks, 8, 2);

  if (consecutiveHighRpe) { score -= 2; signals.push({ type: 'negative', text: 'RPE élevé répété sur plusieurs séances' }); }
  if (rpeValues.filter(r => r >= 9).length >= 1) { score -= 1; signals.push({ type: 'negative', text: 'Effort maximal signalé' }); }

  // ── Signal 3 : RPE bas = bonne forme ─────────────────────────────────────
  if (rpeValues.filter(r => r <= 6).length >= 3) {
    score += 1;
    signals.push({ type: 'positive', text: 'Ressenti bien géré sur les dernières séances' });
  }

  // ── Signal 4 : séances partielles répétées ───────────────────────────────
  const partialCount = recentFeedbacks.filter(f => f.status === 'partial').length;
  if (partialCount >= 3) { score -= 1; signals.push({ type: 'negative', text: 'Plusieurs séances écourtées' }); }

  // ── Signal 5 : régularité globale ────────────────────────────────────────
  const doneCount = recentFeedbacks.filter(f => f.status === 'done' || f.status === 'partial').length;
  const totalCount = recentSessions.length;
  if (totalCount > 0) {
    const completionRate = doneCount / totalCount;
    if (completionRate >= 0.85) { score += 2; signals.push({ type: 'positive', text: 'Taux de complétion excellent' }); }
    else if (completionRate < 0.60) { score -= 2; signals.push({ type: 'negative', text: 'Moins de 60% des séances réalisées' }); }
  }

  // ── Calcul de l'état ──────────────────────────────────────────────────────
  let state, message;

  if (score >= 2) {
    state   = 'coherent';
    message = buildMessage('coherent', signals, objective);
  } else if (score >= -1) {
    state   = 'ambitious';
    message = buildMessage('ambitious', signals, objective);
  } else {
    state   = 'risky';
    message = buildMessage('risky', signals, objective);
  }

  return { state, score, message, signals, updated: true };
}

function detectConsecutiveHighRpe(feedbacks, threshold, count) {
  // Trie par date et cherche N feedbacks consécutifs au-dessus du seuil
  const sorted = [...feedbacks]
    .filter(f => f.rpe != null)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  let streak = 0;
  for (const f of sorted) {
    if (f.rpe >= threshold) {
      streak++;
      if (streak >= count) return true;
    } else {
      streak = 0;
    }
  }
  return false;
}

function buildMessage(state, signals, objective) {
  const raceName = objective.race_name || 'ta course';
  const messages = {
    coherent: [
      `Tes dernières semaines sont solides. Sur cette trajectoire, ton objectif ${raceName} reste bien calibré. Continue.`,
      `Tu suis le plan comme prévu. Les séances clés sont réalisées — l'objectif est sur les rails.`,
      `Bonne dynamique. Les signaux sont positifs : régularité, ressenti maîtrisé, séances clés effectuées.`,
    ],
    ambitious: [
      `Ton objectif ${raceName} reste possible, mais les dernières semaines montrent quelques signaux de charge. Les séances clés qui arrivent sont importantes.`,
      `L'objectif est atteignable, mais la régularité va être décisive. Évite de manquer les séances longues et les séances qualité.`,
      `Quelques semaines irrégulières — ce n'est pas dramatique, mais ça ne laisse plus beaucoup de marge. Concentre-toi sur les prochaines séances clés.`,
    ],
    risky: [
      `Le rythme des dernières semaines rend ton objectif ${raceName} plus difficile à tenir. Ce n'est pas irrémédiable, mais si ça continue, on devrait réfléchir à un ajustement.`,
      `Ton corps envoie des signaux de fatigue depuis plusieurs séances. L'objectif reste dans les tablettes, mais la trajectoire actuelle est tendue.`,
      `Plusieurs séances importantes n'ont pas pu être réalisées ces dernières semaines. L'objectif est sous pression — parle-moi si tu veux ajuster.`,
    ],
  };

  const options = messages[state] || messages.coherent;
  // Sélection déterministe basée sur la semaine (évite l'aléatoire côté serveur)
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 3600 * 1000)) % options.length;
  return options[weekIndex];
}

module.exports = { computeEvolvingFeasibility, evaluatePaceVsTarget };
