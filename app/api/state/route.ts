import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { buildPayload } from '@/lib/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await getDB();
  return NextResponse.json(buildPayload(db));
}
