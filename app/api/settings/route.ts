import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { fail } from '@/lib/api';
import type { Settings } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Settings>;
    const db = await getDB();
    db.settings = { ...db.settings, ...body, weights: { ...db.settings.weights, ...(body.weights ?? {}) }, bands: { ...db.settings.bands, ...(body.bands ?? {}) } };
    await saveDB(db);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
