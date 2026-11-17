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
    <div className="relative isolate min-h-dvh overflow-hidden bg-canvas">
      <div className="aurora opacity-60" aria-hidden>
        <div className="aurora-blob a" />
        <div className="aurora-blob b" />
      </div>
      <div className="enter relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <button type="button" onClick={() => navigate('welcome')} aria-label="Back to welcome">
          <Logo />
        </button>
        <div className="card mt-6 shadow-[var(--shadow-lg)] sm:p-8">
          <h1 className="text-[1.75rem] tracking-tight">{t('onb.title')}</h1>
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
