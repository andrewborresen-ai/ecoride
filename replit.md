# EcoRide Fleet Platform

A real-time fleet operating platform for electric (EcoRide) and LPG (Khula Rides) vehicle fleets. Manages driver onboarding, admin approvals, shift scheduling, vehicle assignments, telematics integration, vehicle unlock/biometric ignition orchestration, earnings management, and in-app notifications.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (auto-rebuilds)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes to development DB
- `pnpm --filter @workspace/db run push-force` — force push if column conflicts occur

## Required Secrets

- `DATABASE_URL` — Replit built-in PostgreSQL (auto-provisioned)
- `CLERK_SECRET_KEY` — Clerk auth secret key (auto-provisioned)
- `CLERK_PUBLISHABLE_KEY` — Clerk publishable key (auto-provisioned)
- `VITE_CLERK_PUBLISHABLE_KEY` — Same key for Vite frontends (auto-provisioned)
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` — Replit Object Storage bucket (auto-provisioned)
- `PUBLIC_OBJECT_SEARCH_PATHS` — Object storage public paths (auto-provisioned)
- `PRIVATE_OBJECT_DIR` — Object storage private dir (auto-provisioned)
- `TELEMATICS_API_URL` — CanFleet SA API base URL (set manually when available)
- `TELEMATICS_API_KEY` — CanFleet SA API key (set manually when available)

## Where Things Live

- `lib/api-spec/openapi.yaml` — Single source of truth for all API contracts
- `lib/db/src/schema/` — All 12 Drizzle ORM table definitions (one file per table)
- `lib/db/src/schema/index.ts` — Schema barrel export
- `lib/api-zod/src/generated/` — Generated Zod validation schemas (from codegen)
- `lib/api-client-react/src/generated/` — Generated React Query hooks (from codegen)
- `artifacts/api-server/src/routes/` — Express route handlers (split by domain)
- `artifacts/api-server/src/middlewares/auth.ts` — Clerk auth + RBAC middleware
- `artifacts/api-server/src/integrations/telematics/` — CanFleet SA adapter
- `artifacts/api-server/src/lib/objectStorage.ts` — Replit Object Storage GCS wrapper
- `attached_assets/` — Brand logo and original specification documents

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (at `/api`, versioned routes at `/api/v1/...`)
- DB: Replit built-in PostgreSQL + Drizzle ORM (snake_case tables, UTC timestamps)
- Auth: Clerk (email/password, two roles: `driver` and `admin`)
- Storage: Replit Object Storage (GCS-backed, presigned URL uploads)
- Validation: Zod (`zod/v4`), drizzle-zod
- Codegen: Orval (OpenAPI → React Query hooks + Zod schemas)
- Build: esbuild
- Logging: pino + pino-http (structured JSON, `req.log` in handlers)

## Architecture Decisions

- **All money in minor units (cents) with ISO currency code** — `grossAmountCents`, `netAmountCents`, etc. Default currency: ZAR.
- **Soft deletes only** — `deletedAt` timestamp, never hard DELETE from DB.
- **Telematics is non-blocking** — driver approval and vehicle assignment creation trigger telematics registration in a fire-and-forget background call; status tracked via `telematics_sync_status` field.
- **EcoRide never builds biometric AI** — the platform only sends unlock requests to CanFleet SA and receives pass/fail callbacks via `POST /api/v1/webhooks/telematics`.
- **All API responses use envelope** — `{ success, data, error, meta }`. Errors always have `success: false`.
- **Clerk proxy at `/api/__clerk`** — both the web and mobile clients must point their Clerk proxy URL here.

## Database Tables (12)

`users`, `driver_profiles`, `driver_documents`, `agreements`, `agreement_signatures`, `shifts`, `shift_allocations`, `earnings`, `notifications`, `vehicles`, `vehicle_assignments`, `vehicle_access_events`

## Brand

- Primary green: `#3DB324` (car icon and "RIDE" in logo)
- Dark charcoal: `#1C2126` ("ECO" text and body)
- Tagline: "RIDE SMARTER"
- Logo: `attached_assets/ChatGPT_Image_May_12,_2026,_03_20_48_PM_1778598528632.png`

## User Preferences

- Use Replit built-in PostgreSQL (not Neon or other external DBs)
- Use Clerk for authentication (not Replit Auth)
- snake_case for DB columns, PascalCase for React components, camelCase for functions, kebab-case for files and routes
- All timestamps UTC

## Gotchas

- **Run codegen after every OpenAPI spec change**: `pnpm --filter @workspace/api-spec run codegen`
- **Run DB push after schema changes**: `pnpm --filter @workspace/db run push`
- **Telematics adapter gracefully skips if `TELEMATICS_API_URL` is not set** — platform works without telematics in development; all unlock attempts will log a warning and fail gracefully.
- **Admin routes require role `admin` in the `users` table** — set this directly in the DB for the first admin user.
- **Express 5 wildcard syntax**: use `/{*splat}` not `*`; optional params use `{/:id}` not `/:id?`.
- **Do not run `pnpm dev` at workspace root** — run workflows via Replit or `restart_workflow`.
