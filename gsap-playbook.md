# GSAP Technique Playbook — Villa Senja

A deduped, build-ready distillation of 230 production GSAP patterns, organized for Villa Senja's stack (GSAP + ScrollTrigger + Lenis-on-gsap.ticker + SplitType, vanilla JS, Salmond UPPERCASE serif + Hanken Grotesk, warm-earthy luxury, restraint, one easing personality).

Every code block is the single cleanest distilled version of a family of duplicate source patterns. Villa Senja conventions referenced throughout match your actual `main.js`: the `motionOff = reduce || navigator.webdriver` gate, Lenis wired to `gsap.ticker` (desktop-only), the `hasGSAP && !motionOff` guard around the "AWWWARDS-LEVEL MOTION" block, `invalidateOnRefresh`, and fail-safe try/catch.

---

## 0. PRINCIPLES (read first — these govern everything below)

### 0.1 One easing personality
Pick ONE signature curve and use it for almost everything; reserve at most one accent. The source corpus repeatedly proves coherence comes from a single ease, not variety. Candidates seen: `expo.inOut` (decisive/mechanical), `power3.inOut` (calm/luxe), or a bespoke `CustomEase`.

```js
// Register once, forbid ad-hoc eases elsewhere.
CustomEase.create("senja", "M0,0 C0,0.3 0.3,0.45 0.5,0.5 0.71,0.55 1,0.7 1,1"); // flat-centred S = "expensive/floaty"
gsap.defaults({ ease: "senja", duration: 0.8 });
const EASE = "senja";   // import this constant into every IIFE
```
- **Structural moves** (reveals, flips, pins): your house `EASE`.
- **Scrubbed tweens MUST be `ease:"none"`** — scrub already maps scroll→progress linearly; any ease fights it (or, with a `scrub:` *number* like `0.4`–`1`, the lag itself becomes the smoothing so you still keep `ease:"none"`/`power1`).
- **Spring/elastic eases must NOT be scrubbed** — scrubbing an `elastic`/`back` backwards looks broken. Run them on a *paused* timeline triggered via `onStart`/`onEnter` so they play in real time (see §11.3).
- Lenis itself carries an ease — yours uses the exact Hungry Tiger curve `t => Math.min(1, 1.001 - 2**(-10*t))` (an expo-out). Let that be the page's master "feel"; keep tween eases in the same family.

### 0.2 Lenis ↔ gsap.ticker sync (your exact, correct wiring)
Drive Lenis from GSAP's clock — never `autoRaf:true` *and* a manual ticker (double-steps). Your `main.js` already does this correctly and desktop-only:

```js
const wantsSmooth =
  matchMedia("(min-width:1025px)").matches &&
  matchMedia("(hover:hover)").matches &&
  matchMedia("(pointer:fine)").matches;          // leave NATIVE momentum on phones
const lenis = (hasLenis && wantsSmooth) ? new Lenis({
  duration: 1.2,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
}) : null;
if (lenis) {
  window.__lenis = lenis;                          // debug handle (you use this for screenshots)
  lenis.on("scroll", () => ScrollTrigger.update()); // keep scrubs in lockstep
  gsap.ticker.add(t => lenis.raf(t * 1000));        // seconds → ms
  gsap.ticker.lagSmoothing(0);                      // don't skip frames mid-scrub / after tab-blur
}
gsap.registerPlugin(ScrollTrigger);
if (!lenis) ScrollTrigger.config({ ignoreMobileResize: true }); // steady against URL-bar jitter
```
- `ScrollTrigger.getVelocity()` is only accurate because Lenis feeds one clock — that's what powers any velocity touch.
- Route anchor links through `lenis.scrollTo()` (you already do) so in-page nav respects smoothing.
- Call `ScrollTrigger.refresh()` after fonts/images change page height; use `invalidateOnRefresh:true` on triggers whose start/end depend on measured sizes.

### 0.3 Reduced-motion + webdriver fallbacks (non-negotiable for Awwwards + a11y)
Your `motionOff` gate is the model. Everything motion-heavy must degrade to a clean, complete, non-blank static state.

```js
const reduce    = matchMedia("(prefers-reduced-motion: reduce)").matches;
const motionOff = reduce || navigator.webdriver === true;   // headless screenshots get static mode
if (!hasGSAP || motionOff) { /* set final states in CSS; bail out of all motion */ return; }
```
- **CSS resting state = the finished look.** e.g. masked images default to fully-revealed in CSS; JS only *re-hides* then animates. If JS never runs, the user sees the final frame, not a blank slit.
- **Fail-safe each effect** in a try/catch that forces the completed state (your `initDraw` does exactly this — on throw it sets `strokeDashoffset:0`). Never leave anything stuck hidden.
- SplitText/measured effects: gate on `document.fonts.ready` (see §3.6) or fallback metrics break line splits.

### 0.4 Performance: transforms only, quickTo/quickSetter, will-change
- **Animate only `transform` + `opacity`** (x/y/scale/rotation, `autoAlpha`). Avoid `top/left/width/height/margin/flex` in per-frame work — they trigger layout. (Exception: the flex-accordion in §10.3 animates `flex` but only on ~6 nodes.)
- **High-frequency input (mousemove/wheel/drag/ticker) → `gsap.quickTo` / `gsap.quickSetter`, created ONCE outside the handler.** They reuse a single overwrite-safe tween instead of spawning one per event. This is the corpus's #1 perf lesson.
```js
const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: EASE }); // make once
el.addEventListener("pointermove", e => xTo(e.clientX));          // retarget, don't re-create
// quickSetter = instant (no tween), for values you smooth yourself:
const setSkew = gsap.quickSetter(els, "skewY", "deg");
```
- `will-change: transform` (or `clip-path`) on elements about to animate; remove it when idle on huge counts.
- **Gate per-frame loops to viewport** with a bare ScrollTrigger so off-screen physics/3D/marquees cost nothing (§7.1, §8.x):
```js
ScrollTrigger.create({ trigger: section,
  onEnter:     () => gsap.ticker.add(tick),  onLeave:     () => gsap.ticker.remove(tick),
  onEnterBack: () => gsap.ticker.add(tick),  onLeaveBack: () => gsap.ticker.remove(tick) });
```
- Use `dt` (delta-time) from the ticker for frame-rate-independent motion: `incr += dt / 30`, never a fixed per-frame constant.
- `gsap.utils` toolkit (`clamp`, `mapRange`, `wrap`, `snap`, `interpolate`, `random`, `unitize`) keeps input→output math declarative — lean on it.

### 0.5 Villa Senja taste rules (hard-won from your feedback)
- **NEVER velocity-skew big editorial photos** — shearing large rectangles reads as cheap wobble ("looks shit"). If you want a momentum touch, put a slight directional stretch on the *horizontal gallery track* or on *small text atoms* only.
- **Do not touch the existing headline word-opacity scrub + image fade reveals.** "GSAP stuff" = NEW motion on *other* elements.
- No two adjacent sections share a flat colour; no two sections repeat a layout archetype — motion should reinforce that variety, not flatten it.
- Restraint: halve the playful ranges in this doc (rotations ±4–8° not ±15–60°, scales 1.05–1.15 not 1.4–1.6, gentle springs `back.out(1.4)` not `back.out(3)`).

---

## 1. ScrollTrigger Pinning & Scrub

### 1.1 The pin-height chassis (the universal scrollytelling backbone)
**How it works:** Separate *scroll distance* from the *pinned element*. An outer `.pin-height` gets an explicit tall height (e.g. `400–600vh`); the inner `.container` is `100vh` and is what you `pin`. The trigger is the *outer* spacer, so the scene lasts exactly `pinHeightHeight − 100vh`. Tune pacing purely by editing the vh number. Author all sub-motion on one timeline (or separate triggers sharing identical start/end) bound to the same spacer.

```js
// CSS: .pin-height{height:500vh}  .container{height:100vh; overflow:hidden}
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: pinHeight,            // OUTER tall spacer
    start: "top top", end: "bottom bottom",
    pin: container,                // INNER 100vh stage
    scrub: true,
    invalidateOnRefresh: true,
  },
});
tl.to(targets, { /* keyframes; position = scroll fraction */ });
```
- Per-item sequencing without a master timeline: convert index→scroll offset, `start:"top top-=" + distPerItem*i`, `end:"+=" + distPerItem`, where `distPerItem = (pinHeight.clientHeight - innerHeight) / items.length`.
- `pinSpacing:false` only when the spacer already supplies the length (otherwise following content collapses over the pin).
- **Key params:** `scrub:true` (instant) vs `scrub:0.5–1` (lag/smoothing); `ease:"none"` on scrubbed tweens; `anticipatePin:1` to reduce a 1-frame jump.
- **Gotchas:** pin the INNER, trigger the OUTER. Two separate ScrollTriggers (one `pin`, one timeline) is cleaner than overloading one. Only ONE trigger may own `pin` per region.
- **Villa Senja:** the chassis for every pinned chapter — a "A Day at Senja" beat, the suites showcase, the included/amenities reveal. Your gallery already uses the `end:()=>"+="+dist` + `invalidateOnRefresh` variant.

### 1.2 Horizontal pinned scroll (vertical scroll → x travel)
**How it works:** A `width:max-content` flex track wider than the viewport is translated `x: -(track.scrollWidth − pin.clientWidth)` with `ease:"none"`, pinned over a distance equal to that overflow → 1:1 feel.

```js
const dist = () => Math.max(0, track.scrollWidth - pin.clientWidth); // function = resize-safe
gsap.to(track, {
  x: () => -dist(), ease: "none",
  scrollTrigger: { trigger: pin, start: "top top", end: () => "+=" + dist(),
    pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
});
```
- **Gotcha you already hit:** distance MUST be `scrollWidth − clientWidth`, NOT `track.clientWidth` (a max-content element's clientWidth equals its scrollWidth → 0 → no movement). Wrap in `matchMedia` and fall back to a vertical stack on mobile.
- Pad the track ends so first/last cards centre (`padding: 0 calc(100vw + 1px)` or `0 100vw` for off-screen lead-in).
- **Villa Senja:** this is exactly your shipped pinned gallery. Reuse for a horizontal "rooms & rates" rail or a kinetic header band.

### 1.3 Per-element triggers inside a horizontal scroller — `containerAnimation`
**How it works:** Children inside a horizontally-translated track can't use vertical start/end. Pass the horizontal tween as `containerAnimation`, and start/end become *horizontal* edge keywords (`"left 90%"`, `"right 10%"`). Each card runs its own scrubbed entrance timed to when it crosses the screen.

```js
const scrollTween = gsap.to(track, { x: () => -dist(), ease: "none",
  scrollTrigger: { trigger: pin, pin: true, scrub: true, end: () => "+=" + dist() } });
cards.forEach(card => {
  gsap.from(card, { rotation: 4, yPercent: 6, ease: EASE,
    scrollTrigger: { trigger: card, containerAnimation: scrollTween,
      start: "left 90%", end: "right 10%", scrub: true } });
});
```
- **Gotchas:** the driving tween MUST be `ease:"none"` + scrubbed; `containerAnimation` triggers **cannot also pin** (the master already pins); start/end use `left`/`right`, not `top`/`bottom`.
- **Villa Senja:** upgrade the gallery so each photo gently de-tilts/settles as it reaches centre — a signature Awwwards detail that's nearly free once the horizontal scroller exists. Keep ranges tiny.

### 1.4 Discrete index-stepping inside a scrubbed pin (one-at-a-time storytelling)
**How it works:** Turn continuous scrub into discrete steps. In `onUpdate`, `index = Math.round(self.progress * (n-1))`; act only when the index *changes*, branching on direction so it's reversible. Lets you fire one-shot (non-scrubbed) entrances that keep their own easing personality.

```js
let current = -1;
ScrollTrigger.create({
  trigger: pinHeight, start: "top top", end: "bottom bottom", pin: container, scrub: true,
  onUpdate: self => {
    const i = Math.round(self.progress * (items.length - 1));
    if (i === current) return;
    if (i > current) { items[i].classList.add("on"); gsap.from(items[i], { scale: 0.94, ease: "back.out(1.4)", duration: 0.5 }); }
    else             { items[current].classList.remove("on"); }
    current = i;
  },
  onLeaveBack: () => { current = -1; items[0].classList.remove("on"); },
});
```
- `Math.round` swaps at the midpoint (feels balanced); guard with a `current` ref so you don't write the DOM every frame; `onLeaveBack` resets.
- **Villa Senja:** step through "Experiences"/"Nearby" cards as you scroll a pinned panel — deliberate, not a continuous blur.

### 1.5 Pacing helpers
- **`stagger === duration` trick:** with GSAP's default `duration:0.5`, set `stagger:0.5` to make staggered targets exactly back-to-back (seamless sequential reveal in one `gsap.to`). Keep them equal if you change duration.
- **Step-normalized timeline:** `step = 1/(items-1)`; place each crossfade at absolute position `i*step` with `duration:step` so the whole sequence sums to 1.0 regardless of item count — add/remove a room without retiming.
- **Sub-pixel container counter-drift** (`y:"5%"→"-5%"`, `ease:"none"`) under a pin so the held scene "breathes" instead of freezing. Keep ±5%.

---

## 2. Masked / Clip / Aperture Reveals & Expands

> Make ONE of these your house reveal language for cohesion. For Villa Senja the `clip-path: inset()` aperture (§2.2) is the most on-brand — it reads like a camera shutter and never distorts the photo.

### 2.1 Two-layer slide mask (frame + content move opposite)
**How it works:** Outer wrapper `overflow:hidden`; an inner layer starts `translateY(-100%)` (above its mask); the image inside starts `translateY(90%)` (below). Animate both to `y:0` together — the frame drops down as the image rides up, unveiling through a moving slot. Far richer than a fade.

```js
/* CSS: .frame{overflow:hidden} .frame>div{overflow:hidden; transform:translateY(-100%)}
        .frame img{object-fit:cover; transform:translateY(90%)} */
gsap.to([div, img], { y: 0, duration: 0.6, ease: EASE });
```
- Image starts at 90% (not 100%) so motion is visible immediately; both layers in ONE tween stay locked.
- **Villa Senja:** every photo reveal (hero, room cards, about portrait). Trigger on ScrollTrigger enter — feels like a curtain opening on a Bali view.

### 2.2 `clip-path: inset()` aperture (the shutter)
**How it works:** Mask with `inset(0% X% round R)`. `X=15%` closes inward from both sides to a slit; animate to `0%` to open. Pure clip → no scale/width distortion; `round R` keeps corners through the motion. Works as `.to` (one-way) or `.fromTo` (scrub-reversible).

```js
gsap.fromTo(media,
  { clipPath: "inset(0% 15% round 1vw)" },
  { clipPath: "inset(0% 0% round 1vw)", duration: 0.6, ease: EASE });
```
- **Gotchas:** both endpoints need the SAME shape structure (same value count, same `round` presence) or GSAP can't interpolate. Add `-webkit-clip-path` for old Safari. clip-path is GPU-cheap and layout-free.
- **Villa Senja:** standardize this for hero open-on-load, section dividers wiping, gallery tiles blooming. One radius + one ease everywhere = strong motion identity.

### 2.3 Directional `scaleX` wipe via transform-origin flip
**How it works:** Reveal by growing from a sliver (`scaleX:0→1`, `transform-origin:0% 50%`), then later collapse toward the *opposite* edge (`scaleX:1→0`, `transform-origin:100% 50%`). Flipping the origin between the two tweens makes "open from left / seal to right" instead of a symmetric squash.

```js
gsap.fromTo(img, { transformOrigin: "0% 50%" },
  { transformOrigin: "0% 50%", scaleX: 1, ease: "none",
    scrollTrigger: { horizontal: true, trigger: el, start: "left 100%", end: "left 80%", scrub: true } });
gsap.fromTo(img, { transformOrigin: "100% 50%" },
  { transformOrigin: "100% 50%", scaleX: 0, ease: "none", immediateRender: false, // <- critical
    scrollTrigger: { horizontal: true, trigger: el, start: "right 20%", end: "right 0%", scrub: true } });
```
- **`immediateRender:false`** on the exit tween is mandatory — otherwise it applies its from-state at load and cancels the reveal.

### 2.4 `mask-image` gradient wipe (soft feathered edge)
**How it works:** Animate the numeric stops of a `linear-gradient` mask. Start fully clipped (opaque stop parked off-edge), tween to revealed (opaque fills, transparent pushed past the far edge). GSAP interpolates the percentages → a soft moving feather, softer than clip-path.

```js
/* CSS rest (hidden): mask-image: linear-gradient(90deg, #000 -25%, transparent 0%) */
gsap.to(line, { maskImage: "linear-gradient(90deg, #000 100%, transparent 125%)",
  ease: EASE, duration: 1 });
```
- **Gotcha:** both gradients need identical structure (same stop count, same colour tokens) or it hard-swaps. Set `-webkit-mask-image` too.
- **Villa Senja:** line-by-line body-copy reveals (about/philosophy) — feather the wipe in reading direction. Pair with §2.6 recentering.

### 2.5 Radial spotlight / flashlight mask (mouse-driven)
**How it works:** Stack a duplicate (accent-coloured) copy over a base; mask the duplicate with `radial-gradient(circle at var(--x) var(--y), #000 20%, transparent 25%)`. Drive `--x/--y` with `quickTo` so a soft disc of the accent version follows the cursor.

```js
const xTo = gsap.quickTo(".dup", "--xpercent", { duration: 0.4, ease: EASE });
const yTo = gsap.quickTo(".dup", "--ypercent", { duration: 0.4, ease: EASE });
section.addEventListener("mousemove", e => {
  xTo(gsap.utils.mapRange(0, innerWidth, 0, 100, e.clientX));
  const b = section.getBoundingClientRect();
  yTo(gsap.utils.mapRange(b.top, b.top + b.height, 0, 100, e.clientY)); // map Y to element box
});
```
- **Villa Senja:** an interactive headline where a warm-terracotta version reveals under the cursor on a stone base — "discover the luxury" moment. Generous feather for a soft sun-through-leaves edge.

### 2.6 Dynamic vertical recentering of revealing text (FLIP-lite companion)
**How it works:** As lines reveal one-by-one, nudge the block up by half a line-height per revealed line (in a *short, non-scrubbed* `gsap.to`) so the active line stays optically centred. `gsap.killTweensOf` before each to prevent stacking; handle `onReverseComplete` for scroll-up.

```js
const lineH = paragraph.clientHeight / split.lines.length;
const move = n => { gsap.killTweensOf(paragraph);
  gsap.to(paragraph, { y: -lineH * n / 2, duration: 0.2, ease: EASE }); };
```
- General **measure-then-animate (FLIP-lite):** read live `getBoundingClientRect`, compute the exact delta, tween to it — robust to font metrics/responsive sizing. Prefer relative `"+="` deltas since rects already include current transform.

---

## 3. SplitText / SplitType Kinetic Type

> You ship SplitType. Use `new SplitType(el, { types: "lines,words,chars" })` to get the same nested spans the masked reveals need; it's grapheme-safe (the vanilla `split('')` helpers below shatter emoji/combined glyphs — they're only a fallback mental model). **Always run inside `document.fonts.ready`** (§3.6).

### 3.1 The vanilla split helpers (fallback / mental model)
```js
const splitWords   = el => el.innerHTML = el.textContent.split(" ")
  .map(w => `<span class="word">${w}</span>`).join(" ");
const splitLetters = el => el.innerHTML = el.textContent.split("")
  .map(c => c === " " ? '<span>&nbsp;</span>' : `<span class="letter">${c}</span>`).join("");
/* CSS: .word,.letter{ display:inline-block } */  // REQUIRED or transforms no-op on inline text
```
- Spaces → `&nbsp;` spans to keep width. `join(" ")` (natural gaps) vs `join("")` (letter-spacing control) changes measured width — choose deliberately before computing any distance.

### 3.2 Word-by-word masked vertical reveal (the core editorial reveal)
**How it works:** Each word is double-wrapped — outer `.word{overflow:hidden; display:inline-block}` (mask) + inner `span{display:block}` (mover). Hidden state = inner `translateY(100%)`. Animate inner `y:"0%"` (in) / `"100%"` (out) so words wipe through the clip; `stagger` cascades them.

```js
// markup per word: <span class="word"><span>WORD</span></span>
gsap.to(p.querySelectorAll(".word span"), { y: "0%", duration: 1, stagger: 0.1, ease: EASE });
```
- **Gotcha:** the font-specific margin/padding fudge (`.word{margin:-0.14em 0}` + `.word span{padding:0.14em 0}`) stops Salmond's ascenders/descenders being clipped — retune for your font.
- **Villa Senja:** Salmond UPPERCASE headlines / section intros revealing word-by-word on enter. Stagger ~0.08–0.12, house ease. (This is the *new* type motion — leave your existing headline scrub alone.)

### 3.3 Per-letter clip-mask "swing/rise into view"
**How it works:** Letters split into `.letter` (a `clip-path` box) wrapping an inner span pre-set `y:"110%"` (or `rotate:-80` with `transform-origin:50% 120%` for a swing-up). Animate inner to `y:0`/`rotate:0`. Optionally randomize reveal order (Fisher–Yates) for a scattered ink feel, or keep sequential for elegance.

```js
gsap.from(span, { y: "110%", ease: EASE, duration: 0.8,
  scrollTrigger: { trigger: pinHeight, start: "top top-=" + d*i, end: "+=1",
    toggleActions: "play none reverse none" } });
/* CSS: .letter{display:inline-block; clip-path:polygon(-5% 5%,-5% 114%,105% 114%,105% 5%)} */
```
- clip-path uses slightly-outside-the-box points to avoid trimming tall glyphs (font-specific). `y:"110%"` (>100%) guarantees the glyph fully clears before reveal.
- **Villa Senja:** showpiece headers (the villa name) assembling letter-by-letter in a pinned section. Prefer sequential order for luxury.

### 3.4 Hover letter-flip with origin-based stagger (nav/menu)
**How it works:** Two stacked copies (visible + a `.hidden` copy at `bottom:100%`) inside an `overflow:hidden` line. On hover, animate both layers' letters `yPercent:100` so visible rolls out the bottom while the duplicate rolls in from the top. Read the hovered letter's index and pass it as `stagger.from` so the ripple radiates from the cursor.

```js
gsap.to(item.querySelectorAll("span"), { yPercent: 100, ease: "back.out(1.6)", duration: 0.6,
  stagger: { each: 0.023, from: hoveredIndex },
  onComplete: () => gsap.set(item.querySelectorAll("span"), { clearProps: "all" }) });
```
- Guard with `gsap.isTweening` so cursor jitter doesn't re-fire; `clearProps:"all"` resets so it repeats. `stagger.from` also accepts `"center"`, `"edges"`, `"random"`.
- **Villa Senja:** nav links / the booking CTA label rolling to a duplicate on hover with the ripple starting under the pointer.

### 3.5 Per-word scroll-velocity drift ("breathing" text)
**How it works:** Bucket words into 2–4 classes; give each a CSS em-padding offset and a scrubbed `x` tween that pulls it back through neutral as it passes. Different per-word triggers → a loose liquid jitter.

```js
const drift = (sel, dx) => document.querySelectorAll(sel).forEach(el =>
  gsap.to(el, { x: dx, ease: "none", scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 60%", scrub: 0.2 } }));
drift(".w1", "-0.4em"); drift(".w2", "0.8em");   // small ranges = luxe
```
- **Villa Senja:** the big UPPERCASE intro paragraph where words gently slide as you scroll. Keep ±0.4–0.8em, 2 buckets, for subtlety.

### 3.6 `document.fonts.ready` gate (mandatory for measured type)
```js
document.fonts.ready.then(() => {
  // SplitType, offsetTop line-grouping, width measurement, spacer sizing, ScrollTrigger setup
});
```
- Fallback-font metrics differ → wrong line breaks / distances that jump on font swap. Non-measuring effects (a plain word reveal) can skip it; anything reading widths/`offsetTop` cannot. Pair with `ScrollTrigger.refresh()` on resize. (Line detection without SplitType: group letters by comparing each `.letter.offsetTop` to the previous.)

### 3.7 Variable-font weight wave (premium, if you source a variable cut)
**How it works:** Each char's `font-variation-settings:'wght' var(--wght)`; animate the CSS var `250→750→250` with overlapping per-char timelines so a weight bulge travels through the word. Smoother than animating `font-weight` (which snaps).
```js
chars.forEach((c, i) => master.add(
  gsap.timeline().to(c, { "--wght": 750, duration: .5, ease: EASE }).to(c, { "--wght": 250, duration: .5, ease: EASE }),
  i * ((0.5 * 2) / 6)));   // ~6 letters mid-animation at once
```
- Only works with a true variable font exposing `wght`. If Salmond has no variable build, fall back to §3.2/§3.3.

---

## 4. Scroll-Velocity

> Velocity = expensive-feeling life, but **the corpus + your taste say: never shear big photos.** Apply velocity to the gallery *track*, to small atoms, or to subtle squash — and always let it decay back to rest.

### 4.1 `ScrollTrigger.getVelocity()` as a driver
**How it works:** In a global `onUpdate`, read signed px/sec, scale by a tiny factor, clamp, drive a property, and let it relax with `overwrite:true`.
```js
const setSkew = gsap.quickSetter(targets, "skewY", "deg"); // quickSetter = instant, you smooth via the relax tween
ScrollTrigger.create({ onUpdate: self => {
  const v = gsap.utils.clamp(-8, 8, self.getVelocity() / -220);
  gsap.to(targets, { skewY: v, duration: 0.7, ease: "power3", overwrite: true });
}});
```
- **Villa Senja TASTE RULE (learned the hard way):** this exact skew on `.lead__media,.dining__media…` was cut — it wobbles big rectangles. Put it on the horizontal gallery track (slight stretch in pan direction) or on a marquee, NOT vertical images.

### 4.2 Velocity-driven squash/stretch with idle reset
```js
const scaleTo = gsap.quickTo(el, "scaleY", { duration: 0.6, ease: "power4" });
let idle;
function onWheel(e) {
  scaleTo(1 - gsap.utils.clamp(-0.05, 0.05, e.deltaY / 300)); // tight ±0.05 for restraint
  clearTimeout(idle); idle = setTimeout(() => scaleTo(1), 66); // settle when input stops
}
```
- `deltaY` magnitude is device/OS-dependent — the divisor is your tuning knob; retune for trackpad vs mouse vs Lenis.

### 4.3 Idle-detect + decay (the universal "relax to rest" pattern)
**How it works:** Wheel/mousemove have no "stopped" event. Debounce a `setTimeout` (~66ms ≈ 4 frames) cleared on every event; the last one fires and retargets your `quickTo`s back to neutral so velocity-driven offsets glide home. For *momentum* without InertiaPlugin, feed a smoothed `delta` into a `quickTo` whose `onUpdate` integrates `pos += delta` and spring `delta→0` on stop.
```js
let idle;
function onMove() { /* drive motion from frame deltas */ clearTimeout(idle);
  idle = setTimeout(() => { rotTo(0); xTo(0); yTo(0); }, 66); }
```
- **Villa Senja:** required companion to any velocity touch so the UI never feels stuck mid-tilt. Derive velocity from frame deltas (`value = pos - oldPos`), scale it down (`/4`), and always decay.

### 4.4 Distance-accumulator throttle (act on travel, not time)
**How it works:** Sum `Math.abs(delta)` of pointer/scroll travel; trigger an event (spawn image, advance carousel) when it crosses a viewport-relative threshold, then reset. Decouples cadence from frame rate; fast movement = rapid fire, still = frozen.
```js
incr += Math.abs(x - oldX) + Math.abs(y - oldY);
if (incr > innerWidth / 8) { incr = 0; spawn(); }   // threshold scales with screen
```
- Prime `oldX/oldY` on the first move (`{once:true}`) so the opening delta isn't a huge corner-jump.
- **Villa Senja:** a curated cursor photo-trail ("discover the spaces") with a generous threshold so images bloom along the path rather than spam.

---

## 5. Infinite Marquees

### 5.1 Seamless marquee via duplicate + half-width travel
**How it works:** Duplicate the content so the strip is ≥2×; translate by exactly *half* its rendered size (`-clientWidth/2`). Because the second half mirrors the first, the `-50%` point looks identical to `0%`, so a linear `repeat:-1` loop has no seam.
```js
document.fonts.ready.then(() => {              // measure AFTER fonts
  gsap.to(rowA, { x: () => -rowA.clientWidth / 2, ease: "none", duration: 12, repeat: -1 });
  gsap.from(rowB, { x: () => -rowB.clientWidth / 2, ease: "none", duration: 12, repeat: -1 }); // counter-scroll
});
/* CSS: .row p{display:flex; white-space:nowrap; width:max-content; will-change:transform} */
```
- `ease:"none"` mandatory; measure after fonts or the seam jumps; `gsap.to` vs `gsap.from` on two rows = opposite directions.
- **Villa Senja:** a Salmond serif band ("UBUD · BALI · SECLUSION ·") over a Hanken line, counter-scrolling, as a section divider. (You already have a CSS marquee ticker — this is the GSAP upgrade if you want scroll-reactivity.)

### 5.2 `quickTo` + `utils.wrap` + `unitize` (input-reactive infinite loop)
**How it works:** `half = content.clientWidth/2`; `wrap = gsap.utils.wrap(-half, 0)` folds any value into `[-half,0)`; apply it inside `quickTo`'s `modifiers` (wrapped via `unitize` to re-add `px`). Drive a `total` accumulator from wheel/drag + a constant `dt`-based drift → endless, eased, input-nudgeable.
```js
const half = content.clientWidth / 2;
const xTo = gsap.quickTo(content, "x", { duration: 0.5, ease: "power3",
  modifiers: { x: gsap.utils.unitize(gsap.utils.wrap(-half, 0)) } });
let total = 0;
gsap.ticker.add((t, dt) => { total -= dt / 20; xTo(total); });   // slow ambient drift (luxury)
Observer.create({ target: content, type: "wheel,pointer,touch", onChange: e => { total += e.deltaX; xTo(total); } });
```
- Duplicate content exactly; wrap over EXACTLY one set's width or it seams. `unitize` is required (modifier returns a unitless number).
- **Villa Senja:** guest-photo / place-name marquees that drift slowly and react to scroll velocity. Slow the divisor (~20) for calm.

### 5.3 Multi-column parallax marquee from one input
**How it works:** Feed the SAME wrapped accumulator to several columns whose `quickTo` durations differ (0.5 / 2 / 3s). Longer duration = more lag = "further" layer — the easing IS the parallax, no per-element speed math.
```js
const a = gsap.quickTo(c1, "y", { duration: 0.5, ease: "power3" }); // front/fast
const b = gsap.quickTo(c2, "y", { duration: 2,   ease: "power3" }); // back/slow
gsap.ticker.add(() => { a(v); b(v); });
```
- On each wrap, swap the recycled element's `src` (and randomize `x`) so columns feel infinite/non-repeating (use `gsap.utils.snap` to detect the wrap crossing).

---

## 6. Drag & Inertia

### 6.1 Pointer drag-to-scroll (your shipped pattern, distilled)
```js
let down = false, startX = 0, startScroll = 0, moved = 0;
track.addEventListener("pointerdown", e => { down = true; moved = 0; startX = e.clientX;
  startScroll = track.scrollLeft; track.setPointerCapture?.(e.pointerId); track.classList.add("is-dragging"); });
track.addEventListener("pointermove", e => { if (!down) return;
  moved = Math.abs(e.clientX - startX); track.scrollLeft = startScroll - (e.clientX - startX); });
["pointerup","pointercancel","pointerleave"].forEach(ev => track.addEventListener(ev, () => { down = false; track.classList.remove("is-dragging"); }));
track.addEventListener("click", e => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true); // suppress drag-end click
```
- The `moved > 6` click-suppression is the detail that prevents accidental link clicks at the end of a drag. Honour `motionOff` (you set `track.scrollLeft` directly instead of gliding).

### 6.2 Observer + quickTo momentum scroll (smoother, unified input)
**How it works:** GSAP `Observer` normalizes wheel/touch/pointer into one `onDrag`; accumulate `deltaX` into a clamped `total`; feed `gsap.quickTo(container,"scrollLeft",{ease:"power4"})` for inertial glide without rAF.
```js
const xTo = gsap.quickTo(container, "scrollLeft", { duration: 0.5, ease: "power4" });
let total = container.scrollLeft;
Observer.create({ target: container, type: "touch,pointer",
  onDragStart: () => total = container.scrollLeft,
  onDrag: self => { total = gsap.utils.clamp(0, container.scrollWidth - container.clientWidth, total - self.deltaX * 1.4); xTo(total); } });
/* CSS: .container{cursor:grab} img{user-select:none; -webkit-user-drag:none} */
```
- `gsap.utils.clamp(min,max,value)` — value is the THIRD arg. Disable native image drag/select or it fights Observer. Wheel & touch `deltaY` have opposite natural signs — invert one.
- **Villa Senja:** a grabbable photo rail with luxurious `power4` glide on desktop + touch.

### 6.3 Infinite wrap drag (1D/2D) — endless pannable field
**How it works:** Duplicate content (1D: 2×; 2D: a 2×2 grid, `width:max-content`); `half = clientWidth/2`; apply `gsap.utils.wrap(-half,0)` inside `quickTo.modifiers`; accumulate input into an unbounded `total`. Draw = wrapped(total); the unbounded accumulator stays separate from the drawn (wrapped) value so momentum compounds without jumps.
```js
function infiniteSetter(el, prop, tile) {
  return gsap.quickTo(el, prop, { duration: 1, ease: "power4",
    modifiers: { [prop]: gsap.utils.unitize(gsap.utils.wrap(-tile, 0)) } }); }
```
- Set `overflow:hidden; overscroll-behavior-x:none` on body so trackpad swipes don't trigger browser back-nav.
- **Villa Senja:** an "explore Ubud" moodboard the visitor flings in any direction; `power4` + ~1.5s = dreamy.

### 6.4 InertiaPlugin velocity throw (tasteful physics fling)
**How it works:** Track pointer velocity (frame deltas) in outer scope; on an element, `inertia:{ x:{velocity, end}, y:{velocity, end} }` flings it with that speed and settles at `end` (InertiaPlugin computes the duration). Layer an elastic pop + back.in shrink for a full pop-throw-vanish lifecycle.
```js
gsap.registerPlugin(InertiaPlugin);
gsap.to(img, { inertia: { x: { velocity: dx * 20, end: x }, y: { velocity: dy * 20, end: y } } }); // ±20 restrained
```
- Throw distance scales with DPI/event rate — tune the multiplier. Guard with `registerPlugin` (throws silently if absent).
- **Villa Senja:** ONE signature throw (e.g. a hover-flick on gallery thumbnails that eases home). Keep velocity low for elegance.

### 6.5 Self-killing spawn lifecycle (for any ephemeral spawned element)
```js
function spawn(src) {
  const el = document.createElement("img"); el.src = src; root.appendChild(el);
  const tl = gsap.timeline({ onComplete: () => { el.remove(); tl.kill(); } }); // remove node AND kill tl
  tl.fromTo(el, { scale: 1.2, xPercent: -50, yPercent: -50 }, { scale: 1, ease: "back.out(1.4)", duration: 0.5 })
    .to(el, { scale: 0.6, autoAlpha: 0, ease: "back.in(1.4)", duration: 0.3, delay: 1.4 });
}
```
- Forgetting `tl.kill()` leaks the timeline even after the node is gone. Cap dynamically-stacked elements (`if (container.children.length > 20) container.children[0].remove()`). Preload via a hidden 1px source list and cycle src with `(i+1) % srcs.length`.

---

## 7. Mouse Parallax / 3D Tilt

### 7.1 `quickTo` cursor follower with lag + velocity lean
**How it works:** Two `quickTo`s (x,y) trail the pointer with weight; a third on `rotation` leans into travel direction from the frame delta; idle-reset rotation to 0. Centre the follower with CSS `translate(-50%,-50%)` and treat x/y as additive offsets (don't double-centre); add `scrollY` only if absolutely (not fixed) positioned.
```js
const xTo = gsap.quickTo(card, "x", { duration: 0.5, ease: "power3" });
const yTo = gsap.quickTo(card, "y", { duration: 0.5, ease: "power3" });
const rTo = gsap.quickTo(card, "rotation", { duration: 0.6, ease: "power3" });
let oldX = 0, idle;
addEventListener("mousemove", e => {
  xTo(e.clientX); yTo(e.clientY); rTo(gsap.utils.clamp(-6, 6, (e.clientX - oldX) / 4)); oldX = e.clientX;
  clearTimeout(idle); idle = setTimeout(() => rTo(0), 66);
});
```
- **Villa Senja:** the custom cursor (and a floating room-preview that trails the pointer). Use a soft `power3`, restrained lean — your single easing personality, not a snappy `power4`.

### 7.2 3D tilt toward cursor (perspective scene)
**How it works:** Normalize cursor to `[-1,1]`, multiply by a small max angle, feed `quickTo` on `rotationY` (from X) and `rotationX` (from Y, negated so it tilts *into* the cursor). Parent needs `perspective`; target needs `transform-style:preserve-3d`.
```js
/* CSS: .stage{perspective:300vw} .card,.card *{transform-style:preserve-3d} */
const rY = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power2" });
const rX = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power2" });
addEventListener("mousemove", e => {
  rY(((e.clientX / innerWidth) * 2 - 1) * 8);     // ±8° restrained (sources used ±40)
  rX(-(((e.clientY / innerHeight) * 2 - 1) * 6));
});
```
- Keep angles tiny (±5–8°) for luxury; perspective on the ANCESTOR or it reads flat. For a per-card grid, store an array of `quickTo` pairs and cache `getBoundingClientRect` (update on resize/scroll) for large counts.
- **Villa Senja:** subtle hero composition tilt or a featured-room plate. Add a foreground frame over an oversized (120%, offset -10%) background layer for counter-parallax depth.

### 7.3 The `quickTo + clamp + mapRange` input rig (reusable everywhere)
```js
const clampX = gsap.utils.clamp(0, innerWidth);
const toRot  = gsap.utils.mapRange(0, innerWidth, -8, 8);  // invert min/max to flip an axis
const set    = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: EASE });
addEventListener("mousemove", e => set(toRot(clampX(e.clientX))));
```
- Always `clamp` before `mapRange` so off-window/overscroll values stay sane. Create `quickTo` once. Unify mouse + touch into one `applyMove(clientX,clientY)`.

---

## 8. Physics (Matter.js bridged to GSAP)

> "Tasteful physics" = ONE moment, gentle constants, gated to viewport. Bridge the sim to the DOM via `gsap.ticker` (one clock).

### 8.1 Zero-gravity floating bodies pulled toward the cursor
**How it works:** `Engine.create({gravity:{x:0,y:0}})`; a `Bodies.rectangle` per element sized from `clientWidth/Height` with per-item `frictionAir` (varied "weight"). A `gsap.ticker` callback applies a steering force toward the cursor and writes `body.position` (centroid) back to the DOM minus half-size (CSS translate is top-left).
```js
const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
items.forEach(({ el, body, w, h }) => Matter.World.add(engine.world, body));
Matter.Runner.run(Matter.Runner.create(), engine);
function tick() { items.forEach(({ el, body, w, h }) => {
  Matter.Body.applyForce(body, body.position, { x: (cx - body.position.x) * 0.0004 * pulse.m, y: (cy - body.position.y) * 0.0004 * pulse.m });
  el.style.transform = `translate(${body.position.x - w/2}px,${body.position.y - h/2}px) rotate(${body.angle}rad)`;
}); }
```
- **Centroid vs top-left:** subtract `w/2,h/2` or everything's offset. Read body sizes after images have layout. Gate the ticker to viewport (§0.4).

### 8.2 Cursor IMPULSE via a tweened multiplier (pulse, not sticky hold)
**How it works:** Instead of constant attraction (feels clingy), ramp a scalar `m` to 1 fast then back to 0 on each move; multiply the steering force by it → a brief shove then coast.
```js
const pulse = { m: 0 };
function onMove(x, y) { tx = clampX(x); ty = clampY(y);
  gsap.to(pulse, { m: 1, duration: 0.15, overwrite: true });
  gsap.to(pulse, { m: 0, duration: 0.6, delay: 0.15 }); }
```
- `overwrite:true` on the ramp prevents stacking dozens of force spikes during fast movement. (Transferable beyond physics: drive cursor scale / parallax intensity with attack-decay.)

### 8.3 Physics text — letters as spring-anchored bodies reacting to scroll velocity
**How it works:** Split to inline-block letters; each letter = a body tethered by a soft `Constraint` (spring) to its original spot, neighbours linked by stiff constraints (word holds together). `ScrollTrigger.onUpdate` nudges each spring's anchor by `getVelocity()*factor*weight` (end letters swing more); the ticker steps the engine, applies angular damping, writes deltas to the DOM.
- **Villa Senja:** ONE physics headline (e.g. "SENJA") that sways and settles as you scroll past, always returning to a crisp baseline. Salmond serif, gentle constants. `collisionFilter` group from `Body.nextGroup(true)` so letters pass through each other; measure inside `document.fonts.ready`.

---

## 9. 3D Depth / Perspective

### 9.1 Per-element scroll-scrubbed 3D spin
**How it works:** Each card scrubs `rotationY:0→360` across its on-screen travel; SECTION owns `perspective`, the CONTAINER owns `preserve-3d`. 360 (not 180) means start/end both face front → no boundary pop. Out-of-phase per-card triggers = a flock.
```js
/* CSS: .stage{perspective:200vw} .container{transform-style:preserve-3d} */
gsap.utils.toArray(".media").forEach(m => gsap.to(m, { rotationY: 360, ease: "none",
  scrollTrigger: { trigger: m, start: "top bottom", end: "bottom top", scrub: true } }));
```
- `perspective` on an ancestor, `preserve-3d` on the immediate parent, or it flattens to a squish.

### 9.2 Counter-translate-Z "thickness" trick (give flat text a 3D pivot radius)
**How it works:** Nest two transforms whose Z offsets cancel: parent `translateZ(-8vw)` (inside `preserve-3d`), child `translateZ(+8vw)`. Net position unchanged (text stays sharp/centred) but the child now orbits a pivot 8vw behind it — rotations read as a solid drum, not paper.
```css
.panel { transform: translate3d(-50%,-50%,-8vw); transform-style: preserve-3d; }
.panel > .face { transform: translate3d(0,0,8vw); backface-visibility: hidden; }
```
- Values must be equal & opposite or text drifts toward/away during rotation. Reuse for any 3D-rotated type/cards to add weight.

### 9.3 3D z-tunnel / depth fly-through with recycled elements
**How it works:** `perspective` on the stage, `preserve-3d` on children; items start far back (`translateZ(-300vw)`), one staggered `repeat:-1` tween brings them to `z:0`. On `stagger.onRepeat`, reposition the item (random x/y within 20–80% frame) and swap its `src` to the next preloaded image → a finite node set reads as an infinite stream. Optical-centre with `top:calc(50% - Nvw)` (true 50% looks low under perspective).
- **Villa Senja:** a "gallery in space" — villa photos floating toward the viewer out of the warm-dark, optionally wheel-velocity controlled (§4). Modest z-travel = elegant depth, not a screensaver.

### 9.4 3D cylinder / sphere distribution
- **Cylinder:** place N slats by `rotationY = 360/n * i` with `transform-origin: 50% 0 Rvw` (3rd value = radius behind the slat) so each swings onto a cylinder of radius R; nest idle-spin / wheel-spin / mouse-tilt on THREE separate layers so they compose without manual summing. Double the ring (back faces flipped) for no gaps.
- **Sphere (Fibonacci):** `y = 1 - 2i/(n-1)`, `theta = i*goldenAngle` (`PI*(3-√5)`); store rotation as a 3×3 matrix and **premultiply by screen-axis rotations** (trackball — avoids gimbal lock) from smoothed drag deltas; write `translate3d`. Set `preserve-3d` via `gsap.set` to dodge a Safari bug.
- **Villa Senja:** a slowly auto-rotating ring/orb of villa photography the guest nudges with wheel/drag — pin it so it doesn't hijack page scroll; slow the spin, tone the tilt for calm.

---

## 10. Stacking & Cards

### 10.1 3D card-deck flip-up / flip-deal on scroll
**How it works:** Absolutely stack cards (`inset:0`) in a `perspective` container; pre-rotate to a hidden pose; one scrubbed tween rotates them up/over with a stagger (NEGATIVE stagger = reverse-order peel). Use a 1–2px `translateZ` on back faces to kill z-fighting; `transform-origin:50% 101%` to flip over the bottom edge like a flip-calendar.
```js
gsap.to(cards, { rotationX: -360, stagger: -0.15, ease: "power3.in",
  scrollTrigger: { trigger: pinHeight, start: "top top", end: "bottom bottom", pin: container, scrub: true } });
```
- `backface-visibility:hidden` removes mirrored back text; manage z-index in JS (descending, then 0 mid-flip) to avoid fighting.

### 10.2 Mouse-zone detection over an overlapping stack (no per-card listeners)
**How it works:** ONE `mousemove` on the container maps cursor x to a band index — `Math.ceil((e.clientX - rect.left)/W * cardCount)` — robust where overlapping negative-margin cards make `mouseenter` flicker. Guard against re-firing while in the same band.
- **Fan-out neighbours by inverse distance:** the active card pops to neutral+scale; every other card's content shifts `xPercent: 80/(index - activeIndex)` so neighbours part most and the effect decays with distance — a hand-of-cards spread.

### 10.3 Flex-basis accordion (expand-on-hover rows)
```js
item.addEventListener("mouseenter", () => {
  gsap.to(items, { flex: "1 1 45px", duration: 0.2, ease: "power2.inOut" }); // collapse all
  gsap.to(item,  { flex: "1 1 122px", duration: 0.2, ease: "power2.inOut" }); // grow one
});
```
- One of the few OK uses of animating `flex` (few nodes). Rows `overflow:hidden` to mask revealed media. Pair with prebuilt *paused* per-row timelines played/reversed on hover (reverse at `timeScale(3)` for snappy exit vs deliberate entry).
- **Villa Senja:** a "Spaces" navigator (Bedrooms / Pool / Spa / Dining) expanding to reveal thumbnails — clean, gallery-like.

### 10.4 Fanned arc / radial layout (off-screen pivot)
**How it works:** Place cards at the top edge of a HUGE circle/square (`width:300vw`, centre pushed off-screen) so small rotation deltas sweep them along a gentle arc; counter-rotate each card's content by `-angle` to keep it upright. Bigger container = flatter, more elegant arc. Drive the spin by scroll (scrub) or wheel (`quickTo` on `rotation`).
- **Villa Senja:** a "moments at the villa" arc gallery or a circular amenities wheel; tight angle (2–3°), Salmond captions, `overflow:hidden` on the section.

---

## 11. 3D Text Flips

### 11.1 Hinged flip-card / rolodex line swap
**How it works:** Stacked lines at the same centre; ancestor `perspective`, each `<p>` `preserve-3d` + the §9.2 Z-thickness trick. Hidden lines pre-set `rotateX:-90` (edge-on below); per swap: current `rotateX:0→90` (flips up/away) while next `rotateX:-90→0` (flips in). `backface-visibility:hidden` hides the back half.
```js
gsap.set(paragraphs, { rotateX: -90 }); gsap.set(paragraphs[0], { rotateX: 0 });
tl.to(cur, { rotateX: 90, duration: step, ease: EASE }, pos);
tl.fromTo(next, { rotateX: -90 }, { rotateX: 0, duration: step, ease: EASE }, pos);
```

### 11.2 Compound axis split (parent flips X, child tilts Z + fades)
**How it works:** Animate DIFFERENT axes on parent vs child at the same timeline position so the moves compose without fighting GSAP's one-transform-per-element model. Alternate the child's Z-tilt sign per index (`±20°→±6° for restraint`) for a hand-set rhythm; fade as a short sub-beat delayed into the flip.

### 11.3 Word-mask / letter parallax swap (no 3D)
**How it works:** Stack paragraphs (non-first absolute `top:0`); each split to masked words/letters. Per pair: outgoing words fall out the bottom (`y:"100%"`, `power4.in`) while incoming rise in (`y:"0%"`, `power4.out`) started at `"<"` but with a `delay` so the hand-off is crisp, not a mush. The parallax variant: letters use a *weaker* ease than their line so they trail/peel.
```js
tl.to(cur.querySelectorAll(".word span"),  { y: "100%", stagger: 0.2, duration: 1, ease: "power4.in" });
tl.to(next.querySelectorAll(".word span"), { y: "0%",   stagger: 0.2, duration: 1, ease: "power4.out", delay: 1.4 }, "<");
```
- **Villa Senja:** rotating testimonials / philosophy lines ("Wake to birdsong" → "Dine under the stars") swapping word-by-word in a pinned panel. Add ScrollTrigger snap for a read-each-line cadence.

### 11.4 3D drum/odometer through a slot mask
- Letters on the inside of a rotating cylinder (`rotateX` outer + `translateZ` inner), viewed through a vertical `mask-image` slot band (`transparent→#000→transparent`) so glyphs only appear in the focus slot. `stagger:{from:"random"}` for a slot-machine feel. Short words only (legibility).

---

## 12. Page / Section Transitions

### 12.1 Scroll-hint that fades on first scroll (the ubiquitous courtesy)
**How it works:** A fixed-centred "Scroll" cue faded out via a 1px-tall trigger window; `toggleActions` makes it reversible at the very top. `autoAlpha` also kills pointer-events.
```js
gsap.to(".scroll", { autoAlpha: 0, duration: 0.2,
  scrollTrigger: { trigger: root, start: "top top", end: "top top-=1",   // 1px = fires immediately
    toggleActions: "play none reverse none" } }); // [onEnter,onLeave,onEnterBack,onLeaveBack]
```
- Use `autoAlpha` not `opacity`. The 1px end makes it a binary toggle (no scrub). For Observer-driven scenes with no scroll position, use a one-shot `hasInteracted` flag instead.
- **Villa Senja:** the hero "Scroll to explore" / down-chevron in Hanken, dissolving the moment the guest engages; hand off to the custom cursor.

### 12.2 CSS `position:sticky` for simple holds (zero-JS pinning)
**How it works:** When you just need "hold this for a while," prefer `position:sticky; top:calc(...)` over a JS pin — cheaper, jank-free, and reserves your ScrollTrigger budget for the heavy scenes. (Fails if any ancestor has `overflow:hidden/auto`.)
- **Villa Senja:** your Day section's sticky pool image already does this; reserve real pins for aperture/scrollytelling set-pieces.

### 12.3 `toggleActions` & `containerAnimation` as transition primitives
- `toggleActions` order is always `onEnter / onLeave / onEnterBack / onLeaveBack` — drives nav show/hide, a sticky "Book" bar after the hero, section-enter one-shots, cursor state changes.
- For horizontal "page" transitions (rotating numerals/labels as panels slide through), use `containerAnimation` (§1.3) with horizontal start/end.

### 12.4 Off-canvas entrance rigs
- **Sweep-off:** combine `xPercent:±100` (move by element's own width) + `x:±viewport` so an element fully clears on every breakpoint without per-device math.
- **Stacked absolute-centre:** all transitioning items at `top:50%;left:50%` + `translate(-50%,-50%)` so they swap in place with zero layout shift; visibility is transform/opacity only.
- **Random scatter-in around a rest state:** bake per-element random `{x,y,rotation}` (use `gsap.utils.random([...],true)` for a stable-but-organic seed) so a grid assembles from a slightly scattered, hand-placed state. Keep ±3°/±20% for craft, not chaos.

---

## Quick-reference: param/easing cheat-sheet

| Context | Ease | Duration / scrub | Notes |
|---|---|---|---|
| Scrubbed structural (pins, horizontal, parallax) | `"none"` | `scrub:true` or `0.5–1` | linear is mandatory under scrub |
| House reveals / flips / type | your `EASE` (`expo.inOut` / `power3.inOut` / CustomEase) | 0.6–1s | one personality everywhere |
| Cursor follow / parallax / quickTo | `power2`/`power3` | 0.4–0.6s | create quickTo once; soft for luxury |
| Momentum / drift / infinite | `power3`/`power4` | 0.5–1.5s | + `dt`-based baseline drift |
| Spring accents (NOT scrubbed) | `back.out(1.4)`, `elastic.out(1,0.7)` | 0.5–0.8s | play on a paused tl via onEnter |
| Velocity touches | `power3`+`overwrite:true` | relax 0.3–0.7s | clamp tightly; never on big photos |
| Idle decay debounce | — | `setTimeout(...,66)` | clear+reset every event |
| Restraint ranges | — | rot ±4–8°, scale 1.05–1.15 | halve the source defaults |

**Villa Senja golden rules, condensed:** one `EASE`; Lenis→`gsap.ticker`→`lagSmoothing(0)`; gate everything behind `motionOff` with a complete static fallback + try/catch; `quickTo`/`quickSetter` + transforms only; gate per-frame loops to viewport; `document.fonts.ready` before measuring type; clip-path aperture as the house reveal; never velocity-skew big photos; don't touch the existing headline/image reveals.

---

## Top patterns for Villa Senja
- **clip-path: inset() aperture reveal (shutter)** — Adopt as the ONE house reveal language: hero image opens from a slit on load, section dividers wipe, gallery tiles bloom. fromTo inset(0% 15% round 1vw) -> inset(0% 0% round 1vw) with the single EASE; same radius everywhere. Layout-free, GPU-cheap, reads like a camera shutter — perfectly on-brand. Keep both endpoints same shape structure or GSAP can't interpolate.
- **Pin-height chassis + horizontal pinned scroll with containerAnimation per-item entrances** — You already ship the pinned horizontal gallery (dist = track.scrollWidth - pin.clientWidth, invalidateOnRefresh). Upgrade it: pass the pan tween as containerAnimation to each photo so cards arrive slightly tilted (±3deg) and de-tilt as they reach centre — a signature Awwwards detail that's nearly free. Reuse the pin-height(Nvh)+container(100vh) chassis for a 'A Day at Senja' scrollytelling beat.
- **Word-by-word masked vertical reveal via SplitType (overflow-hidden word + inner mover)** — The NEW kinetic type Godwin wants (leave existing headline scrub alone): Salmond UPPERCASE section intros wiping in word-by-word on enter — new SplitType(el,{types:'words'}), inner span y:'100%'->'0%', stagger 0.08-0.12, house EASE. Run inside document.fonts.ready; retune the descender margin/padding fudge for Salmond.
- **quickTo cursor follower with velocity lean + idle reset (custom cursor)** — The custom cursor: two quickTo setters (x,y, power3, ~0.4s) trail the pointer with weight; a third on rotation leans into frame-delta velocity, debounced back to 0 after 66ms. Same rig (with mapRange) powers magnetic buttons (you have these) and a floating room-preview that trails on hover. One soft easing, not snappy power4.
- **Velocity touch with idle decay — but NEVER skew big photos** — Hard taste rule learned: velocitySkew on .lead__media/.dining__media was cut ('looks shit') because it shears big rectangles. If you want a momentum touch, put a slight directional stretch on the horizontal gallery TRACK (reads well on a horizontally-moving strip) or on small text atoms, driven by ScrollTrigger.getVelocity() with clamp + overwrite:true + 66ms decay. Keep it off vertical editorial images.
- **Seamless infinite marquee (duplicate + half-width travel, or quickTo+utils.wrap for scroll-reactive)** — GSAP upgrade of your CSS ticker: a Salmond serif band ('UBUD · BALI · SECLUSION ·') over a Hanken line counter-scrolling as a section divider. For scroll-reactivity use quickTo + utils.wrap(-half,0) + unitize with a slow dt/20 baseline drift so it's alive at rest and nudges on scroll. Measure width after document.fonts.ready.
- **Discrete index-stepping inside a scrubbed pin (one-card-at-a-time)** — Step through 'Experiences'/'Nearby' cards in a pinned panel: onUpdate index = Math.round(progress*(n-1)), reveal on increase / hide on decrease with a one-shot back.out(1.4) pop (NOT scrubbed, so the spring reads). Deliberate, paced storytelling instead of a continuous blur — fits the luxury 'restraint' brief and your no-janky-scroller preference.
- **motionOff gate + per-effect try/catch fail-safe + document.fonts.ready** — Keep your motionOff = reduce || navigator.webdriver gate around the whole AWWWARDS-LEVEL MOTION block so headless screenshots and reduced-motion users get a clean COMPLETE static page (CSS resting state = finished look). Wrap each new effect in try/catch that forces the finished state (like initDraw does). Gate every SplitType/measured effect on document.fonts.ready so Salmond metrics are correct.
