// Motion helpers (DESIGN.md §7). CSS + IntersectionObserver + rAF only — no animation libraries.
// Every effect degrades to a static state under prefers-reduced-motion or on touch devices.
import { useEffect, useRef, useState, type RefObject } from 'react'

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function canHover(): boolean {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  } catch {
    return false
  }
}

/** Read a design token at runtime (for SVG/Recharts attributes that can't use var()). */
export function cssVar(name: string, fallback = ''): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  } catch {
    return fallback
  }
}

/** Adds `is-visible` once the element enters the viewport (landing scroll reveals). */
export function useReveal<T extends HTMLElement>(threshold = 0.15): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const show = () => el.classList.add('is-visible')
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      show()
      return
    }
    // Fallback: a fast scroll can jump past an element without an intersection callback,
    // so also reveal anything whose top is already above 90% of the viewport.
    let frame = 0
    const check = () => {
      frame = 0
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
        show()
        cleanup()
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          show()
          cleanup()
        }
      },
      { threshold, rootMargin: '0px 0px -10% 0px' },
    )
    function cleanup() {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
    io.observe(el)
    window.addEventListener('scroll', onScroll, { passive: true })
    check()
    return cleanup
  }, [threshold])
  return ref
}

/** True once the element has been seen (for one-shot effects like count-ups). */
export function useInView<T extends HTMLElement>(threshold = 0.4): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen]
}

/** Writes --mx/--my (pointer position) onto the element, rAF-throttled, hover devices only. */
export function usePointerVars<T extends HTMLElement>(): (el: T | null) => void {
  const [el, setEl] = useState<T | null>(null)
  useEffect(() => {
    if (!el || !canHover() || prefersReducedMotion()) return
    let frame = 0
    let x = 0
    let y = 0
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      x = e.clientX - r.left
      y = e.clientY - r.top
      if (!frame)
        frame = requestAnimationFrame(() => {
          el.style.setProperty('--mx', `${x}px`)
          el.style.setProperty('--my', `${y}px`)
          frame = 0
        })
    }
    el.addEventListener('pointermove', onMove)
    return () => {
      el.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [el])
  return setEl
}

/** Magnet: element drifts up to `strength` px toward the pointer while hovered. */
export function useMagnet<T extends HTMLElement>(strength = 6): (el: T | null) => void {
  const [el, setEl] = useState<T | null>(null)
  useEffect(() => {
    if (!el || !canHover() || prefersReducedMotion()) return
    let frame = 0
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * strength
      const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * strength
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`
      })
    }
    const reset = () => {
      cancelAnimationFrame(frame)
      el.style.transform = ''
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', reset)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', reset)
      cancelAnimationFrame(frame)
    }
  }, [el, strength])
  return setEl
}

/** Eased count-up from 0 to target once `start` is true. Returns the target instantly under reduced motion. */
export function useCountUp(target: number, start = true, ms = 700, decimals = 0): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))
  useEffect(() => {
    if (!start) return
    if (prefersReducedMotion()) {
      setValue(target)
      return
    }
    let frame = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      const factor = Math.pow(10, decimals)
      setValue(Math.round(target * eased * factor) / factor)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, start, ms, decimals])
  return value
}

/** TextType: cycles through phrases with a typing effect. Static first phrase under reduced motion. */
export function useTypewriter(phrases: string[], typeMs = 55, holdMs = 1800): string {
  const [text, setText] = useState(() => (prefersReducedMotion() ? phrases[0] ?? '' : ''))
  useEffect(() => {
    if (prefersReducedMotion() || phrases.length === 0) return
    let i = 0
    let len = 0
    let deleting = false
    let timer = 0
    const step = () => {
      const phrase = phrases[i % phrases.length]
      if (!deleting) {
        len++
        setText(phrase.slice(0, len))
        if (len === phrase.length) {
          deleting = true
          timer = window.setTimeout(step, holdMs)
          return
        }
      } else {
        len--
        setText(phrase.slice(0, len))
        if (len === 0) {
          deleting = false
          i++
        }
      }
      timer = window.setTimeout(step, deleting ? typeMs / 2 : typeMs)
    }
    timer = window.setTimeout(step, 400)
    return () => window.clearTimeout(timer)
  }, [phrases, typeMs, holdMs])
  return text
}

/** True once the page is scrolled past `offset` px (frosted nav state). */
export function useScrolled(offset = 24): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        setScrolled(window.scrollY > offset)
        frame = 0
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [offset])
  return scrolled
}

/** 0..1 page scroll progress (landing progress bar). */
export function useScrollProgress(): number {
  const [p, setP] = useState(0)
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        setP(max > 0 ? Math.min(1, window.scrollY / max) : 0)
        frame = 0
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])
  return p
}
