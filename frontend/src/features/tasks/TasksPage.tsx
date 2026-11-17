import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Check, ListChecks, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../lib/appState'
import { useT } from '../../lib/i18n'
import { formatDeadline, formatMinutes } from '../../lib/format'
import type { Task } from '../../types/api'
import { EmptyState, ErrorBanner, PageHeader, PageLoader, SyntheticBadge } from '../../components/ui'
import { TaskForm } from './TaskForm'

type Filter = 'active' | 'today' | 'upcoming' | 'overdue' | 'completed'
const FILTERS: Filter[] = ['active', 'today', 'upcoming', 'overdue', 'completed']
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString()
}

function matches(task: Task, f: Filter): boolean {
  const done = task.status === 'completed'
  switch (f) {
    case 'active':
      return !done
    case 'today':
      return !done && isToday(task.deadline)
    case 'upcoming':
      return !done && !task.is_overdue && !isToday(task.deadline)
    case 'overdue':
      return task.is_overdue
    case 'completed':
      return done
  }
}

export function TasksPage() {
  const { t } = useT()
  const { userId, dataVersion } = useApp()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('active')
  const [sort, setSort] = useState<'deadline' | 'priority'>('deadline')
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      setTasks(await api.listTasks(userId))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dataVersion])

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, tasks.filter((x) => matches(x, f)).length])), [tasks])

  const visible = useMemo(() => {
    const list = tasks.filter((x) => matches(x, filter))
    return list.sort((a, b) => {
      if (sort === 'priority') {
        const d = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        if (d) return d
      }
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    })
  }, [tasks, filter, sort])

  async function toggleDone(task: Task) {
    setBusyId(task.id)
    setActionError(null)
    try {
      const updated = await api.updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' })
      setTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    setBusyId(id)
    setActionError(null)
    try {
      await api.deleteTask(id)
      setTasks((prev) => prev.filter((x) => x.id !== id))
      setConfirmDelete(null)
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('tasks.title')}
        subtitle={t('tasks.subtitle')}
        actions={
          editing === null && (
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" aria-hidden /> {t('tasks.add')}
            </button>
          )
        }
      />

      {editing !== null && (
        <div className="mb-5">
          <TaskForm
            key={editing === 'new' ? 'new' : editing.id}
            task={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onDone={(saved) => {
              setTasks((prev) => (prev.some((x) => x.id === saved.id) ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved]))
              setEditing(null)
            }}
          />
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : tasks.length === 0 ? (
        editing === null && (
          <EmptyState
            icon={<ListChecks className="h-8 w-8" />}
            title={t('tasks.empty')}
            body={t('tasks.emptyAll')}
            action={
              <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4" aria-hidden /> {t('tasks.add')}
              </button>
            }
          />
        )
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Task filters" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface p-1 ring-1 ring-line">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  role="tab"
                  type="button"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    filter === f ? 'bg-brand-600 text-white' : 'text-muted hover:bg-brand-50'
                  }`}
                >
                  {t(`tasks.filter.${f}`)} <span className="opacity-75">{counts[f]}</span>
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="task-sort">
              Sort
            </label>
            <select id="task-sort" className="input w-auto py-2" value={sort} onChange={(e) => setSort(e.target.value as 'deadline' | 'priority')}>
              <option value="deadline">{t('tasks.sort.deadline')}</option>
              <option value="priority">{t('tasks.sort.priority')}</option>
            </select>
          </div>

          {actionError && (
            <div className="mb-3">
              <ErrorBanner message={actionError} />
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState title={t('tasks.empty')} />
          ) : (
            <ul className="space-y-2">
              {visible.map((task) => {
                const done = task.status === 'completed'
                return (
                  <li key={task.id} className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${done ? 'opacity-70' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`font-semibold break-words ${done ? 'line-through' : ''}`}>{task.title}</p>
                        {task.is_overdue && (
                          <span className="chip bg-over-50 text-over-700">
                            <AlertTriangle className="h-3 w-3" aria-hidden /> {t('tasks.overdue')}
                          </span>
                        )}
                        {task.is_synthetic && <SyntheticBadge />}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {formatDeadline(task.deadline)}
                        </span>
                        <span>{formatMinutes(task.estimated_minutes)}</span>
                        <span>{t(`type.${task.task_type}`)}</span>
                        {task.subject && <span>{task.subject}</span>}
                        <span className={task.priority === 'high' ? 'font-semibold text-brand-700' : ''}>
                          {t('tasks.fPriority')}: {t(`priority.${task.priority}`)}
                        </span>
                        {task.status === 'in_progress' && <span className="text-mint-700">{t('status.in_progress')}</span>}
                      </p>
                    </div>
                    {confirmDelete === task.id ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-over-50 p-2 text-sm">
                        <span className="text-over-700">{t('tasks.confirmDelete')}</span>
                        <button type="button" className="btn-danger px-3 py-1.5" disabled={busyId === task.id} onClick={() => void remove(task.id)}>
                          {t('common.delete')}
                        </button>
                        <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => setConfirmDelete(null)}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 gap-1.5">
                        <button type="button" className="btn-secondary px-3 py-2" disabled={busyId === task.id} onClick={() => void toggleDone(task)}>
                          {done ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                          <span className="hidden sm:inline">{done ? t('tasks.markUndone') : t('tasks.markDone')}</span>
                          <span className="sr-only sm:hidden">{done ? t('tasks.markUndone') : t('tasks.markDone')}</span>
                        </button>
                        <button type="button" className="btn-ghost px-3 py-2" aria-label={`${t('common.edit')}: ${task.title}`} onClick={() => setEditing(task)}>
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" className="btn-ghost px-3 py-2 text-over-700 hover:bg-over-50" aria-label={`${t('common.delete')}: ${task.title}`} onClick={() => setConfirmDelete(task.id)}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
