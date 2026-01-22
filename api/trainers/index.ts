import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../_lib/prisma';
import { authenticate, unauthorized, setCorsHeaders } from '../_lib/auth';

const trainerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  color: z.string().optional(),
  hourlyRate: z.number().optional(),
  password: z.string().min(6).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authUser = await authenticate(req);
  if (!authUser) {
    return unauthorized(res);
  }

  try {
    if (req.method === 'GET') {
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

      return res.json(trainers);
    }

    if (req.method === 'POST') {
      const data = trainerSchema.parse(req.body);

      const existing = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
      }

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

      return res.status(201).json(trainer);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Trainers error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
