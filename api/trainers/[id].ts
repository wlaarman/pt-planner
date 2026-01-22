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

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    if (req.method === 'GET') {
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

      return res.json(trainer);
    }

    if (req.method === 'PUT') {
      const data = trainerSchema.partial().parse(req.body);

      if (data.email) {
        const existing = await prisma.user.findFirst({
          where: { email: data.email, NOT: { id } },
        });
        if (existing) {
          return res.status(400).json({ error: 'Email already in use' });
        }
      }

      const updateData: Record<string, unknown> = { ...data };
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

      return res.json(trainer);
    }

    if (req.method === 'DELETE') {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Trainer error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
