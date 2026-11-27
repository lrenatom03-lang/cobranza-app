import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { buildPayload } from '@/lib/state';
import { todayStr } from '@/lib/engine';

export const runtime = 'nodejs';

interface Body {
  id: string;
  action: 'mark_paid' | 'set_link';
  paymentLink?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const db = await getDB();
  const inv = db.invoices.find((i) => i.id === body.id);
  if (!inv) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
  if (body.action === 'mark_paid') inv.paidAt = todayStr();
  if (body.action === 'set_link') inv.paymentLink = body.paymentLink ?? null;
  await saveDB(db);
  return NextResponse.json({ ok: true, ...buildPayload(db) });
}
