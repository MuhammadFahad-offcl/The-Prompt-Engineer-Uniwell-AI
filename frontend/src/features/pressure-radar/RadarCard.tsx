import { Gauge as GaugeIcon } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import type { Radar } from '../../types/api'
import { InfoNote, StatusPill } from '../../components/ui'
import { CountUp, Gauge } from '../../components/motion'

const BAR_CLASS = {
  manageable: 'bg-ok-700',
  tight: 'bg-warn-700',
  over_capacity: 'bg-over-700',
  unknown: 'bg-brand-300',
} as const

/** Work-vs-time comparison. Numbers + text label carry the meaning; the gauge and colour are secondary. */
export function RadarCard({ radar, compact = false }: { radar: Radar; compact?: boolean }) {
  const { t } = useT()
  const available = radar.available_minutes ?? 0
  const scale = Math.max(radar.due_soon_minutes, available, 1)
  const workPct = Math.round((radar.due_soon_minutes / scale) * 100)
  const timePct = Math.round((available / scale) * 100)

  return (
    <section className="card overflow-hidden" aria-labelledby="radar-title">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-100/60 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="radar-title" className="flex items-center gap-2 text-base font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <GaugeIcon className="h-4.5 w-4.5" aria-hidden />
            </span>
            {t('radar.title')}
          </h2>
          <p className="mt-1 text-xs text-faint">{t('radar.subtitle')}</p>
        </div>
        <StatusPill status={radar.status} size="lg" />
      </div>

      <div className="relative mt-4 grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center">
          <Gauge ratio={radar.workload_ratio} status={radar.status} size={compact ? 160 : 200} />
          <p className="-mt-2 font-display text-3xl font-extrabold tabular text-ink">
            {radar.workload_ratio !== null ? <CountUp value={radar.workload_ratio} decimals={2} /> : '—'}
          </p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-faint">{t('radar.ratio')}</p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface-alt/70 p-3">
              <p className="text-[11px] font-medium text-faint">{t('radar.dueSoon')}</p>
              <p className="font-display text-2xl font-extrabold text-ink">
                <CountUp value={radar.due_soon_minutes} />
                <span className="text-xs font-semibold text-faint"> min</span>
              </p>
            </div>
            <div className="rounded-2xl bg-surface-alt/70 p-3">
              <p className="text-[11px] font-medium text-faint">{t('radar.available')}</p>
              <p className="font-display text-2xl font-extrabold text-ink">
                {radar.available_minutes !== null ? <CountUp value={radar.available_minutes} /> : '—'}
                {radar.available_minutes !== null && <span className="text-xs font-semibold text-faint"> min</span>}
              </p>
            </div>
          </div>

          {radar.available_minutes !== null && (
            <div className="space-y-2" aria-hidden>
              <div className="h-2 rounded-full bg-surface-alt">
                <div className={`h-2 rounded-full ${BAR_CLASS[radar.status]} transition-[width] duration-1000 ease-out`} style={{ width: `${workPct}%` }} />
              </div>
              <div className="h-2 rounded-full bg-surface-alt">
                <div className="h-2 rounded-full bg-brand-500 transition-[width] duration-1000 ease-out" style={{ width: `${timePct}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-faint">
                <span>▲ {t('radar.dueSoon')}</span>
                <span>▼ {t('radar.available')}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!compact && (
        <dl className="relative mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl border border-line p-2.5">
            <dt className="text-faint">{t('radar.overdue')}</dt>
            <dd className="font-display text-base font-bold">{radar.overdue_minutes} min</dd>
          </div>
          <div className="rounded-xl border border-line p-2.5">
            <dt className="text-faint">{t('radar.today')}</dt>
            <dd className="font-display text-base font-bold">{radar.due_today_minutes} min</dd>
          </div>
          <div className="rounded-xl border border-line p-2.5">
            <dt className="text-faint">{t('radar.next48')}</dt>
            <dd className="font-display text-base font-bold">{radar.later_48h_minutes} min</dd>
          </div>
        </dl>
      )}

      <p className="relative mt-4 text-sm text-ink/90">{radar.explanation}</p>
      {radar.available_minutes === null && (
        <button type="button" className="btn-primary mt-3" onClick={() => navigate('checkin')}>
          {t('dash.checkinCta')}
        </button>
      )}
      {compact && (
        <button type="button" className="link relative mt-3 inline-block text-sm" onClick={() => navigate('radar')}>
          {t('radar.rule')} →
        </button>
      )}
      {!compact && <InfoNote className="mt-3">{radar.rule}</InfoNote>}
    </section>
  )
}
