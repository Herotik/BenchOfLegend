# La Faille — Application d'entraînement classé

> Document de spécification destiné à un agent de développement IA (Claude Code ou équivalent).
> Lis ce document en entier avant d'écrire la moindre ligne de code. Travaille par phases, dans l'ordre. Commits conventionnels (`feat:`, `fix:`, `chore:`) à chaque étape fonctionnelle.

---

## 1. Vision produit

Application web de suivi d'entraînement gamifiée, inspirée du système de rangs de League of Legends, transposée en mythologie grecque (Hoplite → Dieu de l'Olympe). L'utilisateur crée un compte via Google, renseigne son matériel et les groupes musculaires qu'il veut travailler, et l'application génère un **programme hebdomadaire personnalisé** : un calendrier avec des séances minimum obligatoires, plus la possibilité de séances bonus. Chaque séance validée rapporte des LP qui font grimper le rang. Le poids corporel est saisi quotidiennement à la connexion et visualisé sous forme de graphiques.

**Utilisateur cible initial** : pratiquant débutant/intermédiaire au poids de corps ou avec matériel maison, francophone. L'app doit rester générique (multi-utilisateurs) dès le départ.

**Langue de l'interface : français.** Tout le contenu (exercices, messages, labels) est en français.

---

## 2. Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Framework | **Next.js 15+ (App Router, TypeScript)** | Full-stack en un seul projet, Server Components, écosystème auth mature |
| Auth | **Auth.js v5** (`next-auth@beta`) avec provider **Google** | Standard de facto pour App Router, helper `auth()` unifié |
| ORM | **Prisma** | Adapter officiel Auth.js (`@auth/prisma-adapter`), migrations simples |
| Base de données | **SQLite** (fichier local `./dev.db`) | Demandé : "base de données en local pour commencer". Le schéma Prisma doit rester compatible PostgreSQL pour une migration ultérieure (pas de types exotiques SQLite) |
| UI | **Tailwind CSS** + composants maison | Contrôle total sur le thème hextech |
| Graphiques | **Recharts** | Courbes de poids, barres de volume, simple et React-natif |
| Dates | **date-fns** avec locale `fr` | Calendrier, semaines ISO |
| Validation | **Zod** | Validation des inputs API et formulaires |

### Configuration Auth.js v5 (points d'attention)

- Fichier `auth.ts` à la racine du projet (pas dans `app/`), exportant `{ handlers, signIn, signOut, auth }`.
- Route handler : `app/api/auth/[...nextauth]/route.ts` qui ré-exporte `handlers`.
- Variables d'env : `AUTH_SECRET` (générer via `openssl rand -base64 32`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`.
- Adapter Prisma + `session: { strategy: "database" }`.
- Middleware de protection : toutes les routes sauf `/` (landing) et `/api/auth/*` exigent une session.
- Fournir un `README` avec la procédure Google Cloud Console : créer un projet → APIs & Services → Credentials → OAuth client ID (Web application) → redirect URI `http://localhost:3000/api/auth/callback/google`.
- **Ne jamais commiter les secrets.** Fournir `.env.example`.

---

## 3. Modèle de données (Prisma)

Schéma complet à implémenter. Les modèles `User`, `Account`, `Session`, `VerificationToken` suivent le schéma standard Auth.js, avec des champs custom sur `User`.

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  // --- Custom ---
  onboarded     Boolean   @default(false)
  heightCm      Int?
  goal          Goal      @default(HYPERTROPHIE)   // HYPERTROPHIE | FORCE | ENDURANCE | PERTE_DE_POIDS
  level         Level     @default(DEBUTANT)        // DEBUTANT | INTERMEDIAIRE | AVANCE
  daysPerWeek   Int       @default(3)               // 2..6, choisi à l'onboarding
  lp            Int       @default(0)               // LP cumulés (jamais négatifs)
  accounts      Account[]
  sessions      Session[]
  equipments    UserEquipment[]
  muscleGroups  UserMuscleGroup[]
  weighIns      WeighIn[]
  workouts      WorkoutLog[]
  planDays      PlanDay[]
}

model Equipment {
  id    String @id            // slug: "halteres", "banc", "barre_dc", "tapis_course", "elastiques", "barre_traction", "kettlebell", "corde_a_sauter"
  label String                 // "Haltères", "Banc de musculation", ...
  users UserEquipment[]
}

model UserEquipment {
  userId      String
  equipmentId String
  user        User      @relation(...)
  equipment   Equipment @relation(...)
  @@id([userId, equipmentId])
}

model MuscleGroup {
  id    String @id            // "pectoraux", "dos", "epaules", "bras", "jambes", "abdos", "cardio"
  label String
  users UserMuscleGroup[]
}

model UserMuscleGroup {
  userId   String
  groupId  String
  priority Int    @default(1) // 1 = priorité normale, 2 = point fort souhaité
  @@id([userId, groupId])
}

model Exercise {
  id          String   @id @default(cuid())
  name        String                // "Pompes déclinées"
  muscleGroup String                // FK logique vers MuscleGroup.id
  equipment   String   @default("aucun") // "aucun" = poids de corps ; sinon slug Equipment. Séparateur "+" si plusieurs requis ("banc+halteres")
  level       Level    @default(DEBUTANT) // niveau minimum
  type        ExoType  @default(POLYARTICULAIRE) // POLYARTICULAIRE | ISOLATION | CARDIO
  description String                // consignes d'exécution en 1-2 phrases
  progression String?               // nom de la variante plus difficile
}

model PlanDay {
  id        String   @id @default(cuid())
  userId    String
  date      DateTime               // jour du calendrier (date seule, normalisée à minuit UTC)
  muscleGroup String               // groupe ciblé ce jour-là
  status    PlanStatus @default(PREVU) // PREVU | FAIT | MANQUE | REPOS
  workoutId String?                // rempli quand la séance est validée
  @@unique([userId, date, muscleGroup])
}

model WorkoutLog {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime
  muscleGroup String
  isBonus     Boolean  @default(false)
  lpEarned    Int
  exercises   Json     // snapshot: [{name, sets, reps, restSec, done, weightUsedKg?}]
  durationMin Int?
  feeling     Int?     // 1-5, ressenti post-séance
}

model WeighIn {
  id     String   @id @default(cuid())
  userId String
  date   DateTime
  kg     Float
  @@unique([userId, date])
}
```

**Seed obligatoire** (`prisma/seed.ts`) : les 8 équipements, les 7 groupes musculaires, et une **base d'exercices d'au moins 60 entrées** couvrant chaque groupe musculaire × (poids de corps + chaque équipement pertinent) × niveaux. Exemples attendus :

- Pectoraux / aucun : pompes classiques, déclinées, déficit, archer, diamant, dips entre chaises, pompes explosives
- Pectoraux / banc+halteres : développé couché haltères, écartés, développé incliné
- Pectoraux / barre_dc+banc : développé couché barre
- Dos / aucun : superman, rowing inversé sous table, pompes scapulaires ; / barre_traction : tractions pronation, supination, négatives
- Jambes / aucun : squats, fentes, fentes bulgares (chaise), squat sauté, hip thrust au sol, mollets debout
- Épaules / aucun : pompes piquées (pike push-up), élévations en gainage ; / halteres : développé militaire, élévations latérales
- Bras / aucun : diamant, dips chaise ; / halteres : curl biceps, extensions triceps
- Abdos / aucun : crunchs, planche, relevés de jambes, gainage latéral, mountain climbers
- Cardio / aucun : burpees, jumping jacks, HIIT au poids de corps ; / tapis_course : course fractionné, endurance fondamentale ; / corde_a_sauter : intervalles

Chaque exercice du seed doit avoir une `description` d'exécution réelle et utile, pas un placeholder.

---

## 4. Parcours utilisateur

### 4.1 Connexion / création de compte
- Landing page publique : présentation + bouton "Se connecter avec Google".
- Premier login → redirection forcée vers `/onboarding` tant que `user.onboarded === false`.

### 4.2 Onboarding (wizard 4 étapes, sauvegarde à la fin)
1. **Profil** : taille (cm), poids actuel (crée la première `WeighIn`), niveau (débutant / intermédiaire / avancé — avec une phrase d'aide pour s'auto-évaluer, ex. débutant = moins de 6 mois de pratique régulière).
2. **Matériel** : "Tout le monde a une chaise ou un canapé — le poids de corps est toujours disponible." Puis cases à cocher facultatives : haltères, banc, barre de développé couché, barre de traction, élastiques, kettlebell, tapis de course, corde à sauter. Aucune case cochée = poids de corps pur.
3. **Objectifs** : groupes musculaires à travailler (multi-sélection : pectoraux, dos, épaules, bras, jambes, abdos, cardio) + objectif global (hypertrophie / force / endurance / perte de poids) + nombre de jours d'entraînement par semaine (2 à 6, avec recommandation affichée : 3-4 pour débuter).
4. **Récapitulatif** → validation → génération du premier plan hebdomadaire → `onboarded = true` → redirection dashboard.

Ces préférences restent modifiables à tout moment dans `/parametres` (toute modification régénère le plan des semaines futures, jamais le passé).

### 4.3 Check-in quotidien (poids obligatoire)
À chaque connexion, si aucune `WeighIn` n'existe pour aujourd'hui : **modal bloquante** demandant le poids du jour (input numérique pré-rempli avec la dernière valeur, pas kg/lbs — kg uniquement). Bouton unique "Valider". Cas limite : autoriser un bouton discret "Passer aujourd'hui" après 3 secondes (ne pas prendre l'utilisateur en otage s'il n'a pas de balance sous la main), mais la pesée validée donne +2 LP, pas le skip.

---

## 5. Moteur de génération des séances

C'est le cœur de l'app. Module pur et testé unitairement : `lib/engine/`.

### 5.1 Génération du plan hebdomadaire (`generateWeekPlan(user)`)
- Répartir les groupes choisis sur `daysPerWeek` jours, en respectant :
  - **Chaque groupe musculaire choisi est travaillé idéalement 2× par semaine** (fréquence supérieure à 1× à volume égal, standard actuel). Si trop de groupes pour le nombre de jours, prioriser `priority = 2` puis compléter en alternance d'une semaine à l'autre.
  - **Jamais le même groupe deux jours consécutifs** (48 h de récupération minimum par groupe). Le cardio peut s'intercaler n'importe quand.
  - Jours de repos répartis (pas 4 séances d'affilée puis 3 jours off).
- Sortie : création des `PlanDay` de la semaine (lundi → dimanche). Les jours sans séance ont `status = REPOS`.
- Un cron logique (au chargement du dashboard) : si la semaine courante n'a pas de plan → générer ; les `PlanDay` passés non faits passent en `MANQUE`.

### 5.2 Génération d'une séance (`generateWorkout(user, muscleGroup)`)
Sélectionner 4 à 6 exercices dans la base selon :
1. `muscleGroup` correspondant,
2. `equipment` ⊆ matériel de l'utilisateur (ou "aucun"),
3. `level` ≤ niveau de l'utilisateur, avec au moins 1 exercice du niveau exact de l'utilisateur,
4. Ordre : polyarticulaires d'abord, isolation ensuite, finisher éventuel en dernier.

**Prescription précise (obligatoire pour chaque exercice)** — répétitions ET temps de repos affichés, dérivés de l'objectif :

| Objectif | Répétitions | Repos polyarticulaire | Repos isolation | Séries |
|---|---|---|---|---|
| Hypertrophie | 6–12 | 2 min – 3 min | 60–90 s | 3–4 |
| Force | 3–6 | 3 min – 5 min | 2 min | 3–5 |
| Endurance | 15–20+ | 30–45 s | 30 s | 2–3 |
| Perte de poids | 12–15 (circuits) | 30–60 s | 30–45 s | 3 |

- Volume par séance : viser **10 à 16 séries de travail au total** (l'échauffement ne compte pas), soit ~10-12 séries hebdo par groupe pour un débutant réparties sur 2 séances, davantage pour intermédiaire/avancé.
- Chaque séance commence par un bloc "Échauffement" fixe (non compté en LP bonus) : 5 min de mobilité + 2 séries légères du premier mouvement.
- **Répétitions affichées : un nombre précis, jamais une fourchette.** Les fourchettes du tableau ci-dessus restent la référence de programmation, mais l'utilisateur voit « 3 séries × 8 répétitions ». Une fourchette le laisserait choisir son effort et rendrait inexploitable la notion de série non terminée. Bas de fourchette sur les polyarticulaires, haut sur l'isolation.
- **Suivi par exercice en trois états** : non fait, série non terminée, fait. Une série entamée sans être bouclée compte pour moitié dans l'avancement de la séance et dans le volume — signaler un échec ne doit pas revenir à se pénaliser, sinon personne ne le fera.
- **Progression par le ressenti.** En fin de séance, l'utilisateur déclare *Facile*, *Juste ce qu'il faut* ou *Trop dur*. « Facile » propose de monter d'un cran la difficulté du groupe travaillé, « trop dur » de la baisser ; la proposition n'est jamais appliquée d'office. Le cran est stocké dans `UserMuscleGroup.levelOffset` (−1 à +1) et s'ajoute au niveau déclaré pour choisir les variantes : un débutant à +1 accède aux mouvements intermédiaires de ce seul groupe.

  > Cette règle remplace la version initiale de la spec — « si l'utilisateur dépasse la fourchette haute de reps deux séances de suite ». Elle était inapplicable : l'app prescrit un nombre précis, on ne le dépasse donc pas, et l'interface n'enregistre pas les reps réellement effectuées. Le ressenti déclaré remplit le même rôle, vaut aussi bien au poids de corps qu'avec des charges, et coûte un seul appui.
- Cardio : prescription en durée/intervalles (ex. 8 × 30 s effort / 90 s récup) au lieu de séries×reps.

### 5.3 Séances bonus
Depuis le dashboard, bouton "Séance bonus" : l'utilisateur choisit librement un groupe musculaire (même hors de ses préférences), l'app génère la séance avec les mêmes règles. Garde-fou : si le groupe a déjà été travaillé la veille ou le jour même, afficher un avertissement de récupération ("Ce groupe a été sollicité il y a moins de 48 h — la récupération fait partie de la progression") avec confirmation explicite. `isBonus = true`, LP réduits (voir §6) pour ne pas inciter au surentraînement.

---

## 6. Gamification (système de rangs)

### Rangs
Échelle à **8 rangs**, thème mythologie grecque. **Source de vérité : `lib/ranks.ts`** (noms, sous-titres, descriptions, couleurs, seuils LP) — ne pas redéfinir la liste ailleurs. Écussons PNG transparents 512×512 dans `public/ranks/`, découpés depuis `docs/planche-rangs-source.png` par `scripts/extract-ranks.py`.

| Rang | Palier | Sous-titre | LP d'entrée | Divisions |
|---|---|---|---|---|
| Hoplite | Fer | Soldat débutant | 0 | 4 (IV → I) |
| Myrmidon | Bronze | Guerrier entraîné | 400 | 4 |
| Spartiate | Argent | Athlète consacré | 800 | 4 |
| Héraclès | Or | Héros légendaire | 1200 | 4 |
| Élyséen | Platine | Champion divin | 1600 | 4 |
| Titan | Diamant | Fils des dieux | 2000 | 4 |
| Demi-Dieu | Maître | Être d'exception | 2400 | — |
| Dieu de l'Olympe | Challenger | Sommet de la perfection | 3000 | — (illimité) |

100 LP par division. Chaque rang porte une couleur d'accent (`Rank.color`) et une phrase de progression (`Rank.description`) affichée sous l'écusson sur le dashboard, avec barre de progression LP.

L'échelle pourra s'étoffer plus tard (paliers intermédiaires) : tout code qui affiche un rang doit itérer sur `RANKS` et passer par `rankForLp()` / `rankProgressForLp()` / `rankLabel()`, jamais coder en dur un nom ou un seuil.

### Barème LP
| Action | LP |
|---|---|
| Séance minimum du jour validée (≥ 80 % des exercices cochés) | +20 |
| Séance validée partiellement (50–79 %) | +12 |
| Séance bonus validée | +8 (plafond : 1 bonus comptabilisé/jour) |
| Finisher complété | +4 |
| Régularité : 3ᵉ séance et suivantes sur 7 jours glissants | +3 |
| Pesée du jour effectuée | +2 (1×/jour) |

- **Aucune perte de LP.** Pas de démotion : une semaine manquée n'enlève rien (motivation positive ; la vraie sanction est l'absence de gain). Les `PlanDay` en `MANQUE` sont visibles sur le calendrier, c'est suffisant.
- Toast/animation de promotion lors d'un changement de division ou de rang.
- Une seule validation de séance minimum par `PlanDay`.

---

## 7. Pages & navigation

| Route | Contenu |
|---|---|
| `/` | Landing publique + login Google |
| `/onboarding` | Wizard 4 étapes |
| `/dashboard` | Écusson + rang + LP, séance(s) du jour avec checklist exercices (reps/repos affichés par série), bouton valider, bouton séance bonus, stats rapides (séances totales, streak 7 j, dernier poids) |
| `/calendrier` | Vue mensuelle : jours avec séance prévue (groupe affiché), faite (✓ vert), manquée (✗ rouge discret), repos. Clic sur un jour futur = aperçu de la séance. Navigation mois précédent/suivant |
| `/graphiques` | Voir §8 |
| `/historique` | Liste antichronologique des `WorkoutLog` avec détail dépliable (exercices, reps réalisées, LP gagnés) |
| `/parametres` | Modifier matériel, groupes, objectif, jours/semaine, niveau, taille ; bouton export JSON de toutes ses données ; suppression de compte |

Layout : sidebar desktop / bottom-nav mobile. **Mobile-first** — l'app sera utilisée pendant la séance, téléphone en main : gros boutons de check, chrono de repos intégré par exercice (décompte du `restSec` avec son/vibration si supporté).

## 8. Page graphiques (`/graphiques`)

Avec Recharts, minimum :
1. **Courbe de poids** (LineChart) : toutes les pesées, tooltip par point, ligne de tendance sur 7 jours glissants. Sélecteur de période : 30 j / 90 j / tout.
2. **Delta hebdomadaire de poids** (BarChart) : variation semaine par semaine — l'utilisateur vise une prise progressive, cette vue montre si le rythme est tenu.
3. **Volume d'entraînement** (BarChart empilé) : séries de travail par semaine, empilées par groupe musculaire.
4. **Assiduité** (BarChart ou heatmap simple) : séances faites vs prévues par semaine, en %.
5. **Progression LP** (AreaChart) : LP cumulés dans le temps, avec repères horizontaux aux seuils de rangs.

---

## 9. API (Route Handlers, toutes protégées par `auth()`)

- `POST /api/weigh-in` — upsert pesée du jour ({kg}), retourne LP gagnés
- `GET /api/plan?week=ISO` — plan de la semaine (génère si absent)
- `POST /api/workout/generate` — {muscleGroup, isBonus} → séance générée (non persistée)
- `POST /api/workout/validate` — {planDayId?, muscleGroup, exercises[], isBonus} → crée WorkoutLog, calcule LP, met à jour PlanDay et User.lp, retourne {lpEarned, promoted, newRank}
- `GET /api/stats` — agrégats pour /graphiques
- `PUT /api/preferences` — met à jour profil + régénère plans futurs

Valider chaque payload avec Zod. Tout calcul de LP se fait **côté serveur** (jamais confiance au client).

---

## 10. Phases de développement (dans l'ordre)

1. **Setup** : Next.js + TS + Tailwind + Prisma/SQLite + seed complet. Vérifier `npx prisma db seed`.
2. **Auth** : Auth.js v5 + Google + middleware + pages login/logout. Tester le flow complet.
3. **Onboarding** : wizard + persistance + garde de redirection.
4. **Moteur** : `lib/engine/` (plan hebdo + génération séance) avec **tests unitaires** (Vitest) : respect matériel, respect 48 h, fourchettes reps/repos par objectif, volume par séance.
5. **Dashboard + validation de séance** : checklist, chrono de repos, calcul LP serveur, toasts promotion.
6. **Check-in poids** : modal quotidienne + API.
7. **Calendrier**.
8. **Graphiques**.
9. **Historique + paramètres + export JSON**.
10. **Polish** : responsive, accessibilité (focus visible, aria), états vides soignés, gestion d'erreurs.

## 11. Critères d'acceptation

- [ ] Login Google fonctionnel de bout en bout en local
- [ ] Un nouvel utilisateur sans aucun matériel obtient des séances 100 % poids de corps cohérentes
- [ ] Un utilisateur avec "haltères + banc" voit apparaître du développé couché haltères dans ses séances pectoraux
- [ ] Chaque exercice affiché comporte : nom, séries × fourchette de reps, temps de repos en secondes, description d'exécution
- [ ] Aucun groupe musculaire planifié deux jours consécutifs
- [ ] La modal de pesée apparaît une seule fois par jour et alimente la courbe
- [ ] Valider une séance met à jour LP, rang, calendrier et historique de façon cohérente (vérifiable en base)
- [ ] Une séance bonus le même jour qu'une séance minimum est possible et tracée séparément
- [ ] Les 5 graphiques s'affichent avec des données réelles
- [ ] `npm run build` passe sans erreur ni warning TypeScript

## 12. Contraintes et garde-fous

- Ton de l'app : motivant, jamais culpabilisant. Les jours manqués sont neutres visuellement (pas de messages négatifs).
- Pas de conseils médicaux dans l'app ; une mention discrète dans les paramètres : "Cette application ne remplace pas un avis médical."
- Le code du moteur d'entraînement doit être commenté avec les fourchettes utilisées, pour faciliter les ajustements futurs.
- Prévoir la migration SQLite → PostgreSQL : aucune requête SQL brute spécifique SQLite, tout passe par Prisma.
- RGPD-minded : export JSON et suppression de compte fonctionnels dès la v1.
