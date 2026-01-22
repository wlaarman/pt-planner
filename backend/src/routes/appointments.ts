import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);

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

// Get appointments (with date range filter)
appointmentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { start, end, trainerId } = req.query;

  const where: any = {};

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

  // Transform participants array
  const transformed = appointments.map((apt) => ({
    ...apt,
    participants: apt.participants.map((p) => p.participant),
  }));

  res.json(transformed);
});

// Get single appointment
appointmentsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

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

  res.json({
    ...appointment,
    participants: appointment.participants.map((p) => p.participant),
  });
});

// Create appointment
appointmentsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = appointmentSchema.parse(req.body);

    // Validate trainer exists
    const trainer = await prisma.user.findUnique({
      where: { id: data.trainerId },
    });
    if (!trainer) {
      return res.status(400).json({ error: 'Trainer not found' });
    }

    // Validate training type exists
    const trainingType = await prisma.trainingType.findUnique({
      where: { id: data.trainingTypeId },
    });
    if (!trainingType) {
      return res.status(400).json({ error: 'Training type not found' });
    }

    // Validate participant count
    if (data.participantIds.length > trainingType.maxParticipants) {
      return res.status(400).json({
        error: `Maximum ${trainingType.maxParticipants} participants allowed for this type`,
      });
    }

    // Create appointment with participants
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

    res.status(201).json({
      ...appointment,
      participants: appointment.participants.map((p) => p.participant),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// Update appointment
appointmentsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = appointmentSchema.partial().parse(req.body);

    // If updating participants, delete existing and create new
    if (data.participantIds) {
      await prisma.appointmentParticipant.deleteMany({
        where: { appointmentId: id },
      });
    }

    const updateData: any = {
      title: data.title,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
      notes: data.notes,
      trainerId: data.trainerId,
      trainingTypeId: data.trainingTypeId,
      isRecurring: data.isRecurring,
      recurrenceRule: data.recurrenceRule,
    };

    // Remove undefined values
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

    res.json({
      ...appointment,
      participants: appointment.participants.map((p) => p.participant),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// Delete appointment
appointmentsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { deleteSeries } = req.query;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
  });

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (deleteSeries === 'true' && appointment.recurrenceId) {
    // Delete all appointments in the series
    await prisma.appointment.deleteMany({
      where: {
        OR: [
          { id: appointment.recurrenceId },
          { recurrenceId: appointment.recurrenceId },
        ],
      },
    });
  } else {
    // Delete single appointment
    await prisma.appointment.delete({
      where: { id },
    });
  }

  res.status(204).send();
});

// Update appointment status
appointmentsRouter.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status },
  });

  res.json(appointment);
});
