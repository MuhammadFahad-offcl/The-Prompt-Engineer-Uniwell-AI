import { createContext, useContext } from 'react'
import type { Health, Profile } from '../types/api'

export interface AppState {
  userId: string | null
  profile: Profile | null
  health: Health | null
  setProfile: (p: Profile | null) => void
  refreshProfile: () => Promise<void>
  refreshHealth: () => Promise<void>
  /** Bumped after data changes (seed, delete) so pages refetch. */
  dataVersion: number
  bumpData: () => void
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppContext')
  return ctx
}
