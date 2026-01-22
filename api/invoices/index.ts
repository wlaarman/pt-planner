import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { prisma } from '../_lib/prisma';
import { authenticate, unauthorized, setCorsHeaders, type AuthUser } from '../_lib/auth';

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Invoices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
