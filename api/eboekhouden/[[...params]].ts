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
      // Return full error details from e-Boekhouden
      console.error('e-Boekhouden invoice error:', responseText);
      return { success: false, error: responseText };
    }

    const data = JSON.parse(responseText);
    return { success: true, invoiceNumber: data.invoiceNumber };
  } catch (error) {
    console.error('e-Boekhouden invoice error:', error);
    return { success: false, error: String(error) };
  }
}

// Get single relation details from e-Boekhouden
async function getEboekhoudenRelationDetails(sessionToken: string, relationId: number): Promise<any | null> {
  try {
    const response = await fetch(`${EBOEKHOUDEN_API_URL}/v1/relation/${relationId}`, {
      method: 'GET',
      headers: {
        'Authorization': sessionToken,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

// Get relations from e-Boekhouden (with full details)
async function getEboekhoudenRelations(sessionToken: string): Promise<any[]> {
  try {
    const response = await fetch(`${EBOEKHOUDEN_API_URL}/v1/relation?limit=100`, {
      method: 'GET',
      headers: {
        'Authorization': sessionToken,
      },
    });

    if (!response.ok) {
      console.error('e-Boekhouden relations error:', await response.text());
      return [];
    }

    const data = await response.json();

    // Handle different response formats from e-Boekhouden API
    let relations: any[] = [];
    if (Array.isArray(data)) {
      relations = data;
    } else if (data && Array.isArray(data.relations)) {
      relations = data.relations;
    } else if (data && Array.isArray(data.data)) {
      relations = data.data;
    } else if (data && Array.isArray(data.items)) {
      relations = data.items;
    } else {
      console.error('Unexpected e-Boekhouden relations format:', JSON.stringify(data).substring(0, 500));
      return [];
    }

    // Fetch full details for each relation (parallel, max 20 at a time)
    const relationsWithDetails = await Promise.all(
      relations.slice(0, 50).map(async (rel) => {
        const details = await getEboekhoudenRelationDetails(sessionToken, rel.id);
        if (details) {
          return { ...rel, ...details };
        }
        return rel;
      })
    );

    // Log first relation to see all available field names
    if (relationsWithDetails.length > 0) {
      console.log('e-Boekhouden relation full fields:', Object.keys(relationsWithDetails[0]));
    }

    return relationsWithDetails;
  } catch (error) {
    console.error('e-Boekhouden relations error:', error);
    return [];
  }
}

// Get invoice templates from e-Boekhouden
async function getEboekhoudenTemplates(sessionToken: string): Promise<any[]> {
  try {
    const response = await fetch(`${EBOEKHOUDEN_API_URL}/v1/invoicetemplate`, {
      method: 'GET',
      headers: {
        'Authorization': sessionToken,
      },
    });

    if (!response.ok) {
      console.error('e-Boekhouden templates error:', await response.text());
      return [];
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    if (data && Array.isArray(data.templates)) {
      return data.templates;
    }

    return [];
  } catch (error) {
    console.error('e-Boekhouden templates error:', error);
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

      // Debug: include field names in response
      const debug = relations.length > 0 ? {
        availableFields: Object.keys(relations[0]),
        sampleRelation: relations[0]
      } : null;

      return res.json({ relations, debug });
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

    // GET /eboekhouden/templates - Get invoice templates from e-Boekhouden
    if (firstParam === 'templates' && req.method === 'GET') {
      const sessionToken = await createEboekhoudenSession();
      if (!sessionToken) {
        return res.status(500).json({ error: 'Could not connect to e-Boekhouden' });
      }

      const templates = await getEboekhoudenTemplates(sessionToken);
      return res.json(templates);
    }

    // POST /eboekhouden/send-invoice - Send an invoice to e-Boekhouden
    if (firstParam === 'send-invoice' && req.method === 'POST') {
      let { invoiceId, relationId, templateId, ledgerId = 8000 } = req.body;

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

      // Create session
      const sessionToken = await createEboekhoudenSession();
      if (!sessionToken) {
        return res.status(500).json({ error: 'Could not connect to e-Boekhouden' });
      }

      // If no templateId provided, fetch available templates and use the first one
      if (!templateId) {
        const templates = await getEboekhoudenTemplates(sessionToken);
        if (templates.length === 0) {
          return res.status(400).json({ error: 'No invoice templates found in e-Boekhouden. Please create a template first.' });
        }
        templateId = templates[0].id;
        console.log('Using first available template:', templateId, templates[0].name || templates[0].description);
      }

      console.log('Sending invoice to e-Boekhouden:', {
        invoiceId,
        relationId,
        templateId,
        itemCount: invoice.items.length,
        taxRate: Number(invoice.taxRate),
      });

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
