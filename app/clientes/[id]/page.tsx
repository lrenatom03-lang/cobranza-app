'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { usePayload } from '@/lib/usePayload';
import { fmtDate, fmtMoney, fmtPct } from '@/lib/format';
import { BandBadge, ErrorBox, Loading, PromisePill, Score, StatusPill } from '@/components/ui';
import { GestionModal } from '@/components/GestionModal';
import { MessageModal } from '@/components/MessageModal';
import { TRAMO_LABEL } from '@/lib/engine';

export default function ClienteDetalle() {
  const params = useParams();
  const { data, error, reload, mutate } = usePayload();
  const [gestionOpen, setGestionOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  if (!data) return error ? <ErrorBox msg={error} onRetry={reload} /> : <Loading />;
  const c = data.derived.clients.find((x) => x.id === params.id);
  if (!c) return <div className="warn">Cliente no encontrado.</div>;

  const invoices = data.derived.invoices.filter((i) => i.clientId === c.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const actions = data.derived.actions.filter((a) => a.clientId === c.id);
  const promises = data.derived.promises.filter((p) => p.clientId === c.id);
  const broken = promises.filter((p) => p.statusDerived === 'incumplida')[0] ?? null;
  const soon = promises.filter((p) => p.statusDerived === 'proxima')[0] ?? null;

  const markPaid = async (invoiceId: string) => {
    await mutate('/api/invoices', { id: invoiceId, action: 'mark_paid' });
  };

  return (
    <>
      <div className="page-head">
        <p><Link href="/clientes">← Clientes</Link></p>
        <h1>{c.name} <BandBadge band={c.band} /> <Score value={c.score} band={c.band} /></h1>
        <p>{c.reasons.join(' · ') || 'Sin señales de alerta'}</p>
      </div>

      <div className="cards">
        <div className="card"><div className="k">Deuda pendiente</div><div className="v">{fmtMoney(c.deudaPendiente.PEN, 'PEN')}{c.deudaPendiente.USD > 0 ? ` + ${fmtMoney(c.deudaPendiente.USD, 'USD')}` : ''}</div><div className="s">{c.pendingCount} factura(s)</div></div>
        <div className="card"><div className="k">Atraso máximo</div><div className="v">{c.worstDaysLate > 0 ? `${c.worstDaysLate} días` : '—'}</div><div className="s">{c.minDaysToDue != null ? `próximo vencimiento en ${c.minDaysToDue} días` : 'sin próximos vencimientos'}</div></div>
        <div className="card"><div className="k">Comportamiento de pago</div><div className="v">{c.punctuality == null ? 'Sin historial' : `${Math.round(c.punctuality * 100)}%`}</div><div className="s">facturas pagadas a tiempo</div></div>
        <div className="card"><div className="k">Promesas</div><div className="v">{promises.length}</div><div className="s">{promises.filter((p) => p.statusDerived === 'incumplida').length} incumplidas · {promises.filter((p) => p.statusDerived === 'cumplida').length} cumplidas</div></div>
      </div>

      <div className="panel">
        <h2>Datos del cliente</h2>
        <dl className="kv">
          <dt>ID / Documento</dt><dd>{c.docId || '—'}</dd>
          <dt>Teléfono</dt><dd>{c.phone || '—'}</dd>
          <dt>Email</dt><dd>{c.email || '—'}</dd>
          <dt>Condición de crédito</dt><dd>{c.creditTermDays} días</dd>
          <dt>Acción recomendada</dt><dd><strong>{c.recommendedAction.label}</strong></dd>
        </dl>
        <div className="buttons" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn" onClick={() => setGestionOpen(true)}>Registrar gestión</button>
          <button className="btn green" onClick={() => setMsgOpen(true)}>Generar mensaje</button>
        </div>
      </div>

      <div className="panel">
        <h2>Facturas ({invoices.length})</h2>
        <table className="tbl">
          <thead>
            <tr><th>Número</th><th>Monto</th><th>Emisión</th><th>Vencimiento</th><th>Estado</th><th>Tramo</th><th className="num">Días</th><th></th></tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>{i.number}</td>
                <td className="num">{fmtMoney(i.amount, i.currency)}</td>
                <td>{fmtDate(i.issueDate)}</td>
                <td>{fmtDate(i.dueDate)}</td>
                <td><StatusPill status={i.status} /></td>
                <td>{i.status === 'pagada' ? '—' : TRAMO_LABEL[i.tramo]}</td>
                <td className="num">{i.status === 'vencida' ? `${i.daysLate} atraso` : i.status === 'pagada' ? '—' : `${i.daysToDue} para vencer`}</td>
                <td>{i.status !== 'pagada' && <button className="btn small secondary" onClick={() => markPaid(i.id)}>Marcar pagada</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Promesas de pago</h2>
        {promises.length === 0 && <p style={{ color: 'var(--muted)' }}>Sin promesas registradas.</p>}
        {promises.length > 0 && (
          <table className="tbl">
            <thead><tr><th>Fecha prometida</th><th>Factura</th><th className="num">Monto</th><th>Medio</th><th>Estado</th><th>Origen</th></tr></thead>
            <tbody>
              {promises.sort((a, b) => b.promisedDate.localeCompare(a.promisedDate)).map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.promisedDate)}</td>
                  <td>{p.invoiceNumber}</td>
                  <td className="num">{fmtMoney(p.amount, p.currency)}</td>
                  <td>{p.method}</td>
                  <td><PromisePill status={p.statusDerived} /></td>
                  <td>{p.origin === 'gestor' ? 'Gestor' : 'Cliente'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2>Gestiones realizadas ({actions.length})</h2>
        {actions.length === 0 && <p style={{ color: 'var(--muted)' }}>Sin gestiones registradas.</p>}
        {actions.length > 0 && (
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Canal</th><th>Resultado</th><th>Observación</th></tr></thead>
            <tbody>
              {actions.slice(0, 20).map((a) => (
                <tr key={a.id}>
                  <td>{fmtDate(a.date)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{a.channel}</td>
                  <td style={{ textTransform: 'capitalize' }}>{a.result.replace('_', ' ')}</td>
                  <td>{a.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Contactabilidad del historial: {actions.length ? fmtPct((actions.filter((a) => a.result !== 'no_contactado').length / actions.length) * 100) : '—'}</p>
      </div>

      {gestionOpen && <GestionModal client={c} invoices={invoices} today={data.today} data={data} onClose={() => setGestionOpen(false)} mutate={mutate} />}
      {msgOpen && <MessageModal client={c} invoice={c.topInvoice ? invoices.find((i) => i.id === c.topInvoice!.id) ?? invoices[0] : invoices[0] ?? null} brokenPromise={broken} soonPromise={soon} settings={data.settings} onClose={() => setMsgOpen(false)} />}
    </>
  );
}
