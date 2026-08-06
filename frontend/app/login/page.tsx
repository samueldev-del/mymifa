'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { setToken } from '@/lib/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
        skipAuthRedirect: true,
      });

      setToken(data.token);

      // On n'accepte qu'un chemin interne : évite une redirection ouverte.
      const next = searchParams.get('next');
      const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      router.replace(destination);
    } catch (error: unknown) {
      setPassword('');
      toast.error(getErrorMessage(error, 'Connexion impossible.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-coton p-6">
      <div className="w-full max-w-md">
        <div className="animate-fade-in rounded-3xl border border-littoral-light/30 bg-white/80 p-8 shadow-sm backdrop-blur">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-laterite text-2xl font-bold text-white">
              M
            </span>
            <h1 className="text-2xl font-bold text-littoral-dark">Mymifa</h1>
            <p className="mt-1 text-sm text-littoral-dark/70">
              Cet espace est privé. Saisissez votre mot de passe pour continuer.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="block text-sm font-medium text-littoral-dark">Mot de passe</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-littoral-light/40 bg-white px-4 py-3 outline-none transition focus:border-littoral-dark"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="w-full rounded-2xl bg-laterite px-5 py-3 font-semibold text-white transition hover:bg-laterite-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={<main className="min-h-screen bg-coton" />}>
      <LoginForm />
    </Suspense>
  );
}
