import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const invoicesRouter = Router();

invoicesRouter.use(authenticate);

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

// Generate next invoice number
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

// Get all invoices
invoicesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { status, participantId } = req.query;

  const where: any = {};

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

  res.json(invoices);
});

// Get invoice statistics
invoicesRouter.get('/stats', async (req: AuthRequest, res: Response) => {
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

  res.json({
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
});

// Get single invoice
invoicesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

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

  res.json(invoice);
});

// Create invoice
invoicesRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = invoiceSchema.parse(req.body);

    // Calculate totals
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const taxAmount = (subtotal - data.discount) * (data.taxRate / 100);
    const total = subtotal - data.discount + taxAmount;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Default due date is 14 days from now
    const dueDate = data.dueDate
      ? new Date(data.dueDate)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        participantId: data.participantId,
        createdById: req.user!.id,
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

    res.status(201).json(invoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// Update invoice status
invoicesRouter.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const updateData: any = { status };

  if (status === 'PAID') {
    updateData.paidAt = new Date();
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: updateData,
  });

  res.json(invoice);
});

// Delete invoice (only drafts)
invoicesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

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

  res.status(204).send();
});
