'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch, getErrorMessage } from '@/lib/api';
import type { CvItem } from '@/types';

const INPUT_CLASS =
  'w-full rounded-xl border border-littoral-light/40 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-littoral-dark';

/**
 * Bibliothèque de CV de base (CV français, CV anglais…), indépendante des
 * candidatures. Stockage S3 privé : les liens sont des URLs signées à durée
 * limitée générées par le backend.
 */
export default function CvLibrary() {
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
      toast.error(getErrorMessage(error, 'Impossible de charger la bibliothèque de CV.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      toast.success('CV ajouté à la bibliothèque.');
      await fetchCvs();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Impossible d'ajouter le CV."));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRename = async (cv: CvItem) => {
    const nouveau = window.prompt('Nouveau libellé du CV :', cv.libelle || '');
    if (!nouveau || !nouveau.trim() || nouveau.trim() === cv.libelle) return;

    try {
      await apiFetch<CvItem>(`/cv/${cv.id}`, {
        method: 'PUT',
        body: JSON.stringify({ libelle: nouveau.trim() }),
      });
      toast.success('CV renommé.');
      await fetchCvs();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Impossible de renommer le CV.'));
    }
  };

  const handleDelete = async (cv: CvItem) => {
    if (!window.confirm(`Supprimer « ${cv.libelle || 'ce CV'} » de la bibliothèque ?`)) return;

    try {
      await apiFetch<{ id: string }>(`/cv/${cv.id}`, { method: 'DELETE' });
      toast.success('CV supprimé.');
      await fetchCvs();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Impossible de supprimer le CV.'));
    }
  };

  return (
    <section className="animate-fade-in delay-100 rounded-3xl border border-littoral-light/30 bg-white/80 p-6 shadow-sm backdrop-blur md:p-8">
      <div className="mb-6 border-b border-littoral-light/20 pb-5">
        <h2 className="text-xl font-bold text-littoral-dark">Bibliothèque de CV</h2>
        <p className="mt-1 text-sm text-littoral-dark/70">
          Vos CV de base, réutilisables d&apos;une candidature à l&apos;autre. Les fichiers sont
          stockés en privé — les liens de téléchargement expirent après 15 minutes.
        </p>
      </div>

      <form
        onSubmit={handleUpload}
        className="mb-6 space-y-3 rounded-2xl border border-littoral-light/30 bg-coton-dark/40 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-littoral-dark">Fichier</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
              className="w-full cursor-pointer text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-littoral-light/30 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-littoral-dark hover:file:bg-littoral-light/50"
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-littoral-dark">Libellé</span>
            <input
              type="text"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="CV Français, CV Anglais…"
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!fichier || isUploading}
          className="rounded-xl bg-littoral-dark px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? 'Téléversement...' : 'Ajouter à la bibliothèque'}
        </button>
        <p className="text-xs text-littoral-dark/50">PDF, DOC ou DOCX — 10 Mo maximum.</p>
      </form>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-coton-dark/60" />
          <div className="h-16 animate-pulse rounded-xl bg-coton-dark/40" />
        </div>
      ) : cvs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-littoral-light/40 px-4 py-10 text-center text-sm text-littoral-dark/60">
          Aucun CV enregistré. Ajoutez-en un pour le réutiliser dans vos candidatures.
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
                    Ajouté le {new Date(cv.created_at).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => handleRename(cv)}
                  className="rounded-lg px-2.5 py-1.5 text-sm text-littoral-dark/60 transition hover:bg-coton-dark hover:text-littoral-dark"
                >
                  Renommer
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cv)}
                  className="rounded-lg px-2.5 py-1.5 text-sm text-littoral-dark/40 transition hover:bg-laterite/10 hover:text-laterite"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
