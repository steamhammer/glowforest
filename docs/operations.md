# Operations

Deployment, rollback, and data-loading procedures for the RimWorld mod-list showcase.

## Package manager

This repository uses pnpm only. `preinstall` rejects other package managers, `packageManager`
pins the pnpm version, and only `pnpm-lock.yaml` is committed.

## Resources

| Resource | Value |
|---|---|
| Worker | `rimworld-modlist-showcase` |
| URL | `https://rimworld-modlist-showcase.ihatenoise.workers.dev` |
| D1 database | `modlist` (`8c5ba496-870f-427b-b320-2b0e0c67372b`) |
| R2 bucket | `modlist-previews` |

## Deploy

```bash
pnpm run deploy
```

Each deploy uploads the Worker and the static assets in `public/` and records a new version. The D1 schema is applied separately:

```bash
pnpm run db:migrate:remote   # production
pnpm run db:migrate:local    # local .wrangler state
```

Migrations are append-only SQL files in `migrations/`. Never edit an applied migration; add a new one.

## Secrets and variables

| Binding | Type | Purpose |
|---|---|---|
| `ADMIN_TOKEN` | secret | Authorises `POST /__admin/import-index`; compared by hash |
| `ENVIRONMENT` | var | `production` disables `/__diagnostic` and token-less imports |
| `META_FRESHNESS_SECONDS` | var | Cache lifetime for Steam metadata (default 7 days) |
| `STEAM_TIMEOUT_MS` | var | Outbound Steam request timeout |

Rotate the admin token with `printf '%s' "<new token>" | npx wrangler secret put ADMIN_TOKEN`.

## Loading the community package index

The `workshop_mods` table maps package IDs to Workshop IDs. It is filled from the
RimSort Steam-Workshop-Database dataset (`steamDB.json`):

1. Download the dataset from `https://github.com/RimSort/Steam-Workshop-Database`.
2. Run `pnpm run index:import -- <path/to/steamDB.json> <worker-url>` with `ADMIN_TOKEN` set.

The import is idempotent: rows are upserted by Workshop ID, so it can be re-run
at any time (for example when the dataset is refreshed upstream) without
duplicating entries or touching live lists. Progress and failures are printed;
a failed batch is retried in halves before being reported.

## Rollback

Worker code and assets are versioned. To roll back:

```bash
npx wrangler versions list
npx wrangler rollback <version-id>
```

Rolling back restores the previous Worker bundle and assets. It does **not**
touch D1 or R2: the schema is additive and the index import is idempotent, so a
rolled-back Worker keeps serving against the current data. To undo a schema
migration, write and apply a new migration that reverses it (the SQL for
`0001_init.sql` is listed in its header).

R2 preview images are keyed by `og/<list-id>-<updated_at>.png`, so stale cards
are never overwritten and a rolled-back Worker simply renders the keys it knows.

## Local development

```bash
pnpm run db:migrate:local
pnpm dev             # wrangler dev with local D1/R2 state
pnpm test            # vitest with real bindings via @cloudflare/vitest-pool-workers
pnpm run typecheck
```
