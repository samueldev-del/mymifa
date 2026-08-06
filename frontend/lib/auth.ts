const STORAGE_KEY = 'mymifa_token';

/**
 * Le jeton vit dans localStorage : l'app est mono-utilisateur et le backend
 * est sur une autre origine, ce qui exclut un cookie same-site simple.
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Vide la session et renvoie vers /login en conservant la page demandée.
 * Un rechargement complet (plutôt qu'un router.push) garantit qu'aucun état
 * authentifié ne subsiste en mémoire.
 */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;

  clearToken();
  const { pathname, search } = window.location;

  if (pathname === '/login') return;

  const suivant = encodeURIComponent(`${pathname}${search}`);
  window.location.replace(`/login?next=${suivant}`);
}
