# PulseWatch ⚡

**Uptime & status monitoring platform** — monitor websites, APIs and infrastructure with
90-day uptime history, incident tracking, public status pages, signed webhooks and a
rate-limited REST API.

> Built as a production-grade showcase: Next.js 14 App Router · TypeScript (strict) ·
> Prisma · PostgreSQL/SQLite · Redis · Vitest · Docker · GitHub Actions CI.

---

## ✨ Features

| Area | What you get |
|---|---|
| **Monitoring** | HTTP(S) + TCP checks, configurable interval (30s–1h), timeout, retries, expected status |
| **Smart checks** | Keyword / forbidden-keyword content checks, SSL certificate expiry monitoring, heartbeat monitors for cron jobs, and consecutive-failure confirmation before DOWN |
| **Analytics** | 90-day uptime bars, 24h latency chart (Recharts), uptime %, avg/p95 response |
| **Incidents** | Auto-opened on DOWN, auto-resolved on recovery, investigate → resolve workflow |
| **Alerting** | HMAC-SHA256 signed webhooks (`MONITOR_DOWN` / `MONITOR_UP`) to any HTTPS endpoint |
| **Status pages** | Public `/status/[slug]` page per account with live availability |
| **Auth** | JWT sessions in HttpOnly cookies (jose) + bcrypt password hashing |
| **API** | Session- or API-key-authenticated REST with per-IP rate limiting |
| **Ops** | Background check scheduler in-process, Redis caching w/ in-memory fallback, Docker Compose (app + Postgres + Redis), GitHub Actions CI |

---

## 🚀 Quick start (local dev)

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env          # defaults work out of the box (SQLite, in-memory cache)

# 3. create schema + demo data
npm run db:push
npm run db:seed               # demo@pulsewatch.dev / demo1234

# 4. run
npm run dev                   # http://localhost:3000
```

The demo seed creates 8 monitors (7 probed + 1 heartbeat) with 90 days of checks
and incidents, so the dashboard is fully populated on first login. The demo
Marketing Site monitor has a keyword check (`PulseWatch`), SSL expiry monitoring
and `confirmFailures: 2` enabled, and the Nightly Backup Job is a heartbeat monitor.

### Optional: full stack via Docker

```bash
docker compose up --build     # app on :3000, Postgres on :5432, Redis on :6379
```

---

## 🧱 Tech stack

- **Next.js 14** (App Router, Server Components, Route Handlers, middleware)
- **TypeScript** in strict mode, end to end
- **Prisma ORM** with SQLite (dev) / PostgreSQL (prod) — one env var swap
- **Redis** via a dependency-free RESP client (`src/lib/redis.ts`) with automatic in-memory fallback
- **Tailwind CSS** + **Recharts** + **lucide-react**
- **jose** (JWT) + **bcryptjs** (password & API-key hashing)
- **Zod** validation on every write endpoint
- **Vitest** unit tests, **Docker**, **GitHub Actions** CI

---

## 🏗 Architecture

```
Browser ──> Next.js (RSC + Route Handlers)
              │
              ├── middleware.ts ............. session gate (JWT verify at the edge)
              ├── (marketing)/(auth)/(dashboard) ... UI layers
              ├── /api/auth/* ............... register, login, logout, me
              ├── /api/v1/monitors[...] ..... CRUD + incidents (session or API key)
              ├── /api/v1/cron/check ........ scheduler trigger (CRON_SECRET)
              ├── /api/v1/status/[slug] ..... public status JSON (cached)
              │
              ├── lib/scheduler.ts .......... in-process 30s tick loop (globalThis singleton)
              │      └── lib/checker.ts ..... HTTP/TCP probe with timeout + retries
              │      └── lib/ssl.ts ........ TLS cert expiry lookup (node:tls, no deps)
              │      └── lib/smart-checks.ts  pure helpers: keyword, heartbeat, confirm, expiry
              │      └── lib/webhooks.ts .... HMAC-signed deliveries
              ├── lib/uptime.ts ............. bucketing & uptime math (unit-tested)
              └── Prisma ──> SQLite / PostgreSQL
                    └── Redis (cache tier, optional)
```

**Why an in-process scheduler?** It keeps the demo deployable to a single container or
Vercel with zero extra infrastructure. For horizontal scale, point a platform cron at
`POST /api/v1/cron/check` (or run multiple app replicas — the scheduler dedupes in-flight
checks per monitor).

---

## 🔌 REST API

Auth: session cookie (browser) **or** `Authorization: Bearer <api-key>`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account (rate-limited 5/10min) |
| `POST` | `/api/auth/login` | Sign in (rate-limited 10/5min) |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/auth/me` | Current session |
| `GET/POST` | `/api/v1/monitors` | List / create monitors |
| `GET/PATCH/DELETE` | `/api/v1/monitors/:id` | Read / update (incl. `paused`) / soft-delete |
| `GET` | `/api/v1/monitors/:id/incidents` | Incident history for a monitor |
| `PATCH` | `/api/v1/incidents/:id` | Update incident status/cause |
| `GET/POST` | `/api/v1/webhooks` | List / create webhooks (returns signing secret once) |
| `GET/POST` | `/api/v1/api-keys` | List / create API keys (secret shown once) |
| `GET` | `/api/v1/status/:slug` | Public status JSON (cached 30s, rate-limited) |
| `POST` | `/api/v1/cron/check` | Trigger a scheduler tick (needs `CRON_SECRET`) |
| `POST` | `/api/v1/heartbeats/:token` | Heartbeat ping (token in path is the credential) |

### Example: create a monitor with an API key

```bash
curl -X POST https://your-host/api/v1/monitors \
  -H "Authorization: Bearer pw_live_xxxx_yyyy" \
  -H "Content-Type: application/json" \
  -d '{"name":"Docs","url":"https://docs.example.com","intervalSec":60}'
```

### Verifying webhook signatures

```js
import crypto from "node:crypto";

const isValid = crypto.timingSafeEqual(
  crypto.createHmac("sha256", SIGNING_SECRET).update(`${t}.${rawBody}`).digest(),
  Buffer.from(v1, "hex")
);
// where header "x-pulsewatch-signature: t=<unix>,v1=<hex>" and rawBody is the
// exact request body string
```

---

## 🔍 Smart checks

Beyond status codes, monitors can verify *what* a service returns and *whether
a job ran at all*.

| Check | How it works |
|---|---|
| **Keyword** | `keyword` must appear in the response body (case-insensitive, first 512 KB); `forbiddenKeyword` must not. Failures are `KEYWORD_NOT_FOUND` / `FORBIDDEN_KEYWORD_FOUND`. A 200 that says "Error" is DOWN. |
| **SSL expiry** | `sslCheckEnabled` (https only) reads the TLS certificate on each check. An expired cert fails the check (`SSL_EXPIRED`); a cert expiring within `sslWarnDays` (default 14) sets `sslWarning` but still passes. `sslExpiresAt` / `sslDaysLeft` are stored on the monitor and each check. |
| **Heartbeat** | For cron jobs / background workers that can't be probed. The job pings `POST /api/v1/heartbeats/:token`; the monitor goes DOWN with cause `HEARTBEAT_MISSED` when no ping arrives within `heartbeatIntervalSec + heartbeatGraceSec` (defaults 3600s + 300s). A monitor that was never pinged stays PENDING until the grace period after creation passes. |
| **Confirm failures** | `confirmFailures` (1–5, default 1) requires that many *consecutive* failed ticks before the monitor goes DOWN, an incident opens and `MONITOR_DOWN` fires. Single blips keep the previous status. |

> **Honest note:** `confirmFailures` is consecutive-tick confirmation from this
> single PulseWatch instance — it is *not* a second geographic probe region.
> A network blip on this host can still delay or cause a DOWN. Full
> multi-region probing (EU/US/Asia) is still future work — see Roadmap.

### Example: create a monitor with keyword + SSL + confirmation

```bash
curl -X POST https://your-host/api/v1/monitors \
  -H "Authorization: Bearer pw_live_xxxx_yyyy" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Marketing Site",
    "url": "https://example.com",
    "intervalSec": 60,
    "keyword": "PulseWatch",
    "forbiddenKeyword": "Error",
    "sslCheckEnabled": true,
    "sslWarnDays": 14,
    "confirmFailures": 2
  }'
```

### Example: create a heartbeat monitor and ping it

```bash
# 1. create — the 201 response includes heartbeatToken (owner-only, shown once)
curl -X POST https://your-host/api/v1/monitors \
  -H "Authorization: Bearer pw_live_xxxx_yyyy" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nightly Backup Job",
    "url": "https://backup.example.com/jobs/nightly",
    "kind": "HEARTBEAT",
    "heartbeatIntervalSec": 3600,
    "heartbeatGraceSec": 300
  }'

# 2. ping it from your job / cron — no session or API key needed,
#    the token in the path is the credential, so keep it secret
curl -X POST https://your-host/api/v1/heartbeats/<heartbeatToken>
# => {"ok":true,"monitorId":"..."}
```

---

## 🧪 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with the in-process scheduler |
| `npm run build` | Prisma generate + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run db:push` | Sync Prisma schema to the database |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio GUI |

---

## 📦 Deployment

**Vercel (zero-config):**
1. Push to GitHub and import the repo.
2. Set env vars: `DATABASE_URL` (Postgres, e.g. Neon), `JWT_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.
3. Add a cron hitting `POST /api/v1/cron/check` every minute (Vercel Cron or cron-job.org) —
   the in-process scheduler keeps things running without it, but external cron is more reliable on serverless.

**Docker (any VPS):**
```bash
docker compose up -d
docker compose exec app npx prisma db push
```

---

## 🗺 Roadmap

- Multi-region probes (EU/US/Asia) with per-region latency breakdowns
- Email/Slack/PagerDuty notification channels
- Maintenance windows
- Playwright E2E suite for the dashboard flows
