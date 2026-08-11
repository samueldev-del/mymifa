import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { EDITEUR, EDITEUR_INCOMPLET } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Impressum — Mymifa',
  // Une page légale n'a aucune raison d'être indexée.
  robots: { index: false, follow: false },
};

/**
 * Impressum au sens du §5 DDG. Rédigé en allemand : c'est la langue qui fait
 * foi vis-à-vis d'une autorité allemande, quelle que soit la langue de l'app.
 */
export default function Impressum() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <Logo className="size-8 rounded-lg" />
        <span className="text-base font-bold tracking-tight text-littoral-dark">Mymifa</span>
      </Link>

      <h1 className="text-2xl font-bold text-littoral-dark">Impressum</h1>

      {EDITEUR_INCOMPLET && (
        <p className="mt-6 rounded-xl border border-laterite/30 bg-laterite/5 px-4 py-3 text-sm text-laterite">
          Diese Angaben sind unvollständig. Vor einer öffentlichen Bereitstellung
          müssen Straße und Ort in <code>frontend/lib/legal.ts</code> ergänzt werden.
        </p>
      )}

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-littoral-dark/50">
        Angaben gemäß §5 DDG
      </h2>
      <address className="mt-3 not-italic leading-relaxed text-littoral-dark">
        {EDITEUR.nom}
        <br />
        {EDITEUR.rue || '—'}
        <br />
        {EDITEUR.codePostalVille || '—'}
        <br />
        {EDITEUR.pays}
      </address>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-littoral-dark/50">
        Kontakt
      </h2>
      <p className="mt-3 leading-relaxed text-littoral-dark">
        E-Mail:{' '}
        <a className="text-laterite underline" href={`mailto:${EDITEUR.email}`}>
          {EDITEUR.email}
        </a>
        {EDITEUR.telephone && (
          <>
            <br />
            Telefon: {EDITEUR.telephone}
          </>
        )}
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-littoral-dark/50">
        Verantwortlich für den Inhalt
      </h2>
      <p className="mt-3 leading-relaxed text-littoral-dark">{EDITEUR.nom}, Anschrift wie oben.</p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-littoral-dark/50">
        Art des Angebots
      </h2>
      <p className="mt-3 leading-relaxed text-littoral-dark">
        Mymifa ist ein privates, passwortgeschütztes Werkzeug zur Verwaltung der
        eigenen Bewerbungen. Es wird weder entgeltlich noch geschäftsmäßig
        Dritten angeboten.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-littoral-dark/50">
        Streitbeilegung
      </h2>
      <p className="mt-3 leading-relaxed text-littoral-dark">
        Zur Teilnahme an einem Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle sind wir nicht verpflichtet und nicht bereit.
      </p>

      <p className="mt-12 text-sm text-littoral-dark/60">
        <Link href="/datenschutz" className="text-laterite underline">
          Datenschutzerklärung
        </Link>
      </p>
    </main>
  );
}
