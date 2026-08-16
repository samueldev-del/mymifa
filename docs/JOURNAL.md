# Journal DevOps — MyMifa

Ce document trace la construction de la chaîne DevOps de MyMifa : les décisions
prises, leurs raisons, et ce qui a été appris en chemin. Il complète le code,
qui dit *quoi*, en documentant le *pourquoi*.

---

## 2026-08-13 — Fondations CI/CD et gouvernance du dépôt

### Point de départ

- Monorepo : `frontend/` (Next.js) et `backend/` (API Express), un seul dépôt Git.
- Deux projets Vercel, déploiement continu déjà actif via l'intégration Git native.
- Un workflow GitHub Actions préexistant (`sync-emails.yml`, cron de synchronisation).
- Une PR ouverte contenant un premier pipeline CI couvrant le frontend uniquement.
- Dépôt privé, `main` sans aucune protection.

### Décisions prises

**AWS plutôt qu'Azure.** L'application utilise déjà un bucket S3 en `eu-central-1`
avec un utilisateur IAM dédié. Introduire un second cloud aurait signifié deux jeux
de credentials, deux modèles d'identité et deux factures, sans bénéfice.

**Protéger `main` avant d'enrichir les tests.** Un pipeline qui ne bloque rien est
un tableau de bord, pas un garde-fou. Ajouter des vérifications à une CI contournable
augmente le volume d'information, pas le niveau de garantie.

**Dépôt public.** Trois bénéfices : minutes GitHub Actions illimitées, protection de
branche disponible sans abonnement payant, et travail consultable par un recruteur.
Décision conditionnée à un audit préalable de l'historique Git.

**Structure CI : un workflow, deux jobs, sans filtres de chemins.** Les filtres
auraient économisé quelques minutes, mais un check requis qui ne s'exécute pas ne
reporte jamais de statut — la PR devient alors impossible à merger. Le coût du piège
dépassait l'économie.

**Checks bloquants : les deux jobs CI uniquement.** Les trois checks Vercel restent
visibles mais non bloquants. Ils attestent qu'un déploiement a abouti, pas que le code
est correct ; l'un d'eux (`Vercel Preview Comments`) ne vérifie rien du tout. Les
rendre bloquants aurait suspendu les merges à la disponibilité d'un service tiers.

**Aucun bypass administrateur.** Une règle contournable par la seule personne
susceptible de la contourner ne protège rien.

### Incidents et diagnostics

**Le cron ne tourne pas à la fréquence configurée.**
Hypothèse initiale : `*/15` produit 96 exécutions par jour, soit ~2 880 minutes par
mois, au-dessus du quota de 2 000 d'un dépôt privé.
Mesure : 19 exécutions le 12 août au lieu de 96, avec des écarts allant jusqu'à 2h43.
Cause : GitHub documente que l'événement `schedule` est en « meilleur effort » et peut
être retardé ou abandonné en période de charge.
Décision : ne pas corriger — l'application n'a pas encore d'utilisateurs, une latence
d'une heure est sans conséquence. La parade (planificateur externe appelant
`workflow_dispatch`) sera traitée à l'étape AWS via EventBridge Scheduler.

**Un `fi` en trop dans un fichier non surveillé.**
Une modification accidentelle de `sync-emails.yml` — un `fi` orphelin et une fin de
fichier sans saut de ligne — a failli partir dans un commit destiné à `ci.yml`.
Ce qui l'a évitée : `git add <fichier>` explicite plutôt que `git add .`.
Enseignement : le répertoire de travail est partagé entre les branches ; une
modification non committée suit les changements de branche. On part toujours d'un
`git status` propre.

**Versions d'actions périmées.**
Le premier pipeline utilisait `actions/checkout@v4` et `actions/setup-node@v4`, alors
que les majeures actuelles sont `v5` et `v6`. Corrigé après vérification sur les pages
Releases officielles.
Enseignement : ne jamais faire confiance à une version de mémoire — vérifier à la
source, et automatiser la surveillance (Dependabot).

### Audit de sécurité avant publication

Trois passes indépendantes sur l'historique complet :
1. Liste de tous les fichiers ayant existé dans un commit — aucun `.env` réel,
   seulement des `.env.example` documentaires.
2. Recherche de motifs de secrets (`AKIA…`, chaînes de connexion, `sk-ant-`,
   clés privées) — 16 correspondances, toutes des valeurs-gabarits (`user:password@`).
3. `gitleaks` sur 16 commits — aucun leak.

Enseignement : un outil de détection produit des faux positifs, et c'est l'humain qui
tranche. Un scanner silencieux sur un projet réel est plus suspect qu'un scanner
bavard.

Activation de `secret-scanning` et `secret-scanning-push-protection` : l'audit valide
le passé, ces options protègent l'avenir en refusant tout push contenant un secret.

### Ce qui a été mis en place

| Élément | Détail |
|---|---|
| CI frontend | lint + build, cache npm, `timeout-minutes`, `permissions: contents: read` |
| CI backend | `node --check` sur tous les `.js`, sans installation de dépendances |
| Concurrency | annulation des runs obsolètes sur PR, jamais sur `main` |
| Visibilité | dépôt public, historique audité |
| Protection `main` | ruleset `protect-main` : PR obligatoire, 2 checks requis, ni force-push ni suppression, aucun bypass |
| Outillage | GitHub CLI (`gh`) — cycle complet en terminal |

### Écarts constatés, non encore traités

- `DEPLOIEMENT.md` décrit une architecture qui n'existe plus : `api.mymifa.com`
  n'est pas attaché (l'API répond sur `mymifa.vercel.app`), l'apex `mymifa.com`
  n'est rattaché à aucun projet, et les noms de projets Vercel diffèrent de ceux
  documentés.
- Un avertissement ESLint non bloquant (`<img>` au lieu de `next/image` dans
  `PhotoFamille.tsx`) : politique à définir sur les warnings.
- Aucun linter ni test sur le backend au-delà de la syntaxe.
- Les workflows eux-mêmes ne sont pas vérifiés (`actionlint`).

### Suite

1. Tests unitaires sur les fonctions pures du backend (`detecterStatut`,
   `expediteurIgnore`) — les plus critiques et les plus faciles à couvrir.
2. `actionlint` dans la CI.
3. Docker.
4. AWS + Terraform.

---

## 2026-08-13 (suite) — Tests unitaires et durcissement de la CI

### Pourquoi ces fonctions en premier

`services/detection.js` classe les emails de recruteurs par expressions
régulières. Ce type de code échoue **silencieusement** : un motif trop permissif
produit un mauvais statut sans exception ni log. On ne s'en aperçoit qu'en
constatant l'incohérence, des semaines plus tard.

Ses fonctions sont pures — entrée texte, sortie valeur, aucune base de données,
aucun réseau. Ce sont donc les moins chères à tester et les plus rentables à
couvrir. Rapport valeur/effort maximal.

### Choix de l'outil : `node:test`

Trois candidats évalués : `node:test` (intégré à Node), Vitest, Jest.

Retenu : `node:test`. Le `package.json` du backend n'avait qu'une seule
devDependency ; ajouter des dizaines de paquets transitifs pour tester deux
fonctions pures aurait été disproportionné. La syntaxe (`describe`, `test`,
assertions) est proche de Jest, le transfert de compétence est direct.

### Un bug trouvé par les tests

Un test sur 24 a échoué au premier lancement.

    Texte    : "we decided to invite you to an interview next week."
    Attendu  : entretien
    Obtenu   : refuse

Cause : le motif `/we (have )?(decided|regret) (not )?to/i` rendait `not`
optionnel. Toute phrase contenant « we decided to » était donc classée refus,
y compris une invitation à un entretien ou une offre.

Le motif mélangeait par ailleurs deux verbes au comportement différent :
« we regret to » est un refus en soi, « we decided to » ne l'est que suivi de
« not ». Les traiter ensemble était l'erreur de conception.

Correction — un motif par verbe :

    /we (have )?decided not to/i     (« not » obligatoire)
    /we regret to/i                  (« not » sans objet)

Un test de non-régression verrouille le comportement, avec un commentaire
expliquant pourquoi `not` doit rester obligatoire — sans quoi quelqu'un
remettra le `?` un jour « pour attraper plus de cas ».

**Enseignement** : `node --check` validait ce fichier sans réserve. La syntaxe
était parfaite, la sémantique fausse. Vérifier la forme ne dit rien du
comportement.

**Enseignement de méthode** : face à l'échec, le premier réflexe a été de
supposer que la phrase de test était mal écrite. C'est le réflexe le plus
dangereux du débogage — quand un test échoue, l'hypothèse par défaut n'est
jamais « les données d'entrée sont mauvaises ». La question à se poser était :
un recruteur peut-il écrire cette phrase ? Oui, évidemment. Donc le code avait
tort.

### Renommer un status check requis sans bloquer le dépôt

Le job backend passait de `Backend — vérification syntaxique` à
`Backend — syntaxe & tests`. Or ce nom est le **contexte exigé par le ruleset**.
Merger le renommage sans précaution aurait laissé le ruleset attendre
indéfiniment un check disparu — toutes les PR bloquées.

Séquence appliquée :
1. Mise à jour du ruleset **avant** le merge (un contexte n'a pas besoin
   d'exister pour être déclaré). Toutes les PR deviennent temporairement
   bloquées.
2. La PR portant le renommage produit le nouveau contexte, donc se débloque
   elle-même.
3. Merge, et l'ancien contexte devient caduc.

### Ce qui a été mis en place

| Élément | Détail |
|---|---|
| Tests | 25 tests `node:test` sur `detecterStatut` et `expediteurIgnore` |
| Script | `"test": "node --test"` dans `backend/package.json` |
| CI backend | `node --check`, puis `npm ci`, puis `npm test` |
| Ordre des étapes | syntaxe avant installation : un fichier cassé fait échouer le job en quelques secondes plutôt qu'après `npm ci` |
| Ruleset | contexte mis à jour vers `Backend — syntaxe & tests` |

Durée mesurée du job backend après ajout des tests : 13 s (estimation initiale :
25-35 s). `npm ci` sur un backend à une seule devDependency est plus rapide que
prévu, et le cache npm agit dès le premier run.

### Incidents de manipulation Git

Deux fois dans la session, une modification non committée a suivi un changement
de branche. Le répertoire de travail n'appartient à aucune branche : il est
partagé. Le seul moment sûr pour changer de branche est quand `git status` est
propre.

Un `git diff` affichant deux lignes identiques a révélé un fichier pourtant
modifié : seul le saut de ligne final manquait. Git compare des octets, pas des
lignes telles que l'œil les perçoit. `git diff --check` signale ce type de bruit.

### Suite

1. `actionlint` dans la CI — vérifier les workflows eux-mêmes.
2. Politique sur les warnings ESLint (`<img>` dans `PhotoFamille.tsx`).
3. Corriger `DEPLOIEMENT.md`, qui ne décrit plus l'architecture réelle.
4. Docker — backend uniquement : le frontend reste sur Vercel, le containeriser
   serait un exercice sans destination.

---

## 2026-08-13 (suite) — Conteneurisation du backend

### Pourquoi Docker, et pourquoi le backend seulement

L'environnement d'exécution du backend n'existait sous forme reproductible nulle
part : Node 24 sur la machine locale, Node 20 sur le runner CI, une troisième
version chez Vercel. Trois reconstitutions différentes du même besoin.

Une image fige cet ensemble dans un artefact unique, identique sur un portable,
un runner et un serveur AWS. La promesse n'est pas « ça isole », c'est
« ça reproduit ».

Le frontend est exclu : il tourne sur Vercel, qui gère build et exécution. Le
containeriser produirait une image que rien ne déploierait. Le backend, lui, a
une cible réelle — c'est lui qui partira sur AWS, et ECS ne sait déployer que
des conteneurs.

### Le cache de build gouverne l'ordre des instructions

Une image est un empilement de couches. Docker réutilise une couche si
l'instruction et tout ce qui la précède sont inchangés. Dès qu'une couche
change, toutes les suivantes sont reconstruites.

D'où l'ordre : `package.json` + lockfile → `npm ci` → le reste du code. Les
dépendances changent rarement, le code plusieurs fois par jour. L'inverse
réinstallerait tout l'arbre npm à chaque modification d'une ligne.

C'est la même logique que le `cache-dependency-path` de la CI.

### `.dockerignore` : la mesure

Premier build sans `.dockerignore` :

| | Sans | Avec |
|---|---|---|
| Contexte transféré | 35,99 Mo | 3,75 ko |
| Durée du build | 26,2 s | 12 s |

Le contexte de build est l'ensemble des fichiers envoyés au démon avant que la
construction commence — tout le dossier, que le Dockerfile s'en serve ou non.

Sans filtre, `COPY . .` embarquait le `node_modules` de la machine locale
(macOS, Node 24) et **écrasait** celui que `npm ci --omit=dev` venait
d'installer pour Linux. Vérifié :

    docker run --rm mymifa-api:dev ls node_modules | grep nodemon
    nodemon

Une devDependency explicitement exclue à l'installation se retrouvait dans
l'image. Le `--omit=dev` ne servait à rien.

**Risque de sécurité associé** : un `.env` local, invisible pour Git parce
qu'ignoré, serait copié dans l'image sans avertissement — et une image se
pousse dans un registre. Ce vecteur ne déclenche aucune des protections mises
en place côté Git (secret scanning, push protection), puisque le fichier ne
passe jamais par Git.

### Répartition du poids de l'image

`docker history` sur une image de 379 Mo :

| Couche | Poids |
|---|---|
| Debian bookworm (base) | 85,3 Mo |
| Installation de Node | 126 Mo |
| `npm ci --omit=dev` | 74,7 Mo |
| **Code applicatif** | **287 ko** |

Le code représente 0,08 % de l'image. Réduire le code n'apporterait rien ;
changer d'image de base apporterait tout. Alpine remplacerait les 85 Mo de
Debian par environ 8 Mo. À évaluer par la mesure, en vérifiant qu'aucune
dépendance ne casse sur `musl` au lieu de `glibc`.

### Utilisateur non privilégié

Par défaut, le processus tourne en `root`. Deux raisons de ne pas s'en
contenter : le `root` du conteneur est le même UID 0 que celui de l'hôte, donc
une évasion de conteneur donne les pleins pouvoirs sur la machine ; et à
l'intérieur même du conteneur, une faille d'exécution de code devient une
compromission complète plutôt qu'un accès limité.

L'image officielle `node` fournit déjà un utilisateur `node` (UID 1000). Points
d'attention : `USER` s'applique à toutes les instructions suivantes, il doit
donc venir **après** `npm ci` qui a besoin d'écrire dans `/app` ; et `/app`
créé par `WORKDIR` appartient à root, d'où le `chown` et les
`COPY --chown=node:node`.

Vérifié : `docker run --rm mymifa-api:dev id` → `uid=1000(node)`.

Même principe que `permissions: contents: read` sur le GITHUB_TOKEN, et que les
futurs rôles IAM : on n'accorde que ce qui est nécessaire.

### Ce que Docker a révélé sur l'application

**Effets de bord au chargement des modules.** Le conteneur échouait sur
`bucket is required` avant même d'atteindre les vérifications de configuration
d'`index.js`. La trace montrait `Module._compile` → `require` :
`services/s3.js` construit le client S3 et lit `AWS_S3_BUCKET_NAME` à
l'import, pas à l'usage.

Conséquences : une variable manquante fait planter l'application entière plutôt
que la seule fonctionnalité concernée, et tout module important `s3.js` devient
intestable sans configuration AWS. C'est d'ailleurs pourquoi la suite de tests
ne couvre que `detection.js`, qui n'a aucun effet de bord.

**`NODE_ENV` gouverne trois comportements.** `EN_PRODUCTION` est calculé depuis
`NODE_ENV === 'production' || VERCEL === '1'`, et conditionne l'arrêt sur
configuration incomplète, la vérification CORS, et la tolérance aux origines
locales. Sans lui, le conteneur démarrait en mode dégradé avec une politique
CORS plus permissive — pas ce qu'on veut envoyer sur AWS. D'où le
`ENV NODE_ENV=production` dans le Dockerfile : ce n'est pas un secret, c'est un
paramètre de comportement, et sa présence dans une couche ne pose aucun
problème.

**Échéance Node 22.** Le SDK AWS avertit que les versions publiées après la
première semaine de janvier 2027 exigeront Node >= 22. Node 20 est en
maintenance, Node 22 est l'LTS active. La montée de version devra bouger
ensemble sur l'image, la CI et Vercel — sinon on recrée l'écart d'environnements
que Docker est censé supprimer.

**Arrêt non propre.** Trois `Ctrl + C` ont été nécessaires avant que Docker
tue le conteneur de force (`got 3 SIGTERM/SIGINTs, forcefully exiting`).
L'application n'intercepte pas SIGTERM. En production, chaque redéploiement
coupe les connexions en cours. La forme `CMD ["node", "index.js"]` fait bien de
Node le PID 1 et lui transmet le signal — c'est une condition nécessaire, pas
suffisante.

### Vérification de l'image en CI

Un `Dockerfile` qui fonctionne en local ne garantit rien ailleurs — l'inverse
exact de ce que Docker apporte. Troisième job ajouté :

- `hadolint` valide le Dockerfile sans le construire (aucun avertissement
  remonté au premier passage)
- `docker build` vérifie que l'image se construit sur un environnement neuf

Durée mesurée : 18 s, sans cache Docker. L'estimation initiale était de 40 à
60 s. Le cache (`cache-from`/`cache-to` sur le cache GitHub Actions) a donc été
écarté : il n'y a pas de gêne à corriger.

Le contexte `Docker — lint & build` a été ajouté au ruleset **avant** le merge,
selon la même séquence qu'au renommage : la PR qui crée le contexte est celle
qui débloque le dépôt.

### Constat récurrent sur les estimations

Trois fois dans la journée, une estimation de durée ou de consommation s'est
révélée trop pessimistique par un facteur 2 à 5 : les minutes du cron
(2 880 estimées, ~600 réelles), le job backend avec tests (25-35 s estimées,
13 s réelles), le job Docker (40-60 s estimées, 18 s réelles).

La règle qui en découle : mesurer avant d'optimiser. À trois reprises, le
problème anticipé n'existait pas.

### Suite

1. `docker compose` avec PostgreSQL — débloque les tests de démarrage et de
   migrations écartés faute de base.
2. `actionlint` dans la CI.
3. Publier l'image sur GHCR — prérequis du déploiement AWS.
4. Alpine ou build multi-étapes, mesure à l'appui.
5. Arrêt propre sur SIGTERM.
6. Montée vers Node 22 (image + CI + Vercel ensemble).

---

## 2026-08-14 / 16 — Environnement local et reproductibilité du schéma

### Compose : pourquoi un nom de service et pas une IP

Dans un environnement conteneurisé, on adresse les services par leur nom.
Compose crée un réseau privé avec résolution DNS interne : `db:5432` reste
valable quelle que soit l'adresse attribuée au conteneur.

Les deux alternatives sont fautives :
- une **IP** change à chaque démarrage, il faudrait réécrire la configuration ;
- **`localhost`** désigne le conteneur lui-même. Chaque conteneur a sa propre
  pile réseau et sa propre interface loopback — l'API chercherait un PostgreSQL
  à l'intérieur d'elle-même.

C'est le mécanisme qu'utilisent aussi Kubernetes et ECS.

Nuance apprise plus tard : en CI, les étapes s'exécutent **directement sur le
runner**, pas dans un conteneur. Le service publie son port sur la machine, et
on l'atteint par `localhost:5432`. La règle reste cohérente — `localhost`
désigne toujours « la machine où tourne le code ».

### Trois pièges de conteneur rencontrés

**Port déjà alloué.** Un `docker run -p 3000:3000` lancé neuf heures plus tôt
tournait encore. `--rm` ne supprime le conteneur qu'à l'arrêt du processus, et
un conteneur ne dépend pas du shell qui l'a lancé. Réflexe : `docker ps` avant
de se demander pourquoi un port est pris.

**Conteneur non recréé.** Après l'échec sur le port, un second `up` a redémarré
le conteneur existant au lieu de le recréer — Compose réutilise les conteneurs
tant que leur définition n'a pas changé. La configuration réseau ratée est
restée. `docker compose ps` le montrait : `3000/tcp` sans flèche, contre
`0.0.0.0:5432->5432/tcp` pour la base. Corrigé par `--force-recreate`.

**Arrêt brutal confirmé.** `api-1 exited with code 137` (128 + 9 = SIGKILL)
contre `db-1 exited with code 0`. PostgreSQL intercepte SIGTERM et s'arrête
proprement ; l'application ne l'intercepte pas et se fait tuer. Comparaison
directe entre un service qui se comporte bien et un qui non.

### SSL codé en dur

`config/db.js` forçait `ssl: { rejectUnauthorized: false }` quelle que soit la
chaîne de connexion. Neon l'exige ; un PostgreSQL local n'a pas de certificat
et refuse — `The server does not support SSL connections`.

Activé désormais uniquement si `DATABASE_URL` contient `sslmode=require`.
Vérifié côté Vercel avant merge : la chaîne de production contient bien ce
paramètre, le comportement en production est inchangé.

**Leçon de vérification** : la première lecture de la variable Vercel a
rapporté `channel_binding=require` seulement, ce qui aurait fait renoncer à une
correction correcte. Une lecture partielle est plus dangereuse qu'une absence
de lecture. Demander la structure exacte, pas un jugement.

### Le schéma de production n'était versionné nulle part

`npm run migrate` sur une base vierge échouait immédiatement :
`relation "applications" does not exist`.

Cinq tables sur neuf — `applications`, `companies`, `documents`, `interviews`,
`profil` — avaient été créées à la main dans Neon. Les migrations 001 à 005 ne
documentaient que les évolutions ultérieures.

Conséquence : aucun moyen automatisé de reconstruire l'application ailleurs.
Si la base Neon disparaissait, le schéma était perdu. Point unique de
défaillance, invisible jusqu'à ce qu'on tente une reconstruction.

### Neuf itérations pour extraire une baseline

| Obstacle | Cause |
|---|---|
| `pg_dump` refuse | Neon tourne sur PostgreSQL 18.4, le conteneur local sur 16.13. `pg_dump` refuse un serveur plus récent que lui — il ne saurait pas exprimer les objets d'une version supérieure. |
| PostgreSQL 18 ne démarre pas | Depuis la 18, les images officielles rangent les données dans un sous-dossier nommé par version majeure. Il faut monter `/var/lib/postgresql`, pas `/data`. |
| `syntax error at or near "\"` | `pg_dump` produit des méta-commandes `psql` (`\restrict`) que le driver `pg` ne connaît pas. |
| `function update_modified_column() does not exist` | Deux fonctions trigger au corps identique, une seule extraite. |
| `relation "public.contacts" does not exist` | Dépendance croisée : le dump partiel de cinq tables contenait une clé étrangère vers une table créée par une migration ultérieure. |
| `syntax error at end of input`, puis `at or near "ADD"` | Éditions `sed` par numéro de ligne, puis par motif : la suppression par motif s'applique **partout** où le motif apparaît. Trois occurrences supprimées au lieu d'une, laissant des `ADD CONSTRAINT` orphelins. |
| `relation "schema_migrations" does not exist` | `SELECT pg_catalog.set_config('search_path', '', false)` du dump vidait le `search_path`, et l'effet persistait au-delà du fichier. La table existait, PostgreSQL n'avait plus où la chercher. |

**Enseignement sur `sed`** : l'édition par numéro de ligne est fragile — les
numéros changent à chaque modification. L'édition par motif est plus sûre, mais
il faut compter les occurrences avant de supprimer.

### La baseline, et l'erreur de conception associée

`000_schema_initial.sql` n'est pas une étape historique : c'est une
reconstitution de l'état actuel, extraite par `pg_dump`. Elle contient donc
déjà l'effet des migrations 001 à 005 — dont 003, qui convertit `questions_ia`
de TEXT vers JSONB sur une colonne déjà convertie.

Elle inscrit donc elle-même 001 à 005 dans `schema_migrations`. C'est la
pratique standard du *squash* / *baseline* quand on introduit un schéma de
référence dans un projet dont les migrations sont déjà en production.

Cela a imposé une correction de `migrate.js` : le registre était lu **une seule
fois avant la boucle**, donc les inscriptions faites par la baseline étaient
invisibles et les migrations rejouées. Il est désormais relu à chaque
itération, avec `ON CONFLICT (nom) DO NOTHING` sur l'insertion.

**L'erreur** : la baseline a d'abord été construite avec cinq tables seulement,
pour éviter la duplication avec les migrations qui créent les quatre autres.
Puis ces migrations ont été marquées appliquées. Résultat : `contacts`,
`formations`, `relances` et `emails_traites` n'étaient créées nulle part.

Deux décisions cohérentes prises séparément, incohérentes ensemble.

Et le script affichait `Migrations terminées.` — sur une base à laquelle il
manquait quatre tables. Seul `\dt` l'a révélé.

**Un message de succès n'est pas une preuve de succès.** C'est la leçon
principale de la session, et elle a directement dicté la forme du job CI.

### Automatisation en CI

Quatrième job : service PostgreSQL 18-alpine démarré par la clé `services:`,
avec le même healthcheck que `compose.yaml`. Le job applique les migrations sur
une base vierge, puis **compte les tables** plutôt que de se fier au message du
script :

    nb=$(psql ... "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
    test "$nb" -eq 10

26 secondes, vert au premier essai. Le cycle exécuté neuf fois à la main est
désormais automatique.

### Une protection décorative pendant plusieurs heures

En ajoutant le contexte `Migrations` au ruleset, la relecture a montré **deux**
contextes au lieu de quatre : `Docker — lint & build`, ajouté plusieurs heures
plus tôt, n'y avait jamais été enregistré.

La commande `PUT` avait échoué ou n'avait pas été exécutée, et le pager avalait
la réponse. Aucun signal. Le dépôt a fonctionné avec un check Docker cru
bloquant et qui ne l'était pas.

Trois enseignements :

1. **Le pager masque les sorties.** Troisième occurrence de la journée après
   `gh repo view` et `git diff`. `GH_PAGER=cat` sur toute commande d'écriture,
   et `git config --global core.pager 'less -FRX'`.
2. **`PUT` est destructif** : il remplace intégralement la ressource. Une
   erreur dans le document envoyé ne produit pas une erreur, elle produit un
   état différent de celui qu'on croit. Même risque qu'un `terraform apply`
   sur un fichier incomplet.
3. **Une écriture réussie ne se déduit pas de l'absence d'erreur.** On relit
   l'état, systématiquement.

### État de la chaîne

| Check | Durée | Bloquant |
|---|---|---|
| Frontend — lint & build | ~33 s | oui |
| Backend — syntaxe & tests | ~12 s | oui |
| Docker — lint & build | ~16 s | oui |
| Migrations — reconstruction depuis zéro | ~26 s | oui |

### Suite

1. `actionlint` — quatrième rappel : une faute d'indentation dans `ci.yml`
   (un espace au lieu de deux devant un job) aurait cassé tout le pipeline
   silencieusement. Rien ne vérifie les workflows.
2. Publier l'image sur GHCR — prérequis du déploiement AWS.
3. Test de démarrage de l'application contre la base migrée.
4. Arrêt propre sur SIGTERM.
5. Montée vers Node 22 (image + CI + Vercel ensemble).
6. `DEPLOIEMENT.md`, toujours divergent de l'architecture réelle.