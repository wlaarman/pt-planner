import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

// Get report data
reportsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { participantId, trainerId, startDate, endDate } = req.query;

  const where: any = {
    status: 'COMPLETED',
  };

  if (participantId) {
    where.participants = {
      some: {
        participantId: participantId as string,
      },
    };
  }

  if (trainerId) {
    where.trainerId = trainerId;
  }

  if (startDate && endDate) {
    where.startTime = {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string),
    };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      trainer: {
        select: { id: true, name: true, color: true, hourlyRate: true },
      },
      trainingType: {
        select: { id: true, name: true, defaultRate: true },
      },
      participants: {
        include: {
          participant: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
    orderBy: { startTime: 'desc' },
  });

  // Calculate totals
  let totalSessions = appointments.length;
  let totalMinutes = 0;
  let totalCost = 0;

  const items = appointments.map((apt) => {
    const durationMinutes = Math.round(
      (apt.endTime.getTime() - apt.startTime.getTime()) / (1000 * 60)
    );
    totalMinutes += durationMinutes;

    const hourlyRate = apt.trainer.hourlyRate
      ? Number(apt.trainer.hourlyRate)
      : apt.trainingType.defaultRate
      ? Number(apt.trainingType.defaultRate)
      : 45;

    const cost = (durationMinutes / 60) * hourlyRate;
    totalCost += cost;

    return {
      id: apt.id,
      date: apt.startTime,
      startTime: apt.startTime,
      endTime: apt.endTime,
      durationMinutes,
      trainer: apt.trainer,
      trainingType: apt.trainingType,
      participants: apt.participants.map((p) => p.participant),
      hourlyRate,
      cost,
    };
  });

  res.json({
    summary: {
      totalSessions,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
    },
    items,
  });
});

// Get participant summary for dropdown
reportsRouter.get('/participants', async (req: AuthRequest, res: Response) => {
  const participants = await prisma.participant.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      _count: {
        select: { appointments: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json(participants);
});
