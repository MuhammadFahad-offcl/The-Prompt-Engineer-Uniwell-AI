// Original UniWell blob character (inline SVG + CSS animation). Colours come from tokens
// (--color-blob-*), motion from index.css (.blob-*), and everything stops under reduced motion.
// Decorative only: the surrounding control always carries the text label and aria semantics.

export type BlobMood = 'sad' | 'tired' | 'okay' | 'good' | 'great'

const MOTION: Record<BlobMood, string> = {
  sad: 'blob-sway',
  tired: 'blob-bob',
  okay: 'blob-float',
  good: 'blob-bounce',
  great: 'blob-bounce',
}

/** 1–5 scale → blob mood (shared by mood and energy). */
export const SCALE_BLOB: Record<number, BlobMood> = { 1: 'sad', 2: 'tired', 3: 'okay', 4: 'good', 5: 'great' }
export const SLEEP_BLOB: Record<'poor' | 'okay' | 'good', BlobMood> = { poor: 'tired', okay: 'okay', good: 'good' }

function Eyes({ mood }: { mood: BlobMood }) {
  if (mood === 'tired')
    return (
      <g className="blob-blink">
        <path d="M30 45 q6 4 12 0" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
        <path d="M58 45 q6 4 12 0" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
      </g>
    )
  const droop = mood === 'sad'
  return (
    <g className="blob-blink">
      <ellipse cx="36" cy="44" rx="5" ry="6.5" fill="var(--color-ink)" />
      <ellipse cx="64" cy="44" rx="5" ry="6.5" fill="var(--color-ink)" />
      <circle cx="37.6" cy="41.6" r="1.7" fill="var(--color-surface)" />
      <circle cx="65.6" cy="41.6" r="1.7" fill="var(--color-surface)" />
      {droop && (
        <>
          <path d="M28 39 l12 -4" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M72 39 l-12 -4" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

function Mouth({ mood }: { mood: BlobMood }) {
  const p = { fill: 'none', stroke: 'var(--color-ink)', strokeWidth: 3, strokeLinecap: 'round' as const }
  switch (mood) {
    case 'sad':
      return <path d="M40 66 q10 -8 20 0" {...p} />
    case 'tired':
      return <ellipse cx="50" cy="64" rx="4" ry="3" fill="var(--color-ink)" opacity="0.8" />
    case 'okay':
      return <path d="M41 63 h18" {...p} />
    case 'good':
      return <path d="M39 60 q11 10 22 0" {...p} />
    case 'great':
      return <path d="M36 58 q14 16 28 0 z" fill="var(--color-ink)" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
  }
}

export function MoodBlob({ mood, selected = false, size = 52 }: { mood: BlobMood; selected?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className={`blob-wrap inline-flex ${selected ? 'blob-selected' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className={`blob-body ${MOTION[mood]}`} overflow="visible">
        {/* soft ground shadow */}
        <ellipse cx="50" cy="94" rx="24" ry="4" fill="var(--color-ink)" opacity="0.08" />
        {/* body: organic rounded blob */}
        <path
          d="M50 10 C72 10 88 26 88 50 C88 74 73 90 50 90 C27 90 12 75 12 51 C12 28 28 10 50 10 Z"
          style={{ fill: `var(--color-blob-${mood})` }}
        />
        {/* glossy highlight */}
        <ellipse cx="34" cy="26" rx="11" ry="6" fill="var(--color-surface)" opacity="0.55" transform="rotate(-25 34 26)" />
        {/* cheeks */}
        {(mood === 'good' || mood === 'great') && (
          <>
            <ellipse cx="26" cy="57" rx="6" ry="3.5" style={{ fill: 'var(--color-blob-cheek)' }} />
            <ellipse cx="74" cy="57" rx="6" ry="3.5" style={{ fill: 'var(--color-blob-cheek)' }} />
          </>
        )}
        <Eyes mood={mood} />
        <Mouth mood={mood} />
        {mood === 'great' && (
          <g className="blob-sparkle" style={{ fill: 'var(--color-blob-spark)' }}>
            <path d="M88 14 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" />
            <path d="M10 22 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" />
          </g>
        )}
        {mood === 'tired' && (
          <text x="76" y="22" fontSize="14" fontWeight="700" style={{ fill: 'var(--color-faint)' }} className="blob-zzz">
            z
          </text>
        )}
      </svg>
    </span>
  )
}
