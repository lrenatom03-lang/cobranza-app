export type Currency = 'PEN' | 'USD';

export interface Client {
  id: string;
  docId?: string;
  name: string;
  email?: string;
  phone?: string;
  creditTermDays: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  number: string;
  amount: number;
  currency: Currency;
  issueDate: string;
  dueDate: string;
  paidAt?: string | null;
  paymentLink?: string | null;
  source?: 'demo' | 'import' | 'manual';
}

export type Channel = 'whatsapp' | 'llamada' | 'email' | 'otro';
export type ActionResult =
  | 'contactado'
  | 'no_contactado'
  | 'pagara'
  | 'solicita_plazo'
  | 'solicita_fraccionamiento'
  | 'rechaza'
  | 'otro';

export interface CollectionAction {
  id: string;
  clientId: string;
  invoiceId: string;
  channel: Channel;
  result: ActionResult;
  note?: string;
  date: string;
}

export type PromiseStatus = 'registrada' | 'cumplida' | 'incumplida' | 'reprogramada';

export interface PaymentPromise {
  id: string;
  clientId: string;
  invoiceId: string;
  amount: number;
  currency: Currency;
  promisedDate: string;
  method: string;
  note?: string;
  status: PromiseStatus;
  createdAt: string;
  origin: 'gestor' | 'cliente';
}

export interface Weights {
  urgencia: number;
  monto: number;
  atraso: number;
  historial: number;
  concentracion: number;
  penalPromesaActiva: number;
  bonoPromesaIncumplida: number;
}

export interface Settings {
  businessName: string;
  exchangeRate: number;
  paymentInfo: string;
  paymentLink: string;
  weights: Weights;
  bands: { critico: number; riesgo: number; atencion: number };
}

export interface DB {
  clients: Client[];
  invoices: Invoice[];
  actions: CollectionAction[];
  promises: PaymentPromise[];
  settings: Settings;
  meta: { seededAt: string; nextId: number };
}
