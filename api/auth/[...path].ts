import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, unauthorized, setCorsHeaders } from '../lib/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional(),
});

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const secret = process.env.JWT_SECRET || 'dev_secret';
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '7d' }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      color: user.color,
    },
  });
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const userCount = await prisma.user.count();
  const role = userCount === 0 ? 'ADMIN' : 'TRAINER';

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      phone: data.phone,
      role,
    },
  });

  const secret = process.env.JWT_SECRET || 'dev_secret';
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '7d' }
  );

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      color: user.color,
    },
  });
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await authenticate(req);
  if (!authUser) {
    return unauthorized(res);
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      color: true,
      role: true,
      hourlyRate: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json(user);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { path } = req.query;
    const route = Array.isArray(path) ? path[0] : path;

    switch (route) {
      case 'login':
        return handleLogin(req, res);
      case 'register':
        return handleRegister(req, res);
      case 'me':
        return handleMe(req, res);
      default:
        return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
