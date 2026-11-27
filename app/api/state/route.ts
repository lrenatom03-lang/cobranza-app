import { NextResponse } from 'next/server';
import { getDB, storageMode } from '@/lib/db';
import { buildPayload } from '@/lib/state';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDB();
    return NextResponse.json({ ...buildPayload(db), storage: storageMode() });
  } catch (e) {
    return fail(e);
  }
}
