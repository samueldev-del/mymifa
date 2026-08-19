'use client';

import Image from 'next/image';
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
    /*
     * `relative` est requis par `fill` : l'image se positionne en absolu dans
     * son parent, qui doit donc établir un contexte de positionnement.
     *
     * Le ratio vit désormais sur le cadre plutôt que sur l'image : plus large
     * que haut sur mobile pour laisser la place au formulaire, plus haut que
     * large dès qu'il passe à côté de lui.
     */
    <figure className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-3xl shadow-xl ring-1 ring-littoral-dark/10 sm:aspect-[4/5] lg:max-w-sm">
      <Image
        src="/famille.jpg"
        alt=""
        fill
        /*
         * Cette image est le LCP de la page de connexion. Sans `priority`,
         * next/image la charge en différé — ce qui retarde précisément
         * l'élément qui mesure la performance perçue.
         */
        priority
        /*
         * `fill` dispense de width/height, mais Next a besoin de `sizes` pour
         * choisir la résolution à servir. Sans cette indication, il suppose
         * 100vw et télécharge une image bien plus grande que nécessaire.
         */
        sizes="(min-width: 1024px) 24rem, (min-width: 640px) 28rem, 100vw"
        onError={() => setDisponible(false)}
        /*
         * `object-position` à 25 % cale la fenêtre sur les deux visages, qui
         * occupent la partie haute d'une photo au format portrait.
         */
        className="object-cover object-[center_25%]"
      />
    </figure>
  );
}
