# Engineering journal — MyMifa

This document records how the DevOps chain around MyMifa was built: the
decisions taken, the reasoning behind them, and what was learned along the
way. It complements the code, which says *what*, by documenting *why*.

---

## 2026-08-13 — CI/CD foundations and repository governance

### Starting point

- Monorepo: `frontend/` (Next.js) and `backend/` (Express API), one Git
  repository.
- Two Vercel projects, continuous deployment already running through the
  native Git integration.
- One pre-existing GitHub Actions workflow (`sync-emails.yml`, the inbox
  polling cron).
- An open pull request carrying a first CI pipeline, covering the frontend
  only.
- Private repository, `main` unprotected.

### Decisions

**AWS rather than Azure.** The application already used an S3 bucket in
`eu-central-1` with a dedicated IAM user. Introducing a second cloud would
have meant two sets of credentials, two identity models and two bills, for no
benefit.

**Protect `main` before adding more checks.** A pipeline that blocks nothing
is a dashboard, not a guardrail. Adding verification to a bypassable CI
increases the volume of information, not the level of guarantee.

**Make the repository public.** Three benefits: unlimited GitHub Actions
minutes, branch protection without a paid plan, and work a recruiter can
actually read. Conditional on auditing the Git history first.

**One workflow, two jobs, no path filters.** Filters would have saved a few
minutes, but a required check that never runs never reports a status — the
pull request then becomes unmergeable. The cost of that trap outweighed the
saving.

**Only the two CI checks are blocking.** The three Vercel checks remain
visible but non-blocking. They attest that a deployment completed, not that
the code is correct; one of them (`Vercel Preview Comments`) verifies nothing
at all. Making them required would have gated merges on a third party's
availability.

**No administrator bypass.** A rule that can be bypassed by the only person
likely to bypass it protects nothing.

### Incidents and diagnostics

**The cron does not run at its configured frequency.**

Initial hypothesis: `*/15` produces 96 runs per day, roughly 2,880 minutes per
month, above the 2,000-minute quota of a private repository.

Measurement: 19 runs on 12 August instead of 96, with gaps up to 2h43.

Cause: GitHub documents the `schedule` event as best-effort — it can be
delayed, or dropped entirely, during periods of high load.

Decision: leave it. The application has no users yet, and an hour of latency
has no consequence. The fix — an external scheduler calling
`workflow_dispatch` — belongs to the AWS stage, via EventBridge Scheduler.

**One `fi` too many, in a file nobody was watching.**

An accidental edit to `sync-emails.yml` — an orphan `fi` and a missing
trailing newline — nearly went into a commit intended for `ci.yml`.

What prevented it: `git add <file>` with an explicit path rather than
`git add .`.

Lesson: the working tree belongs to no branch. An uncommitted change follows
you across `git switch`. Always start from a clean `git status`.

**Stale action versions.**

The first pipeline used `actions/checkout@v4` and `actions/setup-node@v4`,
while the current majors are `v5` and `v6`. Corrected after checking the
official Releases pages.

Lesson: never trust a version from memory. Check the source, and automate the
watch (Dependabot).

### Security audit before publication

Three independent passes over the full history:

1. Every file ever added to a commit — no real `.env`, only documentary
   `.env.example` files.
2. Secret patterns (`AKIA…`, connection strings, `sk-ant-`, private keys) —
   16 matches, all placeholder values (`user:password@`).
3. `gitleaks` across 16 commits — no leaks.

Lesson: a detection tool produces false positives, and a human decides. A
scanner silent on a real project is more suspicious than a noisy one.

`secret-scanning` and `secret-scanning-push-protection` were then enabled: the
audit validates the past, these options protect the future by rejecting any
push containing a secret.

### What was put in place

| Item | Detail |
|---|---|
| Frontend CI | lint and build, npm cache, `timeout-minutes`, `permissions: contents: read` |
| Backend CI | `node --check` over every `.js` file, no dependency install |
| Concurrency | stale runs cancelled on pull requests, never on `main` |
| Visibility | public repository, history audited |
| `main` protection | ruleset `protect-main`: pull request required, 2 required checks, no force-push, no deletion, no bypass |
| Tooling | GitHub CLI (`gh`) — the full cycle from the terminal |

### Open gaps, not yet addressed

- `DEPLOIEMENT.md` describes an architecture that no longer exists:
  `api.mymifa.com` was never attached (the API answers on
  `mymifa.vercel.app`), the apex domain belongs to no project, and the Vercel
  project names differ from those documented.
- A non-blocking ESLint warning (`<img>` instead of `next/image` in
  `PhotoFamille.tsx`): the policy on warnings needs deciding.
- No linter or test on the backend beyond syntax.
- The workflows themselves are unverified (`actionlint`).

---

## 2026-08-13 (continued) — Unit tests and CI hardening

### Why these functions first

`services/detection.js` classifies recruiter emails using regular
expressions. This kind of code **fails silently**: an over-permissive pattern
produces a wrong status with no exception and no log. It only surfaces when
someone notices the inconsistency, weeks later.

Its functions are pure — text in, value out, no database, no network. They are
therefore the cheapest to test and the most profitable to cover.

### Choosing the runner: `node:test`

Three candidates evaluated: `node:test` (built into Node), Vitest, Jest.

Chosen: `node:test`. The backend's `package.json` had a single devDependency;
pulling in dozens of transitive packages to test two pure functions would have
been disproportionate. The syntax (`describe`, `test`, assertions) is close
enough to Jest that the skill transfers directly.

### A bug found by the tests

One test out of 24 failed on the first run.

```
Input    : "we decided to invite you to an interview next week."
Expected : entretien
Actual   : refuse
```

Cause: the pattern `/we (have )?(decided|regret) (not )?to/i` made `not`
optional. Any sentence containing "we decided to" was classified as a
rejection — including an interview invitation or a job offer.

The pattern also merged two verbs that behave differently: "we regret to" is a
rejection in itself, while "we decided to" only becomes one when followed by
"not". Treating them together was the design error.

Fix — one pattern per verb:

```
/we (have )?decided not to/i     ("not" mandatory)
/we regret to/i                  ("not" irrelevant)
```

A regression test locks the behaviour in place, with a comment explaining why
`not` must stay mandatory — otherwise someone will make it optional again to
"catch more cases".

**Lesson.** `node --check` passed this file without complaint. The syntax was
perfect and the semantics were wrong. Verifying form says nothing about
behaviour.

**Lesson on method.** The first reaction to the failure was to assume the test
sentence was badly written. That is the most dangerous reflex in debugging —
when a test fails, the default hypothesis is never "the input data is wrong".
The question to ask was: can a recruiter write this sentence? Obviously yes.
So the code was wrong.

### Renaming a required status check without locking the repository

The backend job moved from `Backend — vérification syntaxique` to
`Backend — syntaxe & tests`. That name is the **context required by the
ruleset**. Merging the rename without care would have left the ruleset waiting
forever for a check that no longer exists — every pull request blocked.

Sequence applied:

1. Update the ruleset **before** the merge. A context does not need to exist
   to be declared. All pull requests become temporarily blocked.
2. The pull request carrying the rename produces the new context, and
   therefore unblocks itself.
3. Merge; the old context becomes irrelevant.

### What was put in place

| Item | Detail |
|---|---|
| Tests | 25 `node:test` tests over `detecterStatut` and `expediteurIgnore` |
| Script | `"test": "node --test"` in `backend/package.json` |
| Backend CI | `node --check`, then `npm ci`, then `npm test` |
| Step order | syntax before install: a broken file fails the job in seconds rather than after a full `npm ci` |
| Ruleset | context updated to `Backend — syntaxe & tests` |

Measured duration of the backend job after adding tests: 13 s, against an
initial estimate of 25–35 s. `npm ci` on a backend with a single devDependency
is faster than expected, and the npm cache pays off from the first run.

### Git handling incidents

Twice in the session, an uncommitted change followed a branch switch. The
working tree belongs to no branch — it is shared. The only safe moment to
switch branches is when `git status` is clean.

A `git diff` showing two identical lines revealed a modified file: only the
trailing newline was missing. Git compares bytes, not lines as the eye reads
them. `git diff --check` flags this class of noise.

---

## 2026-08-13 (continued) — Containerising the backend

### Why Docker, and why the backend only

The backend's runtime environment existed in reproducible form nowhere: Node
24 on the local machine, Node 20 on the CI runner, a third version on Vercel.
Three different reconstructions of the same requirement.

An image freezes that set into a single artefact, identical on a laptop, a
runner and an AWS server. The promise is not "it isolates", it is "it
reproduces".

The frontend is excluded: it runs on Vercel, which handles build and
execution. Containerising it would produce an image nothing would deploy. The
backend has a real target — it is the one going to AWS, and ECS only knows how
to deploy containers.

### The build cache governs instruction order

An image is a stack of layers. Docker reuses a layer when the instruction and
everything preceding it are unchanged. As soon as one layer changes, every
subsequent layer is rebuilt.

Hence the order: `package.json` + lockfile → `npm ci` → the rest of the code.
Dependencies change rarely, code several times a day. The reverse would
reinstall the entire npm tree on every one-line edit.

Same logic as `cache-dependency-path` in the CI.

### `.dockerignore`: the measurement

First build without a `.dockerignore`:

| | Without | With |
|---|---|---|
| Context transferred | 35.99 MB | 3.75 kB |
| Build duration | 26.2 s | 12 s |

The build context is the set of files sent to the daemon before construction
starts — the whole directory, whether the Dockerfile uses it or not.

Without a filter, `COPY . .` pulled in the local machine's `node_modules`
(macOS, Node 24) and **overwrote** the one `npm ci --omit=dev` had just
installed for Linux. Verified:

```
docker run --rm mymifa-api:dev ls node_modules | grep nodemon
nodemon
```

A devDependency explicitly excluded at install time ended up in the image. The
`--omit=dev` achieved nothing.

**Associated security risk**: a local `.env`, invisible to Git because it is
ignored, would be copied into the image without warning — and images get
pushed to registries. This vector triggers none of the protections put in
place on the Git side (secret scanning, push protection), because the file
never passes through Git.

### Where the image weight sits

`docker history` on a 379 MB image:

| Layer | Size |
|---|---|
| Debian bookworm (base) | 85.3 MB |
| Node installation | 126 MB |
| `npm ci --omit=dev` | 74.7 MB |
| **Application code** | **287 kB** |

Code accounts for 0.08 % of the image. Reducing the code would achieve
nothing; changing the base image would achieve everything. Alpine would
replace Debian's 85 MB with roughly 8 MB. To be evaluated by measurement,
checking that no dependency breaks on `musl` instead of `glibc`.

### Non-privileged user

By default the process runs as `root`. Two reasons not to accept that: the
container's `root` is the same UID 0 as the host's, so a container escape
grants full control of the machine; and inside the container itself, a code
execution flaw becomes a full compromise rather than limited access.

The official `node` image already provides a `node` user (UID 1000). Points to
watch: `USER` applies to every instruction that follows, so it must come
**after** `npm ci`, which needs to write to `/app`; and `/app`, created by
`WORKDIR`, belongs to root — hence the `chown` and the
`COPY --chown=node:node`.

Verified: `docker run --rm mymifa-api:dev id` → `uid=1000(node)`.

Same principle as `permissions: contents: read` on the GitHub token, and as
the future IAM roles: grant only what is necessary.

### What Docker revealed about the application

**Side effects at module load.** The container failed on `bucket is required`
before even reaching the configuration checks in `index.js`. The stack trace
showed `Module._compile` → `require`: `services/s3.js` builds the S3 client
and reads `AWS_S3_BUCKET_NAME` at import time, not at use time.

Consequences: a missing variable crashes the whole application rather than the
single feature concerned, and any module importing `s3.js` becomes untestable
without AWS configuration. That is precisely why the test suite covers only
`detection.js`, which has no side effects.

**`NODE_ENV` governs three behaviours.** `EN_PRODUCTION` is derived from
`NODE_ENV === 'production' || VERCEL === '1'`, and controls the abort on
incomplete configuration, the CORS check, and the tolerance for local origins.
Without it the container started in degraded mode with a looser CORS policy —
not what should ship to AWS. Hence `ENV NODE_ENV=production` in the
Dockerfile: it is not a secret, it is a behaviour flag, and its presence in a
layer poses no problem.

**Node 22 deadline.** The AWS SDK warns that versions published after the
first week of January 2027 will require Node ≥ 22. Node 20 is in maintenance,
Node 22 is the active LTS. The upgrade must move the image, the CI and Vercel
together — otherwise it recreates exactly the environment drift Docker is
meant to remove.

**Ungraceful shutdown.** Three `Ctrl + C` were needed before Docker killed the
container by force (`got 3 SIGTERM/SIGINTs, forcefully exiting`). The
application does not intercept SIGTERM. In production, every redeployment cuts
in-flight connections. The `CMD ["node", "index.js"]` exec form does make Node
PID 1 and forwards the signal — a necessary condition, not a sufficient one.

### Verifying the image in CI

A Dockerfile that works locally guarantees nothing elsewhere — the exact
opposite of what Docker provides. Third job added:

- `hadolint` validates the Dockerfile without building it (no warnings raised
  on the first pass)
- `docker build` verifies the image builds on a clean environment

Measured duration: 18 s, without a Docker cache. The initial estimate was
40–60 s. The cache (`cache-from`/`cache-to` on the GitHub Actions cache) was
therefore dropped: there is no friction to fix.

The `Docker — lint & build` context was added to the ruleset **before** the
merge, following the same sequence as the rename: the pull request that
creates the context is the one that unblocks the repository.

### A recurring pattern in the estimates

Three times in one day, an estimate of duration or consumption proved too
pessimistic by a factor of 2 to 5: the cron minutes (2,880 estimated, ~600
actual), the backend job with tests (25–35 s estimated, 13 s actual), the
Docker job (40–60 s estimated, 18 s actual).

The rule that follows: measure before optimising. On three occasions, the
anticipated problem did not exist.

---

## 2026-08-14 / 16 — Local environment and schema reproducibility

### Compose: why a service name and not an IP

In a containerised environment, services are addressed by name. Compose
creates a private network with internal DNS resolution: `db:5432` stays valid
whatever address the container is assigned.

Both alternatives are wrong:

- an **IP** changes on every start, and the configuration would need
  rewriting;
- **`localhost`** refers to the container itself. Each container has its own
  network stack and its own loopback interface — the API would look for a
  PostgreSQL inside itself.

This is the same mechanism Kubernetes and ECS use.

Nuance learned later: in CI, steps run **directly on the runner**, not inside a
container. The service publishes its port on the machine, and it is reached
through `localhost:5432`. The rule stays consistent — `localhost` always means
"the machine where the code runs".

### Three container traps encountered

**Port already allocated.** A `docker run -p 3000:3000` started nine hours
earlier was still running. `--rm` only removes the container when the process
stops, and a container does not depend on the shell that launched it. Reflex:
`docker ps` before wondering why a port is taken.

**Container not recreated.** After the port failure, a second `up` restarted
the existing container instead of recreating it — Compose reuses containers as
long as their definition has not changed. The failed network configuration
persisted. `docker compose ps` showed it: `3000/tcp` with no arrow, against
`0.0.0.0:5432->5432/tcp` for the database. Fixed with `--force-recreate`.

**Ungraceful shutdown confirmed.** `api-1 exited with code 137` (128 + 9 =
SIGKILL) against `db-1 exited with code 0`. PostgreSQL intercepts SIGTERM and
shuts down cleanly; the application does not and gets killed. A direct
comparison between a service that behaves and one that does not.

### Hardcoded TLS

`config/db.js` forced `ssl: { rejectUnauthorized: false }` regardless of the
connection string. Neon requires it; a local PostgreSQL has no certificate and
refuses — `The server does not support SSL connections`.

Now enabled only when `DATABASE_URL` contains `sslmode=require`. Verified on
Vercel before merging: the production string does carry that parameter, so
production behaviour is unchanged.

**Lesson on verification.** The first reading of the Vercel variable reported
only `channel_binding=require`, which would have led to abandoning a correct
fix. A partial reading is more dangerous than no reading at all. Ask for the
exact structure, not for a judgement.

### The production schema was versioned nowhere

`npm run migrate` on an empty database failed immediately:
`relation "applications" does not exist`.

Five of nine tables — `applications`, `companies`, `documents`, `interviews`,
`profil` — had been created by hand in Neon. Migrations 001 to 005 documented
only the later changes.

Consequence: no automated way to rebuild the application anywhere else. If the
Neon database disappeared, the schema was lost. A single point of failure,
invisible until someone attempted a rebuild.

### Nine iterations to extract a baseline

| Obstacle | Cause |
|---|---|
| `pg_dump` refuses | Neon runs PostgreSQL 18.4, the local container 16.13. `pg_dump` refuses a server newer than itself — it could not express objects from a later version. |
| PostgreSQL 18 will not start | Since 18, the official images store data in a subdirectory named by major version. The mount must target `/var/lib/postgresql`, not `/data`. |
| `syntax error at or near "\"` | `pg_dump` emits `psql` meta-commands (`\restrict`) that the `pg` driver does not understand. |
| `function update_modified_column() does not exist` | Two trigger functions with identical bodies; only one had been extracted. |
| `relation "public.contacts" does not exist` | Cross dependency: the partial five-table dump contained a foreign key to a table created by a later migration. |
| `syntax error at end of input`, then `at or near "ADD"` | `sed` edits by line number, then by pattern: a pattern deletion applies **everywhere** the pattern appears. Three occurrences removed instead of one, leaving orphaned `ADD CONSTRAINT` statements. |
| `relation "schema_migrations" does not exist` | The dump's `SELECT pg_catalog.set_config('search_path', '', false)` emptied the `search_path`, and the effect persisted beyond the file. The table existed; PostgreSQL no longer had anywhere to look for it. |

**Lesson on `sed`.** Editing by line number is fragile — numbers shift with
every change. Editing by pattern is safer, but the occurrences must be counted
before deleting.

### The baseline, and the design error that came with it

`000_schema_initial.sql` is not a historical step: it is a reconstruction of
the current state, extracted by `pg_dump`. It therefore already contains the
effect of migrations 001 to 005 — including 003, which converts
`questions_ia` from TEXT to JSONB on a column that is already JSONB.

It therefore records 001 to 005 in `schema_migrations` itself. This is the
standard *squash* / *baseline* practice when introducing a reference schema
into a project whose migrations are already in production.

That forced a fix in `migrate.js`: the registry was read **once, before the
loop**, so entries written by the baseline were invisible and the migrations
were replayed. It is now re-read on every iteration, with
`ON CONFLICT (nom) DO NOTHING` on the insert.

**The error.** The baseline was first built with five tables only, to avoid
duplicating the migrations that create the other four. Those migrations were
then marked as applied. Result: `contacts`, `formations`, `relances` and
`emails_traites` were created nowhere.

Two decisions, each coherent on its own, incoherent together.

And the script printed `Migrations terminées.` — on a database missing four
tables. Only `\dt` revealed it.

**A success message is not proof of success.** That is the main lesson of the
session, and it directly shaped the CI job.

### Automation in CI

Fourth job: a PostgreSQL 18-alpine service started through the `services:`
key, with the same healthcheck as `compose.yaml`. The job applies the
migrations to an empty database, then **counts the tables** rather than
trusting the script's message:

```
nb=$(psql ... "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
test "$nb" -eq 10
```

26 seconds, green on the first attempt. The cycle run nine times by hand is
now automatic.

### A decorative protection, for several hours

While adding the `Migrations` context to the ruleset, re-reading it showed
**two** contexts instead of four: `Docker — lint & build`, added hours
earlier, had never been recorded.

The `PUT` command had either failed or never run, and the pager swallowed the
response. No signal. The repository had been operating with a Docker check
believed to be blocking and which was not.

Three lessons:

1. **The pager hides output.** Third occurrence in one day, after
   `gh repo view` and `git diff`. `GH_PAGER=cat` on every write command, and
   `git config --global core.pager 'less -FRX'`.
2. **`PUT` is destructive**: it replaces the resource entirely. An error in
   the document sent does not produce an error, it produces a state different
   from the one assumed. Same risk as a `terraform apply` on an incomplete
   file.
3. **A successful write cannot be inferred from the absence of an error.**
   Re-read the state, every time.

---

## 2026-08-16 — Linting the workflows

### The last unverified artefact

At this point the chain verified the frontend code, the backend code, the
Dockerfile and the SQL schema. The file orchestrating all of it — `ci.yml` —
was the only one subject to no verification at all.

Two incidents had already made the case:

- the orphan `fi` in `sync-emails.yml`, which would have broken the email
  sync;
- an indentation of one space instead of two in front of a job name, which
  would have made the workflow invalid.

The second is the more dangerous. **An invalid workflow produces no run at
all**: no red check, no error message on the pull request, simply nothing. The
required contexts never appear, the pull request stays blocked, and the
diagnosis is confusing.

### What `actionlint` catches

Three categories that neither a generic YAML validator nor GitHub itself
detects:

- workflow syntax: unknown keys, malformed structures, wrong value types;
- `${{ }}` expressions: non-existent contexts, invalid properties, type
  errors;
- the shell inside `run:` blocks, through `shellcheck`.

The third matters most here: the `run:` blocks contain real shell —
`set -euo pipefail`, `find | xargs`, a `psql` query with a numeric test — that
nothing else verified.

### Verifying the linter itself

The job passed green on the first run, and `actionlint` reported nothing.
A green linter on a clean project and a broken linter produce identical
output, so the tool was tested against a known-bad file:

```
actionlint /tmp/test-bad.yml
  "on" section is missing in workflow [syntax-check]
  shellcheck reported issue in this script: SC2086 [shellcheck]
```

It detects both the missing `on:` section and a shellcheck finding inside a
`run:` block. The tool works; the workflows were simply clean.

**Lesson.** A negative test is the only way to distinguish a tool that
validates everything from a tool that reads nothing. The same reasoning
applies to any check that has never been seen failing.

### Chain status

Five required checks on `main`, no bypass for anyone including the repository
owner.

| Check | Duration | Verifies |
|---|---|---|
| Frontend — lint & build | ~35 s | ESLint, Next.js production build |
| Backend — syntaxe & tests | ~15 s | `node --check` over every file, 25 unit tests |
| Docker — lint & build | ~18 s | hadolint, image builds on a clean runner |
| Migrations — reconstruction depuis zéro | ~25 s | Schema rebuilt on an empty database, table count asserted |
| Workflows — lint | ~13 s | actionlint and shellcheck over the workflow files |

### Next

1. Publish the image to GHCR — a prerequisite for AWS deployment.
2. AWS and Terraform. First resource identified by measurement: EventBridge
   Scheduler, to replace the GitHub cron running at 20 % of its configured
   frequency.
3. A startup test for the application against the migrated database.
4. Graceful shutdown on SIGTERM.
5. Node 22 upgrade — image, CI and Vercel together.
6. `DEPLOIEMENT.md`, still divergent from the real architecture.
7. Policy on ESLint warnings.

---

## 2026-08-17 — AWS and Terraform

### Auditing the account before building anything

Nothing was created before knowing what already existed. Four checks:

- **EC2 instances**, in `us-east-1` and `eu-central-1` — none. An instance had
  been launched for an onboarding credit and correctly terminated.
- **Secrets Manager** — none. This service bills per secret per month, unlike
  a terminated EC2 instance which bills nothing.
- **S3** — one bucket, `mymifa-api-s3`, the application's.
- **Budgets** — one, at 1 USD.

Nearly everything on AWS is regional. A resource forgotten in a region you
never open keeps billing without announcing itself. Hence the two-region check
rather than one.

### The account expires, it does not just get billed

The account runs on the free plan introduced in July 2025: 200 USD of credits,
six months maximum, whichever comes first. 139.96 USD remain, expiring
**7 September 2026**.

The wording matters. AWS does not stop charging — it **closes the account**.
Data is retained for 90 days, and downloading it requires upgrading to a paid
plan first. After 90 days everything is permanently erased.

That includes `mymifa-api-s3`, which holds the CVs the application depends on.

Upgrading to the paid plan carries **no fixed cost**: no subscription, no
minimum. Remaining credits keep applying until they expire, twelve months
after account creation — so upgrading actually extends coverage from September
to February. One trap: joining an AWS Organization or a Control Tower landing
zone expires the credits immediately.

Decision: upgrade at the start of September, not before. Nothing is gained by
upgrading early, and the deadline is now tracked.

### A budget without a forecast is a receipt

The existing budget alerted on `ACTUAL` at 0.01 USD — it fires once the money
is spent. On an hourly-billed resource, that is days too late.

The first Terraform resource therefore adds a `FORECASTED` notification at
80 % of a 10 USD monthly budget: AWS projects end-of-month spend and warns
before the threshold is crossed. A second `ACTUAL` notification at 100 % acts
as a fallback if the projection is wrong.

The resource is free, disposable, and genuinely useful — chosen deliberately
as the first exercise of the `init` / `plan` / `apply` cycle rather than
something artificial.

**A verification detail worth recording.** Querying the existing budget's
subscribers returned nothing twice, which looked like "no subscriber
configured". It was a malformed filter: the notification carries a
`ThresholdType: ABSOLUTE_VALUE` field that the query omitted, so nothing
matched. Reading the raw structure instead of a filtered view settled it — the
subscriber existed all along.

Second time in one session that an empty result meant a bad filter rather than
absent data.

### The state, before any resource

Terraform is declarative: it needs to know what already exists, or it would
recreate everything on each run. That knowledge lives in the state file, which
has three consequences:

- **It is the source of truth.** Losing it destroys nothing on AWS, but
  Terraform no longer recognises its resources — recovery means importing each
  one by hand.
- **It contains secrets in clear text.** Any sensitive attribute is written
  unencrypted. This is the primary reason a state file never goes into Git.
- **It must be locked.** Two concurrent `apply` runs corrupt it.

Hence: remote backend before the first resource, the same way branch
protection came before more tests.

### The bootstrap paradox

The bucket storing the state must exist before Terraform starts — but
Terraform is what creates resources.

Three ways out: create the bucket by hand; create it with Terraform in local
state then migrate; or a separate bootstrap module. The first was chosen. A
state bucket is infrastructure-for-infrastructure; managing it with the tool it
supports creates a circularity that makes destruction awkward for no gain.

The bucket was created with three hardening steps, none of them optional:

| Setting | Why |
|---|---|
| Versioning | A corrupted or deleted state can be rolled back. Without it, one bad write permanently destroys the map of the infrastructure. |
| Encryption at rest (SSE-S3) | The state holds sensitive attributes in clear text. |
| Public access block, all four flags | Two flags protect against future public ACLs and policies, two neutralise existing ones. An exposed state hands over the full map of the infrastructure. |

### Locking without DynamoDB

State locking historically required a dedicated DynamoDB table. Terraform 1.10
introduced `use_lockfile`, promoted to generally available in 1.11, which uses
**S3 conditional writes** instead: a `.tflock` JSON object is created with the
`If-None-Match` header, so the write only succeeds if the object does not
already exist. If it does, S3 returns an error and the conflict is avoided.

This is optimistic locking — Terraform defers lock management to the storage
system. `dynamodb_table` is deprecated as of 1.11.

Not to be confused with S3 Object Lock, a compliance feature preventing
deletion for a fixed period. No special bucket mode is required.

### Reading a plan

`terraform plan` produced:

```
Plan: 1 to add, 0 to change, 0 to destroy.
```

That summary line is the main guardrail. Before every `apply`, it gets checked
against what was intended. A plan announcing destructions nobody asked for is
the one signal that prevents an accident — the same role the `+X −Y` counters
of a Git diff played earlier in the week.

Two details from the output: `(known after apply)` marks values AWS assigns at
creation time, so a plan is never a complete prediction; and `tags_all` showed
the provider's `default_tags` propagating automatically, which will later
distinguish Terraform-managed resources from hand-created ones.

### Idempotence, demonstrated

After `apply`, a second `plan` returned:

```
No changes. Your infrastructure matches the configuration.
```

Note the line before it: `Refreshing state...`. Terraform did not just read
its file — it queried AWS to confirm the resource still exists with the
expected attributes. Had someone edited the budget in the console, the plan
would propose restoring it.

This is **drift detection**, and it is what separates a declarative tool from
a script. A script that creates a budget, run twice, creates two. Terraform
observes that the desired state is already met and stops.

### The Terraform blind spot

Adding `infra/` created the same gap as every previous artefact: nothing
verified it. Frontend code, backend code, the Dockerfile, the workflows and
the SQL schema were all checked; the Terraform was not.

A seventh job adds `terraform fmt -check -recursive` and `terraform validate`.
Neither needs AWS credentials — `terraform init -backend=false` installs the
provider without contacting S3, so the job never touches the state.

`terraform_wrapper: false` on the setup action matters: without it, the action
wraps commands in a script that masks exit codes, and a failing `fmt -check`
would leave the job green. Precisely the decorative-check problem this whole
chain exists to avoid.

`terraform plan` is deliberately excluded from CI: it would require AWS
credentials stored as a secret, with rights to read the state. That belongs to
its own change, and only becomes worthwhile once the infrastructure is large
enough for plan review to add value.

### Both linters earned their place immediately

Running the two checks locally before pushing caught two real faults:

- `terraform fmt -check` flagged misaligned attributes in `budget.tf` —
  written without passing through the formatter.
- `actionlint` flagged `terraform:` written at column 1 instead of two spaces,
  which would have placed the job at the workflow root rather than inside
  `jobs:`.

The second is the dangerous one, and it is the **second occurrence of that
exact fault** in this project. An invalid workflow produces no run at all: no
red check, no error message, simply nothing. The required contexts never
appear and the pull request stays blocked with no visible cause.

The correction itself took three attempts. An editor save that did not take,
then a `sed` targeting one line by number. `cat -A` settled it by making the
invisible visible — no character at all before `terraform:`, where two spaces
were assumed.

### Chain status

| Check | Verifies |
|---|---|
| Frontend — lint & build | ESLint, Next.js production build |
| Backend — syntaxe & tests | `node --check`, 25 unit tests |
| Docker — lint & build | hadolint, image builds on a clean runner |
| Migrations — reconstruction depuis zéro | Schema rebuilt on an empty database, table count asserted |
| Workflows — lint | actionlint and shellcheck |
| Terraform — fmt & validate | Canonical formatting, configuration validity |

Plus a non-blocking `Docker — publish to GHCR` job, skipped on pull requests
and running only on `main`. It must never become a required context: a skipped
job reports no status, and the pull request would block forever.

### AWS state

| Resource | Managed by |
|---|---|
| `mymifa-api-s3` | created by hand, production |
| `mymifa-tfstate-…` | created by hand, versioned, encrypted, private, native locking |
| Budget 1 USD, ACTUAL | created by hand at signup |
| Budget 10 USD, FORECASTED | **Terraform** |

### Next

1. EventBridge Scheduler — the first resource born from a measurement rather
   than an exercise: replacing the GitHub cron that runs at 20 % of its
   configured frequency.
2. Decide whether the backend actually migrates to AWS, or whether the
   infrastructure is built alongside a working Vercel deployment.
3. Upgrade to the paid plan in early September.
4. Node 22 upgrade — image, CI and Vercel together.
5. Graceful shutdown on SIGTERM.
6. `DEPLOIEMENT.md`, still divergent from the real architecture.

---

## 2026-08-19 — Container deployment, monitoring, and paying down debt

### ECS Fargate: built, measured, destroyed

The image existed on GHCR but nothing ran it. This deployment exists to
demonstrate that a container can run on AWS — the application itself stays on
Vercel, which is free and works.

Nineteen resources: a VPC with two public subnets across two availability
zones, an internet gateway, a route table, two security groups, an ALB with
target group and listener, an ECS cluster, a task definition, a service, an
execution role and a log group.

**Two deliberate trade-offs.**

Tasks run in *public* subnets with a public IP rather than in private subnets
behind a NAT gateway. The NAT costs around 32 USD a month — disproportionate
for an ephemeral demonstration. In production the tasks would be private. This
is a documented compromise, not an oversight.

The task security group accepts traffic **only from the ALB's security group**,
not from an address range. Even knowing a task's public IP, nothing can reach
it directly. Referencing a security group is stronger than a CIDR block: it
follows the resource rather than the network.

**Secrets never touch the state.** `DATABASE_URL`, `ADMIN_PASSWORD` and
`SESSION_SECRET` are resolved by the ECS agent at task start from SSM. The task
definition contains only their ARNs. The IAM policy names those three
parameters and nothing else.

### Two failures worth recording

**Security group descriptions reject apostrophes.** AWS enforces a restricted
character set on that field — no accents, no apostrophes. The `apply` failed
after creating fourteen of nineteen resources.

That partial failure demonstrated something useful: Terraform records what it
created, and the next `apply` planned only the five missing resources. An
interrupted apply leaves no orphaned infrastructure.

**A wrong secret in SSM.** `EMAIL_WEBHOOK_SECRET` had been copied into
`/mymifa/database-url`, producing `getaddrinfo ENOTFOUND base` — the
application looking for a host literally named `base`, from the template
string.

Third time in two days that copying a value from Vercel by hand cost time. The
problem is not attention, it is the method: transcribing secrets one at a time
from a web interface is structurally fragile.

### Measurements

| | |
|---|---|
| `/api/health` through the ALB | HTTP 200 in 132 ms |
| Service | ACTIVE, 1/1 task |
| ALB target | healthy |
| Cost | ~0.047 USD/h — Fargate 0.25 vCPU (0.0101) + memory 0.5 GB (0.0022) + public IPv4 (0.005) + ALB (~0.030) |

The public IPv4 charge, introduced in February 2024, was missing from the
initial estimate. Verified against the pricing page rather than recalled.

### Destroying, and what it teaches

`terraform destroy -target` on the nineteen resources, leaving the scheduler
and budgets untouched.

Destruction inverts the dependency graph: the ALB before the subnets, the
subnets before the VPC, the internet gateway last — 7m48s on its own, waiting
for every network interface to be released. **Tearing down is slower than
building up**, because each resource waits for its dependents to go first.

Knowing how to destroy matters as much as knowing how to create. Fixed
per-environment overhead — ALB, NAT, CloudWatch — runs around 90 USD a month
and keeps billing even when task count drops to zero.

### Separating the ephemeral from the permanent

After destruction, `terraform plan` proposed nineteen creations. That is
correct behaviour: the code still declares that infrastructure, so Terraform
wants it to exist.

But permanent noise in a plan eventually masks real drift — the same failure
mode as a tolerated red check.

`ecs.tf` moved to `infra/demo-ecs/` with its own state, under a separate key in
the same bucket. Each state now describes a coherent scope, and a plan in one
says nothing about the other.

A detail worth noting: `ecs.tf` had never been committed when it was applied.
Nineteen resources existed on AWS with their describing code living only on one
laptop. Commit before applying, or immediately after.

### The lock, demonstrated by accident

Piping `terraform plan` into `head` closed the stream early, Terraform was
interrupted, and it never released its lock. The next command failed:

```
Error acquiring the state lock
api error PreconditionFailed
```

This is exactly the native S3 locking mechanism: a `.tflock` object written
with `If-None-Match`, which S3 refuses when it already exists. Optimistic
locking, delegated to the storage layer.

`terraform force-unlock <id>` cleared it — safe here, since the holding process
was dead. Lesson: never truncate Terraform output with `head`.

### Monitoring: two failures, two alarms

The scheduler runs, but nothing would report if it stopped. That was the GitHub
cron's flaw for weeks — discovered only by going to measure.

**The Lambda fails.** Metric `Errors`, threshold 1 over two 15-minute periods.
One error may be a network hiccup; two consecutive ones indicate a real
problem. `treat_missing_data = notBreaching` — no invocation means no error,
which the other alarm covers.

**The Lambda stops running.** Metric `Invocations`, fewer than one per hour
when there should be four.

The second is the insidious one: no error is produced, nothing simply happens.
Hence `treat_missing_data = breaching`. Without it, CloudWatch would treat the
absence of data as an insufficient state and never fire — precisely the failure
being watched for.

Both alarms verified against real data: `Invocations = 4.0` over the last hour,
`Errors = 0.0`. The SNS subscription was confirmed — a topic left in
`PendingConfirmation` receives messages and notifies nobody.

### Node version drift, found by accident

Vercel runs both projects on **Node 24**. The Docker image and CI ran Node 20.

Nobody had noticed. The container was validating on a version that does not
serve production — the exact environment gap containerisation is meant to
eliminate.

The initial plan was to move everything to Node 22, on the assumption that
Vercel ran Node 20. Checking rather than assuming reversed the direction:
production dictates the version, not the other way round.

Aligned to 24 across the Dockerfile and all three CI jobs. The Lambda stays on
`nodejs22.x` — Lambda runtimes do not track Node LTS releases immediately.

### Graceful shutdown

Measured: `api-1 exited with code 137` — 128 + 9, SIGKILL — while PostgreSQL
exited 0 in the same `docker compose down`.

`server.close()` now stops accepting new connections and waits for in-flight
requests, then the pool closes in the callback so those requests can still use
it. An 8-second timer forces exit if shutdown stalls: a graceful shutdown that
never completes is worse than an abrupt one.

| | Before | After |
|---|---|---|
| Exit code | 137 | 0 |
| Shutdown | 10 s (grace period) | 0.3 s |

Scope note: the block only runs outside serverless. On Vercel the application
is invoked without a persistent HTTP server. This fixes the container, not
production.

### The secret in the query string

`verifierSecret` accepted the shared secret from the URL as well as the header.
A secret in a query string is an exposed secret: full URLs are logged by
servers, proxies and CDNs, appear in the `Referer` header, and persist in
browser history.

Verified before removing it that no caller used that path.

**The first test proved nothing.** Both routes returned 401 — but for the wrong
reason: `compose.yaml` never defined `EMAIL_WEBHOOK_SECRET`, so `verifierSecret`
returned false regardless of input. The route had been untestable locally all
along.

After adding a development value: header returns 503 (authentication passed,
the route runs and fails later on IMAP), query string returns 401. **Two
distinct codes for two distinct paths** — that is what makes the test
conclusive.

A negative test only has value when the positive case is verified alongside it.
Otherwise it proves that something fails, not that the right thing fails for
the right reason.

### The warning nobody was going to fix

One ESLint warning appeared on every CI run for two days — `<img>` instead of
`<Image />` — without ever failing the job. The rule is set to `warn`, so the
command exits 0.

A signal that constrains nothing gets ignored. That is the whole argument
behind every blocking check in this pipeline, demonstrated on a small scale.

The project had exactly one warning, which made `--max-warnings=0` free to
adopt. At twenty it would have been a cleanup project.

Migrating to `<Image fill />` moved the aspect ratio from the image to the
`<figure>`, which needed `relative`. `sizes` was added — with `fill`, Next
otherwise assumes 100vw and serves an oversized image, the opposite of the
intended optimisation.

**And the browser found something the linter could not.** Opening the page
surfaced a Next.js notice: the image is the page's Largest Contentful Paint, so
lazy loading delays the very element that measures perceived performance.
`priority` fixes it.

Neither ESLint nor CI reports this. Only loading the page does.

### Documentation drift, quantified

`DEPLOIEMENT.md` was a setup guide — "the projects still need creating" — for
infrastructure that had existed for a long time. And it described an
architecture that never existed:

| Documented | Actual |
|---|---|
| `mymifa-frontend` / `mymifa-api` | `mymifa-fwry` / `mymifa` |
| `api.mymifa.com` | `mymifa.vercel.app` |
| `mymifa.com` | `www.mymifa.com` |
| `NEXT_PUBLIC_API_URL = https://api.mymifa.com/api` | `https://mymifa.vercel.app/api` |
| `FRONTEND_ORIGIN = https://mymifa.com` | `https://www.mymifa.com` |

Five discrepancies out of five verifiable points.

The real values were established at the source rather than from the file: the
API URL through the browser's network tab, the CORS origin through an `OPTIONS`
preflight against the API.

This drift had a cost — on day one it led to a wrong diagnosis about a deleted
Vercel project.

Replaced by `docs/DEPLOYMENT.md`: an operational reference rather than a guide.
What runs where, which variables each project expects, and how to intervene —
secret rotation, diagnosing a stopped sync, rebuilding the schema, bringing the
ECS demo up and down.

### A decision not to optimise

The image is 379 MB: 85 MB of Debian, 126 MB of Node, 75 MB of dependencies,
and **287 kB of application code** — 0.08 %.

Alpine would replace Debian's 85 MB with roughly 8 MB. It was considered and
declined.

The gain is theoretical: this image is deployed nowhere, it serves local
development and an ephemeral demonstration, both of which cache layers. The
risk is real: Alpine uses `musl` instead of `glibc`, and also differs in DNS
resolution and timezone handling — subtle differences that surface in
production rather than in testing.

Deciding not to optimise, on the basis of a measurement, is worth more than
optimising by reflex. Three times across these two days a pessimistic estimate
proved wrong and the anticipated problem did not exist.

### Chain status

Six blocking checks on `main`, no bypass:

| Check | Verifies |
|---|---|
| Frontend — lint & build | ESLint with `--max-warnings=0`, Next.js production build |
| Backend — syntaxe & tests | `node --check`, 25 unit tests |
| Docker — lint & build | hadolint, image builds on a clean runner |
| Migrations — reconstruction depuis zéro | Schema rebuilt on an empty database, table count asserted |
| Workflows — lint | actionlint and shellcheck |
| Terraform — fmt & validate | Canonical formatting, configuration validity |

Plus a non-blocking `Docker — publish to GHCR`, running on `main` only.

**AWS, permanent:**

```
EventBridge Scheduler ──► Lambda ──► API MyMifa
    rate(15 minutes)      Node 22    /api/emails/sync
                             │
                    CloudWatch alarms ──► SNS ──► email
```

### Remaining

1. Upgrade the AWS account to the paid plan before 7 September — otherwise the
   account closes and its contents are erased after 90 days, including the S3
   bucket holding the CVs.
2. No staging environment. Vercel preview deployments run against the
   production database.
3. Nothing keeps local `.env` files and Vercel variables aligned. They have
   diverged at least once.
4. `api.mymifa.com` is still not attached; the API answers on a domain outside
   our control.
