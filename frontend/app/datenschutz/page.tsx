import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { EDITEUR, SOUS_TRAITANTS } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung — Mymifa',
  robots: { index: false, follow: false },
};

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-littoral-dark/50">
        {titre}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-littoral-dark">{children}</div>
    </section>
  );
}

/**
 * Décrit les traitements réellement effectués par le code — pas un modèle
 * générique. Toute nouvelle donnée collectée doit apparaître ici, et tout
 * nouveau destinataire dans SOUS_TRAITANTS (lib/legal.ts).
 */
export default function Datenschutz() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <Logo className="size-8 rounded-lg" />
        <span className="text-base font-bold tracking-tight text-littoral-dark">Mymifa</span>
      </Link>

      <h1 className="text-2xl font-bold text-littoral-dark">Datenschutzerklärung</h1>

      <Section titre="Verantwortlicher">
        <p>
          {EDITEUR.nom}
          {EDITEUR.codePostalVille ? `, ${EDITEUR.codePostalVille}` : ''} —{' '}
          <a className="text-laterite underline" href={`mailto:${EDITEUR.email}`}>
            {EDITEUR.email}
          </a>
        </p>
      </Section>

      <Section titre="Welche Daten verarbeitet werden">
        <p>
          Mymifa ist ein privates Werkzeug für die eigene Jobsuche. Verarbeitet werden:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Bewerbungsdaten:</strong> Unternehmen, Stellenbezeichnung,
            Stellenanzeige, Status und Termine.
          </li>
          <li>
            <strong>Eigene Profildaten:</strong> Name, Kontaktdaten, Lebenslauf und
            Anschreiben als Dateien.
          </li>
          <li>
            <strong>Daten von Ansprechpartnern:</strong> Name, E-Mail-Adresse und
            Rolle der Personen, mit denen im Bewerbungsverfahren korrespondiert wird.
          </li>
          <li>
            <strong>E-Mail-Inhalte:</strong> Zur automatischen Statuserkennung wird
            das Postfach <em>ausschließlich lesend</em> über IMAP abgefragt
            (Zeitfenster 14 Tage). Nachrichten werden nicht verändert, nicht
            gelöscht und nicht als gelesen markiert. Dauerhaft gespeichert wird
            nur die Message-ID bereits ausgewerteter Nachrichten, um
            Doppelverarbeitung zu vermeiden.
          </li>
        </ul>
      </Section>

      <Section titre="Rechtsgrundlage">
        <p>
          Die Verarbeitung erfolgt zur Wahrnehmung berechtigter Interessen bei der
          eigenen Bewerbungsverwaltung (Art. 6 Abs. 1 lit. f DSGVO). Soweit die
          Nutzung ausschließlich persönlichen Zwecken dient, greift zudem die
          Haushaltsausnahme des Art. 2 Abs. 2 lit. c DSGVO.
        </p>
      </Section>

      <Section titre="Empfänger und Auftragsverarbeiter">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-littoral-light/40 text-left text-littoral-dark/60">
                <th className="py-2 pr-4 font-medium">Dienst</th>
                <th className="py-2 pr-4 font-medium">Zweck</th>
                <th className="py-2 font-medium">Ort</th>
              </tr>
            </thead>
            <tbody>
              {SOUS_TRAITANTS.map((s) => (
                <tr key={s.nom} className="border-b border-littoral-light/20">
                  <td className="py-2 pr-4">{s.nom}</td>
                  <td className="py-2 pr-4">{s.role}</td>
                  <td className="py-2">{s.lieu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section titre="Übermittlung in Drittländer">
        <p>
          Für die KI-gestützte Analyse werden Lebenslauf und Stellenbeschreibung an
          Anthropic PBC (USA) übermittelt. Die Übermittlung stützt sich auf die
          Standardvertragsklauseln der EU-Kommission. Wer dies vermeiden möchte,
          nutzt die KI-Funktionen nicht — die übrige Anwendung bleibt vollständig
          verwendbar.
        </p>
      </Section>

      <Section titre="Speicherdauer">
        <p>
          Daten bleiben gespeichert, bis sie in der Anwendung gelöscht werden. Der
          Betreiber löscht Bewerbungen und zugehörige Dokumente, sobald sie für die
          Jobsuche nicht mehr benötigt werden.
        </p>
      </Section>

      <Section titre="Cookies und Einwilligung">
        <p>
          Es werden keine Cookies zu Analyse- oder Werbezwecken gesetzt. Gespeichert
          wird allein ein Anmelde-Token im lokalen Speicher des Browsers. Dieser ist
          für den vom Nutzer ausdrücklich gewünschten Dienst unbedingt erforderlich
          (§25 Abs. 2 Nr. 2 TDDDG) und daher nicht einwilligungspflichtig. Ein
          Cookie-Banner ist deshalb nicht erforderlich.
        </p>
      </Section>

      <Section titre="Sicherheit">
        <p>
          Der Zugang ist passwortgeschützt, die Übertragung erfolgt ausschließlich
          über TLS. Hochgeladene Dokumente liegen in einem privaten Speicher und
          sind nur über kurzlebige, signierte Links (15 Minuten) abrufbar.
        </p>
      </Section>

      <Section titre="Ihre Rechte">
        <p>
          Es bestehen die Rechte auf Auskunft (Art. 15), Berichtigung (Art. 16),
          Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit
          (Art. 20) und Widerspruch (Art. 21 DSGVO). Anfragen richten Sie an{' '}
          <a className="text-laterite underline" href={`mailto:${EDITEUR.email}`}>
            {EDITEUR.email}
          </a>
          . Zudem besteht ein Beschwerderecht bei der zuständigen
          Datenschutz-Aufsichtsbehörde.
        </p>
      </Section>

      <p className="mt-12 text-sm text-littoral-dark/60">
        <Link href="/impressum" className="text-laterite underline">
          Impressum
        </Link>
      </p>
    </main>
  );
}
