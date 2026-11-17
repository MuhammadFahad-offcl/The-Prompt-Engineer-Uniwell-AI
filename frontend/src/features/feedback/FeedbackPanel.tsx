import { useState, type FormEvent } from 'react'
import { CalendarClock, Loader2, MessageSquareHeart, MoveRight, Sparkles } from 'lucide-react'
import { api, ApiError, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT, type TKey } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import type { AdaptationEvent, CompletionStatus, Feedback, FeedbackResult, PlanDetail, ReasonCode } from '../../types/api'
import { ChoiceGroup, ErrorBanner, SuccessBanner } from '../../components/ui'

const REASONS: ReasonCode[] = ['sessions_too_long', 'too_many_tasks', 'not_enough_time', 'unexpected_event', 'plan_was_helpful', 'other']

function ratingOptions(t: (k: TKey) => string) {
  return [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v), sub: v === 1 ? t('rating.1') : v === 5 ? t('rating.5') : undefined }))
}

export function FeedbackPanel({
  plan,
  onSaved,
  onGenerateNext,
  generating,
}: {
  plan: PlanDetail
  onSaved: (fb: Feedback) => void
  onGenerateNext: () => void
  generating: boolean
}) {
  const { t } = useT()
  const { refreshProfile } = useApp()
  const [followed, setFollowed] = useState<CompletionStatus | null>(null)
  const [manageable, setManageable] = useState<number | null>(null)
  const [helpful, setHelpful] = useState<number | null>(null)
  const [reason, setReason] = useState<ReasonCode | null>(null)
  const [breaks, setBreaks] = useState<'yes' | 'no' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FeedbackResult | null>(null)

  const hasBreaks = plan.items.some((i) => i.item_type === 'break')
  const isActive = plan.status === 'active'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!followed || !manageable || !helpful) {
      setError('Please answer the first three questions.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await api.submitFeedback({
        plan_id: plan.id,
        completion_status: followed,
        manageable_rating: manageable,
        helpfulness_rating: helpful,
        reason_code: reason,
        breaks_helpful: breaks === null ? null : breaks === 'yes',
      })
      setResult(res)
      onSaved(res.feedback)
      void refreshProfile()
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'feedback_exists' ? t('fb.already') : errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const nextButton = isActive && (
    <button type="button" className="btn-primary" onClick={onGenerateNext} disabled={generating}>
      {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
      {t('fb.nextPlan')}
    </button>
  )

  if (result) {
    return (
      <section className="card space-y-3" aria-live="polite">
        <SuccessBanner>{t('fb.saved')}</SuccessBanner>
        <AdaptationList events={result.adaptation_events} />
        {result.ask_availability && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
            <CalendarClock className="h-4 w-4" aria-hidden />
            <span className="flex-1">{t('fb.askAvailability')}</span>
            <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => navigate('checkin')}>
              {t('dash.editCheckin')}
            </button>
          </div>
        )}
        {nextButton}
      </section>
    )
  }

  if (plan.feedback) {
    const fb = plan.feedback
    return (
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageSquareHeart className="h-4.5 w-4.5 text-brand-600" aria-hidden /> {t('dash.feedbackDone')}
        </h2>
        <p className="text-sm text-muted">
          {t('fb.followed')} <strong className="text-ink">{t(`fb.${fb.completion_status}`)}</strong> · {t('fb.manageable')}{' '}
          <strong className="text-ink">{fb.manageable_rating}/5</strong> · {t('fb.helpful')} <strong className="text-ink">{fb.helpfulness_rating}/5</strong>
          {fb.reason_code && <> · {t(`reason.${fb.reason_code}`)}</>}
        </p>
        {nextButton}
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-5" noValidate aria-labelledby="fb-title">
      <div>
        <h2 id="fb-title" className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquareHeart className="h-5 w-5 text-brand-600" aria-hidden /> {t('fb.title')}
        </h2>
        <p className="text-sm text-muted">{t('fb.subtitle')}</p>
      </div>
      <ChoiceGroup
        name="followed"
        label={t('fb.followed')}
        value={followed}
        onChange={setFollowed}
        options={(['yes', 'partially', 'no'] as const).map((v) => ({ value: v, label: t(`fb.${v}`) }))}
      />
      <ChoiceGroup name="manageable" label={t('fb.manageable')} value={manageable} onChange={setManageable} options={ratingOptions(t)} />
      <ChoiceGroup name="helpful" label={t('fb.helpful')} value={helpful} onChange={setHelpful} options={ratingOptions(t)} />
      <fieldset>
        <legend className="field-label">{t('fb.reason')}</legend>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => setReason(reason === r ? null : r)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                reason === r ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface hover:bg-brand-50'
              }`}
            >
              {t(`reason.${r}`)}
            </button>
          ))}
        </div>
      </fieldset>
      {hasBreaks && (
        <ChoiceGroup
          name="breaks"
          label={`${t('fb.breaks')} (${t('common.optional')})`}
          value={breaks}
          onChange={setBreaks}
          columns={2}
          options={[
            { value: 'yes', label: t('fb.yes') },
            { value: 'no', label: t('fb.no') },
          ]}
        />
      )}
      {error && <ErrorBanner message={error} />}
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {t('fb.submit')}
      </button>
    </form>
  )
}

export function AdaptationList({ events }: { events: AdaptationEvent[] }) {
  const { t } = useT()
  return (
    <div>
      <h3 className="font-semibold">{t('fb.adaptations')}</h3>
      {events.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{t('fb.noChange')}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {events.map((e) => (
            <li key={e.id} className="flex gap-2 rounded-xl bg-mint-50 p-3 text-sm">
              <MoveRight className="mt-0.5 h-4 w-4 shrink-0 text-mint-700" aria-hidden />
              <div>
                <p>{e.reason}</p>
                {e.previous_value !== null && e.new_value !== null && e.previous_value !== e.new_value && (
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {e.rule_applied}: {e.previous_value} → {e.new_value}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
