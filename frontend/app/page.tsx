'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import AddApplicationModal from '@/components/AddApplicationModal';
import ApplicationDetailsModal from '@/components/ApplicationDetailsModal';
import ScoreRing from '@/components/ScoreRing';
import StatCard from '@/components/StatCard';
import Panneau from '@/components/Panneau';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { useLangue } from '@/i18n';
import {
  KANBAN_COLUMNS,
  STATUT_META,
  type Application,
  type DashboardData,
} from '@/types';

export default function Home() {
  const { t, formatLocale } = useLangue();

  const [applications, setApplications] = useState<Application[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  const rafraichir = useCallback(async () => {
    try {
      // Les deux appels sont indépendants : les paralléliser évite d'ajouter
      // la latence de l'un à celle de l'autre.
      const [apps, stats] = await Promise.all([
        apiFetch<Application[]>('/applications'),
        apiFetch<DashboardData>('/dashboard'),
      ]);
      setApplications(apps || []);
      setDashboard(stats);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const load = async () => {
      await rafraichir();
    };

    load();
  }, [rafraichir]);

  const filtrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return applications;

    return applications.filter(
      (app) =>
        app.titre_poste.toLowerCase().includes(terme) ||
        (app.entreprise_nom || '').toLowerCase().includes(terme)
    );
  }, [applications, recherche]);

  const selectedApp = useMemo(
    () => applications.find((app) => app.id === selectedId) ?? null,
    [applications, selectedId]
  );

  const formatDate = (valeur: string, avecHeure = false) =>
    new Date(valeur).toLocaleDateString(formatLocale, {
      day: '2-digit',
      month: 'short',
      ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
    });

  const stats = dashboard?.candidatures;
  const formationsActives =
    (dashboard?.formations.par_statut.en_cours || 0) + (dashboard?.formations.par_statut.prevue || 0);

  return (
    <main className="bg-coton px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ------------------------------------------------------- en-tête */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 inline-flex rounded-full border border-littoral-light/40 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-littoral-dark/70">
              {t('dashboard.badge')}
            </p>
            <h1 className="text-3xl font-bold text-littoral-dark">{t('dashboard.titre')}</h1>
            <p className="mt-1 text-littoral-dark/70">{t('dashboard.sousTitre')}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-littoral-dark/40"
              >
                ⌕
              </span>
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={t('dashboard.rechercherPlaceholder')}
                aria-label={t('commun.rechercher')}
                className="w-full rounded-xl border border-littoral-light/40 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-littoral-dark sm:w-72"
              />
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="shrink-0 rounded-xl bg-laterite px-6 py-2.5 font-semibold text-white shadow-lg shadow-laterite/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-laterite-hover hover:shadow-laterite/50 active:translate-y-0"
            >
              + {t('dashboard.nouvelleCandidature')}
            </button>
          </div>
        </header>

        <AddApplicationModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={rafraichir}
        />

        {selectedApp && (
          <ApplicationDetailsModal
            key={selectedApp.id}
            onClose={() => setSelectedId(null)}
            application={selectedApp}
            onUpdated={rafraichir}
          />
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-coton-dark/50" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-coton-dark/40" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* --------------------------------------------- indicateurs */}
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label={t('dashboard.kpi.actives')}
                valeur={stats?.actives ?? 0}
                aide={t('dashboard.kpi.actives_aide')}
                ton="accent"
              />
              <StatCard
                label={t('dashboard.kpi.tauxEntretien')}
                valeur={stats?.taux_entretien ?? '—'}
                suffixe={stats?.taux_entretien != null ? '%' : undefined}
                aide={t('dashboard.kpi.tauxEntretien_aide')}
                ton={stats?.taux_entretien != null && stats.taux_entretien >= 25 ? 'succes' : 'neutre'}
              />
              <StatCard
                label={t('dashboard.kpi.scoreMoyen')}
                valeur={stats?.score_ats_moyen ?? '—'}
                aide={t('dashboard.kpi.scoreMoyen_aide')}
                ton={
                  stats?.score_ats_moyen != null && stats.score_ats_moyen < 50 ? 'alerte' : 'neutre'
                }
              />
              <StatCard
                label={t('dashboard.kpi.formations')}
                valeur={formationsActives}
                aide={t('dashboard.kpi.formations_aide')}
              />
            </section>

            {/* ------------------------- entretiens · relances · lacunes */}
            <section className="grid gap-6 lg:grid-cols-3">
              <Panneau
                titre={t('dashboard.prochainsEntretiens')}
                lien={{ href: '/entretiens', label: t('commun.tout') }}
              >
                {!dashboard?.entretiens_a_venir.length ? (
                  <p className="rounded-xl border border-dashed border-littoral-light/40 px-4 py-6 text-center text-sm text-littoral-dark/55">
                    {t('dashboard.aucunEntretien')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {dashboard.entretiens_a_venir.map((entretien) => (
                      <li key={entretien.id}>
                        <Link
                          href="/entretiens"
                          className="block rounded-xl border border-littoral-light/25 px-3.5 py-3 transition hover:border-littoral-light/60 hover:bg-coton-dark/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate font-medium text-littoral-dark">
                              {entretien.titre_poste}
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-laterite">
                              {formatDate(entretien.date_entretien, true)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-littoral-dark/55">
                            <span className="truncate">{entretien.entreprise_nom}</span>
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 font-medium ${
                                entretien.prepare
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {entretien.prepare ? t('dashboard.prepare') : t('dashboard.aPreparer')}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panneau>

              <Panneau titre={t('dashboard.relances')}>
                {!dashboard?.relances_en_attente.length ? (
                  <p className="rounded-xl border border-dashed border-littoral-light/40 px-4 py-6 text-center text-sm text-littoral-dark/55">
                    {t('dashboard.aucuneRelance')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {dashboard.relances_en_attente.map((relance) => (
                      <li
                        key={relance.id}
                        className={`rounded-xl border px-3.5 py-3 ${
                          relance.en_retard
                            ? 'border-laterite/30 bg-laterite/5'
                            : 'border-littoral-light/25'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate font-medium text-littoral-dark">
                            {relance.libelle}
                          </span>
                          <span
                            className={`shrink-0 text-xs font-semibold ${
                              relance.en_retard ? 'text-laterite' : 'text-littoral-dark/55'
                            }`}
                          >
                            {relance.en_retard
                              ? t('dashboard.enRetard')
                              : formatDate(relance.echeance)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-littoral-dark/55">
                          {relance.titre_poste} · {relance.entreprise_nom}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panneau>

              <Panneau
                titre={t('dashboard.lacunes')}
                aide={t('dashboard.lacunes_aide')}
                lien={{ href: '/formations', label: t('dashboard.planifierFormation') }}
              >
                {!dashboard?.lacunes.length ? (
                  <p className="rounded-xl border border-dashed border-littoral-light/40 px-4 py-6 text-center text-sm text-littoral-dark/55">
                    {t('dashboard.aucuneLacune')}
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {dashboard.lacunes.map((lacune) => (
                      <li
                        key={lacune.mot_cle}
                        title={
                          lacune.couverte
                            ? t('dashboard.couverte')
                            : `${lacune.occurrences}×`
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                          lacune.couverte
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 line-through decoration-emerald-400/60'
                            : lacune.importance_max === 'critique'
                              ? 'border-laterite/30 bg-laterite/10 text-laterite'
                              : 'border-littoral-light/40 bg-coton-dark/50 text-littoral-dark'
                        }`}
                      >
                        {lacune.mot_cle}
                        {lacune.occurrences > 1 && (
                          <span className="text-xs opacity-60">×{lacune.occurrences}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panneau>
            </section>

            {/* ------------------------------------------------- pipeline */}
            {applications.length === 0 ? (
              <div className="animate-fade-in rounded-2xl border border-dashed border-littoral-light/50 bg-white/60 px-6 py-14 text-center">
                <p className="text-lg font-semibold text-littoral-dark">
                  {t('dashboard.vide.titre')}
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-littoral-dark/70">
                  {t('dashboard.vide.texte')}
                </p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-6 rounded-xl bg-laterite px-6 py-2.5 font-semibold text-white transition hover:bg-laterite-hover"
                >
                  + {t('dashboard.nouvelleCandidature')}
                </button>
              </div>
            ) : (
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {KANBAN_COLUMNS.map((column) => {
                  const items = filtrees.filter((app) => column.statuts.includes(app.statut));

                  return (
                    <div
                      key={column.cle}
                      className="flex flex-col rounded-2xl border border-littoral-light/30 bg-coton-dark/40 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="font-bold text-littoral-dark">{t(column.cle)}</h2>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-littoral-dark">
                          {items.length}
                        </span>
                      </div>

                      {items.length === 0 ? (
                        <p className="rounded-xl border border-littoral-light/20 bg-white/70 px-4 py-3 text-sm text-littoral-dark/55">
                          {recherche ? t('commun.aucunResultat') : t('kanban.aucuneCandidature')}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {items.map((app) => {
                            const meta = STATUT_META[app.statut];

                            return (
                              <button
                                key={app.id}
                                type="button"
                                onClick={() => setSelectedId(app.id)}
                                className="group block w-full rounded-2xl border border-littoral-light/20 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-littoral-light/50 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-laterite"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h3 className="truncate font-semibold text-littoral-dark">
                                      {app.titre_poste}
                                    </h3>
                                    <p className="truncate text-sm text-littoral-dark/70">
                                      {app.entreprise_nom}
                                    </p>
                                  </div>
                                  {typeof app.ats_score === 'number' && (
                                    <ScoreRing score={app.ats_score} size={38} />
                                  )}
                                </div>

                                <div className="mt-3 flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta?.badge ?? ''}`}
                                  >
                                    <span className={`size-1.5 rounded-full ${meta?.dot ?? ''}`} />
                                    {t(`statut.${app.statut}`)}
                                  </span>
                                  {app.notes && (
                                    <span
                                      title={t('candidature.notes')}
                                      className="text-xs text-littoral-dark/40"
                                    >
                                      ✎
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
