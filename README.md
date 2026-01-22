# PT Planner

Personal Trainer Planning Application - Een webapplicatie voor het plannen van personal trainingen.

## Quick Start met Docker

```bash
# Start alle services
docker-compose up --build

# Of in de achtergrond
docker-compose up -d --build
```

De applicatie is dan beschikbaar op:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Database:** localhost:5432

## Demo Login

```
Email: jan@ptplanner.nl
Wachtwoord: trainer123
```

## Eerste keer opstarten

Na het starten van Docker, voer de database migratie en seed uit:

```bash
# In een nieuwe terminal
docker-compose exec backend npx prisma migrate dev
docker-compose exec backend npm run db:seed
```

## Development

### Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Query
- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Database:** PostgreSQL
- **Containerization:** Docker, Docker Compose
