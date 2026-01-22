import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const trainingTypesRouter = Router();

trainingTypesRouter.use(authenticate);

const trainingTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  maxParticipants: z.number().int().min(1).default(1),
  defaultDuration: z.number().int().min(15).default(60),
  defaultRate: z.number().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

// Get all training types
trainingTypesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const types = await prisma.trainingType.findMany({
    where: { isActive: true },
    orderBy: { maxParticipants: 'asc' },
  });

  res.json(types);
});

// Get single training type
trainingTypesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const type = await prisma.trainingType.findUnique({
    where: { id },
  });

  if (!type) {
    return res.status(404).json({ error: 'Training type not found' });
  }

  res.json(type);
});

// Create training type
trainingTypesRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = trainingTypeSchema.parse(req.body);

    const type = await prisma.trainingType.create({
      data,
    });

    res.status(201).json(type);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// Update training type
trainingTypesRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = trainingTypeSchema.partial().parse(req.body);

    const type = await prisma.trainingType.update({
      where: { id },
      data,
    });

    res.json(type);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// Delete (soft) training type
trainingTypesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await prisma.trainingType.update({
    where: { id },
    data: { isActive: false },
  });

  res.status(204).send();
});
