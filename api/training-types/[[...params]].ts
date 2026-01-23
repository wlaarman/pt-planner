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
    const params = req.query['...params'];
    const rawId = Array.isArray(params) ? params[0] : params;
    const id = rawId === '_' ? undefined : rawId; // '_' is rewrite placeholder for base route

    // Routes without ID: GET all, POST create
    if (!id) {
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
    }

    // Routes with ID: GET one, PUT update, DELETE
    if (req.method === 'GET') {
      const type = await prisma.trainingType.findUnique({
        where: { id },
      });

      if (!type) {
        return res.status(404).json({ error: 'Training type not found' });
      }

      return res.json(type);
    }

    if (req.method === 'PUT') {
      const data = trainingTypeSchema.partial().parse(req.body);

      const type = await prisma.trainingType.update({
        where: { id },
        data,
      });

      return res.json(type);
    }

    if (req.method === 'DELETE') {
      await prisma.trainingType.update({
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
    console.error('Training types error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
