import { promises as fs } from 'fs';
import path from 'path';
import type { DB } from './types';
import { DEFAULT_SETTINGS, seedDemo } from './seed';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let cache: DB | null = null;

export async function getDB(): Promise<DB> {
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
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db), 'utf-8');
}

export async function resetDB(): Promise<DB> {
  const db = seedDemo();
  await saveDB(db);
  return db;
}

export function nextId(db: DB, prefix: string): string {
  db.meta.nextId += 1;
  return `${prefix}${db.meta.nextId}`;
}
