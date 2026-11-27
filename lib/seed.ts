import type { Client, CollectionAction, Currency, DB, Invoice, PaymentPromise, Settings } from './types';
import { DAY, todayStr } from './engine';

function lcg(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const NAME_A = ['Grupo', 'Comercial', 'Distribuidora', 'Importadora', 'Corporación', 'Servicios', 'Representaciones', 'Inversiones', 'Agrícola', 'Textil', 'Ferretería', 'Bodega', 'Minimarket', 'Empresa', 'Logística'];
const NAME_B = ['Los Andes', 'Santa Rosa', 'El Progreso', 'San Martín', 'La Union', 'Villa Rica', 'Bella Vista', 'El Sol', 'La Concordia', 'San Miguel', 'Las Palmas', 'Norte Sur', 'Centro', 'Del Pacífico', 'Huascarán', 'Misti', 'Colca', 'Mantaro', 'Tumbes', 'Ica'];
const NAME_C = ['S.A.C.', 'E.I.R.L.', 'S.R.L.', 'S.A.', ''];

const METHODS = ['Transferencia', 'Yape', 'Plin', 'Efectivo', 'Depósito'];

export const DEFAULT_SETTINGS: Settings = {
  businessName: 'Mi Negocio S.A.C.',
  exchangeRate: 3.75,
  paymentInfo: 'CCI: 002-123-4567890123-45 · Yape/Plin: 987 654 321 · Cta Cte Soles: 123-4567890-1-23',
  paymentLink: '',
  weights: { urgencia: 35, monto: 30, atraso: 20, historial: 10, concentracion: 5, penalPromesaActiva: 15, bonoPromesaIncumplida: 25 },
  bands: { critico: 75, riesgo: 55, atencion: 35 },
};

export function seedDemo(): DB {
  const rand = lcg(20240915);
  const today = todayStr();
  const now = Date.parse(today);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  const clients: Client[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 120; i++) {
    let name = '';
    do {
      name = `${pick(NAME_A)} ${pick(NAME_B)} ${pick(NAME_C)}`.trim();
    } while (used.has(name));
    used.add(name);
    const docId = `${10 + Math.floor(rand() * 9)}${Math.floor(rand() * 100000000).toString().padStart(8, '0')}`;
    clients.push({
      id: `c${i + 1}`,
      docId,
      name,
      phone: `9${Math.floor(rand() * 100000000).toString().padStart(8, '0')}`,
      email: `contacto${i + 1}@correo.com`,
      creditTermDays: pick([7, 15, 30, 30, 45, 60, 90]),
      createdAt: iso(now - Math.floor(rand() * 400 + 100) * DAY),
    });
  }

  const moraClients = new Set(clients.filter(() => rand() < 0.3).map((c) => c.id));

  const invoices: Invoice[] = [];
  let invN = 1000;
  for (const c of clients) {
    const n = 2 + Math.floor(rand() * 7);
    for (let k = 0; k < n; k++) {
      const currency: Currency = rand() < 0.1 ? 'USD' : 'PEN';
      const base = 200 + Math.pow(rand(), 2.2) * 12000;
      const amount = Math.round((currency === 'USD' ? base / 3.75 : base) * 100) / 100;
      const isPaid = moraClients.has(c.id) ? rand() < 0.35 : rand() < 0.62;
      let issueDate: string, dueDate: string, paidAt: string | null = null;
      if (isPaid) {
        const term = c.creditTermDays;
        issueDate = iso(now - Math.floor(rand() * 150 + 30) * DAY);
        dueDate = iso(Date.parse(issueDate) + term * DAY);
        const slack = rand() < 0.72 ? rand() * 3 : rand() * 25;
        paidAt = iso(Date.parse(dueDate) + slack * DAY);
        if (Date.parse(paidAt) > now) paidAt = today;
      } else {
        const late = moraClients.has(c.id) ? Math.floor(rand() * 100 + 1) : -(Math.floor(rand() * 35 + 5));
        const term = c.creditTermDays;
        dueDate = iso(now - late * DAY);
        issueDate = iso(Date.parse(dueDate) - term * DAY);
      }
      invoices.push({
        id: `i${++invN}`,
        clientId: c.id,
        number: `F001-${++invN}`,
        amount,
        currency,
        issueDate,
        dueDate,
        paidAt,
        paymentLink: null,
        source: 'demo',
      });
    }
  }

  const actions: CollectionAction[] = [];
  const promises: PaymentPromise[] = [];
  let actN = 0;
  let promN = 0;
  const pendingOverdue = invoices.filter((i) => !i.paidAt && Date.parse(i.dueDate) < now);
  for (const inv of pendingOverdue) {
    if (rand() < 0.35) {
      const channel = pick(['whatsapp', 'llamada', 'email', 'whatsapp'] as const);
      const result = pick(['contactado', 'contactado', 'pagara', 'no_contactado', 'solicita_plazo'] as const);
      actions.push({
        id: `a${++actN}`,
        clientId: inv.clientId,
        invoiceId: inv.id,
        channel,
        result,
        note: '',
        date: iso(now - Math.floor(rand() * 25) * DAY),
      });
    }
  }
  const promiseCandidates = clients.filter((c) => invoices.some((i) => i.clientId === c.id && !i.paidAt));
  for (const c of promiseCandidates.slice(0, 22)) {
    const inv = invoices.find((i) => i.clientId === c.id && !i.paidAt);
    if (!inv) continue;
    const offset = Math.floor(rand() * 30 - 12);
    const promisedDate = iso(now + offset * DAY);
    const status: PaymentPromise['status'] = offset < -5 ? (rand() < 0.6 ? 'incumplida' : 'cumplida') : rand() < 0.15 ? 'cumplida' : 'registrada';
    promises.push({
      id: `p${++promN}`,
      clientId: c.id,
      invoiceId: inv.id,
      amount: inv.amount,
      currency: inv.currency,
      promisedDate,
      method: pick(METHODS),
      note: '',
      status: status === 'cumplida' ? 'cumplida' : status,
      createdAt: iso(now - Math.floor(rand() * 10 + 5) * DAY),
      origin: 'gestor',
    });
    if (status === 'cumplida' && !inv.paidAt) inv.paidAt = today;
  }

  return { clients, invoices, actions, promises, settings: DEFAULT_SETTINGS, meta: { seededAt: today, nextId: 10000 } };
}
