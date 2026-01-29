import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

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

// Check for overlapping appointments for the same trainer
async function checkTrainerOverlap(
  trainerId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string
): Promise<{ hasOverlap: boolean; conflictingAppointment?: { id: string; startTime: Date; endTime: Date } }> {
  const overlapping = await prisma.appointment.findFirst({
    where: {
      trainerId,
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } },
      ],
    },
    select: { id: true, startTime: true, endTime: true },
  });

  return {
    hasOverlap: !!overlapping,
    conflictingAppointment: overlapping || undefined,
  };
}

// Create audit log entry (non-blocking - doesn't fail if table doesn't exist yet)
async function createAuditLog(
  entityType: string,
  entityId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  userId: string | null,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        userId,
        oldValues: oldValues ?? null,
        newValues: newValues ?? null,
      },
    });
  } catch (error) {
    // Log error but don't fail the request - audit log table might not exist yet
    console.warn('Failed to create audit log:', error);
  }
}

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
  recurrenceEndDate: z.string().datetime().optional(),
  // Cost distribution: 'split' = divide among all, 'single' = one payer
  costDistribution: z.enum(['split', 'single']).default('split'),
  primaryPayerId: z.string().optional(), // Required when costDistribution is 'single'
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
    // GET all appointments
    if (req.method === 'GET') {
      const { start, end, trainerId } = req.query;

      const includeConfig = {
        trainer: {
          select: { id: true, name: true, color: true, hourlyRate: true },
        },
        trainingType: {
          select: { id: true, name: true, maxParticipants: true, defaultRate: true, icon: true, color: true },
        },
        participants: {
          include: {
            participant: {
              select: { id: true, name: true, email: true, excludeFromInvoice: true },
            },
          },
        },
      };

      // Build base filter
      const baseFilter: Record<string, unknown> = {};
      if (trainerId) {
        baseFilter.trainerId = trainerId;
      }

      let appointments;

      if (start && end) {
        const startDate = new Date(start as string);
        const endDate = new Date(end as string);

        // Get appointments in the date range OR recurring appointments that started before the range
        // (so we can expand them to show instances in the current range)
        appointments = await prisma.appointment.findMany({
          where: {
            ...baseFilter,
            OR: [
              // Regular appointments within the range
              {
                startTime: {
                  gte: startDate,
                  lte: endDate,
                },
              },
              // Recurring appointments that started before or within the range
              // These might have instances that fall within the requested range
              {
                isRecurring: true,
                startTime: {
                  lte: endDate, // Started before end of range
                },
              },
            ],
          },
          include: includeConfig,
          orderBy: { startTime: 'asc' },
        });
      } else {
        // No date filter - return all
        appointments = await prisma.appointment.findMany({
          where: baseFilter,
          include: includeConfig,
          orderBy: { startTime: 'asc' },
        });
      }

      const transformed = appointments.map((apt) => ({
        ...apt,
        participants: apt.participants.map((p) => ({
          ...p.participant,
          isPayer: p.isPayer,
        })),
      }));

      return res.json(transformed);
    }

    // POST create appointment
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

      // Check for overlapping appointments
      const { hasOverlap, conflictingAppointment } = await checkTrainerOverlap(
        data.trainerId,
        new Date(data.startTime),
        new Date(data.endTime)
      );

      if (hasOverlap && conflictingAppointment) {
        return res.status(409).json({
          error: 'Deze trainer heeft al een afspraak op dit tijdstip',
          conflictingAppointment: {
            startTime: conflictingAppointment.startTime,
            endTime: conflictingAppointment.endTime,
          },
        });
      }

      // Determine payer status for each participant
      const participantData = data.participantIds.map((participantId) => ({
        participantId,
        isPayer: data.costDistribution === 'single'
          ? participantId === data.primaryPayerId
          : true, // 'split' = all pay
      }));

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
          recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
          participants: {
            create: participantData,
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

      // Create audit log
      await createAuditLog('Appointment', appointment.id, 'CREATE', authUser.id, undefined, {
        ...data,
        id: appointment.id,
      });

      return res.status(201).json({
        ...appointment,
        participants: appointment.participants.map((p) => ({
          ...p.participant,
          isPayer: p.isPayer,
        })),
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
