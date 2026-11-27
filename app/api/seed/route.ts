import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, resetDB } from '@/lib/db';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Body {
  mode?: 'demo' | 'empty';
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const current = await getDB();
    await resetDB(body.mode === 'empty' ? 'empty' : 'demo', current.settings);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
