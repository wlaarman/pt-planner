import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from './lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
}
