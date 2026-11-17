import { useEffect, useState } from 'react'
import { BarChart3, MessageSquareQuote } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import type { Insights } from '../../types/api'
import { EmptyState, ErrorBanner, InfoNote, PageHeader, PageLoader, Stat, SyntheticBadge } from '../../components/ui'
import { SleepChart, TrendChart } from './TrendChart'

import { SERIES_COLOR } from '../../lib/theme'

export function InsightsPage() {
  const { t } = useT()
  const { userId, dataVersion } = useApp()
  const [data, setData] = useState<Insights | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!userId) return
    setError(null)
    try {
      setData(await api.insights(userId))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dataVersion])

  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />
  if (!data) return <PageLoader />

  const hasEnergy = data.days.some((d) => d.energy !== null)

  return (
    <div className="space-y-4">
      <PageHeader title={t('ins.title')} subtitle={t('ins.subtitle')} actions={data.synthetic_records_present ? <SyntheticBadge /> : undefined} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('ins.checkins')} value={`${data.checkins_7d} / 7`} />
        <Stat label={t('ins.plans')} value={data.plans_generated_7d} />
        <Stat label={`${t('ins.tasks')}: ${t('ins.completed')}`} value={data.task_summary.completed} hint={`${data.task_summary.completed_last_7_days} in the last 7 days`} />
        <Stat label={`${t('ins.tasks')}: ${t('ins.pending')}`} value={data.task_summary.pending} hint={data.task_summary.overdue ? `${data.task_summary.overdue} overdue` : undefined} />
      </div>

      <section className="card">
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageSquareQuote className="h-4.5 w-4.5 text-brand-600" aria-hidden /> What you reported
        </h2>
        {data.statements.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('ins.empty', { n: data.min_records_for_statements })}</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {data.statements.map((s, i) => (
              <li key={i}>
                {s.text} <span className="text-xs text-muted">(n = {s.sample_size})</span>
              </li>
            ))}
          </ul>
        )}
        <InfoNote className="mt-3">Self-reported values only. These summaries describe what you entered; they don’t explain causes and are not an assessment.</InfoNote>
      </section>

      {data.checkins_7d === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title={t('ins.empty', { n: data.min_records_for_statements })}
          action={
            <button type="button" className="btn-primary" onClick={() => navigate('checkin')}>
              {t('dash.checkinCta')}
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card">
            <TrendChart days={data.days} metric="mood" title={t('ins.mood')} color={SERIES_COLOR} />
          </section>
          <section className="card">
            <SleepChart days={data.days} title={t('ins.sleep')} color={SERIES_COLOR} />
          </section>
          <section className="card">
            <TrendChart days={data.days} metric="workload" title={t('ins.workload')} color={SERIES_COLOR} />
          </section>
          {hasEnergy && (
            <section className="card">
              <TrendChart days={data.days} metric="energy" title={t('ins.energy')} color={SERIES_COLOR} />
            </section>
          )}
        </div>
      )}

      <section className="card">
        <h2 className="font-semibold">{t('ins.ratings')}</h2>
        {data.feedback_summary ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Rated plans" value={data.feedback_summary.count} />
            <Stat label={t('fb.manageable')} value={`${data.feedback_summary.avg_manageable} / 5`} />
            <Stat label={t('fb.helpful')} value={`${data.feedback_summary.avg_helpful} / 5`} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{t('ins.noRatings')}</p>
        )}
      </section>
    </div>
  )
}
