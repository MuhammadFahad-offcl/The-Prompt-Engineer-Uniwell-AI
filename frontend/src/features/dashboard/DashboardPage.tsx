import { useEffect, useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import type { CheckIn, Radar } from '../../types/api'
import { RadarCard } from '../pressure-radar/RadarCard'
import { ErrorBanner, PageLoader, Stat, SyntheticBadge } from '../../components/ui'

// Milestone-3 dashboard: greeting + check-in status. Radar, tasks and plan cards are added next.
export function DashboardPage() {
  const { t } = useT()
  const { userId, profile, dataVersion } = useApp()
  const [checkin, setCheckin] = useState<CheckIn | null>(null)
  const [radar, setRadar] = useState<Radar | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [ci, rd] = await Promise.all([api.listCheckIns(userId, 7), api.radar(userId)])
      setCheckin(ci.today)
      setRadar(rd)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dataVersion])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {profile?.nickname ? t('dash.greeting', { name: profile.nickname }) : t('dash.greetingAnon')}
        </h1>
        <p className="text-sm text-muted">{t('dash.sub')}</p>
      </div>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : checkin ? (
        <section className="card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">{t('dash.checkinDone')}</h2>
            {checkin.is_synthetic && <SyntheticBadge />}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t('ins.mood')} value={`${checkin.mood_score}/5`} />
            <Stat label={t('ins.sleep')} value={t(`sleep.${checkin.sleep_quality}`)} />
            <Stat label={t('ins.workload')} value={`${checkin.workload_score}/5`} />
            <Stat label={t('dash.available')} value={`${checkin.available_minutes} min`} />
          </div>
          <button type="button" className="btn-ghost mt-3 px-0" onClick={() => navigate('checkin')}>
            {t('dash.editCheckin')}
          </button>
        </section>
      ) : (
        <section className="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{t('dash.checkinCta')}</h2>
            <p className="text-sm text-muted">{t('ci.subtitle')}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => navigate('checkin')}>
            <SmilePlus className="h-4 w-4" aria-hidden /> {t('dash.checkinCta')}
          </button>
        </section>
      )}
      {!loading && !error && radar && <RadarCard radar={radar} compact />}
    </div>
  )
}
