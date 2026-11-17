import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { defaultDeadlineValue, fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/format'
import type { Priority, Task, TaskStatus, TaskType } from '../../types/api'
import { ErrorBanner, Spinner } from '../../components/ui'

const TYPES: TaskType[] = ['assignment', 'quiz', 'exam', 'project', 'reading', 'other']
const PRIORITIES: Priority[] = ['low', 'medium', 'high']
const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed']
const QUICK_MINUTES = [30, 60, 90, 120]

export function TaskForm({ task, onDone, onCancel }: { task: Task | null; onDone: (t: Task) => void; onCancel: () => void }) {
  const { t } = useT()
  const [title, setTitle] = useState(task?.title ?? '')
  const [subject, setSubject] = useState(task?.subject ?? '')
  const [type, setType] = useState<TaskType>(task?.task_type ?? 'assignment')
  const [deadline, setDeadline] = useState(task ? toDatetimeLocalValue(task.deadline) : defaultDeadlineValue())
  const [minutes, setMinutes] = useState(String(task?.estimated_minutes ?? 60))
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const mins = Number(minutes)
    if (!title.trim()) return setError('Please enter a title.')
    if (!deadline) return setError('Please choose a deadline.')
    if (!Number.isInteger(mins) || mins < 5 || mins > 720) return setError('Estimated minutes must be between 5 and 720.')
    setSaving(true)
    try {
      const body = {
        title: title.trim(),
        subject: subject.trim() || null,
        task_type: type,
        deadline: fromDatetimeLocalValue(deadline),
        estimated_minutes: mins,
        priority,
        status,
      }
      const saved = task ? await api.updateTask(task.id, body) : await api.createTask(body)
      onDone(saved)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 border-brand-200" noValidate aria-label={task ? t('tasks.edit') : t('tasks.add')}>
      <h2 className="text-lg font-semibold">{task ? t('tasks.edit') : t('tasks.add')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="t-title" className="field-label">
            {t('tasks.fTitle')} *
          </label>
          <input id="t-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DBMS assignment 3" autoFocus />
        </div>
        <div>
          <label htmlFor="t-subject" className="field-label">
            {t('tasks.fSubject')} <span className="font-normal text-muted">({t('common.optional')})</span>
          </label>
          <input id="t-subject" className="input" maxLength={80} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label htmlFor="t-type" className="field-label">
            {t('tasks.fType')}
          </label>
          <select id="t-type" className="input" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
            {TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`type.${x}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="t-deadline" className="field-label">
            {t('tasks.fDeadline')} *
          </label>
          <input id="t-deadline" type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div>
          <label htmlFor="t-min" className="field-label">
            {t('tasks.fMinutes')} *
          </label>
          <input id="t-min" type="number" inputMode="numeric" min={5} max={720} className="input" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_MINUTES.map((m) => (
              <button key={m} type="button" className="chip border border-line bg-canvas text-muted hover:bg-brand-50" onClick={() => setMinutes(String(m))}>
                {m} min
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="t-priority" className="field-label">
            {t('tasks.fPriority')}
          </label>
          <select id="t-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((x) => (
              <option key={x} value={x}>
                {t(`priority.${x}`)}
              </option>
            ))}
          </select>
        </div>
        {task && (
          <div>
            <label htmlFor="t-status" className="field-label">
              {t('tasks.fStatus')}
            </label>
            <select id="t-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {STATUSES.map((x) => (
                <option key={x} value={x}>
                  {t(`status.${x}`)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Spinner className="text-white" label={t('common.loading')} /> : t('common.save')}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
