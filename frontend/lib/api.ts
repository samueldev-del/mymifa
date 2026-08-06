import type { ApiErrorDetail, ApiErrorShape } from '@/types';
import { getToken, redirectToLogin } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Erreur normalisee : porte le message metier renvoye par le backend. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: ApiErrorDetail[];

  constructor(message: string, status: number, code?: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiFetchOptions extends RequestInit {
  /**
   * Laisser passer un 401 au lieu de rediriger vers /login.
   * Utilisé par la page de connexion elle-même.
   */
  skipAuthRedirect?: boolean;
}

/**
 * Point d'entree unique vers l'API.
 * Injecte le jeton de session, deballe l'enveloppe { success, data, error } du
 * backend et leve une ApiError portant le message serveur.
 */
export async function apiFetch<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError("NEXT_PUBLIC_API_URL n'est pas configuree.", 0, 'CONFIG_MISSING');
  }

  const { skipAuthRedirect, ...requestInit } = init;
  const isFormData = requestInit.body instanceof FormData;
  const token = getToken();

  // Le navigateur doit poser lui-meme le Content-Type multipart (avec sa boundary).
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...requestInit.headers,
  };

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...requestInit, headers });
  } catch {
    throw new ApiError('Serveur injoignable. Verifiez votre connexion.', 0, 'NETWORK_ERROR');
  }

  // Une erreur 500 peut renvoyer du HTML plutot que du JSON.
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ApiErrorShape;

    if (response.status === 401 && !skipAuthRedirect) {
      redirectToLogin();
    }

    throw new ApiError(
      errorPayload.error?.message || errorPayload.message || `Erreur ${response.status}.`,
      response.status,
      errorPayload.error?.code,
      errorPayload.error?.details
    );
  }

  return (payload as { data: T })?.data as T;
}

/** Extrait un message affichable depuis une erreur inconnue. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
