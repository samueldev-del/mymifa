'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { getToken, redirectToLogin } from '@/lib/auth';
import { ROUTES_PUBLIQUES } from '@/lib/routes';

/**
 * État à trois valeurs. « inconnu » est indispensable : au premier rendu
 * hydraté, React utilise l'instantané serveur. Un simple booléen vaudrait donc
 * `false` à ce moment-là et déclencherait une redirection alors que le jeton
 * existe — l'utilisateur serait déconnecté à chaque rechargement.
 */
type EtatSession = 'inconnu' | 'authentifie' | 'anonyme';

/** Se resynchronise si un autre onglet se connecte ou se déconnecte. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

const snapshotClient = (): EtatSession => (getToken() ? 'authentifie' : 'anonyme');
const snapshotServeur = (): EtatSession => 'inconnu';

/**
 * Empêche l'affichage des pages protégées tant qu'aucun jeton n'est présent.
 *
 * C'est un garde d'expérience utilisateur, pas la barrière de sécurité : la
 * protection réelle est côté backend, qui rejette toute requête sans jeton
 * valide (middlewares/auth.js).
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Impressum et Datenschutzerklärung doivent rester atteignables sans
  // connexion : une mention légale derrière un mot de passe ne vaut rien.
  const isPublic = ROUTES_PUBLIQUES.includes(pathname);

  const session = useSyncExternalStore(subscribe, snapshotClient, snapshotServeur);

  useEffect(() => {
    if (!isPublic && session === 'anonyme') {
      redirectToLogin();
    }
  }, [isPublic, session]);

  if (!isPublic && session !== 'authentifie') {
    return <div className="min-h-screen bg-coton" aria-hidden />;
  }

  return <>{children}</>;
}
