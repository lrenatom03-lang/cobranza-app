'use client';

import { useMemo, useState } from 'react';
import type { Payload } from '@/lib/state';
import type { ClientDerived } from '@/lib/engine';
import { fmtMoney } from '@/lib/format';
import { renderTemplate, SCENARIOS, type Scenario, type TemplateCtx } from '@/lib/templates';
import { Modal } from './ui';
import type { Invoice, Settings } from '@/lib/types';

type MClient = ClientDerived & { id: string; name: string; phone?: string; email?: string };
type MInvoice = Invoice & { clientName: string; daysLate: number; daysToDue: number };

function suggestScenario(inv: MInvoice | null, promiseBroken: boolean, promiseSoon: boolean): Scenario {
  if (promiseBroken) return 'incumplimiento';
  if (promiseSoon) return 'promesa';
  if (!inv) return 'preventivo';
  if (inv.daysLate > 15) return 'mora_avanzada';
  if (inv.daysLate > 0) return 'mora_temprana';
  if (inv.daysToDue <= 3) return 'vencimiento';
  return 'preventivo';
}

function waPhone(phone: string | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) return `51${digits}`;
  return digits;
}

export function MessageModal({
  client,
  invoice,
  brokenPromise,
  soonPromise,
  settings,
  onClose,
}: {
  client: MClient;
  invoice: MInvoice | null;
  brokenPromise?: { promisedDate: string; amount: number; currency: 'PEN' | 'USD' } | null;
  soonPromise?: { promisedDate: string; amount: number; currency: 'PEN' | 'USD' } | null;
  settings: Settings;
  onClose: () => void;
}) {
  const [scenario, setScenario] = useState<Scenario>(suggestScenario(invoice, !!brokenPromise, !!soonPromise));
  const msg = useMemo(() => {
    const ctx: TemplateCtx = {
      cliente: client.name,
      factura: invoice?.number ?? '—',
      monto: invoice ? fmtMoney(invoice.amount, invoice.currency) : brokenPromise ? fmtMoney(brokenPromise.amount, brokenPromise.currency) : soonPromise ? fmtMoney(soonPromise.amount, soonPromise.currency) : '—',
      dias_para_vencer: invoice ? (invoice.daysToDue === 0 ? 'hoy' : `en ${invoice.daysToDue} días`) : '—',
      dias_atraso: invoice ? String(invoice.daysLate) : '—',
      fecha_vencimiento: invoice?.dueDate ?? '—',
      fecha_prometida: brokenPromise?.promisedDate ?? soonPromise?.promisedDate ?? '—',
      datos_pago: settings.paymentInfo || '(configurar datos de pago en Configuración)',
      mi_nombre: '',
      mi_negocio: settings.businessName || 'nuestro negocio',
    };
    return renderTemplate(scenario, ctx);
  }, [scenario, client, invoice, brokenPromise, soonPromise, settings]);

  const [text, setText] = useState(msg);
  const [current, setCurrent] = useState(msg);
  const [copied, setCopied] = useState(false);

  if (current !== msg) {
    setCurrent(msg);
    setText(msg);
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const wa = `https://wa.me/${waPhone(client.phone)}?text=${encodeURIComponent(text)}`;
  const mail = `mailto:${client.email ?? ''}?subject=${encodeURIComponent(`Recordatorio de pago · ${invoice?.number ?? ''}`)}&body=${encodeURIComponent(text)}`;
  const tel = `tel:${(client.phone ?? '').replace(/\s/g, '')}`;

  return (
    <Modal title={`Mensaje de cobranza · ${client.name}`} onClose={onClose}>
      <div className="field">
        <label>Escenario</label>
        <select value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
          {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
            <option key={s} value={s}>{SCENARIOS[s].label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Mensaje (editable)</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {copied && <p style={{ color: 'var(--green)', fontSize: 12 }}>Mensaje copiado al portapapeles.</p>}
      <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
        <a className="btn green" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="btn secondary" href={mail}>Email</a>
        <a className="btn secondary" href={tel}>Llamar</a>
        <button className="btn" onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar'}</button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '10px 0 0' }}>
        El envío es manual: el mensaje se abre en tu app o se copia para pegarlo. El envío automático está planificado para una segunda fase.
      </p>
    </Modal>
  );
}
