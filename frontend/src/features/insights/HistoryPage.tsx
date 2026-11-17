import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT } from '../../lib/i18n'
import { formatDate, formatDateTime } from '../../lib/format'
import type { CheckIn, PlanHistory } from '../../types/api'
import { ErrorBanner, PageHeader, PageLoader, SyntheticBadge } from '../../components/ui'

export function HistoryPage() {
  const { t } = useT()
  const { userId, dataVersion } = useApp()
  const [checkins, setCheckins] = useState<CheckIn[] | null>(null)
  const [plans, setPlans] = useState<PlanHistory | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!userId) return
    setError(null)
    try {
      const [c, p] = await Promise.all([api.listCheckIns(userId, 30), api.listPlans(userId)])
      setCheckins(c.items)
      setPlans(p)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dataVersion])

  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />
  if (!checkins || !plans) return <PageLoader />

  return (
    <div className="space-y-4">
      <PageHeader title={t('hist.title')} subtitle={t('hist.subtitle')} />

      <section className="card" aria-labelledby="h-plans">
        <h2 id="h-plans" className="font-semibold">
          {t('hist.plans')}
        </h2>
        {plans.items.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('hist.noPlans')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {plans.items.map((p) => (
              <li key={p.id}>
                <a href={`#/plan/${p.id}`} className="flex items-center gap-3 py-3 hover:bg-canvas">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-words">{p.title}</p>
                      {p.is_synthetic && <SyntheticBadge />}
                      {p.status === 'superseded' && <span className="chip bg-canvas text-muted">Superseded</span>}
                    </div>
                    <p className="text-xs text-muted">
                      {formatDateTime(p.created_at)} · {p.total_planned_minutes} min · {p.items_completed}/{p.items_total} done ·{' '}
                      {p.feedback ? `manageable ${p.feedback.manageable_rating}/5, helpful ${p.feedback.helpfulness_rating}/5` : 'no feedback yet'}
                      {!p.is_synthetic && ` · ${p.provider}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="h-adapt">
        <h2 id="h-adapt" className="font-semibold">
          {t('hist.adaptations')}
        </h2>
        {plans.adaptation_events.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('hist.noAdaptations')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {plans.adaptation_events.map((e) => (
              <li key={e.id} className="rounded-xl bg-canvas p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-mono">{e.rule_applied}</span>
                  {e.previous_value !== null && e.new_value !== null && e.previous_value !== e.new_value && (
                    <span className="font-mono">
                      {e.previous_value} → {e.new_value}
                    </span>
                  )}
                  <span>{formatDateTime(e.created_at)}</span>
                  {e.is_synthetic && <SyntheticBadge />}
                </div>
                <p className="mt-1">{e.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="h-checkins">
        <h2 id="h-checkins" className="font-semibold">
          {t('hist.checkins')}
        </h2>
        {checkins.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('hist.noCheckins')}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Mood</th>
                  <th className="py-2 font-medium">Sleep</th>
                  <th className="py-2 font-medium">Workload</th>
                  <th className="py-2 font-medium">Energy</th>
                  <th className="py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-2">
                      {formatDate(c.local_date)}
                      {c.is_synthetic && <span className="ml-1 text-xs text-warn-700">(synthetic)</span>}
                    </td>
                    <td className="py-2">{c.mood_score}/5</td>
                    <td className="py-2">{t(`sleep.${c.sleep_quality}`)}</td>
                    <td className="py-2">{c.workload_score}/5</td>
                    <td className="py-2">{c.energy_score ? `${c.energy_score}/5` : '—'}</td>
                    <td className="py-2">{c.available_minutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
