import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, nextId, saveDB } from '@/lib/db';
import { fail } from '@/lib/api';
import { todayStr } from '@/lib/engine';
import type { Client } from '@/lib/types';

export const runtime = 'nodejs';

interface Body extends Partial<Client> {
  id?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const db = await getDB();
    if (!body.name) return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 });
    let client: Client | undefined;
    if (body.id) {
      client = db.clients.find((c) => c.id === body.id);
      if (client) Object.assign(client, { ...body, id: client.id });
    }
    if (!client) {
      client = {
        id: nextId(db, 'c'),
        docId: body.docId ?? '',
        name: body.name,
        email: body.email ?? '',
        phone: body.phone ?? '',
        creditTermDays: body.creditTermDays ?? 30,
        createdAt: todayStr(),
      };
      db.clients.push(client);
    }
    await saveDB(db);
    return NextResponse.json({ ok: true, clientId: client.id });
  } catch (e) {
    return fail(e);
  }
}
