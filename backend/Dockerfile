# Image de base : Debian allégé avec Node 24 préinstallé.
# Alignée sur Vercel, qui exécute l'API en Node 24 : valider sur une autre
# version reviendrait à tester ce qui ne tourne pas en production.
FROM node:24-slim

# Répertoire de travail à l'intérieur du conteneur.
# Créé automatiquement s'il n'existe pas.
WORKDIR /app

# /app est créé par root ; on en donne la propriété à l'utilisateur node
# pour que l'application puisse lire et écrire ses propres fichiers.
RUN chown node:node /app

# Active le mode production de l'application : garde-fous de configuration
# stricts et politique CORS restrictive. Ce n'est pas un secret, sa présence
# dans une couche d'image ne pose aucun problème.
ENV NODE_ENV=production

# Les fichiers de dépendances SEULS, avant le code source.
# Cette couche ne s'invalide que si les dépendances changent — rarement.
COPY --chown=node:node package.json package-lock.json ./

# `npm ci` installe exactement ce que décrit le lockfile, sans le modifier.
# `--omit=dev` exclut les devDependencies : une image de production n'a pas
# besoin de nodemon.
RUN npm ci --omit=dev

# Le code source vient APRÈS l'installation.
# Une modification de code n'invalide que cette couche et les suivantes.
COPY --chown=node:node . .

# Bascule vers l'utilisateur non privilégié fourni par l'image officielle node.
# Placé APRÈS les étapes de construction : npm ci a besoin d'écrire dans /app,
# créé par root. Tout ce qui suit s'exécute sans droits d'administration.
USER node

# Documentation du port utilisé. N'ouvre rien par lui-même — c'est une
# indication pour l'humain et pour certains outils d'orchestration.
EXPOSE 3000

# Commande exécutée au démarrage du conteneur.
# Forme "exec" (tableau JSON) : le processus Node devient PID 1 et reçoit
# directement les signaux système. L'application ne les intercepte pas encore,
# donc l'arrêt reste brutal — à traiter séparément.
CMD ["node", "index.js"]
