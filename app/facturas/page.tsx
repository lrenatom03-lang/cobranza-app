'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePayload } from '@/lib/usePayload';
import { fmtDate, fmtMoney } from '@/lib/format';
import { ErrorBox, Loading, StatusPill } from '@/components/ui';
import { TRAMO_LABEL } from '@/lib/engine';
import type { InvoiceStatus } from '@/lib/engine';

export default function FacturasPage() {
  const { data, error, reload, mutate } = usePayload();
  const [status, setStatus] = useState<InvoiceStatus | 'todas'>('todas');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const perPage = 30;

  if (!data) return error ? <ErrorBox msg={error} onRetry={reload} /> : <Loading />;

  const needle = q.trim().toLowerCase();
  const filtered = data.derived.invoices
    .filter((i) => (status === 'todas' ? true : i.status === status))
    .filter((i) => !needle || i.number.toLowerCase().includes(needle) || i.clientName.toLowerCase().includes(needle))
    .sort((a, b) => b.score - a.score || b.dueDate.localeCompare(a.dueDate));
  const rows = filtered.slice(page * perPage, page * perPage + perPage);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));

  return (
    <>
      <div className="page-head">
        <h1>Facturas / Cuentas por cobrar</h1>
        <p>{filtered.length} de {data.derived.invoices.length} facturas · ordenadas por prioridad de gestión</p>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Buscar por número o cliente…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value as InvoiceStatus | 'todas'); setPage(0); }}>
          <option value="todas">Todos los estados</option>
          <option value="vencida">Vencidas</option>
          <option value="proximo">Próximas a vencer</option>
          <option value="por_vencer">Por vencer</option>
          <option value="pagada">Pagadas</option>
        </select>
      </div>

      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>Factura</th><th>Cliente</th><th className="num">Monto</th><th>Emisión</th><th>Vencimiento</th><th>Estado</th><th className="num">Días</th><th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>{i.number}</td>
                <td><Link href={`/clientes/${i.clientId}`}>{i.clientName}</Link></td>
                <td className="num">{fmtMoney(i.amount, i.currency)}</td>
                <td>{fmtDate(i.issueDate)}</td>
                <td>{fmtDate(i.dueDate)}</td>
                <td><StatusPill status={i.status} /></td>
                <td className="num">{i.status === 'vencida' ? `+${i.daysLate}` : i.status === 'pagada' ? '—' : `${i.daysToDue}`}</td>
                <td>
                  {i.status !== 'pagada' && (
                    <button className="btn small secondary" onClick={() => mutate('/api/invoices', { id: i.id, action: 'mark_paid' })}>Marcar pagada</button>
                  )}
                  {i.status === 'pagada' && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(i.paidAt)}</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8}>Sin resultados.</td></tr>}
          </tbody>
        </table>
        {pages > 1 && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn small secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>← Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Página {page + 1} de {pages}</span>
            <button className="btn small secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Siguiente →</button>
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>Tramos de atraso: {Object.values(TRAMO_LABEL).join(' · ')}</p>
    </>
  );
}
