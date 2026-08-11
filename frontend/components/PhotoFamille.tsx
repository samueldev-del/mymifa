'use client';

import { useState } from 'react';

/**
 * Photo de famille présentée comme un cadre, à côté du formulaire de
 * connexion — et non en fond d'écran : un fond plein écran passe derrière la
 * carte, se fait recadrer par l'orientation et finit par écraser le sujet.
 *
 * Le fichier attendu est public/famille.jpg. S'il manque, le composant
 * disparaît proprement et la page se referme sur le seul formulaire.
 */
export default function PhotoFamille() {
  const [disponible, setDisponible] = useState(true);

  if (!disponible) return null;

  return (
    <figure className="w-full max-w-md overflow-hidden rounded-3xl shadow-xl ring-1 ring-littoral-dark/10 lg:max-w-sm">
      <img
        src="/famille.jpg"
        alt=""
        onError={() => setDisponible(false)}
        /*
         * Le cadre est plus large que haut sur mobile pour laisser la place au
         * formulaire, plus haut que large dès qu'il passe à côté de lui.
         * `object-position` à 25 % cale la fenêtre sur les deux visages, qui
         * occupent la partie haute d'une photo au format portrait.
         */
        className="aspect-[4/3] w-full object-cover object-[center_25%] sm:aspect-[4/5]"
      />
    </figure>
  );
}
