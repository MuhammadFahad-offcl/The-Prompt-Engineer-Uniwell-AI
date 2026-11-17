import { useEffect, useState } from 'react'
import {
  Annoyed,
  BarChart3,
  CalendarCheck,
  Frown,
  HeartPulse,
  Laugh,
  Leaf,
  Lock,
  Meh,
  NotebookPen,
  Smile,
  Sparkles,
  Trash2,
  Wind,
} from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { api, ApiError, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { navigate } from '../../lib/router'
import { formatDateTime } from '../../lib/format'
import { chartColors } from '../../lib/theme'
import type {
  MBActivity,
  MBAdjustment,
  MBCondition,
  MBInsights,
  MBJournal,
  MBMood,
  MBPressure,
  MBRecommendation,
  MBSafety,
  MBSummary,
} from '../../types/api'
import { ChoiceGroup, EmptyState, ErrorBanner, InfoNote, PageHeader, PageLoader, Spinner, Stat, SuccessBanner } from '../../components/ui'
import { ACTIVITY_META, JournalForm, RecoveryFlow } from './Recovery'
import { Panel, PRIVATE_NOTE, SafetyPanel, Scale10, StateBadge } from './shared'

const TABS = [
  { id: 'home', label: 'Home', Icon: Leaf },
  { id: 'checkin', label: 'Check-in', Icon: HeartPulse },
  { id: 'recovery', label: 'Recovery', Icon: Wind },
  { id: 'journal', label: 'Journal', Icon: NotebookPen },
  { id: 'insights', label: 'Insights', Icon: BarChart3 },
  { id: 'plan', label: 'Adaptive plan', Icon: CalendarCheck },
] as const
type TabId = (typeof TABS)[number]['id']

export function MindBalancePage({ tab }: { tab: string | null }) {
  const active: TabId = (TABS.find((t) => t.id === tab)?.id ?? 'home') as TabId
  const [safety, setSafety] = useState<MBSafety | null>(null)
  const [activity, setActivity] = useState<MBActivity | null>(null)
  const go = (id: TabId) => navigate(`mindbalance/${id}`)

  return (
    <div className="space-y-4">
      <PageHeader
        title="MindBalance"
        subtitle="Balance academic pressure with how you actually feel today. Self-reported, private, and never a diagnosis."
      />
      <nav aria-label="MindBalance sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map(({ id, label, Icon }) => (
          <a
            key={id}
            href={`#/mindbalance/${id}`}
            aria-current={active === id ? 'page' : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
              active === id ? 'border-transparent bg-brand-600 text-surface shadow-[var(--shadow-glow)]' : 'border-line bg-surface text-muted hover:bg-surface-hover'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </a>
        ))}
      </nav>

      {safety && <SafetyPanel safety={safety} />}

      <div key={active} className="enter">
        {active === 'home' && (
          <HomeTab
            onStart={(a) => {
              setActivity(a)
              go('recovery')
            }}
            go={go}
          />
        )}
        {active === 'checkin' && (
          <CheckInTab
            onSafety={setSafety}
            onStart={(a) => {
              setActivity(a)
              go('recovery')
            }}
            go={go}
          />
        )}
        {active === 'recovery' &&
          (activity ? (
            <RecoveryFlow activity={activity} onExit={() => setActivity(null)} onSafety={setSafety} />
          ) : (
            <ActivityPicker onPick={setActivity} />
          ))}
        {active === 'journal' && <JournalTab onSafety={setSafety} />}
        {active === 'insights' && <InsightsTab />}
        {active === 'plan' && <PlanTab go={go} />}
      </div>

      <p className="text-xs text-faint">
        MindBalance offers general wellbeing and planning support. It does not diagnose or treat any condition and is not an emergency service.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ home */

function HomeTab({ onStart, go }: { onStart: (a: MBActivity) => void; go: (t: TabId) => void }) {
  const { userId, dataVersion } = useApp()
  const [data, setData] = useState<MBSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!userId) return
    setError(null)
    try {
      setData(await api.mb.summary(userId))
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dataVersion])

  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />
  if (!data) return <PageLoader />
  const c = data.latest_checkin

  if (!c)
    return (
      <EmptyState
        icon={<HeartPulse className="h-7 w-7" />}
        title="No MindBalance check-in today"
        body="Tell MindBalance how you're doing — mood, stress, energy and academic pressure. It takes under a minute."
        action={
          <button type="button" className="btn-primary" onClick={() => go('checkin')}>
            Start check-in
          </button>
        }
      />
    )

  return (
    <div className="space-y-4">
      <section className="card relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-violet-400/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Today · {formatDateTime(c.created_at)}</p>
            <div className="mt-2">
              <StateBadge state={c.state} size="lg" />
            </div>
          </div>
          <button type="button" className="btn-secondary" onClick={() => go('checkin')}>
            Check in again
          </button>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Mood" value={c.mood.replace('_', ' ')} />
          <Stat label="Stress" value={`${c.stress}/10`} />
          <Stat label="Energy" value={`${c.energy}/10`} />
          <Stat label="Academic pressure" value={c.academic_pressure.replace('_', ' ')} />
        </div>
        <ul className="relative mt-3 space-y-1 text-sm text-ink/90">
          {c.state_reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
        <details className="relative mt-3 text-xs text-muted">
          <summary className="cursor-pointer font-semibold">How is this state worked out?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2">These are fixed, transparent rules over what you reported — not an assessment or diagnosis.</p>
        </details>
      </section>

      <Panel title="Suggested for you right now" icon={<Sparkles className="h-4.5 w-4.5" />}>
        <Recommendations recs={data.recommendations} onStart={onStart} />
      </Panel>

      <Panel title="Today's academic plan" icon={<CalendarCheck className="h-4.5 w-4.5" />}>
        {data.adjustment?.status === 'applied' ? (
          <p className="text-sm">
            You confirmed {data.adjustment.changes.filter((x) => x.accepted).length} adjustment(s) for today. Your next generated plan will follow them.{' '}
            <button type="button" className="link" onClick={() => navigate('plan')}>
              Go to plan →
            </button>
          </p>
        ) : (
          <p className="text-sm text-muted">
            MindBalance can suggest a lighter, more realistic schedule based on this check-in. You choose what to apply.{' '}
            <button type="button" className="link" onClick={() => go('plan')}>
              Review suggestions →
            </button>
          </p>
        )}
      </Panel>
    </div>
  )
}

function Recommendations({ recs, onStart }: { recs: MBRecommendation[]; onStart: (a: MBActivity) => void }) {
  if (recs.length === 0) return <p className="text-sm text-muted">Check in first to get suggestions.</p>
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {recs.map((r, i) => {
        const meta = ACTIVITY_META[r.activity]
        return (
          <li key={r.activity} className={`flex flex-col rounded-2xl border p-4 ${i === 0 ? 'border-brand-200 bg-brand-50/60' : 'border-line'}`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-brand-600 shadow-[var(--shadow-sm)]">
              <meta.Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 font-display font-bold">{r.label}</p>
            <p className="mt-1 flex-1 text-sm text-muted">{r.reason}</p>
            {r.personal_note && <p className="mt-1 text-xs font-semibold text-mint-700">{r.personal_note}</p>}
            <button type="button" className={`${i === 0 ? 'btn-primary' : 'btn-secondary'} mt-3`} onClick={() => onStart(r.activity)}>
              Start
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* --------------------------------------------------------------- check-in */

const MOODS: { value: MBMood; label: string; Icon: typeof Smile }[] = [
  { value: 'very_low', label: 'Very low', Icon: Frown },
  { value: 'low', label: 'Low', Icon: Annoyed },
  { value: 'neutral', label: 'Neutral', Icon: Meh },
  { value: 'good', label: 'Good', Icon: Smile },
  { value: 'very_good', label: 'Very good', Icon: Laugh },
]
const CONDITIONS: { value: MBCondition; label: string }[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'overwhelmed', label: 'Overwhelmed' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'mentally_exhausted', label: 'Mentally exhausted' },
  { value: 'demotivated', label: 'Demotivated' },
  { value: 'unable_to_concentrate', label: 'Can’t concentrate' },
]
const PRESSURES: { value: MBPressure; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'very_high', label: 'Very high' },
]

function CheckInTab({ onSafety, onStart, go }: { onSafety: (s: MBSafety) => void; onStart: (a: MBActivity) => void; go: (t: TabId) => void }) {
  const [mood, setMood] = useState<MBMood | null>(null)
  const [stress, setStress] = useState(5)
  const [energy, setEnergy] = useState(5)
  const [condition, setCondition] = useState<MBCondition | null>(null)
  const [pressure, setPressure] = useState<MBPressure | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ state: Parameters<typeof StateBadge>[0]['state']; reasons: string[]; recs: MBRecommendation[] } | null>(null)

  async function submit() {
    if (!mood || !condition || !pressure) return setError('Please choose your mood, how your mind feels, and your academic pressure.')
    setBusy(true)
    setError(null)
    try {
      const r = await api.mb.checkIn({ mood, stress, energy, mental_condition: condition, academic_pressure: pressure, note: note.trim() || null })
      if (r.safety) onSafety(r.safety)
      setResult({ state: r.checkin.state, reasons: r.checkin.state_reasons, recs: r.recommendations })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (result)
    return (
      <div className="space-y-4">
        <section className="card">
          <p className="eyebrow">Your check-in</p>
          <div className="mt-2">
            <StateBadge state={result.state} size="lg" />
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {result.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </section>
        {result.recs.length > 0 && (
          <Panel title="You could try" icon={<Sparkles className="h-4.5 w-4.5" />}>
            <Recommendations recs={result.recs} onStart={onStart} />
          </Panel>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => go('plan')}>
            Adjust today's academic plan
          </button>
          <button type="button" className="btn-secondary" onClick={() => go('home')}>
            Done for now
          </button>
        </div>
      </div>
    )

  return (
    <div className="space-y-4">
      <section className="card space-y-6">
        <ChoiceGroup
          name="mb-mood"
          label="How is your mood right now?"
          value={mood}
          onChange={setMood}
          options={MOODS.map((m) => ({ value: m.value, label: m.label, icon: <m.Icon className="h-5 w-5" aria-hidden /> }))}
        />
        <Scale10 id="mb-stress" label="Stress level" value={stress} onChange={setStress} low="relaxed" high="extremely stressed" />
        <Scale10 id="mb-energy" label="Energy level" value={energy} onChange={setEnergy} low="drained" high="full of energy" />
      </section>
      <section className="card space-y-6">
        <fieldset>
          <legend className="field-label">How does your mind feel?</legend>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={condition === c.value}
                onClick={() => setCondition(c.value)}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  condition === c.value ? 'border-transparent bg-brand-600 text-surface' : 'border-line bg-surface hover:bg-surface-hover'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
        <ChoiceGroup name="mb-pressure" label="Academic pressure" value={pressure} onChange={setPressure} columns={4} options={PRESSURES} />
        <div>
          <label htmlFor="mb-note" className="field-label">
            Anything bothering you? <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea id="mb-note" className="input min-h-24" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write as much or as little as you like." />
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" aria-hidden /> {PRIVATE_NOTE}
          </p>
        </div>
      </section>
      {error && <ErrorBanner message={error} />}
      <button type="button" className="btn-primary w-full py-3 sm:w-auto" disabled={busy} onClick={() => void submit()}>
        {busy ? <Spinner className="text-surface" /> : 'Save check-in'}
      </button>
      <InfoNote>Self-reported, for balance and planning only. UniWell does not diagnose or assess mental health.</InfoNote>
    </div>
  )
}

/* --------------------------------------------------------------- recovery */

function ActivityPicker({ onPick }: { onPick: (a: MBActivity) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {(Object.keys(ACTIVITY_META) as MBActivity[]).map((a) => {
        const m = ACTIVITY_META[a]
        return (
          <button key={a} type="button" onClick={() => onPick(a)} className="card-interactive text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-mint-50 text-brand-600">
              <m.Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 font-display text-lg font-bold">{m.label}</p>
            <p className="mt-1 text-sm text-muted">{m.blurb}</p>
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- journal */

function JournalTab({ onSafety }: { onSafety: (s: MBSafety) => void }) {
  const { userId } = useApp()
  const [entries, setEntries] = useState<MBJournal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function load() {
    if (!userId) return
    try {
      setEntries(await api.mb.listJournal(userId))
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function remove(id: string) {
    try {
      await api.mb.deleteJournal(id)
      setEntries((e) => (e ?? []).filter((x) => x.id !== id))
      setConfirmId(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Thought unloading" icon={<NotebookPen className="h-4.5 w-4.5" />}>
        <JournalForm onSafety={onSafety} onSaved={() => void load()} />
      </Panel>
      <Panel title="Your past entries" icon={<Lock className="h-4.5 w-4.5" />}>
        {error && <ErrorBanner message={error} />}
        {!entries ? (
          <Spinner />
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted">No entries yet. Whatever you write stays private to you.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((j) => (
              <li key={j.id} className="rounded-2xl border border-line p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-faint">{formatDateTime(j.created_at)}</p>
                  {confirmId === j.id ? (
                    <span className="flex gap-1">
                      <button type="button" className="btn-danger px-3 py-1" onClick={() => void remove(j.id)}>
                        Delete
                      </button>
                      <button type="button" className="btn-secondary px-3 py-1" onClick={() => setConfirmId(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn-ghost px-2 py-1 text-over-700" aria-label="Delete entry" onClick={() => setConfirmId(j.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{j.bothering ?? '(could not decrypt)'}</p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                  {j.in_control && (
                    <div className="rounded-xl bg-ok-50 p-2.5">
                      <dt className="text-xs font-semibold text-ok-700">In my control</dt>
                      <dd>{j.in_control}</dd>
                    </div>
                  )}
                  {j.outside_control && (
                    <div className="rounded-xl bg-surface-alt p-2.5">
                      <dt className="text-xs font-semibold text-muted">Outside my control</dt>
                      <dd>{j.outside_control}</dd>
                    </div>
                  )}
                  {j.small_action && (
                    <div className="rounded-xl bg-brand-50 p-2.5">
                      <dt className="text-xs font-semibold text-brand-700">One small action</dt>
                      <dd>{j.small_action}</dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

/* --------------------------------------------------------------- insights */

const ACT_LABEL: Record<string, string> = Object.fromEntries(Object.entries(ACTIVITY_META).map(([k, v]) => [k, v.label]))

function InsightsTab() {
  const { userId } = useApp()
  const [d, setD] = useState<MBInsights | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!userId) return
    api.mb.insights(userId).then(setD).catch((e) => setError(errorMessage(e)))
  }, [userId])

  if (error) return <ErrorBanner message={error} />
  if (!d) return <PageLoader />
  const pal = chartColors()
  const violet = getComputedStyle(document.documentElement).getPropertyValue('--color-violet-500').trim()
  const mint = getComputedStyle(document.documentElement).getPropertyValue('--color-mint-500').trim()

  if (d.days_with_checkins === 0)
    return (
      <EmptyState
        icon={<BarChart3 className="h-7 w-7" />}
        title="No patterns yet"
        body={`Insights appear after a few MindBalance check-ins (observations need at least ${d.min_days_for_observations} days). Nothing here is invented.`}
        action={
          <a className="btn-primary" href="#/mindbalance/checkin">
            Start check-in
          </a>
        }
      />
    )

  const usage = Object.entries(d.recovery_usage)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={`Days checked in (${d.window_days} d)`} value={`${d.days_with_checkins}`} hint={`${d.consistency_pct}% consistency`} />
        <Stat label="Check-ins" value={d.total_checkins} />
        <Stat label="Recovery activities" value={usage.reduce((a, [, n]) => a + n, 0)} />
        <Stat
          label="Avg change after recovery"
          value={d.average_change_after_recovery ? `${d.average_change_after_recovery.stress > 0 ? '+' : ''}${d.average_change_after_recovery.stress} stress` : '—'}
          hint={d.average_change_after_recovery ? `n = ${d.average_change_after_recovery.sessions} rated sessions` : 'Rate activities to see this'}
        />
      </div>

      <Panel title="What your entries show" icon={<Sparkles className="h-4.5 w-4.5" />}>
        {d.observations.length === 0 ? (
          <p className="text-sm text-muted">Not enough data for observations yet. Keep checking in — MindBalance only describes patterns once there is enough data.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {d.observations.map((o) => (
              <li key={o.text} className="rounded-xl bg-surface-alt/70 p-3">
                {o.text} <span className="text-xs text-faint">(n = {o.sample_size} · {o.kind.replace(/_/g, ' ')})</span>
              </li>
            ))}
          </ul>
        )}
        <InfoNote className="mt-3">Observed patterns in what you reported — not causes, labels or a diagnosis.</InfoNote>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Stress & energy · last ${d.window_days} days`}>
          <div style={{ height: 200 }} role="img" aria-label={`Stress and energy by day: ${d.days.filter((x) => x.count).map((x) => `${x.weekday} stress ${x.stress} energy ${x.energy}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.days} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={pal.grid} vertical={false} />
                <XAxis dataKey="weekday" tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={{ stroke: pal.grid }} />
                <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: pal.grid, fontSize: 12 }} labelFormatter={(_l, p) => (p?.[0]?.payload?.local_date as string) ?? ''} />
                <Line name="Stress" type="linear" dataKey="stress" stroke={violet} strokeWidth={2} dot={{ r: 4, fill: pal.surface, strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
                <Line name="Energy" type="linear" dataKey="energy" stroke={mint} strokeWidth={2} dot={{ r: 4, fill: pal.surface, strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-violet-500" aria-hidden /> Stress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-mint-500" aria-hidden /> Energy
            </span>
          </div>
        </Panel>
        <Panel title="Stress vs energy">
          {d.scatter.length < 3 ? (
            <p className="text-sm text-muted">Needs at least 3 check-in days.</p>
          ) : (
            <div style={{ height: 200 }} role="img" aria-label={`Each dot is one day: ${d.scatter.map((p) => `stress ${p.stress}, energy ${p.energy}`).join('; ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 8, bottom: 10, left: -20 }}>
                  <CartesianGrid stroke={pal.grid} />
                  <XAxis type="number" dataKey="stress" name="Stress" domain={[0, 10]} tick={{ fontSize: 11, fill: pal.muted }} label={{ value: 'stress', position: 'insideBottomRight', fontSize: 11, fill: pal.muted, offset: -4 }} />
                  <YAxis type="number" dataKey="energy" name="Energy" domain={[0, 10]} tick={{ fontSize: 11, fill: pal.muted }} />
                  <ZAxis range={[80, 80]} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: pal.grid, fontSize: 12 }} />
                  <Scatter data={d.scatter} fill={pal.series} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Recovery activities you've used">
        {usage.length === 0 ? (
          <p className="text-sm text-muted">No completed activities yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {usage.map(([a, n]) => {
              const h = d.recovery_helpfulness[a] ?? {}
              return (
                <li key={a} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                  <span className="font-semibold">{ACT_LABEL[a] ?? a}</span>
                  <span className="text-muted">
                    {n}× · helpful: {h.yes ?? 0} yes, {h.somewhat ?? 0} somewhat, {h.no ?? 0} no
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------ adaptive plan */

function PlanTab({ go }: { go: (t: TabId) => void }) {
  const [adj, setAdj] = useState<MBAdjustment | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [applied, setApplied] = useState<string[] | null>(null)

  async function propose() {
    setBusy(true)
    setError(null)
    setApplied(null)
    try {
      const r = await api.mb.propose()
      setAdj(r.adjustment)
      setMessage(r.summary)
      setPicked(new Set((r.adjustment?.changes ?? []).filter((c) => ['recovery_first', 'lighter_sessions', 'focus'].includes(c.type)).map((c) => c.id)))
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'unknown', errorMessage(err)))
    } finally {
      setBusy(false)
    }
  }

  async function decide(accept: boolean) {
    if (!adj) return
    setBusy(true)
    try {
      const r = await api.mb.decide(adj.id, accept ? [...picked] : [])
      setAdj(r.adjustment)
      setApplied(r.applied)
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'unknown', errorMessage(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Wellbeing-aware schedule" icon={<CalendarCheck className="h-4.5 w-4.5" />}>
        <p className="text-sm text-muted">
          MindBalance compares today's check-in with your real tasks and deadlines and suggests changes. <strong className="text-ink">Nothing changes until you confirm.</strong> Deadlines never move and tasks are never deleted.
        </p>
        <button type="button" className="btn-primary mt-4" disabled={busy} onClick={() => void propose()}>
          {busy && !adj ? <Spinner className="text-surface" /> : <Sparkles className="h-4 w-4" aria-hidden />} Suggest adjustments
        </button>
      </Panel>

      {error &&
        (error.code === 'wellbeing_checkin_required' ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-warn-50 p-4 text-sm text-warn-700">
            {error.message}
            <button type="button" className="btn-secondary" onClick={() => go('checkin')}>
              Check in
            </button>
          </div>
        ) : (
          <ErrorBanner message={error.message} />
        ))}

      {message && !adj && <SuccessBanner>{message}</SuccessBanner>}

      {adj && (
        <section className="card space-y-4" aria-labelledby="adj-title">
          <div>
            <h2 id="adj-title" className="text-lg font-extrabold">
              {adj.status === 'pending' ? 'Proposed changes' : adj.status === 'applied' ? 'Applied for today' : 'Dismissed'}
            </h2>
            <p className="mt-1 text-sm text-muted">{adj.summary}</p>
          </div>
          <ul className="space-y-2">
            {adj.changes.map((c) => {
              const on = adj.status === 'pending' ? picked.has(c.id) : !!c.accepted
              return (
                <li key={c.id}>
                  <label className={`flex gap-3 rounded-2xl border p-4 ${on ? 'border-brand-200 bg-brand-50/50' : 'border-line'} ${adj.status === 'pending' ? 'cursor-pointer' : ''}`}>
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-brand-600"
                      checked={on}
                      disabled={adj.status !== 'pending'}
                      onChange={() =>
                        setPicked((p) => {
                          const n = new Set(p)
                          if (n.has(c.id)) n.delete(c.id)
                          else n.add(c.id)
                          return n
                        })
                      }
                    />
                    <span>
                      <span className="block font-semibold">{c.title}</span>
                      <span className="block text-sm text-ink/85">{c.detail}</span>
                      <span className="mt-1 block text-xs text-muted">Why: {c.reason}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {adj.status === 'pending' ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void decide(true)}>
                Apply {picked.size} selected
              </button>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => void decide(false)}>
                Keep my schedule as it is
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {applied && applied.length > 0 && <SuccessBanner>{applied.join(' ')}</SuccessBanner>}
              {adj.status === 'applied' && (
                <button type="button" className="btn-primary" onClick={() => navigate('plan')}>
                  Generate today's adaptive plan →
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
