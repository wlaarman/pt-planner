import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const trainersRouter = Router();

// Apply authentication to all routes
trainersRouter.use(authenticate);

const trainerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  color: z.string().optional(),
  hourlyRate: z.number().optional(),
  password: z.string().min(6).optional(),
});

// Get all trainers
trainersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const trainers = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      color: true,
      hourlyRate: true,
      role: true,
      _count: {
        select: {
          appointments: {
            where: {
              startTime: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json(trainers);
});

// Get single trainer
trainersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const trainer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      color: true,
      hourlyRate: true,
      role: true,
      createdAt: true,
    },
  });

  if (!trainer) {
    return res.status(404).json({ error: 'Trainer not found' });
  }

  res.json(trainer);
});

// Create trainer
trainersRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = trainerSchema.parse(req.body);

    // Check if email exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Generate password if not provided
    const password = data.password || Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(password, 10);

    const trainer = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        phone: data.phone,
        color: data.color || '#4F46E5',
        hourlyRate: data.hourlyRate,
        role: 'TRAINER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        color: true,
        hourlyRate: true,
        role: true,
      },
    });

    res.status(201).json(trainer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// Update trainer
trainersRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = trainerSchema.partial().parse(req.body);

    // If updating email, check it's not in use
    if (data.email) {
      const existing = await prisma.user.findFirst({
        where: { email: data.email, NOT: { id } },
      });
      if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    // Hash password if provided
    let updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const trainer = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        color: true,
        hourlyRate: true,
        role: true,
      },
    });

    res.json(trainer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// Delete (soft) trainer
trainersRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  res.status(204).send();
});
