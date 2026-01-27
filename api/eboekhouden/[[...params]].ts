import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// === Inline helpers ===
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

// e-Boekhouden API configuration
const EBOEKHOUDEN_API_URL = 'https://api.e-boekhouden.nl';
const EBOEKHOUDEN_ACCESS_TOKEN = process.env.EBOEKHOUDEN_ACCESS_TOKEN || '';

// Create a session with e-Boekhouden
async function createEboekhoudenSession(): Promise<string | null> {
  try {
    const response = await fetch(`${EBOEKHOUDEN_API_URL}/v1/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: EBOEKHOUDEN_ACCESS_TOKEN,
        source: 'PTPLANNER', // max 10 chars
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('e-Boekhouden session error:', error);
      return null;
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('e-Boekhouden session error:', error);
    return null;
  }
}

// Send invoice to e-Boekhouden
async function sendInvoiceToEboekhouden(
  sessionToken: string,
  invoice: {
    relationId: number;
    items: Array<{
      description: string;
      quantity: number;
      pricePerUnit: number;
      vatCode: string;
      ledgerId: number;
    }>;
    termOfPayment: number;
    templateId: number;
    reference?: string;
  }
): Promise<{ success: boolean; invoiceNumber?: string; error?: string }> {
  try {
    const requestBody = {
      relationId: invoice.relationId,
      termOfPayment: invoice.termOfPayment,
      templateId: invoice.templateId,
      inExVat: 'EX', // Prices excluding VAT
      reference: invoice.reference,
      items: invoice.items,
    };

    console.log('e-Boekhouden invoice request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${EBOEKHOUDEN_API_URL}/v1/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionToken,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('e-Boekhouden invoice response:', response.status, responseText);

    if (!response.ok) {
      // Try to parse error message from response
      let errorMessage = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.message || errorJson.error || responseText;
      } catch {
        // Keep raw text if not JSON
      }
      console.error('e-Boekhouden invoice error:', errorMessage);
      return { success: false, error: errorMessage };
    }

    const data = JSON.parse(responseText);
    return { success: true, invoiceNumber: data.invoiceNumber };
  } catch (error) {
    console.error('e-Boekhouden invoice error:', error);
    return { success: false, error: String(error) };
  }
}

// Get relations from e-Boekhouden
async function getEboekhoudenRelations(sessionToken: string): Promise<any[]> {
  try {
    const response = await fetch(`${EBOEKHOUDEN_API_URL}/v1/relation?limit=500`, {
      method: 'GET',
      headers: {
        'Authorization': sessionToken,
      },
    });

    if (!response.ok) {
      console.error('e-Boekhouden relations error:', await response.text());
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('e-Boekhouden relations error:', error);
    return [];
  }
}

// Get ledger accounts from e-Boekhouden
async function getEboekhoudenLedgers(sessionToken: string): Promise<any[]> {
  try {
    const response = await fetch(`${EBOEKHOUDEN_API_URL}/v1/ledger?limit=500`, {
      method: 'GET',
      headers: {
        'Authorization': sessionToken,
      },
    });

    if (!response.ok) {
      console.error('e-Boekhouden ledgers error:', await response.text());
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('e-Boekhouden ledgers error:', error);
    return [];
  }
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
    // Vercel passes catch-all params with brackets in the key
    const params = req.query['[...params]'] || req.query['[[...params]]'] || req.query['...params'];
    const pathParts = Array.isArray(params) ? params : params ? [params] : [];
    const rawFirstParam = pathParts[0];
    const firstParam = rawFirstParam === '_' ? undefined : rawFirstParam;

    // GET /eboekhouden/status - Check connection status
    if (firstParam === 'status' && req.method === 'GET') {
      const tokenLength = EBOEKHOUDEN_ACCESS_TOKEN ? EBOEKHOUDEN_ACCESS_TOKEN.length : 0;
      const tokenPreview = EBOEKHOUDEN_ACCESS_TOKEN ? EBOEKHOUDEN_ACCESS_TOKEN.substring(0, 5) + '...' : 'none';

      if (!EBOEKHOUDEN_ACCESS_TOKEN) {
        return res.json({
          connected: false,
          error: 'API token not configured',
          debug: { tokenLength, tokenPreview, envKeys: Object.keys(process.env).filter(k => k.includes('EBOEK')) }
        });
      }

      const sessionToken = await createEboekhoudenSession();
      if (!sessionToken) {
        return res.json({
          connected: false,
          error: 'Could not connect to e-Boekhouden',
          debug: { tokenLength, tokenPreview }
        });
      }

      return res.json({ connected: true, debug: { tokenLength, tokenPreview } });
    }

    // GET /eboekhouden/relations - Get relations from e-Boekhouden
    if (firstParam === 'relations' && req.method === 'GET') {
      const sessionToken = await createEboekhoudenSession();
      if (!sessionToken) {
        return res.status(500).json({ error: 'Could not connect to e-Boekhouden' });
      }

      const relations = await getEboekhoudenRelations(sessionToken);
      return res.json(relations);
    }

    // GET /eboekhouden/ledgers - Get ledger accounts from e-Boekhouden
    if (firstParam === 'ledgers' && req.method === 'GET') {
      const sessionToken = await createEboekhoudenSession();
      if (!sessionToken) {
        return res.status(500).json({ error: 'Could not connect to e-Boekhouden' });
      }

      const ledgers = await getEboekhoudenLedgers(sessionToken);
      return res.json(ledgers);
    }

    // POST /eboekhouden/send-invoice - Send an invoice to e-Boekhouden
    if (firstParam === 'send-invoice' && req.method === 'POST') {
      const { invoiceId, relationId, templateId = 1, ledgerId = 8000 } = req.body;

      if (!invoiceId) {
        return res.status(400).json({ error: 'invoiceId is required' });
      }

      if (!relationId) {
        return res.status(400).json({ error: 'relationId (e-Boekhouden relation ID) is required' });
      }

      // Get the invoice from our database
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          participant: true,
          items: {
            include: {
              appointment: {
                include: {
                  trainingType: true,
                },
              },
            },
          },
        },
      });

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Check if invoice has items
      if (!invoice.items || invoice.items.length === 0) {
        return res.status(400).json({ error: 'Invoice has no items to send' });
      }

      console.log('Sending invoice to e-Boekhouden:', {
        invoiceId,
        relationId,
        itemCount: invoice.items.length,
        taxRate: Number(invoice.taxRate),
      });

      // Create session
      const sessionToken = await createEboekhoudenSession();
      if (!sessionToken) {
        return res.status(500).json({ error: 'Could not connect to e-Boekhouden' });
      }

      // Map invoice items to e-Boekhouden format
      const taxRateNum = Number(invoice.taxRate);
      const vatCode = taxRateNum === 0 ? 'GEEN' : taxRateNum === 9 ? 'LAAG_VERK' : 'HOOG_VERK';

      const items = invoice.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        pricePerUnit: Number(item.unitPrice),
        vatCode: vatCode,
        ledgerId: ledgerId,
      }));

      // Send to e-Boekhouden
      const result = await sendInvoiceToEboekhouden(sessionToken, {
        relationId,
        items,
        termOfPayment: 14,
        templateId,
        reference: invoice.invoiceNumber,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      // Update our invoice with e-Boekhouden reference
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'SENT',
          notes: `Verzonden naar e-Boekhouden: ${result.invoiceNumber}`,
        },
      });

      return res.json({
        success: true,
        eboekhoudenInvoiceNumber: result.invoiceNumber,
      });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('e-Boekhouden API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
