import { useId, type ReactNode } from 'react'
import { ChevronRight, MoreHorizontal, ShieldCheck } from 'lucide-react'
import { useT } from '../lib/i18n'
import { NAV } from '../lib/nav'
import { navigate } from '../lib/router'
import { useApp } from '../lib/appState'
import { useScrolled } from '../lib/motion'
import { SyntheticBadge } from './ui'

/** Brand mark — colors come from tokens (DESIGN.md: no hex in components). */
export function Logo({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  // Unique per instance: a gradient defined inside a display:none copy (e.g. the hidden sidebar) can't be referenced.
  const gradId = `uw-logo-${useId().replace(/:/g, '')}`
  return (
    <span className={`inline-flex items-center gap-2 font-display font-extrabold tracking-tight ${inverted ? 'text-surface' : 'text-brand-900'}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="[stop-color:var(--color-brand-600)]" />
            <stop offset="1" className="[stop-color:var(--color-violet-500)]" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill={`url(#${gradId})`} />
        <path d="M9 9v8a7 7 0 0 0 14 0V9" fill="none" className="stroke-surface" strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="17" r="2.6" className="fill-mint-400" />
      </svg>
      {!compact && (
        <span className="text-lg">
          UniWell <span className={inverted ? 'text-mint-400' : 'text-mint-500'}>AI</span>
        </span>
      )}
    </span>
  )
}

export function Layout({ current, children }: { current: string; children: ReactNode }) {
  const { t } = useT()
  const { profile } = useApp()
  const scrolled = useScrolled(8)
  const activeRoute = current === 'more' ? 'more' : current
  const moreActive = !NAV.some((n) => n.mobile && n.route === activeRoute)

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 btn-primary">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sidebar hidden w-66 shrink-0 flex-col border-r border-line px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <button type="button" onClick={() => navigate('dashboard')} className="mb-7 self-start px-2" aria-label="UniWell home">
          <Logo />
        </button>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map(({ route, key, Icon }) => {
            const active = activeRoute === route
            return (
              <a
                key={route}
                href={`#/${route}`}
                aria-current={active ? 'page' : undefined}
                className={`nav-item group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 ${active ? 'text-brand-600' : ''}`} aria-hidden />
                {t(key)}
              </a>
            )
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-line bg-surface-alt/70 p-3.5 text-xs leading-relaxed text-muted">
          <ShieldCheck className="mb-1.5 h-4 w-4 text-mint-500" aria-hidden />
          {t('disclaimer.short')}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar — frosted once scrolled */}
        <header className="topnav sticky top-0 z-20 flex items-center justify-between bg-surface/50 px-4 py-3 backdrop-blur-md lg:hidden" data-scrolled={scrolled}>
          <button type="button" onClick={() => navigate('dashboard')} aria-label="UniWell home">
            <Logo />
          </button>
          {profile?.is_synthetic && <span className="chip shrink-0 border border-warn-700/25 bg-warn-50 text-warn-700">Synthetic demo</span>}
        </header>

        <main id="main" className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {profile?.is_synthetic && (
            <div className="mb-4 hidden lg:block">
              <SyntheticBadge />
            </div>
          )}
          {/* Keyed by route so every screen gets the mount entrance (no scroll reveals on app data). */}
          <div key={current} className="enter">
            {children}
          </div>
          <footer className="mt-12 border-t border-line pt-5 text-xs leading-relaxed text-faint">
            <p>{t('disclaimer.short')}</p>
            <p className="mt-1">{t('disclaimer.emergency')}</p>
          </footer>
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          {NAV.filter((n) => n.mobile).map(({ route, key, Icon }) => {
            const active = activeRoute === route
            return (
              <a
                key={route}
                href={`#/${route}`}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-brand-700' : 'text-faint'}`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? 'bg-brand-50' : ''}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {t(key)}
              </a>
            )
          })}
          <a
            href="#/more"
            aria-current={moreActive ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${moreActive ? 'text-brand-700' : 'text-faint'}`}
          >
            <span className={`flex h-7 w-12 items-center justify-center rounded-full ${moreActive ? 'bg-brand-50' : ''}`}>
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </span>
            {t('nav.more')}
          </a>
        </nav>
      </div>
    </div>
  )
}

export function MorePage() {
  const { t } = useT()
  return (
    <div>
      <h1 className="mb-4 text-2xl tracking-tight">{t('nav.more')}</h1>
      <div className="enter-stagger grid gap-2">
        {NAV.filter((n) => !n.mobile).map(({ route, key, Icon }) => (
          <a key={route} href={`#/${route}`} className="card-interactive flex min-h-14 items-center gap-3 p-4 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex-1">{t(key)}</span>
            <ChevronRight className="h-4 w-4 text-faint" aria-hidden />
          </a>
        ))}
      </div>
    </div>
  )
}
