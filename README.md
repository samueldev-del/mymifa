# MyMifa

Single-user job application tracker built for the IT market. It follows
applications through their lifecycle, scores CVs against job descriptions,
prepares interviews, and detects recruiter replies by reading an inbox.

Personal project. This repository documents both the application and the
engineering practices built around it.

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Data model](#data-model)
- [API](#api)
- [Frontend](#frontend)
- [External integrations](#external-integrations)
- [Authentication](#authentication)
- [CI/CD](#cicd)
- [Local development](#local-development)
- [Database migrations](#database-migrations)
- [Deployment](#deployment)
- [Infrastructure](#infrastructure)
- [Security](#security)
- [Engineering notes](#engineering-notes)
- [Known limitations](#known-limitations)

---

## Overview

Applying for jobs generates scattered state: which position, which company,
which CV was sent, what the recruiter answered, what to prepare for the
interview. MyMifa keeps that state in one place and automates the parts a
machine does better — scoring a CV against a job description, drafting a
cover letter, generating interview questions, and noticing that a recruiter
has replied.

The application is single-user by design. There is no sign-up, no user table,
and no roles: one password unlocks one dataset.

---

## Features

### Applications

Full CRUD over job applications. The employer is designated by name — the
backend resolves an existing company or creates one inside a transaction.
Moving an application to `envoye` timestamps `date_envoi` once and only once.

### Contacts and follow-ups

A directory of recruiters and hiring managers, attachable to an application,
a company, or both. When only the application is given, the company is
inferred. Follow-up reminders are attached to an application; overdue items
are computed in SQL rather than in the client.

### Documents and CV library

PDF, DOC and DOCX uploads up to 10 MB, stored privately on S3. Every read
returns a presigned URL valid for 15 minutes — no public ACL, ever.

Reusable base CVs live in the same table with a null `application_id`, which
makes the "CV library" a view over documents rather than a separate concept.

### ATS analysis

The CV PDF and the job description are sent to Claude under an enforced
`json_schema`. The response contains a 0–100 score, a summary, missing
keywords weighted by severity, strengths, and recommendations. The result is
persisted on the application, so reopening it does not re-invoke the model.

### Cover letter generation

The job description and the identity stored in the profile are sent to Claude,
which returns the letter body in the requested language — German by default,
English and French available.

### Interviews

Scheduling with date, type, format, location and contact. Creating an
interview automatically moves the application to `entretien`, unless it has
already reached a terminal state.

### Interview preparation

Generates 8 to 12 likely questions, each with its category, the recruiter's
intent behind it, and an answer angle — plus questions to ask back, watch
points, and a company brief. The most recent CV attached to the application
is included in the prompt when one exists. Answers can then be drafted in
STAR format and a post-interview review recorded.

### Courses and skill gaps

Tracked courses carry a `competences[]` array linking them to detected gaps.
The dashboard aggregates missing keywords across every ATS analysis, weights
them by severity (critical 3, important 2, minor 1), and marks a gap as
covered when a tracked course targets it.

### Recruiter reply detection

An IMAP poll reads the inbox **read-only** over a 14-day window, capped at 40
messages. Job boards and technical mailboxes are excluded before any analysis.
Status is then detected from sentence patterns rather than isolated words, in
German, English and French — an early version keyed on single words and
misclassified 15 of 26 real messages.

Replies are matched to an application first by sender domain, then by company
name. A Message-ID log guarantees idempotence.

### Dashboard

A single endpoint aggregates everything: key indicators (active applications,
interview rate, weighted average ATS score), the next five interviews, six
pending follow-ups, course counters, and the skill-gap aggregation.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, PWA |
| Backend | Express, Node 20 |
| Database | PostgreSQL 18 — Neon in production, containerised locally |
| Validation | Zod, on request bodies and parameters |
| Storage | AWS S3 (`eu-central-1`), private bucket |
| AI | Anthropic API — `claude-opus-5` |
| Email | `imapflow` + `mailparser`, TLS on port 993 |
| Tests | `node:test` |
| Containers | Docker, Docker Compose |
| CI | GitHub Actions |
| Hosting | Vercel — two projects from one monorepo |

---

## Repository layout

```
backend/
  config/          Database pool, constants
  controllers/     Route handlers
  middlewares/     Authentication, validation
  migrations/      Versioned SQL, replayable from an empty database
  routes/          Express routers
  services/        S3, IMAP, recruiter reply detection
  scripts/         Migration runner
  tests/           Unit tests
  validators/      Zod schemas
  Dockerfile
frontend/
  app/             App Router pages
  components/      UI components
  i18n/            DE / EN / FR dictionaries
  lib/             API client, auth, routing
  public/          Icons, service worker, offline shell
infra/             Terraform: EventBridge schedule, Lambda, alarms, budget
  lambda/          Function source, packaged by Terraform
compose.yaml       Local environment: API + PostgreSQL
docs/JOURNAL.md    Engineering decisions, incidents, measurements
.github/workflows/ CI pipeline and scheduled email sync
```

---

## Data model

Nine tables. UUID primary keys everywhere except `profil` (integer) and
`emails_traites` (keyed by Message-ID).

| Table | Role | Relations |
|---|---|---|
| `companies` | Employer, created implicitly by name | Referenced by `applications` (RESTRICT) and `contacts` (CASCADE) |
| `applications` | The application: position, offer, status, ATS score and analysis | → `companies` (required). Parent of `documents`, `interviews`, `relances` (CASCADE), and of `contacts`, `emails_traites` (SET NULL) |
| `contacts` | A person at a company | → `companies`, → `applications`, both optional |
| `documents` | A file on S3. Null `application_id` means CV library | → `applications` (CASCADE, nullable) |
| `interviews` | Scheduled interview and its preparation dossier | → `applications` (required), → `contacts` (optional) |
| `relances` | Follow-up reminder | → `applications` (required, CASCADE) |
| `formations` | Tracked course with `competences[]` | → `documents` via `certificat_id` (optional) |
| `profil` | Candidate identity. Single row | None |
| `emails_traites` | Message-ID log guaranteeing idempotent sync | → `applications` (optional) |

Two PostgreSQL ENUMs (`application_status`, `document_type`). Other
enumerations are `VARCHAR` with a `CHECK` constraint — a decision documented
in migration 002, after ENUMs caused 500s on value changes.

---

## API

Responses use a uniform envelope: `{success, data, message}` on success,
`{success, error: {code, message, details}}` on failure.

### Public

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Ping and `SELECT NOW()` against the database |
| `POST` | `/api/auth/login` | Password to token. Rate-limited to 10 attempts per 15 min per IP |
| `POST` | `/api/emails/sync` | Shared secret or session |
| `POST` | `/api/emails/webhook` | Its own shared secret (`x-webhook-secret`) |

### Authenticated

Everything else sits behind `app.use('/api', requireAuth)`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/session` | Validate a stored token |
| `GET` `POST` | `/api/applications` | List, create |
| `GET` `PUT` `DELETE` | `/api/applications/:id` | Detail, update, delete |
| `GET` | `/api/applications/:id/documents` | Documents for an application |
| `GET` | `/api/applications/:id/ats` | Latest analysis, without re-invoking the model |
| `POST` | `/api/documents/upload` | Multipart upload |
| `DELETE` | `/api/documents/:id` | Delete from database and S3 |
| `GET` `POST` | `/api/cv` | CV library: list, upload |
| `PUT` `DELETE` | `/api/cv/:id` | Rename, delete |
| `POST` | `/api/ai/generate-letter` | Generate a cover letter |
| `POST` | `/api/ai/analyse-ats` | Run an ATS analysis |
| `GET` `PUT` | `/api/profil` | Read, update |
| `GET` | `/api/dashboard` | Full aggregation |
| CRUD | `/api/formations` | Courses |
| CRUD | `/api/contacts` | Contacts (`?applicationId`) |
| CRUD | `/api/relances` | Follow-ups (`?applicationId`, `?enAttente`) |
| CRUD | `/api/interviews` | Interviews (`?applicationId`, `?aVenir`) |
| `POST` | `/api/interviews/:id/preparer` | Generate the preparation dossier |

---

## Frontend

Six authenticated pages, three public.

| Route | Content |
|---|---|
| `/` | Dashboard: four indicators, three panels, then a four-column Kanban with client-side search |
| `/entretiens` | Upcoming and past interviews, scheduling, expandable preparation |
| `/formations` | Courses sorted by status |
| `/contacts` | Contacts and follow-ups on one page |
| `/profile` | Profile form and CV library |
| `/login` `/impressum` `/datenschutz` | Public — the last two are German legal pages |

### Internationalisation

Three dictionaries with German as the reference. `de.ts` is typed with each
literal widened to `string` and exported as `Dictionary`, which forces `en.ts`
and `fr.ts` to provide exactly the same keys or fail the typecheck.

The locale lives in `localStorage` and is read through `useSyncExternalStore`
— no React state, so it stays in sync across tabs, and `<html lang>` is
updated by effect. A missing key renders the key itself rather than failing.

### PWA

`manifest.ts` declares standalone display, portrait orientation, three
shortcuts and 192/512/maskable icons. The service worker precaches the shell,
serves navigations network-first with an offline fallback, statics
cache-first, and never caches API responses. It unregisters itself on
development hosts.

---

## External integrations

### PostgreSQL

Connection pooling via `pg`, capped at one connection in serverless — each
function instance opens its own pool, and a high `max` multiplied by the
instance count would exhaust the database's connection limit.

TLS is enabled only when the connection string carries `sslmode=require`. A
local PostgreSQL has no certificate and refuses the negotiation; hardcoding
TLS made any local database unreachable.

### AWS S3

Uploads through `multer-s3`, keys prefixed `candidatures/` or `bibliotheque/`,
filenames timestamped with eight random bytes. No public ACL: reads go through
15-minute presigned URLs. When a database insert fails after upload, the
object is deleted.

### Anthropic

Three uses of `claude-opus-5`: cover letters (free text, 4,000 tokens), ATS
analysis (base64 PDF under a JSON schema, 8,000), interview preparation
(optional PDF under a JSON schema, 12,000). A `stop_reason` of `refusal` is
handled explicitly.

### IMAP

`getMailboxLock('INBOX', { readOnly: true })` — no flags modified, nothing
moved or deleted. Triggered every 15 minutes by EventBridge Scheduler (see
[Infrastructure](#infrastructure)), or manually from the dashboard. The
GitHub Actions workflow that used to carry the schedule is still there, but
`workflow_dispatch` only — a manual fallback if the AWS chain goes down.

---

## Authentication

Single-user. One password, `ADMIN_PASSWORD`, no user table, no roles. The
token carries `sub: 'admin'`.

The password is compared in constant time against its SHA-256, then a token
is issued as `base64url(payload).base64url(HMAC-SHA256)`, valid for 12 hours.
The signing secret is `SESSION_SECRET`, falling back to `ADMIN_PASSWORD` —
in which case changing the password invalidates every session. The token is
signed, not encrypted.

Client-side it lives in `localStorage` and travels as a `Bearer` header. A
401 redirects to `/login` with the requested path in `?next=`, restricted to
internal paths.

Hardening in place: `helmet`, `compression`, `x-powered-by` removed,
`trust proxy: 1`, a strict CORS allowlist in production, and a startup abort
when `FRONTEND_ORIGIN` or `DATABASE_URL` are missing.

---

## CI/CD

Six required status checks on `main`, no bypass for anyone including the
repository owner. Direct pushes are rejected; every change goes through a
pull request.

| Check | What it verifies | Duration |
|---|---|---|
| Frontend — lint & build | ESLint, Next.js production build | ~35 s |
| Backend — syntaxe & tests | `node --check` on every file, then 25 unit tests | ~15 s |
| Docker — lint & build | hadolint, then the image builds on a clean runner | ~18 s |
| Migrations — reconstruction depuis zéro | Migrations run against an empty PostgreSQL service, table count asserted | ~25 s |
| Workflows — lint | actionlint and shellcheck over the workflow files | ~13 s |
| Terraform — fmt & validate | `terraform fmt -check` and `terraform validate` over `infra/` | ~18 s |

Jobs run in parallel. Cheap checks run before expensive ones inside a job —
`node --check` before `npm ci`, hadolint before `docker build` — so a broken
file fails in seconds rather than after a full install.

The migration check counts tables rather than trusting the runner's success
message: during development that message appeared on a database missing four
tables.

Deployment is continuous through Vercel's Git integration: a preview per
branch, production on merge to `main`. Vercel's checks are visible but not
required — they attest that a deployment completed, not that the code is
correct.

---

## Local development

```bash
docker compose up -d
docker compose exec api npm run migrate
curl http://localhost:3000/api/health
```

The API and PostgreSQL 18 run as containers on a private network; the API
reaches the database by service name, not by `localhost`. The database is
disposable:

```bash
docker compose down -v          # wipes the volume
docker compose up -d --build    # rebuilds from scratch
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Environment variables are documented in `backend/.env.example`. Values used
by Compose are development-only and grant access to nothing beyond a local
container.

---

## Database migrations

Migrations live in `backend/migrations/` and are applied in filename order by
`npm run migrate`. Each runs inside a transaction and is recorded in a
`schema_migrations` table, so the runner is idempotent.

`000_schema_initial.sql` is a **baseline**, not a historical step: it is a
`pg_dump` of the production schema, which already contains the effect of
migrations 001 through 005. It therefore records those five as applied — on
an empty database, replaying migration 003 would try to convert a column that
is already converted.

Before this baseline existed, five of the nine tables had only ever been
created by hand in the managed database. Rebuilding the application anywhere
else was impossible.

---

## Deployment

Two Vercel projects from a single repository, distinguished by their root
directory:

| Project | Root | Serves |
|---|---|---|
| `mymifa-fwry` | `frontend` | `www.mymifa.com` |
| `mymifa` | `backend` | `mymifa.vercel.app` |

The backend is also published as a Docker image, built and verified on every
pull request.

---

## Infrastructure

Everything under `infra/` is Terraform. The configuration is the source of
truth, not the console: state lives in S3, encrypted, with native S3
lockfiles rather than the DynamoDB table deprecated since Terraform 1.11.
Every managed resource is tagged `Project=mymifa, ManagedBy=terraform`, so
what the code owns is distinguishable from what was created by hand.

### Why the scheduler moved off GitHub Actions

GitHub treats the `schedule` event as best effort. Measured over a month,
the sync ran **19 times a day instead of the 96 configured**, with gaps of
up to **2h43** — with no error raised, because nothing was failing. It
simply was not running.

EventBridge Scheduler replaced it, with `flexible_time_window` set to `OFF`,
since punctuality is the entire point of the change:

```
EventBridge Scheduler --(IAM role)--> Lambda --HTTP--> MyMifa API
```

The Lambda is packaged by Terraform from source, so a code change
redeploys on its hash. Its role carries `AWSLambdaBasicExecutionRole` plus
`ssm:GetParameter` scoped to the single parameter it reads — no `ssm:*`, no
`Resource = "*"`. The webhook secret is read as a data source rather than
declared as a resource, which would have written its value into the state
file. Log retention is set to 14 days; left unset, CloudWatch keeps logs
forever and bills for them.

### Two alarms for two different failures

| Alarm | Metric | Fires when |
|---|---|---|
| `mymifa-sync-emails-erreurs` | `Errors` | Two failures within 30 minutes — one can be a network hiccup |
| `mymifa-sync-emails-silencieuse` | `Invocations` | No invocation for an hour, when there should have been four |

The second is the one naive monitoring misses. With no invocations
CloudWatch receives no data at all, so the default `treat_missing_data`
would leave the alarm in `INSUFFICIENT_DATA` and never fire — precisely the
failure being watched for. It is set to `breaching` instead. The first alarm
takes the opposite setting, `notBreaching`: no invocation means no error,
so missing data is not a signal there.

Both notify an SNS topic that emails. A `FORECASTED` budget alarm at 80% of
$10/month completes the set, so a runaway resource is caught on projection
rather than after it has billed.

---

## Security

- No secrets in the repository. Expected variables are documented in
  `backend/.env.example` with placeholder values.
- Git history audited with `gitleaks` before the repository was made public.
- GitHub secret scanning and push protection enabled.
- The container runs as a non-root user (`USER node`), and `.dockerignore`
  keeps `.env` files, `node_modules` and `.git` out of the image.
- Uploads are private: no public ACL, presigned URLs only.
- The GitHub Actions token is restricted to `contents: read`.
- Every job carries a `timeout-minutes` ceiling.

---

## Engineering notes

Three production bugs were found by tooling rather than by reading code:

**A regular expression too permissive.** `we (have )?(decided|regret) (not )?to`
made `not` optional, so any message containing "we decided to" was classified
as a rejection — including interview invitations. The pattern was split in
two, since "we regret to" is a rejection on its own while "we decided to"
only becomes one when followed by "not". Found by the first run of the unit
test suite.

**TLS hardcoded in the database pool.** Neon requires it; a local PostgreSQL
has no certificate and refuses. The application could not run against any
local database. Found by containerising the backend.

**An unversioned schema.** Five of nine tables existed only in the managed
database. `npm run migrate` on an empty database failed on the first
migration. Found by running the migrations against a fresh container.

None of the three were visible by reading the code. Each required executing
it in a clean environment.

Decisions, measurements and incidents are recorded in
[`docs/JOURNAL.md`](docs/JOURNAL.md).

---

## Known limitations

Documented rather than hidden.

**No company management.** Companies are created by an implicit insert on the
exact name given. Two spellings produce two companies, and nothing merges or
renames them. `site_web` and `notes` are never read or written.

**Generated letters are not persisted.** A cover letter exists only in React
state; closing the modal loses it. The `document_type` enum provides for
`lettre_motivation`, but only manual upload populates it.

**Course certificates are unreachable.** `formations.certificat_id` is
accepted by the API and joined on read, but no screen allows attaching a
document.

**The email webhook is weaker than the sync.** `POST /api/emails/webhook`
applies neither the sender exclusion list nor the Message-ID log, and matches
companies with a loose `ILIKE`. It is unused today but active if its secret
is set.

**Rate limiting is ineffective in production.** Login attempts live in an
in-memory `Map`. On serverless, each instance has its own and a cold start
resets the counter.

**Server-side filters are unused.** `?aVenir`, `?enAttente` and
`?applicationId` are implemented, but the frontend fetches whole lists and
filters in JavaScript. There is no pagination anywhere.

**Test coverage is narrow.** 25 tests, all on the reply-detection service.
No controller, route, validator or frontend tests.

**Duplicate triggers.** `set_updated_at()` and `update_modified_column()`
have identical bodies; three tables carry both.

**The profile row is fragile.** Queries hardcode `WHERE id = 1` and nothing
inserts it. If the row disappears, nothing in the application recreates it.