/**
 * Source unique de la marque Mymifa.
 *
 * Toutes les déclinaisons (badge web, icônes PWA, maskable, apple-touch)
 * sortent d'ici : la géométrie n'est écrite qu'une fois, et
 * `generate-icons.js` se contente de la rasteriser.
 */

const LATERITE = '#C4502F';
const CREME = '#E8DCC8';
const BLANC = '#FBFBF9';

/**
 * Le M est une polyligne coupée en deux au creux central : branche gauche en
 * crème (le parcours déjà fait), branche droite en latérite qui monte plus
 * haut que la gauche et se termine sur un œil clair (la cible visée).
 * La lettre se lit d'abord, la trajectoire de carrière ensuite.
 */
const MARQUE = `
  <g fill="none" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <path d="M25 74V41l23 19" stroke="${CREME}" />
    <path d="M48 60l23-38v52" stroke="${LATERITE}" />
  </g>
  <circle cx="71" cy="22" r="3.2" fill="${BLANC}" />`;

/**
 * @param {'badge'|'maskable'} variante
 *   `badge`    coins arrondis, hors-coins transparents — usage web et favicon.
 *   `maskable` fond à bord perdu et marque réduite dans la zone sûre (le
 *              cercle central de 80 %), le système appliquant son propre
 *              masque. Sert aussi à l'icône Apple, qui refuse la transparence.
 */
function svg(variante) {
  const arrondi = variante === 'maskable' ? 0 : 24;
  // 0.85 laisse une marge confortable sous la limite théorique (~0.97).
  const marque =
    variante === 'maskable'
      ? `<g transform="translate(48 48) scale(.85) translate(-48 -48)">${MARQUE}</g>`
      : MARQUE;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Mymifa">
  <title>Mymifa</title>
  <defs>
    <linearGradient id="mymifa-fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4A3B2E" />
      <stop offset="1" stop-color="#2A211A" />
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="${arrondi}" fill="url(#mymifa-fond)" />
${marque}
</svg>
`;
}

module.exports = { svg, LATERITE, CREME, BLANC };
