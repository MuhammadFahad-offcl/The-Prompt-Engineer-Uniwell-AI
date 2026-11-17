import type { ReactNode } from 'react'
import { AlertTriangle, BatteryLow, CheckCircle2, HeartHandshake, LifeBuoy, Scale, Waves } from 'lucide-react'
import type { MBSafety, MBState } from '../../types/api'

export const STATE_STYLE: Record<MBState, { cls: string; Icon: typeof Scale; label: string }> = {
  balanced: { cls: 'bg-ok-50 text-ok-700 border-ok-700/20', Icon: CheckCircle2, label: 'Balanced' },
  elevated_stress: { cls: 'bg-warn-50 text-warn-700 border-warn-700/25', Icon: Waves, label: 'Elevated stress' },
  low_energy: { cls: 'bg-brand-50 text-brand-700 border-brand-200', Icon: BatteryLow, label: 'Low energy' },
  overloaded: { cls: 'bg-over-50 text-over-700 border-over-700/20', Icon: AlertTriangle, label: 'Overloaded' },
  recovery_recommended: { cls: 'bg-mint-50 text-mint-700 border-mint-400/40', Icon: LifeBuoy, label: 'Recovery recommended' },
}

/** State is always icon + text, never colour alone. */
export function StateBadge({ state, size = 'md' }: { state: MBState; size?: 'md' | 'lg' }) {
  const { cls, Icon, label } = STATE_STYLE[state]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${cls} ${size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs'}`}>
      <Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden /> {label}
    </span>
  )
}

/** 1–10 rating slider with visible value and accessible value text. */
export function Scale10({
  id,
  label,
  value,
  onChange,
  low,
  high,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  low: string
  high: string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="field-label mb-0">
          {label}
        </label>
        <span className="font-display text-2xl font-extrabold tabular text-brand-700">
          {value}
          <span className="text-sm font-semibold text-faint">/10</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${value} out of 10`}
        className="h-11 w-full cursor-pointer accent-brand-600"
      />
      <div className="flex justify-between text-[11px] text-faint">
        <span>1 · {low}</span>
        <span>10 · {high}</span>
      </div>
    </div>
  )
}

export function SafetyPanel({ safety }: { safety: MBSafety }) {
  return (
    <section role="alert" className="card border-brand-200 bg-gradient-to-br from-brand-50 to-surface">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-900">
        <HeartHandshake className="h-5 w-5" aria-hidden /> {safety.title}
      </h2>
      <p className="mt-2 text-ink/90">{safety.message}</p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
        {safety.actions.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
      {safety.contacts.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {safety.contacts.map((c) => (
            <li key={c.name} className="font-semibold">
              {c.name}
              {c.phone && <> · {c.phone}</>}
              {c.region && <span className="font-normal text-muted"> ({c.region})</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs font-semibold text-over-700">{safety.not_emergency_service}</p>
    </section>
  )
}

export function Panel({ title, icon, children, action }: { title: string; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          {icon && <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export const PRIVATE_NOTE = 'Private: encrypted on the server, visible only to you, and never sent to the AI.'
