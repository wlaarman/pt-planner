import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { authenticate, unauthorized, setCorsHeaders } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authUser = await authenticate(req);
  if (!authUser) {
    return unauthorized(res);
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
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
    console.error('Invoice error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
