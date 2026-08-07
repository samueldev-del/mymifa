'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { useLangue } from '@/i18n';
import type { CvItem } from '@/types';

const INPUT_CLASS =
  'w-full rounded-xl border border-littoral-light/40 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-littoral-dark';

/**
 * Bibliothèque de CV de base (CV français, CV anglais…), indépendante des
 * candidatures. Stockage S3 privé : les liens sont des URLs signées à durée
 * limitée générées par le backend.
 */
export default function CvLibrary() {
  const { t, formatLocale } = useLangue();
  const [cvs, setCvs] = useState<CvItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [libelle, setLibelle] = useState('');

  const fetchCvs = useCallback(async () => {
    try {
      const data = await apiFetch<CvItem[]>('/cv');
      setCvs(data || []);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const load = async () => {
      await fetchCvs();
    };

    load();
  }, [fetchCvs]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fichier) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', fichier);
    if (libelle.trim()) formData.append('libelle', libelle.trim());

    try {
      await apiFetch<CvItem>('/cv', { method: 'POST', body: formData });
      setFichier(null);
      setLibelle('');
      e.currentTarget.reset();
      toast.success(t('profil.bibliotheque.ajoute'));
      await fetchCvs();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRename = async (cv: CvItem) => {
    const nouveau = window.prompt(t('profil.bibliotheque.nouveauLibelle'), cv.libelle || '');
    if (!nouveau || !nouveau.trim() || nouveau.trim() === cv.libelle) return;

    try {
      await apiFetch<CvItem>(`/cv/${cv.id}`, {
        method: 'PUT',
        body: JSON.stringify({ libelle: nouveau.trim() }),
      });
      toast.success(t('profil.bibliotheque.renomme'));
      await fetchCvs();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    }
  };

  const handleDelete = async (cv: CvItem) => {
    if (!window.confirm(t('profil.bibliotheque.supprimerConfirm', { nom: cv.libelle || '' }))) return;

    try {
      await apiFetch<{ id: string }>(`/cv/${cv.id}`, { method: 'DELETE' });
      toast.success(t('profil.bibliotheque.supprime'));
      await fetchCvs();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    }
  };

  return (
    <section className="animate-fade-in delay-100 rounded-3xl border border-littoral-light/30 bg-white/80 p-6 shadow-sm backdrop-blur md:p-8">
      <div className="mb-6 border-b border-littoral-light/20 pb-5">
        <h2 className="text-xl font-bold text-littoral-dark">{t('profil.bibliotheque.titre')}</h2>
        <p className="mt-1 text-sm text-littoral-dark/70">
          {t('profil.bibliotheque.sousTitre')}
        </p>
      </div>

      <form
        onSubmit={handleUpload}
        className="mb-6 space-y-3 rounded-2xl border border-littoral-light/30 bg-coton-dark/40 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-littoral-dark">{t('profil.bibliotheque.fichier')}</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
              className="w-full cursor-pointer text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-littoral-light/30 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-littoral-dark hover:file:bg-littoral-light/50"
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-littoral-dark">{t('profil.bibliotheque.libelle')}</span>
            <input
              type="text"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder={t('profil.bibliotheque.libellePlaceholder')}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!fichier || isUploading}
          className="rounded-xl bg-littoral-dark px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? t('commun.enregistrement') : t('profil.bibliotheque.ajouter')}
        </button>
        <p className="text-xs text-littoral-dark/50">{t('documents.contraintes')}</p>
      </form>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-coton-dark/60" />
          <div className="h-16 animate-pulse rounded-xl bg-coton-dark/40" />
        </div>
      ) : cvs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-littoral-light/40 px-4 py-10 text-center text-sm text-littoral-dark/60">
          {t('profil.bibliotheque.aucun')}
        </p>
      ) : (
        <ul className="space-y-2">
          {cvs.map((cv) => (
            <li
              key={cv.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-littoral-light/30 bg-white px-4 py-3 transition hover:border-littoral-light/60"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={cv.url_telechargement ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate font-medium text-littoral-dark underline decoration-littoral-light hover:text-laterite"
                >
                  {cv.libelle || cv.nom_fichier || 'CV'}
                </a>
                {cv.created_at && (
                  <span className="text-xs text-littoral-dark/50">
                    {t('profil.bibliotheque.ajouteLe', { date: new Date(cv.created_at).toLocaleDateString(formatLocale) })}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => handleRename(cv)}
                  className="rounded-lg px-2.5 py-1.5 text-sm text-littoral-dark/60 transition hover:bg-coton-dark hover:text-littoral-dark"
                >
                  {t('profil.bibliotheque.renommer')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cv)}
                  className="rounded-lg px-2.5 py-1.5 text-sm text-littoral-dark/40 transition hover:bg-laterite/10 hover:text-laterite"
                >
                  {t('commun.supprimer')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
