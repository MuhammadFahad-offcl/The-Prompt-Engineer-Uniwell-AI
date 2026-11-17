import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Coffee,
  Gauge as GaugeIcon,
  HeartHandshake,
  Languages,
  Lock,
  MessageSquareHeart,
  RefreshCw,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Wind,
} from 'lucide-react'
import { Logo } from '../../components/Layout'
import { CountUp, Gauge, SplitText } from '../../components/motion'
import { StatusPill } from '../../components/ui'
import { useT, type TKey } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import { useInView, useMagnet, usePointerVars, useReveal, useScrolled, useScrollProgress, useTypewriter } from '../../lib/motion'

/* ------------------------------------------------------------------ helpers */

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function StartButton({ label, large = false }: { label: string; large?: boolean }) {
  const ref = useMagnet<HTMLButtonElement>(6)
  return (
    <button ref={ref} type="button" className={`btn-primary ${large ? 'px-6 py-3.5 text-base' : ''}`} onClick={() => navigate('onboarding')}>
      {label} <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  )
}

function Reveal({
  children,
  className = '',
  as: Tag = 'div',
  delayMs = 0,
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'section' | 'li'
  delayMs?: number
}) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <Tag ref={ref as never} className={`reveal ${className}`} style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}>
      {children}
    </Tag>
  )
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  const ref = useReveal<HTMLDivElement>(0.2)
  return (
    <div ref={ref} className="mx-auto max-w-2xl text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.15] tracking-[-0.025em] text-ink">
        <SplitText text={title} />
      </h2>
      {body && <p className="mt-4 text-base text-muted">{body}</p>}
    </div>
  )
}

/* ------------------------------------------------------- hero preview stack */

function PreviewStack() {
  const glowRef = usePointerVars<HTMLDivElement>()
  return (
    <div ref={glowRef} className="spotlight relative mx-auto w-full max-w-md rounded-[28px] lg:h-[460px]" aria-label="Example of what UniWell shows (illustrative, not real data)">
      <span className="chip relative z-40 mb-3 border border-line bg-surface text-faint shadow-[var(--shadow-sm)] lg:absolute lg:bottom-4 lg:right-3 lg:mb-0">Example · not real data</span>

      {/* Radar card */}
      <div className="preview-tilt float-a relative z-10 rounded-[22px] border border-line bg-surface/95 p-4 shadow-[var(--shadow-lg)] lg:absolute lg:left-0 lg:top-4 lg:w-[78%] lg:-rotate-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <GaugeIcon className="h-4 w-4 text-brand-600" aria-hidden /> Pressure Radar
          </p>
          <StatusPill status="over_capacity" />
        </div>
        <div className="mt-2 flex items-end gap-3">
          <Gauge ratio={1.5} status="over_capacity" size={150} />
          <div className="pb-1 text-sm">
            <p className="text-2xl font-extrabold tabular text-ink">1.50</p>
            <p className="text-xs text-muted">180 min due · 120 min free</p>
          </div>
        </div>
      </div>

      {/* Plan card */}
      <div className="preview-tilt float-b relative z-20 mt-3 rounded-[22px] border border-line bg-surface p-4 shadow-[var(--shadow-glow)] lg:absolute lg:right-0 lg:top-[38%] lg:mt-0 lg:w-[80%] lg:rotate-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-violet-500" aria-hidden /> Your adaptive plan
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            { Icon: BookOpen, min: 25, label: 'DBMS: outline question 1', done: true, cls: 'bg-brand-50 text-brand-700' },
            { Icon: Coffee, min: 5, label: 'Screen break', done: true, cls: 'bg-surface-alt text-muted' },
            { Icon: Wind, min: 3, label: 'Grounding pause', done: false, cls: 'bg-mint-50 text-mint-700' },
          ].map(({ Icon, min, label, done, cls }) => (
            <li key={label} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2">
              {done ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-mint-500" aria-hidden /> : <span className="h-4.5 w-4.5 shrink-0 rounded-full border-2 border-line" aria-hidden />}
              <span className={`chip ${cls}`}>
                <Icon className="h-3 w-3" aria-hidden /> {min} min
              </span>
              <span className={`truncate ${done ? 'text-muted line-through' : 'font-medium'}`}>{label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Adaptation note */}
      <div className="preview-tilt float-c relative z-30 mt-3 rounded-2xl border border-mint-400/40 bg-mint-50 p-3.5 shadow-[var(--shadow-md)] lg:absolute lg:bottom-2 lg:left-6 lg:mt-0 lg:w-[72%] lg:-rotate-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-mint-700">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Adapted from your feedback
        </p>
        <p className="mt-1 text-sm text-ink">Sessions felt long, so today uses 20-minute blocks.</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- bento cards */

function BentoCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const ref = usePointerVars<HTMLDivElement>()
  return (
    <div ref={ref} className={`card spotlight transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)] ${className}`}>
      {children}
    </div>
  )
}

function AdaptCounter() {
  const [ref, seen] = useInView<HTMLDivElement>(0.5)
  const steps = [30, 25, 20]
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (!seen) return
    const t1 = window.setTimeout(() => setStage(1), 900)
    const t2 = window.setTimeout(() => setStage(2), 1900)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [seen])
  return (
    <div ref={ref} className="mt-4">
      <div className="flex items-end gap-2">
        <span key={stage} className="enter text-5xl font-extrabold tabular text-brand-600">
          {steps[stage]}
        </span>
        <span className="pb-1.5 text-sm font-semibold text-muted">min study blocks</span>
      </div>
      <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-xs" aria-label="Example adaptation sequence">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`chip transition-colors duration-500 ${i <= stage ? 'bg-brand-600 text-surface' : 'bg-surface-alt text-faint'}`}>{s} min</span>
            {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-faint" aria-hidden />}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">“Sessions felt too long” → the next plan shortens blocks by 5 min (never below 15).</p>
    </div>
  )
}

/* -------------------------------------------------------------------- page */

const LOOP: { key: TKey; Icon: typeof GaugeIcon }[] = [
  { key: 'welcome.loop.checkin', Icon: SmilePlus },
  { key: 'welcome.loop.radar', Icon: GaugeIcon },
  { key: 'welcome.loop.plan', Icon: Sparkles },
  { key: 'welcome.loop.feedback', Icon: MessageSquareHeart },
  { key: 'welcome.loop.adapt', Icon: RefreshCw },
]

export function WelcomePage() {
  const { t } = useT()
  const scrolled = useScrolled(24)
  const progress = useScrollProgress()
  const heroRef = usePointerVars<HTMLElement>()
  const phrases = useMemo(() => [t('welcome.for1'), t('welcome.for2'), t('welcome.for3')], [t])
  const typed = useTypewriter(phrases)
  const [endRef, endSeen] = useInView<HTMLDivElement>(0.9)

  return (
    <div className="min-h-dvh overflow-x-clip">
      <div className="scroll-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden />

      {/* Top nav */}
      <header className="topnav fixed inset-x-0 top-0 z-50" data-scrolled={scrolled}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="UniWell — back to top">
            <Logo />
          </button>
          <nav aria-label="Landing" className="flex items-center gap-1">
            <button type="button" className="btn-ghost hidden sm:inline-flex" onClick={() => scrollToId('how')}>
              {t('welcome.navHow')}
            </button>
            <button type="button" className="btn-ghost hidden sm:inline-flex" onClick={() => scrollToId('features')}>
              {t('welcome.navFeatures')}
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('onboarding')}>
              {t('welcome.start')}
            </button>
          </nav>
        </div>
      </header>

      {/* 1 — Hero: aurora + cursor spotlight + split headline + preview stack */}
      <section ref={heroRef} className="relative isolate overflow-hidden pb-16 pt-28 sm:pt-32 lg:min-h-[92vh] lg:pb-24">
        <div className="aurora" aria-hidden>
          <div className="aurora-blob a" />
          <div className="aurora-blob b" />
          <div className="aurora-blob c" />
        </div>
        <div className="cursor-glow" aria-hidden />
        <div className="grain" aria-hidden />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="chip enter border border-line bg-surface/80 text-mint-700 shadow-[var(--shadow-sm)] backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {t('welcome.badge')}
            </p>
            <p className="enter mt-5 h-6 text-sm font-semibold text-brand-700" aria-live="off" style={{ animationDelay: '80ms' }}>
              {t('welcome.forPrefix')} <span className="type-caret">{typed}</span>
            </p>
            <h1 className="mt-2 text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink">
              <SplitText text={t('welcome.title')} gradient={t('welcome.titleHighlight')} mode="mount" delayMs={150} />
            </h1>
            <p className="enter mt-5 max-w-xl text-lg text-muted" style={{ animationDelay: '600ms' }}>
              {t('welcome.body')}
            </p>
            <div className="enter mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: '750ms' }}>
              <StartButton label={t('welcome.start')} large />
              <button type="button" className="btn-secondary px-5 py-3.5 text-base" onClick={() => scrollToId('how')}>
                {t('welcome.navHow')}
              </button>
            </div>
            <ul className="enter mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted" style={{ animationDelay: '900ms' }}>
              {(['welcome.trust1', 'welcome.trust2', 'welcome.trust3'] as const).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-mint-500" aria-hidden /> {t(k)}
                </li>
              ))}
            </ul>
          </div>
          <div className="enter" style={{ animationDelay: '350ms' }}>
            <PreviewStack />
          </div>
        </div>
      </section>

      {/* 2 — First scroll: marquee band of the loop */}
      <section aria-label="How the loop works" className="relative border-y border-brand-900 bg-brand-900 py-5 text-surface">
        <div className="marquee">
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <ul key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
                {LOOP.map(({ key, Icon }) => (
                  <li key={key} className="flex items-center gap-4 px-6 font-display text-[clamp(1.25rem,2.6vw,2rem)] font-extrabold tracking-tight">
                    <Icon className="h-7 w-7 text-mint-400" aria-hidden />
                    <span>{t(key)}</span>
                    <span className="ml-6 text-violet-400" aria-hidden>
                      ✦
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
        <SectionTitle eyebrow={t('welcome.howEyebrow')} title={t('welcome.howTitle')} body={t('welcome.howBody')} />
        <ol className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {LOOP.map(({ key, Icon }, i) => (
            <Reveal as="li" key={key} className="card h-full" delayMs={i * 80}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-display text-3xl font-extrabold text-brand-100">{i + 1}</span>
                </div>
                <p className="mt-4 font-display font-bold text-ink">{t(key)}</p>
                <p className="mt-1 text-sm text-muted">{t(`welcome.step${i + 1}` as TKey)}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* 3 — Feature bento with spotlight cards */}
      <section id="features" className="scroll-mt-20 bg-surface-alt/60 px-4 py-20 sm:px-6 lg:py-28">
        <SectionTitle eyebrow={t('welcome.featEyebrow')} title={t('welcome.featTitle')} />
        <Reveal className="bento mx-auto mt-12 max-w-6xl">
          <BentoCard className="span-4">
            <p className="eyebrow">Academic Pressure Radar</p>
            <div className="mt-2 grid items-center gap-4 sm:grid-cols-[auto_1fr]">
              <Gauge ratio={1.5} status="over_capacity" size={190} />
              <div>
                <p className="font-display text-xl font-bold text-ink">{t('welcome.featRadar')}</p>
                <p className="mt-2 text-sm text-muted">
                  <span className="tabular font-semibold text-ink">
                    <CountUp value={180} /> ÷ <CountUp value={120} /> = <CountUp value={1.5} decimals={2} />
                  </span>{' '}
                  → over capacity. {t('welcome.featRadarBody')}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <StatusPill status="manageable" />
                  <StatusPill status="tight" />
                  <StatusPill status="over_capacity" />
                </div>
              </div>
            </div>
          </BentoCard>
          <BentoCard className="span-2 bg-gradient-to-br from-brand-50 to-surface">
            <Sparkles className="h-6 w-6 text-violet-500" aria-hidden />
            <p className="mt-3 font-display text-lg font-bold text-ink">{t('welcome.featAI')}</p>
            <p className="mt-1 text-sm text-muted">{t('welcome.featAIBody')}</p>
          </BentoCard>
          <BentoCard className="span-3">
            <p className="eyebrow">{t('welcome.featAdaptEyebrow')}</p>
            <p className="mt-2 font-display text-lg font-bold text-ink">{t('welcome.featAdapt')}</p>
            <AdaptCounter />
          </BentoCard>
          <BentoCard className="span-3">
            <Lock className="h-6 w-6 text-brand-600" aria-hidden />
            <p className="mt-3 font-display text-lg font-bold text-ink">{t('welcome.featPrivate')}</p>
            <p className="mt-1 text-sm text-muted">{t('welcome.featPrivateBody')}</p>
          </BentoCard>
          <BentoCard className="span-2">
            <Languages className="h-6 w-6 text-mint-500" aria-hidden />
            <p className="mt-3 font-display text-lg font-bold text-ink">{t('welcome.featLang')}</p>
            <p className="mt-1 text-sm text-muted">{t('welcome.featLangBody')}</p>
          </BentoCard>
          <BentoCard className="span-2">
            <Wind className="h-6 w-6 text-mint-500" aria-hidden />
            <p className="mt-3 font-display text-lg font-bold text-ink">{t('welcome.featPause')}</p>
            <p className="mt-1 text-sm text-muted">{t('welcome.featPauseBody')}</p>
          </BentoCard>
          <BentoCard className="span-2">
            <HeartHandshake className="h-6 w-6 text-brand-600" aria-hidden />
            <p className="mt-3 font-display text-lg font-bold text-ink">{t('welcome.featHonest')}</p>
            <p className="mt-1 text-sm text-muted">{t('welcome.featHonestBody')}</p>
          </BentoCard>
        </Reveal>
      </section>

      {/* Safety */}
      <section className="px-4 py-20 sm:px-6">
        <Reveal className="mx-auto flex max-w-4xl flex-col gap-5 rounded-[28px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:p-8">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-mint-50 text-mint-700">
            <ShieldCheck className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-ink">{t('welcome.safeTitle')}</h2>
            <p className="mt-1 text-sm text-muted">
              {t('disclaimer.short')} {t('disclaimer.emergency')}
            </p>
          </div>
        </Reveal>
      </section>

      {/* Final CTA + end-of-page detail */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-brand-900 px-6 py-14 text-center text-surface sm:px-12 sm:py-20">
          <div className="aurora opacity-70" aria-hidden>
            <div className="aurora-blob b" />
            <div className="aurora-blob c" />
          </div>
          <div className="relative z-10">
            <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight tracking-[-0.025em]">{t('welcome.ctaTitle')}</h2>
            <p className="mx-auto mt-3 max-w-xl text-surface/75">{t('welcome.noSignup')}</p>
            <div className="mt-8 flex justify-center">
              <StartButton label={t('welcome.start')} large />
            </div>
            <div ref={endRef} className="mt-8 h-6">
              {endSeen && (
                <p className="enter inline-flex items-center gap-1.5 text-sm text-mint-100">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> {t('welcome.endNote')}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-line px-4 py-8 text-xs text-faint sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row">
          <Logo />
          <p className="max-w-xl">{t('disclaimer.short')}</p>
        </div>
        <p className="mt-4">
          Motion effects inspired by{' '}
          <a className="link" href="https://github.com/DavidHDev/vue-bits" target="_blank" rel="noopener noreferrer">
            vue-bits
          </a>{' '}
          by DavidHDev (MIT). UniWell’s versions are original CSS/TS re-implementations.
        </p>
      </footer>
    </div>
  )
}
