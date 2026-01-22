import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const participantsRouter = Router();

participantsRouter.use(authenticate);

const participantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  preferredType: z.string().optional(),
});

// Get all participants
participantsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { search } = req.query;

  const where: any = { isActive: true };

  if (search && typeof search === 'string') {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const participants = await prisma.participant.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      notes: true,
      preferredType: true,
      _count: {
        select: {
          appointments: {
            where: {
              appointment: {
                startTime: {
                  gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json(participants);
});

// Get single participant
participantsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const participant = await prisma.participant.findUnique({
    where: { id },
    include: {
      appointments: {
        include: {
          appointment: {
            include: {
              trainer: {
                select: { id: true, name: true, color: true },
              },
              trainingType: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: {
          appointment: { startTime: 'desc' },
        },
        take: 10,
      },
    },
  });

  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  res.json(participant);
});

// Create participant
participantsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = participantSchema.parse(req.body);

    // Check if email exists
    const existing = await prisma.participant.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const participant = await prisma.participant.create({
      data,
    });

    res.status(201).json(participant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// Update participant
participantsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = participantSchema.partial().parse(req.body);

    // If updating email, check it's not in use
    if (data.email) {
      const existing = await prisma.participant.findFirst({
        where: { email: data.email, NOT: { id } },
      });
      if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    const participant = await prisma.participant.update({
      where: { id },
      data,
    });

    res.json(participant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// Delete (soft) participant
participantsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await prisma.participant.update({
    where: { id },
    data: { isActive: false },
  });

  res.status(204).send();
});
