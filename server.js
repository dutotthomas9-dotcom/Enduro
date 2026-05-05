// ─────────────────────────────────────────────────────────────────────────────
// ENDURO — Serveur principal
// Express + sql.js (SQLite pur JS, aucune compilation requise) + JWT
// Lance avec : node server.js
// ─────────────────────────────────────────────────────────────────────────────

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const initSqlJs = require('sql.js');

const { generatePlan, analyzeFeasibility } = require('./engine/generator');
const { computeAdaptation }                = require('./engine/adaptation');
const { computeEvolvingFeasibility, evaluatePaceVsTarget } = require('./engine/feasibility');

const app      = express();
const PORT     = process.env.PORT     || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'enduro-secret-change-in-production';
const DB_PATH    = process.env.DB_PATH    || path.join(__dirname, 'enduro.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── INITIALISATION DB ────────────────────────────────────────────────────────
// sql.js est synchrone après l'init. On démarre le serveur une fois la DB prête.

let SQL, _db;

function saveDb() {
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Wrapper qui donne une API proche de better-sqlite3
const db = {
  prepare(sql) {
    return {
      // Retourne un objet ligne (ou undefined)
      get(...params) {
        const flat = params.flat();
        const stmt = _db.prepare(sql);
        stmt.bind(flat.length ? flat : undefined);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      // Retourne un tableau de lignes
      all(...params) {
        const flat = params.flat();
        const stmt = _db.prepare(sql);
        const rows = [];
        if (flat.length) stmt.bind(flat);
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
      // Exécute et retourne {lastInsertRowid, changes}
      run(...params) {
        const flat = params.flat();
        if (flat.length) {
          _db.run(sql, flat);
        } else {
          _db.run(sql);
        }
        const idRow = _db.exec('SELECT last_insert_rowid() as id');
        const lastInsertRowid = idRow[0]?.values[0][0] ?? 0;
        saveDb();
        return { lastInsertRowid };
      },
    };
  },
  exec(sql) {
    _db.run(sql);
    saveDb();
  },
};

async function initDb() {
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  // Schéma
  _db.run(`CREATE TABLE IF NOT EXISTS athletes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now'))
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS profiles (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id              INTEGER UNIQUE,
    first_name              TEXT,
    age                     INTEGER,
    sex                     TEXT,
    level                   TEXT DEFAULT 'intermediate',
    weekly_hours_current    REAL DEFAULT 6,
    run_10k_pace_seconds    INTEGER,
    ftp_watts               INTEGER,
    swim_css_seconds        INTEGER,
    hr_max                  INTEGER,
    hr_threshold            INTEGER,
    unavailable_days        TEXT DEFAULT '[]',
    injury_zones            TEXT DEFAULT '[]',
    updated_at              TEXT DEFAULT (datetime('now'))
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS objectives (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id       INTEGER,
    discipline       TEXT NOT NULL,
    race_name        TEXT,
    race_date        TEXT NOT NULL,
    target_time_sec  INTEGER,
    feasibility_score   INTEGER,
    feasibility_verdict TEXT,
    feasibility_message TEXT,
    feasibility_suggestion TEXT,
    is_active        INTEGER DEFAULT 1,
    created_at       TEXT DEFAULT (datetime('now'))
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS plans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id   INTEGER,
    objective_id INTEGER,
    total_weeks  INTEGER,
    start_date   TEXT,
    status       TEXT DEFAULT 'active',
    created_at   TEXT DEFAULT (datetime('now'))
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS weeks (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id                INTEGER,
    week_number            INTEGER,
    phase                  TEXT,
    phase_name             TEXT,
    week_type              TEXT,
    start_date             TEXT,
    target_volume_minutes  INTEGER,
    actual_volume_minutes  INTEGER DEFAULT 0
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    week_id           INTEGER,
    plan_id           INTEGER,
    athlete_id        INTEGER,
    date              TEXT,
    day_of_week       INTEGER,
    discipline        TEXT,
    session_type      TEXT,
    name              TEXT,
    duration_minutes  INTEGER,
    distance_km       REAL,
    tss_estimated     INTEGER,
    rpe_target        INTEGER,
    blocks            TEXT,
    coach_intro       TEXT,
    session_goal      TEXT,
    status            TEXT DEFAULT 'planned',
    is_modified       INTEGER DEFAULT 0,
    modified_reason   TEXT
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS feedbacks (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id              INTEGER UNIQUE,
    athlete_id              INTEGER,
    status                  TEXT,
    actual_duration_minutes INTEGER,
    rpe                     INTEGER,
    pain_reported           INTEGER DEFAULT 0,
    pain_zones              TEXT DEFAULT '[]',
    comment                 TEXT,
    created_at              TEXT DEFAULT (datetime('now'))
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS adaptations (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id          INTEGER,
    source_feedback_id  INTEGER,
    target_session_id   INTEGER,
    change_type         TEXT,
    change_description  TEXT,
    change_reason       TEXT,
    original_duration   INTEGER,
    new_duration        INTEGER,
    original_type       TEXT,
    new_type            TEXT,
    status              TEXT DEFAULT 'pending',
    created_at          TEXT DEFAULT (datetime('now'))
  )`);

  saveDb();

  // ── Migrations V1.2 (non-destructives) ──────────────────────────────────
  const v12columns = [
    `ALTER TABLE objectives ADD COLUMN target_time_sec INTEGER`,
    `ALTER TABLE objectives ADD COLUMN evolving_state TEXT DEFAULT 'coherent'`,
    `ALTER TABLE objectives ADD COLUMN evolving_message TEXT`,
    `ALTER TABLE objectives ADD COLUMN evolving_updated_at TEXT`,
    `ALTER TABLE sessions ADD COLUMN zone_horizon TEXT DEFAULT 'confirmed'`,
  ];
  for (const sql of v12columns) {
    try { _db.run(sql); } catch { /* colonne déjà existante */ }
  }

  // ── Migrations V1.21.1 (non-destructives) ────────────────────────────────
  const v121columns = [
    `ALTER TABLE weeks ADD COLUMN weekly_km REAL DEFAULT 0`,
    `ALTER TABLE weeks ADD COLUMN weekly_d_plus INTEGER DEFAULT 0`,
    `ALTER TABLE weeks ADD COLUMN weekly_dist_m INTEGER DEFAULT 0`,
    `ALTER TABLE sessions ADD COLUMN distance_m INTEGER DEFAULT 0`,
    `ALTER TABLE sessions ADD COLUMN d_plus INTEGER DEFAULT 0`,
  ];
  for (const sql of v121columns) {
    try { _db.run(sql); } catch { /* colonne déjà existante */ }
  }
  saveDb();
}

// ─── MIDDLEWARE AUTH ──────────────────────────────────────────────────────────

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.athlete = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée — reconnecte-toi' });
  }
}

// ─── ROUTES AUTH ──────────────────────────────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  if (password.length < 6)  return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min)' });

  try {
    const existing = db.prepare('SELECT id FROM athletes WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const hash   = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO athletes (email, password_hash) VALUES (?,?)').run(email.toLowerCase(), hash);
    const token  = jwt.sign({ id: result.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '90d' });
    res.json({ token, athlete_id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur : ' + e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const athlete = db.prepare('SELECT * FROM athletes WHERE email = ?').get(email?.toLowerCase());
  if (!athlete || !bcrypt.compareSync(password, athlete.password_hash))
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

  const token = jwt.sign({ id: athlete.id, email: athlete.email }, JWT_SECRET, { expiresIn: '90d' });
  res.json({ token, athlete_id: athlete.id });
});

// ─── ROUTES PROFIL ────────────────────────────────────────────────────────────

app.get('/api/me', auth, (req, res) => {
  const profile   = db.prepare('SELECT * FROM profiles WHERE athlete_id = ?').get(req.athlete.id);
  const objective = db.prepare('SELECT * FROM objectives WHERE athlete_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1').get(req.athlete.id);
  const plan      = objective
    ? db.prepare('SELECT * FROM plans WHERE objective_id = ? AND status = "active" ORDER BY id DESC LIMIT 1').get(objective.id)
    : undefined;

  res.json({
    athlete_id: req.athlete.id,
    email: req.athlete.email,
    profile: profile || null,
    objective: objective || null,
    plan: plan || null,
  });
});

app.put('/api/profile', auth, (req, res) => {
  const p = req.body;
  const existing = db.prepare('SELECT id FROM profiles WHERE athlete_id = ?').get(req.athlete.id);

  const injuryZones  = JSON.stringify(p.injury_zones || []);
  const unavDays     = JSON.stringify(p.unavailable_days || []);

  if (existing) {
    db.prepare(`UPDATE profiles SET
      first_name=?, age=?, sex=?, level=?,
      weekly_hours_current=?, run_10k_pace_seconds=?,
      ftp_watts=?, swim_css_seconds=?, hr_max=?, hr_threshold=?,
      unavailable_days=?, injury_zones=?
      WHERE athlete_id=?`).run(
      p.first_name || null, p.age || null, p.sex || null, p.level || 'intermediate',
      p.weekly_hours_current || 6, p.run_10k_pace_seconds || null,
      p.ftp_watts || null, p.swim_css_seconds || null, p.hr_max || null, p.hr_threshold || null,
      unavDays, injuryZones, req.athlete.id
    );
  } else {
    db.prepare(`INSERT INTO profiles
      (athlete_id, first_name, age, sex, level,
       weekly_hours_current, run_10k_pace_seconds, ftp_watts,
       swim_css_seconds, hr_max, hr_threshold, unavailable_days, injury_zones)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      req.athlete.id, p.first_name || null, p.age || null, p.sex || null, p.level || 'intermediate',
      p.weekly_hours_current || 6, p.run_10k_pace_seconds || null,
      p.ftp_watts || null, p.swim_css_seconds || null, p.hr_max || null, p.hr_threshold || null,
      unavDays, injuryZones
    );
  }

  res.json({ ok: true });
});

// ─── ROUTES OBJECTIF ─────────────────────────────────────────────────────────

app.post('/api/objectives/analyze', auth, (req, res) => {
  const profile = db.prepare('SELECT * FROM profiles WHERE athlete_id = ?').get(req.athlete.id);
  if (!profile) return res.status(400).json({ error: 'Profil incomplet' });
  const result = analyzeFeasibility(profile, req.body);
  res.json(result);
});

app.post('/api/objectives', auth, (req, res) => {
  const { discipline, race_name, race_date, target_time_sec } = req.body;
  const profile = db.prepare('SELECT * FROM profiles WHERE athlete_id = ?').get(req.athlete.id);

  db.prepare('UPDATE objectives SET is_active = 0 WHERE athlete_id = ?').run(req.athlete.id);

  const feasibility = profile ? analyzeFeasibility(profile, req.body) : {};

  const result = db.prepare(`INSERT INTO objectives
    (athlete_id, discipline, race_name, race_date, target_time_sec,
     feasibility_score, feasibility_verdict, feasibility_message, feasibility_suggestion)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    req.athlete.id, discipline, race_name || null, race_date, target_time_sec || null,
    feasibility.score || null, feasibility.verdict || null, feasibility.message || null,
    feasibility.suggestion ? JSON.stringify(feasibility.suggestion) : null
  );

  res.json({ id: result.lastInsertRowid, ...feasibility });
});

// ─── ROUTES PLAN ─────────────────────────────────────────────────────────────

app.post('/api/plans/generate', auth, (req, res) => {
  const { objective_id } = req.body;
  const profile   = db.prepare('SELECT * FROM profiles WHERE athlete_id = ?').get(req.athlete.id);
  const objective = db.prepare('SELECT * FROM objectives WHERE id = ? AND athlete_id = ?').get(objective_id, req.athlete.id);

  if (!profile)   return res.status(400).json({ error: 'Profil manquant' });
  if (!objective) return res.status(404).json({ error: 'Objectif introuvable' });

  db.prepare('UPDATE plans SET status = "archived" WHERE athlete_id = ?').run(req.athlete.id);

  const generated = generatePlan(profile, objective);

  const planRow = db.prepare('INSERT INTO plans (athlete_id, objective_id, total_weeks, start_date) VALUES (?,?,?,?)')
    .run(req.athlete.id, objective_id, generated.total_weeks, generated.start_date);
  const planId = planRow.lastInsertRowid;

  for (const week of generated.weeks) {
    const weekRow = db.prepare(`INSERT INTO weeks
      (plan_id, week_number, phase, phase_name, week_type, start_date,
       target_volume_minutes, weekly_km, weekly_d_plus, weekly_dist_m)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      planId, week.week_number, week.phase, week.phase_name,
      week.week_type, week.start_date, week.target_volume_minutes,
      week.weekly_km || 0, week.weekly_d_plus || 0, week.weekly_dist_m || 0
    );
    const weekId = weekRow.lastInsertRowid;

    for (const s of week.sessions) {
      const sessionDate = s.date instanceof Date
        ? s.date.toISOString().split('T')[0]
        : (s.date || week.start_date);

      db.prepare(`INSERT INTO sessions
        (week_id, plan_id, athlete_id, date, day_of_week, discipline, session_type,
         name, duration_minutes, distance_km, distance_m, d_plus,
         tss_estimated, rpe_target, blocks, coach_intro, session_goal)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        weekId, planId, req.athlete.id, sessionDate,
        s.day_of_week || 0, s.discipline, s.session_type,
        s.name, s.duration_minutes || 0, s.distance_km || 0,
        s.distance_m || 0, s.d_plus || 0,
        s.tss_estimated || 0, s.rpe_target || 5,
        s.blocks || '[]', s.coach_intro || '', s.session_goal || ''
      );
    }
  }

  res.json({ plan_id: planId, total_weeks: generated.total_weeks });
});

app.get('/api/plans/current', auth, (req, res) => {
  const plan = db.prepare(`SELECT p.*, o.discipline, o.race_name, o.race_date,
    o.feasibility_verdict, o.evolving_state, o.evolving_message, o.feasibility_message,
    o.target_time_sec, o.id as objective_id
    FROM plans p, objectives o
    WHERE p.objective_id = o.id AND p.athlete_id = ? AND p.status = 'active'
    ORDER BY p.id DESC LIMIT 1`).get(req.athlete.id);

  if (!plan) return res.json(null);

  const today = new Date().toISOString().split('T')[0];
  let currentWeek = db.prepare(
    `SELECT * FROM weeks WHERE plan_id = ? AND start_date <= ? ORDER BY start_date DESC LIMIT 1`
  ).get(plan.id, today);
  if (!currentWeek) {
    currentWeek = db.prepare('SELECT * FROM weeks WHERE plan_id = ? ORDER BY week_number LIMIT 1').get(plan.id);
  }

  // ── Semaines S à S+3 pour la vue 4 semaines ────────────────────────────
  const allWeeks = db.prepare(
    `SELECT * FROM weeks WHERE plan_id = ? ORDER BY week_number`
  ).all(plan.id);

  const currentIdx = currentWeek
    ? allWeeks.findIndex(w => w.id === currentWeek.id)
    : 0;

  const horizonWeeks = allWeeks.slice(currentIdx, currentIdx + 4).map((w, i) => ({
    ...w,
    horizon: i === 0 ? 'confirmed' : i === 1 ? 'probable' : 'indicative',
    horizon_label: i === 0 ? 'Confirmée' : i === 1 ? 'Probable' : 'Indicative',
  }));

  res.json({ plan, current_week: currentWeek || null, horizon_weeks: horizonWeeks });
});

// ─── ROUTE V1.2 : faisabilité évolutive ──────────────────────────────────────
// Recalcule l'état de faisabilité à partir des feedbacks récents (14 derniers jours).
// Appelée une fois par semaine depuis le frontend (à l'ouverture de la vue semaine).

app.post('/api/plans/feasibility', auth, (req, res) => {
  const profile   = db.prepare('SELECT * FROM profiles WHERE athlete_id = ?').get(req.athlete.id);
  const objective = db.prepare('SELECT * FROM objectives WHERE athlete_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1').get(req.athlete.id);
  if (!objective) return res.json({ state: 'coherent', message: 'Plan en cours de démarrage.' });

  // Feedbacks des 14 derniers jours
  const since14 = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const recentFeedbacks = db.prepare(
    `SELECT f.* FROM feedbacks f WHERE f.athlete_id = ? AND f.created_at >= ? ORDER BY f.created_at`
  ).all(req.athlete.id, since14);

  const recentSessions = db.prepare(
    `SELECT * FROM sessions WHERE athlete_id = ? AND date >= ? AND discipline != 'rest'`
  ).all(req.athlete.id, since14);

  const result = computeEvolvingFeasibility(profile, objective, recentFeedbacks, recentSessions);

  // Persister si l'état a changé
  if (result.updated) {
    db.prepare(
      `UPDATE objectives SET evolving_state=?, evolving_message=?, evolving_updated_at=datetime('now') WHERE id=?`
    ).run(result.state, result.message, objective.id);
  }

  // Évaluation allure vs objectif temps (V1.2)
  const paceEval = evaluatePaceVsTarget(profile, objective);

  res.json({ ...result, pace_eval: paceEval });
});

app.get('/api/weeks/:weekId', auth, (req, res) => {
  const week = db.prepare('SELECT * FROM weeks WHERE id = ?').get(req.params.weekId);
  if (!week) return res.status(404).json({ error: 'Semaine introuvable' });

  const sessions = db.prepare(`SELECT s.*, f.id as feedback_id, f.status as feedback_status, f.rpe
    FROM sessions s
    LEFT OUTER JOIN feedbacks f ON f.session_id = s.id
    WHERE s.week_id = ? ORDER BY s.date`).all(week.id);

  res.json({ ...week, sessions });
});

// ─── ROUTES SÉANCE ────────────────────────────────────────────────────────────

app.get('/api/sessions/:id', auth, (req, res) => {
  const session = db.prepare(`SELECT s.*, f.id as feedback_id, f.status as feedback_status,
    f.rpe, f.pain_reported, f.pain_zones, f.comment
    FROM sessions s
    LEFT OUTER JOIN feedbacks f ON f.session_id = s.id
    WHERE s.id = ? AND s.athlete_id = ?`).get(req.params.id, req.athlete.id);

  if (!session) return res.status(404).json({ error: 'Séance introuvable' });

  try { session.blocks = JSON.parse(session.blocks || '[]'); } catch { session.blocks = []; }
  res.json(session);
});

app.get('/api/sessions/:id/export', auth, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND athlete_id = ?')
    .get(req.params.id, req.athlete.id);
  if (!session) return res.status(404).json({ error: 'Séance introuvable' });

  let blocks = [];
  try { blocks = JSON.parse(session.blocks || '[]'); } catch {}

  const sport = session.discipline === 'swim' ? 'Other' :
                session.discipline === 'bike' ? 'Biking' : 'Running';

  let stepsXml = '';
  let stepId = 1;
  for (const block of blocks) {
    const intensity = (block.name || '').toLowerCase().includes('échauffement') ? 'Warmup'
      : (block.name || '').toLowerCase().includes('calme') ? 'Cooldown'
      : block.intensity === 'repos' ? 'Rest' : 'Active';

    stepsXml += `
      <Step xsi:type="Step_t">
        <StepId>${stepId++}</StepId>
        <Name>${(block.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Name>
        <Duration xsi:type="Time_t"><Seconds>${(block.duration_min || 5) * 60}</Seconds></Duration>
        <Intensity>${intensity}</Intensity>
      </Step>`;
  }

  const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    <Workout Sport="${sport}">
      <Name>${(session.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Name>
      ${stepsXml}
      <ScheduledOn>${session.date}</ScheduledOn>
    </Workout>
  </Workouts>
</TrainingCenterDatabase>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="enduro_${session.date}_${session.discipline}.tcx"`);
  res.send(tcx);
});

// ─── ROUTES FEEDBACK ─────────────────────────────────────────────────────────

app.post('/api/sessions/:id/feedback', auth, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND athlete_id = ?')
    .get(req.params.id, req.athlete.id);
  if (!session) return res.status(404).json({ error: 'Séance introuvable' });

  const { status, actual_duration_minutes, rpe, pain_reported, pain_zones, comment } = req.body;

  const existing = db.prepare('SELECT id FROM feedbacks WHERE session_id = ?').get(session.id);
  let feedbackId;

  if (existing) {
    db.prepare(`UPDATE feedbacks SET status=?, actual_duration_minutes=?, rpe=?,
      pain_reported=?, pain_zones=?, comment=? WHERE session_id=?`).run(
      status, actual_duration_minutes || null, rpe || null,
      pain_reported ? 1 : 0, JSON.stringify(pain_zones || []), comment || null, session.id
    );
    feedbackId = existing.id;
  } else {
    const r = db.prepare(`INSERT INTO feedbacks
      (session_id, athlete_id, status, actual_duration_minutes, rpe, pain_reported, pain_zones, comment)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      session.id, req.athlete.id, status, actual_duration_minutes || null,
      rpe || null, pain_reported ? 1 : 0, JSON.stringify(pain_zones || []), comment || null
    );
    feedbackId = r.lastInsertRowid;
  }

  db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(status, session.id);

  const feedback = db.prepare('SELECT * FROM feedbacks WHERE id = ?').get(feedbackId);
  const nextSessions = db.prepare(`SELECT * FROM sessions WHERE athlete_id = ? AND date > ?
    AND status = 'planned' ORDER BY date LIMIT 7`).all(req.athlete.id, session.date);

  // Toutes les séances de la semaine courante (pour compter les jours de repos)
  const weekStart = new Date(session.date);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // lundi de la semaine
  const weekEnd   = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const allSessionsThisWeek = db.prepare(
    `SELECT * FROM sessions WHERE athlete_id = ? AND date >= ? AND date <= ?`
  ).all(req.athlete.id, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]);

  const adaptation = computeAdaptation(feedback, session, nextSessions, allSessionsThisWeek);

  let adaptationId = null;
  if (adaptation.change_type !== 'none') {
    const r = db.prepare(`INSERT INTO adaptations
      (athlete_id, source_feedback_id, target_session_id, change_type,
       change_description, change_reason, original_duration, new_duration,
       original_type, new_type, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      req.athlete.id, feedbackId, adaptation.target_session_id || null,
      adaptation.change_type, adaptation.change_description, adaptation.change_reason,
      adaptation.original_duration || null, adaptation.new_duration || null,
      adaptation.original_type || null, adaptation.new_type || null, 'pending'
    );
    adaptationId = r.lastInsertRowid;
  }

  res.json({ feedback_id: feedbackId, adaptation_id: adaptationId, adaptation });
});

// ─── ROUTES ADAPTATION ───────────────────────────────────────────────────────

app.get('/api/adaptations/:id', auth, (req, res) => {
  const adaptation = db.prepare('SELECT * FROM adaptations WHERE id = ? AND athlete_id = ?')
    .get(req.params.id, req.athlete.id);
  if (!adaptation) return res.status(404).json({ error: 'Adaptation introuvable' });

  let targetSession = null;
  if (adaptation.target_session_id) {
    targetSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(adaptation.target_session_id);
  }
  res.json({ ...adaptation, target_session: targetSession });
});

app.post('/api/adaptations/:id/accept', auth, (req, res) => {
  const a = db.prepare('SELECT * FROM adaptations WHERE id = ? AND athlete_id = ?')
    .get(req.params.id, req.athlete.id);
  if (!a) return res.status(404).json({ error: 'Adaptation introuvable' });

  if (a.target_session_id) {
    if (a.change_type === 'reduce_duration') {
      db.prepare('UPDATE sessions SET duration_minutes = ?, is_modified = 1, modified_reason = ? WHERE id = ?')
        .run(a.new_duration, a.change_reason, a.target_session_id);
    } else if (a.change_type === 'reschedule' || a.change_type === 'replace_discipline') {
      db.prepare('UPDATE sessions SET session_type = ?, duration_minutes = ?, is_modified = 1, modified_reason = ? WHERE id = ?')
        .run(a.new_type, a.new_duration, a.change_reason, a.target_session_id);
    }
  }

  db.prepare('UPDATE adaptations SET status = "accepted" WHERE id = ?').run(a.id);
  res.json({ ok: true });
});

app.post('/api/adaptations/:id/reject', auth, (req, res) => {
  db.prepare('UPDATE adaptations SET status = "rejected" WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── SPA ─────────────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── DÉMARRAGE ───────────────────────────────────────────────────────────────

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅  Enduro lancé → http://localhost:${PORT}\n`);
    console.log(`   Base de données : ${DB_PATH}`);
    console.log(`   Arrêter : Ctrl+C\n`);
  });
}).catch(err => {
  console.error('Erreur initialisation DB:', err);
  process.exit(1);
});
