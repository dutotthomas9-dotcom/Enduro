# Enduro — Application de coaching triathlon V1

Application web de coaching triathlon. Aucune installation requise pour les athlètes — juste un navigateur.

---

## Lancer l'application localement

### Prérequis

- Node.js 18+ installé (`node --version` pour vérifier)
- npm (inclus avec Node.js)

### Installation

```bash
# Cloner ou copier le dossier enduro/
cd enduro

# Installer les dépendances (une seule fois)
npm install

# Lancer le serveur
node server.js
```

L'application est accessible sur **http://localhost:3000**

---

## Structure du projet

```
enduro/
├── server.js              Serveur Express + toutes les routes API
├── package.json           Dépendances (express, jwt, bcrypt, sql.js)
├── enduro.db              Base de données SQLite (créée automatiquement)
│
├── engine/
│   ├── generator.js       Moteur de génération du plan (déterministe)
│   └── adaptation.js      Règles d'adaptation (6 règles explicitées)
│
└── public/
    ├── index.html         Shell SPA (tous les écrans)
    ├── style.css          Design system Enduro
    └── app.js             Logique frontend SPA
```

---

## Flux utilisateur complet

```
Connexion / Inscription
    ↓
Écran 01 — Choix objectif (triathlon / CAP / libre)
    ↓
Écran 02 — Onboarding conversationnel (7 questions)
    ↓
Écran 03 — Analyse de faisabilité (verdict + suggestion)
    ↓
[Génération du plan — quelques secondes]
    ↓
Écran 05 — Vue semaine (7 jours avec répartition disciplines)
    ↓
Écran 06 — Détail séance (blocs + cibles allure/FC)
    ↓
Écran 07 — Feedback post-séance (statut + RPE + douleur)
    ↓
Écran 08 — Adaptation proposée (avant/après + raison)
    ↓
Retour Écran 05
```

---

## Héberger en production

### Option 1 — Railway (le plus simple)

```bash
# 1. Crée un compte sur railway.app
# 2. New Project → Deploy from GitHub (ou upload direct)
# 3. Ajoute les variables d'environnement :
#    JWT_SECRET = une_chaine_aleatoire_longue
#    PORT = 3000 (Railway le définit automatiquement)
```

### Option 2 — Render

```bash
# 1. render.com → New Web Service
# 2. Build Command : npm install
# 3. Start Command : node server.js
# 4. Variables :
#    JWT_SECRET = une_chaine_aleatoire_longue
```

### Option 3 — VPS (Linux)

```bash
# Installer PM2 pour garder le process en vie
npm install -g pm2
pm2 start server.js --name enduro
pm2 startup  # pour démarrer au boot
pm2 save
```

> ⚠️ En production : utilise un volume persistant pour `enduro.db`
> (Render → Persistent Disk, Railway → Volume)

---

## Variables d'environnement

| Variable     | Par défaut                          | Description                     |
|--------------|-------------------------------------|---------------------------------|
| `PORT`       | `3000`                              | Port du serveur                 |
| `JWT_SECRET` | `enduro-secret-change-in-production`| Secret JWT — **changer en prod** |
| `DB_PATH`    | `./enduro.db`                       | Chemin de la base SQLite        |

---

## API — Routes disponibles

### Auth
```
POST /api/auth/register   { email, password }
POST /api/auth/login      { email, password }
```

### Athlète
```
GET  /api/me
PUT  /api/profile         { first_name, level, weekly_hours_current, … }
```

### Objectif & Plan
```
POST /api/objectives/analyze   { discipline, race_date }
POST /api/objectives           { discipline, race_name, race_date }
POST /api/plans/generate       { objective_id }
GET  /api/plans/current
GET  /api/weeks/:weekId
```

### Séances
```
GET  /api/sessions/:id
GET  /api/sessions/:id/export   → fichier .tcx pour Garmin
```

### Feedback & Adaptation
```
POST /api/sessions/:id/feedback   { status, rpe, pain_reported, pain_zones, comment }
GET  /api/adaptations/:id
POST /api/adaptations/:id/accept
POST /api/adaptations/:id/reject
```

---

## Règles sportives appliquées

Le moteur de génération applique ces règles sans exception :

- **Progression** : +8% max par semaine, jamais plus
- **Semaines allégées** : toutes les 3 semaines (-35% de volume)
- **Distribution** : 50% vélo / 30% CAP / 20% natation (±10%)
- **Intensité 80/20** : ~80% séances Z1-Z2, ~20% séances qualité
- **Bricks** : obligatoires à partir des phases développement et spécifique
- **Repos** : minimum 1 jour par semaine, non négociable

Les règles d'adaptation (6 cas) :
1. Séance non réalisée → reprogrammation si créneau disponible
2. Douleur signalée → suppression des séances à fort impact (5-7 jours)
3. RPE ≥ 9 → réduction 15-25% de la prochaine séance qualité
4. RPE ≥ 8 → réduction 10% de la prochaine séance seuil
5. Séance partielle → plan conservé, surveillance
6. RPE ≤ 7, séance réalisée → aucun ajustement

---

## Métriques à observer pendant le test

- Taux de retour hebdomadaire (objectif : ≥ 3 sessions/semaine)
- Taux de complétion du feedback (objectif : > 60%)
- Taux de validation des adaptations proposées
- Zéro incident de charge excessive signalé

---

## Ce qui n'est PAS dans cette V1 (volontairement)

- Dashboard coach multi-athlètes
- Synchronisation automatique Garmin / Strava
- Métriques de charge visibles (CTL, ATL, TSB)
- Notifications push
- Disciplines trail / CAP seules
