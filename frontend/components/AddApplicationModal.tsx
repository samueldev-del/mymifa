'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Modal from './Modal';
import { apiFetch, getErrorMessage } from '@/lib/api';
import type { Application } from '@/types';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_FORM = {
  nom_entreprise: '',
  titre_poste: '',
  url_offre: '',
  description_offre: '',
};

const INPUT_CLASS =
  'w-full rounded-xl border border-littoral-light/40 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-littoral-dark';

export default function AddApplicationModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiFetch<Application>('/applications', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setFormData(EMPTY_FORM);
      toast.success('Candidature créée avec succès.');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Impossible de sauvegarder la candidature.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="titre-nouvelle-candidature" className="max-w-2xl">
      <div className="flex items-center justify-between border-b border-littoral-light/30 px-6 py-4">
        <h2 id="titre-nouvelle-candidature" className="text-xl font-bold text-littoral-dark">
          Nouvelle candidature
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-lg px-2 py-1 text-xl leading-none text-littoral-dark/50 transition hover:bg-coton-dark hover:text-littoral-dark"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-littoral-dark">
              Nom de l&apos;entreprise *
            </span>
            <input
              type="text"
              required
              autoFocus
              value={formData.nom_entreprise}
              onChange={(e) => setFormData({ ...formData, nom_entreprise: e.target.value })}
              className={INPUT_CLASS}
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-littoral-dark">Titre du poste *</span>
            <input
              type="text"
              required
              value={formData.titre_poste}
              onChange={(e) => setFormData({ ...formData, titre_poste: e.target.value })}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-littoral-dark">URL de l&apos;offre</span>
          <input
            type="url"
            value={formData.url_offre}
            onChange={(e) => setFormData({ ...formData, url_offre: e.target.value })}
            placeholder="https://..."
            className={INPUT_CLASS}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-littoral-dark">
            Description de l&apos;offre
          </span>
          <textarea
            rows={6}
            value={formData.description_offre}
            onChange={(e) => setFormData({ ...formData, description_offre: e.target.value })}
            placeholder="Collez ici le contenu de l'annonce…"
            className={INPUT_CLASS}
          />
          <span className="block text-xs text-littoral-dark/50">
            Alimente la génération de lettre et l&apos;analyse ATS.
          </span>
        </label>

        <div className="flex justify-end gap-3 border-t border-littoral-light/30 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-littoral-dark/20 px-4 py-2.5 text-sm font-medium text-littoral-dark transition-colors hover:bg-coton-dark"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-laterite px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-laterite-hover disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Créer la candidature'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
