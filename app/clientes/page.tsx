'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePayload } from '@/lib/usePayload';
import { fmtMoney } from '@/lib/format';
import { BandBadge, ErrorBox, Loading } from '@/components/ui';
import type { Band } from '@/lib/engine';

export default function ClientesPage() {
  const { data, error, reload } = usePayload();
  const [q, setQ] = useState('');
  const [band, setBand] = useState<Band | 'todos'>('todos');
  const [page, setPage] = useState(0);
  const perPage = 25;

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.derived.clients
      .filter((c) => (band === 'todos' ? true : c.band === band))
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || (c.docId ?? '').toLowerCase().includes(needle))
      .sort((a, b) => b.deudaPEN - a.deudaPEN);
  }, [data, q, band]);

  if (!data) return error ? <ErrorBox msg={error} onRetry={reload} /> : <Loading />;
  const pageRows = filtered.slice(page * perPage, page * perPage + perPage);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));

  return (
    <>
      <div className="page-head">
        <h1>Clientes</h1>
        <p>{data.derived.clients.length} clientes · {filtered.length} coinciden con el filtro</p>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Buscar por nombre o ID…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select value={band} onChange={(e) => { setBand(e.target.value as Band | 'todos'); setPage(0); }}>
          <option value="todos">Todos los riesgos</option>
          <option value="critico">🔴 Crítico</option>
          <option value="riesgo">🟠 Riesgo</option>
          <option value="atencion">🟡 Atención</option>
          <option value="bajo">🟢 Bajo riesgo</option>
        </select>
      </div>

      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>ID</th>
              <th>Riesgo</th>
              <th>Score</th>
              <th className="num">Pendiente PEN</th>
              <th className="num">Pendiente USD</th>
              <th className="num">Facturas</th>
              <th className="num">Atraso máx.</th>
              <th>Puntualidad</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/clientes/${c.id}`}>{c.name}</Link></td>
                <td>{c.docId ?? '—'}</td>
                <td><BandBadge band={c.band} /></td>
                <td><span className={`score ${c.band}`}>{c.score}</span></td>
                <td className="num">{c.deudaPendiente.PEN ? fmtMoney(c.deudaPendiente.PEN, 'PEN') : '—'}</td>
                <td className="num">{c.deudaPendiente.USD ? fmtMoney(c.deudaPendiente.USD, 'USD') : '—'}</td>
                <td className="num">{c.pendingCount}</td>
                <td className="num">{c.worstDaysLate > 0 ? `${c.worstDaysLate} días` : '—'}</td>
                <td>{c.punctuality == null ? 'Sin historial' : `${Math.round(c.punctuality * 100)}% a tiempo`}</td>
              </tr>
            ))}
            {pageRows.length === 0 && <tr><td colSpan={9}>Sin resultados.</td></tr>}
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
    </>
  );
}
