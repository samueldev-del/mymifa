/**
 * La marque Mymifa, en ligne plutôt que via <img> : pas de requête
 * supplémentaire, et le tracé reste net à toutes les densités.
 *
 * Le fond dégradé est porté par CSS, pas par un <linearGradient> : un
 * dégradé SVG exige un `id`, or un id fixe se duplique dès que deux logos
 * coexistent, et `useId` diverge entre le rendu serveur et l'hydratation.
 * Sans id, le composant reste rendable côté serveur.
 *
 * La géométrie est celle de scripts/logo.js, qui produit public/logo.svg et
 * les icônes PWA. Toute retouche doit être reportée là-bas puis regénérée :
 * node scripts/generate-icons.js
 */
export default function Logo({ className = 'size-9 rounded-xl' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      className={className}
      style={{ background: 'linear-gradient(135deg, #4A3B2E, #2A211A)' }}
    >
      <g fill="none" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25 74V41l23 19" stroke="#E8DCC8" />
        <path d="M48 60l23-38v52" stroke="#C4502F" />
      </g>
      <circle cx="71" cy="22" r="3.2" fill="#FBFBF9" />
    </svg>
  );
}
