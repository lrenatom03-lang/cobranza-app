'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Mi gestión de hoy', icon: '🎯' },
  { href: '/clientes', label: 'Clientes', icon: '👥' },
  { href: '/facturas', label: 'Facturas', icon: '📄' },
  { href: '/promesas', label: 'Promesas', icon: '🤝' },
  { href: '/alertas', label: 'Alertas', icon: '🔔' },
  { href: '/resumen', label: 'Resumen', icon: '📊' },
  { href: '/importar', label: 'Importar', icon: '📥' },
  { href: '/configuracion', label: 'Configuración', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="logo">
        Asistente de Cobranza
        <small>Gestión inteligente de cartera</small>
      </div>
      <nav>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
            <span>{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="foot">MVP · Clasificación por reglas configurables</div>
    </aside>
  );
}
