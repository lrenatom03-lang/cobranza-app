import type { Channel } from './types';

export interface TemplateCtx {
  cliente: string;
  factura: string;
  monto: string;
  dias_para_vencer: string;
  dias_atraso: string;
  fecha_vencimiento: string;
  fecha_prometida: string;
  datos_pago: string;
  mi_nombre: string;
  mi_negocio: string;
}

export type Scenario =
  | 'preventivo'
  | 'vencimiento'
  | 'mora_temprana'
  | 'mora_avanzada'
  | 'promesa'
  | 'incumplimiento';

export const SCENARIOS: Record<Scenario, { label: string; channel: Channel; subject?: string }> = {
  preventivo: { label: 'Recordatorio preventivo', channel: 'whatsapp' },
  vencimiento: { label: 'Aviso de vencimiento', channel: 'whatsapp' },
  mora_temprana: { label: 'Mora temprana', channel: 'whatsapp' },
  mora_avanzada: { label: 'Mora avanzada', channel: 'whatsapp' },
  promesa: { label: 'Confirmación de promesa', channel: 'whatsapp' },
  incumplimiento: { label: 'Seguimiento de incumplimiento', channel: 'llamada' },
};

const BODIES: Record<Scenario, string> = {
  preventivo:
    'Hola {cliente}, le saludamos de {mi_negocio}. Le recordamos amablemente que la factura {factura} por {monto} vence el {fecha_vencimiento} (en {dias_para_vencer} días). Si ya programó el pago, ignore este mensaje. Cualquier consulta, con gusto le atendemos.',
  vencimiento:
    'Hola {cliente}, le escribimos de {mi_negocio} para recordarle que la factura {factura} por {monto} vence {dias_para_vencer}. Estos son los datos para su pago: {datos_pago}. Quedamos atentos a cualquier consulta.',
  mora_temprana:
    'Hola {cliente}, notamos que la factura {factura} por {monto} quedó pendiente desde el {fecha_vencimiento}. ¿Hubo algún inconveniente con el pago? Con gusto le ayudamos a resolverlo. Datos de pago: {datos_pago}.',
  mora_avanzada:
    'Hola {cliente}, le escribimos de {mi_negocio} por la factura {factura} por {monto}, con {dias_atraso} días de atraso. Le agradecemos nos indique cuándo podríamos esperar el pago. Si le resulta útil, podemos evaluar una opción de pago en cuotas. Datos: {datos_pago}.',
  promesa:
    'Hola {cliente}, confirmando lo conversado: su pago de {monto} por la factura {factura} quedó comprometido para el {fecha_prometida}. Le enviamos los datos por si los necesita: {datos_pago}. ¡Gracias!',
  incumplimiento:
    'Hola {cliente}, el pago de {monto} (factura {factura}) comprometido para el {fecha_prometida} aún no lo registramos. ¿Podemos coordinar una nueva fecha? Su puntualidad nos ayuda a seguir brindándole el mismo nivel de servicio.',
};

export function renderTemplate(scenario: Scenario, ctx: TemplateCtx): string {
  return BODIES[scenario].replace(/\{(\w+)\}/g, (_, key: string) => (ctx as unknown as Record<string, string>)[key] ?? `{${key}}`);
}
