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
- **URL:** https://personaltrainer-psi.vercel.app
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

## Taal
De applicatie is in het **Nederlands**.
