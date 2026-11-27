import { promises as fs } from 'fs';
import path from 'path';
import type { DB } from './types';
import { DEFAULT_SETTINGS, seedDemo } from './seed';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let cache: DB | null = null;

const REMOTE_DB = !!process.env.DATABASE_URL;

export function storageMode(): 'postgres' | 'file' {
  return REMOTE_DB ? 'postgres' : 'file';
}

let pool: import('pg').Pool | null = null;

async function getPool() {
  if (!pool) {
    const { Pool } = await import('pg');
    const host = new URL(process.env.DATABASE_URL ?? '').hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 3,
    });
    await pool.query(
      'CREATE TABLE IF NOT EXISTS app_state (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    );
  }
  return pool;
}

export async function getDB(): Promise<DB> {
  if (REMOTE_DB) {
    const client = await getPool();
    const res = await client.query<{ data: DB }>('SELECT data FROM app_state WHERE id = 1');
    if (res.rows.length) {
      const db = res.rows[0].data;
      if (!db.settings?.weights) db.settings = DEFAULT_SETTINGS;
      cache = db;
      return db;
    }
    const db = seedDemo();
    await client.query('INSERT INTO app_state (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [JSON.stringify(db)]);
    cache = db;
    return db;
  }

  if (cache) return cache;
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    const db = JSON.parse(raw) as DB;
    if (!db.settings?.weights) db.settings = DEFAULT_SETTINGS;
    cache = db;
    return db;
  } catch {
    const db = seedDemo();
    await saveDB(db);
    return db;
  }
}

export async function saveDB(db: DB): Promise<void> {
  cache = db;
  if (REMOTE_DB) {
    const client = await getPool();
    await client.query(
      'INSERT INTO app_state (id, data, updated_at) VALUES (1, $1, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
      [JSON.stringify(db)]
    );
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db), 'utf-8');
}

export async function resetDB(mode: 'demo' | 'empty' = 'demo', keepSettings?: DB['settings']): Promise<DB> {
  const db: DB =
    mode === 'empty'
      ? {
          clients: [],
          invoices: [],
          actions: [],
          promises: [],
          settings: keepSettings ?? DEFAULT_SETTINGS,
          meta: { seededAt: new Date().toISOString().slice(0, 10), nextId: 10000 },
        }
      : seedDemo();
  await saveDB(db);
  return db;
}

export function nextId(db: DB, prefix: string): string {
  db.meta.nextId += 1;
  return `${prefix}${db.meta.nextId}`;
}
