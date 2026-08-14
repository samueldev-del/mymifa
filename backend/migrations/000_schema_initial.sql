CREATE TYPE public.application_status AS ENUM (
    'brouillon',
    'envoye',
    'entretien',
    'refuse',
    'accepte'
);

CREATE TYPE public.document_type AS ENUM (
    'cv',
    'lettre_motivation',
    'autre'
);


CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4 (c9a59a4)
-- Dumped by pg_dump version 18.6




--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    titre_poste character varying(255) NOT NULL,
    url_offre character varying(512),
    description_offre text,
    statut public.application_status DEFAULT 'brouillon'::public.application_status,
    ats_score integer,
    date_envoi timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    ats_analyse jsonb,
    ats_analyse_at timestamp with time zone,
    CONSTRAINT applications_ats_score_check CHECK (((ats_score >= 0) AND (ats_score <= 100)))
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(255) NOT NULL,
    site_web character varying(512),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    application_id uuid,
    nom character varying(255) NOT NULL,
    role character varying(255),
    email character varying(255),
    telephone character varying(64),
    linkedin_url character varying(1024),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid,
    type_document public.document_type NOT NULL,
    url_fichier character varying(1024) NOT NULL,
    contenu_texte text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    libelle character varying(255),
    cle_s3 character varying(1024)
);


--
-- Name: emails_traites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emails_traites (
    message_id character varying(998) NOT NULL,
    expediteur character varying(320),
    sujet character varying(512),
    statut_detecte character varying(32),
    application_id uuid,
    recu_le timestamp with time zone,
    traite_le timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: formations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre character varying(255) NOT NULL,
    organisme character varying(255),
    statut character varying(32) DEFAULT 'prevue'::character varying NOT NULL,
    date_debut date,
    date_fin date,
    url character varying(1024),
    competences text[] DEFAULT '{}'::text[] NOT NULL,
    notes text,
    certificat_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT formations_statut_check CHECK (((statut)::text = ANY ((ARRAY['prevue'::character varying, 'en_cours'::character varying, 'terminee'::character varying, 'abandonnee'::character varying])::text[])))
);


--
-- Name: interviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    date_entretien timestamp with time zone NOT NULL,
    notes_prepa text,
    questions_ia jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    type_entretien character varying(32) DEFAULT 'rh'::character varying NOT NULL,
    modalite character varying(32) DEFAULT 'visio'::character varying NOT NULL,
    lieu character varying(512),
    contact_id uuid,
    reponses_star jsonb,
    questions_a_poser jsonb,
    bilan text,
    CONSTRAINT interviews_modalite_check CHECK (((modalite)::text = ANY ((ARRAY['visio'::character varying, 'telephone'::character varying, 'sur_site'::character varying])::text[]))),
    CONSTRAINT interviews_type_entretien_check CHECK (((type_entretien)::text = ANY ((ARRAY['rh'::character varying, 'technique'::character varying, 'manager'::character varying, 'final'::character varying, 'autre'::character varying])::text[])))
);


--
-- Name: profil; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profil (
    nom character varying(255) DEFAULT ''::character varying,
    titre_professionnel character varying(255) DEFAULT ''::character varying,
    linkedin_url character varying(255) DEFAULT ''::character varying,
    github_url character varying(255) DEFAULT ''::character varying,
    portfolio_url character varying(255) DEFAULT ''::character varying,
    email character varying(255) DEFAULT ''::character varying NOT NULL,
    telephone character varying(64) DEFAULT ''::character varying NOT NULL,
    ville character varying(255) DEFAULT ''::character varying NOT NULL,
    id integer NOT NULL
);


--
-- Name: relances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    libelle character varying(255) NOT NULL,
    echeance date NOT NULL,
    fait boolean DEFAULT false NOT NULL,
    fait_le timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: emails_traites emails_traites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails_traites
    ADD CONSTRAINT emails_traites_pkey PRIMARY KEY (message_id);


--
-- Name: formations formations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formations
    ADD CONSTRAINT formations_pkey PRIMARY KEY (id);


--
-- Name: interviews interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_pkey PRIMARY KEY (id);


--
-- Name: profil profil_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profil
    ADD CONSTRAINT profil_pkey PRIMARY KEY (id);


--
-- Name: relances relances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relances
    ADD CONSTRAINT relances_pkey PRIMARY KEY (id);


--
-- Name: idx_contacts_application; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_application ON public.contacts USING btree (application_id);


--
-- Name: idx_contacts_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_company ON public.contacts USING btree (company_id);


--
-- Name: idx_documents_application; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_application ON public.documents USING btree (application_id);


--
-- Name: idx_documents_bibliotheque; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_bibliotheque ON public.documents USING btree (created_at DESC) WHERE (application_id IS NULL);


--
-- Name: idx_emails_traites_le; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emails_traites_le ON public.emails_traites USING btree (traite_le DESC);


--
-- Name: idx_formations_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formations_statut ON public.formations USING btree (statut, date_fin DESC);


--
-- Name: idx_interviews_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interviews_date ON public.interviews USING btree (date_entretien);


--
-- Name: idx_relances_echeance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relances_echeance ON public.relances USING btree (fait, echeance);


--
-- Name: applications trg_applications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: companies trg_companies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contacts trg_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: formations trg_formations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_formations_updated_at BEFORE UPDATE ON public.formations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: interviews trg_interviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: applications update_application_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_application_modtime BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: companies update_company_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_company_modtime BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: interviews update_interview_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_interview_modtime BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: contacts contacts_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: emails_traites emails_traites_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails_traites
    ADD CONSTRAINT emails_traites_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL;


--
-- Name: documents fk_application_doc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_application_doc FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: interviews fk_application_interview; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT fk_application_interview FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: applications fk_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: formations formations_certificat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formations
    ADD CONSTRAINT formations_certificat_id_fkey FOREIGN KEY (certificat_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: interviews interviews_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: relances relances_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relances
    ADD CONSTRAINT relances_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--



-- ---------------------------------------------------------------------------
-- Baseline
--
-- Ce fichier n'est pas une etape historique : c'est une reconstitution du
-- schema tel qu'il existe en production, extraite par pg_dump. Il contient
-- donc deja l'effet des migrations 001 a 005.
--
-- Sur une base neuve, les rejouer serait au mieux inutile, au pire fautif :
-- 003 convertit questions_ia de TEXT vers JSONB, alors que la colonne est
-- deja en JSONB ici. On les marque donc comme appliquees.
--
-- Sur la base de production, ou ces cinq migrations figurent deja dans
-- schema_migrations, ce fichier ne sera jamais execute.
-- ---------------------------------------------------------------------------
INSERT INTO schema_migrations (nom) VALUES
    ('001_chantiers_2_3_4.sql'),
    ('002_carriere.sql'),
    ('003_questions_ia_jsonb.sql'),
    ('004_profil_contact.sql'),
    ('005_emails_traites.sql')
ON CONFLICT (nom) DO NOTHING;
