import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from './lib/api'
import { AppContext, type AppState } from './lib/appState'
import { I18nContext, translate } from './lib/i18n'
import { navigate, useRoute } from './lib/router'
import { cacheLanguage, clearSession, getCachedLanguage, getUserId } from './lib/session'
import type { Health, Language, Profile } from './types/api'
import { Layout, MorePage } from './components/Layout'
import { ErrorBanner, PageLoader } from './components/ui'
import { WelcomePage } from './features/onboarding/WelcomePage'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { CheckInPage } from './features/checkin/CheckInPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TasksPage } from './features/tasks/TasksPage'
import { RadarPage } from './features/pressure-radar/RadarPage'
import { PlanPage } from './features/plans/PlanPage'
import { InsightsPage } from './features/insights/InsightsPage'
import { HistoryPage } from './features/insights/HistoryPage'
import { ResourcesPage } from './features/resources/ResourcesPage'

const PUBLIC_ROUTES = new Set(['', 'welcome', 'onboarding'])

export default function App() {
  const route = useRoute()
  const [userId, setUserId] = useState<string | null>(() => getUserId())
  const [profile, setProfileState] = useState<Profile | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)
  const [dataVersion, setDataVersion] = useState(0)

  const setProfile = useCallback((p: Profile | null) => {
    setProfileState(p)
    setUserId(p ? p.id : getUserId())
    if (p) cacheLanguage(p.language)
  }, [])

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await api.health())
    } catch {
      setHealth(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const uid = getUserId()
    if (!uid) {
      setProfile(null)
      return
    }
    try {
      setProfile(await api.getProfile(uid))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Stored ID has no server profile (e.g. data deleted) → start fresh.
        clearSession()
        setProfile(null)
      } else {
        throw err
      }
    }
  }, [setProfile])

  const boot = useCallback(async () => {
    setBooting(true)
    setBootError(null)
    try {
      await Promise.all([refreshProfile(), refreshHealth()])
    } catch (err) {
      setBootError(err instanceof Error ? err.message : 'Cannot reach the UniWell server.')
    } finally {
      setBooting(false)
    }
  }, [refreshProfile, refreshHealth])

  useEffect(() => {
    void boot()
  }, [boot])

  // Route guard: without a profile only the public screens are reachable.
  useEffect(() => {
    if (booting || bootError) return
    if (!profile && !PUBLIC_ROUTES.has(route.name)) navigate('welcome')
    if (profile && PUBLIC_ROUTES.has(route.name)) navigate('dashboard')
  }, [booting, bootError, profile, route.name])

  const lang: Language = (profile?.language ?? (getCachedLanguage() as Language | null) ?? 'en') as Language
  const i18n = useMemo(
    () => ({ lang, t: (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v) }),
    [lang],
  )

  const state: AppState = {
    userId,
    profile,
    health,
    setProfile,
    refreshProfile,
    refreshHealth,
    dataVersion,
    bumpData: () => setDataVersion((v) => v + 1),
  }

  let content
  if (booting) {
    content = (
      <div className="mx-auto max-w-xl p-6">
        <PageLoader />
      </div>
    )
  } else if (bootError) {
    content = (
      <div className="mx-auto max-w-xl p-6">
        <ErrorBanner title="UniWell can’t start" message={bootError} onRetry={() => void boot()} />
      </div>
    )
  } else if (!profile) {
    content = route.name === 'onboarding' ? <OnboardingPage /> : <WelcomePage />
  } else {
    content = <Layout current={route.name}>{renderPage(route.name, route.param)}</Layout>
  }

  return (
    <AppContext.Provider value={state}>
      <I18nContext.Provider value={i18n}>{content}</I18nContext.Provider>
    </AppContext.Provider>
  )
}

function renderPage(name: string, param: string | null) {
  switch (name) {
    case 'checkin':
      return <CheckInPage />
    case 'tasks':
      return <TasksPage />
    case 'radar':
      return <RadarPage />
    case 'plan':
      return <PlanPage planId={param} />
    case 'insights':
      return <InsightsPage />
    case 'history':
      return <HistoryPage />
    case 'resources':
      return <ResourcesPage />
    case 'settings':
      return <SettingsPage />
    case 'more':
      return <MorePage />
    default:
      return <DashboardPage />
  }
}
