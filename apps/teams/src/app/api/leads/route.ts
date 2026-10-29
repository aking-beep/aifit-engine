import { NextResponse } from 'next/server';
import { authorizeLeadExport, leadsCsv, listLeads } from '@aifit/platform';
import { acceptLead, leadsEnabled } from '@/server/leads';
import { assertSameOrigin, clientKey, errorResponse, json, readBody, requireStore } from '@/server/platform';

export const dynamic = 'force-dynamic';

/** The lead form. Public, same-origin only, rate-limited per client. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const status = leadsEnabled();
    if (!status.enabled) return json({ error: status.reason, code: 'unavailable' }, { status: 503 });
    const body = await readBody(req, 8 * 1024);
    const out = await acceptLead(body, clientKey(req));
    return json({ received: true, stored: out.stored });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Operator export: `Authorization: Bearer $LEADS_EXPORT_TOKEN`. `?format=csv` for a spreadsheet. */
export async function GET(req: Request) {
  try {
    authorizeLeadExport(req.headers.get('authorization'), process.env.LEADS_EXPORT_TOKEN);
    const leads = await listLeads(requireStore(), 2000);
    if (new URL(req.url).searchParams.get('format') === 'csv') {
      return new NextResponse(leadsCsv(leads), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="aifit-teams-leads.csv"', 'cache-control': 'no-store' } });
    }
    return json({ leads });
  } catch (e) {
    return errorResponse(e);
  }
}
