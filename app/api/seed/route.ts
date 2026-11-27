import { NextResponse } from 'next/server';
import { resetDB } from '@/lib/db';
import { buildPayload } from '@/lib/state';

export const runtime = 'nodejs';

export async function POST() {
  const db = await resetDB();
  return NextResponse.json({ ok: true, ...buildPayload(db) });
}
