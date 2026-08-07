'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/Modal';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { useLangue } from '@/i18n';
import {
  FORMATION_STATUTS,
  FORMATION_STATUT_STYLE,
  type Formation,
  type FormationStatut,
} from '@/types';

const INPUT_CLASS =
  'w-full rounded-xl border border-littoral-light/40 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-littoral-dark';

const FORMULAIRE_VIDE = {
  titre: '',
  organisme: '',
  statut: 'prevue' as FormationStatut,
  date_debut: '',
  date_fin: '',
  url: '',
  competences: '',
  notes: '',
};

type Formulaire = typeof FORMULAIRE_VIDE;

export default function FormationsPage() {
  const { t, formatLocale } = useLangue();

  const [formations, setFormations] = useState<Formation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [enEdition, setEnEdition] = useState<Formation | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire>(FORMULAIRE_VIDE);
  const [isSaving, setIsSaving] = useState(false);

  const charger = useCallback(async () => {
    try {
      setFormations((await apiFetch<Formation[]>('/formations')) || []);
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

  const ouvrirCreation = () => {
    setEnEdition(null);
    setFormulaire(FORMULAIRE_VIDE);
    setModaleOuverte(true);
  };

  const ouvrirEdition = (formation: Formation) => {
    setEnEdition(formation);
    setFormulaire({
      titre: formation.titre,
      organisme: formation.organisme || '',
      statut: formation.statut,
      date_debut: formation.date_debut?.slice(0, 10) || '',
      date_fin: formation.date_fin?.slice(0, 10) || '',
      url: formation.url || '',
      competences: formation.competences.join(', '),
      notes: formation.notes || '',
    });
    setModaleOuverte(true);
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const corps = {
      ...formulaire,
      // Le backend attend un tableau ; l'interface saisit une liste séparée par des virgules.
      competences: formulaire.competences
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    };

    try {
      if (enEdition) {
        await apiFetch<Formation>(`/formations/${enEdition.id}`, {
          method: 'PUT',
          body: JSON.stringify(corps),
        });
        toast.success(t('formations.misAJour'));
      } else {
        await apiFetch<Formation>('/formations', { method: 'POST', body: JSON.stringify(corps) });
        toast.success(t('formations.creee'));
      }

      setModaleOuverte(false);
      await charger();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    } finally {
      setIsSaving(false);
    }
  };

  const supprimer = async (formation: Formation) => {
    if (!window.confirm(t('commun.confirmerSuppression'))) return;

    try {
      await apiFetch<{ id: string }>(`/formations/${formation.id}`, { method: 'DELETE' });
      toast.success(t('formations.supprimee'));
      await charger();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    }
  };

  const changerStatut = async (formation: Formation, statut: FormationStatut) => {
    try {
      await apiFetch<Formation>(`/formations/${formation.id}`, {
        method: 'PUT',
        body: JSON.stringify({ statut }),
      });
      await charger();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    }
  };

  const formatDate = (valeur: string | null) =>
    valeur ? new Date(valeur).toLocaleDateString(formatLocale, { month: 'short', year: 'numeric' }) : null;

  return (
    <main className="bg-coton px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-littoral-dark">{t('formations.titre')}</h1>
            <p className="mt-1 text-littoral-dark/70">{t('formations.sousTitre')}</p>
          </div>
          <button
            onClick={ouvrirCreation}
            className="shrink-0 rounded-xl bg-laterite px-5 py-2.5 font-semibold text-white transition hover:bg-laterite-hover"
          >
            + {t('formations.ajouter')}
          </button>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-coton-dark/50" />
            ))}
          </div>
        ) : formations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-littoral-light/50 bg-white/60 px-6 py-14 text-center text-littoral-dark/60">
            {t('formations.aucune')}
          </p>
        ) : (
          <ul className="space-y-3">
            {formations.map((formation) => (
              <li
                key={formation.id}
                className="rounded-2xl border border-littoral-light/30 bg-white p-5 transition hover:border-littoral-light/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-littoral-dark">{formation.titre}</h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${FORMATION_STATUT_STYLE[formation.statut]}`}
                      >
                        {t(`formations.statuts.${formation.statut}`)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-littoral-dark/60">
                      {[
                        formation.organisme,
                        [formatDate(formation.date_debut), formatDate(formation.date_fin)]
                          .filter(Boolean)
                          .join(' → '),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    {formation.url && (
                      <a
                        href={formation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg px-2.5 py-1.5 text-sm text-littoral-dark/60 transition hover:bg-coton-dark hover:text-littoral-dark"
                      >
                        {t('commun.voir')}
                      </a>
                    )}
                    <button
                      onClick={() => ouvrirEdition(formation)}
                      className="rounded-lg px-2.5 py-1.5 text-sm text-littoral-dark/60 transition hover:bg-coton-dark hover:text-littoral-dark"
                    >
                      {t('commun.modifier')}
                    </button>
                    <button
                      onClick={() => supprimer(formation)}
                      className="rounded-lg px-2.5 py-1.5 text-sm text-littoral-dark/40 transition hover:bg-laterite/10 hover:text-laterite"
                    >
                      {t('commun.supprimer')}
                    </button>
                  </div>
                </div>

                {formation.competences.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {formation.competences.map((competence) => (
                      <li
                        key={competence}
                        className="rounded-full bg-coton-dark px-2.5 py-0.5 text-xs text-littoral-dark"
                      >
                        {competence}
                      </li>
                    ))}
                  </ul>
                )}

                {formation.notes && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-littoral-dark/70">
                    {formation.notes}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-littoral-light/20 pt-3">
                  {FORMATION_STATUTS.filter((s) => s !== formation.statut).map((statut) => (
                    <button
                      key={statut}
                      onClick={() => changerStatut(formation, statut)}
                      className="rounded-full border border-littoral-light/40 px-2.5 py-0.5 text-xs text-littoral-dark/55 transition hover:border-littoral-dark/30 hover:text-littoral-dark"
                    >
                      → {t(`formations.statuts.${statut}`)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modaleOuverte && (
        <Modal onClose={() => setModaleOuverte(false)} labelledBy="titre-formation" className="max-w-2xl">
          <div className="flex items-center justify-between border-b border-littoral-light/30 px-6 py-4">
            <h2 id="titre-formation" className="text-xl font-bold text-littoral-dark">
              {enEdition ? t('commun.modifier') : t('formations.ajouter')}
            </h2>
            <button
              onClick={() => setModaleOuverte(false)}
              aria-label={t('commun.fermer')}
              className="rounded-lg px-2 py-1 text-xl leading-none text-littoral-dark/50 transition hover:bg-coton-dark"
            >
              ×
            </button>
          </div>

          <form onSubmit={enregistrer} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">{t('formations.nom')} *</span>
              <input
                required
                autoFocus
                value={formulaire.titre}
                onChange={(e) => setFormulaire((f) => ({ ...f, titre: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">
                  {t('formations.organisme')}
                </span>
                <input
                  value={formulaire.organisme}
                  onChange={(e) => setFormulaire((f) => ({ ...f, organisme: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">
                  {t('candidature.statutLabel')}
                </span>
                <select
                  value={formulaire.statut}
                  onChange={(e) =>
                    setFormulaire((f) => ({ ...f, statut: e.target.value as FormationStatut }))
                  }
                  className={INPUT_CLASS}
                >
                  {FORMATION_STATUTS.map((statut) => (
                    <option key={statut} value={statut}>
                      {t(`formations.statuts.${statut}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">
                  {t('formations.dateDebut')}
                </span>
                <input
                  type="date"
                  value={formulaire.date_debut}
                  onChange={(e) => setFormulaire((f) => ({ ...f, date_debut: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">
                  {t('formations.dateFin')}
                </span>
                <input
                  type="date"
                  value={formulaire.date_fin}
                  onChange={(e) => setFormulaire((f) => ({ ...f, date_fin: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">{t('formations.url')}</span>
              <input
                type="url"
                placeholder="https://..."
                value={formulaire.url}
                onChange={(e) => setFormulaire((f) => ({ ...f, url: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">
                {t('formations.competences')}
              </span>
              <input
                placeholder="Kubernetes, Terraform, AWS EKS"
                value={formulaire.competences}
                onChange={(e) => setFormulaire((f) => ({ ...f, competences: e.target.value }))}
                className={INPUT_CLASS}
              />
              <span className="block text-xs text-littoral-dark/50">
                {t('formations.competencesAide')}
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">{t('formations.notes')}</span>
              <textarea
                rows={3}
                value={formulaire.notes}
                onChange={(e) => setFormulaire((f) => ({ ...f, notes: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>

            <div className="flex justify-end gap-3 border-t border-littoral-light/30 pt-4">
              <button
                type="button"
                onClick={() => setModaleOuverte(false)}
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
