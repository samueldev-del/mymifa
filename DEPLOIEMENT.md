# Mise en production sur Vercel

Deux projets Vercel sur ce même dépôt :

| Projet | Racine | Domaine | Rôle |
|---|---|---|---|
| `mymifa-frontend` | `frontend` | `mymifa.com` | Interface Next.js (PWA) |
| `mymifa-api` | `backend` | `api.mymifa.com` | API Express |

Ils sont séparés parce qu'ils se déploient et montent en charge indépendamment,
et parce que l'API doit servir un domaine distinct pour que la politique CORS
garde un sens.

`mymifa.com` pointe déjà vers Vercel (enregistrement A `216.198.79.1`, résolu
sur `fra1`/Francfort). Il reste à créer les projets et à réclamer le domaine.

---

## 1. Pousser le dépôt sur GitHub

Vercel se branche sur le dépôt Git ; chaque `git push` déclenche un déploiement.

```bash
gh repo create mymifa --private --source=. --push
```

---

## 2. Projet backend (`api.mymifa.com`)

Sur [vercel.com/new](https://vercel.com/new), importer le dépôt puis :

- **Root Directory** : `backend`
- **Framework Preset** : *Other* (Vercel détecte Express automatiquement)

Aucun fichier de configuration n'est nécessaire : `index.js` exporte
l'application, et Vercel en fait une fonction unique sur Fluid Compute.

### Variables d'environnement

À saisir dans *Settings → Environment Variables*, portée **Production**
(et *Preview* si vous voulez tester les branches) :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | La chaîne Neon, endpoint **`-pooler`** obligatoire |
| `ADMIN_PASSWORD` | Le mot de passe de l'écran de verrouillage |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `EMAIL_WEBHOOK_SECRET` | Le secret partagé du webhook email |
| `ANTHROPIC_API_KEY` | Votre clé API Anthropic |
| `AWS_REGION` | `eu-central-1` |
| `AWS_ACCESS_KEY_ID` | Clé de l'utilisateur IAM `mymifa-api-s3` |
| `AWS_SECRET_ACCESS_KEY` | Secret associé |
| `AWS_S3_BUCKET_NAME` | `mymifa-api-s3` |
| `FRONTEND_ORIGIN` | `https://mymifa.com` |

> `FRONTEND_ORIGIN` et `DATABASE_URL` sont vérifiées au démarrage : sans elles,
> l'application refuse de booter en production plutôt que d'accepter toutes les
> origines en silence.

### Domaine

*Settings → Domains* → ajouter `api.mymifa.com`. Vercel affiche un
enregistrement **CNAME** à créer chez Hostinger (voir §4).

---

## 3. Projet frontend (`mymifa.com`)

Second import du même dépôt :

- **Root Directory** : `frontend`
- **Framework Preset** : Next.js (détecté)

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.mymifa.com/api` |

> Le préfixe `NEXT_PUBLIC_` inscrit la valeur dans le bundle client : elle est
> publique par nature. N'y placez jamais de secret — l'URL de l'API n'en est
> pas un, l'authentification protège les routes.

Domaines à ajouter : `mymifa.com` **et** `www.mymifa.com` (Vercel redirige
automatiquement le second vers le premier).

---

## 4. DNS chez Hostinger

Dans *hPanel → Domaines → mymifa.com → DNS / Nameservers* :

| Type | Nom | Valeur |
|---|---|---|
| A | `@` | `216.198.79.1` *(déjà en place)* |
| CNAME | `www` | *valeur affichée par Vercel* |
| CNAME | `api` | *valeur affichée par Vercel* |

**Ne devinez pas les valeurs CNAME.** Vercel attribue désormais un cible unique
par projet, du type `d1d4fc829fe7bc7c.vercel-dns-017.com` — l'ancienne valeur
générique `cname.vercel-dns.com` ne fonctionne plus. Copiez exactement ce
qu'affiche *Settings → Domains* au moment où vous ajoutez chaque sous-domaine ;
elle diffère entre le projet frontend et le projet API.

Vérifiez de même l'enregistrement A que Vercel propose pour l'apex : `@` est
déjà correct aujourd'hui, mais l'interface fait foi.

La propagation prend de quelques minutes à quelques heures. Les certificats
HTTPS sont émis automatiquement une fois le DNS résolu.

---

## 5. Migrations de base de données

Neon est une base unique et partagée : les migrations se lancent **depuis votre
poste**, pas depuis Vercel.

```bash
cd backend && npm run migrate
```

Le script est idempotent et tient un registre dans `schema_migrations` : le
relancer ne réapplique rien.

---

## 6. Vérification après déploiement

```bash
curl -s https://api.mymifa.com/api/health
```

Attendu : `{"success":true,"data":{"time":"…"},"message":"API connectée à Neon"}`

Puis contrôler que la protection est active :

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.mymifa.com/api/applications
```

Attendu : `401`. Un `200` signifierait que l'authentification ne s'applique pas.

Enfin, ouvrir `https://mymifa.com`, se connecter, et installer la PWA
(« Installer l'application » sur desktop, « Sur l'écran d'accueil » sur iOS).

---

## Points de vigilance

**Le webhook email** doit être reconfiguré chez votre fournisseur vers
`https://api.mymifa.com/api/emails/webhook`, avec l'en-tête
`x-webhook-secret` contenant `EMAIL_WEBHOOK_SECRET`.

**Le bucket S3 reste privé.** L'application ne sert que des URLs signées
valables 15 minutes. Ne réactivez pas l'accès public : les CV contiennent des
données personnelles.

**Changer `ADMIN_PASSWORD` déconnecte toutes les sessions** si
`SESSION_SECRET` n'est pas défini séparément, puisque le mot de passe sert
alors de clé de signature. Définir `SESSION_SECRET` évite cet effet de bord.

**Les appels à Claude sont longs** (l'analyse ATS et la préparation d'entretien
peuvent dépasser 30 secondes). La limite par défaut des fonctions Vercel est
largement suffisante, mais si vous voyez des délais dépassés, augmentez
`maxDuration` dans les réglages du projet.

**Coût.** Neon, S3 et Vercel ont des paliers gratuits qui couvrent un usage
personnel. La dépense réelle vient de l'API Anthropic, facturée à l'usage :
une analyse ATS ou une préparation d'entretien coûte quelques centimes.
