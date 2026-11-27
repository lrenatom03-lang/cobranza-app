import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, nextId, saveDB } from '@/lib/db';
import { buildPayload } from '@/lib/state';
import { todayStr } from '@/lib/engine';
import type { ActionResult, Channel } from '@/lib/types';

export const runtime = 'nodejs';

interface Body {
  clientId: string;
  invoiceId: string;
  channel: Channel;
  result: ActionResult;
  note?: string;
  promise?: { promisedDate: string; amount: number; currency: 'PEN' | 'USD'; method: string; note?: string } | null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const db = await getDB();
  if (!body.clientId || !body.invoiceId || !body.channel || !body.result) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }
  db.actions.push({
    id: nextId(db, 'a'),
    clientId: body.clientId,
    invoiceId: body.invoiceId,
    channel: body.channel,
    result: body.result,
    note: body.note ?? '',
    date: todayStr(),
  });
  if (body.promise && body.promise.promisedDate) {
    db.promises.push({
      id: nextId(db, 'p'),
      clientId: body.clientId,
      invoiceId: body.invoiceId,
      amount: body.promise.amount,
      currency: body.promise.currency,
      promisedDate: body.promise.promisedDate,
      method: body.promise.method || 'Transferencia',
      note: body.promise.note ?? '',
      status: 'registrada',
      createdAt: todayStr(),
      origin: 'gestor',
    });
  }
  await saveDB(db);
  return NextResponse.json({ ok: true, ...buildPayload(db) });
}
