import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT, type TKey } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import { todayLocalISO } from '../../lib/format'
import type { CheckIn, SleepQuality } from '../../types/api'
import { ChoiceGroup, ErrorBanner, InfoNote, PageHeader, PageLoader, Spinner, SuccessBanner, SyntheticBadge } from '../../components/ui'

const TIME_CHOICES = [30, 60, 90, 120, 180]
const MOOD_EMOJI = ['😞', '😕', '😐', '🙂', '😄']

export function CheckInPage() {
  const { t } = useT()
  const { userId, profile, dataVersion } = useApp()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [existing, setExisting] = useState<CheckIn | null>(null)

  const [mood, setMood] = useState<number | null>(null)
  const [sleep, setSleep] = useState<SleepQuality | null>(null)
  const [workload, setWorkload] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [minutes, setMinutes] = useState<number | null>(profile?.default_available_minutes ?? null)
  const [custom, setCustom] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<'new' | 'update' | null>(null)

  async function load() {
    if (!userId) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await api.listCheckIns(userId, 7)
      const today = res.today
      setExisting(today)
      if (today) {
        setMood(today.mood_score)
        setSleep(today.sleep_quality)
        setWorkload(today.workload_score)
        setEnergy(today.energy_score)
        setMinutes(today.available_minutes)
        if (!TIME_CHOICES.includes(today.available_minutes)) {
          setUseCustom(true)
          setCustom(String(today.available_minutes))
        }
      } else if (profile?.default_available_minutes && !TIME_CHOICES.includes(profile.default_available_minutes)) {
        setUseCustom(true)
        setCustom(String(profile.default_available_minutes))
      }
    } catch (err) {
      setLoadError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dataVersion])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(null)
    const available = useCustom ? Number(custom) : minutes
    if (mood === null || sleep === null || workload === null) {
      setError('Please answer the three check-in questions.')
      return
    }
    if (!available || !Number.isInteger(available) || available < 10 || available > 720) {
      setError('Available study time must be a whole number between 10 and 720 minutes.')
      return
    }
    setSaving(true)
    try {
      const res = await api.saveCheckIn({
        local_date: todayLocalISO(),
        mood_score: mood,
        sleep_quality: sleep,
        workload_score: workload,
        energy_score: energy,
        available_minutes: available,
      })
      setExisting(res.checkin)
      setSaved(res.updated_existing ? 'update' : 'new')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />
  if (loadError) return <ErrorBanner message={loadError} onRetry={() => void load()} />

  const scale = (prefix: 'mood' | 'workload' | 'energy') =>
    [1, 2, 3, 4, 5].map((v) => ({
      value: v,
      label: prefix === 'mood' ? `${MOOD_EMOJI[v - 1]} ${v}` : String(v),
      sub: t(`${prefix}.${v}` as TKey),
    }))

  return (
    <div className="max-w-2xl">
      <PageHeader title={t('ci.title')} subtitle={t('ci.subtitle')} actions={existing?.is_synthetic ? <SyntheticBadge /> : undefined} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="card space-y-6">
          <div>
            <ChoiceGroup name="mood" label={t('ci.mood')} hint={t('ci.moodEn')} value={mood} onChange={setMood} options={scale('mood')} />
          </div>
          <ChoiceGroup
            name="sleep"
            label={t('ci.sleep')}
            hint={t('ci.sleepEn')}
            value={sleep}
            onChange={setSleep}
            options={(['poor', 'okay', 'good'] as const).map((s) => ({ value: s, label: t(`sleep.${s}`) }))}
          />
          <ChoiceGroup
            name="workload"
            label={t('ci.workload')}
            hint={t('ci.workloadEn')}
            value={workload}
            onChange={setWorkload}
            options={scale('workload')}
          />
          <InfoNote>{t('ci.note')}</InfoNote>
        </div>

        <div className="card space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-mint-700">{t('ci.planningInputs')}</p>
          <ChoiceGroup
            name="energy"
            label={`${t('ci.energy')} (${t('common.optional')})`}
            value={energy}
            onChange={setEnergy}
            options={scale('energy')}
          />
          <fieldset>
            <legend className="field-label">{t('ci.available')}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {TIME_CHOICES.map((m) => {
                const active = !useCustom && minutes === m
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setUseCustom(false)
                      setMinutes(m)
                    }}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-semibold ${
                      active ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface hover:bg-brand-50'
                    }`}
                  >
                    {m} {t('common.minutes')}
                  </button>
                )
              })}
              <button
                type="button"
                aria-pressed={useCustom}
                onClick={() => setUseCustom(true)}
                className={`rounded-xl border px-2 py-2.5 text-sm font-semibold ${
                  useCustom ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface hover:bg-brand-50'
                }`}
              >
                {t('common.custom')}
              </button>
            </div>
            {useCustom && (
              <div className="mt-3">
                <label htmlFor="customMinutes" className="sr-only">
                  {t('ci.customMinutes')}
                </label>
                <input
                  id="customMinutes"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={720}
                  className="input max-w-44"
                  placeholder={t('ci.customMinutes')}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </fieldset>
        </div>

        {error && <ErrorBanner message={error} />}
        {saved && (
          <SuccessBanner>
            <p className="font-semibold">{saved === 'new' ? t('ci.savedNew') : t('ci.savedUpdate')}</p>
            <button type="button" className="btn-primary mt-3" onClick={() => navigate('dashboard')}>
              {t('ci.next')} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </SuccessBanner>
        )}
        <button type="submit" className="btn-primary w-full py-3 sm:w-auto" disabled={saving}>
          {saving ? <Spinner label={t('common.loading')} className="text-white" /> : existing ? t('ci.update') : t('ci.save')}
        </button>
      </form>
    </div>
  )
}
