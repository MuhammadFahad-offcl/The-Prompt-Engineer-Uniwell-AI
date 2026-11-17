# DESIGN.md — UniWell AI

> A calm night sky that slowly brightens: soft aurora light, clear indigo structure, and one gentle next step at a time.

Design system for the UniWell AI web app (React + Vite + Tailwind v4). Generated with the `web-design` skill (Phase B), from `docs/PRD.md`, style direction **Dusk Aurora** and interaction tier **L2 + showpiece landing**.

---

## 1. Visual Theme & Atmosphere

**Style**: Dusk Aurora. UniWell's indigo identity is the base, the "Warm Professional" seed sets the structure, and an aurora light layer sits on top.
**Keywords**: calm · luminous · trustworthy · gentle momentum · student-modern · clear · kind
**Tone**: supportive, premium and quietly optimistic — NOT clinical, NOT hospital-blue, NOT neon/cyber, NOT childish, NOT gamified pressure
**Feel**: like the sky just after sunset. The day has been heavy, but the light is soft and there is still enough of it to do one good thing.

**Interaction Tier**:
- **Landing page (`#/welcome`)**: L2+, the showpiece with three "wow" moments.
- **Onboarding and app screens**: L2-lite. These are dashboard-type screens, so data is always visible immediately and there is no scroll reveal.

**Dependencies**: CSS + IntersectionObserver + `requestAnimationFrame` only. No GSAP, Lenis or WebGL.

---

## 2. Color Palette & Roles

Every color is a CSS custom property, declared once in `frontend/src/index.css` inside Tailwind v4's `@theme`. That generates both the `var(--color-*)` variables and the utilities (`bg-brand-600`, `text-ink`…). Components reference tokens only.

```css
@theme {
  /* Backgrounds */
  --color-canvas: #f7f6fb;          /* page background — warm lavender-white */
  --color-surface: #ffffff;         /* cards, containers */
  --color-surface-alt: #f1effa;     /* alternating sections, stat tiles */
  --color-surface-hover: #f4f2fd;   /* hovered rows / ghost buttons */

  /* Borders */
  --color-line: #e6e3f1;            /* default border */
  --color-line-strong: #c9c4f0;     /* hover / focus border */

  /* Text */
  --color-ink: #17153a;             /* headings, key text (15.9:1 on white) */
  --color-muted: #5a5880;           /* body secondary (6.6:1 on white) */
  --color-faint: #6e6b91;           /* labels / meta (5.0:1 on white) */

  /* Brand — indigo (primary) */
  --color-brand-50: #eef0ff;
  --color-brand-100: #e0e3ff;
  --color-brand-200: #c7cbfe;
  --color-brand-300: #a5abfc;
  --color-brand-500: #6366f1;
  --color-brand-600: #4f46e5;       /* --accent: CTA, links, active */
  --color-brand-700: #4338ca;       /* --accent-hover */
  --color-brand-900: #1e1b4b;       /* dark panels */

  /* Aurora companions */
  --color-violet-400: #a78bfa;
  --color-violet-500: #8b5cf6;
  --color-mint-50: #e7faf5;
  --color-mint-100: #c9f2e7;
  --color-mint-400: #34d3b4;
  --color-mint-500: #10b9a0;        /* decorative accent (icons, bars) */
  --color-mint-700: #0b7f6e;        /* accent TEXT on light (4.9:1) */

  /* Semantic status — reserved, always paired with icon + label */
  --color-ok-50: #e8f7f1;   --color-ok-700: #13795b;     /* manageable / success */
  --color-warn-50: #fff5e1; --color-warn-700: #8a5300;   /* tight / caution / synthetic */
  --color-over-50: #fdecee; --color-over-700: #b42335;   /* over capacity / error */
}

:root {
  /* Template aliases (same values; for docs + rgba helpers) */
  --bg: var(--color-canvas);
  --surface: var(--color-surface);
  --surface-alt: var(--color-surface-alt);
  --surface-hover: var(--color-surface-hover);
  --border: var(--color-line);
  --border-hover: var(--color-line-strong);
  --text: var(--color-ink);
  --text-secondary: var(--color-muted);
  --text-tertiary: var(--color-faint);
  --accent: var(--color-brand-600);
  --accent-hover: var(--color-brand-700);
  --success: var(--color-ok-700);
  --warning: var(--color-warn-700);
  --error: var(--color-over-700);

  /* RGB helpers for rgba() */
  --bg-rgb: 247, 246, 251;
  --ink-rgb: 23, 21, 58;
  --accent-rgb: 79, 70, 229;
  --violet-rgb: 139, 92, 246;
  --mint-rgb: 16, 185, 160;
}
```

**Color Rules:**
- Reference every color through a token, in CSS or as a Tailwind utility. **No hex values in components.** Charts read tokens at runtime through `cssVar('--color-…')`.
- Indigo is the single action color. Mint is decorative or confirmational (progress, done, wellbeing) and is used as text only via `mint-700`.
- Violet appears **only** inside aurora and gradient decoration, never on controls.
- Status colors (`ok` / `warn` / `over`) are reserved for workload state, success and errors. They always ship with an icon and a text label.
- Aurora light uses `rgba(var(--accent-rgb), α ≤ .35)`. It is never full-strength behind text.

---

## 3. Typography Rules

**Font Stack:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');

@theme {
  --font-display: "Plus Jakarta Sans", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter", "Segoe UI", ui-sans-serif, system-ui, -apple-system, Arial, sans-serif;
}
```
The fallbacks make the app look correct offline, for example on a venue network with no internet.

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|------|------|------|--------|-------------|----------------|
| Landing Hero H1 | Plus Jakarta Sans | clamp(2.5rem, 6vw, 4.5rem) | 800 | 1.05 | -0.035em |
| Landing Section H2 | Plus Jakarta Sans | clamp(1.75rem, 3.5vw, 2.5rem) | 800 | 1.15 | -0.025em |
| App Page Title (H1) | Plus Jakarta Sans | 1.5rem → 1.75rem (lg) | 800 | 1.2 | -0.02em |
| Card Title (H2/H3) | Plus Jakarta Sans | 1rem–1.125rem | 700 | 1.35 | -0.01em |
| Body | Inter | 0.9375rem (15px) | 400 | 1.6 | — |
| Small / Meta | Inter | 0.8125rem (13px) | 500 | 1.5 | — |
| Label / Eyebrow | Inter | 0.75rem | 600 | 1.4 | 0.08em, uppercase |
| KPI Number | Plus Jakarta Sans | 1.5rem–2.25rem | 800 | 1.1 | -0.02em, tabular-nums |
| Mono (IDs) | ui-monospace, Consolas | 0.75rem | 400 | 1.5 | — |

**Typography Rules:**
- Headings use the display font at weight ≥ 700. Body text never exceeds weight 600.
- Numbers in stats and gauges use `font-variant-numeric: tabular-nums` so count-ups don't jitter.
- Roman Urdu copy uses the same Latin fonts. No script switch is needed.
- **NEVER use**: Comic Sans, Papyrus, condensed or display novelty fonts, serif body text, or light (≤300) weights for text under 20px.

**Text Decoration** (run through `text-decoration-rules.md`; the closest seed is Warm Professional with a light background):
- Hero H1: **gradient only on the key phrase** ("actually do") as flowing `GradientText`. The rest of the heading is solid ink. No text-shadow; it would be muddy on light.
- Landing H2: solid ink, no gradient, no shadow. Allowed: one short mint underline accent on the eyebrow label.
- App headings: no decoration.
- Body `p`: never decorated.

---

## 4. Component Stylings

Defined as Tailwind v4 `@utility` classes in `index.css`, so every screen inherits them.

### Buttons
```css
@utility btn {
  display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
  min-height: 44px; padding: .625rem 1.125rem; border-radius: 14px;
  font-weight: 600; font-size: .875rem; line-height: 1.2;
  transition: background-color .2s, color .2s, border-color .2s, box-shadow .25s, transform .15s;
  &:active:not(:disabled) { transform: translateY(1px) scale(.98); }
  &:focus-visible { outline: 3px solid var(--color-brand-300); outline-offset: 2px; }
  &:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
}
@utility btn-primary {
  @apply btn text-white;
  background: linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500));
  box-shadow: 0 6px 18px -6px rgba(var(--accent-rgb), .55), inset 0 1px 0 rgba(255,255,255,.18);
  &:hover:not(:disabled) { background: linear-gradient(135deg, var(--color-brand-700), var(--color-brand-600));
    box-shadow: 0 10px 24px -8px rgba(var(--accent-rgb), .6), inset 0 1px 0 rgba(255,255,255,.18); }
}
@utility btn-secondary {
  @apply btn border border-line bg-surface text-ink;
  &:hover:not(:disabled) { border-color: var(--color-line-strong); background: var(--color-surface-hover); }
}
@utility btn-ghost {
  @apply btn text-brand-700;
  &:hover:not(:disabled) { background: var(--color-brand-50); }
}
@utility btn-danger {
  @apply btn text-white bg-over-700;
  &:hover:not(:disabled) { filter: brightness(.92); }
}
```

### Cards
```css
@utility card {
  position: relative; border-radius: 20px; padding: 1.25rem;
  background: var(--color-surface); border: 1px solid var(--color-line);
  box-shadow: var(--shadow-sm);
  transition: border-color .2s, box-shadow .25s;
  &:focus-within { border-color: var(--color-line-strong); }
}
@utility card-interactive {               /* clickable cards only */
  @apply card; cursor: pointer;
  &:hover { border-color: var(--color-line-strong); box-shadow: var(--shadow-md); }
}
@utility spotlight {                      /* landing bento: cursor-tracked glow */
  position: relative; overflow: hidden; isolation: isolate;
  &::before { content: ""; position: absolute; inset: 0; z-index: -1; opacity: 0; transition: opacity .3s;
    background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgba(var(--accent-rgb), .12), transparent 60%); }
  &:hover::before { opacity: 1; }
}
```

### Navigation
```css
/* Desktop sidebar: frosted surface with a faint aurora wash at the top */
.sidebar { background: linear-gradient(180deg, rgba(var(--accent-rgb), .06), transparent 40%), var(--color-surface);
  border-right: 1px solid var(--color-line); }
.nav-item { min-height: 44px; border-radius: 12px; color: var(--color-muted); transition: background-color .2s, color .2s; }
.nav-item:hover { background: var(--color-surface-hover); color: var(--color-ink); }
.nav-item[aria-current="page"] { background: var(--color-brand-50); color: var(--color-brand-700);
  box-shadow: inset 3px 0 0 var(--color-brand-600); }
/* Landing top nav + mobile header: transparent → frosted once scrolled */
.topnav { transition: background-color .3s, box-shadow .3s, border-color .3s; border-bottom: 1px solid transparent; }
.topnav[data-scrolled="true"] { background: rgba(var(--bg-rgb), .82); backdrop-filter: blur(12px);
  border-color: var(--color-line); box-shadow: var(--shadow-sm); }
```

### Links
```css
.link { color: var(--color-brand-700); font-weight: 600; background-image: linear-gradient(currentColor, currentColor);
  background-size: 0% 1.5px; background-position: 0 100%; background-repeat: no-repeat; transition: background-size .25s; }
.link:hover, .link:focus-visible { background-size: 100% 1.5px; }
```

### Tags / Badges
```css
@utility chip {
  display: inline-flex; align-items: center; gap: .25rem; border-radius: 999px;
  padding: .125rem .625rem; font-size: .75rem; font-weight: 600; line-height: 1.5;
}
/* Status pill = chip + status tokens + lucide icon + text (never color alone) */
```

### Inputs
```css
@utility input {
  width: 100%; min-height: 44px; border-radius: 12px; padding: .625rem .875rem;
  background: var(--color-surface); border: 1px solid var(--color-line); color: var(--color-ink);
  transition: border-color .2s, box-shadow .2s;
  &::placeholder { color: var(--color-faint); }
  &:hover { border-color: var(--color-line-strong); }
  &:focus { outline: none; border-color: var(--color-brand-500); box-shadow: 0 0 0 4px rgba(var(--accent-rgb), .14); }
  &:disabled { background: var(--color-surface-alt); cursor: not-allowed; }
}
```

### Choice pills (check-in scales)
Radio cards, minimum 44×44px, indigo when selected. The selected state also shows a check-dot and gets `aria-checked` through a real radio input. Mood uses **lucide faces** (Frown, Annoyed, Meh, Smile, Laugh), not emoji.

### Pressure gauge
A semicircular SVG arc (stroke-dasharray) that animates from 0 to the ratio, capped at 1.5 with an overflow marker. Its color is the status token, and it always shows the numeric ratio, the label and an icon.

---

## 5. Layout Principles

**Container:**
- App content: max-width 1120px; padding 16px (mobile) / 24px (sm) / 32px (lg)
- Landing: max-width 1200px; hero text column ≤ 640px
- Narrow forms (check-in, settings, onboarding): max-width 720px

**Spacing Scale** (4px base): 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 72 · 112
- Landing section padding: 72px (mobile) / 112px (desktop)
- App section gap: 16px (mobile) / 20px (desktop)
- Card internal padding: 20px (mobile) / 24px (lg)

**Grid:**
```css
.bento { display: grid; gap: 16px; grid-template-columns: repeat(6, minmax(0, 1fr)); }
.bento > .span-4 { grid-column: span 4; } .bento > .span-2 { grid-column: span 2; } .bento > .span-3 { grid-column: span 3; }
@media (max-width: 768px) { .bento { grid-template-columns: 1fr; } .bento > * { grid-column: auto; } }
.app-grid-2 { display: grid; gap: 16px; } @media (min-width: 1024px) { .app-grid-2 { grid-template-columns: 1fr 1fr; gap: 20px; } }
```

---

## 6. Depth & Elevation

Shadows are tinted with ink or indigo, never pure black, so depth feels like dusk light rather than grey smudge.

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | `none` + 1px `--color-line` border | stat tiles, list rows |
| Subtle (`--shadow-sm`) | `0 1px 2px rgba(var(--ink-rgb),.04), 0 1px 3px rgba(var(--ink-rgb),.04)` | default cards |
| Raised (`--shadow-md`) | `0 8px 24px -10px rgba(var(--ink-rgb),.14)` | hovered interactive cards, popovers |
| Glow (`--shadow-glow`) | `0 18px 50px -18px rgba(var(--accent-rgb),.45)` | primary CTA panel, hero preview card |
| Floating (`--shadow-lg`) | `0 24px 60px -24px rgba(var(--ink-rgb),.30)` | landing product preview stack |

---

## 7. Animation & Interaction

**Motion Philosophy**: motion should feel like breathing. It is slow to arrive and quick to settle, and only `opacity` and `transform` are animated, with a single eased curve. It must never make a stressed student wait or chase content.
**Tier**: L2 on the landing page; L2-lite on app screens.
**Easing**: `--ease-out: cubic-bezier(.22, 1, .36, 1)`. Durations: 150ms (press), 250ms (hover), 600–800ms (entrances), 12–18s (ambient aurora).

### Dependencies
None. CSS keyframes, IntersectionObserver and rAF-throttled pointer handlers, written as small React hooks in `src/lib/motion.ts`.

### Base Setup
```ts
// src/lib/motion.ts
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches
// useReveal(): adds .is-visible when the element enters the viewport (once), then disconnects
// usePointerVars(ref): writes --mx/--my on the element via rAF (hover devices only)
// useCountUp(target, ms): eased number animation; returns target immediately when reduced motion
```

### Entrance Animation
```css
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes word-in { from { opacity: 0; transform: translateY(.45em) rotate(2deg); } to { opacity: 1; transform: none; } }
.enter { animation: rise .7s var(--ease-out) both; }
.enter-stagger > * { animation: rise .6s var(--ease-out) both; }
.enter-stagger > *:nth-child(1) { animation-delay: 0ms } .enter-stagger > *:nth-child(2) { animation-delay: 60ms }
.enter-stagger > *:nth-child(3) { animation-delay: 120ms } .enter-stagger > *:nth-child(4) { animation-delay: 180ms }
.enter-stagger > *:nth-child(n+5) { animation-delay: 240ms }
```
App pages use `.enter-stagger` on mount only. There is no scroll reveal on data screens.

### Scroll Behavior (landing only)
```css
.reveal { opacity: 0; transform: translateY(24px); transition: opacity .8s var(--ease-out), transform .8s var(--ease-out); }
.reveal.is-visible { opacity: 1; transform: none; }
```
```ts
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target) } }), { threshold: .2, rootMargin: '0px 0px -10% 0px' })
```
The landing nav switches to frosted after 24px of scroll (`data-scrolled`). A 2px aurora scroll-progress bar sits at the very top of the landing page.

### Hover & Focus States
- Interactive cards: border goes to `line-strong` and the shadow to `--shadow-md`. There is no lift on data cards (dashboard rule); landing cards lift `translateY(-4px)`.
- Buttons: gradient deepens and glow grows on hover; 1px press-down on `:active`.
- Every focusable element: `:focus-visible` gets a 3px `brand-300` outline with a 2px offset. Never remove it.

### Signature Moments — landing (six categories, CSS-only ports of vue-bits/reactbits ideas)
| Category | Effect (inspired by) | Where |
|---|---|---|
| Background | **Aurora**: three blurred radial blobs (indigo, violet, mint) drifting on 14–18s loops, plus a **cursor spotlight** (`--mx/--my` radial) | Hero |
| Hero H1 text | **SplitText** word-by-word rise + **GradientText** flowing on "actually do" | Hero H1 |
| Section H2 text | **ScrollFloat**: words rise in sequence when the H2 enters view | Every landing H2 |
| Body / Label | **TextType**: the eyebrow types through "for deadline weeks / for low-energy days / for exam season" | Hero eyebrow |
| Element | **Magnet** CTA (moves up to 6px toward the pointer, hover devices only) + press micro-interaction | Primary CTAs |
| Component | **SpotlightCard / MagicBento** with an uneven bento grid and a cursor-tracked glow; a 3D-tilt **product preview stack** in the hero | Features, hero |

**Three "wow" moments** (fixed positions):
1. **Hero**: aurora plus cursor spotlight, word-rise headline with flowing gradient, and a floating stack of three tilted preview cards (radar gauge, plan block, adaptation note). The cards are labelled *"Example"* and contain no real data.
2. **First scroll**: an infinite **marquee band** of the loop: *Check in → See your workload → Live AI plan → Tell us what worked → Next plan adapts*. It is pure CSS `translateX` and pauses on hover.
3. **Feature showcase**: an uneven **bento** with spotlight cards, including a live-feeling **adaptation counter** that counts 30 → 25 → 20 min when scrolled into view.

**One clever detail**: reaching the end of the landing page fades in *"You read to the end — that's one small step done. ✓"* next to the final CTA.

### App-screen micro-interactions (L2-lite)
- Pressure Radar gauge arc animates 0 → ratio (900ms) and KPI numbers count up (700ms).
- The plan timeline shows a soft progress shimmer while generating, and items tick with a check-pop scale animation.
- The "Adapted from your feedback" panel gets a one-time mint glow pulse when a new plan arrives.
- Skeletons use a slow shimmer gradient.
- The mobile header is frosted on scroll.

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important; }
  .reveal { opacity: 1 !important; transform: none !important; }
  .aurora-blob, .marquee-track { animation: none !important; }
}
```
In JS, `useCountUp` returns the final value immediately, Magnet and the spotlight are disabled, and TextType shows the first phrase statically.

---

## 8. Do's and Don'ts

### Do
- Use tokens for every color, including chart strokes, which are read at runtime.
- Keep one primary action per screen region (indigo gradient button); everything else is secondary or ghost.
- Pair every status with an icon and a text label (manageable / tight / over capacity).
- Animate only `opacity` and `transform`; throttle pointer work with rAF.
- Keep numbers honest and visible: data appears immediately on app screens.
- Label illustrative landing visuals as "Example", and synthetic data as "Demo data — synthetic example".
- Keep the non-clinical disclaimer visible on the landing page and in the app footer.
- Give touch targets at least 44×44px and keep `:focus-visible` rings on everything.

### Don't
- ❌ Hard-code hex values in components (charts included).
- ❌ Use clinical imagery or language (stethoscopes, hearts with pulse lines, "score", "diagnosis").
- ❌ Use red or orange for emotions or mood; status colors are only for workload and errors.
- ❌ Scroll-reveal or delay data on app screens: the radar, tasks and plans must be visible instantly.
- ❌ Put `filter: blur()` on moving elements other than the static, pre-blurred aurora blobs (which are composited once and only transformed).
- ❌ Run more than one aurora background per view, or any WebGL, GSAP or Lenis.
- ❌ Use gradient text on body copy or on more than one phrase per screen.
- ❌ Use emoji as UI icons (lucide-react only) or stock photos of distressed students.
- ❌ Use custom cursors or scroll-jacking.
- ❌ Use motion that loops forever inside app screens; ambient loops are allowed only on the landing hero and marquee.

---

## 9. Responsive Behavior

**Breakpoints:**
| Name | Width | Key Changes |
|------|-------|-------------|
| Desktop | ≥ 1024px | Sidebar nav (264px); 2-column card grids; landing hero splits text with the preview stack |
| Tablet | 640–1023px | Top header and bottom nav; single-column cards with 2-column stat tiles; hero stacks, preview below |
| Mobile | < 640px | Bottom nav (5 items + More); full-width cards; bento → 1 column; marquee font 1.25rem; aurora blobs shrink, spotlight off |

**Touch Targets:** minimum 44×44px, including choice pills, nav items and icon buttons.
**Collapsing Strategy:** the sidebar becomes a frosted top bar plus a bottom tab bar, and secondary pages go behind "More". Tables scroll horizontally inside their card, never the page. No horizontal page overflow at 360px or wider.

```css
@media (max-width: 639px) {
  .hero-title { font-size: clamp(2.25rem, 10vw, 2.75rem); }
  .aurora-blob { width: 60vw; height: 60vw; }
  .preview-stack { transform: none !important; }   /* no tilt on touch */
}
@media (hover: none) { .spotlight::before { display: none; } }
```

---

*Credits: motion ideas (Aurora, SplitText, GradientText, ScrollFloat, TextType, Magnet, SpotlightCard, MagicBento) are inspired by [vue-bits](https://github.com/DavidHDev/vue-bits) by DavidHDev (MIT). UniWell's versions are original CSS/TS re-implementations.*
