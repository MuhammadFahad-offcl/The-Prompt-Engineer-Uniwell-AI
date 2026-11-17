import { useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Coffee,
  Cpu,
  HeartHandshake,
  Lightbulb,
  ListRestart,
  MoveRight,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wind,
} from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { formatDate, formatDateTime } from '../../lib/format'
import type { PlanDetail, PlanItem } from '../../types/api'
import { ErrorBanner, StatusPill, SyntheticBadge } from '../../components/ui'

const ITEM_STYLE = {
  study: { Icon: BookOpen, cls: 'bg-brand-50 text-brand-700', key: 'plan.study' },
  break: { Icon: Coffee, cls: 'bg-canvas text-muted', key: 'plan.break' },
  wellbeing: { Icon: Wind, cls: 'bg-mint-50 text-mint-700', key: 'plan.wellbeingItem' },
} as const

export function PlanView({ plan, onItemsChange }: { plan: PlanDetail; onItemsChange: (items: PlanItem[]) => void }) {
  const { t } = useT()
  const c = plan.plan
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const done = plan.items.filter((i) => i.completed).length
  const pct = Math.round((c.total_planned_minutes / Math.max(c.available_minutes, 1)) * 100)

  async function toggle(item: PlanItem) {
    setBusy(item.id)
    setError(null)
    try {
      const updated = await api.setItemCompleted(item.id, !item.completed)
      onItemsChange(plan.items.map((i) => (i.id === updated.id ? updated : i)))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={c.workload_status} />
          {plan.is_synthetic ? (
            <SyntheticBadge />
          ) : (
            <span className="chip bg-brand-50 text-brand-700">
              <Cpu className="h-3 w-3" aria-hidden /> {t('plan.generatedBy', { provider: plan.provider, model: plan.model })}
            </span>
          )}
          {plan.status === 'superseded' && <span className="chip bg-canvas text-muted">Superseded</span>}
          <span className="text-xs text-muted">{formatDate(plan.local_date)} · {formatDateTime(plan.created_at)}</span>
        </div>
        {plan.is_synthetic && <p className="mt-2 text-xs text-warn-700">{t('plan.syntheticRecord')}</p>}
        <h2 className="mt-3 text-xl font-bold tracking-tight">{c.title}</h2>
        <p className="mt-1 text-ink/90">{c.supportive_message}</p>
        <p className="mt-2 text-sm text-muted">{c.workload_summary}</p>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {t('plan.total')} <strong className="text-ink">{c.total_planned_minutes} min</strong> {t('plan.of')} {c.available_minutes} min {t('plan.available')}
            </span>
            <span>{t('plan.progress', { done, total: plan.items.length })}</span>
          </div>
          <div className="h-2 rounded-full bg-line/70" aria-hidden>
            <div className="h-2 rounded-full bg-mint-500" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <span className="chip bg-canvas text-muted">{t('plan.sessionLen', { min: c.constraints.session_minutes })}</span>
          <span className="chip bg-canvas text-muted">{t('plan.maxTasks', { n: c.constraints.max_study_tasks })}</span>
          {c.constraints.buffer_minutes > 0 && <span className="chip bg-canvas text-muted">{t('plan.buffer', { min: c.constraints.buffer_minutes })}</span>}
          {c.constraints.low_energy_mode && <span className="chip bg-mint-50 text-mint-700">{t('plan.lowEnergy')}</span>}
        </div>
      </section>

      {/* Adaptation explanation — the visible proof of the feedback loop */}
      {c.adaptation_explanations.length > 0 && (
        <section className="rounded-2xl border border-mint-500/30 bg-mint-50 p-4" aria-labelledby="adapted-title">
          <h3 id="adapted-title" className="flex items-center gap-2 font-semibold text-mint-700">
            <RefreshCw className="h-4 w-4" aria-hidden /> {t('plan.adapted')}
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-ink/90">
            {c.adaptation_explanations.map((e, i) => (
              <li key={i} className="flex gap-2">
                <MoveRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-700" aria-hidden />
                {e}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline */}
      <section className="card" aria-labelledby="items-title">
        <h3 id="items-title" className="sr-only">
          Plan items
        </h3>
        <ol className="space-y-2">
          {plan.items.map((item) => {
            const s = ITEM_STYLE[item.item_type]
            return (
              <li key={item.id} className={`flex gap-3 rounded-xl border p-3 transition-colors ${item.completed ? 'border-mint-500/30 bg-mint-50/40' : 'border-line'}`}>
                <button
                  type="button"
                  onClick={() => void toggle(item)}
                  disabled={busy === item.id}
                  aria-pressed={item.completed}
                  aria-label={`${item.completed ? 'Mark not done' : 'Mark done'}: ${item.title}`}
                  className="mt-0.5 shrink-0 rounded-full text-mint-500 disabled:opacity-50"
                >
                  {item.completed ? <CheckCircle2 className="h-6 w-6" aria-hidden /> : <Circle className="h-6 w-6 text-line" aria-hidden />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`chip ${s.cls}`}>
                      <s.Icon className="h-3 w-3" aria-hidden /> {t(s.key)}
                    </span>
                    <span className="text-xs font-semibold text-muted">{item.duration_minutes} min</span>
                  </div>
                  <p className={`mt-1 font-semibold break-words ${item.completed ? 'text-muted line-through' : ''}`}>{item.title}</p>
                  {item.task_title_snapshot && item.task_title_snapshot !== item.title && (
                    <p className="text-xs text-muted">Task: {item.task_title_snapshot}</p>
                  )}
                  <p className="mt-1 text-sm text-ink/90">{item.instructions}</p>
                  {item.reason && (
                    <p className="mt-1 text-xs text-muted">
                      <span className="font-semibold">{t('plan.reason')}:</span> {item.reason}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
        {error && (
          <div className="mt-3">
            <ErrorBanner message={error} />
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <h3 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-brand-600" aria-hidden /> {t('plan.why')}
          </h3>
          <p className="mt-2 text-sm text-ink/90">{c.why_this_plan}</p>
        </section>
        <section className="card">
          <h3 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="h-4 w-4 text-warn-700" aria-hidden /> {t('plan.tip')}
          </h3>
          <p className="mt-2 text-sm text-ink/90">{c.study_tip}</p>
        </section>
        <section className="card">
          <h3 className="flex items-center gap-2 font-semibold">
            <Wind className="h-4 w-4 text-mint-500" aria-hidden /> {t('plan.wellbeing')} · {c.wellbeing_activity.duration_minutes} min
          </h3>
          <p className="mt-2 text-sm font-medium">{c.wellbeing_activity.title}</p>
          <p className="mt-1 text-sm text-ink/90">{c.wellbeing_activity.instructions}</p>
          <p className="mt-2 text-xs text-muted">Optional — stop any time if it doesn’t feel right.</p>
        </section>
        <section className="card">
          <h3 className="flex items-center gap-2 font-semibold">
            <ListRestart className="h-4 w-4 text-brand-600" aria-hidden /> {t('plan.fallback')}
          </h3>
          <p className="mt-2 text-sm text-ink/90">{c.fallback_plan}</p>
        </section>
      </div>

      {c.deferred_tasks.length > 0 && (
        <section className="card" aria-labelledby="deferred-title">
          <h3 id="deferred-title" className="font-semibold">
            {t('plan.deferred')}
          </h3>
          <ul className="mt-2 divide-y divide-line">
            {c.deferred_tasks.map((d, i) => (
              <li key={`${d.task_id}-${i}`} className="py-2 text-sm">
                <p className="font-medium">{d.title}</p>
                <p className="text-muted">
                  {d.reason}
                  {d.suggested_review_date && <> · Review {formatDate(d.suggested_review_date)}</>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <blockquote className="flex items-start gap-3 rounded-2xl bg-brand-900 p-5 text-white">
        <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-mint-100" aria-hidden />
        <p className="text-base font-medium">{c.affirmation}</p>
      </blockquote>

      {(c.repairs.length > 0 || c.missing_info.length > 0) && (
        <section className="rounded-2xl border border-line bg-surface/70 p-4 text-xs text-muted">
          {c.repairs.length > 0 && (
            <>
              <p className="flex items-center gap-1 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {t('plan.repairs')}
              </p>
              <ul className="mt-1 list-disc pl-5">
                {c.repairs.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
          {c.missing_info.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {c.missing_info.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
