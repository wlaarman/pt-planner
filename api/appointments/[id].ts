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
  recurrenceEndDate: z.string().datetime().optional().nullable(),
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
    const id = req.query.id as string;

    if (!id) {
      return res.status(400).json({ error: 'Missing appointment ID' });
    }

    // GET single appointment
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

    // PUT update appointment
    if (req.method === 'PUT') {
      const data = appointmentSchema.partial().parse(req.body);

      // Get current appointment to check for overlap
      const currentAppointment = await prisma.appointment.findUnique({
        where: { id },
        select: { trainerId: true, startTime: true, endTime: true },
      });

      if (!currentAppointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      // Check for overlap if trainer or time is changing
      const newTrainerId = data.trainerId || currentAppointment.trainerId;
      const newStartTime = data.startTime ? new Date(data.startTime) : currentAppointment.startTime;
      const newEndTime = data.endTime ? new Date(data.endTime) : currentAppointment.endTime;

      const { hasOverlap, conflictingAppointment } = await checkTrainerOverlap(
        newTrainerId,
        newStartTime,
        newEndTime,
        id // Exclude current appointment
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
        recurrenceEndDate: data.recurrenceEndDate !== undefined
          ? (data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null)
          : undefined,
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

      // Create audit log for update
      await createAuditLog('Appointment', id, 'UPDATE', authUser.id, {
        trainerId: currentAppointment.trainerId,
        startTime: currentAppointment.startTime,
        endTime: currentAppointment.endTime,
      }, data);

      return res.json({
        ...appointment,
        participants: appointment.participants.map((p) => p.participant),
      });
    }

    // PATCH update status
    if (req.method === 'PATCH') {
      const { status } = req.body;

      const validStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Get current status for audit log
      const currentAppointment = await prisma.appointment.findUnique({
        where: { id },
        select: { status: true },
      });

      const appointment = await prisma.appointment.update({
        where: { id },
        data: { status },
      });

      // Create audit log for status update
      await createAuditLog('Appointment', id, 'UPDATE', authUser.id,
        { status: currentAppointment?.status },
        { status }
      );

      return res.json(appointment);
    }

    // DELETE appointment
    if (req.method === 'DELETE') {
      const { deleteSeries } = req.query;

      const appointment = await prisma.appointment.findUnique({
        where: { id },
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      // Store appointment data for audit log before deletion
      const deletedData = {
        ...appointment,
        deleteSeries: deleteSeries === 'true',
      };

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

      // Create audit log for deletion
      await createAuditLog('Appointment', id, 'DELETE', authUser.id, deletedData, undefined);

      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed', debug: { method: req.method, id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Appointments [id] error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
