'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import CvLibrary from '@/components/CvLibrary';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { useLangue } from '@/i18n';
import { EMPTY_PROFIL, type Profil } from '@/types';

const FIELDS = [
  { name: 'nom', cle: 'profil.nom', type: 'text', wide: false, placeholder: '' },
  {
    name: 'titre_professionnel',
    cle: 'profil.titrePro',
    type: 'text',
    wide: false,
    placeholder: 'Ingénieur DevOps',
  },
  { name: 'email', cle: 'profil.email', type: 'email', wide: false, placeholder: 'contact@exemple.com' },
  { name: 'telephone', cle: 'profil.telephone', type: 'tel', wide: false, placeholder: '' },
  { name: 'ville', cle: 'profil.ville', type: 'text', wide: false, placeholder: 'Berlin' },
  { name: 'linkedin_url', cle: 'profil.linkedin', type: 'url', wide: true, placeholder: 'https://linkedin.com/in/…' },
  { name: 'github_url', cle: 'profil.github', type: 'url', wide: true, placeholder: 'https://github.com/…' },
  { name: 'portfolio_url', cle: 'profil.portfolio', type: 'url', wide: true, placeholder: 'https://…' },
] as const;

const INPUT_CLASS =
  'w-full rounded-2xl border border-littoral-light/40 bg-white px-4 py-3 outline-none transition focus:border-littoral-dark';

export default function ProfilePage() {
  const { t } = useLangue();
  const [profil, setProfil] = useState<Profil>(EMPTY_PROFIL);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchProfil = useCallback(async () => {
    try {
      const data = await apiFetch<Partial<Profil>>('/profil');
      // Fusion avec le profil vide : les champs absents ou null deviennent des
      // chaînes vides, et ajouter un champ ne demande plus de toucher ici.
      setProfil((precedent) => ({
        ...precedent,
        ...Object.fromEntries(
          Object.keys(EMPTY_PROFIL).map((cle) => [cle, data?.[cle as keyof Profil] ?? ''])
        ),
      }));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('profil.erreurChargement')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

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
      toast.success(t('profil.misAJour'));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
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
                {t('profil.badge')}
              </p>
              <h1 className="text-3xl font-bold text-littoral-dark md:text-4xl">
                {t('profil.titre')}
              </h1>
            </div>

            <div className="rounded-2xl border border-littoral-light/30 bg-coton-dark/60 px-4 py-3 text-sm text-littoral-dark/70">
              {t('profil.aide')}
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
                  <span className="block text-sm font-medium text-littoral-dark">{t(field.cle)}</span>
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
                  {isSaving ? t('commun.enregistrement') : t('profil.enregistrer')}
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
