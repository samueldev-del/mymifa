'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/i18n';

/** Évènement Chromium non typé par la lib DOM standard. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Enregistre le service worker et expose le bouton d'installation.
 * Rien n'est rendu tant que le navigateur ne propose pas l'installation
 * (déjà installée, ou Safari qui passe par « Sur l'écran d'accueil »).
 */
export default function PwaProvider() {
  const t = useT();
  const [invite, setInvite] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Après le chargement : l'enregistrement ne doit pas concurrencer le rendu.
    const enregistrer = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker non enregistré:', error);
      });
    };

    if (document.readyState === 'complete') enregistrer();
    else window.addEventListener('load', enregistrer, { once: true });
  }, []);

  useEffect(() => {
    const surInvite = (event: Event) => {
      event.preventDefault();
      setInvite(event as BeforeInstallPromptEvent);
    };

    const surInstallation = () => {
      setInvite(null);
      toast.success(t('pwa.installee'));
    };

    window.addEventListener('beforeinstallprompt', surInvite);
    window.addEventListener('appinstalled', surInstallation);

    return () => {
      window.removeEventListener('beforeinstallprompt', surInvite);
      window.removeEventListener('appinstalled', surInstallation);
    };
  }, [t]);

  if (!invite) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await invite.prompt();
        await invite.userChoice;
        setInvite(null);
      }}
      className="fixed bottom-4 right-4 z-30 rounded-xl bg-littoral-dark px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-black"
    >
      {t('pwa.installer')}
    </button>
  );
}
