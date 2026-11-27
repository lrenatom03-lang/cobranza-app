import type { DB } from './types';
import { computeKpis, derive, type DerivedState, type Kpis } from './engine';
import type { Settings } from './types';

export interface Payload {
  today: string;
  settings: Settings;
  derived: DerivedState;
  kpis: Kpis;
}

export function buildPayload(db: DB): Payload {
  const derived = derive(db);
  return { today: derived.today, settings: db.settings, derived, kpis: computeKpis(derived) };
}
