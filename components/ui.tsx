'use client';

import type { ReactNode } from 'react';
import type { Band } from '@/lib/engine';
import { BAND_META } from '@/lib/engine';

export function BandBadge({ band }: { band: Band }) {
  const m = BAND_META[band];
  return <span className={`badge ${band}`}>{m.emoji} {m.label}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const label = ({ pagada: 'Pagada', por_vencer: 'Por vencer', proximo: 'Próximo a vencer', vencida: 'Vencida' } as Record<string, string>)[status] ?? status;
  return <span className={`badge ${status}`}>{label}</span>;
}

export function PromisePill({ status }: { status: string }) {
  const label = ({ registrada: 'Registrada', proxima: 'Próxima a vencer', cumplida: 'Cumplida', incumplida: 'Incumplida', reprogramada: 'Reprogramada' } as Record<string, string>)[status] ?? status;
  return <span className={`badge ${status}`}>{label}</span>;
}

export function Score({ value, band }: { value: number; band: Band }) {
  return <span className={`score ${band}`} title="Score de gestión">{value}</span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function KpiCard({ k, v, s }: { k: string; v: ReactNode; s?: ReactNode }) {
  return (
    <div className="card">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {s ? <div className="s">{s}</div> : null}
    </div>
  );
}

export function Loading() {
  return <p style={{ color: 'var(--muted)' }}>Cargando datos…</p>;
}

export function ErrorBox({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="warn">
      No se pudieron cargar los datos ({msg}).{' '}
      <button className="btn small secondary" onClick={onRetry}>Reintentar</button>
    </div>
  );
}
