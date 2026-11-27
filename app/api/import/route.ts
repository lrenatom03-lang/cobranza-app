import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { fail } from '@/lib/api';
import { commitImport, previewImport } from '@/lib/csv';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Body {
  csv: string;
  mode: 'preview' | 'commit';
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.csv?.trim()) return NextResponse.json({ error: 'Contenido vacío' }, { status: 400 });
    if (body.mode === 'preview') {
      return NextResponse.json({ ok: true, preview: previewImport(body.csv) });
    }
    const db = await getDB();
    const result = commitImport(db, body.csv);
    await saveDB(db);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return fail(e);
  }
}
