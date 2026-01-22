import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { prisma } from '../_lib/prisma';
import { authenticate, unauthorized, setCorsHeaders } from '../_lib/auth';

const appointmentSchema = z.object({
  title: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
  trainerId: z.string(),
  trainingTypeId: z.string(),
  participantIds: z.array(z.string()).min(1),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
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
      const { start, end, trainerId } = req.query;

      const where: Record<string, unknown> = {};

      if (start && end) {
        where.startTime = {
          gte: new Date(start as string),
          lte: new Date(end as string),
        };
      }

      if (trainerId) {
        where.trainerId = trainerId;
      }

      const appointments = await prisma.appointment.findMany({
        where,
        include: {
          trainer: {
            select: { id: true, name: true, color: true, hourlyRate: true },
          },
          trainingType: {
            select: { id: true, name: true, maxParticipants: true, defaultRate: true, icon: true, color: true },
          },
          participants: {
            include: {
              participant: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
        orderBy: { startTime: 'asc' },
      });

      const transformed = appointments.map((apt) => ({
        ...apt,
        participants: apt.participants.map((p) => p.participant),
      }));

      return res.json(transformed);
    }

    if (req.method === 'POST') {
      const data = appointmentSchema.parse(req.body);

      const trainer = await prisma.user.findUnique({
        where: { id: data.trainerId },
      });
      if (!trainer) {
        return res.status(400).json({ error: 'Trainer not found' });
      }

      const trainingType = await prisma.trainingType.findUnique({
        where: { id: data.trainingTypeId },
      });
      if (!trainingType) {
        return res.status(400).json({ error: 'Training type not found' });
      }

      if (data.participantIds.length > trainingType.maxParticipants) {
        return res.status(400).json({
          error: `Maximum ${trainingType.maxParticipants} participants allowed for this type`,
        });
      }

      const appointment = await prisma.appointment.create({
        data: {
          title: data.title,
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          notes: data.notes,
          trainerId: data.trainerId,
          trainingTypeId: data.trainingTypeId,
          isRecurring: data.isRecurring,
          recurrenceRule: data.recurrenceRule,
          participants: {
            create: data.participantIds.map((participantId) => ({
              participantId,
            })),
          },
        },
        include: {
          trainer: {
            select: { id: true, name: true, color: true },
          },
          trainingType: {
            select: { id: true, name: true, icon: true, color: true },
          },
          participants: {
            include: {
              participant: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });

      return res.status(201).json({
        ...appointment,
        participants: appointment.participants.map((p) => p.participant),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Appointments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
