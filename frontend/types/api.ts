/**
 * Enveloppe de reponse renvoyee par le backend (backend/utils/http.js).
 * Toutes les routes API respectent ce contrat.
 */
export interface ApiSuccessShape<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorDetail {
  path?: string;
  message: string;
}

export interface ApiErrorShape {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: ApiErrorDetail[];
  };
  message?: string;
}

export type ApiResponse<T> = ApiSuccessShape<T> | ApiErrorShape;
