import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { authenticate, unauthorized, setCorsHeaders } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authUser = await authenticate(req);
  if (!authUser) {
    return unauthorized(res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
  } catch (error) {
    console.error('Invoice stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
