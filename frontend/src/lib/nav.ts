import { Leaf, BarChart3, BookOpen, Gauge, History, House, ListChecks, Settings, SmilePlus, Sparkles } from 'lucide-react'
import type { TKey } from './i18n'

export const NAV: { route: string; key: TKey; Icon: typeof House; mobile?: boolean }[] = [
  { route: 'dashboard', key: 'nav.today', Icon: House, mobile: true },
  { route: 'mindbalance', key: 'nav.mindbalance', Icon: Leaf, mobile: true },
  { route: 'checkin', key: 'nav.checkin', Icon: SmilePlus },
  { route: 'tasks', key: 'nav.tasks', Icon: ListChecks, mobile: true },
  { route: 'plan', key: 'nav.plan', Icon: Sparkles, mobile: true },
  { route: 'radar', key: 'nav.radar', Icon: Gauge },
  { route: 'insights', key: 'nav.insights', Icon: BarChart3 },
  { route: 'history', key: 'nav.history', Icon: History },
  { route: 'resources', key: 'nav.resources', Icon: BookOpen },
  { route: 'settings', key: 'nav.settings', Icon: Settings },
]
