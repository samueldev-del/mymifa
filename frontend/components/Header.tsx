'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { redirectToLogin } from '@/lib/auth';

const NAV_LINKS = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/profile', label: 'Profil' },
] as const;

export default function Header() {
  const pathname = usePathname();

  // Pas de navigation sur l'écran de verrouillage.
  if (pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-40 border-b border-littoral-light/30 bg-coton/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-laterite font-bold text-white">
            M
          </span>
          <span className="text-lg font-bold tracking-tight text-littoral-dark">Mymifa</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Navigation principale" className="flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    isActive
                      ? 'bg-littoral-light/25 text-littoral-dark'
                      : 'text-littoral-dark/60 hover:bg-coton-dark hover:text-littoral-dark'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={redirectToLogin}
            title="Se déconnecter"
            className="ml-1 rounded-xl border border-littoral-light/40 px-3 py-2 text-sm font-medium text-littoral-dark/70 transition-colors hover:border-laterite/40 hover:bg-laterite/10 hover:text-laterite"
          >
            <span className="hidden sm:inline">Déconnexion</span>
            <span aria-hidden className="sm:hidden">
              ⏻
            </span>
            <span className="sr-only sm:hidden">Se déconnecter</span>
          </button>
        </div>
      </div>
    </header>
  );
}
