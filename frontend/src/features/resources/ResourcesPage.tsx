import { useEffect, useState } from 'react'
import { BadgeCheck, Clock3, ExternalLink, Footprints, Hand, Leaf, Scale, Timer, Wind } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useT } from '../../lib/i18n'
import type { Resource } from '../../types/api'
import { ErrorBanner, InfoNote, PageHeader, PageLoader } from '../../components/ui'

// Short, original, non-clinical micro-activities (UniWell's own wording).
const ACTIVITIES = [
  { Icon: Footprints, title: 'Screen break', minutes: '2–5', text: 'Stand up, look at something far away, and move around for a moment.' },
  { Icon: Wind, title: 'Gentle breathing pause', minutes: '1–3', text: 'Breathe a little slower than usual for a few breaths. Optional — stop if it feels uncomfortable.' },
  { Icon: Hand, title: 'Grounding prompt', minutes: '1–2', text: 'Name a few things you can see, hear and feel right now, then return to your task.' },
  { Icon: Leaf, title: 'Stretch & water', minutes: '2–3', text: 'Roll your shoulders, stretch your arms and have a glass of water if you can.' },
  { Icon: Scale, title: 'Self-kindness moment', minutes: '1', text: 'Say one kind, realistic sentence to yourself, like you would to a friend.' },
  { Icon: Timer, title: '10-minute start', minutes: '10', text: 'Pick the smallest first step of a big task and work on only that for 10 minutes.' },
]

export function ResourcesPage() {
  const { t } = useT()
  const [items, setItems] = useState<Resource[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      setItems(await api.resources())
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="space-y-4">
      <PageHeader title={t('res.title')} subtitle={t('res.subtitle')} />

      <section className="card" aria-labelledby="acts">
        <h2 id="acts" className="font-semibold">
          {t('res.activities')}
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ACTIVITIES.map(({ Icon, title, minutes, text }) => (
            <li key={title} className="rounded-xl bg-canvas p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 text-mint-500" aria-hidden /> {title}
                <span className="ml-auto text-xs font-normal text-muted">{minutes} min</span>
              </p>
              <p className="mt-1 text-sm text-ink/85">{text}</p>
            </li>
          ))}
        </ul>
        <InfoNote className="mt-3">General wellbeing suggestions, not medical advice or treatment.</InfoNote>
      </section>

      {error ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : !items ? (
        <PageLoader />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((r) => (
            <article key={r.id} className="card flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-wide text-mint-700">{r.topic}</p>
              <h2 className="mt-1 font-semibold">{r.title}</h2>
              <p className="text-sm text-muted">{r.publisher}</p>
              <p className="mt-2 text-sm text-ink/90">{r.summary}</p>
              <p className="mt-2 text-xs text-muted">Language: {r.language}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <span className={`chip ${r.verification_status === 'verified' ? 'bg-ok-50 text-ok-700' : 'bg-warn-50 text-warn-700'}`}>
                  <BadgeCheck className="h-3 w-3" aria-hidden />
                  {r.verification_status === 'verified' ? t('res.verified') : t('res.unverified')}
                  {r.last_checked_at ? ` ${r.last_checked_at}` : ''}
                </span>
                {r.source_updated && (
                  <span className="chip bg-canvas text-muted">
                    <Clock3 className="h-3 w-3" aria-hidden /> Page reviewed {r.source_updated}
                  </span>
                )}
                {!r.reviewed && <span className="chip bg-canvas text-muted">{t('res.notReviewed')}</span>}
              </div>
              <details className="mt-2 text-xs text-muted">
                <summary className="cursor-pointer">{t('res.rights')}</summary>
                <p className="mt-1">{r.rights_note}</p>
              </details>
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 self-start">
                {t('res.open')} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </article>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">{t('res.noEndorse')} {t('disclaimer.emergency')}</p>
    </div>
  )
}
