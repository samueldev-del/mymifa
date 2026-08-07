interface ScoreRingProps {
  /** Score 0-100. */
  score: number;
  size?: number;
  /** Libellé affiché sous l'anneau. Traduit par l'appelant. */
  label?: string;
}

function couleur(score: number): string {
  if (score >= 75) return 'var(--color-emerald-500, #10b981)';
  if (score >= 50) return 'var(--color-amber-500, #f59e0b)';
  return 'var(--color-laterite)';
}

/** Anneau de progression : lit le score d'un coup d'œil. */
export default function ScoreRing({ score, size = 96, label }: ScoreRingProps) {
  const borne = Math.max(0, Math.min(100, score));
  const rayon = size / 2 - 4;
  const circonference = 2 * Math.PI * rayon;
  const rempli = (borne / 100) * circonference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={rayon}
            fill="none"
            strokeWidth={size > 60 ? 6 : 4}
            className="stroke-littoral-light/25"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={rayon}
            fill="none"
            strokeWidth={size > 60 ? 6 : 4}
            strokeLinecap="round"
            stroke={couleur(borne)}
            strokeDasharray={`${rempli} ${circonference}`}
            style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-bold text-littoral-dark"
            style={{ fontSize: size > 60 ? size / 3.6 : size / 2.9 }}
          >
            {borne}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs font-medium uppercase tracking-wide text-littoral-dark/60">
          {label}
        </span>
      )}
    </div>
  );
}
