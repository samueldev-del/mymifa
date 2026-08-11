/**
 * Routes atteignables sans jeton. Une mention légale derrière un mot de passe
 * ne remplit pas son office : Impressum et Datenschutzerklärung doivent rester
 * publics même quand tout le reste est fermé.
 *
 * Partagé par AuthGuard (qui les laisse passer) et Header (qui s'efface
 * dessus, faute de navigation utilisable sans session).
 */
export const ROUTES_PUBLIQUES = ['/login', '/impressum', '/datenschutz'];
