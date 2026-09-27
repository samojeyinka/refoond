# refoond

An AI-assisted, policy-driven customer support refund system.

Approval, denial, and escalation are decided by a **versioned deterministic rule engine**. Gemini handles
classification and conversation only — it never overrides a policy decision.

**Frontend** React + Vite + TypeScript · **Backend** Express + TypeScript + MongoDB · **Realtime** Socket.IO

---

## Quick Start

```bash
docker compose up -d
docker compose up
```

That is the whole setup. Each Dockerfile runs `npm ci` itself, so there is **no `npm install`** to run on the
host, and the backend seeds the database on every start. First boot takes a few minutes while the images build.

| Service | URL |
| --- | --- |
| Frontend app | http://localhost:5173 |
| Backend API | http://localhost:5050 |
| **API docs (Swagger)** | **http://localhost:5050/api-docs/** |
| Mongo Express | http://localhost:8084 |

**One manual step on a new machine:** create `frontend/.env` with your Gemini key (see
[Gemini setup](#gemini-setup-required)). It is gitignored, so a fresh clone will not have it. Without it the app
still runs and every policy decision still works — only the AI chat shows an error state.

> Re-seeding later: `docker exec refoond-backend npm run seed` (destructive, wipes the data first).
>
> Full demo script, every seeded account and all 18 orders: **[DEMO.md](DEMO.md)**

### Sign in

Password for every account is **`Password123!`**

| Role | Email | Shows |
| --- | --- | --- |
| Admin | `admin@refoond.dev` | Queue, handoffs, review, resolution |
| Customer | `amara.okafor@example.com` | An approval **and** a denial |
| Customer | `priya.nair@example.com` | An **escalation** to a human |
| Customer | `lucas.moreau@example.com` | A **prompt-injection** attempt |

---

## Gemini setup (required)

The assistant runs **in the browser**, so the key goes in the frontend env. Get a free key at
<https://aistudio.google.com/apikey>, then create `frontend/.env`:

```bash
VITE_GEMINI_API_KEY=AIzaSy...your_key_here
VITE_GEMINI_MODEL=gemini-2.5-flash-lite
```

Restart the frontend afterwards — Vite reads env vars only at startup. Without a key the chat shows an error
state, but the policy engine and the whole admin side still work.


---

## Policy reference

| Rule | Value |
| --- | --- |
| Return window | 30 days from delivery |
| Automatic approval limit | $500.00 — above this escalates to a human |
| New-account review | Account ≤ 2 days old **and** request ≥ $200.00 escalates |
| Repeat refunder limit | 3 prior refunds escalates |
| Duplicate requests | More than 1 existing request on the order escalates |
| Final-sale items | Excluded from the refundable amount |
| Policy version | `2026-02-01` |

Terminal denials, checked before any amount is considered: the order is already fully refunded, the order is
`CANCELLED` or `RETURNED`, or the order is outside the 30-day window.

---

## API documentation

Swagger UI is served by the backend, so there is nothing extra to run:

| URL | What |
| --- | --- |
| <http://localhost:5050/api-docs/> | Interactive Swagger UI — all 16 endpoints |
| <http://localhost:5050/api-docs.json> | The raw OpenAPI 3.0.3 document |

To call the authenticated endpoints from Swagger: expand **`POST /auth/login`**, click **Try it out** →
**Execute**, and sign in with a seeded account. The session is an httpOnly cookie, so the browser attaches it
to every later request — there is no token to paste.

### Changing an endpoint

`backend/src/openapi.json` is maintained **by hand**; there is no code generation step and no refresh command.
If you add or change a route:

1. Edit `backend/src/openapi.json` to match.
2. **Restart the backend** — the spec is read once at startup, and nodemon only watches `.ts` files, so a JSON
   edit does not hot-reload. Use `docker compose restart backend`, or press `rs` in a host-mode nodemon terminal.
3. Run `npm test`. `backend/src/tests/docs.test.ts` walks the real Express router and fails if a route is
   undocumented, documented but not implemented, or has a dangling `$ref`.

---

## Development

```bash
# Docker (normal path)
docker compose up -d

# Host mode: Mongo in Docker, Node on the host
docker compose up -d mongo mongo-express
cd backend    && npm install && cp .env.example .env && npm run seed && npm run dev
cd frontend   && npm install && npm run dev
```

| Command | Where | Does |
| --- | --- | --- |
| `npm run dev` | both | Run with auto-reload |
| `npm run seed` | backend | Reset and reseed demo data (destructive) |
| `npm test` | both | 45 backend API/integration + 14 frontend unit tests |
| `npm run typecheck` | both | Type-check without emitting |
| `npm run build` | both | Compile for production |

> Adding a **dependency** needs a container rebuild, not just a restart — the image owns its own
> `node_modules`:
> `docker compose rm -f backend && docker compose up -d --build backend`

---

## Notes and limitations

- **The browser calls Gemini directly**, so `VITE_GEMINI_API_KEY` is visible to anyone using the app. Proxy the
  model calls through the backend before production. The API ships a strict CSP (`default-src 'none'`), but the
  frontend is served by the Vite dev server, which cannot send one.
- **Audio needs a click first.** Browsers block sound until you have interacted with the page. The bell button
  mutes everything and the choice persists in `localStorage`.
- **Unread badges need a thread to be opened**, because opening it is what marks it read. A brand-new thread
  shows every message as unread until first visited. Your own messages and the `Decision: …` system line never
  count as unread for you.
- **Names are not backfilled.** Messages sent before `authorName` existed show generic labels; re-seed for a
  clean history.
- **`ruleId` and `policyRef` are still returned by the API** but are no longer rendered. They remain in the
  database for audit.
- **Tests cover logic, not layout.** There is no Playwright/Cypress suite, so the walkthroughs in
  [DEMO.md](DEMO.md) are still verified by hand.
