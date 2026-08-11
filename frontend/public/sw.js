/**
 * Service worker minimal.
 *
 * Objectif : rendre l'application installable et lançable hors ligne, pas
 * mettre en cache les données. Les réponses de l'API ne sont jamais mises en
 * cache — un tableau de bord périmé serait pire qu'un message d'erreur, et les
 * URLs S3 signées expirent au bout de 15 minutes.
 */
const CACHE = 'mymifa-coquille-v2';

const COQUILLE = ['/', '/offline.html', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

const HOTE = self.location.hostname;

/**
 * Machine de développement : localhost ou une adresse privée du réseau local
 * (téléphone qui atteint `next dev`).
 */
const EST_DEV =
    HOTE === 'localhost' ||
    HOTE === '127.0.0.1' ||
    /^192\.168\./.test(HOTE) ||
    /^10\./.test(HOTE) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(HOTE);

if (EST_DEV) {
    /*
     * En développement, ce service worker est nuisible : le handler `fetch`
     * ci-dessous sert les statiques cache-first, or Turbopack réutilise les
     * mêmes noms de chunks d'une compilation à l'autre. Le navigateur reste
     * donc collé à du JavaScript périmé, et l'application casse sans erreur.
     *
     * Il se désinstalle de lui-même plutôt que d'attendre un geste manuel :
     * une fois installé, il sert aussi l'ancien code applicatif, lequel ne
     * peut plus le désenregistrer. Le navigateur, lui, revérifie toujours
     * sw.js sans passer par le cache — c'est la seule porte de sortie.
     */
    self.addEventListener('install', () => self.skipWaiting());

    self.addEventListener('activate', (event) => {
        event.waitUntil(
            caches
                .keys()
                .then((cles) => Promise.all(cles.map((cle) => caches.delete(cle))))
                .then(() => self.registration.unregister())
                // Recharger les onglets ouverts : sans cela ils continuent
                // d'afficher la version périmée jusqu'au prochain rechargement.
                .then(() => self.clients.matchAll({ type: 'window' }))
                .then((clients) => clients.forEach((client) => client.navigate(client.url)))
        );
    });
} else {
    self.addEventListener('install', (event) => {
        event.waitUntil(
            caches
                .open(CACHE)
                // addAll échoue en bloc si une seule ressource manque : on tolère
                // les absences pour ne pas empêcher l'installation.
                .then((cache) => Promise.allSettled(COQUILLE.map((url) => cache.add(url))))
                .then(() => self.skipWaiting())
        );
    });

    self.addEventListener('activate', (event) => {
        event.waitUntil(
            caches
                .keys()
                .then((cles) => Promise.all(cles.filter((cle) => cle !== CACHE).map((cle) => caches.delete(cle))))
                .then(() => self.clients.claim())
        );
    });

    self.addEventListener('fetch', (event) => {
        const { request } = event;

        if (request.method !== 'GET') return;

        const url = new URL(request.url);

        // Tout ce qui sort de l'origine (API, S3) passe directement au réseau.
        if (url.origin !== self.location.origin) return;

        // Navigations : réseau d'abord, page hors ligne en dernier recours.
        if (request.mode === 'navigate') {
            event.respondWith(
                fetch(request).catch(async () => {
                    const cache = await caches.open(CACHE);
                    return (await cache.match('/offline.html')) || (await cache.match('/')) || Response.error();
                })
            );
            return;
        }

        // Ressources statiques : cache d'abord, puis réseau et mise en cache.
        event.respondWith(
            caches.match(request).then(
                (enCache) =>
                    enCache ||
                    fetch(request).then((reponse) => {
                        if (reponse.ok && reponse.type === 'basic') {
                            const copie = reponse.clone();
                            caches.open(CACHE).then((cache) => cache.put(request, copie));
                        }
                        return reponse;
                    })
            )
        );
    });
}
