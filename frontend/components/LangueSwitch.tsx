'use client';

import { LOCALES, LOCALE_LABELS, useLangue } from '@/i18n';

/** Sélecteur de langue compact : DE · EN · FR. */
export default function LangueSwitch() {
  const { locale, setLocale, t } = useLangue();

  return (
    <div
      role="group"
      aria-label={t('langue.choisir')}
      className="flex items-center rounded-xl border border-littoral-light/40 p-0.5"
    >
      {LOCALES.map((code) => {
        const actif = locale === code;

        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={actif}
            title={LOCALE_LABELS[code]}
            className={`rounded-lg px-2 py-1 text-xs font-semibold uppercase transition-colors ${
              actif
                ? 'bg-littoral-dark text-white'
                : 'text-littoral-dark/50 hover:bg-coton-dark hover:text-littoral-dark'
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
