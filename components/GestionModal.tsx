'use client';

import { useMemo, useState } from 'react';
import type { Payload } from '@/lib/state';
import type { ClientDerived } from '@/lib/engine';
import { fmtMoney } from '@/lib/format';
import { Modal } from './ui';
import type { Invoice } from '@/lib/types';

type MClient = ClientDerived & { id: string; name: string; phone?: string; email?: string };
type MInvoice = Invoice & { clientName: string; amountPEN: number; daysLate: number; daysToDue: number };

const CHANNELS = [
  { v: 'whatsapp', l: 'WhatsApp' },
  { v: 'llamada', l: 'Llamada' },
  { v: 'email', l: 'Email' },
  { v: 'otro', l: 'Otro' },
];
const RESULTS = [
  { v: 'contactado', l: 'Contactado' },
  { v: 'no_contactado', l: 'No contactado' },
  { v: 'pagara', l: 'Pagará (registrar promesa)' },
  { v: 'solicita_plazo', l: 'Solicita plazo' },
  { v: 'solicita_fraccionamiento', l: 'Solicita fraccionamiento' },
  { v: 'rechaza', l: 'Rechaza pago' },
  { v: 'otro', l: 'Otro' },
];
const METHODS = ['Transferencia', 'Yape', 'Plin', 'Efectivo', 'Depósito'];

function plusDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);
}

export function GestionModal({
  client,
  invoices,
  today,
  data,
  onClose,
  mutate,
}: {
  client: MClient;
  invoices: MInvoice[];
  today: string;
  data: Payload;
  onClose: () => void;
  mutate: (url: string, body: unknown) => Promise<unknown>;
}) {
  const pending = invoices.filter((i) => !i.paidAt);
  const [invoiceId, setInvoiceId] = useState(pending[0]?.id ?? '');
  const [channel, setChannel] = useState('whatsapp');
  const [result, setResult] = useState('contactado');
  const [note, setNote] = useState('');
  const [withPromise, setWithPromise] = useState(false);
  const inv = pending.find((i) => i.id === invoiceId) ?? pending[0];
  const [promDate, setPromDate] = useState(plusDays(today, 7));
  const [promAmount, setPromAmount] = useState(String(inv?.amount ?? ''));
  const [promMethod, setPromMethod] = useState('Transferencia');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const promiseAvailable = result === 'pagara' && inv;

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      await mutate('/api/actions', {
        clientId: client.id,
        invoiceId: inv?.id,
        channel,
        result,
        note,
        promise: promiseAvailable
          ? { promisedDate: promDate, amount: Number(promAmount) || inv.amount, currency: inv.currency, method: promMethod, note: '' }
          : null,
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Registrar gestión · ${client.name}`} onClose={onClose}>
      <div className="field">
        <label>Factura</label>
        <select value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); const i = pending.find((x) => x.id === e.target.value); if (i) setPromAmount(String(i.amount)); }}>
          {pending.map((i) => (
            <option key={i.id} value={i.id}>
              {i.number} · {fmtMoney(i.amount, i.currency)} · {i.daysLate > 0 ? `vencida ${i.daysLate} días` : `vence en ${i.daysToDue} días`}
            </option>
          ))}
        </select>
      </div>
      <div className="row2">
        <div className="field">
          <label>Canal</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Resultado</label>
          <select value={result} onChange={(e) => setResult(e.target.value)}>
            {RESULTS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Observación</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalle de la conversación…" />
      </div>

      {promiseAvailable && (
        <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 8px' }}>Promesa de pago</h3>
          <div className="row2">
            <div className="field">
              <label>Fecha prometida</label>
              <input type="date" value={promDate} onChange={(e) => setPromDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Monto ({inv.currency})</label>
              <input type="number" step="0.01" value={promAmount} onChange={(e) => setPromAmount(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Medio de pago</label>
            <select value={promMethod} onChange={(e) => setPromMethod(e.target.value)}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}

      {err && <p className="error-text">{err}</p>}
      <div className="modal-actions">
        <button className="btn secondary" onClick={onClose}>Cancelar</button>
        <button className="btn" onClick={submit} disabled={saving || !inv}>
          {saving ? 'Guardando…' : 'Registrar gestión'}
        </button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0' }}>
        Moneda de la cartera: {data.settings.exchangeRate ? `1 US$ = S/ ${data.settings.exchangeRate}` : '—'}
      </p>
    </Modal>
  );
}
