import { Gauge } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import type { Radar } from '../../types/api'
import { InfoNote, StatusPill } from '../../components/ui'

const BAR_COLORS = {
  manageable: 'bg-mint-500',
  tight: 'bg-warn-700/70',
  over_capacity: 'bg-over-700/80',
  unknown: 'bg-brand-500',
} as const

/** Work-vs-time comparison. Numbers and text carry the meaning; colour is secondary. */
export function RadarCard({ radar, compact = false }: { radar: Radar; compact?: boolean }) {
  const { t } = useT()
  const available = radar.available_minutes ?? 0
  const scale = Math.max(radar.due_soon_minutes, available, 1)
  const workPct = Math.round((radar.due_soon_minutes / scale) * 100)
  const timePct = Math.round((available / scale) * 100)

  return (
    <section className="card" aria-labelledby="radar-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="radar-title" className="flex items-center gap-2 font-semibold">
            <Gauge className="h-4.5 w-4.5 text-brand-600" aria-hidden /> {t('radar.title')}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{t('radar.subtitle')}</p>
        </div>
        <StatusPill status={radar.status} size="lg" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-canvas p-2.5">
          <p className="text-[11px] font-medium text-muted">{t('radar.dueSoon')}</p>
          <p className="text-xl font-bold">{radar.due_soon_minutes}<span className="text-xs font-medium text-muted"> min</span></p>
        </div>
        <div className="rounded-xl bg-canvas p-2.5">
          <p className="text-[11px] font-medium text-muted">{t('radar.available')}</p>
          <p className="text-xl font-bold">
            {radar.available_minutes ?? '—'}
            {radar.available_minutes !== null && <span className="text-xs font-medium text-muted"> min</span>}
          </p>
        </div>
        <div className="rounded-xl bg-canvas p-2.5">
          <p className="text-[11px] font-medium text-muted">{t('radar.ratio')}</p>
          <p className="text-xl font-bold">{radar.workload_ratio !== null ? radar.workload_ratio.toFixed(2) : '—'}</p>
        </div>
      </div>

      {radar.available_minutes !== null && (
        <div className="mt-4 space-y-2" aria-hidden>
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-muted">
              <span>{t('radar.dueSoon')}</span>
              <span>{radar.due_soon_minutes} min</span>
            </div>
            <div className="h-2.5 rounded-full bg-line/70">
              <div className={`h-2.5 rounded-full ${BAR_COLORS[radar.status]}`} style={{ width: `${workPct}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-muted">
              <span>{t('radar.available')}</span>
              <span>{available} min</span>
            </div>
            <div className="h-2.5 rounded-full bg-line/70">
              <div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${timePct}%` }} />
            </div>
          </div>
        </div>
      )}

      {!compact && (
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-muted">{t('radar.overdue')}</dt>
            <dd className="font-semibold">{radar.overdue_minutes} min</dd>
          </div>
          <div>
            <dt className="text-muted">{t('radar.today')}</dt>
            <dd className="font-semibold">{radar.due_today_minutes} min</dd>
          </div>
          <div>
            <dt className="text-muted">{t('radar.next48')}</dt>
            <dd className="font-semibold">{radar.later_48h_minutes} min</dd>
          </div>
        </dl>
      )}

      <p className="mt-4 text-sm text-ink/90">{radar.explanation}</p>
      {radar.available_minutes === null && (
        <button type="button" className="btn-primary mt-3" onClick={() => navigate('checkin')}>
          {t('dash.checkinCta')}
        </button>
      )}
      {compact && (
        <button type="button" className="btn-ghost mt-2 px-0" onClick={() => navigate('radar')}>
          {t('radar.rule')} →
        </button>
      )}
      {!compact && <InfoNote className="mt-3">{radar.rule}</InfoNote>}
    </section>
  )
}
