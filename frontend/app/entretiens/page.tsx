'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/Modal';
import PreparationPanel from '@/components/PreparationPanel';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { useLangue } from '@/i18n';
import {
  CATEGORIE_STYLE,
  INTERVIEW_MODALITES,
  INTERVIEW_TYPES,
  type Application,
  type Interview,
  type InterviewModalite,
  type InterviewType,
} from '@/types';

const INPUT_CLASS =
  'w-full rounded-xl border border-littoral-light/40 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-littoral-dark';

const VIDE = {
  application_id: '',
  date_entretien: '',
  type_entretien: 'rh' as InterviewType,
  modalite: 'visio' as InterviewModalite,
  lieu: '',
  notes_prepa: '',
};

export default function EntretiensPage() {
  const { t, formatLocale } = useLangue();

  const [aVenir, setAVenir] = useState<Interview[]>([]);
  const [passes, setPasses] = useState<Interview[]>([]);
  const [total, setTotal] = useState(0);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modale, setModale] = useState(false);
  const [formulaire, setFormulaire] = useState(VIDE);
  const [isSaving, setIsSaving] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const [i, a] = await Promise.all([
        apiFetch<Interview[]>('/interviews'),
        apiFetch<Application[]>('/applications'),
      ]);
      const liste = i || [];
      setApplications(a || []);
      setTotal(liste.length);

      // Le partage dépend de l'heure courante : le calculer ici plutôt qu'au
      // rendu garde le rendu pur (Date.now y est interdit).
      const maintenant = Date.now();
      setAVenir(
        liste
          .filter((entretien) => new Date(entretien.date_entretien).getTime() >= maintenant)
          .sort((x, y) => +new Date(x.date_entretien) - +new Date(y.date_entretien))
      );
      setPasses(
        liste
          .filter((entretien) => new Date(entretien.date_entretien).getTime() < maintenant)
          .sort((x, y) => +new Date(y.date_entretien) - +new Date(x.date_entretien))
      );
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const load = async () => {
      await charger();
    };

    load();
  }, [charger]);


  const planifier = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiFetch<Interview>('/interviews', {
        method: 'POST',
        body: JSON.stringify({
          ...formulaire,
          date_entretien: new Date(formulaire.date_entretien).toISOString(),
        }),
      });
      toast.success(t('entretiens.planifie'));
      setModale(false);
      await charger();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    } finally {
      setIsSaving(false);
    }
  };

  const supprimer = async (interview: Interview) => {
    if (!window.confirm(t('commun.confirmerSuppression'))) return;
    try {
      await apiFetch<{ id: string }>(`/interviews/${interview.id}`, { method: 'DELETE' });
      toast.success(t('entretiens.supprime'));
      await charger();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    }
  };

  const formatDate = (valeur: string) =>
    new Date(valeur).toLocaleString(formatLocale, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const carte = (interview: Interview, passe: boolean) => {
    const estOuvert = ouvert === interview.id;

    return (
      <li
        key={interview.id}
        className={`rounded-2xl border bg-white transition ${
          passe ? 'border-littoral-light/20 opacity-75' : 'border-littoral-light/30'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-littoral-dark">{interview.titre_poste}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORIE_STYLE.technique}`}>
                {t(`entretiens.types.${interview.type_entretien}`)}
              </span>
              <span className="rounded-full bg-coton-dark px-2 py-0.5 text-xs text-littoral-dark/70">
                {t(`entretiens.modalites.${interview.modalite}`)}
              </span>
              {interview.questions_ia && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  {t('dashboard.prepare')}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-littoral-dark/60">
              {interview.entreprise_nom} · {formatDate(interview.date_entretien)}
              {interview.lieu ? ` · ${interview.lieu}` : ''}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setOuvert(estOuvert ? null : interview.id)}
              aria-expanded={estOuvert}
              className="rounded-lg border border-littoral-dark/20 px-3 py-1.5 text-sm font-medium text-littoral-dark transition hover:bg-coton-dark"
            >
              {t('entretiens.prepa.titre')}
            </button>
            <button
              onClick={() => supprimer(interview)}
              className="rounded-lg px-2.5 py-1.5 text-sm text-littoral-dark/40 transition hover:bg-laterite/10 hover:text-laterite"
            >
              {t('commun.supprimer')}
            </button>
          </div>
        </div>

        {estOuvert && (
          <div className="border-t border-littoral-light/25 p-5">
            <PreparationPanel interview={interview} onUpdated={charger} />
          </div>
        )}
      </li>
    );
  };

  return (
    <main className="bg-coton px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-littoral-dark">{t('entretiens.titre')}</h1>
            <p className="mt-1 text-littoral-dark/70">{t('entretiens.sousTitre')}</p>
          </div>
          <button
            onClick={() => {
              setFormulaire(VIDE);
              setModale(true);
            }}
            disabled={applications.length === 0}
            className="shrink-0 rounded-xl bg-laterite px-5 py-2.5 font-semibold text-white transition hover:bg-laterite-hover disabled:opacity-50"
          >
            + {t('entretiens.planifier')}
          </button>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-coton-dark/50" />
            ))}
          </div>
        ) : total === 0 ? (
          <p className="rounded-2xl border border-dashed border-littoral-light/50 bg-white/60 px-6 py-14 text-center text-littoral-dark/60">
            {t('entretiens.aucun')}
          </p>
        ) : (
          <>
            {aVenir.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-littoral-dark/55">
                  {t('entretiens.aVenir')}
                </h2>
                <ul className="space-y-3">{aVenir.map((i) => carte(i, false))}</ul>
              </section>
            )}

            {passes.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-littoral-dark/55">
                  {t('entretiens.passes')}
                </h2>
                <ul className="space-y-3">{passes.map((i) => carte(i, true))}</ul>
              </section>
            )}
          </>
        )}
      </div>

      {modale && (
        <Modal onClose={() => setModale(false)} labelledBy="titre-entretien" className="max-w-xl">
          <div className="flex items-center justify-between border-b border-littoral-light/30 px-6 py-4">
            <h2 id="titre-entretien" className="text-xl font-bold text-littoral-dark">
              {t('entretiens.planifier')}
            </h2>
            <button
              onClick={() => setModale(false)}
              aria-label={t('commun.fermer')}
              className="rounded-lg px-2 py-1 text-xl leading-none text-littoral-dark/50 transition hover:bg-coton-dark"
            >
              ×
            </button>
          </div>

          <form onSubmit={planifier} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">
                {t('nav.bewerbungen')} *
              </span>
              <select
                required
                autoFocus
                value={formulaire.application_id}
                onChange={(e) => setFormulaire((f) => ({ ...f, application_id: e.target.value }))}
                className={INPUT_CLASS}
              >
                <option value="">{t('ats.choisir')}</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.titre_poste} — {app.entreprise_nom}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">
                {t('entretiens.date')} *
              </span>
              <input
                required
                type="datetime-local"
                value={formulaire.date_entretien}
                onChange={(e) => setFormulaire((f) => ({ ...f, date_entretien: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">
                  {t('entretiens.type')}
                </span>
                <select
                  value={formulaire.type_entretien}
                  onChange={(e) =>
                    setFormulaire((f) => ({ ...f, type_entretien: e.target.value as InterviewType }))
                  }
                  className={INPUT_CLASS}
                >
                  {INTERVIEW_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`entretiens.types.${type}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">
                  {t('entretiens.modalite')}
                </span>
                <select
                  value={formulaire.modalite}
                  onChange={(e) =>
                    setFormulaire((f) => ({ ...f, modalite: e.target.value as InterviewModalite }))
                  }
                  className={INPUT_CLASS}
                >
                  {INTERVIEW_MODALITES.map((modalite) => (
                    <option key={modalite} value={modalite}>
                      {t(`entretiens.modalites.${modalite}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">{t('entretiens.lieu')}</span>
              <input
                value={formulaire.lieu}
                onChange={(e) => setFormulaire((f) => ({ ...f, lieu: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">
                {t('entretiens.notesPrepa')}
              </span>
              <textarea
                rows={3}
                value={formulaire.notes_prepa}
                onChange={(e) => setFormulaire((f) => ({ ...f, notes_prepa: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>

            <div className="flex justify-end gap-3 border-t border-littoral-light/30 pt-4">
              <button
                type="button"
                onClick={() => setModale(false)}
                className="rounded-xl border border-littoral-dark/20 px-4 py-2.5 text-sm font-medium text-littoral-dark transition hover:bg-coton-dark"
              >
                {t('commun.annuler')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-laterite px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-laterite-hover disabled:opacity-50"
              >
                {isSaving ? t('commun.enregistrement') : t('commun.enregistrer')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
