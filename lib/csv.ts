import type { Client, Currency, DB, Invoice } from './types';
import { nextId } from './db';

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field.trim());
  if (row.some((f) => f !== '')) rows.push(row);
  const headers = rows.shift() ?? [];
  return { headers, rows };
}

const SYNONYMS: Record<string, string[]> = {
  cliente: ['cliente', 'client', 'razonsocial', 'nombre', 'nombrecliente', 'clientenombre'],
  docId: ['id', 'idcliente', 'ruc', 'dni', 'documento', 'codigo', 'codcliente'],
  precio: ['precio', 'price', 'preciounitario', 'unitario', 'punitario'],
  cantidad: ['cantidad', 'qty', 'unidades', 'cant'],
  total: ['total', 'monto', 'importe', 'montototal', 'ventatotal', 'totalventa'],
  costo: ['costo', 'cost', 'costounitario'],
  fechaEntrega: ['fechaentrega', 'fechaemision', 'emision', 'fecha', 'fechadocumento', 'fechaventa'],
  fechaPago: ['fechadepago', 'fechapago', 'vencimiento', 'fechavencimiento', 'fechadevencimiento', 'fechadebe'],
  moneda: ['moneda', 'currency'],
  condicion: ['condicion', 'credito', 'condiciondecredito', 'plazo', 'condicioncredito'],
  numero: ['factura', 'numero', 'nro', 'nfactura', 'numerofactura', 'numerodocumento', 'documento'] ,
};

export type FieldKey = keyof typeof SYNONYMS;

export function detectMapping(headers: string[]): Partial<Record<FieldKey, number>> {
  const norm = headers.map(normalizeHeader);
  const mapping: Partial<Record<FieldKey, number>> = {};
  for (const [key, syns] of Object.entries(SYNONYMS) as [FieldKey, string[]][]) {
    const exact = norm.findIndex((h) => syns.includes(h));
    if (exact >= 0) mapping[key] = exact;
    else {
      const partial = norm.findIndex((h) => syns.some((s) => h.includes(s)));
      if (partial >= 0 && !Object.values(mapping).includes(partial)) mapping[key] = partial;
    }
  }
  return mapping;
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d.,-]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseCurrency(raw: string): Currency {
  const s = normalizeHeader(raw);
  return s === 'usd' || s === 'us$' || s === '$' || s.includes('dolar') || s.includes('us') ? 'USD' : 'PEN';
}

export interface ImportRow {
  clientName: string;
  docId: string;
  number: string;
  amount: number;
  currency: Currency;
  issueDate: string;
  dueDate: string;
  creditTermDays: number;
  costo: number | null;
}

export interface ImportPreview {
  headers: string[];
  mapping: Partial<Record<FieldKey, number>>;
  sample: ImportRow[];
  errors: { line: number; reason: string }[];
  totalRows: number;
  okRows: number;
}

export function previewImport(text: string): ImportPreview {
  const { headers, rows } = parseCSV(text);
  const mapping = detectMapping(headers);
  const errors: { line: number; reason: string }[] = [];
  const sample: ImportRow[] = [];
  rows.forEach((r, idx) => {
    const get = (k: FieldKey) => (mapping[k] != null ? (r[mapping[k] as number] ?? '') : '');
    const clientName = get('cliente');
    const docId = get('docId') || `AUTO-${idx}`;
    const qty = parseAmount(get('cantidad')) ?? 1;
    const total = mapping.total != null ? parseAmount(get('total')) : null;
    const precio = parseAmount(get('precio'));
    const amount = total ?? (precio != null ? Math.round(precio * qty * 100) / 100 : null);
    const issueDate = parseDate(get('fechaEntrega'));
    const dueDate = parseDate(get('fechaPago'));
    if (!clientName) errors.push({ line: idx + 2, reason: 'Falta cliente' });
    if (amount == null || amount <= 0) errors.push({ line: idx + 2, reason: 'Monto inválido (se requiere columna total o precio×cantidad)' });
    if (!issueDate) errors.push({ line: idx + 2, reason: 'Fecha de entrega inválida o ausente' });
    if (!dueDate) errors.push({ line: idx + 2, reason: 'Fecha de pago (vencimiento) inválida o ausente' });
    if (clientName && amount != null && amount > 0 && issueDate && dueDate) {
      const cond = parseAmount(get('condicion'));
      sample.push({
        clientName,
        docId,
        number: get('numero') || `IMP-${idx + 1}`,
        amount,
        currency: mapping.moneda != null ? parseCurrency(get('moneda')) : 'PEN',
        issueDate,
        dueDate,
        creditTermDays: cond && cond > 0 ? Math.round(cond) : Math.max(1, Math.round((Date.parse(dueDate) - Date.parse(issueDate)) / 86400000)),
        costo: parseAmount(get('costo')),
      });
    }
  });
  return { headers, mapping, sample: sample.slice(0, 10), errors: errors.slice(0, 20), totalRows: rows.length, okRows: sample.length === 10 && rows.length > 10 ? rows.length - errors.length : sample.length };
}

export function commitImport(db: DB, text: string): { clients: number; invoices: number; errors: number } {
  const { headers, rows } = parseCSV(text);
  const mapping = detectMapping(headers);
  let clientsCreated = 0;
  let invoicesCreated = 0;
  let errors = 0;
  rows.forEach((r, idx) => {
    const get = (k: FieldKey) => (mapping[k] != null ? (r[mapping[k] as number] ?? '') : '');
    const clientName = get('cliente');
    const docId = get('docId') || `AUTO-${idx}`;
    const qty = parseAmount(get('cantidad')) ?? 1;
    const total = mapping.total != null ? parseAmount(get('total')) : null;
    const precio = parseAmount(get('precio'));
    const amount = total ?? (precio != null ? Math.round(precio * qty * 100) / 100 : null);
    const issueDate = parseDate(get('fechaEntrega'));
    const dueDate = parseDate(get('fechaPago'));
    if (!clientName || amount == null || amount <= 0 || !issueDate || !dueDate) {
      errors++;
      return;
    }
    const currency: Currency = mapping.moneda != null ? parseCurrency(get('moneda')) : 'PEN';
    let client = db.clients.find((c) => (c.docId && c.docId === docId) || c.name.toLowerCase() === clientName.toLowerCase());
    if (!client) {
      const cond = parseAmount(get('condicion'));
      client = {
        id: nextId(db, 'c'),
        docId,
        name: clientName,
        creditTermDays: cond && cond > 0 ? Math.round(cond) : Math.max(1, Math.round((Date.parse(dueDate) - Date.parse(issueDate)) / 86400000)),
        createdAt: new Date().toISOString().slice(0, 10),
      };
      db.clients.push(client);
      clientsCreated++;
    }
    const number = get('numero') || `IMP-${idx + 1}`;
    const dup = db.invoices.some((i) => i.clientId === client!.id && i.number === number && i.dueDate === dueDate && i.amount === amount);
    if (dup) return;
    const inv: Invoice = {
      id: nextId(db, 'i'),
      clientId: client.id,
      number,
      amount,
      currency,
      issueDate,
      dueDate,
      paidAt: null,
      paymentLink: null,
      source: 'import',
    };
    db.invoices.push(inv);
    invoicesCreated++;
  });
  return { clients: clientsCreated, invoices: invoicesCreated, errors };
}
