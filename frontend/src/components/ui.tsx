import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleAlert, FlaskConical, Gauge, Info, Loader2, TrendingUp } from 'lucide-react'
import type { WorkloadStatus } from '../types/api'
import { useT } from '../lib/i18n'

export function Spinner({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 text-sm text-muted ${className}`}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label ?? 'Loading…'}
    </span>
  )
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="space-y-3" aria-busy="true">
      <Spinner label={label} />
      <div className="skeleton h-24 rounded-2xl" />
      <div className="skeleton h-40 rounded-2xl" />
    </div>
  )
}

export function ErrorBanner({ message, onRetry, title }: { message: string; onRetry?: () => void; title?: string }) {
  const { t } = useT()
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-over-700/20 bg-over-50 p-4 text-sm">
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-over-700" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-over-700">{title}</p>}
        <p className="text-ink break-words">{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-secondary mt-3 px-3 py-1.5">
            {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  )
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-ok-700/20 bg-ok-50 p-4 text-sm text-ok-700">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function InfoNote({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-start gap-2 text-xs text-muted ${className}`}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong bg-surface/70 px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SyntheticBadge({ className = '' }: { className?: string }) {
  const { t } = useT()
  return (
    <span className={`chip border border-warn-700/25 bg-warn-50 text-warn-700 ${className}`}>
      <FlaskConical className="h-3 w-3" aria-hidden />
      {t('synthetic.badge')}
    </span>
  )
}

const STATUS_STYLES: Record<WorkloadStatus, { cls: string; Icon: typeof Gauge }> = {
  manageable: { cls: 'bg-ok-50 text-ok-700 border-ok-700/20', Icon: CheckCircle2 },
  tight: { cls: 'bg-warn-50 text-warn-700 border-warn-700/25', Icon: TrendingUp },
  over_capacity: { cls: 'bg-over-50 text-over-700 border-over-700/20', Icon: AlertTriangle },
  unknown: { cls: 'bg-brand-50 text-brand-700 border-brand-200', Icon: Gauge },
}

/** Workload status always shows an icon + text label, never colour alone. */
export function StatusPill({ status, size = 'md' }: { status: WorkloadStatus; size?: 'md' | 'lg' }) {
  const { t } = useT()
  const { cls, Icon } = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${cls} ${
        size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      <Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden />
      {t(`radar.${status}` as const)}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl tracking-tight text-ink lg:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Accessible radio-group of pill buttons, used for 1–5 scales and small choices. */
export function ChoiceGroup<T extends string | number>({
  label,
  hint,
  options,
  value,
  onChange,
  name,
  columns,
}: {
  label: string
  hint?: string
  options: { value: T; label: string; sub?: string; icon?: ReactNode }[]
  value: T | null
  onChange: (v: T) => void
  name: string
  columns?: number
}) {
  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      {hint && <p className="-mt-1 mb-2 text-xs text-muted">{hint}</p>}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const active = value === o.value
          return (
            <label
              key={String(o.value)}
              className={`relative flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-2xl border px-1.5 py-2.5 text-center transition-all duration-200 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-200 ${
                active
                  ? 'border-transparent bg-gradient-to-br from-brand-600 to-brand-500 text-surface shadow-[var(--shadow-glow)]'
                  : 'border-line bg-surface text-ink hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-hover'
              }`}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={active}
                onChange={() => onChange(o.value)}
              />
              {o.icon && <span className={`mb-1 ${active ? 'check-pop' : 'text-brand-600'}`}>{o.icon}</span>}
              <span className="text-sm font-semibold leading-tight">{o.label}</span>
              {o.sub && <span className={`mt-0.5 text-[11px] leading-tight ${active ? 'text-surface/85' : 'text-faint'}`}>{o.sub}</span>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-surface-alt/60 px-3.5 py-3">
      <p className="text-xs font-medium text-faint">{label}</p>
      <p className="tabular mt-0.5 font-display text-xl font-extrabold text-ink">{value}</p>
      {hint && <p className="text-[11px] text-faint">{hint}</p>}
    </div>
  )
}
