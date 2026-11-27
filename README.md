# Asistente de Cobranza — MVP

Mini app web para emprendedores y PYMES que convierte la cartera de cuentas por cobrar en una agenda de acciones priorizadas:

**DATOS → INSIGHT → PRIORIDAD → ACCIÓN → SEGUIMIENTO → RESULTADO**

## Funcionalidades del MVP

- **Mi gestión de hoy**: cartera agrupada en 🔴 Prioridad alta / 🟠 Gestionar hoy / 🟡 Seguimiento / 🟢 Preventivo, con acción recomendada por cliente.
- **Motor de priorización por reglas** (configurable y explicable, no IA): score = urgencia 35 + monto 30 + atraso 20 + historial 10 + concentración 5, con penalización por promesa activa (−15) y bono por promesa incumplida (+25).
- **Clientes y facturas** con estados derivados por fecha (por vencer / próximo a vencer ≤7d / vencida / pagada), aging por tramos (1-15, 16-30, 31-60, 61-90, +90), doble moneda PEN/USD.
- **Gestiones de cobranza**: canal, resultado, observación, en 3 pasos.
- **Promesas de pago**: estados registrada / próxima / cumplida / incumplida / reprogramada; el incumplimiento escala la prioridad automáticamente.
- **Mensajes de cobranza**: 6 plantillas editables con variables + envío manual (copiar / WhatsApp / email / llamada).
- **Alertas accionables** (7 tipos, cada una con acción sugerida).
- **Resumen ejecutivo** con vista Jefatura y Gerencia: KPIs de cartera, riesgo, gestión y resultado, morosidad por tramos.
- **Importador CSV/Excel** con mapeo automático de columnas (`cliente, ID, precio, cantidad, fecha de entrega, fecha de pago (vencimiento), moneda opcional`), validación y previsualización.
- **Configuración**: datos de pago del negocio, tipo de cambio, pesos del motor y umbrales de bandas.

## Cómo ejecutarlo

```bash
npm install
npm run dev        # http://localhost:3000
```

La primera ejecución genera datos de demostración (120 clientes, ~630 facturas) para validar el flujo completo. Desde **Configuración** puedes regenerarlos, y desde **Importar** cargar tus facturas reales (exporta tu Excel a CSV).

### Persistencia

- **Local** (sin configuración): archivo `data/db.json`.
- **Nube** (Vercel + Neon/Supabase): define la variable de entorno `DATABASE_URL` con la cadena de conexión Postgres; la app crea su tabla (`app_state`) y siembra datos demo automáticamente al primer arranque.

## Arquitectura

- Next.js 14 (App Router) + TypeScript, CSS propio (sin dependencias extra).
- Persistencia: `data/db.json` vía capa `lib/db.ts` (interfaz lista para migrar a PostgreSQL/Supabase).
- Motor de reglas y KPIs: `lib/engine.ts` (funciones puras, sin dependencias de infraestructura).
- API: `app/api/*` (state, actions, invoices, promises, clients, import, settings, seed).

## Evolución prevista (no incluida en el MVP)

1. Mini-portal autogestionable del cliente (compromisos de pago / link de pago) y luego bot de WhatsApp Business API.
2. Pasarela de pago (campo `payment_link` ya existe por factura).
3. Persistencia en PostgreSQL gestionado + autenticación multi-tenant (RLS).
4. Envío automático de recordatorios, planes de cuotas, permisos multiusuario, APIs de ERP.
