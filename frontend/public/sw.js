/**
 * Service worker minimal.
 *
 * Objectif : rendre l'application installable et lançable hors ligne, pas
 * mettre en cache les données. Les réponses de l'API ne sont jamais mises en
 * cache — un tableau de bord périmé serait pire qu'un message d'erreur, et les
 * URLs S3 signées expirent au bout de 15 minutes.
 */
const CACHE = 'mymifa-coquille-v1';

const COQUILLE = ['/', '/offline.html', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

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
