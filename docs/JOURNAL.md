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