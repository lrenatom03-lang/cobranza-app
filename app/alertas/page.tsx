'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePayload } from '@/lib/usePayload';
import { ErrorBox, Loading } from '@/components/ui';
import { GestionModal } from '@/components/GestionModal';
import { MessageModal } from '@/components/MessageModal';

export default function AlertasPage() {
  const { data, error, reload, mutate } = usePayload();
  const [gestionFor, setGestionFor] = useState<string | null>(null);
  const [msgFor, setMsgFor] = useState<string | null>(null);

  if (!data) return error ? <ErrorBox msg={error} onRetry={reload} /> : <Loading />;

  const alerts = data.derived.alerts;
  const clientById = (id: string) => data.derived.clients.find((c) => c.id === id);
  const invoiceById = (id?: string) => (id ? data.derived.invoices.find((i) => i.id === id) ?? null : null);

  return (
    <>
      <div className="page-head">
        <h1>Alertas</h1>
        <p>{alerts.length} alertas activas · cada alerta está vinculada a una acción concreta.</p>
      </div>

      <div className="tabs">
        {(['alta', 'media', 'baja'] as const).map((sev) => (
          <span key={sev} className="badge" style={{ background: sev === 'alta' ? '#fee2e2' : sev === 'media' ? '#fef3c7' : '#dcfce7', color: sev === 'alta' ? '#b91c1c' : sev === 'media' ? '#a16207' : '#15803d' }}>
            {sev === 'alta' ? 'Prioridad alta' : sev === 'media' ? 'Media' : 'Preventiva'}: {alerts.filter((a) => a.severity === sev).length}
          </span>
        ))}
      </div>

      {alerts.map((a) => (
        <div key={a.id} className={`alert-item ${a.severity}`}>
          <div>
            <div>{a.message}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Acción sugerida: {a.actionLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {a.type === 'vence_pronto' || a.type === 'vence_hoy' ? (
              <button className="btn small green" onClick={() => setMsgFor(a.clientId)}>Enviar mensaje</button>
            ) : a.type === 'promesa_proxima' ? (
              <button className="btn small green" onClick={() => setMsgFor(a.clientId)}>Confirmar promesa</button>
            ) : (
              <button className="btn small" onClick={() => setGestionFor(a.clientId)}>Gestionar</button>
            )}
            <Link className="btn small secondary" href={`/clientes/${a.clientId}`}>Ver cliente</Link>
          </div>
        </div>
      ))}

      {alerts.length === 0 && <div className="panel">Sin alertas activas. Buena señal: tu cartera está bajo control.</div>}

      {gestionFor && (() => {
        const c = clientById(gestionFor);
        if (!c) return null;
        return <GestionModal client={c} invoices={data.derived.invoices.filter((i) => i.clientId === c.id)} today={data.today} data={data} onClose={() => setGestionFor(null)} mutate={mutate} />;
      })()}
      {msgFor && (() => {
        const c = clientById(msgFor);
        if (!c) return null;
        const broken = data.derived.promises.find((p) => p.clientId === c.id && p.statusDerived === 'incumplida') ?? null;
        const soon = data.derived.promises.find((p) => p.clientId === c.id && p.statusDerived === 'proxima') ?? null;
        return <MessageModal client={c} invoice={c.topInvoice ? invoiceById(c.topInvoice.id) : null} brokenPromise={broken} soonPromise={soon} settings={data.settings} onClose={() => setMsgFor(null)} />;
      })()}
    </>
  );
}
