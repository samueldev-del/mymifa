import Link from 'next/link';

interface PanneauProps {
  titre: string;
  aide?: string;
  /** Lien « tout voir » affiché à droite du titre. */
  lien?: { href: string; label: string };
  /** Contrôle libre à droite du titre, alternative au lien. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Bloc de contenu du tableau de bord, avec en-tête et cadre cohérents. */
export default function Panneau({ titre, aide, lien, action, children, className = '' }: PanneauProps) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-littoral-light/30 bg-white p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-littoral-dark">{titre}</h2>
          {aide && <p className="mt-0.5 text-xs text-littoral-dark/50">{aide}</p>}
        </div>
        {action}
        {lien && (
          <Link
            href={lien.href}
            className="shrink-0 text-sm font-medium text-laterite transition hover:text-laterite-hover"
          >
            {lien.label} →
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}
