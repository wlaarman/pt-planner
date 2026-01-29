# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PT Planner is een agenda-applicatie voor personal trainers om afspraken te beheren, deelnemers te tracken en facturen te genereren. De applicatie is in het **Nederlands**.

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand (authStore)
- **Data Fetching:** TanStack Query (React Query)
- **Backend:** Vercel Serverless Functions (api/*.ts)
- **Database:** PostgreSQL via Neon (cloud)
- **ORM:** Prisma
- **Authentication:** JWT tokens

## Development Commands

```bash
# Start local dev server (frontend only, talks to production API)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Database operations
npm run db:migrate    # Run migrations
npm run db:push       # Push schema changes
npm run db:studio     # Open Prisma Studio
npm run db:seed       # Seed demo data
```

### Local Development with Docker (optional)

For full local stack (frontend + backend + database):
```bash
docker-compose up --build
# Frontend: http://localhost:5173
# Backend API: http://localhost:3001
# Then run migrations: docker-compose exec backend npx prisma migrate dev
```

## Environment Variables

Required in Vercel (production) or `.env` (local):
- `DATABASE_URL` - Neon PostgreSQL connection string (pooled)
- `DIRECT_URL` - Direct database URL (for Prisma migrations)
- `JWT_SECRET` - JWT signing secret
- `EBOEKHOUDEN_ACCESS_TOKEN` - e-Boekhouden API token

## Deployment

- **Hosting:** Vercel (auto-deploys from GitHub on push)
- **URL:** https://pt-planner.vercel.app
- **BELANGRIJK:** Deploy via `git push`, NIET via `npx vercel --prod`
- **GitHub repo:** https://github.com/wlaarman/pt-planner

## Demo Login

- **Email:** jan@ptplanner.nl
- **Wachtwoord:** trainer123

## Architecture

### Project Structure

```
/api                    # Vercel serverless functions
/lib                    # Shared utilities (NOT in /api - avoids deployment as functions)
  auth.ts               # JWT auth helpers
  prisma.ts             # Prisma client singleton
/prisma
  schema.prisma         # Database schema
  seed.ts               # Demo data
/src
  /components           # React components
  /lib/api.ts           # API client (axios)
  /pages                # Page components
  /stores               # Zustand stores
```

### API Routes Pattern

Routes use catch-all files like `[[...params]].ts`. The `vercel.json` rewrites base routes to `/_` (e.g., `/api/trainers` → `/api/trainers/_`).

**CRITICAL - Catch-all param extraction:**
```typescript
// Vercel passes params with brackets in the key
const params = req.query['[...params]'] || req.query['[[...params]]'] || req.query['...params'];
```

**CRITICAL - Helper function inlining:**
Due to Vercel bundling issues, API files inline auth/prisma helpers instead of importing from `/lib`. When creating new API routes, copy the inline helpers pattern from existing files (see `api/appointments/[id].ts:6-36`).

### Vercel Function Limit

- **Hobby plan limiet:** Max 12 serverless functions
- **Currently at the limit (12 functions)**
- Combine routes in one file (e.g., `[id].ts` handles GET/PUT/PATCH/DELETE)
- Avoid separate files for sub-routes - combine in the parent handler

### Database Models (Prisma)

Key models:
- `User` - Trainers/admins (has icalUrl for external calendar)
- `Participant` - Klanten
- `Appointment` - Afspraken (status: SCHEDULED, COMPLETED, CANCELLED, NO_SHOW)
- `TrainingType` - Soorten trainingen (1-op-1, 1-op-2, groepstraining)
- `Invoice` - Facturen met InvoiceItems
- `AppointmentParticipant` - Many-to-many relatie

**Note:** Prisma Decimal values need explicit conversion for comparisons:
```typescript
// Wrong: invoice.taxRate === 0
// Correct: Number(invoice.taxRate) === 0
```

## Key Features

1. **Kalender** - Week/dag weergave met drag & drop (@dnd-kit/core)
2. **iCal integratie** - Externe kalenders via iCal URL (ical.js)
3. **Recurring appointments** - Met recurrenceEndDate en "Alleen deze" / "Hele reeks" edit opties
4. **Facturatie** - Genereer facturen per periode (alleen COMPLETED afspraken)
5. **e-Boekhouden integratie** - Facturen versturen naar boekhoudpakket

## e-Boekhouden Integratie

**API endpoints:**
- `GET /api/eboekhouden/status` - Connectie status
- `GET /api/eboekhouden/relations` - Relaties ophalen
- `GET /api/eboekhouden/ledgers` - Grootboekrekeningen
- `POST /api/eboekhouden/send-invoice` - Factuur versturen

## PWA Support

De app is installeerbaar als Progressive Web App:
- `public/manifest.json` - App metadata
- `public/sw.js` - Service worker (network-first caching)
- `public/icons/` - App icons (72px - 512px)
- `scripts/generate-icons.cjs` - Genereer icons uit SVG

Service worker registratie in `src/main.tsx`.

## User Settings (localStorage)

Sommige instellingen worden lokaal opgeslagen:
- `pt-planner-show-sunday` - Toon zondag in weekweergave (default: false)
- `eboekhouden-template-id` - Laatst gebruikte factuursjabloon ID
- `eboekhouden-ledger-id` - Laatst gebruikte grootboekrekening ID

## Known Limitations

- Google Calendar OAuth is nog niet geimplementeerd (iCal werkt wel)
- CalendarConnection model bestaat maar OAuth flow is niet gebouwd

---

## Session Changes (30 jan 2026)

### Nieuwe Features Geïmplementeerd

#### 1. e-Boekhouden Relaties Importeren
- **Import modal**: `src/components/ImportEboekhoudenModal.tsx`
- Import knop op Deelnemers pagina
- Matching logica: eerst op `eboekhoudenId`, dan op email
- Statussen: "Gekoppeld", "Match gevonden", "Nieuw"

#### 2. e-Boekhouden Token in Applicatie
- Token configuratie in Instellingen pagina
- Opslag in `Settings` model (database) met fallback naar env var
- API endpoints: `PUT/DELETE /api/eboekhouden/token`

#### 3. "Geen Factuur" per Deelnemer
- `excludeFromInvoice` veld op Participant model
- Toggle in ParticipantModal
- Gefilterd in billable query

#### 4. Kostenverdeling bij Afspraken
- `isPayer` veld op AppointmentParticipant
- UI in AppointmentModal bij 2+ deelnemers
- Opties: "Gelijk verdelen" of "Eén betaler"

#### 5. PWA Installatie
- Automatische banner: `src/components/PWAInstallBanner.tsx`
- Expliciete installatie sectie in Instellingen
- Handmatige instructies voor iOS/Android/Desktop

### Database Wijzigingen (Prisma)

```prisma
model Participant {
  eboekhoudenId       Int?      @unique  // e-Boekhouden relatie ID
  excludeFromInvoice  Boolean   @default(false)
}

model AppointmentParticipant {
  isPayer             Boolean   @default(true)  // Kostenverdeling
}

model Settings {
  id                  String    @id @default("global")
  eboekhoudenToken    String?   // e-Boekhouden API token
  updatedAt           DateTime  @updatedAt
}
```

### Nieuwe/Gewijzigde Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `prisma/schema.prisma` | Participant, AppointmentParticipant, Settings model |
| `api/participants/[[...params]].ts` | Import endpoint + schema update |
| `api/eboekhouden/[[...params]].ts` | Token endpoints + Settings integratie |
| `api/invoices/[[...params]].ts` | Billable filter (excludeFromInvoice, isPayer) |
| `api/appointments/index.ts` | Kostenverdeling bij aanmaken |
| `api/appointments/[id].ts` | Kostenverdeling bij bewerken |
| `src/components/ImportEboekhoudenModal.tsx` | **Nieuw** - Import modal |
| `src/components/PWAInstallBanner.tsx` | **Nieuw** - Install banner |
| `src/components/AppointmentModal.tsx` | Kostenverdeling UI |
| `src/components/ParticipantModal.tsx` | excludeFromInvoice toggle |
| `src/pages/ParticipantsPage.tsx` | Import knop + badges |
| `src/pages/SettingsPage.tsx` | Token config + PWA install sectie |
| `src/pages/OverzichtPage.tsx` | eboekhoudenId badges + auto-select |
| `src/lib/api.ts` | Nieuwe API calls + login 401 fix |

### Bug Fixes

- **Login error verdwijnt op mobiel**: 401 interceptor excluded nu `/auth/login` endpoint
- **Demo user inactive**: `isActive` gereset na `prisma db push --accept-data-loss`

### localStorage Keys (nieuw)

- `pt-planner-pwa-dismissed` - PWA banner dismissal (7 dagen geldig)
