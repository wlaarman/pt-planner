# PT Planner - Sprint Board

## Trello Board Setup

### Optie 1: Handmatig aanmaken
Maak een nieuw Trello board aan met de volgende lijsten:
- **Backlog** - Alle taken die nog niet ingepland zijn
- **Sprint 1: Foundation** - Basis setup en infrastructuur
- **Sprint 2: Core Entities** - Trainers, deelnemers, trainingstypes
- **Sprint 3: Calendar** - Agenda functionaliteit
- **Sprint 4: Google Integration** - Calendar sync
- **Sprint 5: Appointments** - Afspraken beheer
- **Sprint 6: Reports & Invoices** - Rapportage en facturatie
- **Sprint 7: Polish & Deploy** - Afronding en deployment
- **In Progress** - Waar je aan werkt
- **Done** - Afgerond

### Optie 2: Power-Up gebruiken
Gebruik de "Import from JSON" power-up in Trello en importeer het bestand `trello_import.json` in deze folder.

---

## Sprint Overzicht

### Sprint 1: Foundation & Setup
**Doel:** Project setup, database schema, authenticatie

| ID | Taak | Labels | Prioriteit |
|----|------|--------|------------|
| 1.1 | Project initialisatie (Vite + React + TypeScript) | Setup | Hoog |
| 1.2 | Tailwind CSS configuratie | Setup | Hoog |
| 1.3 | Database schema ontwerp (PostgreSQL/SQLite) | Backend, Database | Hoog |
| 1.4 | Prisma ORM setup en migraties | Backend, Database | Hoog |
| 1.5 | Express.js API server setup | Backend | Hoog |
| 1.6 | Authenticatie systeem (JWT) | Backend, Auth | Hoog |
| 1.7 | Login pagina UI | Frontend, Auth | Hoog |
| 1.8 | Protected routes implementatie | Frontend, Auth | Medium |
| 1.9 | Basis layout (sidebar, header) | Frontend | Medium |
| 1.10 | API client setup (Axios/Fetch) | Frontend | Medium |

---

### Sprint 2: Core Entities (CRUD)
**Doel:** Beheer van trainers, deelnemers en trainingstypes

| ID | Taak | Labels | Prioriteit |
|----|------|--------|------------|
| 2.1 | Trainers API endpoints (CRUD) | Backend | Hoog |
| 2.2 | Trainers overzichtspagina | Frontend | Hoog |
| 2.3 | Trainer formulier (create/edit) | Frontend | Hoog |
| 2.4 | Trainer kleur kiezer component | Frontend | Medium |
| 2.5 | Deelnemers API endpoints (CRUD) | Backend | Hoog |
| 2.6 | Deelnemers overzichtspagina met tabel | Frontend | Hoog |
| 2.7 | Deelnemer formulier (create/edit) | Frontend | Hoog |
| 2.8 | Zoekfunctie voor deelnemers | Frontend | Medium |
| 2.9 | Trainingstypes API endpoints (CRUD) | Backend | Hoog |
| 2.10 | Trainingstypes overzichtspagina | Frontend | Hoog |
| 2.11 | Trainingstype formulier met tarief configuratie | Frontend | Medium |

---

### Sprint 3: Calendar View
**Doel:** Kalender weergave en navigatie

| ID | Taak | Labels | Prioriteit |
|----|------|--------|------------|
| 3.1 | Calendar component basis (week view) | Frontend | Hoog |
| 3.2 | Dag weergave implementatie | Frontend | Hoog |
| 3.3 | Maand weergave implementatie | Frontend | Medium |
| 3.4 | Calendar navigatie (vorige/volgende week/maand) | Frontend | Hoog |
| 3.5 | "Vandaag" knop en highlighting | Frontend | Medium |
| 3.6 | Tijdslots per kwartier rendering | Frontend | Hoog |
| 3.7 | Current time indicator | Frontend | Low |
| 3.8 | Event blokken weergave met kleuren | Frontend | Hoog |
| 3.9 | Trainer filter checkboxes | Frontend | Medium |
| 3.10 | Legend component | Frontend | Low |

---

### Sprint 4: Google Calendar Integration
**Doel:** OAuth koppeling en synchronisatie met Google Calendar

| ID | Taak | Labels | Prioriteit |
|----|------|--------|------------|
| 4.1 | Google Cloud Project setup | Setup, Integration | Hoog |
| 4.2 | OAuth 2.0 implementatie backend | Backend, Auth | Hoog |
| 4.3 | Google Calendar API service | Backend, Integration | Hoog |
| 4.4 | Fetch events from Google Calendar | Backend | Hoog |
| 4.5 | Create/Update events in Google Calendar | Backend | Hoog |
| 4.6 | Calendar connectie UI in instellingen | Frontend | Hoog |
| 4.7 | Sync status indicator | Frontend | Medium |
| 4.8 | Toggle om Google events te tonen/verbergen | Frontend | Medium |
| 4.9 | Activeren/deactiveren sync per calendar | Frontend | Medium |
| 4.10 | Conflict detectie bij overlappende events | Backend | Medium |

---

### Sprint 5: Appointments Management
**Doel:** Afspraken aanmaken, bewerken, verwijderen

| ID | Taak | Labels | Prioriteit |
|----|------|--------|------------|
| 5.1 | Appointments API endpoints (CRUD) | Backend | Hoog |
| 5.2 | Afspraak model met trainer/deelnemer relaties | Backend, Database | Hoog |
| 5.3 | Afspraak aanmaken modal | Frontend | Hoog |
| 5.4 | Trainer selectie in formulier | Frontend | Hoog |
| 5.5 | Deelnemer(s) selectie (multi-select voor groep) | Frontend | Hoog |
| 5.6 | Trainingstype selectie | Frontend | Hoog |
| 5.7 | Tijdselectie per kwartier | Frontend | Hoog |
| 5.8 | Herhaling opties (dagelijks, wekelijks, etc.) | Frontend, Backend | Hoog |
| 5.9 | Herhalende afspraken zonder einddatum | Backend | Hoog |
| 5.10 | Afspraak detail modal | Frontend | Medium |
| 5.11 | Afspraak bewerken functionaliteit | Frontend | Medium |
| 5.12 | Afspraak verwijderen (enkele of serie) | Frontend, Backend | Medium |
| 5.13 | Drag & drop om afspraak te verplaatsen | Frontend | Hoog |
| 5.14 | Klik op kalenderslot om afspraak te maken | Frontend | Hoog |
| 5.15 | Resize afspraak door te slepen | Frontend | Medium |
| 5.16 | Sync nieuwe afspraken naar Google Calendar | Backend, Integration | Hoog |

---

### Sprint 6: Reports & Invoicing
**Doel:** Rapportage per deelnemer en factuur generatie

| ID | Taak | Labels | Prioriteit |
|----|------|--------|------------|
| 6.1 | Reports API endpoint | Backend | Hoog |
| 6.2 | Filter op deelnemer, periode, trainer | Backend | Hoog |
| 6.3 | Rapport pagina UI met filters | Frontend | Hoog |
| 6.4 | Rapport samenvatting (totaal sessies, uren, kosten) | Frontend | Hoog |
| 6.5 | Rapport tabel met checkbox selectie | Frontend | Hoog |
| 6.6 | Export naar PDF | Backend | Medium |
| 6.7 | Invoices API endpoints (CRUD) | Backend | Hoog |
| 6.8 | Invoice model met regels | Backend, Database | Hoog |
| 6.9 | Factuur aanmaken vanuit rapport | Frontend | Hoog |
| 6.10 | Factuur preview modal | Frontend | Hoog |
| 6.11 | Bedragen aanpassen voor verzending | Frontend | Medium |
| 6.12 | Korting toevoegen | Frontend | Low |
| 6.13 | Facturatie overzichtspagina | Frontend | Hoog |
| 6.14 | Factuur status badges (open, betaald, te laat) | Frontend | Medium |
| 6.15 | Markeer als betaald functionaliteit | Frontend | Medium |
| 6.16 | Boekhoudkoppeling (Moneybird API) | Backend, Integration | Medium |
| 6.17 | Factuur synchroniseren met boekhouding | Backend, Integration | Medium |

---

### Sprint 7: Polish, Access Control & Deployment
**Doel:** Afronding, multi-user toegang, deployment

| ID | Taak | Labels | Prioriteit |
|----|------|--------|------------|
| 7.1 | Trainer accounts (login per trainer) | Backend, Auth | Hoog |
| 7.2 | Role-based access (trainer kan eigen + anderen zien) | Backend, Auth | Hoog |
| 7.3 | Error handling en user feedback | Frontend | Hoog |
| 7.4 | Loading states en skeletons | Frontend | Medium |
| 7.5 | Form validatie | Frontend | Hoog |
| 7.6 | Responsive design check | Frontend | Hoog |
| 7.7 | PWA setup (manifest, service worker) | Frontend, Setup | Medium |
| 7.8 | Mobile optimalisaties | Frontend | Hoog |
| 7.9 | E2E tests (Playwright/Cypress) | Testing | Medium |
| 7.10 | Unit tests kritieke functies | Testing | Medium |
| 7.11 | CI/CD pipeline (GitHub Actions) | DevOps | Medium |
| 7.12 | Productie deployment (Vercel/Railway/Render) | DevOps | Hoog |
| 7.13 | Database hosting setup | DevOps | Hoog |
| 7.14 | Environment configuratie | DevOps | Hoog |
| 7.15 | Documentatie | Docs | Low |

---

## Backlog (Toekomst)

| ID | Taak | Labels | Prioriteit |
|----|------|--------|------------|
| B.1 | Outlook Calendar integratie | Integration | Toekomst |
| B.2 | iCal import/export | Integration | Toekomst |
| B.3 | Trainer beschikbaarheid instellen | Feature | Toekomst |
| B.4 | Deelnemer portal (eigen account) | Feature, Auth | Toekomst |
| B.5 | Email notificaties | Feature | Toekomst |
| B.6 | Push notificaties (PWA) | Feature | Toekomst |
| B.7 | Wachtlijst voor groepstrainingen | Feature | Toekomst |
| B.8 | Dashboard met statistieken | Feature | Toekomst |
| B.9 | Exacten Online integratie | Integration | Toekomst |
| B.10 | Native mobile app (React Native) | Mobile | Toekomst |

---

## Labels

| Label | Kleur | Beschrijving |
|-------|-------|--------------|
| Frontend | Blauw | UI/React werk |
| Backend | Groen | API/Server werk |
| Database | Oranje | Database schema/queries |
| Auth | Rood | Authenticatie/Autorisatie |
| Integration | Paars | Externe API koppelingen |
| Setup | Grijs | Project configuratie |
| Testing | Geel | Tests schrijven |
| DevOps | Cyan | Deployment/CI/CD |
| Docs | Roze | Documentatie |
| Feature | Lichtblauw | Nieuwe functionaliteit |

---

## Tech Stack (Voorstel)

### Frontend
- React 18+ met TypeScript
- Vite als build tool
- Tailwind CSS voor styling
- React Query voor data fetching
- React Router voor navigatie
- react-big-calendar of @fullcalendar/react voor kalender
- react-hook-form voor formulieren
- Zod voor validatie

### Backend
- Node.js met Express.js (of NestJS)
- TypeScript
- Prisma ORM
- PostgreSQL database
- JWT voor authenticatie
- Google Calendar API

### Deployment
- Frontend: Vercel of Netlify
- Backend: Railway of Render
- Database: Supabase of Railway PostgreSQL
