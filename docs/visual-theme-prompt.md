# Visual theme prompt — Ink & Paper

Copy this prompt into another project when you want the same visual language (theme tokens, typography, interaction feel). Product features are intentionally omitted—this is design system only.

---

## Prompt

```text
Implement an editorial “Ink & Paper” visual system for a product UI. Do not use a generic AI SaaS template look.

### Direction
- Feel: considered, distinctive, useful, tactile, editorial, trustworthy.
- Metaphor: warm paper workspace with ink typography—not futuristic chrome, not glassmorphism.
- Structure with typography, whitespace, alignment, and hairline dividers. Prefer surfaces over nested cards.
- Soft color only when it serves hierarchy. Do not make every surface pastel, colorful, or gradient-filled.

### Avoid
- Purple / indigo / violet as the primary brand accent
- Purple-blue gradient identities
- Glassmorphism / blurred translucent cards everywhere
- Centered marketing hero with gradient-highlighted words + three feature cards
- Nested rounded cards, pill clusters, floating blobs, sparkles, emoji-as-icons
- Default “AI SaaS” stacks (Inter/Roboto as display, purple-on-white)

### Typography (production fonts via next/font or equivalent)
- Display / reading: Newsreader (serif), optical sizing on
- UI / interface: Source Sans 3
- Identifiers / mono: IBM Plex Mono (400/500), ligatures off for IDs
- Strong hierarchy: display for titles and long answers; sans for controls and meta; mono for UUIDs/codes
- Comfortable measure for reading (~40rem). Generous whitespace in intros; denser in work areas.

### Color tokens (semantic; implement light + dark completely)

Light:
- background #f2eee4 (warm paper)
- surface #faf7f0 / raised #fffcf7 / muted #ebe6db
- ink/foreground #1c1a16
- muted #6a645a / faint #8a8478
- border #d4ccbc / border-strong #bdb3a0
- accent (forest ink) #2f5d4a · hover #254a3c · soft #dceae3 · contrast #faf7f0 · deep #234838
- focus ring = accent
- danger #9b2c2c · warning #8a5a12 · success #1f6b45 · info #2a4f6e
  (each with soft + border companions)
- evidence surface #f6f1e6 · border #cfc5b2 · mark #8b5a2b
- shadows: soft warm, low opacity (not multi-layer purple glow)

Dark:
- background #12110f · surface #1a1916 · raised #22201c · muted #2a2722
- ink #ebe6dc · muted #9a9388 · faint #736c62
- border #3a3630 · border-strong #4e4840
- accent #7eb89a · hover #95c9ad · soft #1e2e26 · contrast #0f1411 · deep #a3d0b8
- Recalibrate status + evidence for AA contrast; layered readable surfaces, not inverted pastels

### Surfaces & chrome
- Subtle fixed paper grain (SVG noise, ~4–7% opacity)—optional, keep cheap
- Soft top wash gradient into background; no rainbow blobs
- Radius: 0.375 / 0.5 / 0.75rem (restrained, editorial—not bubbly)
- Buttons: solid primary accent; secondary outlined raised; ghost for tertiary
- Inputs: raised surface, strong focus ring using accent-soft halo
- Status pills: bordered soft fills; never color alone for meaning
- Theme toggle: light / dark / system; persist preference; block FOUC with a tiny pre-hydration script

### Motion
- Quick, purposeful opacity/position/color transitions (~140–220ms)
- Respect prefers-reduced-motion (disable or near-instant)
- No parallax, perpetual loops, or motion that delays primary interactions
- Intro animations (if any): decorate secondary elements only; never hide LCP text behind opacity:0

### Accessibility
- Visible focus rings, semantic HTML, WCAG 2.2 AA contrast where applicable
- Themes must cover every control, alert, and evidence state

### Deliverable
Define CSS variables for all tokens, wire fonts to --font-display / --font-sans / --font-mono, and build shared primitives (btn, field, panel, alert, status). Apply consistently across the app shell (header/footer) and main workspace surfaces.
```

---

## Quick reference (this repo)

| Role | Choice |
|------|--------|
| Display | `Newsreader` → `--font-display` |
| Sans | `Source_Sans_3` → `--font-sans` |
| Mono | `IBM_Plex_Mono` → `--font-mono` |
| Accent | Forest ink `#2f5d4a` / dark `#7eb89a` |
| Theme key | `localStorage` key `theme` via `next-themes` |
| Tokens | `src/app/globals.css` |
