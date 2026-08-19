# Deployment reference

Operational reference for the deployed environments: what runs where, which
variables each project needs, and how to intervene when something breaks.

This is not a setup guide — the infrastructure already exists. For an
overview of the stack and architecture, see the [README](../README.md).

---

## Where things run

| Vercel project | Root directory | Serves | Node |
|---|---|---|---|
| `mymifa-fwry` | `frontend` | `https://www.mymifa.com` | 24 |
| `mymifa` | `backend` | `https://mymifa.vercel.app` | 24 |

The project names are inverted relative to what they serve: `mymifa` is the
API, `mymifa-fwry` is the frontend. The suffix was assigned by Vercel because
the name `mymifa` was already taken by the first import.

**Both projects deploy from the same repository**, distinguished only by their
root directory. Every push builds a preview per branch; merging to `main`
ships to production.

### Domains

`www.mymifa.com` points to Vercel through an A record at Hostinger. The apex
`mymifa.com` is not attached to any project.

The API answers on its default `.vercel.app` domain. This is a known
weakness: the URL is not under our control, and renaming the project would
break the frontend — `NEXT_PUBLIC_API_URL` is compiled into the client bundle
at build time, so any change requires a frontend rebuild.

---

## Environment variables

### Backend — project `mymifa`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string. Must target the `-pooler` endpoint: each serverless instance opens its own pool, and a direct endpoint would exhaust the connection limit. Must carry `sslmode=require` — TLS is enabled only when this parameter is present. |
| `ADMIN_PASSWORD` | The single password behind the lock screen. Also the fallback signing secret if `SESSION_SECRET` is unset — in which case changing it invalidates every session. |
| `SESSION_SECRET` | HMAC signing key for session tokens. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `EMAIL_WEBHOOK_SECRET` | Shared secret for `POST /api/emails/sync`, accepted in the `x-webhook-secret` header only. |
| `ANTHROPIC_API_KEY` | ATS scoring, cover letters, interview preparation. |
| `AWS_REGION` | `eu-central-1` |
| `AWS_ACCESS_KEY_ID` | IAM user `mymifa-api-s3`, scoped to the bucket. |
| `AWS_SECRET_ACCESS_KEY` | Paired secret. |
| `AWS_S3_BUCKET_NAME` | `mymifa-api-s3` |
| `FRONTEND_ORIGIN` | `https://www.mymifa.com` — note the `www`. The apex is a different origin under the CORS specification, and would be rejected. |

`FRONTEND_ORIGIN` and `DATABASE_URL` are checked at startup: without them the
application refuses to boot in production rather than silently accepting every
origin. `NODE_ENV=production` or `VERCEL=1` must be set for this check to be
enforced.

### Frontend — project `mymifa-fwry`

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://mymifa.vercel.app/api` |

The `NEXT_PUBLIC_` prefix compiles the value into the client bundle — it is
public by construction. Never place a secret there. **Changing it requires a
rebuild**, since the value is frozen at build time rather than read at runtime.

---

## AWS

Complementary to Vercel, not a replacement. Managed by Terraform in
[`infra/`](../infra), except where noted.

| Resource | Purpose | Managed by |
|---|---|---|
| S3 `mymifa-api-s3` | Document storage, private, presigned URLs | created by hand |
| S3 `mymifa-tfstate-…` | Terraform state, versioned and encrypted | created by hand |
| SSM parameters under `/mymifa/` | Secrets for the Lambda and the ECS demo | created by hand |
| EventBridge Scheduler + Lambda | Triggers the email sync every 15 minutes | Terraform |
| CloudWatch alarms | Notifies when the sync fails or stops running | Terraform |
| Budgets | Spend alerts, actual and forecasted | Terraform (one), by hand (one) |

Secrets live in SSM Parameter Store as `SecureString`, outside Terraform:
declaring them as resources would write their values in clear text into the
state file. Terraform reads them through `data` blocks.

---

## Common interventions

### Rotating a secret

A secret may live in up to three places: Vercel, SSM, and GitHub Actions
secrets. **They do not synchronise.** Updating one and forgetting the others
produces a 401 that is hard to trace — this has happened.

1. Generate the new value.
2. Update it in Vercel (*Settings → Environment Variables*) and **redeploy** —
   variables are read at build time for the frontend, at cold start for the
   backend.
3. Update the matching SSM parameter if one exists:
   `aws ssm put-parameter --name /mymifa/<name> --type SecureString --value "<value>" --region eu-central-1 --overwrite`
4. Update the GitHub Actions secret if one exists.
5. Force a new Lambda execution context — the secret is cached in memory
   between invocations and a rotation is not picked up until the context is
   recycled.

### The email sync has stopped

A CloudWatch alarm fires after an hour without an invocation. To diagnose:

```bash
aws logs tail /aws/lambda/mymifa-sync-emails --since 1h --region eu-central-1
```

The GitHub workflow `sync-emails.yml` remains triggerable manually from the
Actions tab as a fallback. Its `schedule` trigger was removed — GitHub treats
scheduled events as best-effort, measured at 19 runs a day instead of 96.

### Rebuilding the database schema

Migrations replay from an empty database:

```bash
docker compose down -v && docker compose up -d --build
docker compose exec api npm run migrate
```

`000_schema_initial.sql` is a baseline extracted with `pg_dump`, not a
historical step. It records migrations 001 through 005 as applied, since it
already contains their effect.

### Bringing up the ECS demo

```bash
cd infra/demo-ecs && terraform init && terraform apply
```

Roughly 0.047 USD per hour — ALB, Fargate task and public IPv4. **Destroy it
after use**: `terraform destroy`.

---

## Known weaknesses

- The API answers on a `.vercel.app` domain rather than a controlled
  subdomain. Attaching `api.mymifa.com` would require updating
  `NEXT_PUBLIC_API_URL` and rebuilding the frontend.
- The apex `mymifa.com` is attached to no project.
- No staging environment. Vercel preview deployments run against the
  production database.
- Local `.env` files and Vercel variables have diverged at least once. There
  is no mechanism keeping them aligned.