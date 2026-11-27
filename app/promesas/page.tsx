'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePayload } from '@/lib/usePayload';
import { fmtDate, fmtMoney } from '@/lib/format';
import { ErrorBox, Loading, PromisePill } from '@/components/ui';

const SECTIONS = [
  { key: 'proxima', label: 'Próximas a vencer (≤3 días)' },
  { key: 'registrada', label: 'Registradas (vigentes)' },
  { key: 'incumplida', label: 'Incumplidas' },
  { key: 'cumplida', label: 'Cumplidas' },
  { key: 'reprogramada', label: 'Reprogramadas' },
] as const;

export default function PromesasPage() {
  const { data, error, reload, mutate } = usePayload();
  const [reprogId, setReprogId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');

  if (!data) return error ? <ErrorBox msg={error} onRetry={reload} /> : <Loading />;

  const upd = (id: string, action: string, promisedDate?: string) =>
    mutate('/api/promises', { id, action, promisedDate });

  return (
    <>
      <div className="page-head">
        <h1>Promesas de pago</h1>
        <p>Compromisos registrados con fecha y monto. Un incumplimiento eleva automáticamente la prioridad del cliente.</p>
      </div>

      {SECTIONS.map((s) => {
        const list = data.derived.promises.filter((p) => p.statusDerived === s.key).sort((a, b) => a.promisedDate.localeCompare(b.promisedDate));
        if (!list.length) return null;
        return (
          <div className="panel" key={s.key}>
            <h2>{s.label} ({list.length})</h2>
            <table className="tbl">
              <thead>
                <tr><th>Cliente</th><th>Factura</th><th>Fecha prometida</th><th className="num">Monto</th><th>Medio</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/clientes/${p.clientId}`}>{p.clientName}</Link></td>
                    <td>{p.invoiceNumber}</td>
                    <td>{fmtDate(p.promisedDate)}{p.overdue && s.key === 'incumplida' ? '' : p.daysToPromise === 0 && s.key === 'proxima' ? ' (hoy)' : ''}</td>
                    <td className="num">{fmtMoney(p.amount, p.currency)}</td>
                    <td>{p.method}</td>
                    <td><PromisePill status={p.statusDerived} /></td>
                    <td>
                      {(p.statusDerived === 'registrada' || p.statusDerived === 'proxima' || p.statusDerived === 'incumplida') && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn small green" onClick={() => upd(p.id, 'cumplida')}>Cumplida</button>
                          <button className="btn small secondary" onClick={() => { setReprogId(p.id); setNewDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)); }}>Reprogramar</button>
                        </div>
                      )}
                      {reprogId === p.id && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                          <button className="btn small" onClick={() => { upd(p.id, 'reprogramar', newDate); setReprogId(null); }}>Guardar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {data.derived.promises.length === 0 && (
        <div className="panel">No hay promesas registradas. Se crean desde una gestión con resultado «Pagará».</div>
      )}
    </>
  );
}
