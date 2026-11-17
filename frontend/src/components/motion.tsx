import { useEffect, useState } from 'react'
import type { WorkloadStatus } from '../types/api'
import { prefersReducedMotion, useCountUp, useInView } from '../lib/motion'

/** SplitText: renders words that rise in sequence. `mode="mount"` runs on load; "scroll" runs when
 *  an ancestor gets `.is-visible` (ScrollFloat). `gradient` marks a phrase for GradientText. */
export function SplitText({
  text,
  gradient,
  mode = 'scroll',
  delayMs = 0,
}: {
  text: string
  gradient?: string
  mode?: 'mount' | 'scroll'
  delayMs?: number
}) {
  const parts: { word: string; grad: boolean }[] = []
  if (gradient && text.includes(gradient)) {
    const [before, after] = text.split(gradient)
    before.split(' ').filter(Boolean).forEach((w) => parts.push({ word: w, grad: false }))
    gradient.split(' ').forEach((w) => parts.push({ word: w, grad: true }))
    after.split(' ').filter(Boolean).forEach((w) => parts.push({ word: w, grad: false }))
  } else {
    text.split(' ').forEach((w) => parts.push({ word: w, grad: false }))
  }
  return (
    <span className={mode === 'mount' ? 'split-run' : undefined} aria-label={text}>
      {parts.map((p, i) => (
        <span key={i} aria-hidden>
          <span
            className={`split-word ${p.grad ? 'gradient-text' : ''}`}
            style={{ ['--i' as string]: i, ['--d' as string]: `${delayMs}ms` }}
          >
            {p.word}
          </span>{' '}
        </span>
      ))}
    </span>
  )
}

/** Number that counts up when it scrolls into view (or on mount for app cards). */
export function CountUp({ value, decimals = 0, ms = 700, suffix = '' }: { value: number; decimals?: number; ms?: number; suffix?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.3)
  const shown = useCountUp(value, seen, ms, decimals)
  return (
    <span ref={ref} className="tabular">
      {decimals ? shown.toFixed(decimals) : shown}
      {suffix}
    </span>
  )
}

const ARC_CLASS: Record<WorkloadStatus, string> = {
  manageable: 'stroke-ok-700',
  tight: 'stroke-warn-700',
  over_capacity: 'stroke-over-700',
  unknown: 'stroke-brand-300',
}

/** Pressure Radar gauge: semicircle arc scaled 0 → 1.5 with marks at 0.75 and 1.0.
 *  Decorative — the ratio, label and icon are always rendered as text next to it. */
export function Gauge({ ratio, status, size = 180 }: { ratio: number | null; status: WorkloadStatus; size?: number }) {
  const target = ratio === null ? 0 : Math.min(ratio, 1.5) / 1.5
  const [fill, setFill] = useState(() => (prefersReducedMotion() ? target : 0))
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(target))
    return () => cancelAnimationFrame(id)
  }, [target])
  const mark = (frac: number) => {
    const a = Math.PI * (1 - frac)
    return { x1: 60 + 41 * Math.cos(a), y1: 60 - 41 * Math.sin(a), x2: 60 + 55 * Math.cos(a), y2: 60 - 55 * Math.sin(a) }
  }
  return (
    <svg viewBox="0 0 120 66" width={size} height={size * 0.55} aria-hidden className="overflow-visible">
      <path d="M 12 60 A 48 48 0 0 1 108 60" fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-surface-alt" />
      <path
        d="M 12 60 A 48 48 0 0 1 108 60"
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="100"
        strokeDashoffset={100 - fill * 100}
        className={ARC_CLASS[status]}
        style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)' }}
      />
      {[0.5, 2 / 3].map((f) => {
        const m = mark(f)
        return <line key={f} {...m} strokeWidth="1.5" className="stroke-faint" strokeDasharray="2 2" />
      })}
    </svg>
  )
}
