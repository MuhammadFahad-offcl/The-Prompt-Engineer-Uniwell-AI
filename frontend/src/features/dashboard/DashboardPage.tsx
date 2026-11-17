import { useEffect, useState } from 'react'
import { ArrowRight, CalendarClock, CheckCircle2, Clock, MessageSquareHeart, Plus, SmilePlus, Sparkles } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import { formatDeadline, formatMinutes } from '../../lib/format'
import { SERIES_COLOR } from '../../lib/theme'
import { useMagnet } from '../../lib/motion'
import type { CheckIn, Insights, PlanSummary, Radar } from '../../types/api'
import { ErrorBanner, PageLoader, Stat, StatusPill, SyntheticBadge } from '../../components/ui'
import { RadarCard } from '../pressure-radar/RadarCard'
import { TrendChart } from '../insights/TrendChart'

interface DashData {
  checkin: CheckIn | null
  radar: Radar
  latestPlan: PlanSummary | null
  insights: Insights
}

export function DashboardPage() {
  const { t } = useT()
  const { userId, profile, health, dataVersion } = useApp()
  const [data, setData] = useState<DashData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctaRef = useMagnet<HTMLButtonElement>(5)

  async function load() {
    if (!userId) return
    setError(null)
    try {
      const [ci, radar, plans, insights] = await Promise.all([
        api.listCheckIns(userId, 7),
        api.radar(userId),
        api.listPlans(userId),
        api.insights(userId),
      ])
      setData({ checkin: ci.today, radar, latestPlan: plans.items[0] ?? null, insights })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dataVersion])

  const greeting = profile?.nickname ? t('dash.greeting', { name: profile.nickname }) : t('dash.greetingAnon')

  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />
  if (!data) return <PageLoader />

  const { checkin, radar, latestPlan, insights } = data
  const dueSoon = radar.ranked_tasks.filter((r) => r.bucket !== 'later').slice(0, 4)

  return (
    <div className="enter-stagger space-y-4 lg:space-y-5">
      <div>
        <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 text-[1.75rem] tracking-tight lg:text-[2rem]">{greeting}</h1>
        <p className="text-sm text-muted">{t('dash.sub')}</p>
      </div>

      {/* 1. Check-in */}
      {checkin ? (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4.5 w-4.5 text-mint-500" aria-hidden /> {t('dash.checkinDone')}
            </h2>
            <div className="flex items-center gap-2">
              {checkin.is_synthetic && <SyntheticBadge />}
              <button type="button" className="btn-ghost whitespace-nowrap px-2 py-1" onClick={() => navigate('checkin')}>
                {t('dash.editCheckin')}
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label={t('ins.mood')} value={`${checkin.mood_score}/5`} />
            <Stat label={t('ins.sleep')} value={t(`sleep.${checkin.sleep_quality}`)} />
            <Stat label={t('ins.workload')} value={`${checkin.workload_score}/5`} />
            <Stat label={t('ins.energy')} value={checkin.energy_score ? `${checkin.energy_score}/5` : '—'} />
            <Stat label={t('dash.available')} value={formatMinutes(checkin.available_minutes)} />
          </div>
        </section>
      ) : (
        <section className="card flex flex-col items-start gap-3 border-brand-200 bg-brand-50/50 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{t('dash.checkinCta')}</h2>
            <p className="text-sm text-muted">{t('ci.subtitle')}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => navigate('checkin')}>
            <SmilePlus className="h-4 w-4" aria-hidden /> {t('dash.checkinCta')}
          </button>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 2. Radar */}
        <RadarCard radar={radar} compact />

        {/* 3. Tasks due soon */}
        <section className="card" aria-labelledby="due-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="due-title" className="flex items-center gap-2 font-semibold">
              <CalendarClock className="h-4.5 w-4.5 text-brand-600" aria-hidden /> {t('dash.dueSoon')}
            </h2>
            <button type="button" className="btn-ghost px-2 py-1" onClick={() => navigate('tasks')}>
              {radar.pending_count ? t('common.viewAll') : t('dash.addTask')}
            </button>
          </div>
          {dueSoon.length === 0 ? (
            <div className="mt-3 text-sm text-muted">
              <p>{t('dash.noTasks')}</p>
              <button type="button" className="btn-secondary mt-3" onClick={() => navigate('tasks')}>
                <Plus className="h-4 w-4" aria-hidden /> {t('dash.addTask')}
              </button>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {dueSoon.map((r) => (
                <li key={r.task_id} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-surface-hover">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-500 font-display text-xs font-bold text-surface">{r.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <p className={`text-xs ${r.bucket === 'overdue' ? 'font-semibold text-over-700' : 'text-muted'}`}>
                      {r.bucket === 'overdue' ? `${t('tasks.overdue')} · ` : ''}
                      {formatDeadline(r.deadline)} · {formatMinutes(r.estimated_minutes)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 4. Generate CTA */}
      <section className="relative isolate flex flex-col gap-4 overflow-hidden rounded-[24px] bg-brand-900 p-6 text-surface shadow-[var(--shadow-glow)] sm:flex-row sm:items-center sm:justify-between">
        <div className="aurora opacity-80" aria-hidden>
          <div className="aurora-blob b" />
          <div className="aurora-blob c" />
        </div>
        <div className="relative">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <Sparkles className="h-5 w-5 text-mint-400" aria-hidden /> {t('dash.generate')}
          </h2>
          <p className="mt-1 text-sm text-surface/75">
            Live AI · {profile?.effective_session_minutes} min study blocks
            {profile?.adapted_session_minutes ? ' (adapted from your feedback)' : ''}
            {health && !health.ai.configured ? ' · AI provider not configured' : ''}
          </p>
        </div>
        <button
          ref={ctaRef}
          type="button"
          className="btn relative bg-surface px-5 py-3 text-brand-900 shadow-[var(--shadow-md)] hover:bg-mint-50"
          onClick={() => navigate(checkin ? 'plan' : 'checkin')}
        >
          {checkin ? t('dash.generate') : t('dash.checkinCta')} <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 5. Latest plan */}
        <section className="card" aria-labelledby="latest-title">
          <h2 id="latest-title" className="font-semibold">
            {t('dash.latestPlan')}
          </h2>
          {latestPlan ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{latestPlan.title}</p>
                {latestPlan.is_synthetic && <SyntheticBadge />}
              </div>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden /> {latestPlan.total_planned_minutes} min · {latestPlan.items_completed}/{latestPlan.items_total} done
              </p>
              <p className={`mt-2 flex items-center gap-1.5 text-sm ${latestPlan.feedback ? 'text-ok-700' : 'text-warn-700'}`}>
                <MessageSquareHeart className="h-4 w-4" aria-hidden />
                {latestPlan.feedback ? t('dash.feedbackDone') : t('dash.feedbackPending')}
              </p>
              <button type="button" className="btn-secondary mt-3" onClick={() => navigate(`plan/${latestPlan.id}`)}>
                {t('dash.openPlan')}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">{t('dash.noPlan')}</p>
          )}
        </section>

        {/* 6. Trend preview */}
        <section className="card" aria-labelledby="trend-title">
          <div className="flex items-center justify-between">
            <h2 id="trend-title" className="font-semibold">
              {t('dash.trend')}
            </h2>
            <button type="button" className="btn-ghost px-2 py-1" onClick={() => navigate('insights')}>
              {t('nav.insights')} →
            </button>
          </div>
          {insights.checkins_7d === 0 ? (
            <p className="mt-2 text-sm text-muted">{t('ins.empty', { n: insights.min_records_for_statements })}</p>
          ) : (
            <div className="mt-2">
              <TrendChart days={insights.days} metric="mood" title={t('ins.mood')} color={SERIES_COLOR} height={130} showTable={false} />
              <p className="mt-1 text-xs text-muted">{insights.checkins_7d} of 7 days checked in · self-reported, not an assessment</p>
            </div>
          )}
          {radar.status !== 'unknown' && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">
              Today’s workload: <StatusPill status={radar.status} />
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
