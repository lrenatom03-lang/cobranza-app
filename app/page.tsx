'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePayload } from '@/lib/usePayload';
import { BAND_META, fmtMoney, type Band } from '@/lib/engine';
import { fmtPEN, fmtPct } from '@/lib/format';
import { BandBadge, ErrorBox, KpiCard, Loading, Score } from '@/components/ui';
import { GestionModal } from '@/components/GestionModal';
import { MessageModal } from '@/components/MessageModal';

const BAND_ORDER: Band[] = ['critico', 'riesgo', 'atencion', 'bajo'];

export default function Home() {
  const { data, error, reload, mutate } = usePayload();
  const [gestionFor, setGestionFor] = useState<string | null>(null);
  const [msgFor, setMsgFor] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, number>>({});

  const groups = useMemo(() => {
    if (!data) return [];
    const withDebt = data.derived.clients.filter((c) => c.pendingCount > 0);
    return BAND_ORDER.map((b) => ({
      band: b,
      list: withDebt.filter((c) => c.band === b).sort((a, z) => z.score - a.score),
    })).filter((g) => g.list.length > 0);
  }, [data]);

  if (!data) return error ? <ErrorBox msg={error} onRetry={reload} /> : <Loading />;
  const { kpis } = data;

  const clientById = (id: string) => data.derived.clients.find((c) => c.id === id);
  const invoicesOf = (id: string) => data.derived.invoices.filter((i) => i.clientId === id);
  const brokenOf = (id: string) => data.derived.promises.filter((p) => p.clientId === id && p.statusDerived === 'incumplida');
  const soonOf = (id: string) => data.derived.promises.filter((p) => p.clientId === id && p.statusDerived === 'proxima');

  return (
    <>
      <div className="page-head">
        <h1>Mi gestión de hoy</h1>
        <p>Cartera priorizada por reglas configurables · {data.today} · Cartera total por cobrar: {fmtPEN(kpis.cartera.totalPendientePEN)}</p>
      </div>

      <div className="cards">
        <KpiCard k="Total por cobrar" v={fmtPEN(kpis.cartera.totalPendientePEN)} s={`PEN ${fmtPEN(kpis.cartera.pendientePEN)} · USD ${fmtPEN(kpis.cartera.pendienteUSD)}`} />
        <KpiCard k="Vencido" v={fmtPEN(kpis.cartera.vencidoPEN)} s={`Morosidad: ${fmtPct(kpis.cartera.morosidadSaldoPct)} del saldo`} />
        <KpiCard k="Por vencer" v={fmtPEN(kpis.cartera.porVencerPEN)} s="Prevenir antes del vencimiento" />
        <KpiCard k="Clientes en mora" v={kpis.cartera.clientesEnMora} s={`de ${kpis.cartera.clientesConDeuda} clientes con deuda`} />
        <KpiCard k="Promesas activas" v={kpis.gestion.promesasActivas} s={`${kpis.gestion.promesasProximas} próximas a vencer`} />
      </div>

      {groups.map((g) => {
        const shown = visible[g.band] ?? 8;
        return (
          <section key={g.band} style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>
              {BAND_META[g.band].emoji} {BAND_META[g.band].group}
              <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12.5 }}> · {g.list.length} cliente(s)</span>
            </h2>
            {g.list.slice(0, shown).map((c) => {
              const inv = c.topInvoice ? data.derived.invoices.find((i) => i.id === c.topInvoice!.id) ?? null : null;
              return (
                <div key={c.id} className={`client-card ${c.band}`}>
                  <div className="top">
                    <div>
                      <span className="name">{c.name}</span>{' '}
                      <Score value={c.score} band={c.band} />
                    </div>
                    <div className="amount">{fmtMoney(c.deudaPendiente.PEN, 'PEN')}{c.deudaPendiente.USD > 0 ? ` + ${fmtMoney(c.deudaPendiente.USD, 'USD')}` : ''}</div>
                  </div>
                  <div className="ctx">
                    {c.reasons.slice(0, 3).join(' · ') || 'Sin señales urgentes'}
                  </div>
                  <div className="action-line">
                    <strong>Acción recomendada:</strong> {c.recommendedAction.label}
                  </div>
                  <div className="buttons">
                    <button className="btn small" onClick={() => setMsgFor(c.id)}>Mensaje</button>
                    <button className="btn small secondary" onClick={() => setGestionFor(c.id)}>Gestionar</button>
                    <Link className="btn small secondary" href={`/clientes/${c.id}`}>Ver cliente</Link>
                  </div>
                </div>
              );
            })}
            {g.list.length > shown && (
              <button className="btn small secondary" onClick={() => setVisible({ ...visible, [g.band]: shown + 12 })}>
                Mostrar más ({g.list.length - shown} restantes)
              </button>
            )}
          </section>
        );
      })}

      {groups.length === 0 && (
        <div className="panel">No hay facturas pendientes. Registra clientes y facturas o importa tu Excel.</div>
      )}

      {gestionFor && (() => {
        const c = clientById(gestionFor);
        if (!c) return null;
        return <GestionModal client={c} invoices={invoicesOf(c.id)} today={data.today} data={data} onClose={() => setGestionFor(null)} mutate={mutate} />;
      })()}

      {msgFor && (() => {
        const c = clientById(msgFor);
        if (!c) return null;
        return (
          <MessageModal
            client={c}
            invoice={c.topInvoice ? data.derived.invoices.find((i) => i.id === c.topInvoice!.id) ?? null : null}
            brokenPromise={brokenOf(c.id)[0] ?? null}
            soonPromise={soonOf(c.id)[0] ?? null}
            settings={data.settings}
            onClose={() => setMsgFor(null)}
          />
        );
      })()}
    </>
  );
}
