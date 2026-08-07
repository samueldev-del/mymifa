'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { LOCALES, LOCALE_LABELS, useLangue, type Locale } from '@/i18n';
import { CATEGORIE_STYLE, type Interview, type PreparationIA, type ReponseStar } from '@/types';

const INPUT_CLASS =
  'w-full rounded-xl border border-littoral-light/40 bg-white px-3 py-2 text-sm outline-none transition focus:border-littoral-dark';

interface PreparationPanelProps {
  interview: Interview;
  onUpdated: () => void;
}

/**
 * Dossier de préparation d'un entretien : questions probables générées par
 * Claude, réponses au format STAR et bilan après coup.
 */
export default function PreparationPanel({ interview, onUpdated }: PreparationPanelProps) {
  const { t, locale } = useLangue();

  const [prepa, setPrepa] = useState<PreparationIA | null>(interview.questions_ia);
  const [isGenerating, setIsGenerating] = useState(false);
  // Par défaut on se prépare dans la langue de l'interface (allemand a priori).
  const [langue, setLangue] = useState<Locale>(locale);

  const [star, setStar] = useState<ReponseStar[]>(interview.reponses_star ?? []);
  const [bilan, setBilan] = useState(interview.bilan ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const generer = async () => {
    setIsGenerating(true);
    try {
      const data = await apiFetch<PreparationIA>(`/interviews/${interview.id}/preparer`, {
        method: 'POST',
        body: JSON.stringify({ langue }),
      });
      setPrepa(data);
      toast.success(t('entretiens.prepa.generee'));
      onUpdated();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    } finally {
      setIsGenerating(false);
    }
  };

  const enregistrer = async () => {
    setIsSaving(true);
    try {
      await apiFetch<Interview>(`/interviews/${interview.id}`, {
        method: 'PUT',
        // On n'envoie que les réponses réellement remplies.
        body: JSON.stringify({
          reponses_star: star.filter((r) => r.question.trim()),
          bilan,
        }),
      });
      toast.success(t('entretiens.prepa.star.enregistrees'));
      onUpdated();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    } finally {
      setIsSaving(false);
    }
  };

  const majStar = (index: number, champ: keyof ReponseStar, valeur: string) =>
    setStar((liste) => liste.map((r, i) => (i === index ? { ...r, [champ]: valeur } : r)));

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------- génération */}
      <div className="rounded-2xl border border-littoral-light/30 bg-coton-dark/40 p-4">
        <h4 className="font-semibold text-littoral-dark">{t('entretiens.prepa.titre')}</h4>
        <p className="mt-0.5 text-sm text-littoral-dark/60">{t('entretiens.prepa.sousTitre')}</p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="space-y-1.5 sm:w-56">
            <span className="block text-sm font-medium text-littoral-dark">
              {t('entretiens.prepa.langue')}
            </span>
            <select
              value={langue}
              onChange={(e) => setLangue(e.target.value as Locale)}
              className={INPUT_CLASS}
            >
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {LOCALE_LABELS[code]}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={generer}
            disabled={isGenerating}
            className="rounded-xl bg-laterite px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-laterite-hover disabled:opacity-50"
          >
            {isGenerating
              ? t('entretiens.prepa.enCours')
              : prepa
                ? t('entretiens.prepa.regenerer')
                : t('entretiens.prepa.generer')}
          </button>
        </div>
      </div>

      {isGenerating && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-coton-dark/50" />
          ))}
        </div>
      )}

      {prepa && !isGenerating && (
        <div className="animate-fade-in space-y-5">
          {prepa.fiche_entreprise && (
            <section>
              <h4 className="mb-1.5 text-sm font-semibold text-littoral-dark">
                {t('entretiens.prepa.ficheEntreprise')}
              </h4>
              <p className="rounded-xl bg-coton-dark/50 p-3 text-sm leading-relaxed text-littoral-dark/80">
                {prepa.fiche_entreprise}
              </p>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-littoral-dark">
                {t('entretiens.prepa.questions')}
              </h4>
              <span className="text-xs text-littoral-dark/50">{prepa.questions.length}</span>
            </div>

            <ul className="space-y-2">
              {prepa.questions.map((question) => (
                <li
                  key={question.question}
                  className="rounded-xl border border-littoral-light/30 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-littoral-dark">{question.question}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        CATEGORIE_STYLE[question.categorie] ?? ''
                      }`}
                    >
                      {t(`entretiens.prepa.categories.${question.categorie}`)}
                    </span>
                  </div>

                  <dl className="mt-2 space-y-1.5 text-sm">
                    <div>
                      <dt className="inline font-medium text-littoral-dark/55">
                        {t('entretiens.prepa.pourquoi')} :{' '}
                      </dt>
                      <dd className="inline text-littoral-dark/75">{question.pourquoi}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-littoral-dark/55">
                        {t('entretiens.prepa.pisteReponse')} :{' '}
                      </dt>
                      <dd className="inline text-littoral-dark/75">{question.piste_reponse}</dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => setStar((liste) => [...liste, { question: question.question }])}
                    className="mt-2.5 rounded-lg border border-littoral-light/40 px-2.5 py-1 text-xs font-medium text-littoral-dark/70 transition hover:border-littoral-dark/30 hover:text-littoral-dark"
                  >
                    + {t('entretiens.prepa.star.ajouter')}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {prepa.points_de_vigilance.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-littoral-dark">
                {t('entretiens.prepa.pointsVigilance')}
              </h4>
              <ul className="space-y-1.5">
                {prepa.points_de_vigilance.map((point) => (
                  <li key={point} className="flex gap-2 text-sm text-littoral-dark/80">
                    <span aria-hidden className="text-laterite">
                      !
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {prepa.questions_a_poser.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-littoral-dark">
                {t('entretiens.prepa.questionsAPoser')}
              </h4>
              <ul className="space-y-1.5">
                {prepa.questions_a_poser.map((question) => (
                  <li key={question} className="flex gap-2 text-sm text-littoral-dark/80">
                    <span aria-hidden className="text-emerald-600">
                      ?
                    </span>
                    {question}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* --------------------------------------------- réponses STAR */}
      {star.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-littoral-dark">
            {t('entretiens.prepa.star.titre')}
          </h4>
          <p className="mb-2 text-xs text-littoral-dark/55">{t('entretiens.prepa.star.aide')}</p>

          <ul className="space-y-3">
            {star.map((reponse, index) => (
              <li
                key={`${reponse.question}-${index}`}
                className="rounded-xl border border-littoral-light/30 bg-white p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-medium text-littoral-dark">{reponse.question}</p>
                  <button
                    type="button"
                    onClick={() => setStar((liste) => liste.filter((_, i) => i !== index))}
                    aria-label={t('commun.supprimer')}
                    className="shrink-0 rounded-lg px-2 py-0.5 text-littoral-dark/40 transition hover:bg-laterite/10 hover:text-laterite"
                  >
                    ×
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {(['situation', 'tache', 'action', 'resultat'] as const).map((champ) => (
                    <label key={champ} className="space-y-1">
                      <span className="block text-xs font-medium uppercase tracking-wide text-littoral-dark/55">
                        {t(`entretiens.prepa.star.${champ}`)}
                      </span>
                      <textarea
                        rows={2}
                        value={reponse[champ] ?? ''}
                        onChange={(e) => majStar(index, champ, e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------- bilan */}
      <section>
        <label className="block space-y-1.5">
          <span className="block text-sm font-semibold text-littoral-dark">
            {t('entretiens.bilan')}
          </span>
          <textarea
            rows={3}
            value={bilan}
            onChange={(e) => setBilan(e.target.value)}
            placeholder={t('entretiens.bilanPlaceholder')}
            className={INPUT_CLASS}
          />
        </label>
      </section>

      <div className="flex justify-end border-t border-littoral-light/25 pt-4">
        <button
          type="button"
          onClick={enregistrer}
          disabled={isSaving}
          className="rounded-xl bg-littoral-dark px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {isSaving ? t('commun.enregistrement') : t('commun.enregistrer')}
        </button>
      </div>
    </div>
  );
}
