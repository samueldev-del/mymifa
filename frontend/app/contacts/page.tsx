'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/Modal';
import { apiFetch, getErrorMessage } from '@/lib/api';
import { useLangue } from '@/i18n';
import type { Application, Contact, Relance } from '@/types';

const INPUT_CLASS =
  'w-full rounded-xl border border-littoral-light/40 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-littoral-dark';

const CONTACT_VIDE = {
  nom: '',
  role: '',
  email: '',
  telephone: '',
  linkedin_url: '',
  notes: '',
  application_id: '',
};

const RELANCE_VIDE = { application_id: '', libelle: '', echeance: '' };

export default function ContactsPage() {
  const { t, formatLocale } = useLangue();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [relances, setRelances] = useState<Relance[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modaleContact, setModaleContact] = useState(false);
  const [enEdition, setEnEdition] = useState<Contact | null>(null);
  const [formContact, setFormContact] = useState(CONTACT_VIDE);
  const [modaleRelance, setModaleRelance] = useState(false);
  const [formRelance, setFormRelance] = useState(RELANCE_VIDE);
  const [isSaving, setIsSaving] = useState(false);

  const charger = useCallback(async () => {
    try {
      const [c, r, a] = await Promise.all([
        apiFetch<Contact[]>('/contacts'),
        apiFetch<Relance[]>('/relances'),
        apiFetch<Application[]>('/applications'),
      ]);
      setContacts(c || []);
      setRelances(r || []);
      setApplications(a || []);
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

  const enregistrerContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Le backend rejette une chaîne vide sur un champ UUID : on l'omet.
    const corps: Record<string, string> = { ...formContact };
    if (!corps.application_id) delete corps.application_id;

    try {
      if (enEdition) {
        await apiFetch<Contact>(`/contacts/${enEdition.id}`, {
          method: 'PUT',
          body: JSON.stringify(corps),
        });
        toast.success(t('contacts.misAJour'));
      } else {
        await apiFetch<Contact>('/contacts', { method: 'POST', body: JSON.stringify(corps) });
        toast.success(t('contacts.cree'));
      }
      setModaleContact(false);
      await charger();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    } finally {
      setIsSaving(false);
    }
  };

  const supprimerContact = async (contact: Contact) => {
    if (!window.confirm(t('commun.confirmerSuppression'))) return;
    try {
      await apiFetch<{ id: string }>(`/contacts/${contact.id}`, { method: 'DELETE' });
      toast.success(t('contacts.supprime'));
      await charger();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    }
  };

  const enregistrerRelance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiFetch<Relance>('/relances', { method: 'POST', body: JSON.stringify(formRelance) });
      toast.success(t('relances.creee'));
      setModaleRelance(false);
      await charger();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    } finally {
      setIsSaving(false);
    }
  };

  const basculerRelance = async (relance: Relance) => {
    try {
      await apiFetch<Relance>(`/relances/${relance.id}`, {
        method: 'PUT',
        body: JSON.stringify({ fait: !relance.fait }),
      });
      toast.success(relance.fait ? t('relances.reouverte') : t('relances.faite'));
      await charger();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t('commun.erreurReseau')));
    }
  };

  const formatDate = (valeur: string) => new Date(valeur).toLocaleDateString(formatLocale);

  return (
    <main className="bg-coton px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* --------------------------------------------------- relances */}
        <section className="space-y-4">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-littoral-dark">{t('relances.titre')}</h1>
            </div>
            <button
              onClick={() => {
                setFormRelance(RELANCE_VIDE);
                setModaleRelance(true);
              }}
              disabled={applications.length === 0}
              className="shrink-0 rounded-xl border border-littoral-dark/20 px-4 py-2.5 text-sm font-semibold text-littoral-dark transition hover:bg-coton-dark disabled:opacity-50"
            >
              + {t('relances.ajouter')}
            </button>
          </header>

          {isLoading ? (
            <div className="h-20 animate-pulse rounded-2xl bg-coton-dark/50" />
          ) : relances.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-littoral-light/50 bg-white/60 px-6 py-8 text-center text-sm text-littoral-dark/60">
              {t('relances.aucune')}
            </p>
          ) : (
            <ul className="space-y-2">
              {relances.map((relance) => (
                <li
                  key={relance.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 ${
                    relance.fait
                      ? 'border-littoral-light/20 opacity-60'
                      : relance.en_retard
                        ? 'border-laterite/30 bg-laterite/5'
                        : 'border-littoral-light/30'
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={relance.fait}
                      onChange={() => basculerRelance(relance)}
                      aria-label={t('relances.marquerFaite')}
                      className="size-4 shrink-0 accent-laterite"
                    />
                    <span className="min-w-0">
                      <span
                        className={`block truncate font-medium text-littoral-dark ${relance.fait ? 'line-through' : ''}`}
                      >
                        {relance.libelle}
                      </span>
                      <span className="block truncate text-xs text-littoral-dark/55">
                        {relance.titre_poste} · {relance.entreprise_nom} · {formatDate(relance.echeance)}
                      </span>
                    </span>
                  </label>

                  {!relance.fait && relance.en_retard && (
                    <span className="shrink-0 rounded-full bg-laterite/15 px-2 py-0.5 text-xs font-semibold text-laterite">
                      {t('dashboard.enRetard')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --------------------------------------------------- contacts */}
        <section className="space-y-4">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-littoral-dark">{t('contacts.titre')}</h2>
              <p className="mt-1 text-littoral-dark/70">{t('contacts.sousTitre')}</p>
            </div>
            <button
              onClick={() => {
                setEnEdition(null);
                setFormContact(CONTACT_VIDE);
                setModaleContact(true);
              }}
              className="shrink-0 rounded-xl bg-laterite px-5 py-2.5 font-semibold text-white transition hover:bg-laterite-hover"
            >
              + {t('contacts.ajouter')}
            </button>
          </header>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-coton-dark/50" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-littoral-light/50 bg-white/60 px-6 py-12 text-center text-littoral-dark/60">
              {t('contacts.aucun')}
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="rounded-2xl border border-littoral-light/30 bg-white p-4 transition hover:border-littoral-light/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-littoral-dark">{contact.nom}</p>
                      <p className="truncate text-sm text-littoral-dark/60">
                        {[contact.role, contact.entreprise_nom].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => {
                          setEnEdition(contact);
                          setFormContact({
                            nom: contact.nom,
                            role: contact.role || '',
                            email: contact.email || '',
                            telephone: contact.telephone || '',
                            linkedin_url: contact.linkedin_url || '',
                            notes: contact.notes || '',
                            application_id: contact.application_id || '',
                          });
                          setModaleContact(true);
                        }}
                        className="rounded-lg px-2 py-1 text-xs text-littoral-dark/60 transition hover:bg-coton-dark"
                      >
                        {t('commun.modifier')}
                      </button>
                      <button
                        onClick={() => supprimerContact(contact)}
                        className="rounded-lg px-2 py-1 text-xs text-littoral-dark/40 transition hover:bg-laterite/10 hover:text-laterite"
                      >
                        {t('commun.supprimer')}
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="text-laterite hover:underline">
                        {contact.email}
                      </a>
                    )}
                    {contact.telephone && (
                      <a href={`tel:${contact.telephone}`} className="text-littoral-dark/70">
                        {contact.telephone}
                      </a>
                    )}
                    {contact.linkedin_url && (
                      <a
                        href={contact.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-laterite hover:underline"
                      >
                        LinkedIn
                      </a>
                    )}
                  </div>

                  {contact.notes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-littoral-dark/70">
                      {contact.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ------------------------------------------------ modale contact */}
      {modaleContact && (
        <Modal onClose={() => setModaleContact(false)} labelledBy="titre-contact" className="max-w-xl">
          <div className="flex items-center justify-between border-b border-littoral-light/30 px-6 py-4">
            <h2 id="titre-contact" className="text-xl font-bold text-littoral-dark">
              {enEdition ? t('commun.modifier') : t('contacts.ajouter')}
            </h2>
            <button
              onClick={() => setModaleContact(false)}
              aria-label={t('commun.fermer')}
              className="rounded-lg px-2 py-1 text-xl leading-none text-littoral-dark/50 transition hover:bg-coton-dark"
            >
              ×
            </button>
          </div>

          <form onSubmit={enregistrerContact} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">
                  {t('contacts.nom')} *
                </span>
                <input
                  required
                  autoFocus
                  value={formContact.nom}
                  onChange={(e) => setFormContact((f) => ({ ...f, nom: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">{t('contacts.role')}</span>
                <input
                  value={formContact.role}
                  onChange={(e) => setFormContact((f) => ({ ...f, role: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">{t('contacts.email')}</span>
                <input
                  type="email"
                  value={formContact.email}
                  onChange={(e) => setFormContact((f) => ({ ...f, email: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-littoral-dark">
                  {t('contacts.telephone')}
                </span>
                <input
                  value={formContact.telephone}
                  onChange={(e) => setFormContact((f) => ({ ...f, telephone: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">
                {t('contacts.linkedin')}
              </span>
              <input
                type="url"
                placeholder="https://linkedin.com/in/…"
                value={formContact.linkedin_url}
                onChange={(e) => setFormContact((f) => ({ ...f, linkedin_url: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">
                {t('contacts.rattacher')}
              </span>
              <select
                value={formContact.application_id}
                onChange={(e) => setFormContact((f) => ({ ...f, application_id: e.target.value }))}
                className={INPUT_CLASS}
              >
                <option value="">{t('contacts.aucuneCandidature')}</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.titre_poste} — {app.entreprise_nom}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">{t('contacts.notes')}</span>
              <textarea
                rows={3}
                value={formContact.notes}
                onChange={(e) => setFormContact((f) => ({ ...f, notes: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>

            <div className="flex justify-end gap-3 border-t border-littoral-light/30 pt-4">
              <button
                type="button"
                onClick={() => setModaleContact(false)}
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

      {/* ------------------------------------------------ modale relance */}
      {modaleRelance && (
        <Modal onClose={() => setModaleRelance(false)} labelledBy="titre-relance" className="max-w-lg">
          <div className="flex items-center justify-between border-b border-littoral-light/30 px-6 py-4">
            <h2 id="titre-relance" className="text-xl font-bold text-littoral-dark">
              {t('relances.ajouter')}
            </h2>
            <button
              onClick={() => setModaleRelance(false)}
              aria-label={t('commun.fermer')}
              className="rounded-lg px-2 py-1 text-xl leading-none text-littoral-dark/50 transition hover:bg-coton-dark"
            >
              ×
            </button>
          </div>

          <form onSubmit={enregistrerRelance} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">
                {t('nav.bewerbungen')} *
              </span>
              <select
                required
                value={formRelance.application_id}
                onChange={(e) => setFormRelance((f) => ({ ...f, application_id: e.target.value }))}
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
                {t('relances.libelle')} *
              </span>
              <input
                required
                placeholder={t('relances.libellePlaceholder')}
                value={formRelance.libelle}
                onChange={(e) => setFormRelance((f) => ({ ...f, libelle: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-littoral-dark">
                {t('relances.echeance')} *
              </span>
              <input
                required
                type="date"
                value={formRelance.echeance}
                onChange={(e) => setFormRelance((f) => ({ ...f, echeance: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>

            <div className="flex justify-end gap-3 border-t border-littoral-light/30 pt-4">
              <button
                type="button"
                onClick={() => setModaleRelance(false)}
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
