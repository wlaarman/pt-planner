import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, unauthorized, setCorsHeaders } from '../lib/auth';

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
    const { params } = req.query;
    const pathParts = Array.isArray(params) ? params : params ? [params] : [];
    const id = pathParts[0];
    const action = pathParts[1]; // 'status' if present

    // Routes without ID: GET all, POST create
    if (!id) {
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
    }

    // Handle status update: PATCH /appointments/:id/status
    if (action === 'status') {
      if (req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { status } = req.body;

      const validStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const appointment = await prisma.appointment.update({
        where: { id },
        data: { status },
      });

      return res.json(appointment);
    }

    // Routes with ID only: GET one, PUT update, DELETE
    if (req.method === 'GET') {
      const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          trainer: {
            select: { id: true, name: true, color: true, hourlyRate: true },
          },
          trainingType: true,
          participants: {
            include: {
              participant: true,
            },
          },
        },
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      return res.json({
        ...appointment,
        participants: appointment.participants.map((p) => p.participant),
      });
    }

    if (req.method === 'PUT') {
      const data = appointmentSchema.partial().parse(req.body);

      if (data.participantIds) {
        await prisma.appointmentParticipant.deleteMany({
          where: { appointmentId: id },
        });
      }

      const updateData: Record<string, unknown> = {
        title: data.title,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        notes: data.notes,
        trainerId: data.trainerId,
        trainingTypeId: data.trainingTypeId,
        isRecurring: data.isRecurring,
        recurrenceRule: data.recurrenceRule,
      };

      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      if (data.participantIds) {
        updateData.participants = {
          create: data.participantIds.map((participantId) => ({
            participantId,
          })),
        };
      }

      const appointment = await prisma.appointment.update({
        where: { id },
        data: updateData,
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

      return res.json({
        ...appointment,
        participants: appointment.participants.map((p) => p.participant),
      });
    }

    if (req.method === 'DELETE') {
      const { deleteSeries } = req.query;

      const appointment = await prisma.appointment.findUnique({
        where: { id },
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      if (deleteSeries === 'true' && appointment.recurrenceId) {
        await prisma.appointment.deleteMany({
          where: {
            OR: [
              { id: appointment.recurrenceId },
              { recurrenceId: appointment.recurrenceId },
            ],
          },
        });
      } else {
        await prisma.appointment.delete({
          where: { id },
        });
      }

      return res.status(204).end();
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
