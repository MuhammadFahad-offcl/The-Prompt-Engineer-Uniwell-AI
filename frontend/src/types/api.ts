// Types mirroring the FastAPI Pydantic schemas (backend/app/schemas).

export type Language = 'en' | 'roman_urdu'
export type SleepQuality = 'poor' | 'okay' | 'good'
export type TaskType = 'assignment' | 'quiz' | 'exam' | 'project' | 'reading' | 'other'
export type Priority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type WorkloadStatus = 'manageable' | 'tight' | 'over_capacity' | 'unknown'
export type CompletionStatus = 'yes' | 'partially' | 'no'
export type ReasonCode =
  | 'too_many_tasks'
  | 'sessions_too_long'
  | 'unexpected_event'
  | 'not_enough_time'
  | 'plan_was_helpful'
  | 'other'

export const SESSION_CHOICES = [15, 20, 25, 30, 40, 45] as const

export interface AIStatus {
  provider: string
  configured: boolean
  model: string
  missing_env: string | null
}

export interface Health {
  status: string
  database: string
  app_env: string
  demo_enabled: boolean
  ai: AIStatus
}

export interface Profile {
  id: string
  nickname: string | null
  language: Language
  timezone: string
  preferred_session_minutes: number
  default_available_minutes: number | null
  consent_acknowledged: boolean
  adapted_session_minutes: number | null
  effective_session_minutes: number
  max_tasks_override: number | null
  buffer_minutes: number
  keep_breaks: boolean
  noncompletion_streak: number
  is_synthetic: boolean
  created_at: string
  updated_at: string
}

export interface ProfileInput {
  user_id: string
  nickname: string | null
  language: Language
  preferred_session_minutes: number
  default_available_minutes: number | null
  timezone: string
  consent_acknowledged: boolean
}

export interface CheckIn {
  id: string
  local_date: string
  mood_score: number
  sleep_quality: SleepQuality
  workload_score: number
  energy_score: number | null
  available_minutes: number
  revision: number
  is_synthetic: boolean
  created_at: string
  updated_at: string
}

export interface CheckInInput {
  local_date?: string
  mood_score: number
  sleep_quality: SleepQuality
  workload_score: number
  energy_score: number | null
  available_minutes: number
}

export interface CheckInList {
  today_local_date: string
  today: CheckIn | null
  items: CheckIn[]
}

export interface Task {
  id: string
  title: string
  subject: string | null
  task_type: TaskType
  deadline: string
  estimated_minutes: number
  priority: Priority
  status: TaskStatus
  completed_at: string | null
  is_overdue: boolean
  is_synthetic: boolean
  created_at: string
  updated_at: string
}

export interface TaskInput {
  title: string
  subject: string | null
  task_type: TaskType
  deadline: string
  estimated_minutes: number
  priority: Priority
  status?: TaskStatus
}

export type RadarBucket = 'overdue' | 'today' | 'next_48h' | 'later'

export interface RankedTask {
  task_id: string
  title: string
  rank: number
  deadline: string
  estimated_minutes: number
  priority: Priority
  bucket: RadarBucket
  reason: string
}

export interface Radar {
  local_date: string
  available_minutes: number | null
  available_source: 'checkin' | 'profile_default' | null
  overdue_minutes: number
  due_today_minutes: number
  later_48h_minutes: number
  due_soon_minutes: number
  beyond_48h_minutes: number
  pending_count: number
  completed_count: number
  overdue_count: number
  workload_ratio: number | null
  status: WorkloadStatus
  explanation: string
  rule: string
  ranked_tasks: RankedTask[]
}

export interface Constraints {
  available_minutes: number
  buffer_minutes: number
  budget_minutes: number
  session_minutes: number
  max_study_tasks: number
  keep_breaks: boolean
  low_energy_mode: boolean
  notes: string[]
}

export interface WellbeingActivity {
  title: string
  activity_type: string
  duration_minutes: number
  instructions: string
}

export interface DeferredTask {
  task_id: string | null
  title: string
  reason: string
  suggested_review_date: string | null
}

export interface PlanContent {
  title: string
  supportive_message: string
  workload_status: WorkloadStatus
  workload_summary: string
  total_planned_minutes: number
  available_minutes: number
  study_tip: string
  affirmation: string
  why_this_plan: string
  fallback_plan: string
  wellbeing_activity: WellbeingActivity
  deferred_tasks: DeferredTask[]
  adaptation_explanations: string[]
  constraints: Constraints
  repairs: string[]
  missing_info: string[]
  synthetic_note?: string
}

export interface PlanItem {
  id: string
  position: number
  item_type: 'study' | 'break' | 'wellbeing'
  task_id: string | null
  title: string
  instructions: string
  reason: string
  duration_minutes: number
  completed: boolean
  completed_at: string | null
  task_title_snapshot: string | null
}

export interface Feedback {
  id: string
  plan_id: string
  completion_status: CompletionStatus
  manageable_rating: number
  helpfulness_rating: number
  reason_code: ReasonCode | null
  breaks_helpful: boolean | null
  is_synthetic: boolean
  created_at: string
}

export interface PlanDetail {
  id: string
  local_date: string
  language: Language
  provider: string
  model: string
  status: string
  is_synthetic: boolean
  created_at: string
  plan: PlanContent
  items: PlanItem[]
  feedback: Feedback | null
}

export interface PlanSummary {
  id: string
  local_date: string
  title: string
  provider: string
  model: string
  status: string
  is_synthetic: boolean
  created_at: string
  total_planned_minutes: number
  items_total: number
  items_completed: number
  feedback: Feedback | null
}

export interface AdaptationEvent {
  id: string
  rule_applied: string
  previous_value: string | null
  new_value: string | null
  reason: string
  is_synthetic: boolean
  created_at: string
}

export interface PlanHistory {
  items: PlanSummary[]
  adaptation_events: AdaptationEvent[]
}

export interface SafetyResponse {
  title: string
  message: string
  actions: string[]
}

export type GenerateResult =
  | { kind: 'plan'; plan: PlanDetail }
  | { kind: 'safety'; safety: SafetyResponse }

export interface FeedbackInput {
  plan_id: string
  completion_status: CompletionStatus
  manageable_rating: number
  helpfulness_rating: number
  reason_code: ReasonCode | null
  breaks_helpful: boolean | null
}

export interface FeedbackResult {
  feedback: Feedback
  adaptation_events: AdaptationEvent[]
  next_constraints_preview: {
    session_minutes: number
    max_tasks_override: number | null
    buffer_minutes: number
    keep_breaks: boolean
  }
  ask_availability: boolean
}

export interface InsightDay {
  local_date: string
  weekday: string
  has_checkin: boolean
  mood: number | null
  sleep_quality: SleepQuality | null
  sleep_value: number | null
  workload: number | null
  energy: number | null
  available_minutes: number | null
  is_synthetic: boolean
}

export interface InsightStatement {
  text: string
  sample_size: number
}

export interface Insights {
  days: InsightDay[]
  checkins_7d: number
  plans_generated_7d: number
  task_summary: { pending: number; completed: number; overdue: number; completed_last_7_days: number }
  feedback_summary: { count: number; avg_manageable: number; avg_helpful: number } | null
  min_records_for_statements: number
  statements: InsightStatement[]
  synthetic_records_present: boolean
}

export interface Resource {
  id: string
  title: string
  publisher: string
  url: string
  topic: string
  language: string
  summary: string
  rights_note: string
  verification_status: 'verified' | 'unverified'
  source_updated: string | null
  last_checked_at: string | null
  reviewed: boolean
}

export interface DemoSeedResult {
  scenario: 'overloaded' | 'manageable'
  profile: Profile
  counts: Record<string, number>
  label: string
}

// ---------------------------------------------------------------- MindBalance
export type MBMood = 'very_good' | 'good' | 'neutral' | 'low' | 'very_low'
export type MBCondition = 'calm' | 'overwhelmed' | 'anxious' | 'mentally_exhausted' | 'demotivated' | 'unable_to_concentrate'
export type MBPressure = 'low' | 'moderate' | 'high' | 'very_high'
export type MBState = 'balanced' | 'elevated_stress' | 'low_energy' | 'overloaded' | 'recovery_recommended'
export type MBActivity = 'breathing' | 'grounding' | 'journal' | 'energy' | 'motivation'

export interface MBCheckIn {
  id: string
  local_date: string
  mood: MBMood
  stress: number
  energy: number
  mental_condition: MBCondition
  academic_pressure: MBPressure
  note: string | null
  state: MBState
  state_label: string
  state_reasons: string[]
  kind: 'daily' | 'post_activity'
  is_synthetic: boolean
  created_at: string
}
export interface MBRecommendation {
  activity: MBActivity
  label: string
  reason: string
  personal_note: string | null
}
export interface MBSafety {
  title: string
  message: string
  actions: string[]
  contacts: { name: string; phone?: string; url?: string; region?: string }[]
  not_emergency_service: string
}
export interface MBChange {
  id: string
  type: 'recovery_first' | 'lighter_sessions' | 'focus' | 'split_task' | 'defer_task'
  task_id: string | null
  title: string
  detail: string
  reason: string
  accepted: boolean | null
}
export interface MBAdjustment {
  id: string
  local_date: string
  status: 'pending' | 'applied' | 'dismissed'
  pressure_level: string
  summary: string
  changes: MBChange[]
  created_at: string
}
export interface MBSummary {
  latest_checkin: MBCheckIn | null
  recommendations: MBRecommendation[]
  rules: string[]
  adjustment: MBAdjustment | null
  support_contacts: MBSafety['contacts']
}
export interface MBSession {
  id: string
  activity: MBActivity
  status: 'started' | 'completed' | 'skipped'
  pre_stress: number | null
  pre_energy: number | null
  post_stress: number | null
  post_energy: number | null
  helpful: 'yes' | 'somewhat' | 'no' | null
  created_at: string
}
export interface MBJournal {
  id: string
  bothering: string | null
  in_control: string | null
  outside_control: string | null
  small_action: string | null
  created_at: string
}
export interface MBInsightDay {
  local_date: string
  weekday: string
  count: number
  stress: number | null
  energy: number | null
  mood: number | null
}
export interface MBInsights {
  window_days: number
  days: MBInsightDay[]
  days_with_checkins: number
  consistency_pct: number
  total_checkins: number
  recovery_usage: Record<string, number>
  recovery_helpfulness: Record<string, Record<string, number>>
  average_change_after_recovery: { sessions: number; stress: number; energy: number } | null
  observations: { text: string; sample_size: number; kind: string }[]
  min_days_for_observations: number
  scatter: { stress: number; energy: number; date: string }[]
}
