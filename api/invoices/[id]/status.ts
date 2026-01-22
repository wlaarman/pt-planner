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

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
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
      where: { id },
      data: updateData,
    });

    return res.json(invoice);
  } catch (error) {
    console.error('Invoice status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
