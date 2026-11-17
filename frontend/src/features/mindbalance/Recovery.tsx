import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Footprints, Hand, Lock, NotebookPen, Pause, Play, Sparkles, Wind } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { prefersReducedMotion } from '../../lib/motion'
import type { MBActivity, MBSafety, Task } from '../../types/api'
import { ChoiceGroup, ErrorBanner, InfoNote, Spinner, SuccessBanner } from '../../components/ui'
import { PRIVATE_NOTE, Scale10 } from './shared'

export const ACTIVITY_META: Record<MBActivity, { label: string; Icon: typeof Wind; blurb: string }> = {
  breathing: { label: 'Guided breathing', Icon: Wind, blurb: 'A slow, paced breathing animation. 2 or 5 minutes.' },
  grounding: { label: '5-4-3-2-1 grounding', Icon: Hand, blurb: 'Notice what you can see, feel, hear, smell and taste.' },
  journal: { label: 'Thought unloading', Icon: NotebookPen, blurb: 'Separate what you can and can’t control.' },
  energy: { label: 'Mental energy recovery', Icon: Footprints, blurb: 'A short walk, stretch, water or quiet rest.' },
  motivation: { label: 'Motivation reset', Icon: Sparkles, blurb: 'Turn a big task into small, doable steps.' },
}

/* ------------------------------------------------------------ the flow */

type Phase = 'before' | 'activity' | 'after' | 'done'

export function RecoveryFlow({ activity, onExit, onSafety }: { activity: MBActivity; onExit: () => void; onSafety: (s: MBSafety) => void }) {
  const meta = ACTIVITY_META[activity]
  const [phase, setPhase] = useState<Phase>('before')
  const [pre, setPre] = useState({ stress: 6, energy: 4 })
  const [post, setPost] = useState({ stress: 5, energy: 5 })
  const [helpful, setHelpful] = useState<'yes' | 'somewhat' | 'no' | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [steps, setSteps] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start(skipRating: boolean) {
    setBusy(true)
    setError(null)
    try {
      const s = await api.mb.startSession({
        activity,
        pre_stress: skipRating ? null : pre.stress,
        pre_energy: skipRating ? null : pre.energy,
      })
      setSessionId(s.id)
      setPost({ ...pre })
      setPhase('activity')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function finish(status: 'completed' | 'skipped') {
    if (!sessionId) return onExit()
    setBusy(true)
    setError(null)
    try {
      await api.mb.finishSession(sessionId, {
        status,
        post_stress: status === 'completed' ? post.stress : null,
        post_energy: status === 'completed' ? post.energy : null,
        helpful: status === 'completed' ? helpful : null,
        steps_completed: steps,
      })
      if (status === 'skipped') onExit()
      else setPhase('done')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card space-y-5" aria-labelledby="flow-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="flow-title" className="flex items-center gap-2 text-lg font-extrabold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-50 text-mint-700">
            <meta.Icon className="h-5 w-5" aria-hidden />
          </span>
          {meta.label}
        </h2>
        <button type="button" className="btn-ghost" onClick={() => (phase === 'activity' ? void finish('skipped') : onExit())}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> {phase === 'done' ? 'Back' : 'Stop — that’s okay'}
        </button>
      </div>

      {phase === 'before' && (
        <div className="space-y-5">
          <p className="text-sm text-muted">Quick before-rating so you can see how you feel afterwards. You can skip it.</p>
          <Scale10 id="pre-stress" label="Stress right now" value={pre.stress} onChange={(v) => setPre({ ...pre, stress: v })} low="calm" high="very stressed" />
          <Scale10 id="pre-energy" label="Energy right now" value={pre.energy} onChange={(v) => setPre({ ...pre, energy: v })} low="drained" high="energised" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void start(false)}>
              {busy ? <Spinner className="text-surface" /> : <Play className="h-4 w-4" aria-hidden />} Start
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void start(true)}>
              Skip rating
            </button>
          </div>
        </div>
      )}

      {phase === 'activity' && (
        <div className="space-y-5">
          {activity === 'breathing' && <Breathing />}
          {activity === 'grounding' && <Grounding onSteps={setSteps} />}
          {activity === 'journal' && <JournalForm sessionId={sessionId} onSafety={onSafety} compact />}
          {activity === 'energy' && <EnergyRecovery />}
          {activity === 'motivation' && <MotivationReset onSteps={setSteps} />}
          <button type="button" className="btn-primary" onClick={() => setPhase('after')}>
            <Check className="h-4 w-4" aria-hidden /> I’m done
          </button>
        </div>
      )}

      {phase === 'after' && (
        <div className="space-y-5">
          <p className="font-display text-xl font-bold">How are you feeling now?</p>
          <Scale10 id="post-stress" label="Stress now" value={post.stress} onChange={(v) => setPost({ ...post, stress: v })} low="calm" high="very stressed" />
          <Scale10 id="post-energy" label="Energy now" value={post.energy} onChange={(v) => setPost({ ...post, energy: v })} low="drained" high="energised" />
          <ChoiceGroup
            name="helpful"
            label="Was this helpful?"
            value={helpful}
            onChange={setHelpful}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'somewhat', label: 'Somewhat' },
              { value: 'no', label: 'Not really' },
            ]}
          />
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void finish('completed')}>
            {busy ? <Spinner className="text-surface" /> : 'Save how I feel'}
          </button>
        </div>
      )}

      {phase === 'done' && (
        <SuccessBanner>
          <p className="font-semibold">Saved. Thank you for taking a moment for yourself.</p>
          <p className="mt-1 text-sm">Your ratings help MindBalance show which activities you personally find useful. It’s fine if this one didn’t help — try another, or just rest.</p>
        </SuccessBanner>
      )}
      {error && <ErrorBanner message={error} />}
      <InfoNote>General wellbeing suggestions, not treatment. They may not help every time, and you can stop whenever you like.</InfoNote>
    </section>
  )
}

/* ------------------------------------------------------------ breathing */

const PHASES = [
  { label: 'Breathe in', secs: 4, scale: 1 },
  { label: 'Hold', secs: 2, scale: 1 },
  { label: 'Breathe out', secs: 6, scale: 0.55 },
]

function Breathing() {
  const [minutes, setMinutes] = useState(2)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const reduced = prefersReducedMotion()
  const total = minutes * 60
  const left = Math.max(0, total - elapsed)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(id)
  }, [running])
  useEffect(() => {
    if (running && elapsed >= total) setRunning(false)
  }, [running, elapsed, total])

  // 12-second cycle: in 4 · hold 2 · out 6
  const t = elapsed % 12
  const phaseIdx = t < 4 ? 0 : t < 6 ? 1 : 2
  const phaseLeft = phaseIdx === 0 ? 4 - t : phaseIdx === 1 ? 6 - t : 12 - t
  const phase = PHASES[phaseIdx]
  const scale = running ? phase.scale : 0.7
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-2" role="group" aria-label="Session length">
        {[2, 5].map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={minutes === m}
            disabled={running}
            onClick={() => {
              setMinutes(m)
              setElapsed(0)
            }}
            className={`btn ${minutes === m ? 'bg-brand-600 text-surface' : 'border border-line bg-surface'}`}
          >
            {m} min
          </button>
        ))}
      </div>
      <div className="relative flex h-64 w-64 items-center justify-center" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-100 via-violet-400/20 to-mint-100" />
        <div
          className="absolute inset-6 rounded-full bg-gradient-to-br from-brand-500 via-violet-500 to-mint-500 opacity-80 shadow-[var(--shadow-glow)]"
          style={{
            transform: `scale(${scale})`,
            transition: reduced ? 'none' : `transform ${running ? phase.secs : 0.6}s ease-in-out`,
          }}
        />
        <span className="relative font-display text-xl font-extrabold text-surface drop-shadow">{running ? phase.label : 'Ready'}</span>
      </div>
      <p className="font-display text-3xl font-extrabold tabular" aria-live="off">
        {mm}:{ss}
      </p>
      <p className="sr-only" aria-live="polite">
        {running ? `${phase.label}, ${phaseLeft} seconds` : ''}
      </p>
      <p className="max-w-sm text-center text-sm text-muted">
        Breathe in through your nose for 4, hold gently for 2, breathe out slowly for 6. If anything feels uncomfortable, return to normal breathing.
      </p>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          if (left === 0) setElapsed(0)
          setRunning((r) => !r)
        }}
      >
        {running ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        {running ? 'Pause' : left === 0 ? 'Start again' : 'Start breathing'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------ grounding */

const GROUNDING = [
  { n: 5, sense: 'see', prompt: 'Name 5 things you can see around you.' },
  { n: 4, sense: 'feel', prompt: 'Notice 4 things you can feel (your chair, your feet, the air…).' },
  { n: 3, sense: 'hear', prompt: 'Listen for 3 things you can hear.' },
  { n: 2, sense: 'smell', prompt: 'Find 2 things you can smell (or 2 smells you like).' },
  { n: 1, sense: 'taste', prompt: 'Notice 1 thing you can taste.' },
]

function Grounding({ onSteps }: { onSteps: (n: number) => void }) {
  const [step, setStep] = useState(0)
  const [ticks, setTicks] = useState<boolean[]>(Array(5).fill(false))
  const done = step >= GROUNDING.length
  const cur = GROUNDING[Math.min(step, GROUNDING.length - 1)]

  useEffect(() => onSteps(step), [step, onSteps])

  if (done)
    return (
      <SuccessBanner>
        <p className="font-semibold">All five steps done. Take one more slow breath before you continue.</p>
      </SuccessBanner>
    )
  return (
    <div>
      <ol className="mb-4 flex gap-1.5" aria-label="Progress">
        {GROUNDING.map((g, i) => (
          <li key={g.sense} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-mint-500' : i === step ? 'bg-brand-500' : 'bg-surface-alt'}`} />
        ))}
      </ol>
      <p className="eyebrow">Step {step + 1} of 5 · {cur.sense}</p>
      <p className="mt-1 font-display text-xl font-bold">{cur.prompt}</p>
      <p className="mt-1 text-xs text-muted">Just notice them — you don’t need to type anything. Nothing here is saved.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: cur.n }).map((_, i) => (
          <button
            key={`${step}-${i}`}
            type="button"
            aria-pressed={ticks[i]}
            onClick={() => setTicks((t) => t.map((v, k) => (k === i ? !v : v)))}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-lg font-bold transition-colors ${
              ticks[i] ? 'border-transparent bg-mint-500 text-surface' : 'border-line bg-surface hover:bg-surface-hover'
            }`}
          >
            {ticks[i] ? <Check className="check-pop h-5 w-5" aria-hidden /> : i + 1}
            <span className="sr-only">{`thing ${i + 1}`}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn-secondary mt-4"
        onClick={() => {
          setStep((s) => s + 1)
          setTicks(Array(5).fill(false))
        }}
      >
        {step === GROUNDING.length - 1 ? 'Finish' : 'Next step'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------ journal */

export function JournalForm({ sessionId, onSafety, onSaved, compact = false }: { sessionId?: string | null; onSafety: (s: MBSafety) => void; onSaved?: () => void; compact?: boolean }) {
  const [f, setF] = useState({ bothering: '', in_control: '', outside_control: '', small_action: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const Q: { key: keyof typeof f; label: string; hint: string }[] = [
    { key: 'bothering', label: 'What is currently bothering you?', hint: 'Write freely. Only you can see this.' },
    { key: 'in_control', label: 'What is within your control?', hint: 'e.g. starting early, asking a question' },
    { key: 'outside_control', label: 'What is outside your control?', hint: 'e.g. the exam date, other people’s choices' },
    { key: 'small_action', label: 'What is one small action you can take?', hint: 'Something you could do in 10 minutes' },
  ]

  async function save() {
    if (!f.bothering.trim()) return setError('Please write at least a few words in the first box.')
    setBusy(true)
    setError(null)
    try {
      const res = await api.mb.saveJournal({ ...f, session_id: sessionId ?? null })
      setSaved(true)
      if (res.safety) onSafety(res.safety)
      setF({ bothering: '', in_control: '', outside_control: '', small_action: '' })
      onSaved?.()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {Q.map((q) => (
        <div key={q.key}>
          <label htmlFor={`j-${q.key}`} className="field-label">
            {q.label}
          </label>
          <textarea
            id={`j-${q.key}`}
            className={`input ${q.key === 'bothering' && !compact ? 'min-h-28' : 'min-h-20'}`}
            maxLength={q.key === 'small_action' ? 500 : 2000}
            placeholder={q.hint}
            value={f[q.key]}
            onChange={(e) => setF({ ...f, [q.key]: e.target.value })}
          />
        </div>
      ))}
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Lock className="h-3.5 w-3.5" aria-hidden /> {PRIVATE_NOTE}
      </p>
      {error && <ErrorBanner message={error} />}
      {saved && <SuccessBanner>Saved privately.</SuccessBanner>}
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => void save()}>
        {busy ? <Spinner /> : <NotebookPen className="h-4 w-4" aria-hidden />} Save entry
      </button>
    </div>
  )
}

/* ------------------------------------------------------------ energy */

const ENERGY = [
  { id: 'walk', label: 'Short walk', text: 'Walk for 5 minutes — even around the room or corridor.', minutes: 5 },
  { id: 'stretch', label: 'Stretching', text: 'Roll your shoulders, stretch your arms and neck gently.', minutes: 3 },
  { id: 'water', label: 'Hydration', text: 'Drink a glass of water slowly.', minutes: 2 },
  { id: 'screen', label: 'Screen break', text: 'Look at something far away; rest your eyes from screens.', minutes: 3 },
  { id: 'rest', label: 'Quiet rest', text: 'Sit or lie down quietly with your eyes closed.', minutes: 5 },
  { id: 'mindful', label: 'Mindful minute', text: 'Notice your breathing and the sounds around you for a minute.', minutes: 1 },
]

function EnergyRecovery() {
  const [pick, setPick] = useState<string | null>(null)
  const [left, setLeft] = useState(0)
  const timer = useRef<number | null>(null)
  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current)
  }, [])
  function start(minutes: number) {
    if (timer.current) window.clearInterval(timer.current)
    setLeft(minutes * 60)
    timer.current = window.setInterval(() => setLeft((l) => (l <= 1 ? (window.clearInterval(timer.current!), 0) : l - 1)), 1000)
  }
  const chosen = ENERGY.find((e) => e.id === pick)
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {ENERGY.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={pick === e.id}
            onClick={() => setPick(e.id)}
            className={`rounded-2xl border p-3 text-left transition-colors ${pick === e.id ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface hover:bg-surface-hover'}`}
          >
            <p className="font-semibold">{e.label}</p>
            <p className="text-xs text-muted">{e.minutes} min</p>
          </button>
        ))}
      </div>
      {chosen && (
        <div className="rounded-2xl bg-surface-alt/70 p-4">
          <p className="text-sm">{chosen.text}</p>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" className="btn-secondary" onClick={() => start(chosen.minutes)}>
              <Play className="h-4 w-4" aria-hidden /> Start {chosen.minutes}-min timer
            </button>
            {left > 0 && (
              <span className="font-display text-2xl font-extrabold tabular">
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ motivation */

function MotivationReset({ onSteps }: { onSteps: (n: number) => void }) {
  const { userId } = useApp()
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [taskId, setTaskId] = useState<string>('')
  const [steps, setSteps] = useState<string[]>([])
  const [done, setDone] = useState<boolean[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    api.listTasks(userId).then((t) => setTasks(t.filter((x) => x.status !== 'completed'))).catch((e) => setError(errorMessage(e)))
  }, [userId])

  useEffect(() => onSteps(done.filter(Boolean).length), [done, onSteps])

  async function choose(id: string) {
    setTaskId(id)
    if (!id) return
    try {
      const r = await api.mb.microSteps(id)
      setSteps(r.steps)
      setDone(r.steps.map(() => false))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (error) return <ErrorBanner message={error} />
  if (!tasks) return <Spinner />
  if (tasks.length === 0) return <p className="text-sm text-muted">No pending tasks. Add one in Tasks, or simply enjoy a lighter moment.</p>
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="mot-task" className="field-label">
          Which task feels overwhelming?
        </label>
        <select id="mot-task" className="input" value={taskId} onChange={(e) => void choose(e.target.value)}>
          <option value="">Choose a task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      {steps.length > 0 && (
        <div>
          <p className="text-sm text-muted">You don’t need to do it all. Start with step 1 — ticking even one is progress.</p>
          <ul className="mt-2 space-y-2">
            {steps.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={done[i]}
                  onClick={() => setDone((d) => d.map((v, k) => (k === i ? !v : v)))}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm ${done[i] ? 'border-mint-400/40 bg-mint-50' : 'border-line hover:bg-surface-hover'}`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done[i] ? 'bg-mint-500 text-surface' : 'border-2 border-line-strong'}`}>
                    {done[i] && <Check className="check-pop h-4 w-4" aria-hidden />}
                  </span>
                  <span className={done[i] ? 'text-muted line-through' : ''}>{s}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Want this split in your schedule? Use the Adaptive Plan tab — changes only happen after you confirm.</p>
        </div>
      )}
    </div>
  )
}
