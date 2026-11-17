import type {
  CheckInInput,
  CheckInList,
  CheckIn,
  DemoSeedResult,
  FeedbackInput,
  FeedbackResult,
  GenerateResult,
  Health,
  Insights,
  PlanDetail,
  PlanHistory,
  PlanItem,
  Profile,
  ProfileInput,
  Radar,
  Resource,
  Task,
  TaskInput,
} from '../types/api'
import { getUserId } from './session'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {}
  const uid = getUserId()
  if (uid) headers['X-User-Id'] = uid
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError(0, 'network_error', 'Cannot reach the UniWell server. Is the backend running?')
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(res.status, err?.code ?? 'http_error', err?.message ?? `Request failed (${res.status})`)
  }
  return data as T
}

export const api = {
  health: () => request<Health>('GET', '/health'),

  saveProfile: (body: ProfileInput) => request<Profile>('POST', '/profile', body),
  getProfile: (uid: string) => request<Profile>('GET', `/profile/${uid}`),
  resetAdaptation: (uid: string) => request<Profile>('POST', `/profile/${uid}/reset-adaptation`),
  deleteData: (uid: string) =>
    request<{ deleted: boolean; records_removed: Record<string, number> }>('DELETE', `/user/${uid}/data`),

  saveCheckIn: (body: CheckInInput) =>
    request<{ checkin: CheckIn; updated_existing: boolean }>('POST', '/checkins', body),
  listCheckIns: (uid: string, days = 30) => request<CheckInList>('GET', `/checkins/${uid}?days=${days}`),

  listTasks: (uid: string) => request<Task[]>('GET', `/tasks/${uid}`),
  createTask: (body: TaskInput) => request<Task>('POST', '/tasks', body),
  updateTask: (id: string, body: Partial<TaskInput>) => request<Task>('PATCH', `/tasks/${id}`, body),
  deleteTask: (id: string) => request<{ deleted: boolean }>('DELETE', `/tasks/${id}`),

  radar: (uid: string) => request<Radar>('GET', `/radar/${uid}`),

  generatePlan: (uid: string, note: string | null, signal?: AbortSignal) =>
    request<GenerateResult>('POST', '/plans/generate', { user_id: uid, note }, signal),
  listPlans: (uid: string) => request<PlanHistory>('GET', `/plans/${uid}`),
  getPlan: (planId: string) => request<PlanDetail>('GET', `/plans/detail/${planId}`),
  setItemCompleted: (itemId: string, completed: boolean) =>
    request<PlanItem>('PATCH', `/plan-items/${itemId}`, { completed }),

  submitFeedback: (body: FeedbackInput) => request<FeedbackResult>('POST', '/feedback', body),

  insights: (uid: string) => request<Insights>('GET', `/insights/${uid}`),
  resources: () => request<Resource[]>('GET', '/resources'),

  seedDemo: (uid: string, scenario: 'overloaded' | 'manageable', timezone: string) =>
    request<DemoSeedResult>('POST', '/demo/seed', { user_id: uid, scenario, timezone }),
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong.'
}
