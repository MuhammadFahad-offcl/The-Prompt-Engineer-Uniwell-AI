import { Logo } from '../../components/Layout'
import { useApp } from '../../lib/appState'
import { useT } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import { ProfileForm } from './ProfileForm'
import { DemoSeedPanel } from '../settings/DemoSeedPanel'

export function OnboardingPage() {
  const { t } = useT()
  const { setProfile, health } = useApp()

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <button type="button" onClick={() => navigate('welcome')} aria-label="Back to welcome">
          <Logo />
        </button>
        <div className="card mt-6 sm:p-7">
          <h1 className="text-2xl font-bold tracking-tight">{t('onb.title')}</h1>
          <p className="mt-1 mb-6 text-sm text-muted">{t('onb.subtitle')}</p>
          <ProfileForm
            initial={null}
            submitLabel={t('onb.continue')}
            showConsent
            onSaved={(p) => {
              setProfile(p)
              navigate('checkin')
            }}
          />
        </div>
        {health?.demo_enabled && (
          <div className="card mt-4">
            <DemoSeedPanel compact />
          </div>
        )}
      </div>
    </div>
  )
}
