import type { MetadataRoute } from 'next';

/**
 * Manifeste PWA. La langue par défaut est l'allemand, comme l'interface.
 * L'app s'installe sur l'écran d'accueil et s'ouvre sans barre de navigateur
 * (display: standalone).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mymifa — Bewerbungs-Tracker',
    short_name: 'Mymifa',
    description:
      'Bewerbungen verfolgen, Vorstellungsgespräche vorbereiten und Qualifikationslücken schließen.',
    lang: 'de',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#FBFBF9',
    theme_color: '#B8432C',
    categories: ['productivity', 'business'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Übersicht', url: '/' },
      { name: 'Vorstellungsgespräche', url: '/entretiens' },
      { name: 'Weiterbildung', url: '/formations' },
    ],
  };
}
