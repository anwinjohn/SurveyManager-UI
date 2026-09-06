import type { ReactNode } from 'react';

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div
        className="border-2 border-slate-200 border-t-sky-500 rounded-full animate-spin"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'badge-green',
    draft: 'badge-slate',
    paused: 'badge-amber',
    closed: 'badge-red',
    archived: 'badge-slate',
    pending: 'badge-amber',
    sent: 'badge-sky',
    responded: 'badge-green',
    expired: 'badge-slate',
    'opted-out': 'badge-red',
    invited: 'badge-amber',
    suspended: 'badge-red',
    revoked: 'badge-red',
  };
  const cls = map[status] || 'badge-slate';
  const dotColors: Record<string, string> = {
    active: 'bg-green-500',
    draft: 'bg-slate-400',
    paused: 'bg-amber-500',
    closed: 'bg-red-500',
    pending: 'bg-amber-500',
    sent: 'bg-sky-500',
    responded: 'bg-green-500',
    expired: 'bg-slate-400',
    'opted-out': 'bg-red-500',
    invited: 'bg-amber-500',
    suspended: 'bg-red-500',
    revoked: 'bg-red-500',
  };
  return (
    <span className={cls}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status] || 'bg-slate-400'}`} />
      <span className="capitalize">{status.replace('-', ' ')}</span>
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="text-sm text-slate-400 mt-1 max-w-sm">{description}</p>
    </div>
  );
}

export function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} bg-white rounded-2xl shadow-xl border border-slate-200 my-8 animate-slide-up`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold font-display text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-sky-500' : 'bg-slate-200'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

export function ProgressBar({ value, max, color = 'bg-sky-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}
