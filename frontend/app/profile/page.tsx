'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import CvLibrary from '@/components/CvLibrary';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { EMPTY_PROFIL, type Profil } from '@/types';

const FIELDS = [
  { name: 'nom', label: 'Nom complet', type: 'text', wide: false, placeholder: '' },
  {
    name: 'titre_professionnel',
    label: 'Titre professionnel',
    type: 'text',
    wide: false,
    placeholder: 'Ingénieur DevOps',
  },
  { name: 'linkedin_url', label: 'URL LinkedIn', type: 'url', wide: true, placeholder: 'https://linkedin.com/in/…' },
  { name: 'github_url', label: 'URL GitHub', type: 'url', wide: true, placeholder: 'https://github.com/…' },
  { name: 'portfolio_url', label: 'URL Portfolio', type: 'url', wide: true, placeholder: 'https://…' },
] as const;

const INPUT_CLASS =
  'w-full rounded-2xl border border-littoral-light/40 bg-white px-4 py-3 outline-none transition focus:border-littoral-dark';

export default function ProfilePage() {
  const [profil, setProfil] = useState<Profil>(EMPTY_PROFIL);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchProfil = useCallback(async () => {
    try {
      const data = await apiFetch<Partial<Profil>>('/profil');
      setProfil({
        nom: data?.nom || '',
        titre_professionnel: data?.titre_professionnel || '',
        linkedin_url: data?.linkedin_url || '',
        github_url: data?.github_url || '',
        portfolio_url: data?.portfolio_url || '',
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Impossible de charger le profil.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchProfil();
    };

    load();
  }, [fetchProfil]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await apiFetch<Profil>('/profil', {
        method: 'PUT',
        body: JSON.stringify(profil),
      });
      toast.success('Profil mis à jour avec succès.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Erreur lors de la mise à jour du profil.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfil((previous) => ({ ...previous, [name]: value }));
  };

  return (
    <main className="bg-coton px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="animate-fade-in rounded-3xl border border-littoral-light/30 bg-white/80 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="mb-8 flex flex-col gap-4 border-b border-littoral-light/20 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full border border-littoral-light/30 bg-coton-dark px-3 py-1 text-xs font-semibold uppercase tracking-wide text-littoral-dark/70">
                Mon profil
              </p>
              <h1 className="text-3xl font-bold text-littoral-dark md:text-4xl">
                Gérez vos liens et votre identité professionnelle.
              </h1>
            </div>

            <div className="rounded-2xl border border-littoral-light/30 bg-coton-dark/60 px-4 py-3 text-sm text-littoral-dark/70">
              Gardez vos profils publics cohérents avec votre parcours.
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {FIELDS.map((field) => (
                <div
                  key={field.name}
                  className={`h-20 animate-pulse rounded-2xl bg-coton-dark/50 ${field.wide ? 'md:col-span-2' : ''}`}
                />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {FIELDS.map((field) => (
                <label key={field.name} className={`space-y-2 ${field.wide ? 'md:col-span-2' : ''}`}>
                  <span className="block text-sm font-medium text-littoral-dark">{field.label}</span>
                  <input
                    type={field.type}
                    name={field.name}
                    value={profil[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    className={INPUT_CLASS}
                  />
                </label>
              ))}

              <div className="pt-2 md:col-span-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-2xl bg-laterite px-5 py-3 font-semibold text-white transition hover:bg-laterite-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Enregistrement...' : 'Enregistrer le profil'}
                </button>
              </div>
            </form>
          )}
        </section>

        <CvLibrary />
      </div>
    </main>
  );
}
