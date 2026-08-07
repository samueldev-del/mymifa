'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import de, { type Dictionary } from './de';
import en from './en';
import fr from './fr';

export const LOCALES = ['de', 'en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

/** L'allemand est la langue principale : c'est le marché visé. */
export const LOCALE_DEFAUT: Locale = 'de';

const DICTIONNAIRES: Record<Locale, Dictionary> = { de, en, fr };
const STORAGE_KEY = 'mymifa_locale';

/** Étiquettes des locales pour le sélecteur, dans leur propre langue. */
export const LOCALE_LABELS: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
};

const FORMAT_LOCALES: Record<Locale, string> = {
  de: 'de-DE',
  en: 'en-GB',
  fr: 'fr-FR',
};

function estLocale(valeur: string | null | undefined): valeur is Locale {
  return !!valeur && (LOCALES as readonly string[]).includes(valeur);
}

/**
 * Petit store externe plutôt qu'un état React : la locale vit dans
 * localStorage, hors de React. useSyncExternalStore permet de la lire sans
 * dériver l'état dans un effet, et gère l'instantané serveur pour l'hydratation.
 */
const store = (() => {
  let locale: Locale | null = null;
  const abonnes = new Set<() => void>();

  const lire = (): Locale => {
    if (locale) return locale;

    const stockee = window.localStorage.getItem(STORAGE_KEY);
    if (estLocale(stockee)) {
      locale = stockee;
    } else {
      const navigateur = navigator.language.slice(0, 2);
      locale = estLocale(navigateur) ? navigateur : LOCALE_DEFAUT;
    }

    return locale;
  };

  return {
    // getSnapshot doit renvoyer une valeur stable : la mise en cache dans
    // `locale` évite une boucle de rendu infinie.
    getSnapshot: lire,
    getServerSnapshot: (): Locale => LOCALE_DEFAUT,
    subscribe(callback: () => void) {
      abonnes.add(callback);
      // Un autre onglet a changé de langue.
      const surStockage = (event: StorageEvent) => {
        if (event.key !== STORAGE_KEY || !estLocale(event.newValue)) return;
        locale = event.newValue;
        abonnes.forEach((abonne) => abonne());
      };
      window.addEventListener('storage', surStockage);

      return () => {
        abonnes.delete(callback);
        window.removeEventListener('storage', surStockage);
      };
    },
    definir(suivante: Locale) {
      locale = suivante;
      window.localStorage.setItem(STORAGE_KEY, suivante);
      abonnes.forEach((abonne) => abonne());
    },
  };
})();

/** Résout une clé pointée (`nav.dashboard`) dans le dictionnaire. */
function resoudre(dictionnaire: Dictionary, cle: string): string {
  const valeur = cle.split('.').reduce<unknown>((noeud, segment) => {
    if (noeud && typeof noeud === 'object' && segment in noeud) {
      return (noeud as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dictionnaire);

  // Une clé absente doit se voir immédiatement plutôt que d'afficher du vide.
  return typeof valeur === 'string' ? valeur : cle;
}

type Traduire = (cle: string, variables?: Record<string, string | number>) => string;

interface ContexteLangue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Traduire;
  /** Locale au format BCP 47, pour toLocaleDateString et consorts. */
  formatLocale: string;
}

/**
 * Fournisseur conservé pour poser `<html lang>`. La lecture passe par le store
 * externe : aucun contexte React n'est nécessaire, et useLangue fonctionne donc
 * même hors du fournisseur.
 */
export function LangueProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <>{children}</>;
}

export function useLangue(): ContexteLangue {
  const locale = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const setLocale = useCallback((suivante: Locale) => store.definir(suivante), []);

  return useMemo<ContexteLangue>(() => {
    const dictionnaire = DICTIONNAIRES[locale];

    const t: Traduire = (cle, variables) => {
      const modele = resoudre(dictionnaire, cle);
      if (!variables) return modele;

      return Object.entries(variables).reduce(
        (texte, [nom, valeur]) => texte.replaceAll(`{${nom}}`, String(valeur)),
        modele
      );
    };

    return { locale, setLocale, t, formatLocale: FORMAT_LOCALES[locale] };
  }, [locale, setLocale]);
}

/** Raccourci quand seule la fonction de traduction est nécessaire. */
export function useT(): Traduire {
  return useLangue().t;
}
