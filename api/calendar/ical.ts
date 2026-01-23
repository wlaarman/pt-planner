import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import ICAL from 'ical.js';

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

interface ICalEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  isExternal: true;
}

async function fetchAndParseIcal(url: string, start: Date, end: Date): Promise<ICalEvent[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch iCal: ${response.status}`);
    }

    const icalData = await response.text();
    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const events: ICalEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      // Skip events without proper dates
      if (!event.startDate || !event.endDate) continue;

      const eventStart = event.startDate.toJSDate();
      const eventEnd = event.endDate.toJSDate();

      // Check if event falls within the requested range
      if (eventEnd < start || eventStart > end) continue;

      // Handle recurring events
      if (event.isRecurring()) {
        const iterator = event.iterator();
        let next = iterator.next();

        // Limit iterations to prevent infinite loops
        let count = 0;
        const maxIterations = 100;

        while (next && count < maxIterations) {
          const occurrenceStart = next.toJSDate();
          const duration = eventEnd.getTime() - eventStart.getTime();
          const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);

          // Stop if we're past the end date
          if (occurrenceStart > end) break;

          // Add event if it's within range
          if (occurrenceEnd >= start && occurrenceStart <= end) {
            events.push({
              id: `ical-${event.uid}-${occurrenceStart.getTime()}`,
              title: event.summary || 'Untitled',
              startTime: occurrenceStart.toISOString(),
              endTime: occurrenceEnd.toISOString(),
              isExternal: true,
            });
          }

          next = iterator.next();
          count++;
        }
      } else {
        // Non-recurring event
        events.push({
          id: `ical-${event.uid}`,
          title: event.summary || 'Untitled',
          startTime: eventStart.toISOString(),
          endTime: eventEnd.toISOString(),
          isExternal: true,
        });
      }
    }

    return events;
  } catch (error) {
    console.error('Error parsing iCal:', error);
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authUser = await authenticate(req);
  if (!authUser) return unauthorized(res);

  try {
    // GET - Get iCal settings or fetch events
    if (req.method === 'GET') {
      const { start, end } = req.query;

      // If start/end provided, fetch events
      if (start && end) {
        const user = await prisma.user.findUnique({
          where: { id: authUser.id },
          select: { icalUrl: true, showIcalEvents: true },
        });

        if (!user?.icalUrl || !user.showIcalEvents) {
          return res.json([]);
        }

        const events = await fetchAndParseIcal(
          user.icalUrl,
          new Date(start as string),
          new Date(end as string)
        );

        return res.json(events);
      }

      // Otherwise, return settings
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { icalUrl: true, showIcalEvents: true },
      });

      return res.json({
        icalUrl: user?.icalUrl || null,
        showIcalEvents: user?.showIcalEvents ?? true,
      });
    }

    // PUT - Update iCal settings
    if (req.method === 'PUT') {
      const { icalUrl, showIcalEvents } = req.body;

      // Validate URL if provided
      if (icalUrl && typeof icalUrl === 'string') {
        try {
          new URL(icalUrl);
        } catch {
          return res.status(400).json({ error: 'Invalid URL format' });
        }
      }

      const user = await prisma.user.update({
        where: { id: authUser.id },
        data: {
          icalUrl: icalUrl || null,
          showIcalEvents: showIcalEvents ?? true,
        },
        select: { icalUrl: true, showIcalEvents: true },
      });

      return res.json(user);
    }

    // DELETE - Remove iCal connection
    if (req.method === 'DELETE') {
      await prisma.user.update({
        where: { id: authUser.id },
        data: { icalUrl: null },
      });

      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('iCal API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
