import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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

  try {
    const params = req.query.params;
    const rawId = Array.isArray(params) ? params[0] : params;
    const id = rawId === '_' ? undefined : rawId; // '_' is rewrite placeholder for base route

    // Routes without ID: GET all, POST create
    if (!id) {
      if (req.method === 'GET') {
        const trainers = await prisma.user.findMany({
          where: { isActive: true },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            color: true,
            hourlyRate: true,
            role: true,
            _count: {
              select: {
                appointments: {
                  where: {
                    startTime: {
                      gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                    },
                  },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        });

        return res.json(trainers);
      }

      if (req.method === 'POST') {
        const data = trainerSchema.parse(req.body);

        const existing = await prisma.user.findUnique({
          where: { email: data.email },
        });

        if (existing) {
          return res.status(400).json({ error: 'Email already in use' });
        }

        const password = data.password || Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(password, 10);

        const trainer = await prisma.user.create({
          data: {
            email: data.email,
            password: hashedPassword,
            name: data.name,
            phone: data.phone,
            color: data.color || '#4F46E5',
            hourlyRate: data.hourlyRate,
            role: 'TRAINER',
          },
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

        return res.status(201).json(trainer);
      }

      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Routes with ID: GET one, PUT update, DELETE
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
    console.error('Trainers error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
