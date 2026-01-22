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
    const participants = await prisma.participant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: { appointments: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json(participants);
  } catch (error) {
    console.error('Reports participants error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
