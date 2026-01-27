# PT Planner - Project Knowledge

## Project Overview
PT Planner is een agenda-applicatie voor personal trainers om afspraken te beheren, deelnemers te tracken en facturen te genereren.

## Tech Stack
- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand (authStore)
- **Data Fetching:** TanStack Query (React Query)
- **Backend:** Vercel Serverless Functions (api/*.ts)
- **Database:** PostgreSQL via Neon (cloud)
- **ORM:** Prisma
- **Authentication:** JWT tokens

## Deployment
- **Hosting:** Vercel
- **URL:** https://pt-planner.vercel.app
- **BELANGRIJK:** Vercel is gekoppeld aan de GitHub repo. Deployments gebeuren automatisch via git push, NIET via `npx vercel --prod`. Commit en push wijzigingen om te deployen.
- **GitHub repo:** https://github.com/wlaarman/pt-planner

## Demo Login
- **Email:** jan@ptplanner.nl
- **Wachtwoord:** trainer123

## Project Structure
```
/api                    # Vercel serverless functions
  /appointments         # CRUD voor afspraken
  /auth                 # Login/register
  /calendar             # iCal integratie
  /invoices             # Facturen
  /participants         # Deelnemers
  /reports              # Rapportages
  /trainers             # Trainers
  /training-types       # Training types
/lib                    # Shared utilities (NOT in /api to avoid being deployed as functions)
  auth.ts               # Auth helpers
  prisma.ts             # Prisma client singleton
/prisma
  schema.prisma         # Database schema
  seed.ts               # Demo data
/src
  /components           # React components
  /lib
    api.ts              # API client (axios)
  /pages                # Page components
  /stores               # Zustand stores
```

## API Routes (Vercel)
Routes gebruiken catch-all files zoals `[[...params]].ts`. De vercel.json bevat rewrites voor base routes:
- `/api/appointments` → `/api/appointments/_`
- etc.

## Key Features
1. **Kalender** - Week/dag weergave met drag & drop
2. **iCal integratie** - Externe kalenders koppelen via iCal URL
3. **Deelnemers** - Klanten beheren
4. **Trainers** - Meerdere trainers ondersteunen
5. **Training types** - 1-op-1, 1-op-2, groepstraining
6. **Facturen** - Facturen aanmaken en tracken

## Development
```bash
# Lokaal draaien (frontend only, praat met productie API)
npm run dev

# Als je lokaal wilt testen met productie API:
# Maak .env.local met: VITE_API_URL=https://personaltrainer-psi.vercel.app/api

# Build
npm run build

# Database migrations
npx prisma migrate dev
npx prisma db push

# Seed database
npx prisma db seed
```

## Important Libraries
- `@dnd-kit/core` - Drag & drop voor kalender
- `ical.js` - iCal parsing voor externe kalenders
- `date-fns` - Date utilities
- `clsx` - Conditional classnames
- `zod` - Schema validation (API)
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT tokens

## Database (Prisma Schema)
Belangrijke modellen:
- `User` - Trainers/admins (heeft icalUrl voor externe kalender)
- `Participant` - Klanten
- `Appointment` - Afspraken
- `TrainingType` - Soorten trainingen
- `Invoice` - Facturen
- `CalendarConnection` - OAuth calendar connections (nog niet geïmplementeerd)

## Vercel Beperkingen
- **Hobby plan limiet:** Max 12 serverless functions per deployment
- Huidige functions: 12 (op de limiet!)
- **Oplossing:** Combineer routes in één file waar mogelijk (bijv. `[id].ts` handelt GET/PUT/PATCH/DELETE af)
- Vermijd aparte files voor sub-routes zoals `/api/xxx/[id]/action` - combineer in `[id].ts`

## Known Issues / TODOs
- Google Calendar OAuth is nog niet geïmplementeerd (iCal werkt wel)
- **InvoicesPage blank scherm bug** - Na laden wordt pagina blank door error `Cannot read properties of undefined (reading 'totalParticipants')`. Fix is gepusht maar user moet hard refresh doen (Ctrl+Shift+R) of wachten tot Vercel deployment klaar is. Null checks toegevoegd in `src/pages/InvoicesPage.tsx`.

### OPGELOST: Invoices Billable Endpoint (27 jan 2026)

**Probleem:** Catch-all routes (`[[...params]].ts`) werkten niet - sub-routes retourneerden altijd de base route response.

**Oorzaak:** De code gebruikte `req.query['...params']` maar Vercel geeft de params door met brackets in de key: `req.query['[...params]']`.

**Fix:** Alle catch-all handlers aangepast naar:
```typescript
const params = req.query['[...params]'] || req.query['[[...params]]'] || req.query['...params'];
```

**Bestanden gefixed:**
- `api/invoices/[[...params]].ts`
- `api/participants/[[...params]].ts`
- `api/trainers/[[...params]].ts`
- `api/training-types/[[...params]].ts`
- `api/reports/[[...params]].ts`

## Recent Toegevoegd (januari 2026)

### Facturatie Feature
Nieuwe functionaliteit voor het genereren van facturen per periode:

**Database wijzigingen:**
- `invoicedAt` veld toegevoegd aan Appointment model (tracks wanneer gefactureerd)

**Nieuwe API endpoints:**
- `GET /api/invoices/billable?start=&end=` - Haalt factureerbare afspraken op (status=COMPLETED, nog niet gefactureerd), gegroepeerd per deelnemer
- `POST /api/invoices/generate` - Genereert facturen voor geselecteerde deelnemers, markeert afspraken als gefactureerd

**Nieuwe componenten:**
- `src/components/InvoiceGeneratorModal.tsx` - Modal voor factuur generatie met:
  - Overzicht per deelnemer met checkbox
  - Uitklapbare details per afspraak
  - BTW tarief selectie (0%, 9%, 21%)
  - Vervaldatum selectie (7, 14, 30 dagen)

**InvoicesPage updates:**
- Maand-picker toegevoegd (standaard vorige maand)
- Factureerbaar overzicht (uren, deelnemers, bedrag)
- "Facturen Genereren" knop

**Flow:**
1. Selecteer periode (maand)
2. Bekijk factureerbare uren
3. Klik "Facturen Genereren"
4. Selecteer/deselecteer deelnemers
5. Genereer facturen
6. Afspraken worden gemarkeerd met `invoicedAt`

**Let op:** Alleen afspraken met status `COMPLETED` worden meegenomen.

### Kalender verbeteringen
- Time label alignment fix (was cumulative drift door -mt-2)
- Recurring appointments tonen in toekomstige weken
- `recurrenceEndDate` veld voor einddatum herhalende afspraken
- Keuze bij bewerken herhalende afspraak: "Alleen deze" of "Hele reeks"

### Appointment Modal verbeteringen
- Edit functionaliteit toegevoegd
- Compacte datum/tijd layout op mobiel
- Reset van edit mode state bij sluiten modal

## Taal
De applicatie is in het **Nederlands**.
