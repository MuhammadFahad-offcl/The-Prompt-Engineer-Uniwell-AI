import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import { browserTimezone, getOrCreateUserId } from '../../lib/session'
import { ErrorBanner, Spinner } from '../../components/ui'

/** Loads a clearly labelled synthetic student for demos. Replaces this anonymous ID's data. */
export function DemoSeedPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useT()
  const { profile, setProfile, bumpData } = useApp()
  const [busy, setBusy] = useState<null | 'overloaded' | 'manageable'>(null)
  const [error, setError] = useState<string | null>(null)

  async function seed(scenario: 'overloaded' | 'manageable') {
    setBusy(scenario)
    setError(null)
    try {
      const uid = profile?.id ?? getOrCreateUserId()
      const res = await api.seedDemo(uid, scenario, browserTimezone())
      setProfile(res.profile)
      bumpData()
      navigate('dashboard')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <p className="flex items-center gap-2 font-semibold">
        <FlaskConical className="h-4 w-4 text-warn-700" aria-hidden />
        {compact ? t('onb.demoTitle') : t('set.demo')}
      </p>
      <p className="mt-1 text-sm text-muted">{compact ? t('onb.demoBody') : t('set.demoBody')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => void seed('overloaded')}>
          {busy === 'overloaded' ? <Spinner label={t('common.loading')} /> : t('onb.demoOver')}
        </button>
        <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => void seed('manageable')}>
          {busy === 'manageable' ? <Spinner label={t('common.loading')} /> : t('onb.demoOk')}
        </button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}
    </div>
  )
}
