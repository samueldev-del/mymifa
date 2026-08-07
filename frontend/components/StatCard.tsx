interface StatCardProps {
  label: string;
  valeur: string | number;
  aide?: string;
  /** Teinte d'accent de la carte. */
  ton?: 'neutre' | 'accent' | 'succes' | 'alerte';
  suffixe?: string;
}

const TONS: Record<NonNullable<StatCardProps['ton']>, string> = {
  neutre: 'border-littoral-light/30 bg-white',
  accent: 'border-laterite/25 bg-laterite/5',
  succes: 'border-emerald-200 bg-emerald-50',
  alerte: 'border-amber-200 bg-amber-50',
};

/** Indicateur compact du tableau de bord. */
export default function StatCard({ label, valeur, aide, ton = 'neutre', suffixe }: StatCardProps) {
  return (
    <div className={`rounded-2xl border p-4 ${TONS[ton]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-littoral-dark/55">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span className="text-3xl font-bold leading-none text-littoral-dark">{valeur}</span>
        {suffixe && <span className="text-lg font-semibold text-littoral-dark/50">{suffixe}</span>}
      </p>
      {aide && <p className="mt-1 text-xs text-littoral-dark/50">{aide}</p>}
    </div>
  );
}
