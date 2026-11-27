import { NextResponse } from 'next/server';

export function fail(e: unknown) {
  console.error('[api]', e);
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: 500 });
}
