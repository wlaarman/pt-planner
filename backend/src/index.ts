import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { trainersRouter } from './routes/trainers.js';
import { participantsRouter } from './routes/participants.js';
import { trainingTypesRouter } from './routes/trainingTypes.js';
import { appointmentsRouter } from './routes/appointments.js';
import { reportsRouter } from './routes/reports.js';
import { invoicesRouter } from './routes/invoices.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/trainers', trainersRouter);
app.use('/api/participants', participantsRouter);
app.use('/api/training-types', trainingTypesRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/invoices', invoicesRouter);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 PT Planner API running on http://localhost:${PORT}`);
});
