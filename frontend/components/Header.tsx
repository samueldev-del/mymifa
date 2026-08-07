'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LangueSwitch from './LangueSwitch';
import { redirectToLogin } from '@/lib/auth';
import { useT } from '@/i18n';

const NAV_LINKS = [
  { href: '/', cle: 'nav.dashboard' },
  { href: '/entretiens', cle: 'nav.entretiens' },
  { href: '/formations', cle: 'nav.formations' },
  { href: '/contacts', cle: 'nav.contacts' },
  { href: '/profile', cle: 'nav.profil' },
] as const;

export default function Header() {
  const pathname = usePathname();
  const t = useT();
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Pas de navigation sur l'écran de verrouillage.
  if (pathname === '/login') return null;

  const estActif = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const lienClasse = (actif: boolean) =>
    `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
      actif
        ? 'bg-littoral-light/25 text-littoral-dark'
        : 'text-littoral-dark/60 hover:bg-coton-dark hover:text-littoral-dark'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-littoral-light/30 bg-coton/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-laterite font-bold text-white">
            M
          </span>
          <span className="text-lg font-bold tracking-tight text-littoral-dark">Mymifa</span>
        </Link>

        <nav aria-label={t('nav.menu')} className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map(({ href, cle }) => (
            <Link
              key={href}
              href={href}
              aria-current={estActif(href) ? 'page' : undefined}
              className={lienClasse(estActif(href))}
            >
              {t(cle)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LangueSwitch />

          <button
            type="button"
            onClick={redirectToLogin}
            title={t('nav.deconnexion')}
            className="hidden rounded-xl border border-littoral-light/40 px-3 py-2 text-sm font-medium text-littoral-dark/70 transition-colors hover:border-laterite/40 hover:bg-laterite/10 hover:text-laterite sm:block"
          >
            {t('nav.deconnexion')}
          </button>

          <button
            type="button"
            onClick={() => setMenuOuvert((ouvert) => !ouvert)}
            aria-expanded={menuOuvert}
            aria-label={t('nav.menu')}
            className="rounded-xl border border-littoral-light/40 px-3 py-2 text-littoral-dark/70 transition-colors hover:bg-coton-dark lg:hidden"
          >
            <span aria-hidden>{menuOuvert ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {menuOuvert && (
        <nav
          aria-label={t('nav.menu')}
          className="border-t border-littoral-light/30 bg-coton px-4 py-2 lg:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {NAV_LINKS.map(({ href, cle }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOuvert(false)}
                aria-current={estActif(href) ? 'page' : undefined}
                className={lienClasse(estActif(href))}
              >
                {t(cle)}
              </Link>
            ))}
            <button
              type="button"
              onClick={redirectToLogin}
              className="mt-1 rounded-xl px-3 py-2 text-left text-sm font-medium text-laterite transition-colors hover:bg-laterite/10 sm:hidden"
            >
              {t('nav.deconnexion')}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
