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

const invoiceItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  appointmentId: z.string().optional(),
});

const invoiceSchema = z.object({
  participantId: z.string(),
  dueDate: z.string().datetime().optional(),
  taxRate: z.number().default(21),
  discount: z.number().default(0),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
});

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `F${year}-`,
      },
    },
    orderBy: { invoiceNumber: 'desc' },
  });

  if (!lastInvoice) {
    return `F${year}-001`;
  }

  const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[1]);
  const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
  return `F${year}-${nextNumber}`;
}

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
    const pathParts = Array.isArray(params) ? params : params ? [params] : [];
    const rawFirstParam = pathParts[0];
    const firstParam = rawFirstParam === '_' ? undefined : rawFirstParam; // '_' is rewrite placeholder for base route
    const secondParam = pathParts[1];

    // /invoices/stats - get invoice statistics
    if (firstParam === 'stats') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const [open, paid, overdue] = await Promise.all([
        prisma.invoice.aggregate({
          where: { status: 'SENT' },
          _sum: { total: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { status: 'PAID' },
          _sum: { total: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { status: 'OVERDUE' },
          _sum: { total: true },
          _count: true,
        }),
      ]);

      return res.json({
        open: {
          count: open._count,
          total: open._sum.total ? Number(open._sum.total) : 0,
        },
        paid: {
          count: paid._count,
          total: paid._sum.total ? Number(paid._sum.total) : 0,
        },
        overdue: {
          count: overdue._count,
          total: overdue._sum.total ? Number(overdue._sum.total) : 0,
        },
      });
    }

    // Routes without ID: GET all, POST create
    if (!firstParam) {
      if (req.method === 'GET') {
        const { status, participantId } = req.query;

        const where: Record<string, unknown> = {};

        if (status) {
          where.status = status;
        }

        if (participantId) {
          where.participantId = participantId;
        }

        const invoices = await prisma.invoice.findMany({
          where,
          include: {
            participant: {
              select: { id: true, name: true, email: true },
            },
            createdBy: {
              select: { id: true, name: true },
            },
            _count: {
              select: { items: true },
            },
          },
          orderBy: { issueDate: 'desc' },
        });

        return res.json(invoices);
      }

      if (req.method === 'POST') {
        const data = invoiceSchema.parse(req.body);

        const subtotal = data.items.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0
        );
        const taxAmount = (subtotal - data.discount) * (data.taxRate / 100);
        const total = subtotal - data.discount + taxAmount;

        const invoiceNumber = await generateInvoiceNumber();

        const dueDate = data.dueDate
          ? new Date(data.dueDate)
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            participantId: data.participantId,
            createdById: authUser.id,
            dueDate,
            subtotal,
            taxRate: data.taxRate,
            taxAmount,
            discount: data.discount,
            total,
            notes: data.notes,
            items: {
              create: data.items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.quantity * item.unitPrice,
                appointmentId: item.appointmentId,
              })),
            },
          },
          include: {
            participant: true,
            items: true,
          },
        });

        return res.status(201).json(invoice);
      }

      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Handle status update: PATCH /invoices/:id/status
    if (secondParam === 'status') {
      if (req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { status } = req.body;

      const validStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const updateData: Record<string, unknown> = { status };

      if (status === 'PAID') {
        updateData.paidAt = new Date();
      }

      const invoice = await prisma.invoice.update({
        where: { id: firstParam },
        data: updateData,
      });

      return res.json(invoice);
    }

    // Routes with ID only: GET one, DELETE
    const id = firstParam;

    if (req.method === 'GET') {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          participant: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: {
              appointment: {
                include: {
                  trainer: {
                    select: { id: true, name: true },
                  },
                  trainingType: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      return res.json(invoice);
    }

    if (req.method === 'DELETE') {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
      });

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      if (invoice.status !== 'DRAFT') {
        return res.status(400).json({ error: 'Only draft invoices can be deleted' });
      }

      await prisma.invoice.delete({
        where: { id },
      });

      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Invoices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
