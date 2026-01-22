import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { prisma } from '../_lib/prisma';
import { authenticate, unauthorized, setCorsHeaders } from '../_lib/auth';

const participantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  preferredType: z.string().optional(),
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
    const { params } = req.query;
    const id = Array.isArray(params) ? params[0] : params;

    // Routes without ID: GET all, POST create
    if (!id) {
      if (req.method === 'GET') {
        const { search } = req.query;

        const where: Record<string, unknown> = { isActive: true };

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

        return res.json(participants);
      }

      if (req.method === 'POST') {
        const data = participantSchema.parse(req.body);

        const existing = await prisma.participant.findUnique({
          where: { email: data.email },
        });

        if (existing) {
          return res.status(400).json({ error: 'Email already in use' });
        }

        const participant = await prisma.participant.create({
          data,
        });

        return res.status(201).json(participant);
      }

      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Routes with ID: GET one, PUT update, DELETE
    if (req.method === 'GET') {
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

      return res.json(participant);
    }

    if (req.method === 'PUT') {
      const data = participantSchema.partial().parse(req.body);

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

      return res.json(participant);
    }

    if (req.method === 'DELETE') {
      await prisma.participant.update({
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
    console.error('Participants error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
