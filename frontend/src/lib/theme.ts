import { cssVar } from './motion'

// Chart colours are read from design tokens at runtime (DESIGN.md: no hex in components).
// SVG presentation attributes can't resolve var(), so we resolve the token values here.
export function chartColors() {
  return {
    series: cssVar('--color-brand-600'),
    seriesSoft: cssVar('--color-brand-200'),
    ink: cssVar('--color-ink'),
    muted: cssVar('--color-faint'),
    grid: cssVar('--color-line'),
    surface: cssVar('--color-surface'),
  }
}

export const SERIES_COLOR = 'token:--color-brand-600'
