import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { browserTimezone, getOrCreateUserId } from '../../lib/session'
import { SESSION_CHOICES, type Language, type Profile } from '../../types/api'
import { ChoiceGroup, ErrorBanner, InfoNote, Spinner } from '../../components/ui'

export function ProfileForm({
  initial,
  submitLabel,
  showConsent,
  onSaved,
}: {
  initial: Profile | null
  submitLabel: string
  showConsent: boolean
  onSaved: (p: Profile) => void
}) {
  const { t } = useT()
  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [language, setLanguage] = useState<Language>(initial?.language ?? 'en')
  const [session, setSession] = useState<number>(initial?.preferred_session_minutes ?? 25)
  const [defaultTime, setDefaultTime] = useState<string>(initial?.default_available_minutes?.toString() ?? '')
  const [consent, setConsent] = useState<boolean>(initial?.consent_acknowledged ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (showConsent && !consent) {
      setError(t('onb.consent'))
      return
    }
    const minutes = defaultTime.trim() ? Number(defaultTime) : null
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 10 || minutes > 720)) {
      setError('Usual study time must be between 10 and 720 minutes.')
      return
    }
    setSaving(true)
    try {
      const uid = initial?.id ?? getOrCreateUserId()
      const saved = await api.saveProfile({
        user_id: uid,
        nickname: nickname.trim() || null,
        language,
        preferred_session_minutes: session,
        default_available_minutes: minutes,
        timezone: browserTimezone(),
        consent_acknowledged: showConsent ? consent : true,
      })
      onSaved(saved)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="nickname" className="field-label">
          {t('onb.nickname')}
        </label>
        <input
          id="nickname"
          className="input"
          maxLength={40}
          autoComplete="off"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. Ali"
        />
        <p className="mt-1 text-xs text-muted">{t('onb.nicknameHint')}</p>
      </div>

      <ChoiceGroup
        name="language"
        label={t('onb.language')}
        value={language}
        onChange={setLanguage}
        options={[
          { value: 'en', label: t('lang.en') },
          { value: 'roman_urdu', label: t('lang.roman_urdu') },
        ]}
      />

      <ChoiceGroup
        name="session"
        label={t('onb.session')}
        hint={t('onb.sessionHint')}
        value={session}
        onChange={setSession}
        columns={6}
        options={SESSION_CHOICES.map((m) => ({ value: m, label: String(m), sub: t('common.minutes') }))}
      />

      <div>
        <label htmlFor="defaultTime" className="field-label">
          {t('onb.defaultTime')}
        </label>
        <input
          id="defaultTime"
          className="input max-w-40"
          type="number"
          inputMode="numeric"
          min={10}
          max={720}
          value={defaultTime}
          onChange={(e) => setDefaultTime(e.target.value)}
          placeholder="e.g. 120"
        />
      </div>

      {showConsent && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
          <p className="font-semibold text-brand-900">{t('onb.privacyTitle')}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/85">
            <li>{t('onb.privacy1')}</li>
            <li>{t('onb.privacy2')}</li>
            <li>{t('onb.privacy3')}</li>
            <li>{t('disclaimer.short')}</li>
          </ul>
          <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand-600"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t('onb.consent')}
          </label>
        </div>
      )}

      {error && <ErrorBanner message={error} />}
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Spinner label={t('common.loading')} className="text-surface" /> : submitLabel}
        </button>
      </div>
      {!showConsent && <InfoNote>{t('onb.privacy1')}</InfoNote>}
    </form>
  )
}
