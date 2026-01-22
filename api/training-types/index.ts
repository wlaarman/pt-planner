import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { prisma } from '../_lib/prisma';
import { authenticate, unauthorized, setCorsHeaders } from '../_lib/auth';

const trainingTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  maxParticipants: z.number().int().min(1).default(1),
  defaultDuration: z.number().int().min(15).default(60),
  defaultRate: z.number().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
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
      const types = await prisma.trainingType.findMany({
        where: { isActive: true },
        orderBy: { maxParticipants: 'asc' },
      });

      return res.json(types);
    }

    if (req.method === 'POST') {
      const data = trainingTypeSchema.parse(req.body);

      const type = await prisma.trainingType.create({
        data,
      });

      return res.status(201).json(type);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Training types error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
