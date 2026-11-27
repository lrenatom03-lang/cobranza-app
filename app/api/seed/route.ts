import { NextResponse } from 'next/server';
import { resetDB } from '@/lib/db';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  try {
    const db = await resetDB();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
