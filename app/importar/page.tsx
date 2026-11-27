'use client';

import { useState } from 'react';
import { usePayload } from '@/lib/usePayload';
import { ErrorBox, Loading } from '@/components/ui';
import type { ImportPreview } from '@/lib/csv';

const EXAMPLE = `cliente,ID,precio,cantidad,fecha de entrega,fecha de pago,moneda
Comercial Los Andes S.A.C.,20100047718,1500,2,01/03/2025,31/03/2025,PEN
Bodega El Sol E.I.R.L.,10467889900,80,10,05/03/2025,20/03/2025,PEN
Importadora Del Pacífico S.A.,20512345678,900,1,10/03/2025,09/04/2025,USD`;

export default function ImportarPage() {
  const { data, error, reload } = usePayload();
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{ clients: number; invoices: number; errors: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async (mode: 'preview' | 'commit') => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, mode }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      if (mode === 'preview') setPreview(j.preview as ImportPreview);
      else {
        setResult(j.result);
        setPreview(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setCsv(text);
    setResult(null);
    setPreview(null);
  };

  return (
    <>
      <div className="page-head">
        <h1>Importar facturas desde Excel / CSV</h1>
        <p>Convierte tu archivo de ventas en la cartera de la app sin doble digitación.</p>
      </div>

      <div className="note">
        <strong>Formato esperado</strong> (una fila por venta): <code>cliente</code>, <code>ID</code>, <code>precio</code>, <code>cantidad</code>, <code>fecha de entrega</code>, <code>fecha de pago</code> (interpretada como <strong>fecha de vencimiento pactada</strong>, según lo confirmado). Opcional: <code>moneda</code> (PEN/USD, por defecto PEN), <code>total</code> o <code>monto</code> (si ya viene calculado), <code>costo</code>, <code>condicion</code> (días de crédito). El monto se calcula como precio × cantidad si no hay columna de total.
      </div>

      {error && <ErrorBox msg={error} onRetry={reload} />}
      {!data && <Loading />}

      {data && (
        <>
          <div className="panel">
            <div className="toolbar">
              <input type="file" accept=".csv,.txt,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              <button className="btn small secondary" onClick={() => setCsv(EXAMPLE)}>Cargar ejemplo</button>
            </div>
            <div className="field">
              <label>O pega el contenido (exporta tu Excel como CSV)</label>
              <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); setResult(null); }} placeholder="cliente,ID,precio,cantidad,fecha de entrega,fecha de pago…" style={{ minHeight: 150 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => send('preview')} disabled={busy || !csv.trim()}>Validar y previsualizar</button>
              <button className="btn green" onClick={() => send('commit')} disabled={busy || !csv.trim()}>Importar</button>
            </div>
            {err && <p className="error-text">{err}</p>}
          </div>

          {result && (
            <div className="panel">
              <h2>Resultado de la importación</h2>
              <p>✅ {result.clients} cliente(s) creados · {result.invoices} factura(s) importadas · {result.errors} fila(s) con errores (omitidas).</p>
            </div>
          )}

          {preview && (
            <div className="panel">
              <h2>Previsualización</h2>
              <p>
                Columnas detectadas: <strong>{preview.headers.join(', ')}</strong><br />
                Filas válidas: <strong>{preview.okRows}</strong> de {preview.totalRows} · Errores: <strong>{preview.errors.length}</strong>
              </p>
              {preview.errors.length > 0 && (
                <div className="warn">
                  <strong>Filas con problemas (no se importarán):</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {preview.errors.map((e, i) => <li key={i}>Línea {e.line}: {e.reason}</li>)}
                  </ul>
                </div>
              )}
              <table className="tbl">
                <thead><tr><th>Cliente</th><th>ID</th><th>Factura</th><th className="num">Monto</th><th>Moneda</th><th>Emisión</th><th>Vencimiento</th><th className="num">Condición</th></tr></thead>
                <tbody>
                  {preview.sample.map((r, i) => (
                    <tr key={i}>
                      <td>{r.clientName}</td><td>{r.docId}</td><td>{r.number}</td>
                      <td className="num">{r.amount.toFixed(2)}</td><td>{r.currency}</td>
                      <td>{r.issueDate}</td><td>{r.dueDate}</td><td className="num">{r.creditTermDays} d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
