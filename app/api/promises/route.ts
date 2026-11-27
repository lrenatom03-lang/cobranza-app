import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { buildPayload } from '@/lib/state';
import { todayStr } from '@/lib/engine';
import type { PaymentPromise } from '@/lib/types';

export const runtime = 'nodejs';

interface Body {
  id: string;
  action: 'cumplida' | 'incumplida' | 'reprogramar';
  promisedDate?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const db = await getDB();
  const p = db.promises.find((x: PaymentPromise) => x.id === body.id);
  if (!p) return NextResponse.json({ error: 'Promesa no encontrada' }, { status: 404 });
  if (body.action === 'reprogramar' && body.promisedDate) {
    p.promisedDate = body.promisedDate;
    p.status = 'reprogramada';
  } else {
    p.status = body.action === 'cumplida' ? 'cumplida' : 'incumplida';
    if (body.action === 'cumplida') {
      const inv = db.invoices.find((i) => i.id === p.invoiceId);
      if (inv) inv.paidAt = todayStr();
    }
  }
  await saveDB(db);
  return NextResponse.json({ ok: true, ...buildPayload(db) });
}
