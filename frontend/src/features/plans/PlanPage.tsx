import { useEffect, useRef, useState } from 'react'
import { HeartHandshake, KeyRound, Loader2, Sparkles } from 'lucide-react'
import { api, ApiError, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import type { PlanDetail, SafetyResponse } from '../../types/api'
import { EmptyState, ErrorBanner, PageHeader, PageLoader } from '../../components/ui'
import { PlanView } from './PlanView'
import { FeedbackPanel } from '../feedback/FeedbackPanel'

export function PlanPage({ planId }: { planId: string | null }) {
  const { t } = useT()
  const { userId, health, dataVersion, refreshProfile, refreshHealth } = useApp()
  const [plan, setPlan] = useState<PlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasCheckin, setHasCheckin] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<ApiError | null>(null)
  const [safety, setSafety] = useState<SafetyResponse | null>(null)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function load() {
    if (!userId) return
    setLoading(true)
    setLoadError(null)
    try {
      const [checkins, detail] = await Promise.all([
        api.listCheckIns(userId, 1),
        planId
          ? api.getPlan(planId)
          : api.listPlans(userId).then((h) => (h.items[0] ? api.getPlan(h.items[0].id) : null)),
      ])
      setHasCheckin(!!checkins.today)
      setPlan(detail)
    } catch (err) {
      setLoadError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, planId, dataVersion])

  async function generate() {
    if (!userId) return
    setGenerating(true)
    setGenError(null)
    setSafety(null)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await api.generatePlan(userId, note.trim() || null, ctrl.signal)
      if (res.kind === 'safety') {
        setSafety(res.safety)
      } else {
        setPlan(res.plan)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setNote('')
        setShowNote(false)
        void refreshProfile()
        if (planId) navigate(`plan/${res.plan.id}`)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setGenError(err instanceof ApiError ? err : new ApiError(0, 'unknown', errorMessage(err)))
    } finally {
      setGenerating(false)
      void refreshHealth() // keep the AI-provider status note current (e.g. after a key is added)
    }
  }

  if (loading) return <PageLoader />
  if (loadError) return <ErrorBanner message={loadError} onRetry={() => void load()} />

  const aiMissing = health && !health.ai.configured
  const isLatestView = !planId || plan?.status === 'active'

  const generator = (
    <section className="card space-y-3" aria-labelledby="gen-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="gen-title" className="font-semibold">
            {plan ? t('plan.regenerate') : t('plan.generate')}
          </h2>
          <p className="text-xs text-muted">Live AI · uses your check-in, tasks, time and recent feedback.</p>
        </div>
        <button type="button" className="btn-primary px-5 py-3" onClick={() => void generate()} disabled={generating || !hasCheckin}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {plan ? t('plan.regenerate') : t('plan.generate')}
        </button>
      </div>
      {!hasCheckin && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warn-50 p-3 text-sm text-warn-700">
          {t('plan.needCheckin')}
          <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => navigate('checkin')}>
            {t('dash.checkinCta')}
          </button>
        </div>
      )}
      {hasCheckin && (
        <div>
          <button type="button" className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline" onClick={() => setShowNote((v) => !v)} aria-expanded={showNote}>
            {t('plan.noteLabel')}
          </button>
          {showNote && (
            <div className="mt-2">
              <label htmlFor="plan-note" className="sr-only">
                {t('plan.noteLabel')}
              </label>
              <textarea id="plan-note" className="input min-h-20" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I have a group meeting at 4 pm" />
              <p className="mt-1 text-xs text-muted">{t('plan.noteHint')}</p>
            </div>
          )}
        </div>
      )}
      {generating && (
        <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-xl bg-brand-50 p-4">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-brand-600" aria-hidden />
          <div>
            <p className="font-semibold text-brand-900">{t('plan.generating')}</p>
            <p className="text-sm text-muted">{t('plan.generatingSub')}</p>
          </div>
        </div>
      )}
      {genError &&
        (genError.code === 'ai_not_configured' ? (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-warn-700/25 bg-warn-50 p-4 text-sm">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-warn-700" aria-hidden />
            <div>
              <p className="font-semibold text-warn-700">{t('plan.aiNotConfigured')}</p>
              <p className="text-ink/90">{genError.message}</p>
            </div>
          </div>
        ) : genError.code === 'checkin_required' ? (
          <ErrorBanner message={genError.message} />
        ) : (
          <ErrorBanner title={t('plan.errorTitle')} message={genError.message} onRetry={() => void generate()} />
        ))}
      {aiMissing && !genError && (
        <p className="text-xs text-warn-700">
          {t('plan.aiNotConfigured')}: {t('plan.aiNotConfiguredBody', { env: health?.ai.missing_env ?? 'GEMINI_API_KEY' })}
        </p>
      )}
    </section>
  )

  return (
    <div className="space-y-4">
      <PageHeader title={t('plan.title')} />

      {safety ? (
        <section role="alert" className="card border-brand-200 bg-brand-50">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-900">
            <HeartHandshake className="h-5 w-5" aria-hidden /> {safety.title}
          </h2>
          <p className="mt-2 text-ink/90">{safety.message}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {safety.actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <button type="button" className="btn-secondary mt-4" onClick={() => navigate('resources')}>
            {t('nav.resources')}
          </button>
        </section>
      ) : (
        isLatestView && generator
      )}

      {plan ? (
        <>
          <PlanView plan={plan} onItemsChange={(items) => setPlan({ ...plan, items })} />
          <FeedbackPanel key={plan.id} plan={plan} onSaved={(fb) => setPlan({ ...plan, feedback: fb })} onGenerateNext={() => void generate()} generating={generating} />
        </>
      ) : (
        !generating &&
        !safety && <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t('plan.none')} body={t('plan.noneBody')} />
      )}
    </div>
  )
}
