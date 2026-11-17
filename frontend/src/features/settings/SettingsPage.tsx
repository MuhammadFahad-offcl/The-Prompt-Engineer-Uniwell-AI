import { useState } from 'react'
import { Cpu, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import { clearSession } from '../../lib/session'
import { ErrorBanner, PageHeader, Spinner, SuccessBanner } from '../../components/ui'
import { ProfileForm } from '../onboarding/ProfileForm'
import { DemoSeedPanel } from './DemoSeedPanel'

export function SettingsPage() {
  const { t } = useT()
  const { profile, setProfile, health, bumpData } = useApp()
  const [savedMsg, setSavedMsg] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (!profile) return null

  const adapted =
    profile.adapted_session_minutes !== null || profile.max_tasks_override !== null || profile.buffer_minutes !== 5

  async function resetAdaptation() {
    setResetBusy(true)
    setResetError(null)
    try {
      setProfile(await api.resetAdaptation(profile!.id))
    } catch (err) {
      setResetError(errorMessage(err))
    } finally {
      setResetBusy(false)
    }
  }

  async function deleteAll() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.deleteData(profile!.id)
      clearSession()
      setProfile(null)
      bumpData()
      navigate('welcome')
    } catch (err) {
      setDeleteError(errorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title={t('set.title')} />

      <section className="card" aria-labelledby="prefs">
        <h2 id="prefs" className="mb-4 text-lg font-semibold">
          {t('set.profile')}
        </h2>
        <ProfileForm
          key={profile.updated_at}
          initial={profile}
          submitLabel={t('common.save')}
          showConsent={false}
          onSaved={(p) => {
            setProfile(p)
            setSavedMsg(true)
            window.setTimeout(() => setSavedMsg(false), 2500)
          }}
        />
        {savedMsg && (
          <div className="mt-3">
            <SuccessBanner>{t('common.saved')}</SuccessBanner>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="adapt">
        <h2 id="adapt" className="flex items-center gap-2 text-lg font-semibold">
          <RotateCcw className="h-4.5 w-4.5 text-brand-600" aria-hidden /> {t('set.adaptation')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('set.adaptationBody')}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-muted">{t('set.effective')}</dt>
            <dd className="font-semibold">{profile.effective_session_minutes} min</dd>
          </div>
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-muted">Max tasks / plan</dt>
            <dd className="font-semibold">{profile.max_tasks_override ?? 'Auto'}</dd>
          </div>
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-muted">Buffer</dt>
            <dd className="font-semibold">{profile.buffer_minutes} min</dd>
          </div>
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-muted">Breaks</dt>
            <dd className="font-semibold">{profile.keep_breaks ? 'Kept' : 'Auto'}</dd>
          </div>
        </dl>
        <button type="button" className="btn-secondary mt-3" disabled={!adapted || resetBusy} onClick={() => void resetAdaptation()}>
          {resetBusy ? <Spinner /> : t('set.resetAdapt')}
        </button>
        {resetError && (
          <div className="mt-3">
            <ErrorBanner message={resetError} />
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="privacy">
        <h2 id="privacy" className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-4.5 w-4.5 text-mint-500" aria-hidden /> {t('set.privacy')}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/85">
          <li>{t('onb.privacy1')}</li>
          <li>{t('onb.privacy2')}</li>
          <li>{t('onb.privacy3')}</li>
          <li>{t('disclaimer.short')}</li>
          <li>{t('disclaimer.emergency')}</li>
        </ul>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-muted">{t('set.id')}</dt>
            <dd className="break-all font-mono text-xs">{profile.id}</dd>
          </div>
          <div className="rounded-xl bg-canvas p-3">
            <dt className="flex items-center gap-1 text-xs text-muted">
              <Cpu className="h-3.5 w-3.5" aria-hidden /> {t('set.aiStatus')}
            </dt>
            <dd className="font-semibold">
              {health?.ai.provider ?? '—'} · {health?.ai.configured ? t('set.aiReady') : t('set.aiMissing')}
              {health?.ai.configured && <span className="block text-xs font-normal text-muted">{health.ai.model}</span>}
              {!health?.ai.configured && health?.ai.missing_env && (
                <span className="block text-xs font-normal text-muted">Set {health.ai.missing_env} in .env</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {health?.demo_enabled && (
        <section className="card">
          <DemoSeedPanel />
        </section>
      )}

      <section className="card border-over-700/25" aria-labelledby="delete">
        <h2 id="delete" className="flex items-center gap-2 text-lg font-semibold text-over-700">
          <Trash2 className="h-4.5 w-4.5" aria-hidden /> {t('set.delete')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('set.deleteBody')}</p>
        <label htmlFor="confirmDelete" className="field-label mt-3">
          {t('set.deleteConfirm')}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="confirmDelete"
            className="input max-w-48"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="btn-danger"
            disabled={confirmText !== 'DELETE' || deleting}
            onClick={() => void deleteAll()}
          >
            {deleting ? <Spinner className="text-surface" /> : t('set.delete')}
          </button>
        </div>
        {deleteError && (
          <div className="mt-3">
            <ErrorBanner message={deleteError} />
          </div>
        )}
      </section>
    </div>
  )
}
