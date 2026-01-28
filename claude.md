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

Routes use catch-all files like `[[...params]].ts`. The `vercel.json` contains rewrites for base routes.

**CRITICAL - Catch-all param extraction:**
```typescript
// Vercel passes params with brackets in the key
const params = req.query['[...params]'] || req.query['[[...params]]'] || req.query['...params'];
```

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

**Environment variable (Vercel):** `EBOEKHOUDEN_ACCESS_TOKEN`

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

## Recent Changes (28 jan 2026)

### Facturatie verbeteringen
- Trainer/deelnemer filters verwijderd (vereenvoudigd)
- Snelle periode knoppen (Vorige maand, Deze maand)
- Batch versturen naar e-Boekhouden met progress indicator
- Template ID en grootboek opgeslagen in localStorage

### Instellingen pagina
- Mobiel-vriendelijke layout
- "Toon zondag" toggle (standaard uit)
- Inklapbare help tekst

### Kalender
- Zondag verbergen in weekweergave (instelbaar)
- Buttons volgorde aangepast: Verwijderen | Bewerken | Sluiten

### PWA
- Manifest, service worker, icons toegevoegd
- App installeerbaar op mobiel en desktop

## Known Limitations

- Google Calendar OAuth is nog niet geimplementeerd (iCal werkt wel)
- CalendarConnection model bestaat maar OAuth flow is niet gebouwd
