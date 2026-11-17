import { useEffect, useState } from 'react'
import { ListChecks, Plus } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT, type TKey } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import { formatDeadline, formatMinutes } from '../../lib/format'
import type { Radar, RadarBucket } from '../../types/api'
import { EmptyState, ErrorBanner, PageHeader, PageLoader } from '../../components/ui'
import { RadarCard } from './RadarCard'

const BUCKET_LABEL: Record<RadarBucket, TKey> = {
  overdue: 'radar.overdue',
  today: 'radar.today',
  next_48h: 'radar.next48',
  later: 'radar.later',
}
const BUCKET_STYLE: Record<RadarBucket, string> = {
  overdue: 'bg-over-50 text-over-700',
  today: 'bg-warn-50 text-warn-700',
  next_48h: 'bg-brand-50 text-brand-700',
  later: 'bg-canvas text-muted',
}

export function RadarPage() {
  const { t } = useT()
  const { userId, dataVersion } = useApp()
  const [radar, setRadar] = useState<Radar | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!userId) return
    setError(null)
    try {
      setRadar(await api.radar(userId))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dataVersion])

  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />
  if (!radar) return <PageLoader />

  return (
    <div className="space-y-4">
      <PageHeader title={t('radar.title')} subtitle={t('radar.subtitle')} />
      <RadarCard radar={radar} />

      <section className="card" aria-labelledby="order-title">
        <h2 id="order-title" className="font-semibold">
          {t('radar.order')}
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Overdue → nearest deadline → your priority → shorter task first. The same inputs always give the same order.
        </p>
        {radar.ranked_tasks.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<ListChecks className="h-7 w-7" />}
              title={t('tasks.empty')}
              body={t('dash.noTasks')}
              action={
                <button type="button" className="btn-primary" onClick={() => navigate('tasks')}>
                  <Plus className="h-4 w-4" aria-hidden /> {t('dash.addTask')}
                </button>
              }
            />
          </div>
        ) : (
          <ol className="mt-4 space-y-2">
            {radar.ranked_tasks.map((rt) => (
              <li key={rt.task_id} className="flex items-start gap-3 rounded-xl border border-line p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {rt.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold break-words">{rt.title}</p>
                    <span className={`chip ${BUCKET_STYLE[rt.bucket]}`}>{t(BUCKET_LABEL[rt.bucket])}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {formatDeadline(rt.deadline)} · {formatMinutes(rt.estimated_minutes)} · {t('tasks.fPriority')}: {t(`priority.${rt.priority}`)}
                  </p>
                  <p className="mt-1 text-xs text-muted">{rt.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
