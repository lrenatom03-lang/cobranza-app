'use client';

import { useEffect, useState } from 'react';
import { usePayload } from '@/lib/usePayload';
import { ErrorBox, Loading } from '@/components/ui';

export default function ConfiguracionPage() {
  const { data, error, reload, mutate } = usePayload();
  const [form, setForm] = useState<{ businessName: string; exchangeRate: string; paymentInfo: string; paymentLink: string; weights: Record<string, string>; bands: Record<string, string> } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && !form) {
      setForm({
        businessName: data.settings.businessName,
        exchangeRate: String(data.settings.exchangeRate),
        paymentInfo: data.settings.paymentInfo,
        paymentLink: data.settings.paymentLink,
        weights: Object.fromEntries(Object.entries(data.settings.weights).map(([k, v]) => [k, String(v)])),
        bands: Object.fromEntries(Object.entries(data.settings.bands).map(([k, v]) => [k, String(v)])),
      });
    }
  }, [data, form]);

  if (!data || !form) return error ? <ErrorBox msg={error} onRetry={reload} /> : <Loading />;

  const save = async () => {
    await mutate('/api/settings', {
      businessName: form.businessName,
      exchangeRate: Number(form.exchangeRate) || 1,
      paymentInfo: form.paymentInfo,
      paymentLink: form.paymentLink,
      weights: Object.fromEntries(Object.entries(form.weights).map(([k, v]) => [k, Number(v) || 0])),
      bands: Object.fromEntries(Object.entries(form.bands).map(([k, v]) => [k, Number(v) || 0])),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const W_LABELS: Record<string, string> = {
    urgencia: 'Urgencia (proximidad del vencimiento)',
    monto: 'Monto pendiente',
    atraso: 'Días de atraso',
    historial: 'Comportamiento histórico',
    concentracion: 'Concentración de facturas',
    penalPromesaActiva: 'Penalización: promesa activa',
    bonoPromesaIncumplida: 'Bono: promesa incumplida',
  };

  return (
    <>
      <div className="page-head">
        <h1>Configuración</h1>
        <p>Reglas de clasificación transparentes y editables: la priorización se recalcula al guardar.</p>
      </div>

      <div className="panel">
        <h2>Negocio y pagos</h2>
        <div className="field">
          <label>Nombre del negocio (aparece en los mensajes)</label>
          <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        </div>
        <div className="field">
          <label>Datos de pago que se incluyen en los mensajes (CCI, Yape, cuentas…)</label>
          <textarea value={form.paymentInfo} onChange={(e) => setForm({ ...form, paymentInfo: e.target.value })} style={{ minHeight: 70 }} />
        </div>
        <div className="row2">
          <div className="field">
            <label>Link de pago general (opcional, fase 2)</label>
            <input value={form.paymentLink} onChange={(e) => setForm({ ...form, paymentLink: e.target.value })} placeholder="https://…" />
          </div>
          <div className="field">
            <label>Tipo de cambio (1 USD = S/)</label>
            <input type="number" step="0.01" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Pesos del motor de priorización (suma recomendada: 100)</h2>
        {Object.entries(W_LABELS).map(([k, label]) => (
          <div className="field" key={k}>
            <label>{label}</label>
            <input type="number" min={0} max={100} value={form.weights[k]} onChange={(e) => setForm({ ...form, weights: { ...form.weights, [k]: e.target.value } })} />
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Umbrales de clasificación (score)</h2>
        <div className="row2">
          <div className="field"><label>🔴 Crítico ≥</label><input type="number" value={form.bands.critico} onChange={(e) => setForm({ ...form, bands: { ...form.bands, critico: e.target.value } })} /></div>
          <div className="field"><label>🟠 Riesgo ≥</label><input type="number" value={form.bands.riesgo} onChange={(e) => setForm({ ...form, bands: { ...form.bands, riesgo: e.target.value } })} /></div>
        </div>
        <div className="field"><label>🟡 Atención ≥ (menor: 🟢 bajo riesgo)</label><input type="number" value={form.bands.atencion} onChange={(e) => setForm({ ...form, bands: { ...form.bands, atencion: e.target.value } })} /></div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn" onClick={save}>Guardar configuración</button>
        {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>Guardado ✓</span>}
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <h2>Datos de demostración</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Regenera la cartera de ejemplo (borra clientes, facturas, gestiones y promesas actuales).</p>
        <button
          className="btn danger-ghost"
          onClick={async () => {
            if (!window.confirm('¿Regenerar los datos de demostración? Se perderán los datos actuales.')) return;
            await fetch('/api/seed', { method: 'POST' });
            await reload();
          }}
        >
          Regenerar datos demo
        </button>
      </div>
    </>
  );
}
