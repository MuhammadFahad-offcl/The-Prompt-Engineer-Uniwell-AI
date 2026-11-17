import { ArrowRight, BarChart3, Gauge, MessageSquareHeart, RefreshCw, ShieldCheck, SmilePlus, Sparkles } from 'lucide-react'
import { Logo } from '../../components/Layout'
import { useT, type TKey } from '../../lib/i18n'
import { navigate } from '../../lib/router'

const LOOP: { key: TKey; Icon: typeof Gauge }[] = [
  { key: 'welcome.loop.checkin', Icon: SmilePlus },
  { key: 'welcome.loop.radar', Icon: Gauge },
  { key: 'welcome.loop.plan', Icon: Sparkles },
  { key: 'welcome.loop.feedback', Icon: MessageSquareHeart },
  { key: 'welcome.loop.adapt', Icon: RefreshCw },
]

export function WelcomePage() {
  const { t } = useT()
  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-canvas">
      <div className="mx-auto flex max-w-5xl flex-col px-4 py-6 sm:px-6">
        <Logo />
        <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="chip mb-4 bg-mint-50 text-mint-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Non-clinical · Private · Adaptive
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-brand-900 sm:text-4xl">
              {t('welcome.title')}
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted">{t('welcome.body')}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary px-5 py-3 text-base" onClick={() => navigate('onboarding')}>
                {t('welcome.start')} <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <span className="text-sm text-muted">{t('welcome.noSignup')}</span>
            </div>
          </div>

          <ol className="card space-y-1 p-4 sm:p-6" aria-label="How UniWell works">
            {LOOP.map(({ key, Icon }, i) => (
              <li key={key} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span className="text-xs font-semibold text-muted">{i + 1}</span>
                <span className="font-medium">{t(key)}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 px-2 pt-2 text-xs text-muted">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden /> Weekly self-reported trends — never a diagnosis.
            </li>
          </ol>
        </section>
        <p className="border-t border-line pt-5 text-xs text-muted">{t('disclaimer.short')} {t('disclaimer.emergency')}</p>
      </div>
    </div>
  )
}
