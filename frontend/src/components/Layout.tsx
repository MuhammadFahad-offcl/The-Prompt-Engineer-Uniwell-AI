import type { ReactNode } from 'react'
import { MoreHorizontal, ShieldCheck } from 'lucide-react'
import { useT } from '../lib/i18n'
import { NAV } from '../lib/nav'
import { navigate } from '../lib/router'
import { useApp } from '../lib/appState'
import { SyntheticBadge } from './ui'


export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight text-brand-900">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#3B3FB6" />
        <path d="M9 9v8a7 7 0 0 0 14 0V9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="17" r="2.5" fill="#5EE0C2" />
      </svg>
      {!compact && (
        <span className="text-lg">
          UniWell <span className="text-mint-500">AI</span>
        </span>
      )}
    </span>
  )
}

export function Layout({ current, children }: { current: string; children: ReactNode }) {
  const { t } = useT()
  const { profile } = useApp()
  const activeRoute = current === 'more' ? 'more' : current
  const moreActive = !NAV.some((n) => n.mobile && n.route === activeRoute)

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 btn-primary">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <button type="button" onClick={() => navigate('dashboard')} className="mb-6 self-start" aria-label="UniWell home">
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
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-canvas hover:text-ink'
                }`}
              >
                <Icon className="h-4.5 w-4.5" aria-hidden />
                {t(key)}
              </a>
            )
          })}
        </nav>
        <div className="mt-auto rounded-xl bg-canvas p-3 text-xs text-muted">
          <ShieldCheck className="mb-1 h-4 w-4 text-mint-500" aria-hidden />
          {t('disclaimer.short')}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" onClick={() => navigate('dashboard')} aria-label="UniWell home">
            <Logo />
          </button>
          {profile?.is_synthetic && <SyntheticBadge />}
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          {profile?.is_synthetic && (
            <div className="mb-4 hidden lg:block">
              <SyntheticBadge />
            </div>
          )}
          {children}
          <footer className="mt-12 border-t border-line pt-5 text-xs leading-relaxed text-muted">
            <p>{t('disclaimer.short')}</p>
            <p className="mt-1">{t('disclaimer.emergency')}</p>
          </footer>
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {NAV.filter((n) => n.mobile).map(({ route, key, Icon }) => {
            const active = activeRoute === route
            return (
              <a
                key={route}
                href={`#/${route}`}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? 'text-brand-700' : 'text-muted'}`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {t(key)}
              </a>
            )
          })}
          <a
            href="#/more"
            aria-current={moreActive ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${moreActive ? 'text-brand-700' : 'text-muted'}`}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
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
      <h1 className="mb-4 text-2xl font-bold">{t('nav.more')}</h1>
      <div className="grid gap-2">
        {NAV.filter((n) => !n.mobile).map(({ route, key, Icon }) => (
          <a key={route} href={`#/${route}`} className="card flex items-center gap-3 p-4 font-medium hover:bg-brand-50">
            <Icon className="h-5 w-5 text-brand-600" aria-hidden />
            {t(key)}
          </a>
        ))}
      </div>
    </div>
  )
}
