import type {
  Client,
  CollectionAction,
  Currency,
  DB,
  Invoice,
  PaymentPromise,
  Settings,
} from './types';


export const DAY = 86400000;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function amountPEN(amount: number, currency: Currency, settings: Settings): number {
  return currency === 'USD' ? amount * settings.exchangeRate : amount;
}

export type InvoiceStatus = 'pagada' | 'vencida' | 'proximo' | 'por_vencer';

export function invoiceStatus(inv: Invoice, today: string): InvoiceStatus {
  if (inv.paidAt) return 'pagada';
  const d = daysBetween(today, inv.dueDate);
  if (d < 0) return 'vencida';
  if (d <= 7) return 'proximo';
  return 'por_vencer';
}

export function daysLate(inv: Invoice, today: string): number {
  return inv.paidAt ? 0 : Math.max(0, daysBetween(inv.dueDate, today));
}

export function daysToDue(inv: Invoice, today: string): number {
  return inv.paidAt ? 0 : daysBetween(today, inv.dueDate);
}

export type AgingTramo = 'por_vencer' | '1_15' | '16_30' | '31_60' | '61_90' | 'mas_90';

export function agingTramo(inv: Invoice, today: string): AgingTramo {
  const late = daysLate(inv, today);
  if (late <= 0) return 'por_vencer';
  if (late <= 15) return '1_15';
  if (late <= 30) return '16_30';
  if (late <= 60) return '31_60';
  if (late <= 90) return '61_90';
  return 'mas_90';
}

export const TRAMO_LABEL: Record<AgingTramo, string> = {
  por_vencer: 'Por vencer',
  '1_15': '1 a 15 días',
  '16_30': '16 a 30 días',
  '31_60': '31 a 60 días',
  '61_90': '61 a 90 días',
  mas_90: 'Más de 90 días',
};

export type Band = 'critico' | 'riesgo' | 'atencion' | 'bajo';

export const BAND_META: Record<Band, { label: string; emoji: string; group: string }> = {
  critico: { label: 'Crítico', emoji: '🔴', group: 'Prioridad alta' },
  riesgo: { label: 'Riesgo', emoji: '🟠', group: 'Gestionar hoy' },
  atencion: { label: 'Atención', emoji: '🟡', group: 'Seguimiento' },
  bajo: { label: 'Bajo riesgo', emoji: '🟢', group: 'Preventivo' },
};

export type RecommendedAction = { label: string; channel: 'whatsapp' | 'llamada' | 'email' | 'ninguno' };

export interface InvoiceDerived {
  status: InvoiceStatus;
  daysLate: number;
  daysToDue: number;
  tramo: AgingTramo;
  amountPEN: number;
  score: number;
  reasons: string[];
}

export interface PromiseDerived {
  statusDerived: 'registrada' | 'proxima' | 'cumplida' | 'incumplida' | 'reprogramada';
  daysToPromise: number;
  clientName: string;
  invoiceNumber: string;
  overdue: boolean;
}

export interface ClientDerived {
  band: Band;
  score: number;
  reasons: string[];
  deudaPEN: number;
  deudaPendiente: { PEN: number; USD: number };
  pendingCount: number;
  worstDaysLate: number;
  minDaysToDue: number | null;
  punctuality: number | null;
  brokenPromiseDays: number | null;
  hasActivePromise: boolean;
  topInvoice: Invoice | null;
  recommendedAction: RecommendedAction;
}

export interface Alert {
  id: string;
  type:
    | 'vence_hoy'
    | 'vence_pronto'
    | 'vencida'
    | 'riesgo'
    | 'promesa_proxima'
    | 'promesa_incumplida'
    | 'promesa_vence_hoy';
  severity: 'alta' | 'media' | 'baja';
  message: string;
  actionLabel: string;
  clientId: string;
  invoiceId?: string;
  promiseId?: string;
}

export interface DerivedState {
  today: string;
  clients: (Client & ClientDerived)[];
  invoices: (Invoice & InvoiceDerived & { clientName: string })[];
  promises: (PaymentPromise & PromiseDerived)[];
  actions: (CollectionAction & { clientName: string })[];
  alerts: Alert[];
  p95: number;
  p75: number;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.max(sorted[idx], 1);
}

function urgencyPoints(daysTo: number): number {
  if (daysTo <= 3) return 100;
  if (daysTo <= 7) return 80;
  if (daysTo <= 15) return 55;
  return 25;
}

function latenessPoints(late: number): number {
  if (late <= 0) return 0;
  if (late <= 7) return 40;
  if (late <= 15) return 60;
  if (late <= 30) return 80;
  if (late <= 60) return 95;
  return 100;
}

export function derive(db: DB, today = todayStr()): DerivedState {
  const { settings } = db;
  const pending = db.invoices.filter((i) => !i.paidAt);
  const p95 = percentile(pending.map((i) => amountPEN(i.amount, i.currency, settings)), 95);
  const p75 = percentile(pending.map((i) => amountPEN(i.amount, i.currency, settings)), 75);

  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const clientName = (id: string) => clientById.get(id)?.name ?? '—';
  const invoiceById = new Map(db.invoices.map((i) => [i.id, i]));

  const activePromises = db.promises.filter((p) => p.status === 'registrada' || p.status === 'reprogramada');
  const brokenPromises = db.promises.filter((p) => p.status === 'incumplida');
  const promisesByClient = new Map<string, PaymentPromise[]>();
  for (const p of [...activePromises, ...brokenPromises]) {
    promisesByClient.set(p.clientId, [...(promisesByClient.get(p.clientId) ?? []), p]);
  }

  const invoicesByClient = new Map<string, Invoice[]>();
  for (const i of pending) {
    invoicesByClient.set(i.clientId, [...(invoicesByClient.get(i.clientId) ?? []), i]);
  }

  const punctualityByClient = new Map<string, number | null>();
  for (const c of db.clients) {
    const paid = db.invoices.filter((i) => i.clientId === c.id && i.paidAt);
    if (!paid.length) {
      punctualityByClient.set(c.id, null);
      continue;
    }
    const onTime = paid.filter((i) => daysBetween(i.dueDate, i.paidAt as string) <= 0).length;
    punctualityByClient.set(c.id, onTime / paid.length);
  }

  const invoiceDerived = new Map<string, InvoiceDerived>();
  for (const inv of db.invoices) {
    const status = invoiceStatus(inv, today);
    const late = daysLate(inv, today);
    const toDue = daysToDue(inv, today);
    const amount = amountPEN(inv.amount, inv.currency, settings);
    const reasons: string[] = [];
    let score = 0;
    if (status !== 'pagada') {
      const urg = urgencyPoints(toDue);
      const monto = Math.min(100, (100 * Math.log(1 + amount)) / Math.log(1 + p95));
      const atraso = latenessPoints(late);
      const punt = punctualityByClient.get(inv.clientId);
      const hist = punt == null ? 50 : punt * 100;
      score = (settings.weights.urgencia / 100) * urg + (settings.weights.monto / 100) * monto + (settings.weights.atraso / 100) * atraso + (settings.weights.historial / 100) * hist;
      if (status === 'vencida') reasons.push(`Vencida hace ${late} día${late === 1 ? '' : 's'}`);
      else if (toDue <= 3) reasons.push(toDue === 0 ? 'Vence hoy' : `Vence en ${toDue} día${toDue === 1 ? '' : 's'}`);
      else if (toDue <= 15) reasons.push(`Vence en ${toDue} días`);
      if (monto >= 70) reasons.push('Monto alto en la cartera');
      if (punt != null && punt >= 0.9) reasons.push('Cliente puntual');
      if (punt != null && punt < 0.5) reasons.push('Cliente con mal historial de pago');
    }
    invoiceDerived.set(inv.id, { status, daysLate: late, daysToDue: toDue, tramo: agingTramo(inv, today), amountPEN: amount, score: Math.round(score), reasons });
  }

  const clients: (Client & ClientDerived)[] = db.clients.map((c) => {
    const invs = invoicesByClient.get(c.id) ?? [];
    const deudaPEN = invs.reduce((s, i) => s + amountPEN(i.amount, i.currency, settings), 0);
    const deuda = { PEN: 0, USD: 0 } as Record<Currency, number>;
    for (const i of invs) deuda[i.currency] += i.amount;
    const worstDaysLate = invs.reduce((m, i) => Math.max(m, daysLate(i, today)), 0);
    const futureDues = invs.filter((i) => daysToDue(i, today) >= 0);
    const minDaysToDue = futureDues.length ? Math.min(...futureDues.map((i) => daysToDue(i, today))) : null;
    const cps = promisesByClient.get(c.id) ?? [];
    const active = cps.filter((p) => p.status !== 'incumplida');
    const broken = cps.filter((p) => p.status === 'incumplida');
    const brokenDays = broken.length
      ? Math.min(...broken.map((p) => Math.abs(daysBetween(p.promisedDate, today))))
      : null;
    const topPending = invs
      .map((i) => ({ i, d: invoiceDerived.get(i.id) as InvoiceDerived }))
      .sort((a, b) => b.d.score - a.d.score);
    const top = topPending[0];

    const reasons: string[] = [];
    let score = 0;
    if (top) {
      const conc = invs.length >= 4 ? 100 : invs.length >= 2 ? 70 : 40;
      score = top.d.score + (settings.weights.concentracion / 100) * conc;
      if (active.length) score -= settings.weights.penalPromesaActiva;
      if (broken.length) score += settings.weights.bonoPromesaIncumplida;
      score = Math.max(0, Math.min(100, Math.round(score)));
      reasons.push(...top.d.reasons);
      if (invs.length >= 2) reasons.push(`${invs.length} facturas pendientes`);
      if (brokenDays != null) reasons.push(`Promesa incumplida (hace ${brokenDays} días)`);
      if (active.length) {
        const nextP = [...active].sort((a, b) => a.promisedDate.localeCompare(b.promisedDate))[0];
        const dd = daysBetween(today, nextP.promisedDate);
        reasons.push(dd >= 0 ? `Promesa de pago en ${dd} días` : 'Promesa de pago vencida sin confirmar');
      }
    }

    const topAmount = top ? top.d.amountPEN : 0;
    let band: Band;
    if (top && (broken.length > 0 || (worstDaysLate > 30 && topAmount >= p75))) band = 'critico';
    else if (top && (worstDaysLate > 0 || score >= settings.bands.riesgo)) band = worstDaysLate > 0 ? 'riesgo' : bandFromScore(score, settings);
    else band = bandFromScore(score, settings);

    const recommendedAction = recommendAction({ broken, active, worstDaysLate, minDaysToDue, punctuality: punctualityByClient.get(c.id) ?? null, today });

    return {
      ...c,
      band,
      score,
      reasons,
      deudaPEN,
      deudaPendiente: deuda,
      pendingCount: invs.length,
      worstDaysLate,
      minDaysToDue,
      punctuality: punctualityByClient.get(c.id) ?? null,
      brokenPromiseDays: brokenDays,
      hasActivePromise: active.length > 0,
      topInvoice: top ? top.i : null,
      recommendedAction,
    };
  });

  function bandFromScore(score: number, s: Settings): Band {
    if (score >= s.bands.critico) return 'critico';
    if (score >= s.bands.riesgo) return 'riesgo';
    if (score >= s.bands.atencion) return 'atencion';
    return 'bajo';
  }

  const promises: (PaymentPromise & PromiseDerived)[] = db.promises.map((p) => {
    const dd = daysBetween(today, p.promisedDate);
    let statusDerived: PromiseDerived['statusDerived'] = p.status;
    if (p.status === 'registrada' || p.status === 'reprogramada') {
      statusDerived = dd < 0 ? 'incumplida' : dd <= 3 ? 'proxima' : 'registrada';
    }
    return {
      ...p,
      statusDerived,
      daysToPromise: dd,
      clientName: clientName(p.clientId),
      invoiceNumber: invoiceById.get(p.invoiceId)?.number ?? '—',
      overdue: dd < 0 && p.status !== 'cumplida',
    };
  });

  const alerts: Alert[] = [];
  const push = (a: Alert) => alerts.push(a);
  for (const c of clients) {
    const invs = invoicesByClient.get(c.id) ?? [];
    for (const i of invs) {
      const d = invoiceDerived.get(i.id) as InvoiceDerived;
      if (d.daysToDue === 0) push({ id: `vence_hoy_${i.id}`, type: 'vence_hoy', severity: 'alta', message: `La factura ${i.number} de ${c.name} vence hoy (${fmtMoney(i.amount, i.currency)}).`, actionLabel: 'Enviar aviso de vencimiento', clientId: c.id, invoiceId: i.id });
      else if (d.daysToDue > 0 && d.daysToDue <= 7) push({ id: `vence_pronto_${i.id}`, type: 'vence_pronto', severity: d.daysToDue <= 3 ? 'media' : 'baja', message: `La factura ${i.number} de ${c.name} vence en ${d.daysToDue} días (${fmtMoney(i.amount, i.currency)}).`, actionLabel: 'Enviar recordatorio preventivo', clientId: c.id, invoiceId: i.id });
      else if (d.status === 'vencida') push({ id: `vencida_${i.id}`, type: 'vencida', severity: d.daysLate > 30 ? 'alta' : 'media', message: `${c.name} presenta la factura ${i.number} vencida hace ${d.daysLate} días (${fmtMoney(i.amount, i.currency)}).`, actionLabel: 'Registrar gestión de cobranza', clientId: c.id, invoiceId: i.id });
    }
    for (const p of promises.filter((x) => x.clientId === c.id)) {
      if (p.statusDerived === 'proxima') push({ id: `prom_prox_${p.id}`, type: 'promesa_proxima', severity: p.daysToPromise === 0 ? 'alta' : 'media', message: `${c.name} tiene una promesa de pago ${p.daysToPromise === 0 ? 'para hoy' : `en ${p.daysToPromise} días`} (${fmtMoney(p.amount, p.currency)}).`, actionLabel: 'Confirmar compromiso', clientId: c.id, promiseId: p.id });
      if (p.statusDerived === 'incumplida') push({ id: `prom_inc_${p.id}`, type: 'promesa_incumplida', severity: 'alta', message: `${c.name} no cumplió la promesa de pago del ${p.promisedDate} (${fmtMoney(p.amount, p.currency)}).`, actionLabel: 'Gestión prioritaria', clientId: c.id, promiseId: p.id });
    }
  }

  return {
    today,
    clients,
    invoices: db.invoices.map((i) => ({ ...i, ...(invoiceDerived.get(i.id) as InvoiceDerived), clientName: clientName(i.clientId) })),
    promises,
    actions: db.actions.map((a) => ({ ...a, clientName: clientName(a.clientId) })).sort((a, b) => b.date.localeCompare(a.date)),
    alerts: alerts.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity)),
    p95,
    p75,
  };
}

function severityOrder(s: Alert['severity']): number {
  return s === 'alta' ? 0 : s === 'media' ? 1 : 2;
}

function recommendAction(ctx: {
  broken: PaymentPromise[];
  active: PaymentPromise[];
  worstDaysLate: number;
  minDaysToDue: number | null;
  punctuality: number | null;
  today: string;
}): RecommendedAction {
  if (ctx.broken.length) return { label: 'Gestión prioritaria: recuperar compromiso (llamada)', channel: 'llamada' };
  if (ctx.active.length) {
    const next = [...ctx.active].sort((a, b) => a.promisedDate.localeCompare(b.promisedDate))[0];
    if (daysBetween(ctx.today, next.promisedDate) <= 3) return { label: 'Confirmar promesa de pago (WhatsApp)', channel: 'whatsapp' };
  }
  if (ctx.worstDaysLate > 30) return { label: 'Gestión prioritaria: llamada directa y evaluar plan de pago', channel: 'llamada' };
  if (ctx.worstDaysLate > 7) return { label: 'Contacto de cobranza formal', channel: 'llamada' };
  if (ctx.worstDaysLate > 0) {
    if ((ctx.punctuality ?? 0.5) >= 0.8) return { label: 'Mensaje amigable de mora temprana', channel: 'whatsapp' };
    return { label: 'Contacto de cobranza', channel: 'llamada' };
  }
  if (ctx.minDaysToDue != null && ctx.minDaysToDue <= 3) return { label: 'Aviso de vencimiento + datos de pago', channel: 'whatsapp' };
  if (ctx.minDaysToDue != null && ctx.minDaysToDue <= 15) return { label: 'Recordatorio preventivo', channel: 'whatsapp' };
  if (ctx.minDaysToDue != null && ctx.minDaysToDue <= 7) return { label: 'Recordatorio preventivo', channel: 'whatsapp' };
  return { label: 'Sin acción urgente: monitorear', channel: 'ninguno' };
}

export function fmtMoney(amount: number, currency: Currency): string {
  const n = amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'PEN' ? `S/ ${n}` : `US$ ${n}`;
}

export interface Kpis {
  cartera: {
    totalPendientePEN: number;
    pendientePEN: number;
    pendienteUSD: number;
    porVencerPEN: number;
    vencidoPEN: number;
    recuperado30dPEN: number;
    recuperadoTotalPEN: number;
    morosidadSaldoPct: number;
    morosidadClientesPct: number;
    clientesConDeuda: number;
    clientesEnMora: number;
  };
  tramos: { tramo: AgingTramo; label: string; montoPEN: number; pct: number; count: number }[];
  riesgo: { criticos: number; enRiesgo: number; montoEnRiesgoPEN: number };
  gestion: {
    gestiones7d: number;
    gestiones30d: number;
    contactabilidadPct: number;
    promesasActivas: number;
    promesasProximas: number;
    promesasCumplidas: number;
    promesasIncumplidas: number;
    cumplimientoPct: number;
    porCanal: { canal: string; total: number; contactadoPct: number; pagaraPct: number }[];
  };
  resultado: {
    recuperado30dPEN: number;
    pctRecuperacion: number;
    vencidoPEN: number;
  };
}

export function computeKpis(d: DerivedState): Kpis {
  const pending = d.invoices.filter((i) => i.status !== 'pagada');
  const toPEN = (i: Invoice & InvoiceDerived) => i.amountPEN;
  const totalPendiente = pending.reduce((s, i) => s + toPEN(i), 0);
  const porVencer = pending.filter((i) => i.tramo === 'por_vencer').reduce((s, i) => s + toPEN(i), 0);
  const vencido = pending.filter((i) => i.tramo !== 'por_vencer').reduce((s, i) => s + toPEN(i), 0);
  const paid = d.invoices.filter((i) => i.status === 'pagada');
  const in30 = paid.filter((i) => i.paidAt && daysBetween(i.paidAt, d.today) <= 30);
  const recuperado30 = in30.reduce((s, i) => s + toPEN(i), 0);
  const recuperadoTotal = paid.reduce((s, i) => s + toPEN(i), 0);
  const clientesConDeuda = d.clients.filter((c) => c.pendingCount > 0);
  const clientesEnMora = clientesConDeuda.filter((c) => c.worstDaysLate > 0);

  const tramos = (['por_vencer', '1_15', '16_30', '31_60', '61_90', 'mas_90'] as AgingTramo[]).map((t) => {
    const list = pending.filter((i) => i.tramo === t);
    const monto = list.reduce((s, i) => s + toPEN(i), 0);
    return { tramo: t, label: TRAMO_LABEL[t], montoPEN: monto, pct: totalPendiente ? (monto / totalPendiente) * 100 : 0, count: list.length };
  });

  const enRiesgo = clientesConDeuda.filter((c) => c.band === 'critico' || c.band === 'riesgo');
  const acciones30 = d.actions.filter((a) => daysBetween(a.date, d.today) <= 30);
  const contactadas = acciones30.filter((a) => a.result !== 'no_contactado');
  const proms = d.promises;
  const activas = proms.filter((p) => p.statusDerived === 'registrada' || p.statusDerived === 'proxima');
  const cumplidas = proms.filter((p) => p.statusDerived === 'cumplida');
  const incumplidas = proms.filter((p) => p.statusDerived === 'incumplida');
  const resueltas = cumplidas.length + incumplidas.length;

  const canalMap = new Map<string, CollectionAction[]>();
  for (const a of acciones30) canalMap.set(a.channel, [...(canalMap.get(a.channel) ?? []), a]);

  return {
    cartera: {
      totalPendientePEN: totalPendiente,
      pendientePEN: d.clients.reduce((s, c) => s + c.deudaPendiente.PEN, 0),
      pendienteUSD: d.clients.reduce((s, c) => s + c.deudaPendiente.USD, 0),
      porVencerPEN: porVencer,
      vencidoPEN: vencido,
      recuperado30dPEN: recuperado30,
      recuperadoTotalPEN: recuperadoTotal,
      morosidadSaldoPct: totalPendiente ? (vencido / totalPendiente) * 100 : 0,
      morosidadClientesPct: clientesConDeuda.length ? (clientesEnMora.length / clientesConDeuda.length) * 100 : 0,
      clientesConDeuda: clientesConDeuda.length,
      clientesEnMora: clientesEnMora.length,
    },
    tramos,
    riesgo: {
      criticos: d.clients.filter((c) => c.band === 'critico').length,
      enRiesgo: enRiesgo.length,
      montoEnRiesgoPEN: enRiesgo.reduce((s, c) => s + c.deudaPEN, 0),
    },
    gestion: {
      gestiones7d: d.actions.filter((a) => daysBetween(a.date, d.today) <= 7).length,
      gestiones30d: acciones30.length,
      contactabilidadPct: acciones30.length ? (contactadas.length / acciones30.length) * 100 : 0,
      promesasActivas: activas.length,
      promesasProximas: proms.filter((p) => p.statusDerived === 'proxima').length,
      promesasCumplidas: cumplidas.length,
      promesasIncumplidas: incumplidas.length,
      cumplimientoPct: resueltas ? (cumplidas.length / resueltas) * 100 : 0,
      porCanal: [...canalMap.entries()].map(([canal, list]) => ({
        canal,
        total: list.length,
        contactadoPct: list.length ? (list.filter((a) => a.result !== 'no_contactado').length / list.length) * 100 : 0,
        pagaraPct: list.length ? (list.filter((a) => a.result === 'pagara').length / list.length) * 100 : 0,
      })),
    },
    resultado: {
      recuperado30dPEN: recuperado30,
      pctRecuperacion: recuperado30 + vencido > 0 ? (recuperado30 / (recuperado30 + vencido)) * 100 : 0,
      vencidoPEN: vencido,
    },
  };
}
