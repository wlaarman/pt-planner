import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// === Inline helpers (Vercel doesn't bundle lib directory) ===
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

interface AuthUser { id: string; email: string; role: string; }

async function authenticate(req: VercelRequest): Promise<AuthUser | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as AuthUser;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return null;
    return { id: user.id, email: user.email, role: user.role };
  } catch { return null; }
}

function unauthorized(res: VercelResponse) { return res.status(401).json({ error: 'Unauthorized' }); }

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}
// === End inline helpers ===

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authUser = await authenticate(req);
  if (!authUser) {
    return unauthorized(res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { params } = req.query;
    const action = Array.isArray(params) ? params[0] : params;

    // /reports/participants - get participants list for reports
    if (action === 'participants') {
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

      return res.json(participants);
    }

    // /reports - get report data
    const { participantId, trainerId, startDate, endDate } = req.query;

    const where: Record<string, unknown> = {
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

    return res.json({
      summary: {
        totalSessions,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
      },
      items,
    });
  } catch (error) {
    console.error('Reports error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
