// ─────────────────────────────────────────────────────────────────────────────
// ENDURO — Frontend SPA
// Vanilla JS, aucun framework. Chaque écran est une fonction de rendu.
// ─────────────────────────────────────────────────────────────────────────────

const App = (() => {

  // ── ÉTAT GLOBAL ───────────────────────────────────────────────────────────

  const state = {
    token:          localStorage.getItem('enduro_token'),
    currentScreen:  null,
    me:             null,       // profil athlète complet
    currentSession: null,       // séance en cours de consultation
    currentWeek:    null,       // semaine courante
    currentAdapt:   null,       // adaptation en attente
    onboarding:     {           // état de l'onboarding
      step:     0,
      answers:  {},
      goalType: null,
    },
  };

  // ── API CLIENT ────────────────────────────────────────────────────────────

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
    if (body)        opts.body = JSON.stringify(body);

    const res = await fetch(`/api${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  }

  // ── ROUTER ────────────────────────────────────────────────────────────────

  function showScreen(id) {
    document.querySelectorAll('.screen,[class*="auth-screen"]').forEach(el => {
      el.style.display = 'none';
      el.classList.remove('active');
    });

    const el = document.getElementById(`screen-${id}`);
    if (!el) return;
    if (el.classList.contains('screen')) {
      el.classList.add('active');
      el.style.display = 'flex';
    } else {
      el.style.display = 'flex';
    }
    state.currentScreen = id;
    window.scrollTo(0, 0);
  }

  // ── DÉMARRAGE ─────────────────────────────────────────────────────────────

  async function boot() {
    if (!state.token) { showScreen('login'); return; }

    try {
      state.me = await api('GET', '/me');
      if (!state.me.profile) {
        showScreen('01');
        renderScreen01();
      } else if (!state.me.plan) {
        // A un profil mais pas de plan — reprend à la faisabilité
        showScreen('01');
        renderScreen01();
      } else {
        await loadAndShowWeek();
      }
    } catch (e) {
      // Token invalide
      state.token = null;
      localStorage.removeItem('enduro_token');
      showScreen('login');
    }
  }

  // ── AUTH ──────────────────────────────────────────────────────────────────

  async function login() {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.classList.remove('show');

    try {
      const { token } = await api('POST', '/auth/login', { email, password });
      state.token = token;
      localStorage.setItem('enduro_token', token);
      await boot();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.add('show');
    }
  }

  async function register() {
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl    = document.getElementById('reg-error');
    errEl.classList.remove('show');

    try {
      const { token } = await api('POST', '/auth/register', { email, password });
      state.token = token;
      localStorage.setItem('enduro_token', token);
      showScreen('01');
      renderScreen01();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.add('show');
    }
  }

  function logout() {
    state.token = null;
    localStorage.removeItem('enduro_token');
    location.reload();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ÉCRAN 01 — ENTRÉE
  // ─────────────────────────────────────────────────────────────────────────

  const GOAL_TYPES = [
    { id: 'triathlon', label: 'Triathlon', desc: 'Sprint, Olympique, Half, Ironman…', icon: 'tri' },
    { id: 'run',       label: 'Course à pied', desc: '10 km, semi, marathon…', icon: 'run' },
    { id: 'trail',     label: 'Trail', desc: 'Du 20 km à l\'ultra, avec dénivelé', icon: 'trail' },
  ];

  function renderScreen01() {
    const icons = {
      tri:   `<svg viewBox="0 0 22 22" fill="none"><path d="M3 14Q6 10 9 14Q12 18 15 14Q18 10 20 12" stroke="var(--bike)" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="14" cy="5" r="2" fill="var(--bike)"/><path d="M11 8L14 5" stroke="var(--bike)" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      run:   `<svg viewBox="0 0 22 22" fill="none"><circle cx="14" cy="4" r="2" fill="var(--run)"/><path d="M10 7.5L12 12L9 15L11 20" stroke="var(--run)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12L16 11L18 13" stroke="var(--run)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      trail: `<svg viewBox="0 0 22 22" fill="none"><path d="M3 18L8 10L12 14L16 8L20 12" stroke="var(--run)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M16 4L20 8" stroke="var(--run)" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="4" r="1.5" fill="var(--run)"/></svg>`,
    };

    const container = document.getElementById('goal-choices');
    container.innerHTML = GOAL_TYPES.map(g => `
      <div class="choice-item ${state.onboarding.goalType === g.id ? 'selected-' + (g.id === 'triathlon' ? 'tri' : g.id === 'run' ? 'run' : 'free') : ''}"
           onclick="App.selectGoalType('${g.id}')">
        <div class="choice-icon">${icons[g.icon]}</div>
        <div class="choice-text">
          <div class="choice-title">${g.label}</div>
          <div class="choice-desc">${g.desc}</div>
        </div>
        <div class="choice-check ${state.onboarding.goalType === g.id ? 'on' : ''}">
          ${state.onboarding.goalType === g.id ? '<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        </div>
      </div>
    `).join('');
  }

  function selectGoalType(id) {
    state.onboarding.goalType = id;
    renderScreen01();
    document.getElementById('btn-goal').disabled = false;
  }

  function goToOnboarding() {
    if (!state.onboarding.goalType) return;
    state.onboarding.step = 0;
    state.onboarding.answers = {};
    showScreen('02');
    renderOnboardingStep();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ÉCRAN 02 — ONBOARDING CONVERSATIONNEL
  // ─────────────────────────────────────────────────────────────────────────

  function getOnboardingSteps() {
    const isTri   = state.onboarding.goalType === 'triathlon';
    const isTrail = state.onboarding.goalType === 'trail';
    const isRun   = state.onboarding.goalType === 'run';

    const steps = [
      {
        key: 'first_name', label: 'Pour commencer',
        q: 'Comment tu t\'appelles ?', hint: 'Ton prénom, pour que le plan te parle vraiment.',
        type: 'text', placeholder: 'Prénom',
      },
      {
        key: 'discipline', label: 'Ton objectif',
        q: isTri ? 'Tu prépares quel triathlon ?' : isTrail ? 'Tu prépares quel trail ?' : 'Tu prépares quelle distance ?',
        hint: 'Sois précis si tu peux.',
        type: 'options',
        opts: isTri
          ? [{ v: 'triathlon_full',    l: 'Ironman (Full distance)', s: '3,8 km — 180 km — 42 km' },
             { v: 'triathlon_half',    l: 'Half-Ironman / 70.3',    s: 'Distance intermédiaire' },
             { v: 'triathlon_olympic', l: 'Distance Olympique',      s: '1,5 km — 40 km — 10 km' },
             { v: 'triathlon_sprint',  l: 'Sprint',                  s: 'Format court' }]
          : isTrail
          ? [{ v: 'run_trail_short',  l: 'Trail court',   s: '20–30 km, jusqu\'à ~1 500 m D+' },
             { v: 'run_trail_medium', l: 'Trail médium',  s: '50 km, jusqu\'à ~3 000 m D+' },
             { v: 'run_trail_long',   l: 'Trail long',    s: '80–100 km, jusqu\'à ~6 000 m D+' },
             { v: 'run_trail_ultra',  l: 'Ultra-trail',   s: '120–170 km, > 8 000 m D+' }]
          : [{ v: 'run_10k',      l: '10 km',         s: '' },
             { v: 'run_semi',     l: 'Semi-marathon',  s: '21 km' },
             { v: 'run_marathon', l: 'Marathon',       s: '42 km' }],
      },
      {
        key: 'race_date', label: 'La date',
        q: 'C\'est quand la course ?',
        hint: 'On calcule les semaines disponibles à partir de là.',
        type: 'date',
      },
      {
        key: 'race_name', label: 'La course',
        q: 'Elle s\'appelle comment ?', hint: 'Optionnel — pour personnaliser le plan.',
        type: 'text', placeholder: isTri ? 'Ex : Ironman Frankfurt' : isTrail ? 'Ex : UTMB, Grand Raid…' : 'Ex : Marathon de Paris',
        optional: true,
      },
      {
        key: 'target_time', label: 'Ton objectif de temps',
        q: 'Tu vises quel temps ?',
        hint: isTrail
          ? 'En trail, le temps est plus parlant que le classement. Ex : 6:30 pour 6h30.'
          : 'Optionnel — mais structurant. Ex : 3:30 pour 3h30 au marathon.',
        type: 'text',
        placeholder: isTri ? '10:30' : isTrail ? '6:30' : isRun ? '1:45' : '—',
        unit: 'h:mm',
        optional: true,
      },
      {
        key: 'weekly_hours', label: 'Ton niveau actuel',
        q: 'Tu t\'entraînes combien d\'heures par semaine en ce moment ?',
        hint: 'Moyenne sur les 4 dernières semaines — une semaine peut varier de ±30%, c\'est normal.',
        type: 'number', placeholder: isTri ? '8' : '5', unit: 'h / sem',
      },
      {
        key: 'run_10k_pace', label: 'Tes références',
        q: 'Tu connais ton allure sur 10 km ?', hint: 'Approximatif suffit. Ex : 4:30 pour 4 min 30 /km.',
        type: 'text', placeholder: '5:00', unit: 'min/km', optional: true,
      },
      {
        key: 'injury_zones', label: 'Ta santé',
        q: 'As-tu eu des blessures importantes ces 12 derniers mois ?',
        hint: 'Ça reste dans le plan. On évite de surcharger les zones fragiles.',
        type: 'tags',
        tags: ['Aucune', 'Genou', 'Tendon d\'Achille', 'Mollet', 'Hanche', 'Pied', 'Lombaires', 'Autre'],
      },
    ];
    return steps;
  }

  function renderOnboardingStep() {
    const steps = getOnboardingSteps();
    const step  = steps[state.onboarding.step];
    const pct   = Math.round(((state.onboarding.step + 1) / steps.length) * 100);

    document.getElementById('ob-progress').style.width = pct + '%';
    document.getElementById('ob-step-label').textContent = `Question ${state.onboarding.step + 1} / ${steps.length}`;

    const cta  = document.getElementById('ob-cta');
    const skip = document.getElementById('ob-skip');
    cta.textContent = state.onboarding.step === steps.length - 1 ? 'Analyser mon objectif' : 'Continuer';
    skip.style.display = step.optional ? 'block' : 'none';

    const ans = state.onboarding.answers[step.key];
    cta.disabled = !ans && !step.optional;

    let html = `
      <div class="label-xs mb-8">${step.label}</div>
      <div class="q-text">${step.q}</div>
      <div class="q-hint">${step.hint}</div>
    `;

    if (step.type === 'options') {
      html += `<div class="opt-list">` +
        step.opts.map(o => `
          <div class="opt-item ${ans === o.v ? 'selected' : ''}" onclick="App.obSelectOpt('${o.v}')">
            <div>
              <div class="opt-label">${o.l}</div>
              ${o.s ? `<div class="opt-sub">${o.s}</div>` : ''}
            </div>
            <div class="choice-check ${ans === o.v ? 'on' : ''}">
              ${ans === o.v ? '<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
            </div>
          </div>`).join('') +
        `</div>`;
    } else if (step.type === 'tags') {
      const selected = ans || [];
      html += `<div class="tag-grid">` +
        step.tags.map(t => `
          <div class="tag-chip ${selected.includes(t) ? 'on' : ''}" onclick="App.obToggleTag('${t}')">${t}</div>`
        ).join('') + `</div>`;
    } else if (step.type === 'date') {
      html += `<input type="date" id="ob-input" value="${ans || ''}" min="${new Date().toISOString().split('T')[0]}" onchange="App.obInput(this.value)">`;
    } else {
      html += `<div class="input-wrap">
        <input type="${step.type === 'number' ? 'number' : 'text'}" id="ob-input"
          placeholder="${step.placeholder || ''}" value="${ans || ''}"
          oninput="App.obInput(this.value)">
        ${step.unit ? `<span class="input-unit">${step.unit}</span>` : ''}
      </div>`;
    }

    document.getElementById('ob-question').innerHTML = html;
  }

  function obSelectOpt(v) {
    const step = getOnboardingSteps()[state.onboarding.step];
    state.onboarding.answers[step.key] = v;
    renderOnboardingStep();
  }

  function obToggleTag(tag) {
    const step = getOnboardingSteps()[state.onboarding.step];
    let selected = state.onboarding.answers[step.key] || [];
    if (tag === 'Aucune') {
      selected = ['Aucune'];
    } else {
      selected = selected.filter(t => t !== 'Aucune');
      const idx = selected.indexOf(tag);
      if (idx > -1) selected.splice(idx, 1); else selected.push(tag);
    }
    state.onboarding.answers[step.key] = selected;
    renderOnboardingStep();
    document.getElementById('ob-cta').disabled = selected.length === 0;
  }

  function obInput(v) {
    const step = getOnboardingSteps()[state.onboarding.step];
    state.onboarding.answers[step.key] = v;
    document.getElementById('ob-cta').disabled = !v;
  }

  function onboardingSkip() {
    const step = getOnboardingSteps()[state.onboarding.step];
    state.onboarding.answers[step.key] = null;
    onboardingNext();
  }

  function onboardingBack() {
    if (state.onboarding.step === 0) { showScreen('01'); return; }
    state.onboarding.step--;
    renderOnboardingStep();
  }

  async function onboardingNext() {
    const steps = getOnboardingSteps();
    if (state.onboarding.step < steps.length - 1) {
      state.onboarding.step++;
      renderOnboardingStep();
      return;
    }

    // Toutes les questions répondues — sauvegarder et analyser
    const a = state.onboarding.answers;
    const profile = {
      first_name:           a.first_name,
      level:                'intermediate',
      weekly_hours_current: parseFloat(a.weekly_hours) || 6,
      run_10k_pace_seconds: parsePace(a.run_10k_pace),
      injury_zones:         (a.injury_zones || []).filter(z => z !== 'Aucune'),
      unavailable_days:     [],
    };

    try {
      await api('PUT', '/profile', profile);

      // La discipline est passée directement — plus de remapping incorrect
      const discipline = a.discipline || 'run_semi';

      showScreen('03');
      await renderFeasibility(discipline, a.race_date, a.race_name);
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  }

  function parsePace(str) {
    if (!str) return null;
    const [m, s] = str.split(':').map(Number);
    if (isNaN(m)) return null;
    return m * 60 + (s || 0);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ÉCRAN 03 — ANALYSE DE FAISABILITÉ
  // ─────────────────────────────────────────────────────────────────────────

  async function renderFeasibility(discipline, race_date, race_name) {
    const el = document.getElementById('screen-03-content');
    el.innerHTML = '<div class="loader"><div class="loader-ring"></div><p>Analyse de ton objectif…</p></div>';

    try {
      // Créer l'objectif et obtenir la faisabilité
      const result = await api('POST', '/objectives', { discipline, race_name, race_date });

      const verdictLabels = {
        realistic: 'Réaliste',
        ambitious: 'Ambitieux — mais atteignable',
        risky:     'Trop risqué',
      };
      const verdictClasses = {
        realistic: 'verdict-realistic',
        ambitious: 'verdict-ambitious',
        risky:     'verdict-risky',
      };
      const disciplineLabels = {
        triathlon_full:    'Ironman (Full distance)',
        triathlon_half:    'Half-Ironman / 70.3',
        triathlon_olympic: 'Distance Olympique',
        triathlon_sprint:  'Distance Sprint',
      };

      const score = result.score || 60;
      const gaugePct = Math.min(95, Math.max(5, score));

      let altHtml = '';
      if (result.suggestion) {
        altHtml = `
          <div class="divider"></div>
          <div class="label-xs mb-8">Notre suggestion</div>
          <div class="alt-card">
            <div style="flex:1">
              <div style="font-size:0.9rem;font-weight:500;margin-bottom:3px">${result.suggestion.name}</div>
              <div style="font-size:0.78rem;color:var(--text-light)">${result.suggestion.message}</div>
            </div>
            <span class="alt-badge">Conseillé</span>
          </div>`;
      }

      el.innerHTML = `
        <div class="obj-recap">
          <div class="obj-icon">
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <path d="M3 14Q6 10 9 14Q12 18 15 14Q18 10 20 12" stroke="var(--bike)" stroke-width="1.8" stroke-linecap="round" fill="none"/>
              <circle cx="14" cy="5" r="2" fill="var(--bike)"/>
            </svg>
          </div>
          <div style="flex:1">
            <div style="font-size:0.95rem;font-weight:500">${race_name || disciplineLabels[discipline] || discipline}</div>
            <div style="font-size:0.78rem;color:var(--text-light)">${race_date ? new Date(race_date).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}) : ''}</div>
          </div>
          <span class="tag tag-bike obj-weeks">${result.weeks_available} sem.</span>
        </div>

        <div class="label-xs mb-8">Analyse de faisabilité</div>
        <div class="gauge-wrap">
          <div class="gauge-track"><div class="gauge-fill" style="width:${gaugePct}%"></div></div>
          <div class="gauge-labels"><span>Trop risqué</span><span>Réaliste</span><span>Confortable</span></div>
        </div>
        <div class="verdict-pill ${verdictClasses[result.verdict] || 'verdict-ambitious'}" style="margin-bottom:12px">
          ${verdictLabels[result.verdict] || 'Ambitieux'}
        </div>
        <p style="margin-bottom:16px">${result.message}</p>

        ${altHtml}

        <div class="divider"></div>
        <div class="label-xs mb-8">C'est toi qui décides</div>
        <button class="btn btn-primary" onclick="App.generatePlan(${result.id || ''})">OK, génère mon plan</button>
        <button class="btn btn-secondary mt-8" onclick="App.showScreen('02')">Modifier mon objectif</button>
        <p class="text-small text-muted text-center mt-12">Le plan sera adapté à ton niveau réel.</p>
      `;

      // Stocker l'id de l'objectif pour la génération
      state._pendingObjectiveId = result.id;
    } catch (e) {
      el.innerHTML = `<p class="text-muted">Erreur : ${e.message}</p>`;
    }
  }

  async function generatePlan(objectiveId) {
    const id = objectiveId || state._pendingObjectiveId;
    if (!id) return;
    showScreen('loading');

    try {
      await api('POST', '/plans/generate', { objective_id: id });
      state.me = await api('GET', '/me');
      await loadAndShowWeek();
    } catch (e) {
      alert('Erreur lors de la génération : ' + e.message);
      showScreen('03');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ÉCRAN 05 — VUE SEMAINE
  // ─────────────────────────────────────────────────────────────────────────

  async function loadAndShowWeek() {
    showScreen('05');
    const el = document.getElementById('screen-05-content');
    el.innerHTML = '<div class="loader"><div class="loader-ring"></div></div>';

    try {
      const current = await api('GET', '/plans/current');
      if (!current) { showScreen('01'); renderScreen01(); return; }

      state.currentWeek    = current.current_week;
      state.horizonWeeks   = current.horizon_weeks || [];

      // Nom du plan dans la nav
      const planLabel = document.getElementById('plan-name');
      if (planLabel) {
        planLabel.textContent = `${current.plan.race_name || disciplineLabel(current.plan.discipline)} · Sem. ${current.current_week?.week_number || 1}/${current.plan.total_weeks}`;
      }

      if (!current.current_week) { el.innerHTML = '<p class="text-muted empty-state">Plan en cours de chargement…</p>'; return; }

      const weekData = await api('GET', `/weeks/${current.current_week.id}`);

      // ── Faisabilité évolutive (V1.2) — appelée silencieusement ──────────
      // On ne bloque pas l'affichage, on enrichit après
      api('POST', '/plans/feasibility', {}).then(feasibility => {
        state.feasibility = feasibility;
        renderFeasibilityBanner(feasibility);
      }).catch(() => {});

      renderWeekView(weekData, current.plan, state.horizonWeeks);
    } catch (e) {
      el.innerHTML = `<p class="text-muted empty-state">Impossible de charger le plan : ${e.message}</p>`;
    }
  }

  // ── Bannière faisabilité évolutive (V1.2) ─────────────────────────────────
  function renderFeasibilityBanner(feasibility) {
    const el = document.getElementById('feasibility-banner');
    if (!el) return;

    const state_map = {
      coherent: { cls: 'feasibility-ok',   icon: '✦', text: feasibility.message },
      ambitious:{ cls: 'feasibility-warn', icon: '◆', text: feasibility.message },
      risky:    { cls: 'feasibility-risk', icon: '▲', text: feasibility.message },
    };
    const cfg = state_map[feasibility.state] || state_map.coherent;

    el.className = `feasibility-banner ${cfg.cls}`;
    el.innerHTML = `
      <span class="feasibility-icon">${cfg.icon}</span>
      <span class="feasibility-text">${cfg.text}</span>
    `;
    el.style.display = 'flex';
  }

  function renderWeekView(week, plan, horizonWeeks) {
    const el = document.getElementById('screen-05-content');

    const sessions = week.sessions || [];
    const swimMin = sessions.filter(s => s.discipline === 'swim').reduce((a, s) => a + (s.duration_minutes || 0), 0);
    const bikeMin = sessions.filter(s => s.discipline === 'bike' || s.discipline === 'brick').reduce((a, s) => a + Math.round((s.duration_minutes || 0) * (s.discipline === 'brick' ? 0.6 : 1)), 0);
    const runMin  = sessions.filter(s => s.discipline === 'run'  || s.discipline === 'brick').reduce((a, s) => a + Math.round((s.duration_minutes || 0) * (s.discipline === 'brick' ? 0.4 : 1)), 0);
    const totalMin = week.target_volume_minutes || (swimMin + bikeMin + runMin);
    const totalH   = minToHours(totalMin);
    const swimPct  = totalMin ? Math.round(swimMin / totalMin * 100) : 20;
    const bikePct  = totalMin ? Math.round(bikeMin / totalMin * 100) : 50;
    const runPct   = 100 - swimPct - bikePct;
    const today    = new Date().toISOString().split('T')[0];

    // Détecter si c'est une semaine CAP/trail (pas de natation ni vélo)
    const sport = sessions.some(s => s.discipline === 'swim') ? 'triathlon'
      : sessions.some(s => s.discipline === 'bike') ? 'triathlon' : 'run';

    const weekTypeBadge = week.week_type === 'recovery'
      ? `<span class="tag tag-rest">Récupération</span>`
      : week.week_type === 'taper'
      ? `<span class="tag tag-rest">Affûtage</span>`
      : '';

    // ── Navigation ← → entre semaines ────────────────────────────────────
    const hw = horizonWeeks || [];
    const currentIdx = hw.findIndex(w => w.id === week.id);
    const prevWeek = currentIdx > 0 ? hw[currentIdx - 1] : null;
    const nextWeek = currentIdx < hw.length - 1 ? hw[currentIdx + 1] : null;

    const navHtml = `
      <div class="week-nav">
        <button class="week-nav-btn" ${prevWeek ? `onclick="App.loadWeekDetail(${prevWeek.id})"` : 'disabled'}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${prevWeek ? `S${prevWeek.week_number}` : ''}
        </button>
        <div class="week-nav-label">
          <span>Semaine ${week.week_number}</span>
          ${hw[currentIdx]?.horizon_label ? `<span class="horizon-badge ${hw[currentIdx].horizon === 'confirmed' ? 'horizon-label-probable' : 'horizon-label-indicative'}" style="margin-left:6px">${hw[currentIdx].horizon_label}</span>` : ''}
        </div>
        <button class="week-nav-btn" ${nextWeek ? `onclick="App.loadWeekDetail(${nextWeek.id})"` : 'disabled'}>
          ${nextWeek ? `S${nextWeek.week_number}` : ''}
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1L6 6L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;

    // ── Séances ────────────────────────────────────────────────────────────
    const daysHtml = sessions.map(s => {
      const sessionDate = new Date(s.date);
      const isToday = s.date === today;
      const isDone  = s.feedback_status === 'done' || s.feedback_status === 'partial';
      const dayAbbr = sessionDate.toLocaleDateString('fr-FR', { weekday: 'short' });
      const dayNum  = sessionDate.getDate();
      const cardClass = `day-card ${isToday ? 'today' : ''} ${isDone ? 'done' : ''}`;
      const dayAbbrColor = isToday ? `style="color:var(--${s.discipline === 'rest' ? 'text-light' : s.discipline})"` : '';

      // Renforcement → tag spécifique
      const isStrength = s.name?.toLowerCase().includes('renforcement') || s.session_type === 'strength';
      const tagClass = isStrength ? 'strength' : sessionTypeToTagClass(s.session_type);
      const tagLabel = isStrength ? 'Renforcement' : sessionTypeLabel(s.session_type);
      const typePill = s.discipline === 'rest' ? '' : `<span class="tag tag-${tagClass}" style="font-size:0.65rem">${tagLabel}</span>`;

      // Durée arrondie à 5 min
      const dur = s.duration_minutes ? minToHours(s.duration_minutes) : '';

      // Sous-titre : natation affiche aussi les mètres
      let subMeta = '';
      if (s.discipline !== 'rest') {
        if (s.discipline === 'swim' && s.distance_m) {
          subMeta = `Natation · ~${Math.round(s.distance_m / 100) * 100} m`;
        } else if (isStrength) {
          subMeta = 'Renforcement musculaire';
        } else {
          subMeta = disciplineLabel(s.discipline) + (s.session_type === 'brick' ? '' : ' · ' + sessionTypeLabel(s.session_type));
        }
      } else {
        subMeta = 'Pas d\'entraînement';
      }

      return `
        <div class="${cardClass}" onclick="App.openSession(${s.id})">
          <div class="day-stripe ${stripeClass(s)}"></div>
          <div class="day-inner">
            <div class="day-label">
              <div class="day-abbr" ${dayAbbrColor}>${dayAbbr}</div>
              <div class="day-num">${dayNum}</div>
              ${isToday ? '<div class="today-dot"></div>' : ''}
            </div>
            <div class="day-content">
              <div class="day-name">${s.name}</div>
              <div class="day-meta">${subMeta}</div>
            </div>
            <div class="day-right">
              ${dur ? `<div class="day-dur">${dur}</div>` : ''}
              ${typePill}
              ${isDone ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="var(--bike-bg)"/><path d="M4 7L6.5 9.5L10 5" stroke="var(--bike)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    // ── Barre disciplines — adaptée au sport ──────────────────────────────
    // Triathlon : natation(m) + vélo(km) + CAP(km)
    // CAP route : CAP(km) seulement
    // Trail     : CAP(km) + D+(m) seulement

    const weekDplus   = week.weekly_d_plus || 0;
    const weekKm      = week.weekly_km     || Math.round((runMin + bikeMin) * 0.175 * 10) / 10;
    const weekDistM   = week.weekly_dist_m || 0;

    let discBarHtml;
    if (sport === 'triathlon') {
      discBarHtml = `
        <div class="disc-bar-wrap">
          <div class="bar-track">
            <div class="bar-swim" style="flex:${swimPct}"></div>
            <div class="bar-bike" style="flex:${bikePct}"></div>
            <div class="bar-run"  style="flex:${runPct}"></div>
          </div>
          <div class="disc-legend">
            <div class="disc-item"><div class="disc-dot" style="background:var(--swim)"></div><div>
              <div class="disc-name">Natation</div>
              <div class="disc-time">${minToHours(swimMin)}${weekDistM ? ` · ~${Math.round(weekDistM/100)*100} m` : ''}</div>
            </div></div>
            <div class="disc-item"><div class="disc-dot" style="background:var(--bike)"></div><div>
              <div class="disc-name">Vélo</div>
              <div class="disc-time">${minToHours(bikeMin)}${week.weekly_km ? ` · ~${Math.round(week.weekly_km * 0.5)} km` : ''}</div>
            </div></div>
            <div class="disc-item"><div class="disc-dot" style="background:var(--run)"></div><div>
              <div class="disc-name">Course</div>
              <div class="disc-time">${minToHours(runMin)}${week.weekly_km ? ` · ~${Math.round(week.weekly_km * 0.3)} km` : ''}</div>
            </div></div>
          </div>
        </div>`;
    } else if (weekDplus > 0) {
      // Trail
      discBarHtml = `
        <div class="disc-bar-wrap">
          <div class="bar-track"><div class="bar-run" style="flex:100"></div></div>
          <div class="disc-legend">
            <div class="disc-item"><div class="disc-dot" style="background:var(--run)"></div><div>
              <div class="disc-name">Trail</div>
              <div class="disc-time">${minToHours(totalMin)} · ~${weekKm} km · ~${weekDplus} m D+</div>
            </div></div>
          </div>
        </div>`;
    } else {
      // CAP route
      discBarHtml = `
        <div class="disc-bar-wrap">
          <div class="bar-track"><div class="bar-run" style="flex:100"></div></div>
          <div class="disc-legend">
            <div class="disc-item"><div class="disc-dot" style="background:var(--run)"></div><div>
              <div class="disc-name">Course à pied</div>
              <div class="disc-time">${minToHours(totalMin)}${weekKm ? ` · ~${weekKm} km` : ''}</div>
            </div></div>
          </div>
        </div>`;
    }

    el.innerHTML = `
      <div id="feasibility-banner" class="feasibility-banner" style="display:none"></div>

      ${navHtml}

      <div class="week-header">
        <div class="label-xs mb-4">${week.phase_name || 'Entraînement'}</div>
        <div class="week-meta-row">
          <div>
            <span class="week-volume">${totalH}</span>
            <span class="week-volume-label"> volume total</span>
          </div>
          ${weekTypeBadge}
        </div>
      </div>

      ${discBarHtml}

      <div class="label-xs mb-8">Programme</div>
      <div class="day-list">${daysHtml}</div>
    `;
  }

  // ── Carte d'horizon (S+1 détaillée, S+2/S+3 en résumé) (V1.2) ───────────
  function renderHorizonCard(week, index) {
    // index 0 = S+1 (probable, détaillée), 1–2 = S+2/S+3 (indicatives, cartes)
    const opacity = index === 0 ? '1' : index === 1 ? '0.72' : '0.45';
    const label   = index === 0 ? 'Probable' : 'Indicative';
    const labelCls= index === 0 ? 'horizon-label-probable' : 'horizon-label-indicative';
    const weekVol = week.target_volume_minutes ? minToHours(week.target_volume_minutes) : '—';

    const weekTypeBadge = week.week_type === 'recovery' ? 'Récupération' : week.week_type === 'taper' ? 'Affûtage' : 'Charge';

    return `
      <div class="horizon-card" style="opacity:${opacity};margin-bottom:7px" ${index === 0 ? `onclick="App.loadWeekDetail(${week.id})"` : ''}>
        <div class="horizon-card-head">
          <div>
            <span class="label-xs">Semaine ${week.week_number}</span>
            <span class="horizon-badge ${labelCls}">${label}</span>
          </div>
          <div style="font-size:0.85rem;color:var(--text-light)">${weekVol}</div>
        </div>
        <div class="horizon-phase">${week.phase_name || ''} · ${weekTypeBadge}</div>
      </div>`;
  }

  // ── Ouvrir une semaine future en détail (S+1) ────────────────────────────
  async function loadWeekDetail(weekId) {
    showScreen('05');
    const el = document.getElementById('screen-05-content');
    el.innerHTML = '<div class="loader"><div class="loader-ring"></div></div>';
    try {
      const weekData = await api('GET', `/weeks/${weekId}`);
      renderWeekView(weekData, state.me?.objective || {}, state.horizonWeeks || []);
    } catch(e) {
      el.innerHTML = `<p class="text-muted">${e.message}</p>`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ÉCRAN 06 — DÉTAIL SÉANCE
  // ─────────────────────────────────────────────────────────────────────────

  async function openSession(sessionId) {
    showScreen('06');
    const el = document.getElementById('screen-06-content');
    el.innerHTML = '<div class="loader"><div class="loader-ring"></div></div>';

    try {
      const session = await api('GET', `/sessions/${sessionId}`);
      state.currentSession = session;
      renderSessionDetail(session);
    } catch (e) {
      el.innerHTML = `<p class="text-muted">Erreur : ${e.message}</p>`;
    }
  }

  function renderSessionDetail(s) {
    const el = document.getElementById('screen-06-content');
    if (s.discipline === 'rest') {
      el.innerHTML = `
        <div class="session-header">
          <div class="session-meta-row mb-8">
            <span class="tag tag-rest">Repos</span>
          </div>
          <h1>${s.name}</h1>
        </div>
        <div class="coach-intro teal">${s.coach_intro}</div>
        <div class="divider"></div>
        <div class="goal-bloc">
          <div class="label-xs mb-8">Objectif</div>
          <p>${s.session_goal}</p>
        </div>`;
      return;
    }

    const blocks = s.blocks || [];
    const doneAlready = s.feedback_status === 'done' || s.feedback_status === 'partial';

    const difficultyDots = Array.from({length: 5}, (_, i) =>
      `<div class="d-dot ${i < (s.rpe_target || 3) ? 'filled' : 'empty'}"></div>`
    ).join('');

    const blocksHtml = blocks.map((b, i) => {
      const iconClass = i === 0 ? 'bloc-icon-warm' : i === blocks.length - 1 ? 'bloc-icon-cool' : 'bloc-icon-main';
      const dur = b.duration_min ? (b.duration_min >= 60 ? `${Math.floor(b.duration_min/60)}h${b.duration_min%60>0?String(b.duration_min%60).padStart(2,'0'):''}` : `${b.duration_min} min`) : '';

      // V1.2 — zone_label affiché en badge avant les cibles
      const zoneBadge = b.zone_label
        ? `<div class="zone-badge">${b.zone_label}</div>` : '';

      const targetsHtml = (b.target_pace || b.target_hr) ? `
        <div class="target-row">
          ${b.target_pace ? `<div class="target-chip"><div class="target-chip-label">Allure</div><div class="target-chip-val">${b.target_pace}</div></div>` : ''}
          ${b.target_hr   ? `<div class="target-chip"><div class="target-chip-label">Fréquence cardiaque</div><div class="target-chip-val">${b.target_hr}</div><div class="target-chip-sub">indicatif</div></div>` : ''}
        </div>` : '';

      const recupHtml = b.recovery ? `
        <div class="recup-strip">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v4l2.5 1.5" stroke="var(--text-light)" stroke-width="1.3" stroke-linecap="round"/><circle cx="6" cy="6" r="5" stroke="var(--text-light)" stroke-width="1"/></svg>
          <span>Récupération : <strong>${b.recovery}</strong></span>
        </div>` : '';

      return `
        <div class="bloc">
          <div class="bloc-header">
            <div class="flex-row">
              <div class="bloc-icon ${iconClass}">
                ${blocIconSvg(i, blocks.length)}
              </div>
              <div class="bloc-name">${b.name}</div>
            </div>
            <div class="bloc-dur">${dur}</div>
          </div>
          ${b.description || zoneBadge || targetsHtml || recupHtml ? `
          <div class="bloc-body">
            ${b.reps ? `<div class="reps-badge">${b.reps}</div>` : ''}
            ${zoneBadge}
            ${b.description ? `<div class="bloc-desc">${b.description}</div>` : ''}
            ${targetsHtml}
            ${recupHtml}
          </div>` : ''}
        </div>`;
    }).join('');

    const modifiedBadge = s.is_modified
      ? `<span class="badge-adjusted">Ajustée</span>` : '';

    // Distance natation
    const swimDistInfo = s.discipline === 'swim' && s.distance_m
      ? `<div class="sep"></div><span class="text-small text-muted">~${Math.round(s.distance_m / 100) * 100} m</span>`
      : s.distance_km ? `<div class="sep"></div><span class="text-small text-muted">~${s.distance_km} km</span>` : '';

    // Renforcement : tag spécifique
    const isStrength = s.name?.toLowerCase().includes('renforcement') || s.session_type === 'strength';
    const discTag = isStrength
      ? `<span class="tag tag-strength">Renforcement</span>`
      : `<span class="tag tag-${s.discipline}">${disciplineLabel(s.discipline)}</span>`;

    el.innerHTML = `
      <div class="session-header">
        <div class="session-meta-row mb-8">
          ${discTag}
          <span class="tag tag-${sessionTypeToTagClass(s.session_type)}">${sessionTypeLabel(s.session_type)}</span>
          ${modifiedBadge}
        </div>
        <h1 style="margin-bottom:10px">${s.name}</h1>
        <div class="session-meta-row">
          <span class="text-small text-muted">Durée</span>
          <strong class="text-small">${minToHours(s.duration_minutes)}</strong>
          <div class="sep"></div>
          <span class="text-small text-muted">Difficulté</span>
          <div class="difficulty-dots">${difficultyDots}</div>
          ${swimDistInfo}
        </div>
      </div>

      <div class="coach-intro" style="margin-bottom:16px">${s.coach_intro}</div>

      ${blocksHtml}

      <div class="goal-bloc">
        <div class="label-xs mb-8">Pourquoi cette séance</div>
        <p>${s.session_goal}</p>
        ${s.modified_reason ? `<p style="margin-top:8px;font-size:0.78rem;color:var(--accent-dark)">✦ ${s.modified_reason}</p>` : ''}
      </div>

      <a href="/api/sessions/${s.id}/export" class="export-btn" style="margin-bottom:8px;text-decoration:none">
        <div class="export-dot"></div>
        Télécharger vers Garmin
        <span style="font-size:0.78rem;color:var(--text-light)">.tcx</span>
      </a>

      ${s.discipline !== 'rest' && !doneAlready ? `
        <button class="move-session-btn" onclick="App.openMoveModal(${s.id}, '${s.date}', '${(s.name||'').replace(/'/g,"\\'")}')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M9 4l3 3-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Changer de jour
        </button>` : ''}

      ${doneAlready
        ? `<div class="coach-intro teal" style="text-align:center;margin-top:10px">✓ Séance enregistrée (RPE ${s.rpe || '—'}/10)</div>`
        : `<button class="btn btn-primary" style="margin-top:10px" onclick="App.openFeedback(${s.id})">Enregistrer ma séance</button>`
      }
    `;
  }

  function blocIconSvg(i, total) {
    if (i === 0) return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="5" r="3" stroke="var(--bike)" stroke-width="1.3"/><path d="M3 10Q3 8 6.5 8Q10 8 10 10" stroke="var(--bike)" stroke-width="1.3" stroke-linecap="round"/></svg>`;
    if (i === total - 1) return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 9Q4 5 6.5 7Q9 9 11 5" stroke="var(--swim)" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`;
    return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 9L5 4L6.5 7L8.5 5L11 9" stroke="var(--run)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ÉCRAN 07 — FEEDBACK
  // ─────────────────────────────────────────────────────────────────────────

  const feedbackState = { status: null, rpe: 6, painNo: true, painZones: [], comment: '' };

  async function openFeedback(sessionId) {
    if (!state.currentSession || state.currentSession.id !== sessionId) {
      await openSession(sessionId);
    }
    showScreen('07');
    renderFeedbackScreen();
  }

  const RPE_WORDS = {
    1:'Épuisé, il faut vraiment récupérer', 2:'Très difficile',
    3:'Difficile', 4:'Assez chargé', 5:'Normal, ça passe',
    6:'Séance bien gérée', 7:'Bonne séance, encore du jus',
    8:'Très bien, en pleine forme', 9:'Presque trop facile', 10:'En grande forme',
  };

  function renderFeedbackScreen() {
    const s   = state.currentSession;
    const el  = document.getElementById('screen-07-content');
    const fb  = feedbackState;

    el.innerHTML = `
      <div class="obj-recap" style="margin-bottom:20px">
        <div class="day-stripe ${`stripe-${s.discipline}`}" style="width:3px;border-radius:2px;flex-shrink:0"></div>
        <div style="flex:1;padding-left:10px">
          <div style="font-size:0.9rem;font-weight:500">${s.name}</div>
          <div style="font-size:0.78rem;color:var(--text-light)">${disciplineLabel(s.discipline)} · ${minToHours(s.duration_minutes)} prévue</div>
        </div>
        <span class="tag tag-${sessionTypeToTagClass(s.session_type)}">${sessionTypeLabel(s.session_type)}</span>
      </div>

      <h2 style="margin-bottom:12px">Comment s'est passée ta séance&nbsp;?</h2>

      <div class="status-list">
        ${['done','partial','skipped'].map(v => {
          const labels = { done: ['Réalisée', 'J\'ai fait la séance complète'], partial: ['Partiellement', 'J\'ai dû raccourcir ou adapter'], skipped: ['Non réalisée', 'Je l\'ai passée'] };
          const iconClass = { done: 'icon-done', partial: 'icon-partial', skipped: 'icon-skipped' };
          const selClass  = { done: 'sel-done', partial: 'sel-partial', skipped: 'sel-skipped' };
          const checkClass = { done: 'on-done', partial: 'on-partial', skipped: 'on-skipped' };
          const icons = {
            done:    `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 5" stroke="var(--bike)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            partial: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="var(--run)" stroke-width="2" stroke-linecap="round"/></svg>`,
            skipped: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 5L11 11M11 5L5 11" stroke="var(--text-light)" stroke-width="1.8" stroke-linecap="round"/></svg>`,
          };
          const isSel = fb.status === v;
          return `
            <div class="status-btn ${isSel ? selClass[v] : ''}" onclick="App.fbSelectStatus('${v}')">
              <div class="status-icon ${iconClass[v]}">${icons[v]}</div>
              <div>
                <div class="status-label">${labels[v][0]}</div>
                <div class="status-sub">${labels[v][1]}</div>
              </div>
              <div class="status-check ${isSel ? checkClass[v] : ''}">
                ${isSel ? '<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
              </div>
            </div>`;
        }).join('')}
      </div>

      <div class="divider"></div>
      <h3 style="margin-bottom:6px">Comment tu te sens ? <span class="text-small text-muted" style="font-weight:400">Optionnel</span></h3>
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-hint);margin-bottom:6px">
        <span>Épuisé</span><span>Très en forme</span>
      </div>
      <input type="range" min="1" max="10" value="${fb.rpe}" step="1"
        oninput="App.fbSetRpe(this.value)">
      <div class="rpe-readout">
        <div class="rpe-num" id="rpe-num">${fb.rpe}</div>
        <div class="rpe-word" id="rpe-word">${RPE_WORDS[fb.rpe]}</div>
      </div>
      <div class="rpe-hint">Ton ressenti compte plus que les chiffres.</div>

      <div class="divider"></div>
      <h3 style="margin-bottom:10px">As-tu ressenti une douleur ? <span class="text-small text-muted" style="font-weight:400">Optionnel</span></h3>
      <div class="pain-row">
        <button class="pain-btn ${fb.painNo ? 'no-active' : ''}" onclick="App.fbSetPain(false)">Non</button>
        <button class="pain-btn ${!fb.painNo ? 'yes-active' : ''}" onclick="App.fbSetPain(true)">Oui</button>
      </div>
      <div id="zones-wrap" style="display:${fb.painNo ? 'none' : 'block'}">
        <div class="zone-chips">
          ${['Genou','Mollet','Tendon d\'Achille','Hanche','Pied','Lombaires','Autre'].map(z =>
            `<div class="zone-chip ${fb.painZones.includes(z) ? 'on' : ''}" onclick="App.fbToggleZone('${z}')">${z}</div>`
          ).join('')}
        </div>
      </div>

      <div class="divider"></div>
      <h3 style="margin-bottom:8px">Un mot pour expliquer ? <span class="text-small text-muted" style="font-weight:400">Facultatif</span></h3>
      <textarea class="comment-field" rows="2" placeholder="Nuit courte, jambes lourdes, vent de face…" oninput="App.fbSetComment(this.value)">${fb.comment}</textarea>

      <button class="btn btn-primary" id="fb-submit"
        onclick="App.submitFeedback()"
        ${fb.status ? '' : 'disabled'}>
        Envoyer à mon coach
      </button>
      <p class="text-center text-small text-muted mt-8">Le plan s'adaptera si nécessaire.</p>
    `;
  }

  function fbSelectStatus(v) { feedbackState.status = v; renderFeedbackScreen(); }
  function fbSetRpe(v) {
    feedbackState.rpe = parseInt(v);
    const num = document.getElementById('rpe-num');
    const word = document.getElementById('rpe-word');
    if (num)  num.textContent  = v;
    if (word) word.textContent = RPE_WORDS[v];
  }
  function fbSetPain(yes) {
    feedbackState.painNo = !yes;
    if (!yes) feedbackState.painZones = [];
    renderFeedbackScreen();
  }
  function fbToggleZone(z) {
    const idx = feedbackState.painZones.indexOf(z);
    if (idx > -1) feedbackState.painZones.splice(idx, 1);
    else feedbackState.painZones.push(z);
    renderFeedbackScreen();
  }
  function fbSetComment(v) { feedbackState.comment = v; }

  async function submitFeedback() {
    const fb = feedbackState;
    if (!fb.status) return;
    const btn = document.getElementById('fb-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }

    try {
      const result = await api('POST', `/sessions/${state.currentSession.id}/feedback`, {
        status:                  fb.status,
        rpe:                     fb.rpe,
        pain_reported:           !fb.painNo,
        pain_zones:              fb.painZones,
        comment:                 fb.comment,
      });

      // Réinitialiser l'état feedback
      feedbackState.status = null; feedbackState.rpe = 6;
      feedbackState.painNo = true; feedbackState.painZones = []; feedbackState.comment = '';

      if (result.adaptation_id) {
        state.currentAdapt = result;
        await renderAdaptationScreen(result);
      } else {
        // Pas d'adaptation — afficher un message simple et retour au plan
        showScreen('08');
        document.getElementById('screen-08-content').innerHTML = `
          <div class="ack-block">
            <div class="ack-eyebrow"><div class="ack-dot"></div><span class="label-xs" style="color:var(--accent-dark)">Retour reçu</span></div>
            <h2 style="margin-bottom:8px">J'ai bien noté ta séance.</h2>
            <p>${result.adaptation?.change_reason || 'Le plan continue comme prévu.'}</p>
          </div>
          <button class="btn btn-primary mt-20" onclick="App.loadAndShowWeek()">Retour au plan</button>`;
      }
    } catch (e) {
      alert('Erreur : ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Envoyer à mon coach'; }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ÉCRAN 08 — ADAPTATION
  // ─────────────────────────────────────────────────────────────────────────

  async function renderAdaptationScreen(result) {
    showScreen('08');
    const el = document.getElementById('screen-08-content');

    try {
      const adapt = await api('GET', `/adaptations/${result.adaptation_id}`);
      const ts = adapt.target_session;

      const beforeHtml = ts ? `
        <div class="compare-label">Séance concernée — avant</div>
        <div class="session-compare muted" style="margin-bottom:6px">
          <div class="cmp-stripe stripe-${ts.discipline}"></div>
          <div class="cmp-body">
            <div class="cmp-name">${ts.name}</div>
            <div class="cmp-meta">${disciplineLabel(ts.discipline)}</div>
          </div>
          <div class="cmp-right">
            <div class="cmp-dur">${minToHours(adapt.original_duration)}</div>
            <span style="font-size:0.68rem;color:var(--text-hint);text-decoration:line-through">${sessionTypeLabel(adapt.original_type)}</span>
          </div>
        </div>
        <div class="arrow-down"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M4 9l4 4 4-4" stroke="var(--bike)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="compare-label">Après ajustement</div>
        <div class="session-compare adjusted" style="margin-bottom:0">
          <div class="cmp-stripe stripe-${ts.discipline}"></div>
          <div class="cmp-body">
            <div class="cmp-name">${ts.name}</div>
            <div class="cmp-meta">${disciplineLabel(ts.discipline)}</div>
          </div>
          <div class="cmp-right">
            <div class="cmp-dur reduced">${minToHours(adapt.new_duration)}</div>
            <span class="badge-adjusted">Allégée</span>
          </div>
        </div>` : '';

      el.innerHTML = `
        <div class="ack-block">
          <div class="ack-eyebrow"><div class="ack-dot"></div><span class="label-xs" style="color:var(--accent-dark)">Retour reçu</span></div>
          <h2 style="margin-bottom:8px">J'ai bien pris en compte ta séance.</h2>
          <p>${adapt.change_reason?.split('.')[0] + '.'}</p>
        </div>

        <div class="label-xs mb-8">Ce que j'ajuste</div>
        <div class="compare-wrap">${beforeHtml}</div>

        <div class="reason-strip mt-8">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="var(--text-light)" stroke-width="1"/><path d="M7 4v3.5M7 9.5v.5" stroke="var(--text-light)" stroke-width="1.3" stroke-linecap="round"/></svg>
          <div class="reason-text"><strong>Pourquoi ?</strong> ${adapt.change_reason}</div>
        </div>

        <div class="divider"></div>
        <div class="label-xs mb-12">C'est toi qui décides</div>
        <button class="btn btn-primary" id="btn-accept" onclick="App.acceptAdaptation(${adapt.id})">OK, j'applique cet ajustement</button>
        <button class="btn btn-secondary mt-8" onclick="App.rejectAdaptation(${adapt.id})">Je préfère garder le plan initial</button>
      `;
    } catch (e) {
      el.innerHTML = `<p class="text-muted">Erreur : ${e.message}</p><button class="btn btn-secondary mt-16" onclick="App.loadAndShowWeek()">Retour au plan</button>`;
    }
  }

  async function acceptAdaptation(id) {
    document.getElementById('btn-accept').disabled = true;
    try {
      await api('POST', `/adaptations/${id}/accept`);
      showConfirmed('Plan mis à jour.', 'La séance a été ajustée. Bonne récupération.');
    } catch (e) { alert(e.message); }
  }

  async function rejectAdaptation(id) {
    try {
      await api('POST', `/adaptations/${id}/reject`);
      showConfirmed('Plan conservé.', 'Je continue de suivre ta forme.');
    } catch (e) { alert(e.message); }
  }

  function showConfirmed(title, sub) {
    const el = document.getElementById('screen-08-content');
    el.innerHTML = `
      <div class="confirmed-block">
        <div class="confirmed-circle">
          <svg width="20" height="18" viewBox="0 0 20 18" fill="none"><path d="M2 9L8 15L18 3" stroke="var(--bike)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <h2 style="margin-bottom:6px">${title}</h2>
        <p>${sub}</p>
      </div>
      <button class="btn btn-primary mt-20" onclick="App.loadAndShowWeek()">Retour au plan</button>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITAIRES
  // ─────────────────────────────────────────────────────────────────────────

  // Arrondit une durée en minutes au multiple de 5 le plus proche (règle 4)
  function roundToFive(min) {
    return Math.round(min / 5) * 5;
  }

  function minToHours(min) {
    if (!min || min === 0) return '0 min';
    const rounded = roundToFive(min);
    if (rounded < 60) return `${rounded} min`;
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return m > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  }

  function disciplineLabel(d) {
    return { swim: 'Natation', bike: 'Vélo', run: 'Course à pied', brick: 'Brick', rest: 'Repos', strength: 'Renforcement' }[d] || d;
  }

  function sessionTypeLabel(t) {
    return { endurance: 'Endurance', threshold: 'Qualité', long: 'Longue', brick: 'Brick', recovery: 'Récupération', rest: 'Repos', strength: 'Renforcement', tempo: 'Tempo' }[t] || t;
  }

  function sessionTypeToTagClass(t) {
    return { endurance: 'endurance', threshold: 'threshold', long: 'long', brick: 'brick', recovery: 'recovery', rest: 'rest', strength: 'strength', tempo: 'threshold' }[t] || 'rest';
  }

  // Couleur stripe selon discipline + type (renforcement = orange-brique)
  function stripeClass(s) {
    if (s.discipline === 'rest') return 'stripe-rest';
    if (s.name?.toLowerCase().includes('renforcement') || s.session_type === 'strength') return 'stripe-strength';
    return `stripe-${s.discipline}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VUE MOIS (V1.21.2 — règle 6)
  // ─────────────────────────────────────────────────────────────────────────

  let currentView = 'week'; // 'week' | 'month'

  function switchView(view) {
    currentView = view;
    document.getElementById('tab-week')?.classList.toggle('active', view === 'week');
    document.getElementById('tab-month')?.classList.toggle('active', view === 'month');
    if (view === 'week') {
      loadAndShowWeek();
    } else {
      renderMonthView();
    }
  }

  async function renderMonthView() {
    const el = document.getElementById('screen-05-content');
    el.innerHTML = '<div class="loader"><div class="loader-ring"></div></div>';

    try {
      const current = await api('GET', '/plans/current');
      if (!current) return;

      const hw = current.horizon_weeks || [];
      const today = new Date().toISOString().split('T')[0];

      const DAYS_FR = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
      const intenseTypes = ['threshold', 'tempo', 'brick', 'long'];

      // Couleur par discipline
      const discColor = {
        swim: 'var(--swim)', bike: 'var(--bike)', run: 'var(--run)',
        brick: 'var(--brick)', rest: 'var(--border-mid)', strength: 'var(--strength)',
      };

      const weeksHtml = await Promise.all(hw.map(async (w, i) => {
        const weekData = await api('GET', `/weeks/${w.id}`);
        const sessions = weekData.sessions || [];
        const isCurrent = w.id === current.current_week?.id;

        // Barre de volume
        const swimMin = sessions.filter(s => s.discipline === 'swim').reduce((a,s)=>a+(s.duration_minutes||0),0);
        const bikeMin = sessions.filter(s => s.discipline==='bike'||s.discipline==='brick').reduce((a,s)=>a+(s.duration_minutes||0),0);
        const runMin  = sessions.filter(s => s.discipline==='run').reduce((a,s)=>a+(s.duration_minutes||0),0);
        const total   = swimMin + bikeMin + runMin;

        const barHtml = total > 0 ? `
          <div class="mwc-bar">
            ${swimMin ? `<div style="flex:${swimMin};background:var(--swim);border-radius:2px"></div>` : ''}
            ${bikeMin ? `<div style="flex:${bikeMin};background:var(--bike);border-radius:2px"></div>` : ''}
            ${runMin  ? `<div style="flex:${runMin};background:var(--run);border-radius:2px"></div>` : ''}
          </div>` : '<div class="mwc-bar" style="background:var(--border)"></div>';

        // Points par jour (lun–dim)
        const sessionsByDay = {};
        for (const s of sessions) {
          const d = new Date(s.date).getDay(); // 0=dim,1=lun…
          sessionsByDay[d] = s;
        }

        const daysHtml = [1,2,3,4,5,6,0].map(dayIdx => {
          const s = sessionsByDay[dayIdx];
          const isRest = !s || s.discipline === 'rest';
          const isKey  = s && intenseTypes.includes(s.session_type);
          const color  = s ? (discColor[s.discipline] || 'var(--run)') : 'var(--border-mid)';
          const dotStyle = isKey
            ? `background:${color};box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px ${color}`
            : `background:${color}`;
          return `
            <div class="mwc-day">
              <div class="mwc-day-abbr">${DAYS_FR[dayIdx]}</div>
              <div class="mwc-day-dot" style="${dotStyle}"></div>
            </div>`;
        }).join('');

        const weekTypeBadge = w.week_type === 'recovery' ? ' · Récupération' : w.week_type === 'taper' ? ' · Affûtage' : '';

        return `
          <div class="month-week-card ${isCurrent ? 'is-current' : ''}" onclick="App.switchView('week');App.loadWeekDetail(${w.id})">
            <div class="mwc-head">
              <div class="mwc-label">Semaine ${w.week_number}${weekTypeBadge}</div>
              <div class="mwc-vol">${minToHours(total)}</div>
            </div>
            ${barHtml}
            <div class="mwc-days">${daysHtml}</div>
          </div>`;
      }));

      el.innerHTML = `
        <div class="sl" style="margin-top:8px">4 prochaines semaines</div>
        <div class="month-grid">${weeksHtml.join('')}</div>
        <p class="text-small text-muted text-center mt-12">● Séance clé &nbsp; ○ Séance légère &nbsp; · Repos</p>
      `;
    } catch(e) {
      el.innerHTML = `<p class="text-muted empty-state">Erreur : ${e.message}</p>`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DÉPLACEMENT DE SÉANCE (V1.21.2 — règle 1)
  // ─────────────────────────────────────────────────────────────────────────

  let moveState = { sessionId: null, currentDate: null, selectedDate: null, weekSessions: [] };

  function openMoveModal(sessionId, sessionDate, sessionName) {
    moveState = { sessionId, currentDate: sessionDate, selectedDate: null, weekSessions: state.currentWeek?.sessions || [] };

    document.getElementById('move-modal-sub').textContent = `"${sessionName}" — choisis un autre jour.`;
    document.getElementById('move-confirm-btn').disabled = true;
    document.getElementById('move-alert').className = 'move-alert';
    document.getElementById('move-alert').textContent = '';

    // Construire la grille 7 jours autour de la semaine
    const baseDate = new Date(sessionDate);
    // Aller au lundi de la semaine
    const dayOfWeek = baseDate.getDay();
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const grid = document.getElementById('move-days-grid');
    const DAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
    const sessionDates = moveState.weekSessions
      .filter(s => s.discipline !== 'rest')
      .map(s => s.date?.toString().split('T')[0]);

    grid.innerHTML = Array.from({length: 7}, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      const isCurrent  = ds === sessionDate;
      const isOccupied = sessionDates.includes(ds) && !isCurrent;
      const dayNum     = d.getDate();
      const cls = isCurrent ? 'current' : isOccupied ? 'occupied' : '';

      return `<button class="move-day-btn ${cls}" data-date="${ds}"
        onclick="App.selectMoveDay('${ds}', ${isOccupied})" ${isCurrent ? 'disabled' : ''}>
        <span>${DAYS[i]}</span>
        <span style="font-size:0.8rem;font-weight:500">${dayNum}</span>
      </button>`;
    }).join('');

    document.getElementById('move-modal-overlay').style.display = 'flex';
  }

  function selectMoveDay(date, isOccupied) {
    moveState.selectedDate = date;

    // Mettre à jour sélection visuelle
    document.querySelectorAll('.move-day-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.date === date);
    });

    const alertEl = document.getElementById('move-alert');
    if (isOccupied) {
      alertEl.textContent = 'Il y a déjà une séance ce jour-là — l\'application ne bloque pas, mais pense à bien récupérer.';
      alertEl.className = 'move-alert warn show';
    } else {
      alertEl.className = 'move-alert';
    }

    document.getElementById('move-confirm-btn').disabled = false;
  }

  async function confirmMoveSession() {
    if (!moveState.sessionId || !moveState.selectedDate) return;
    const btn = document.getElementById('move-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Déplacement…';

    try {
      const result = await api('PATCH', `/sessions/${moveState.sessionId}/move`, {
        new_date: moveState.selectedDate,
      });

      closeMoveModal();

      if (result.conflict_warning) {
        setTimeout(() => alert('⚠️ ' + result.conflict_warning), 100);
      }

      // Recharger la semaine
      await loadAndShowWeek();
    } catch(e) {
      alert('Erreur : ' + e.message);
      btn.disabled = false;
      btn.textContent = 'Déplacer la séance';
    }
  }

  function closeMoveModal(event) {
    if (event && event.target !== document.getElementById('move-modal-overlay')) return;
    document.getElementById('move-modal-overlay').style.display = 'none';
    moveState = { sessionId: null, currentDate: null, selectedDate: null, weekSessions: [] };
  }

  // ── API PUBLIQUE DE L'APP ─────────────────────────────────────────────────
  return {
    boot, showScreen, login, register, logout,
    selectGoalType, goToOnboarding,
    onboardingBack, onboardingNext, onboardingSkip,
    obSelectOpt, obToggleTag, obInput,
    generatePlan, loadAndShowWeek, loadWeekDetail,
    switchView, renderMonthView,
    openMoveModal, selectMoveDay, confirmMoveSession, closeMoveModal,
    openSession, openFeedback,
    fbSelectStatus, fbSetRpe, fbSetPain, fbToggleZone, fbSetComment,
    submitFeedback, acceptAdaptation, rejectAdaptation,
  };

})();

// Démarrage automatique
document.addEventListener('DOMContentLoaded', () => App.boot());
