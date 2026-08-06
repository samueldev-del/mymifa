'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import AddApplicationModal from '@/components/AddApplicationModal';
import ApplicationDetailsModal from '@/components/ApplicationDetailsModal';
import ScoreRing from '@/components/ScoreRing';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { KANBAN_COLUMNS, STATUT_META, type Application } from '@/types';

export default function Home() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  const fetchApplications = useCallback(async () => {
    try {
      const data = await apiFetch<Application[]>('/applications');
      setApplications(data || []);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Impossible de charger les candidatures.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchApplications();
    };

    load();
  }, [fetchApplications]);

  const filtrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return applications;

    return applications.filter(
      (app) =>
        app.titre_poste.toLowerCase().includes(terme) ||
        (app.entreprise_nom || '').toLowerCase().includes(terme)
    );
  }, [applications, recherche]);

  // La modale lit toujours la version fraîche de la candidature sélectionnée :
  // après une sauvegarde, le rafraîchissement de la liste la met à jour.
  const selectedApp = useMemo(
    () => applications.find((app) => app.id === selectedId) ?? null,
    [applications, selectedId]
  );

  const enCours = applications.filter((app) => ['envoye', 'entretien'].includes(app.statut)).length;

  return (
    <main className="bg-coton px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 inline-flex rounded-full border border-littoral-light/40 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-littoral-dark/70">
              Espace candidat
            </p>
            <h1 className="text-3xl font-bold text-littoral-dark">Tracker de carrière</h1>
            <p className="mt-1 text-littoral-dark/70">
              {applications.length === 0
                ? 'Gérez vos opportunités avec précision et sérénité.'
                : `${applications.length} candidature${applications.length > 1 ? 's' : ''} · ${enCours} en cours`}
            </p>
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
                placeholder="Rechercher un poste ou une entreprise"
                aria-label="Rechercher une candidature"
                className="w-full rounded-xl border border-littoral-light/40 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-littoral-dark sm:w-72"
              />
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="rounded-xl bg-laterite px-6 py-2.5 font-semibold text-white shadow-lg shadow-laterite/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-laterite-hover hover:shadow-laterite/50 active:translate-y-0"
            >
              + Nouvelle candidature
            </button>
          </div>
        </header>

        <AddApplicationModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={fetchApplications}
        />

        {selectedApp && (
          <ApplicationDetailsModal
            key={selectedApp.id}
            onClose={() => setSelectedId(null)}
            application={selectedApp}
            onUpdated={fetchApplications}
          />
        )}

        {loading ? (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {KANBAN_COLUMNS.map((column) => (
              <div
                key={column.title}
                className="h-64 animate-pulse rounded-2xl border border-littoral-light/20 bg-coton-dark/40"
              />
            ))}
          </section>
        ) : applications.length === 0 ? (
          <div className="animate-fade-in rounded-3xl border border-dashed border-littoral-light/50 bg-white/60 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-littoral-dark">Aucune candidature pour l&apos;instant</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-littoral-dark/70">
              Ajoutez votre première opportunité pour suivre son avancement, générer une lettre et
              mesurer la compatibilité de votre CV.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-6 rounded-xl bg-laterite px-6 py-2.5 font-semibold text-white transition hover:bg-laterite-hover"
            >
              + Nouvelle candidature
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {KANBAN_COLUMNS.map((column) => {
              const items = filtrees.filter((app) => column.statuts.includes(app.statut));

              return (
                <div
                  key={column.title}
                  className="flex flex-col rounded-2xl border border-littoral-light/30 bg-coton-dark/40 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-bold text-littoral-dark">{column.title}</h2>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-littoral-dark">
                      {items.length}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <p className="rounded-xl border border-littoral-light/20 bg-white/70 px-4 py-3 text-sm text-littoral-dark/60">
                      {recherche ? 'Aucun résultat' : 'Aucune candidature'}
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
                                {meta?.label ?? app.statut}
                              </span>
                              {app.notes && (
                                <span
                                  title="Contient des notes"
                                  aria-label="Contient des notes"
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
      </div>
    </main>
  );
}
