# Villa Senja

A one-page landing site for an exclusive-use luxury villa in Ubud, Bali — *senja* is Balinese for dusk. Built as a portfolio piece exploring warm, textured, "slow-luxury" art direction at an Awwwards / Art. Lebedev craft bar.

**Live:** _(add deploy URL)_

## Highlights

- **Pure static stack** — HTML + CSS + a little JS. Lenis smooth scroll (desktop only), GSAP + ScrollTrigger, SplitType.
- **Balinese motif system** — patra (carved fern-curl), poleng, songket, kawung, candi bentar (split gate) and banana-leaf line-art, all hand-drawn as inline SVG.
- **Textured-paper grounds** — layered film grain + paper fibre + a faint botanical watermark, in the Hungry-Tiger tradition.
- **Draw-on-scroll** — motifs stroke-draw / clip-wipe / bloom, scrubbed and reversible.
- **"Through the gate" loader** — the candi bentar draws itself, then the doors slide apart to reveal the hero.
- **Custom booking calendar** — range picker, blocked dates, two-night minimum, live total.
- **Texture Lab** (`texture-lab.html`) — a standalone tool to compose textured backgrounds (base + motif + grain) and export CSS / PNG.
- Accessible (skip link, focus management, reduced-motion fallbacks) and responsive (mobile menu, sticky book bar).

## Run locally

Any static server, e.g.:

```bash
python -m http.server 8100
# open http://localhost:8100/
```

## Structure

```
index.html        # the page
styles.css        # all styles + the motif system
main.js           # Lenis/GSAP motion, calendar, nav, loader
texture-lab.html  # background-maker tool
images/ videos/ fonts/ vendor/
```
