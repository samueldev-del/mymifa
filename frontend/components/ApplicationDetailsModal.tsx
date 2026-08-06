'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from './Modal';
import ScoreRing from './ScoreRing';
import { apiFetch, getErrorMessage } from '@/lib/api';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  IMPORTANCE_META,
  STATUT_META,
  STATUT_VALUES,
  type Application,
  type AtsAnalyse,
  type DocumentItem,
  type DocumentType,
  type Statut,
} from '@/types';

interface DetailsModalProps {
  onClose: () => void;
  application: Application;
  onUpdated: () => void;
}

const ONGLETS = [
  { id: 'informations', label: 'Informations' },
  { id: 'documents', label: 'Documents' },
  { id: 'lettre', label: 'Lettre IA' },
  { id: 'ats', label: 'Analyse ATS' },
] as const;

type OngletId = (typeof ONGLETS)[number]['id'];

const INPUT_CLASS =
  'w-full rounded-xl border border-littoral-light/40 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-littoral-dark';

const BTN_PRIMAIRE =
  'rounded-xl bg-littoral-dark px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50';

const BTN_ACCENT =
  'rounded-xl bg-laterite px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-laterite-hover disabled:cursor-not-allowed disabled:opacity-50';

export default function ApplicationDetailsModal({
  onClose,
  application,
  onUpdated,
}: DetailsModalProps) {
  const [onglet, setOnglet] = useState<OngletId>('informations');

  const [editForm, setEditForm] = useState(() => ({
    titre_poste: application.titre_poste,
    nom_entreprise: application.entreprise_nom || '',
    url_offre: application.url_offre || '',
    description_offre: application.description_offre || '',
    notes: application.notes || '',
    statut: application.statut,
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [typeDocument, setTypeDocument] = useState<DocumentType>('cv');
  const [isUploading, setIsUploading] = useState(false);

  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [analyse, setAnalyse] = useState<AtsAnalyse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [documentAts, setDocumentAts] = useState('');

  const applicationId = application.id;
  const statutMeta = STATUT_META[application.statut];

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const data = await apiFetch<DocumentItem[]>(`/applications/${applicationId}/documents`);
      setDocuments(data || []);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Erreur lors du chargement des documents.'));
    } finally {
      setDocsLoading(false);
    }
  }, [applicationId]);

  const loadAnalyse = useCallback(async () => {
    try {
      const data = await apiFetch<AtsAnalyse | null>(`/applications/${applicationId}/ats`);
      setAnalyse(data);
    } catch {
      // Absence d'analyse antérieure : état normal, rien à signaler.
    }
  }, [applicationId]);

  useEffect(() => {
    const load = async () => {
      await Promise.all([loadDocuments(), loadAnalyse()]);
    };

    load();
  }, [loadDocuments, loadAnalyse]);

  // L'analyse ATS s'appuie sur la lecture PDF native de Claude.
  const pdfsDisponibles = documents.filter((doc) =>
    doc.url_fichier.toLowerCase().split('?')[0].endsWith('.pdf')
  );

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await apiFetch<Application>(`/applications/${applicationId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });

      toast.success('Candidature mise à jour.');
      onUpdated();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Erreur lors de la mise à jour.'));
    } finally {
      setIsSaving(false);
    }
  };

  /** Changement de statut immédiat depuis l'en-tête (déplace la carte du Kanban). */
  const handleStatutChange = async (statut: Statut) => {
    const precedent = editForm.statut;
    setEditForm((prev) => ({ ...prev, statut }));

    try {
      await apiFetch<Application>(`/applications/${applicationId}`, {
        method: 'PUT',
        body: JSON.stringify({ statut }),
      });
      toast.success(`Statut : ${STATUT_META[statut].label}`);
      onUpdated();
    } catch (error: unknown) {
      setEditForm((prev) => ({ ...prev, statut: precedent }));
      toast.error(getErrorMessage(error, 'Impossible de changer le statut.'));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Supprimer cette candidature ? Cette action est irréversible.')) return;

    setIsDeleting(true);
    try {
      await apiFetch<{ id: string }>(`/applications/${applicationId}`, { method: 'DELETE' });
      toast.success('Candidature supprimée.');
      onUpdated();
      onClose();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression.'));
      setIsDeleting(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('application_id', applicationId);
    formData.append('type_document', typeDocument);

    try {
      await apiFetch<DocumentItem>('/documents/upload', { method: 'POST', body: formData });
      setSelectedFile(null);
      (e.target as HTMLFormElement).reset();
      toast.success('Document téléversé.');
      await loadDocuments();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Impossible de téléverser le document.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm('Supprimer ce document ?')) return;

    try {
      await apiFetch<{ id: string }>(`/documents/${id}`, { method: 'DELETE' });
      toast.success('Document supprimé.');
      await loadDocuments();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression du document.'));
    }
  };

  const handleGenerateLetter = async () => {
    setIsGenerating(true);
    setGeneratedLetter('');

    try {
      const data = await apiFetch<{ letter: string }>('/ai/generate-letter', {
        method: 'POST',
        body: JSON.stringify({
          nom_entreprise: application.entreprise_nom,
          description_offre: application.description_offre || '',
        }),
      });
      setGeneratedLetter(data?.letter || '');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Impossible de générer la lettre.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyse = async () => {
    if (!documentAts) return;

    setIsAnalyzing(true);
    try {
      const data = await apiFetch<AtsAnalyse>('/ai/analyse-ats', {
        method: 'POST',
        body: JSON.stringify({ application_id: applicationId, document_id: documentAts }),
      });
      setAnalyse(data);
      toast.success(`Analyse terminée : ${data.score}% de compatibilité.`);
      onUpdated();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erreur lors de l'analyse ATS."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="titre-candidature" className="max-w-3xl">
      <div className="border-b border-littoral-light/30 px-6 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="titre-candidature" className="truncate text-2xl font-bold text-littoral-dark">
              {application.titre_poste}
            </h2>
            <p className="truncate text-littoral-dark/70">{application.entreprise_nom}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statutMeta?.badge ?? ''}`}
            >
              <span className={`size-1.5 rounded-full ${statutMeta?.dot ?? ''}`} />
              {statutMeta?.label ?? application.statut}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-lg px-2 py-1 text-xl leading-none text-littoral-dark/50 transition hover:bg-coton-dark hover:text-littoral-dark"
            >
              ×
            </button>
          </div>
        </div>

        <div role="tablist" aria-label="Sections de la candidature" className="mt-5 flex gap-1 overflow-x-auto">
          {ONGLETS.map((item) => {
            const actif = onglet === item.id;

            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={actif}
                onClick={() => setOnglet(item.id)}
                className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  actif
                    ? 'border-laterite text-laterite'
                    : 'border-transparent text-littoral-dark/60 hover:text-littoral-dark'
                }`}
              >
                {item.label}
                {item.id === 'documents' && documents.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-littoral-light/25 px-1.5 py-0.5 text-xs text-littoral-dark">
                    {documents.length}
                  </span>
                )}
                {item.id === 'ats' && typeof application.ats_score === 'number' && (
                  <span className="ml-1.5 rounded-full bg-littoral-light/25 px-1.5 py-0.5 text-xs text-littoral-dark">
                    {application.ats_score}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" className="flex-1 overflow-y-auto px-6 py-5">
        {/* ---------------------------- Informations --------------------------- */}
        {onglet === 'informations' && (
          <form onSubmit={handleUpdate} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-littoral-dark">Statut</label>
              <div className="flex flex-wrap gap-2">
                {STATUT_VALUES.map((statut) => {
                  const meta = STATUT_META[statut];
                  const actif = editForm.statut === statut;

                  return (
                    <button
                      key={statut}
                      type="button"
                      onClick={() => handleStatutChange(statut)}
                      aria-pressed={actif}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        actif
                          ? `${meta.badge} border-transparent ring-2 ring-littoral-dark/20`
                          : 'border-littoral-light/40 text-littoral-dark/60 hover:border-littoral-dark/30 hover:text-littoral-dark'
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-littoral-dark/50">
                Le changement est appliqué immédiatement et déplace la carte dans le tableau.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">Titre du poste</span>
                <input
                  type="text"
                  value={editForm.titre_poste}
                  onChange={(e) => setEditForm((p) => ({ ...p, titre_poste: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">Entreprise</span>
                <input
                  type="text"
                  value={editForm.nom_entreprise}
                  onChange={(e) => setEditForm((p) => ({ ...p, nom_entreprise: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">URL de l&apos;offre</span>
              <input
                type="url"
                value={editForm.url_offre}
                onChange={(e) => setEditForm((p) => ({ ...p, url_offre: e.target.value }))}
                placeholder="https://..."
                className={INPUT_CLASS}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">
                Description de l&apos;offre
              </span>
              <textarea
                rows={5}
                value={editForm.description_offre}
                onChange={(e) => setEditForm((p) => ({ ...p, description_offre: e.target.value }))}
                className={INPUT_CLASS}
              />
              <span className="block text-xs text-littoral-dark/50">
                Utilisée par la génération de lettre et l&apos;analyse ATS.
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">Notes personnelles</span>
              <textarea
                rows={4}
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Contact rencontré, salaire évoqué, points à préparer..."
                className={INPUT_CLASS}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-littoral-light/30 pt-4">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="rounded-xl border border-laterite/40 px-4 py-2.5 text-sm font-semibold text-laterite transition-colors hover:bg-laterite/10 disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer la candidature'}
              </button>

              <button type="submit" disabled={isSaving} className={BTN_PRIMAIRE}>
                {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        )}

        {/* ----------------------------- Documents ----------------------------- */}
        {onglet === 'documents' && (
          <div className="space-y-6">
            <form
              onSubmit={handleUpload}
              className="space-y-3 rounded-2xl border border-littoral-light/30 bg-coton-dark/40 p-4"
            >
              <h3 className="text-sm font-semibold text-littoral-dark">Attacher un document</h3>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="cursor-pointer text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-littoral-light/30 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-littoral-dark hover:file:bg-littoral-light/50"
                />
                <select
                  value={typeDocument}
                  onChange={(e) => setTypeDocument(e.target.value as DocumentType)}
                  aria-label="Type de document"
                  className={INPUT_CLASS}
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={!selectedFile || isUploading} className={BTN_PRIMAIRE}>
                {isUploading ? 'Téléversement...' : 'Ajouter le document'}
              </button>
              <p className="text-xs text-littoral-dark/50">PDF, DOC ou DOCX — 10 Mo maximum.</p>
            </form>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-littoral-dark">Documents attachés</h3>

              {docsLoading ? (
                <div className="space-y-2">
                  <div className="h-14 animate-pulse rounded-xl bg-coton-dark/60" />
                  <div className="h-14 animate-pulse rounded-xl bg-coton-dark/40" />
                </div>
              ) : documents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-littoral-light/40 px-4 py-8 text-center text-sm text-littoral-dark/60">
                  Aucun document attaché à cette candidature.
                </p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-littoral-light/30 bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <a
                          href={doc.url_telechargement ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate font-medium text-littoral-dark underline decoration-littoral-light hover:text-laterite"
                        >
                          {doc.nom_fichier || doc.libelle || 'Document'}
                        </a>
                        <span className="text-xs text-littoral-dark/50">
                          {DOCUMENT_TYPE_LABELS[doc.type_document] ?? doc.type_document}
                          {doc.created_at &&
                            ` · ${new Date(doc.created_at).toLocaleDateString('fr-FR')}`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        aria-label={`Supprimer ${doc.nom_fichier || 'le document'}`}
                        className="shrink-0 rounded-lg px-2 py-1 text-sm text-littoral-dark/40 transition hover:bg-laterite/10 hover:text-laterite"
                      >
                        Supprimer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------ Lettre IA ---------------------------- */}
        {onglet === 'lettre' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-littoral-dark">Lettre de motivation</h3>
                <p className="text-sm text-littoral-dark/60">
                  Générée par Claude à partir de la description de l&apos;offre.
                </p>
              </div>

              <button
                onClick={handleGenerateLetter}
                disabled={isGenerating || !application.description_offre}
                className={BTN_ACCENT}
              >
                {isGenerating ? 'Génération...' : generatedLetter ? 'Regénérer' : 'Générer avec Claude'}
              </button>
            </div>

            {!application.description_offre && (
              <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Ajoutez une description de l&apos;offre dans l&apos;onglet Informations pour obtenir
                une lettre pertinente.
              </p>
            )}

            {isGenerating && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-4 animate-pulse rounded bg-coton-dark/60"
                    style={{ width: `${100 - i * 8}%` }}
                  />
                ))}
              </div>
            )}

            {generatedLetter && !isGenerating && (
              <div className="space-y-3">
                <pre className="whitespace-pre-wrap rounded-2xl border border-littoral-light/30 bg-coton-dark/40 p-4 font-sans text-sm leading-relaxed text-littoral-dark/90">
                  {generatedLetter}
                </pre>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(generatedLetter);
                    toast.success('Lettre copiée dans le presse-papiers.');
                  }}
                  className="rounded-xl border border-littoral-dark/20 px-4 py-2 text-sm font-medium text-littoral-dark transition hover:bg-coton-dark"
                >
                  Copier la lettre
                </button>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------- Analyse ATS --------------------------- */}
        {onglet === 'ats' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-littoral-light/30 bg-coton-dark/40 p-4">
              <h3 className="mb-1 font-semibold text-littoral-dark">Analyse de compatibilité</h3>
              <p className="mb-3 text-sm text-littoral-dark/60">
                Claude lit votre CV et le compare à la description du poste pour estimer vos chances
                de passer un filtre ATS.
              </p>

              {pdfsDisponibles.length === 0 ? (
                <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Attachez d&apos;abord un CV au format PDF dans l&apos;onglet Documents.
                </p>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex-1 space-y-1.5">
                    <span className="block text-sm font-medium text-littoral-dark">CV à analyser</span>
                    <select
                      value={documentAts}
                      onChange={(e) => setDocumentAts(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="">Choisir un document…</option>
                      {pdfsDisponibles.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.nom_fichier || doc.libelle || 'Document'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    onClick={handleAnalyse}
                    disabled={isAnalyzing || !documentAts}
                    className={BTN_ACCENT}
                  >
                    {isAnalyzing ? 'Analyse en cours...' : 'Lancer l’analyse'}
                  </button>
                </div>
              )}
            </div>

            {isAnalyzing && (
              <p className="text-center text-sm text-littoral-dark/60">
                Claude lit le PDF et compare les compétences… cela prend quelques secondes.
              </p>
            )}

            {analyse && !isAnalyzing && (
              <div className="animate-fade-in space-y-5">
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-littoral-light/30 bg-white p-5 sm:flex-row sm:items-start">
                  <ScoreRing score={analyse.score} size={96} withLabel />
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-sm leading-relaxed text-littoral-dark/80">{analyse.synthese}</p>
                    {analyse.analyse_le && (
                      <p className="mt-2 text-xs text-littoral-dark/50">
                        Analysé le {new Date(analyse.analyse_le).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>

                {analyse.mots_cles_manquants.length > 0 && (
                  <section>
                    <h4 className="mb-2 text-sm font-semibold text-littoral-dark">
                      Mots-clés manquants
                    </h4>
                    <ul className="flex flex-wrap gap-2">
                      {analyse.mots_cles_manquants.map((mot) => {
                        const meta = IMPORTANCE_META[mot.importance];
                        return (
                          <li
                            key={mot.mot_cle}
                            title={meta?.label}
                            className={`rounded-full border px-3 py-1 text-sm ${meta?.className ?? ''}`}
                          >
                            {mot.mot_cle}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {analyse.points_forts.length > 0 && (
                  <section>
                    <h4 className="mb-2 text-sm font-semibold text-littoral-dark">Points forts</h4>
                    <ul className="space-y-1.5">
                      {analyse.points_forts.map((point) => (
                        <li key={point} className="flex gap-2 text-sm text-littoral-dark/80">
                          <span aria-hidden className="text-emerald-600">
                            ✓
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {analyse.recommandations.length > 0 && (
                  <section>
                    <h4 className="mb-2 text-sm font-semibold text-littoral-dark">Recommandations</h4>
                    <ul className="space-y-1.5">
                      {analyse.recommandations.map((reco) => (
                        <li key={reco} className="flex gap-2 text-sm text-littoral-dark/80">
                          <span aria-hidden className="text-laterite">
                            →
                          </span>
                          {reco}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}

            {!analyse && !isAnalyzing && pdfsDisponibles.length > 0 && (
              <p className="rounded-xl border border-dashed border-littoral-light/40 px-4 py-8 text-center text-sm text-littoral-dark/60">
                Aucune analyse pour cette candidature.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
