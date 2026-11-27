'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePayload } from '@/lib/usePayload';
import { fmtPEN, fmtPct } from '@/lib/format';
import { ErrorBox, KpiCard, Loading } from '@/components/ui';
import { BAND_META } from '@/lib/engine';

type Role = 'jefatura' | 'gerencia';

export default function ResumenPage() {
  const { data, error, reload } = usePayload();
  const [role, setRole] = useState<Role>('jefatura');

  useEffect(() => {
    const saved = window.localStorage.getItem('rol');
    if (saved === 'gerencia' || saved === 'jefatura') setRole(saved);
  }, []);
  useEffect(() => {
    window.localStorage.setItem('rol', role);
  }, [role]);

  if (!data) return error ? <ErrorBox msg={error} onRetry={reload} /> : <Loading />;
  const k = data.kpis;

  return (
    <>
      <div className="page-head">
        <h1>Resumen {role === 'gerencia' ? 'de gerencia' : 'de jefatura'}</h1>
        <div className="role-switch" style={{ marginTop: 8 }}>
          Ver como:
          <button className={role === 'jefatura' ? 'active' : ''} onClick={() => setRole('jefatura')}>Jefatura</button>
          <button className={role === 'gerencia' ? 'active' : ''} onClick={() => setRole('gerencia')}>Gerencia</button>
        </div>
      </div>

      <div className="panel">
        <h2>Cartera</h2>
        <div className="cards">
          <KpiCard k="Total por cobrar" v={fmtPEN(k.cartera.totalPendientePEN)} s={`PEN ${fmtPEN(k.cartera.pendientePEN)} + USD ${fmtPEN(k.cartera.pendienteUSD)}`} />
          <KpiCard k="Por vencer" v={fmtPEN(k.cartera.porVencerPEN)} s="Próximos vencimientos" />
          <KpiCard k="Vencido" v={fmtPEN(k.cartera.vencidoPEN)} s={`Morosidad del saldo: ${fmtPct(k.cartera.morosidadSaldoPct)}`} />
          <KpiCard k="Recuperado (30 días)" v={fmtPEN(k.cartera.recuperado30dPEN)} s={`Acumulado: ${fmtPEN(k.cartera.recuperadoTotalPEN)}`} />
        </div>
      </div>

      <div className="panel">
        <h2>Riesgo</h2>
        <div className="cards">
          <KpiCard k="Clientes críticos" v={`${BAND_META.critico.emoji} ${k.riesgo.criticos}`} s="requieren gestión inmediata" />
          <KpiCard k="Clientes en riesgo" v={`${BAND_META.riesgo.emoji} ${k.riesgo.enRiesgo}`} s="críticos + riesgo" />
          <KpiCard k="Monto en riesgo" v={fmtPEN(k.riesgo.montoEnRiesgoPEN)} s="cartera de clientes 🟠🔴" />
          <KpiCard k="Morosidad de clientes" v={fmtPct(k.cartera.morosidadClientesPct)} s={`${k.cartera.clientesEnMora} de ${k.cartera.clientesConDeuda} clientes con deuda`} />
        </div>
      </div>

      <div className="panel">
        <h2>Aging por tramos</h2>
        <table className="tbl">
          <thead><tr><th>Tramo</th><th className="num">Facturas</th><th className="num">Monto</th><th className="num">% del saldo</th><th style={{ width: 200 }}></th></tr></thead>
          <tbody>
            {k.tramos.map((t) => (
              <tr key={t.tramo}>
                <td>{t.label}</td>
                <td className="num">{t.count}</td>
                <td className="num">{fmtPEN(t.montoPEN)}</td>
                <td className="num">{fmtPct(t.pct)}</td>
                <td><div className="bar"><span style={{ width: `${Math.min(100, t.pct)}%` }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Gestión</h2>
        <div className="cards">
          <KpiCard k="Gestiones (7 días)" v={k.gestion.gestiones7d} s={`${k.gestion.gestiones30d} en 30 días`} />
          <KpiCard k="Contactabilidad" v={fmtPct(k.gestion.contactabilidadPct)} s="% de gestiones con contacto logrado" />
          <KpiCard k="Promesas activas" v={k.gestion.promesasActivas} s={`${k.gestion.promesasProximas} próximas a vencer`} />
          <KpiCard k="Cumplimiento de promesas" v={fmtPct(k.gestion.cumplimientoPct)} s={`${k.gestion.promesasCumplidas} cumplidas · ${k.gestion.promesasIncumplidas} incumplidas`} />
        </div>
        {k.gestion.porCanal.length > 0 && (
          <>
            <h3 style={{ marginTop: 14 }}>Efectividad por canal (30 días)</h3>
            <table className="tbl">
              <thead><tr><th>Canal</th><th className="num">Gestiones</th><th className="num">Contactado</th><th className="num">Pagará</th></tr></thead>
              <tbody>
                {k.gestion.porCanal.map((c) => (
                  <tr key={c.canal}>
                    <td style={{ textTransform: 'capitalize' }}>{c.canal}</td>
                    <td className="num">{c.total}</td>
                    <td className="num">{fmtPct(c.contactadoPct)}</td>
                    <td className="num">{fmtPct(c.pagaraPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {role === 'gerencia' && (
        <div className="panel">
          <h2>Resultado</h2>
          <div className="cards">
            <KpiCard k="Recuperado últimos 30 días" v={fmtPEN(k.resultado.recuperado30dPEN)} s="facturas pagadas en el periodo" />
            <KpiCard k="% de recuperación" v={fmtPct(k.resultado.pctRecuperacion)} s="recuperado / (recuperado + vencido)" />
            <KpiCard k="Cartera vencida actual" v={fmtPEN(k.resultado.vencidoPEN)} s="línea base piloto: 40% del saldo" />
            <KpiCard k="Morosidad del saldo" v={fmtPct(k.cartera.morosidadSaldoPct)} s="meta del piloto: reducir 10 puntos en 60-90 días" />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            Los KPIs por tramo permiten evaluar si la gestión está moviendo saldo de tramos críticos (61-90 y +90) hacia pagos o tramos menores.
          </p>
        </div>
      )}

      <div className="panel">
        <h2>Top clientes críticos</h2>
        <table className="tbl">
          <thead><tr><th>Cliente</th><th>Banda</th><th className="num">Deuda</th><th className="num">Score</th><th>Acción recomendada</th></tr></thead>
          <tbody>
            {data.derived.clients.filter((c) => c.band === 'critico' || c.band === 'riesgo').sort((a, b) => b.score - a.score).slice(0, 10).map((c) => (
              <tr key={c.id}>
                <td><Link href={`/clientes/${c.id}`}>{c.name}</Link></td>
                <td>{BAND_META[c.band].emoji} {BAND_META[c.band].label}</td>
                <td className="num">{fmtPEN(c.deudaPEN)}</td>
                <td className="num">{c.score}</td>
                <td>{c.recommendedAction.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
