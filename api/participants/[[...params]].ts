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

const participantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  preferredType: z.string().optional(),
  eboekhoudenId: z.number().optional(),
  excludeFromInvoice: z.boolean().optional(),
});

const importEboekhoudenSchema = z.object({
  relations: z.array(z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })),
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
    // Vercel passes catch-all params with brackets in the key: '[...params]' or '[[...params]]'
    const params = req.query['[...params]'] || req.query['[[...params]]'] || req.query['...params'];
    const pathParts = Array.isArray(params) ? params : params ? [params] : [];
    const rawFirstParam = pathParts[0];
    const firstParam = rawFirstParam === '_' ? undefined : rawFirstParam; // '_' is rewrite placeholder for base route

    // POST /participants/import-eboekhouden - Import relations from e-Boekhouden
    if (firstParam === 'import-eboekhouden' && req.method === 'POST') {
      const data = importEboekhoudenSchema.parse(req.body);

      const results = {
        created: 0,
        linked: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (const relation of data.relations) {
        try {
          // Check if already linked by eboekhoudenId
          const existingById = await prisma.participant.findUnique({
            where: { eboekhoudenId: relation.id },
          });

          if (existingById) {
            results.skipped++;
            continue;
          }

          // Check if can link by email
          if (relation.email) {
            const existingByEmail = await prisma.participant.findUnique({
              where: { email: relation.email },
            });

            if (existingByEmail) {
              // Link existing participant
              await prisma.participant.update({
                where: { id: existingByEmail.id },
                data: { eboekhoudenId: relation.id },
              });
              results.linked++;
              continue;
            }
          }

          // Create new participant
          await prisma.participant.create({
            data: {
              name: relation.name,
              email: relation.email || `eboekhouden-${relation.id}@placeholder.nl`,
              phone: relation.phone,
              eboekhoudenId: relation.id,
            },
          });
          results.created++;
        } catch (error) {
          results.errors.push(`Failed to import ${relation.name}: ${error}`);
        }
      }

      return res.status(200).json(results);
    }

    // Routes without ID: GET all, POST create
    const id = firstParam;
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
            eboekhoudenId: true,
            excludeFromInvoice: true,
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
