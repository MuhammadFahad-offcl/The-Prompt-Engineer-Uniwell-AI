import type { Feedback, PlanDetail } from '../../types/api'

// Implemented in milestone 7 (feedback & adaptation loop).
export function FeedbackPanel(_props: {
  plan: PlanDetail
  onSaved: (fb: Feedback) => void
  onGenerateNext: () => void
  generating: boolean
}) {
  return null
}
