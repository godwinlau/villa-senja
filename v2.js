/* ============================================================
   VILLA SENJA — motion
   Lenis (smooth scroll) + GSAP/ScrollTrigger + SplitType,
   mirroring the eathungrytiger.com interaction stack.
   ============================================================ */

(function () {
  "use strict";

  const hasGSAP = typeof gsap !== "undefined";
  const hasLenis = typeof Lenis !== "undefined";
  const hasSplit = typeof SplitType !== "undefined";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Disable the continuous rAF/scroll motion when the user asked for reduced
  // motion OR when an automated browser is driving the page (e.g. screenshot
  // tooling) — a GPU-less headless renderer can't paint a busy rAF loop.
  const motionOff = reduce || navigator.webdriver === true;

  // Footer year
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Loader handle (the "through the gate" intro) — hidden instantly in static mode
  const loaderEl = document.querySelector("[data-loader]");
  const hideLoader = () => { if (loaderEl) loaderEl.style.display = "none"; };

  // Hero layout variations — preview with ?hero=2 or ?hero=3 (default = centred)
  (function applyHeroVariant() {
    const v = new URLSearchParams(location.search).get("hero");
    const hero = document.querySelector(".hero");
    if (!hero || !v) return;                      // default = hero--v2 (set in the markup)
    hero.classList.remove("hero--v2", "hero--v3"); // ?hero=1 → original centred; 2/3 switch
    if (v === "2" || v === "3") hero.classList.add("hero--v" + v);
  })();

  /* ---------- Header: invert over dark sections + hide on scroll-down ----------
     Runs in every mode so colors are correct even without smooth scroll.      */
  function initHeader(lenis) {
    const header = document.querySelector("[data-header]");
    if (!header) return;
    const darkSections = Array.from(
      document.querySelectorAll('.hero, .cta, [data-theme="dark"]')
    );
    let lastY = window.scrollY;

    const update = () => {
      const y = window.scrollY;
      const showThru = window.innerHeight * 1.6;   // keep the header shown through the pinned hero so the hero→nav video-logo crossfade is visible; auto-hide only past it
      if (y > showThru && y > lastY + 4) header.classList.add("is-hidden");
      else if (y < lastY - 4 || y < showThru) header.classList.remove("is-hidden");
      lastY = y;

      // warm paper scrim once we've left the hero (transparent over the hero photo)
      const heroH = (document.querySelector(".hero")?.offsetHeight) || window.innerHeight;
      header.classList.toggle("is-scrolled", y > heroH - header.offsetHeight - 24);

      const mid = header.offsetHeight * 0.5;
      let dark = false;
      for (const s of darkSections) {
        const r = s.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) { dark = true; break; }
      }
      header.classList.toggle("is-dark", dark);
    };

    update();
    if (lenis) lenis.on("scroll", update);
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ---------- Live Ubud time → lights up the current stop on the day timeline ----------
     Reads real Bali time (WITA / Asia/Makassar, UTC+8) and marks "now". Runs in every
     mode — it's data, not motion — so it works even under reduced-motion / automation. */
  function initClock() {
    const clockEls = document.querySelectorAll("[data-clock]");
    const nowLabel = document.querySelector("[data-now-label]");
    const stops = Array.from(document.querySelectorAll(".tl[data-min]"));
    if (!clockEls.length && !stops.length) return;
    const tick = () => {
      let h, m;
      try {
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit", hour12: false,
        }).formatToParts(new Date());
        h = +parts.find((p) => p.type === "hour").value;
        m = +parts.find((p) => p.type === "minute").value;
      } catch (e) {
        const d = new Date(); h = d.getHours(); m = d.getMinutes();   // fallback: local time
      }
      const pad = (n) => String(n).padStart(2, "0");
      clockEls.forEach((el) => (el.textContent = pad(h) + ":" + pad(m)));
      // living senja clock — colour the header dot by time of day, show the word at dusk
      let tod = "day";
      if (h < 6) tod = "night"; else if (h < 9) tod = "dawn"; else if (h >= 17 && h < 19) tod = "senja"; else if (h >= 19) tod = "night";
      document.documentElement.setAttribute("data-tod", tod);   // also drives the Live-senja hero grade
      document.querySelectorAll(".nav__meta").forEach((mEl) => mEl.setAttribute("data-tod", tod));
      document.querySelectorAll("[data-clock-word]").forEach((wEl) => (wEl.textContent = tod === "senja" ? "· senja" : ""));
      const todWord = { dawn: "first light", day: "midday", senja: "senja", night: "night" }[tod] || "senja";
      const liveEm = document.querySelector("[data-hero-live] em");
      if (liveEm) liveEm.textContent = todWord;
      if (stops.length) {
        const nowMin = h * 60 + m;
        const firstMin = +stops[0].dataset.min;
        if (nowMin < firstMin) {
          // the small hours — nothing's scheduled, the valley sleeps
          stops.forEach((s) => s.classList.remove("tl--now"));
          if (nowLabel) nowLabel.textContent = "the valley sleeps";
        } else {
          let cur = stops[stops.length - 1];
          for (const s of stops) if (+s.dataset.min <= nowMin) cur = s;
          stops.forEach((s) => s.classList.toggle("tl--now", s === cur));
          const h4 = cur.querySelector(".tl__h");
          if (nowLabel && h4) nowLabel.textContent = h4.textContent.toLowerCase();
        }
      }
    };
    tick();
    setInterval(tick, 30000);
  }
  initClock();

  /* ---------- Scroll-progress bar (position cue across the long page) ---------- */
  function initScrollbar() {
    const bar = document.querySelector(".scrollbar i");
    if (!bar) return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }
  initScrollbar();

  /* ---------- Experiences: a proper slider — arrows + progress bar ----------
     One click = one card. `current` indexes a list of real scroll STOPS (each
     card brought flush-left, last stop flush-RIGHT so card 6 fully shows), so the
     step never drifts. Arrows loop; drag/wheel resync onto the nearest stop. */
  function initExpSlider() {
    const track = document.querySelector(".exp__track");
    if (!track) return;
    const prev = document.querySelector("[data-exp-prev]");
    const next = document.querySelector("[data-exp-next]");
    const fill = document.querySelector(".exp__progress-fill");
    const cards = Array.prototype.slice.call(track.querySelectorAll(".exp-card"));
    if (!cards.length) return;
    track.style.scrollSnapType = "none";   // JS owns snapping (arrows + drag/wheel settle) — CSS proximity fought the glide

    const maxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const padLeft = () => { const cs = getComputedStyle(track); return parseFloat(cs.scrollPaddingLeft) || parseFloat(cs.paddingLeft) || 0; };
    const stepPx = () => cards.length > 1 ? Math.abs(cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left) : track.clientWidth;
    // The real scroll stops: each card aligned flush-left, dropping any that fall
    // past the end, then the end (maxScroll) appended so the LAST card lands
    // flush-right and fully visible (a tiny tail step is merged, not duplicated).
    const stops = () => {
      const trL = track.getBoundingClientRect().left, ms = maxScroll(), pl = padLeft(), base = track.scrollLeft, step = stepPx(), out = [];
      cards.forEach((c) => { const p = Math.max(0, base + (c.getBoundingClientRect().left - trL) - pl); if (p < ms - 4) out.push(p); });
      if (!out.length) return ms > 4 ? [0, ms] : [0];
      if (ms - out[out.length - 1] > step * 0.15) out.push(ms); else out[out.length - 1] = ms;
      return out;
    };
    const nearestIdx = () => { const s = stops(); let bi = 0, bd = Infinity; s.forEach((p, i) => { const d = Math.abs(p - track.scrollLeft); if (d < bd) { bd = d; bi = i; } }); return bi; };

    let current = 0, animating = false, raf = 0;
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const glideTo = (dest) => {
      cancelAnimationFrame(raf);
      const from = track.scrollLeft, dist = dest - from;
      if (Math.abs(dist) < 1) { animating = false; return; }
      let startT = null; animating = true;
      const frame = (now) => {
        if (startT === null) startT = now;
        const t = Math.min(1, (now - startT) / 520);
        track.scrollLeft = from + dist * easeInOut(t);
        if (t < 1) { raf = requestAnimationFrame(frame); }
        else { animating = false; paint(); }
      };
      raf = requestAnimationFrame(frame);
    };
    const paint = () => {
      const last = stops().length - 1;
      current = Math.max(0, Math.min(current, last));
      if (fill) fill.style.transform = "scaleX(" + Math.max(0.06, last > 0 ? current / last : 1).toFixed(3) + ")";
      if (prev) prev.disabled = false;   // arrows LOOP — never dead-end
      if (next) next.disabled = false;
    };
    const goTo = (idx) => {
      const s = stops(), last = s.length - 1;
      current = idx < 0 ? last : idx > last ? 0 : idx;   // wrap cleanly at either end
      if (motionOff) track.scrollLeft = s[current]; else glideTo(s[current]);
      paint();
    };
    const go = (dir) => goTo((animating ? current : nearestIdx()) + dir);

    if (prev) prev.addEventListener("click", () => go(-1));
    if (next) next.addEventListener("click", () => go(1));
    // Keyboard panning so the focusable track is operable without a pointer.
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "Home") { e.preventDefault(); goTo(0); }
      else if (e.key === "End") { e.preventDefault(); goTo(stops().length - 1); }
    });
    // after a DRAG settles, snap onto the nearest stop + resync current (the generic [data-drag] handler does the scrolling)
    const snapToNearest = () => {
      if (animating || motionOff) return;
      current = nearestIdx();
      const dest = stops()[current];
      if (Math.abs(dest - track.scrollLeft) > 2) glideTo(dest); else paint();
    };
    let dragStartScroll = null;
    track.addEventListener("pointerdown", () => { cancelAnimationFrame(raf); animating = false; dragStartScroll = track.scrollLeft; }, { passive: true });
    window.addEventListener("pointerup", () => {
      if (dragStartScroll === null) return;
      const moved = Math.abs(track.scrollLeft - dragStartScroll) > 4;
      dragStartScroll = null;
      if (moved) setTimeout(snapToNearest, 30);   // let the drag handler finish, then settle onto a card
    }, { passive: true });
    // trackpad / wheel scrolling keeps current + progress in sync, then settles
    let settle = 0;
    track.addEventListener("scroll", () => { if (animating) return; current = nearestIdx(); paint(); clearTimeout(settle); settle = setTimeout(snapToNearest, 140); }, { passive: true });
    window.addEventListener("resize", () => goTo(current));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);   // scrollWidth shifts once fonts/images settle
    paint();
  }
  initExpSlider();

  /* ---------- FAQ accordion (grid-rows height animation, CSS-driven) ---------- */
  function initFaq() {
    document.querySelectorAll(".faq__q").forEach((q) => {
      q.addEventListener("click", () => {
        const item = q.closest(".faq__item");
        const open = item.classList.toggle("is-open");
        q.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }
  initFaq();

  /* ---------- Booking widget: live nights × rate, 2-night minimum ---------- */
  function initBooking() {
    const form = document.querySelector("[data-booking]");
    const grid = document.querySelector("[data-bk-grid]");
    if (!form || !grid) return;
    const RATE = 420, FEE = 60, MIN = 2, dayMs = 86400000;
    const monthEl = form.querySelector("[data-bk-month]");
    const prevBtn = form.querySelector("[data-bk-prev]");
    const nextBtn = form.querySelector("[data-bk-next]");
    const selWrap = form.querySelector("[data-bk-selected]");
    const inLbl = form.querySelector("[data-bk-in-label]");
    const outLbl = form.querySelector("[data-bk-out-label]");
    const calc = form.querySelector("[data-bk-calc]");
    const sub = form.querySelector("[data-bk-sub]");
    const total = form.querySelector("[data-bk-total]");
    const note = form.querySelector("[data-bk-note]");
    const summary = form.querySelector("[data-bk-summary]");
    const contact = form.querySelector("[data-bk-contact]");
    const submit = form.querySelector("[data-bk-submit]");
    const confirmEl = form.querySelector("[data-bk-confirm]");
    const earliestEl = document.querySelector("[data-bk-earliest]");
    const availRow = document.querySelector(".booking__avail");
    const nameEl = form.querySelector("#bk-name");
    const emailEl = form.querySelector("#bk-email");
    const msgEl = form.querySelector("#bk-msg");

    const money = (n) => "$" + n.toLocaleString("en-US");
    // Bali "today" at local midnight (Asia/Makassar) — avoids UTC date drift.
    const bp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-");
    const today = new Date(+bp[0], +bp[1] - 1, +bp[2]);
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const key = (d) => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    const sameDay = (a, b) => a && b && key(a) === key(b);
    const fmt = (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

    // Sample availability — a couple of "already booked" stretches so the
    // exclusivity reads as real. Swap for live data when a backend exists.
    const blocked = [[addDays(today, 12), addDays(today, 16)], [addDays(today, 33), addDays(today, 37)]];
    const isBlocked = (d) => blocked.some(([s, e]) => d >= s && d <= e);
    const rangeHasBlock = (a, b) => { for (let d = new Date(a); d < b; d = addDays(d, 1)) if (isBlocked(d)) return true; return false; };
    let earliest = new Date(today);
    while (isBlocked(earliest)) earliest = addDays(earliest, 1);
    if (earliestEl) {
      earliestEl.textContent = earliest.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      if (availRow) availRow.hidden = false;
    }

    let view = new Date(today.getFullYear(), today.getMonth(), 1);
    let ci = null, co = null;

    const priceUpdate = () => {
      if (ci && co) {
        const nights = Math.round((co - ci) / dayMs);
        calc.textContent = nights + " night" + (nights > 1 ? "s" : "") + " × " + money(RATE);
        sub.textContent = money(nights * RATE);
        total.textContent = money(nights * RATE + FEE);
        selWrap.hidden = false; inLbl.textContent = fmt(ci); outLbl.textContent = fmt(co);
        summary.hidden = false; contact.hidden = false; submit.disabled = false; note.hidden = true;
      } else if (ci) {
        selWrap.hidden = false; inLbl.textContent = fmt(ci); outLbl.textContent = "—";
        summary.hidden = true; contact.hidden = true; submit.disabled = true;
        note.hidden = false; note.textContent = "Lovely — now pick your check-out (two nights with us, at least).";
      } else {
        selWrap.hidden = true; summary.hidden = true; contact.hidden = true; submit.disabled = true;
        note.hidden = false; note.textContent = "Stay two nights or more — pick your dates and we'll add it up.";
      }
    };

    const onPick = (d) => {
      let msg = null;
      if (!ci || co) { ci = d; co = null; }
      else if (d <= ci) { ci = d; co = null; }
      else if (Math.round((d - ci) / dayMs) < MIN) { msg = "We ask for " + MIN + " nights at least — try a later check-out."; }
      else if (rangeHasBlock(ci, d)) { ci = d; co = null; msg = "Ah — those nights are already taken. Let's start again from there."; }
      else { co = d; }
      render(); priceUpdate();
      if (msg) { note.hidden = false; note.textContent = msg; }
    };

    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const render = () => {
      monthEl.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
      grid.innerHTML = "";
      const first = new Date(view.getFullYear(), view.getMonth(), 1);
      const startDow = (first.getDay() + 6) % 7; // Monday-first
      const dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (let i = 0; i < startDow; i++) { const e = document.createElement("div"); e.className = "bk-day is-empty"; grid.appendChild(e); }
      for (let day = 1; day <= dim; day++) {
        const d = new Date(view.getFullYear(), view.getMonth(), day);
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "bk-day"; btn.textContent = day;
        const past = d < today, blk = isBlocked(d);
        if (past || blk) btn.disabled = true;
        if (sameDay(d, today)) btn.classList.add("is-today");
        if (sameDay(d, ci)) btn.classList.add("is-start");
        if (sameDay(d, co)) btn.classList.add("is-end");
        if (ci && co && d > ci && d < co) btn.classList.add("is-range");
        btn.setAttribute("aria-label", d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) + (blk ? " — booked" : ""));
        if (!btn.disabled) btn.addEventListener("click", () => onPick(d));
        grid.appendChild(btn);
      }
      if (prevBtn) prevBtn.disabled = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();
    };

    if (prevBtn) prevBtn.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
    if (nextBtn) nextBtn.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (submit.disabled || !ci || !co) return;
      const name = nameEl ? nameEl.value.trim() : "";
      const email = emailEl ? emailEl.value.trim() : "";
      if (!name) { note.hidden = false; note.textContent = "And your name? So we know who we're expecting."; if (nameEl) nameEl.focus(); return; }
      if (!email || !/.+@.+\..+/.test(email)) { note.hidden = false; note.textContent = "We'll need an email to write back to."; if (emailEl) emailEl.focus(); return; }
      const nights = Math.round((co - ci) / dayMs);
      // No backend wired yet — open a pre-filled enquiry email. Swap this block
      // for a fetch() to a Formspree/serverless endpoint when one exists.
      const subject = "Villa Senja enquiry — " + fmt(ci) + " to " + fmt(co);
      const body = "Hello Villa Senja,\n\nI'd like to enquire about these dates:\n" +
        "• Check in: " + fmt(ci) + "\n• Check out: " + fmt(co) + "\n• Nights: " + nights +
        "\n• Guests: up to 2\n• Estimated total: " + money(nights * RATE + FEE) + " (incl. $60 service)\n\n" +
        (msgEl && msgEl.value.trim() ? "Note: " + msgEl.value.trim() + "\n\n" : "") +
        "Name: " + name + "\nEmail: " + email + "\n";
      window.location.href = "mailto:stay@villasenja.id?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      submit.querySelector(".btn__txt").textContent = "On its way to us";
      submit.disabled = true;
      if (confirmEl) confirmEl.hidden = false;
    });

    render(); priceUpdate();
  }
  initBooking();

  /* ---------- Hero video: a real pause/play control (WCAG 2.2.2) ---------- */
  function initHeroVideo() {
    const v = document.querySelector(".hero__photo");
    const btn = document.querySelector("[data-hero-motion]");
    if (!v || !btn) return;
    const icon = btn.querySelector("i");
    const setState = (playing) => {
      btn.setAttribute("aria-pressed", playing ? "true" : "false");
      btn.setAttribute("aria-label", playing ? "Pause background video" : "Play background video");
      if (icon) icon.className = playing ? "ph-bold ph-pause" : "ph-bold ph-play";
    };
    v.addEventListener("play", () => setState(true));
    v.addEventListener("pause", () => setState(false));
    btn.addEventListener("click", () => { v.paused ? v.play() : v.pause(); });
    setState(!v.paused);
  }
  initHeroVideo();

  /* ---------- Mobile navigation: hamburger → full-screen menu (runs in every mode) ---------- */
  function initNav() {
    const toggle = document.querySelector("[data-nav-toggle]");
    const menu = document.querySelector("[data-mobile-menu]");
    if (!toggle || !menu) return;
    const icon = toggle.querySelector("i");
    const focusables = () => Array.from(menu.querySelectorAll('a[href], button:not([disabled])'));
    let open = false;
    const setOpen = (v) => {
      open = v;
      menu.classList.toggle("is-open", v);
      menu.setAttribute("aria-hidden", v ? "false" : "true");
      toggle.setAttribute("aria-expanded", v ? "true" : "false");
      toggle.setAttribute("aria-label", v ? "Close menu" : "Open menu");
      if (icon) icon.className = v ? "ph-bold ph-x" : "ph-bold ph-list";
      document.documentElement.classList.toggle("nav-open", v);
      const lenis = window.__lenis;
      if (lenis) { v ? lenis.stop() : lenis.start(); }
      if (v) { requestAnimationFrame(() => { const f = focusables()[0]; if (f) f.focus(); }); } else { toggle.focus(); }
    };
    toggle.addEventListener("click", () => setOpen(!open));
    menu.querySelectorAll("[data-nav-link]").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (!open) return;
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "Tab") {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
  initNav();

  /* ---------- Sticky mobile booking bar: appears past the hero, hides over #book ---------- */
  function initBookBar() {
    const bar = document.querySelector("[data-book-bar]");
    if (!bar) return;
    const hero = document.querySelector(".hero");
    const book = document.querySelector("#book");
    let pastHero = false, atBook = false;
    const sync = () => {
      const show = pastHero && !atBook;
      bar.classList.toggle("is-visible", show);
      bar.setAttribute("aria-hidden", show ? "false" : "true");
    };
    if (hero && "IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; sync(); }, { rootMargin: "-20% 0px 0px 0px" }).observe(hero);
    } else { pastHero = true; }
    if (book && "IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { atBook = e.isIntersecting; sync(); }).observe(book);
    }
    sync();
  }
  initBookBar();

  /* ---------- STATIC MODE: show everything, no rAF ---------- */
  if (!hasGSAP || motionOff) {
    document.querySelectorAll("[data-split],[data-fade],.reveal").forEach((el) => {
      el.style.opacity = 1;
      el.style.transform = "none";
    });
    // Reduced-motion / automation: hold the hero on its poster frame.
    const heroVid = document.querySelector(".hero__photo");
    if (heroVid) { try { heroVid.pause(); } catch (e) {} }
    initHeader(null);
    hideLoader();
    return;
  }

  /* ---------- Smooth scroll (Lenis) wired into the GSAP ticker ----------
     Desktop only. On touch / coarse-pointer / narrow screens we leave the
     browser's NATIVE scroll (momentum + overscroll) alone — Lenis's rAF/scroll
     interception flattens that and feels rubbery on phones. ScrollTrigger works
     natively without Lenis, so nothing visual is lost on mobile. */
  const wantsSmooth =
    window.matchMedia("(min-width: 1025px)").matches &&
    window.matchMedia("(hover: hover)").matches &&
    window.matchMedia("(pointer: fine)").matches;
  const lenis = (hasLenis && wantsSmooth)
    ? new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // exact HT curve
        smoothWheel: true,
      })
    : null;

  if (lenis) {
    window.__lenis = lenis; // debug handle for driving scroll
    lenis.on("scroll", () => ScrollTrigger.update());
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  gsap.registerPlugin(ScrollTrigger);

  // Mobile (no Lenis): keep ScrollTrigger steady against URL-bar resize jitter.
  if (!lenis) ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- Draw-on-scroll: carve the inline-SVG motifs as they enter ----------
     Each .draw <svg> has its paths dash-primed (offset = length) then drawn to 0
     via ScrollTrigger. FAIL-SAFE: reduced-motion no-ops here and CSS leaves paths
     fully drawn; any throw forces the motif fully drawn. Never blank. */
  function initDraw() {
    if (reduce) return;
    const svgs = gsap.utils.toArray(".draw");
    if (!svgs.length) return;
    const cfg = (svg) => {
      // every motif scrubs to scroll — draws on scroll-down, reverses on scroll-up
      if (svg.classList.contains("draw--jamb")) return { start: "top 90%", end: "bottom 40%", stagger: 0 };
      if (svg.classList.contains("draw--faq")) return { start: "top 90%", end: "bottom 45%", stagger: 0 };
      if (svg.classList.contains("draw--corner")) return { start: "top 85%", end: "top 45%", stagger: 0.3 };
      if (svg.classList.contains("draw--gate")) return { start: "top 88%", end: "top 42%", stagger: 0.25 };
      return { start: "top 88%", end: "top 45%", stagger: 0.2 };
    };
    svgs.forEach((svg) => {
      try {
        const paths = svg.querySelectorAll("path");
        if (!paths.length) return;
        const o = cfg(svg);
        paths.forEach((p) => {
          const len = p.getTotalLength();
          if (!len || !isFinite(len)) { p.style.strokeDashoffset = 0; return; }
          gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        });
        const fills = svg.querySelectorAll(".draw__fill");
        if (fills.length) gsap.set(fills, { fillOpacity: 0 });
        const st = { trigger: svg, start: o.start, end: o.end, scrub: 1 };
        gsap.to(paths, { strokeDashoffset: 0, ease: "none", stagger: o.stagger || 0, scrollTrigger: st });
        if (fills.length) gsap.to(fills, { fillOpacity: 0.12, ease: "none", scrollTrigger: st });
      } catch (e) {
        svg.querySelectorAll("path").forEach((p) => { p.style.strokeDasharray = "none"; p.style.strokeDashoffset = 0; });
        svg.querySelectorAll(".draw__fill").forEach((p) => (p.style.fillOpacity = 0.12));
      }
    });
  }

  /* ---------- Draw-wipe: directional clip reveal for motifs that can't
     stroke-draw — tiled rules draw left→right; banana leaves reveal bottom-up
     (via a --leaf-clip var on the host since they're pseudo-elements). ---------- */
  function initWipe() {
    if (reduce) return;
    gsap.utils.toArray(".draw-wipe").forEach((el) => {
      // footer rule rests at the page bottom (can't scrub-complete) → one-shot; the rest scrub + reverse
      if (el.closest(".footer")) {
        gsap.fromTo(el, { "--wipe": "100%" }, { "--wipe": "0%", duration: 1.1, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top bottom", once: true } });
      } else {
        gsap.fromTo(el, { "--wipe": "100%" }, { "--wipe": "0%", ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "top center", scrub: 1 } });
      }
    });
    // Banana leaves bloom open from their stem, scrubbed to the LEAF's own
    // on-screen position (it's a pseudo at the section bottom, so compute its
    // centre from the section box + pseudo height). Reverses on scroll up.
    gsap.utils.toArray(".lead, .dining, .booking").forEach((host) => {
      const leafMid = () => {
        const r = host.getBoundingClientRect();
        const lh = Math.min(parseFloat(getComputedStyle(host, "::before").height) || r.height, r.height);
        return r.bottom + window.scrollY - lh / 2; // leaf centre in page coords
      };
      gsap.fromTo(host, { "--leaf-p": 0 }, { "--leaf-p": 1, ease: "none",
        scrollTrigger: {
          trigger: host, scrub: 1, invalidateOnRefresh: true,
          start: () => leafMid() - window.innerHeight,       // leaf centre at viewport bottom
          end: () => leafMid() - window.innerHeight * 0.5,   // leaf centre at viewport middle
        } });
    });
  }

  /* Weighty, expressive easing + a helper that wraps each RENDERED line in an
     overflow-hidden mask, so lines rise up from behind the edge. This masked
     line-reveal is the thing that separates designed motion from amateur fades. */
  /* ---------- Headlines: Hungry Tiger's exact scrub-each-word reveal ----------
     each word rides 0.2 → 1 opacity, staggered 0.4, scrubbed to scroll. */
  if (hasSplit) {
    document.querySelectorAll("[data-split]").forEach((el) => {
      const split = new SplitType(el, { types: "words", tagName: "span" });
      gsap.set(el, { opacity: 1 });
      gsap.from(split.words, {
        opacity: 0.2, duration: 0.2, ease: "power1.out",
        stagger: { each: 0.4 },
        scrollTrigger: { trigger: el, start: "top 90%", end: "top center", scrub: true },
      });
    });
  } else {
    document.querySelectorAll("[data-split]").forEach((el) => (el.style.opacity = 1));
  }

  const EASE = "power2.out";

  /* ---------- Supporting copy: a quiet rise ---------- */
  gsap.utils.toArray("[data-fade]").forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 1.0, ease: EASE,
        scrollTrigger: { trigger: el, start: "top 88%" } });
  });

  /* ---------- Cards / blocks ---------- */
  gsap.utils.toArray(".reveal:not(.sides__media):not(.exp-card)").forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1.1, ease: EASE,
        scrollTrigger: { trigger: el, start: "top 86%" } });
  });

  /* ---------- Images: a clip wipe in, then a slow crop drift ---------- */
  gsap.utils.toArray(".sides__media").forEach((el) => {
    const img = el.querySelector("img");
    gsap.fromTo(el,
      { clipPath: "inset(0% 50% 0% 50% round 0.8vw)", opacity: 0 },          // §3 086: center-out aperture
      { clipPath: "inset(0% 0% 0% 0% round 0.8vw)", opacity: 1, duration: 1.4, ease: "power3.inOut",
        scrollTrigger: { trigger: el, start: "top 82%" } });
    if (img) {
      gsap.fromTo(img, { objectPosition: "50% 30%" },
        { objectPosition: "50% 70%", ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
    }
  });

  /* ---------- Hero V10 (HT formula): video centerpiece whose clip-mask opens to full-bleed on scroll ---------- */
  const heroVid = document.querySelector("[data-vid]");
  const heroSpacer = document.querySelector("[data-hv10-spacer]");
  const HERO_FULLBLEED = true;   // the push-in fills the viewport (footage is the star); flip to false to restore the framed centerpiece
  if (HERO_FULLBLEED) { const _h = document.querySelector(".hero"); if (_h) _h.classList.add("is-fullbleed"); }
  // A/B the hero footage live: ?hero=gate vs ?hero=valley (default below). Pick the winner, set the default, then drop the ?hero param before launch.
  const HERO_CLIP = (function () { try { return new URLSearchParams(location.search).get("hero"); } catch (e) { return null; } })() || "valley";
  const HERO_CLIPS = {
    gate: { src: "videos/hero-gate.mp4?v=2", poster: "images/hero-poster.jpg?v=3" },
    valley: { src: "videos/hero-valley.mp4?v=1", poster: "images/hero-poster-valley.jpg?v=1" },
  };
  if (heroVid && HERO_CLIPS[HERO_CLIP]) {
    const _c = HERO_CLIPS[HERO_CLIP], _s = heroVid.querySelector("source");
    if (_s) _s.src = _c.src;
    heroVid.setAttribute("poster", _c.poster);
    try { heroVid.load(); } catch (e) {}
  }
  // The video's rest window = the framed-centerpiece SPACER's box, so it aligns with the layout
  // (headline + subtitle ABOVE it, CTA BELOW it). Measured only at SETTLED moments (post-loader,
  // fonts-ready, resize) and cached in restInset — never on every ScrollTrigger refresh, which is
  // what made it jump size mid-load.
  function measureRest() {
    if (HERO_FULLBLEED) return "inset(0% 0% 0% 0% round 0px)";   // full-bleed: no framing window (the SCRUB still runs; the open-animation just becomes a no-op)
    const hero = document.querySelector(".hero");
    if (!heroSpacer || !hero) return "inset(44% 24% 22% 24% round 10px)";
    const r = heroSpacer.getBoundingClientRect(), h = hero.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    if (r.width < 4 || r.height < 4) return "inset(44% 24% 22% 24% round 10px)";
    // Measure the spacer RELATIVE TO THE HERO, not the raw viewport — the spacer's offset within the
    // hero is constant, so this gives the correct rest window even if a remeasure fires mid-scroll
    // (raw viewport coords measured while scrolled are what made the window jump to the top).
    const t = Math.max(0, ((r.top - h.top) / vh) * 100), b = Math.max(0, ((vh - (r.bottom - h.top)) / vh) * 100);
    const l = Math.max(0, ((r.left - h.left) / vw) * 100), ri = Math.max(0, ((vw - (r.right - h.left)) / vw) * 100);
    return `inset(${t.toFixed(2)}% ${ri.toFixed(2)}% ${b.toFixed(2)}% ${l.toFixed(2)}% round 10px)`;
  }
  let restInset = measureRest();
  function playHeroIntro() {
    if (heroVid) { restInset = measureRest(); gsap.set(heroVid, { clipPath: restInset }); }   // re-measure once the loader clears (layout settled) so the window hugs the spacer
    if (motionOff || !hasGSAP) return;   // static/automation: content already visible, video at its rest window
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .from(".hv10__eye", { opacity: 0, y: 14, duration: 0.7 }, 0.2)
      .from(".hv10__head", { opacity: 0, y: 26, duration: 0.95 }, 0.32)
      .from([".hv10__sub", ".hv10__rule"], { opacity: 0, y: 16, duration: 0.8, stagger: 0.1 }, 0.62)
      .from(heroVid, { opacity: 0, duration: 1.0, ease: "power2.out" }, 0.5)
      .from([".hv10__cta", ".hv10__trust", ".hv10__cue"], { opacity: 0, y: 14, duration: 0.8, stagger: 0.1 }, 0.95);
  }

  /* the video mask OPENS from the framed window to full-bleed as you scroll the hero (video stays crisp) */
  (function initHeroMask() {
    if (!hasGSAP || motionOff || !heroVid) return;
    gsap.set(heroVid, { clipPath: restInset });
    let heroSeeking = false;   // only issue a new seek once the last finished → no decoder thrash ("shifty" jitter)
    heroVid.addEventListener("seeking", () => { heroSeeking = true; });
    heroVid.addEventListener("seeked", () => { heroSeeking = false; });
    gsap.timeline({ scrollTrigger: { trigger: ".hero-rail", start: "top top", end: "bottom top", scrub: 1, invalidateOnRefresh: true,
        onUpdate: (self) => { window.__heroProg = self.progress; const d = heroVid.duration; if (d && !heroSeeking) { const t = self.progress * d; if (Math.abs(t - heroVid.currentTime) > 0.05) { try { heroVid.currentTime = t; } catch (e) {} } } } } })   // SCRUB the footage to scroll position over the rail; the hero is CSS-fixed and the .site-curtain slides up over it when the rail ends — NO morph
      .to(["[data-hv10-content] > :not([data-hv10-spacer])", "[data-hv10-cue]"], { opacity: 0, y: -44, ease: "power2.in", duration: 0.3, stagger: 0.02 }, 0)   // headline/CTA clear early
      .to(".hero", { "--scrim-o": 0, ease: "power1.in", duration: 0.4 }, 0)   // fade the legibility scrim out → clean footage as it reveals
      .to({}, { duration: 0.001 }, 1.0);   // pad the timeline to the full rail so the fades finish early and the rest is a pure footage reveal before the curtain lifts
    // re-measure the window ONLY at settled moments, then refresh so the scrub picks it up
    const remeasure = () => { restInset = measureRest(); ScrollTrigger.refresh(); };   // no gsap.set → a resize mid-scroll can't snap the open mask back to the small rest window
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(remeasure, 220); }, { passive: true });
  })();

  /* hero footage is SCRUBBED to scroll position in initHeroMask above (symmetric → reverses on scroll-up); video stays paused */

  /* WebGL LIQUID HERO (morph rebuild) — render the scrubbing video as a texture through a flow shader; warp
     strength driven by hero scroll progress (window.__heroProg). GPU displacement = the SMOOTH liquid SVG couldn't do. */
  (function initHeroGL() {
    const HERO_GL = true;   // MIST-DISSOLVE reveal (IGLOO-style, warm senja recolor): the dusk video materializes out of mist as you scroll, with a chromatic-shimmer front
    const canvas = document.querySelector("[data-gl]");
    const hero = document.querySelector(".hero");
    if (!HERO_GL || !canvas || !heroVid || !hero || motionOff || !hasGSAP) return;
    let gl;
    try { gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true, antialias: true, depth: false }); } catch (e) {}
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : (console.warn("[GL]", gl.getShaderInfoLog(s)), null); };
    const vs = sh(gl.VERTEX_SHADER, "attribute vec2 a; varying vec2 v; void main(){ v=a*0.5+0.5; gl_Position=vec4(a,0.,1.); }");
    const fs = sh(gl.FRAGMENT_SHADER,
      "precision highp float; uniform sampler2D uT; uniform vec2 uR; uniform vec2 uV; uniform float uP; uniform float uLead; uniform float uTime; varying vec2 v;" +
      "float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }" +
      "float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }" +
      "float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.02; a*=.5; } return s; }" +
      "void main(){ float sA=uR.x/uR.y, vA=uV.x/uV.y; vec2 c=v; if(sA>vA){ c.y=(v.y-.5)*(vA/sA)+.5; } else { c.x=(v.x-.5)*(sA/vA)+.5; }" +
      // organic dissolve field — senja mist sinks to the valley floor (top clears first); the threshold descends as you scroll (uP)
      "float diss=fbm(c*2.6 + vec2(uTime*0.03, uTime*-0.02))*0.72 + clamp(c.y,0.,1.)*0.5;" +
      "float thr=uP*0.95 - 0.05;" +   // REVERSED: clear valley at rest (uP0) → dissolves INTO senja mist as you scroll (uP1), then the curtain covers
      "float reveal=smoothstep(thr-0.17, thr+0.17, diss);" +
      // the live dissolve FRONT — where the shimmer/glitch/glow concentrate (peaks where reveal crosses 0.5)
      "float edge=pow(max(1.0 - abs(reveal-0.5)*2.0, 0.0), 1.5);" +
      // voxel/block displacement on the front
      "float bl=30.0; vec2 bc=floor(c*bl)/bl; vec2 disp=(vec2(hash(bc+floor(uTime*6.0)*0.017), hash(bc+7.3))-0.5)*0.05*edge;" +
      "vec2 uv=c+disp;" +
      // warm radial chromatic aberration, peaking on the front
      "vec2 dir=v-0.5; float ca=edge*0.011+0.0015;" +
      "vec3 col; col.r=texture2D(uT, vec2(uv.x+dir.x*ca, 1.0-(uv.y+dir.y*ca))).r;" +
      "col.g=texture2D(uT, vec2(uv.x, 1.0-uv.y)).g;" +
      "col.b=texture2D(uT, vec2(uv.x-dir.x*ca, 1.0-(uv.y-dir.y*ca))).b;" +
      // warm senja mist (pale gold high → warmer low) + a marigold glow on the dissolve front
      "vec3 mist=vec3(0.9255, 0.8627, 0.7137);" +   // = var(--sand) rgb(236,220,182): the mist resolves to the EXACT page/.lead bg so the curtain's edge melts in seamlessly (no cream-on-cream seam)
      "vec3 outc=mix(mist, col, reveal) + edge*0.12*vec3(1.0,0.82,0.5);" +
      // flood pure sand UP to the rising curtain's top edge (uLead, in screen v.y) so the boundary always lands on flat mist — kills the textured hero/lead edge
      "float sandFade=clamp(smoothstep(uLead+0.14, uLead, v.y), 0.0, 1.0);" +
      "outc=mix(outc, mist, sandFade);" +
      "gl_FragColor=vec4(outc, 1.0); }");
    if (!vs || !fs) return;
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn("[GL] link", gl.getProgramInfoLog(p)); return; }
    gl.useProgram(p);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aL = gl.getAttribLocation(p, "a"); gl.enableVertexAttribArray(aL); gl.vertexAttribPointer(aL, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const uT = gl.getUniformLocation(p, "uT"), uR = gl.getUniformLocation(p, "uR"), uV = gl.getUniformLocation(p, "uV"), uP = gl.getUniformLocation(p, "uP"), uLead = gl.getUniformLocation(p, "uLead"), uTime = gl.getUniformLocation(p, "uTime");
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr); gl.viewport(0, 0, canvas.width, canvas.height); };
    resize(); window.addEventListener("resize", resize, { passive: true });
    hero.classList.add("is-gl");
    const paintRest = () => { try { heroVid.currentTime = 0.04; } catch (e) {} };   // a tiny SEEK paints the rest frame (a paused/never-seeked video = black GL texture); 0.04 < the scrub's 0.05 guard so it isn't reset
    if (heroVid.readyState >= 2) paintRest(); else heroVid.addEventListener("loadeddata", paintRest, { once: true });
    const curtainEl = document.querySelector(".site-curtain");   // its live top edge tells the shader where to stop the valley and show flat sand
    let fed = false, t0 = 0;
    const draw = (ts) => {
      if (!t0) t0 = ts;
      if (heroVid.readyState >= 2) { try { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, heroVid); fed = true; } catch (e) {} }
      if (fed) {
        gl.uniform1i(uT, 0); gl.uniform2f(uR, canvas.width, canvas.height); gl.uniform2f(uV, heroVid.videoWidth || 16, heroVid.videoHeight || 9);
        gl.uniform1f(uP, window.__heroProg || 0); gl.uniform1f(uTime, (ts - t0) / 1000);
        let lv = -2.0; if (curtainEl) { const rr = curtainEl.getBoundingClientRect(); lv = 1.0 - rr.top / window.innerHeight; } gl.uniform1f(uLead, lv);   // curtain top edge → v.y (rest: off-screen below → no sand flood)
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  })();

  /* reveal-band — the flock drifts across + scales as the section scrolls through (parallax depth tiers) */
  (function initRevealBirds() {
    const band = document.querySelector(".reveal-band");
    if (!band || !hasGSAP || motionOff) return;
    const birds = gsap.utils.toArray("[data-bird]");
    if (!birds.length) return;
    birds.forEach((b, i) => {
      const dir = i % 2 ? 1 : -1, depth = 0.55 + (i % 3) * 0.25;   // alternating direction + 3 depth tiers
      gsap.fromTo(b,
        { xPercent: -110 * dir * depth, yPercent: 28, scale: 0.4 + depth * 0.15 },
        { xPercent: 190 * dir * depth, yPercent: -40, scale: 0.8 + depth * depth * 6.2, ease: "none",   // birds fly RIGHT PAST — front ones blow up to ~7x as the section scrolls (quadratic depth)
          scrollTrigger: { trigger: band, start: "top bottom", end: "bottom top", scrub: 1 } });
    });
  })();

  /* reveal-band video — plays only while the band is on-screen (muted ambient boomerang); under reduced-motion the poster stays */
  (function initRevealVid() {
    const v = document.querySelector("[data-rbvid]");
    const band = document.querySelector(".reveal-band");
    if (!v || !band) return;
    if (motionOff) return;                       // reduced-motion / automation: keep the poster as a plain fill
    v.muted = true;                              // belt-and-suspenders for muted-autoplay policy
    const tryPlay = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((ents) => ents.forEach((e) => { e.isIntersecting ? tryPlay() : v.pause(); }), { rootMargin: "200px 0px" }).observe(v);
    } else { tryPlay(); }
    // upgrade to a viewport-FIXED background, revealed only through the band's on-screen rect → true
    // background-attachment:fixed behaviour (the clip stays locked to the viewport while the band scrolls past, no drift)
    band.classList.add("is-fixedvid");
    const clip = () => {
      const r = band.getBoundingClientRect(), vh = window.innerHeight || document.documentElement.clientHeight;
      v.style.clipPath = "inset(" + Math.max(0, r.top) + "px 0px " + Math.max(0, vh - r.bottom) + "px 0px)";
    };
    clip();
    if (window.__lenis) window.__lenis.on("scroll", clip); else window.addEventListener("scroll", clip, { passive: true });
    window.addEventListener("resize", clip);
    if (hasGSAP && typeof ScrollTrigger !== "undefined") ScrollTrigger.addEventListener("refresh", clip);
  })();

  /* frangipani — varied petals drift down in occasional flurries (different sizes, spins, sometimes 2 at once) */
  (function initFrangipani() {
    const tpl = document.querySelector("[data-petal]");
    if (!tpl || !hasGSAP || motionOff) return;
    const MAX = 5;
    const drop = () => {
      if (document.querySelectorAll(".frangipani:not([data-petal])").length >= MAX) return;
      const p = tpl.cloneNode(true);
      p.removeAttribute("data-petal");
      const flip = Math.random() < 0.5 ? -1 : 1;
      p.style.left = (Math.random() * 100) + "vw";
      p.style.width = (20 + Math.random() * 30) + "px";              // varied size
      document.body.appendChild(p);
      const dur = 10 + Math.random() * 11, swayX = (Math.random() * 2 - 1) * (70 + Math.random() * 130);
      gsap.set(p, { opacity: 0, rotation: Math.random() * 360, scaleX: flip });
      gsap.to(p, { y: window.innerHeight + 100, x: swayX, rotation: "+=" + flip * (160 + Math.random() * 430), duration: dur, ease: "none", onComplete: () => p.remove() });
      gsap.to(p, { opacity: 0.4 + Math.random() * 0.38, duration: 1.5 + Math.random() });   // fade in (varied)
      gsap.to(p, { opacity: 0, duration: 2.6, delay: dur - 2.6 });                          // fade out before it lands
    };
    const tick = () => {
      const n = 1 + (Math.random() < 0.35 ? 1 : 0);                  // usually 1, sometimes 2 at once
      for (let i = 0; i < n; i++) gsap.delayedCall(i * (0.3 + Math.random() * 0.8), drop);
      gsap.delayedCall(5 + Math.random() * 8, tick);                 // next batch in ~5–13s
    };
    gsap.delayedCall(3 + Math.random() * 4, tick);
  })();

  /* ---------- Loader: redrawn candi-bentar — two columnar gate-towers draw in, then PART to reveal the hero ---------- */
  function initLoader(done) {
    if (!loaderEl || motionOff || !hasGSAP) { hideLoader(); done(); return; }   // static/automation: skip straight to the hero
    const paths = loaderEl.querySelectorAll(".vldr__gate .tower, .vldr__gate .base");
    paths.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    gsap.set("[data-vldr-mark]", { yPercent: 120 });
    gsap.set("[data-vldr-glow]", { opacity: 0, scale: 0.7 });
    const hint = loaderEl.querySelector("[data-vldr-hint]"); if (hint) hint.style.display = "none";   // no "tap to enter" — the gate auto-reveals

    // a real loading bar that fills with the HERO VIDEO's buffered progress
    const bar = document.createElement("div"); bar.className = "vldr__bar";
    const barFill = document.createElement("i"); bar.appendChild(barFill); loaderEl.appendChild(bar);
    const setProg = (f) => { barFill.style.transform = "scaleX(" + Math.max(0.015, Math.min(1, f || 0)).toFixed(3) + ")"; };
    setProg(0);

    // HOLD the reveal until the full-res hero video has buffered, so it's sharp + scrub-ready the instant
    // the gate opens (no low-quality pop-in, no mid-scrub stalls). Fonts too. Capped at 10s so a slow line
    // can't hang the loader — the poster covers if the video is still finishing.
    // FETCH the whole video up-front (real byte progress), then hand the element a fully-loaded blob —
    // guarantees it's sharp + instantly scrub-able the instant the gate opens. A paused <video> won't
    // reliably buffer to the end on its own, and canplaythrough fires far too early for seeking.
    const vid = document.querySelector("[data-vid]");
    const srcEl = vid && vid.querySelector("source");
    const videoUrl = srcEl ? srcEl.src : (vid ? (vid.currentSrc || vid.src) : null);
    const videoReady = new Promise((resolve) => {
      if (!vid || !videoUrl || !window.fetch || !window.ReadableStream) return resolve();
      let vdone = false; const fin = () => { if (vdone) return; vdone = true; setProg(1); resolve(); };
      fetch(videoUrl).then((resp) => {
        if (!resp.ok || !resp.body) throw 0;
        const total = +(resp.headers.get("content-length") || 0), reader = resp.body.getReader(), chunks = [];
        let loaded = 0;
        const pump = () => reader.read().then(({ done, value }) => {
          if (done) return new Blob(chunks, { type: "video/mp4" });
          chunks.push(value); loaded += value.length; if (total) setProg(loaded / total);
          return pump();
        });
        return pump();
      }).then((blob) => { try { vid.src = URL.createObjectURL(blob); vid.load(); } catch (e) {} fin(); })
        .catch(() => fin());   // any failure → don't hang; the <source> still loads normally
    });
    const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    const ready = Promise.race([
      Promise.all([fontsReady, videoReady]),
      new Promise((res) => setTimeout(res, 10000)),
    ]);

    let parted = false;
    function part() {
      if (parted) return; parted = true;
      // the wordmark SETTLES up into the nav wordmark (shared-element hand-off); the real
      // nav wordmark sits at the same spot beneath the loader, so the fade is a match-cut.
      const navMark = document.querySelector(".wordmark__txt") || document.querySelector(".wordmark");
      const mark = loaderEl.querySelector("[data-vldr-mark]");
      let dx = 0, dy = -window.innerHeight * 0.34, sc = 0.26;
      if (navMark && mark) {
        gsap.set(".vldr__mark", { overflow: "visible" });   // free the wordmark from its reveal clip so it can travel
        const a = mark.getBoundingClientRect(), b = navMark.getBoundingClientRect();
        dx = (b.left + b.width / 2) - (a.left + a.width / 2);
        dy = (b.top + b.height / 2) - (a.top + a.height / 2);
        sc = Math.max(0.16, b.height / a.height);
      }
      gsap.timeline({ onComplete: () => { loaderEl.style.display = "none"; } })
        .to("[data-vldr-eye]", { opacity: 0, y: -16, duration: 0.4, ease: "power2.in" }, 0)
        .to("[data-vldr-glow]", { opacity: 0, duration: 0.5, ease: "power2.in" }, 0)
        .to(mark, { x: dx, y: dy, scale: sc, duration: 0.7, ease: "power3.inOut" }, 0)                  // wordmark flies to the nav
        .to(mark, { opacity: 0, duration: 0.32, ease: "power2.in" }, 0.46)
        .to("[data-vldr-l]", { xPercent: -100, duration: 0.6, ease: "power3.inOut" }, 0.12)             // the gates PART = the mask uncovering the hero
        .to("[data-vldr-r]", { xPercent: 100, duration: 0.6, ease: "power3.inOut" }, 0.12)
        .add(done, 0.34);                                                                               // hero rises through the opening
    }

    // gate DRAWS IN (~0.7s), settles, then AUTO-parts once the content is ready — no gesture required
    gsap.timeline()
      .to(paths, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut", stagger: 0.03 }, 0.1)      // gate carves in
      .to("[data-vldr-eye]", { opacity: 1, duration: 0.4, ease: "power2.out" }, 0.5)
      .to("[data-vldr-mark]", { yPercent: 0, duration: 0.6, ease: "power4.out" }, 0.55)                 // wordmark rises
      .to("[data-vldr-glow]", { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, 0.85)        // dawn light at the threshold
      .call(() => { ready.then(() => gsap.delayedCall(0.2, part)); }, null, 1.05);
  }
  initLoader(playHeroIntro);

  /* ---- ambient + interactive SOUND DESIGN -----------------------------------
     One opt-in toggle drives a small Web Audio graph whose master gain IS the
     mute. The Bali bed is routed through a lowpass that warms as you descend
     toward dusk; synthesized hover / click / whoosh sfx + gamelan-pentatonic
     note cues per section give a soft sense of place while scrolling. Degrades
     to the plain <audio> bed (no sfx) where Web Audio is unavailable. */
  (function initSound() {
    const btn = document.querySelector("[data-snd]");
    const audioEl = document.querySelector("[data-snd-audio]");
    if (!btn || !audioEl) return;
    const KEY = "senja-sound";
    const AC = window.AudioContext || window.webkitAudioContext;
    const AMB_BASE = 0.10, AMB_SWELL = 0.04;   // quiet background bed, well under the sfx
    const directAmb = location.protocol === "file:";   // file:// CORS-mutes Web-Audio-routed media → play the bed straight from the <audio> element instead (SFX still use Web Audio)
    const save = (v) => { try { localStorage.setItem(KEY, v); } catch (e) {} };
    const dbg = (window.__snd = { hover: 0, click: 0, whoosh: 0, cue: 0, grab: 0, release: 0, on: false, ctx: "none" });

    let ctx = null, master = null, ambGain = null, ambFilter = null, dryBus = null, wetBus = null, noiseBuf = null, analyser = null, built = false, on = false;
    let cuesMuted = false, cueMuteTimer = null;   // suppress section whoosh/chime during programmatic scrolls (anchor links) so jumping past sections doesn't cascade
    dbg.muteCues = (ms) => { cuesMuted = true; if (cueMuteTimer) clearTimeout(cueMuteTimer); cueMuteTimer = setTimeout(() => { cuesMuted = false; }, ms || 1600); };
    dbg.read = () => ctx ? { amb: +(directAmb ? audioEl.volume : ambGain.gain.value).toFixed(3), master: +master.gain.value.toFixed(3), filtHz: Math.round(ambFilter.frequency.value), playing: !audioEl.paused, ct: +audioEl.currentTime.toFixed(1), mode: directAmb ? "file-direct" : "graph" } : "no-ctx";
    dbg.rms = () => { if (!analyser) return null; const a = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(a); let s = 0; for (let i = 0; i < a.length; i++) { const v = (a[i] - 128) / 128; s += v * v; } return +Math.sqrt(s / a.length).toFixed(4); };   // real output level — proves whether the bed is actually producing sound

    function makeImpulse(seconds, decay) {      // algorithmic reverb tail → a soft room behind the sfx
      const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
      return buf;
    }
    function buildGraph() {
      if (built) return true;
      if (!AC) return false;
      try {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
        analyser = ctx.createAnalyser(); analyser.fftSize = 512; master.connect(analyser);   // tap for the output meter (dbg.rms)
        ambGain = ctx.createGain(); ambGain.gain.value = AMB_BASE;
        ambFilter = ctx.createBiquadFilter(); ambFilter.type = "lowpass"; ambFilter.frequency.value = 10500; ambFilter.Q.value = 0.5;
        // sfx buses: a shared lowpass softens the synthesis; clicks/cues/whoosh also feed a short reverb for space; hovers stay dry + crisp
        const sfxLP = ctx.createBiquadFilter(); sfxLP.type = "lowpass"; sfxLP.frequency.value = 5200; sfxLP.Q.value = 0.3; sfxLP.connect(master);
        dryBus = ctx.createGain(); dryBus.gain.value = 1; dryBus.connect(sfxLP);
        wetBus = ctx.createGain(); wetBus.gain.value = 1; wetBus.connect(sfxLP);
        const conv = ctx.createConvolver(); conv.buffer = makeImpulse(2.0, 2.4);   // a touch lusher so gamelan/gong bloom
        const revGain = ctx.createGain(); revGain.gain.value = 0.4; wetBus.connect(conv); conv.connect(revGain); revGain.connect(master);
        const n = Math.floor(ctx.sampleRate * 1.0);
        noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
        const ch = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
        if (!directAmb) {   // skip on file:// — routing the element through Web Audio there outputs zeroes (CORS); we play it directly instead
          const src = ctx.createMediaElementSource(audioEl);   // once-only per element — create last
          src.connect(ambFilter); ambFilter.connect(ambGain); ambGain.connect(master);
        }
        built = true; dbg.ctx = ctx.state; return true;
      } catch (e) { ctx = null; built = false; return false; }
    }
    function prewarm() {                          // play a silent blip so the FIRST real sfx isn't late
      if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 128, ctx.sampleRate); s.connect(master); s.start();
    }

    // ---- synthesized one-shots → sfx buses ----
    function noiseTick(peak, cutoff, dur, type, dest) {   // soft physical "tick" — non-tonal (kept as a low-level texture helper)
      if (!ctx || !noiseBuf) return;
      const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; f.type = type || "lowpass"; f.frequency.value = cutoff; f.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(dest || wetBus); s.start(t); s.stop(t + dur + 0.03);
    }
    const rnd = (a, b) => a + Math.random() * (b - a);   // per-trigger jitter → no two plays identical (kills the "machine-gun")
    // dip the ambient bed briefly UNDER a prominent sfx so cues stay legible (graph mode only)
    function duckBed() {
      if (directAmb || !ambGain || !ctx) return;
      const t = ctx.currentTime;
      ambGain.gain.cancelScheduledValues(t);
      ambGain.gain.setValueAtTime(Math.max(0.0001, ambGain.gain.value), t);
      ambGain.gain.linearRampToValueAtTime(Math.max(0.0001, AMB_BASE * 0.5), t + 0.06);
      ambGain.gain.linearRampToValueAtTime(AMB_BASE, t + 0.5);
    }
    // THE interaction family: a soft WOOD "tock" (teak/bamboo). Filtered NOISE only
    // (no oscillator → can never read as a tone/chime); a quick downward resonant
    // sweep gives the woody knock; per-trigger pitch + gain jitter so repeats vary.
    function woodTock(level, centerHz, dest) {
      if (!ctx || !noiseBuf) return;
      const t = ctx.currentTime, det = rnd(0.9, 1.12), lvl = level * rnd(0.82, 1.0);
      const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; bp.type = "bandpass"; bp.Q.value = rnd(1.0, 1.7);   // wider band → more energy (louder) AND less pitched/tonal
      bp.frequency.setValueAtTime(centerHz * 1.7 * det, t);
      bp.frequency.exponentialRampToValueAtTime(centerHz * det, t + 0.05);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(lvl, t + 0.0022);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
      s.connect(bp); bp.connect(g); g.connect(dest || dryBus); s.start(t); s.stop(t + 0.11);
    }
    function sfxHover() {
      if (!on || !ctx || !noiseBuf) return;
      woodTock(0.11, 740, dryBus);       // a clear light tick — same instrument as the click, just higher/softer
      dbg.hover++;
    }
    function sfxClick() {
      if (!on || !ctx || !noiseBuf) return;
      woodTock(0.26, 400, dryBus);       // a clear warm teak "tock" — organic, not a tone/whoosh
      dbg.click++;
    }
    function sfxWhoosh(big) {             // airy "breath of dusk air" for the big section moments — non-melodic
      if (!on || !ctx || !noiseBuf) return;
      const t = ctx.currentTime, dur = big ? 0.85 : 0.55, peak = big ? 0.12 : 0.075;
      [[170, big ? 1050 : 850, 300, 0.7, 1], [850, big ? 2600 : 1900, 1100, 1.1, 0.45]].forEach((p) => {
        const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = noiseBuf; bp.type = "bandpass"; bp.Q.value = p[3];
        bp.frequency.setValueAtTime(p[0], t);
        bp.frequency.exponentialRampToValueAtTime(p[1], t + dur * 0.5);
        bp.frequency.exponentialRampToValueAtTime(p[2], t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak * p[4], t + dur * 0.42);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(bp); bp.connect(g); g.connect(wetBus); s.start(t); s.stop(t + dur + 0.05);
      });
      duckBed();
      dbg.whoosh++;
    }
    // a warm low WOODEN DRUM thud (kendang-style) — the one allowed near-musical
    // moment, played ONCE as the soundscape opens (replaces the bronze-gong cliché).
    function sfxThud() {
      if (!on || !ctx || !noiseBuf) return;
      const t = ctx.currentTime;
      const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();   // the wood knock
      s.buffer = noiseBuf; bp.type = "bandpass"; bp.frequency.value = 300; bp.Q.value = 2;
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.12, t + 0.003); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      s.connect(bp); bp.connect(ng); ng.connect(wetBus); s.start(t); s.stop(t + 0.12);
      [86, 129].forEach((f, i) => {                       // the low resonant body — a short, deep, warm drum
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.28);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(i ? 0.09 : 0.24, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + (i ? 0.5 : 0.9));
        o.connect(g); g.connect(wetBus); o.start(t); o.stop(t + 1);
      });
      duckBed();
      dbg.whoosh++;
    }

    // ---- toggle / enable-disable ------------------------------------------
    function reflect() {
      btn.classList.toggle("is-on", on); btn.classList.toggle("is-off", !on); btn.classList.remove("is-invite");
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "Mute sound" : "Play ambient Bali sound");
      const txt = btn.querySelector("[data-snd-txt]"); if (txt) txt.textContent = on ? "Sound on" : "Sound";
    }
    function masterTo(v, dur) {
      if (!ctx) return; const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
      master.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + dur);
    }
    function ambStart() {   // bring the bed up — graph handles level via ambGain (element at 1), or fade the element directly on file://
      if (directAmb) { audioEl.volume = 0; if (hasGSAP) gsap.to(audioEl, { volume: AMB_BASE, duration: 1.1 }); else audioEl.volume = AMB_BASE; }
      else audioEl.volume = 1;
    }
    function ambStop() {
      if (directAmb) { if (hasGSAP) gsap.to(audioEl, { volume: 0, duration: 0.5, onComplete: () => { if (!on) audioEl.pause(); } }); else { audioEl.volume = 0; audioEl.pause(); } }
      else setTimeout(() => { if (!on) audioEl.pause(); }, 560);
    }
    function setOn(next, persist) {
      on = next; dbg.on = on; reflect();
      if (buildGraph()) {
        if (ctx.state === "suspended") ctx.resume().then(() => { dbg.ctx = ctx.state; });
        prewarm();
        if (on) {
          const p = audioEl.play(); if (p && p.catch) p.catch(() => {});
          ambStart();                                       // bed up (graph level, or file:// direct)
          masterTo(1, 1.1); sfxThud(); sfxWhoosh(true);   // a warm wooden thud + airy swell as the soundscape opens (no gong, no gamelan shimmer)
        } else {
          masterTo(0.0001, 0.5); ambStop();                 // sfx mute; bed fades + pauses
        }
      } else {                                              // no Web Audio → plain bed, no sfx
        if (on) { audioEl.volume = 0; const p = audioEl.play(); if (p && p.catch) p.catch(() => {});
          if (hasGSAP) gsap.to(audioEl, { volume: AMB_BASE, duration: 1.1 }); else audioEl.volume = AMB_BASE; }
        else if (hasGSAP) gsap.to(audioEl, { volume: 0, duration: 0.5, onComplete: () => audioEl.pause() });
        else { audioEl.volume = 0; audioEl.pause(); }
      }
      if (persist) save(on ? "on" : "off");
    }
    btn.addEventListener("click", () => setOn(!on, true));

    // the bed respects your attention — fade it out when the tab is hidden, back when you return
    document.addEventListener("visibilitychange", () => {
      if (!on || !ctx) return;
      if (directAmb) { if (hasGSAP) gsap.to(audioEl, { volume: document.hidden ? 0 : AMB_BASE, duration: document.hidden ? 0.4 : 0.7 }); }
      else if (ambGain) { const t = ctx.currentTime; ambGain.gain.cancelScheduledValues(t); ambGain.gain.setValueAtTime(Math.max(0.0001, ambGain.gain.value), t); ambGain.gain.linearRampToValueAtTime(document.hidden ? 0.0001 : AMB_BASE, t + (document.hidden ? 0.4 : 0.7)); }
    });

    // ---- delegated ui sfx — fire the instant you ENTER a new control / PRESS it (tight, not throttled) ----
    const HIT = "a,button,.btn,[role='button'],.nav__link,summary,input,label,.tweaks__opt";
    let curHit = null;
    document.addEventListener("pointerover", (e) => {
      if (!on || (e.pointerType && e.pointerType !== "mouse")) return;
      const el = e.target.closest && e.target.closest(HIT);
      if (el && el !== curHit) { curHit = el; sfxHover(); }   // one immediate tick per control entered
      else if (!el) curHit = null;
    }, { passive: true });
    document.addEventListener("pointerout", (e) => {
      if (e.target === curHit && !(e.relatedTarget && curHit.contains && curHit.contains(e.relatedTarget))) curHit = null;
    }, { passive: true });
    document.addEventListener("pointerdown", (e) => {         // click sound on PRESS, not after release → feels in sync
      if (!on) return; const el = e.target.closest && e.target.closest(HIT);
      if (el && el !== btn) sfxClick();                       // the toggle plays its own whoosh
    }, { passive: true });

    // ---- slider / carousel feel: a grab, a drag-air that tracks your speed, a settle on release ----
    function sfxGrab() { if (!on || !ctx) return; woodTock(0.16, 280, dryBus); dbg.grab++; }       // a low woody "catch" (was a sine blip)
    function sfxRelease() { if (!on || !ctx) return; woodTock(0.11, 230, dryBus); dbg.release++; }   // softer, lower settle — same wood family
    document.querySelectorAll("[data-drag]").forEach((track) => {
      let down = false, lastX = 0, air = null;
      const startAir = () => {
        if (!ctx || air || !noiseBuf) return;
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 540; bp.Q.value = 0.9;
        const g = ctx.createGain(); g.gain.value = 0.0001;
        s.connect(bp); bp.connect(g); g.connect(dryBus); s.start(); air = { s: s, bp: bp, g: g };
      };
      const stopAir = () => { if (!air) return; const a = air; air = null; a.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08); setTimeout(() => { try { a.s.stop(); } catch (e) {} }, 220); };
      track.addEventListener("pointerdown", (e) => { if (!on || !ctx) return; down = true; lastX = e.clientX; sfxGrab(); startAir(); }, { passive: true });
      track.addEventListener("pointermove", (e) => {
        if (!on || !ctx || !down || !air) return;
        const dx = Math.abs(e.clientX - lastX); lastX = e.clientX; const t = ctx.currentTime;
        air.g.gain.setTargetAtTime(Math.min(0.11, dx * 0.011), t, 0.05);
        air.bp.frequency.setTargetAtTime(420 + Math.min(60, dx) * 16, t, 0.06);
      }, { passive: true });
      const rel = () => { if (!down) return; down = false; sfxRelease(); stopAir(); };
      window.addEventListener("pointerup", rel, { passive: true });
      window.addEventListener("pointercancel", rel, { passive: true });
    });
    document.querySelectorAll("[data-exp-prev],[data-exp-next]").forEach((b) => {
      b.addEventListener("pointerdown", () => { if (on && ctx) sfxWhoosh(false); }, { passive: true });   // a soft slide whoosh under the click
    });

    // ---- section cues, SYNCED to arrival via the Lenis-driven ScrollTrigger ----
    (function sectionCues() {
      const secs = Array.prototype.slice.call(document.querySelectorAll("section, .footer"));
      if (!secs.length) return;
      const BIG = /reveal-band|gallery|cta/;
      if (hasGSAP && typeof ScrollTrigger !== "undefined") {
        secs.forEach((s, i) => ScrollTrigger.create({
          trigger: s, start: "top 62%",                       // lands as the section settles into view
          onEnter: () => { if (!on || cuesMuted) return; if (BIG.test(s.className)) sfxWhoosh(true); },    // airy swell on the BIG moments only — no chime, no per-section spam
          onEnterBack: () => { if (!on || cuesMuted) return; if (BIG.test(s.className)) sfxWhoosh(false); },
        }));
      } else if ("IntersectionObserver" in window) {          // fallback: center-band observer
        const seen = new WeakSet();
        const io = new IntersectionObserver((ents) => ents.forEach((en) => {
          if (!en.isIntersecting) { seen.delete(en.target); return; }
          if (!on || cuesMuted || seen.has(en.target)) return; seen.add(en.target);
          if (BIG.test(en.target.className)) sfxWhoosh(true);
        }), { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
        secs.forEach((s) => io.observe(s));
      }
    })();

    // reveal the control once the loader has cleared
    if (motionOff) btn.classList.add("is-ready"); else setTimeout(() => btn.classList.add("is-ready"), 3400);

    // AMBIENT IS ON BY DEFAULT — it begins at the first gesture (browsers block audio before one);
    // only an explicit mute (stored "off") keeps it silent, and the toggle then acts as the mute.
    let pref = null; try { pref = localStorage.getItem(KEY); } catch (e) {}
    if (pref !== "off") {
      const evs = ["pointerdown", "keydown", "touchstart"];   // valid user-activation gestures only — scroll/wheel can't unlock audio and spammed "AudioContext not allowed to start"
      let pulsed = false;
      const onGesture = () => {
        if (!on) setOn(true, false);
        if (ctx && ctx.state === "running") {
          evs.forEach((e) => window.removeEventListener(e, onGesture));
          if (!pulsed) { pulsed = true; btn.classList.add("is-invite"); setTimeout(() => btn.classList.remove("is-invite"), 5200); }  // flag the mute so it's discoverable
        }
      };
      evs.forEach((e) => window.addEventListener(e, onGesture, { passive: true }));
    }

    // scroll → ambience breathes with velocity + the bed warms as you descend ---
    let lastY = window.scrollY, vel = 0, raf = 0;
    const docH = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const tick = () => {
      raf = 0;
      if (on && ctx) { if (directAmb) audioEl.volume = Math.min(1, AMB_BASE + AMB_SWELL * vel); else ambGain.gain.setTargetAtTime(AMB_BASE + AMB_SWELL * vel, ctx.currentTime, 0.18); vel *= 0.9; if (vel > 0.02) raf = requestAnimationFrame(tick); }
    };
    window.addEventListener("scroll", () => {
      const y = window.scrollY; vel = Math.min(1, Math.abs(y - lastY) / 80); lastY = y;
      if (on && ctx) {
        const prog = Math.min(1, Math.max(0, y / docH()));
        if (!directAmb) ambFilter.frequency.setTargetAtTime(10500 - prog * 2500, ctx.currentTime, 0.25);   // gentle warm-toward-dusk (graph only; the file:// direct bed has no filter)
        if (!raf) raf = requestAnimationFrame(tick);
      }
    }, { passive: true });
  })();

  /* DEV: header tweaks panel — flip header directions live (visit ?tweaks) */
  (function initTweaks() {
    if (!/[?&]tweaks/i.test(location.search)) return;
    const panel = document.querySelector("[data-tweaks]");
    const tab = document.querySelector("[data-tweaks-tab]");
    if (!panel || !tab) return;
    const root = document.documentElement;
    [{ attr: "data-hv", key: "hv" }, { attr: "data-hero", key: "hero" }, { attr: "data-mark", key: "mark" }].forEach((g) => {
      const opts = panel.querySelectorAll(`[data-${g.key}]`);
      if (!opts.length) return;
      const apply = (val) => {
        if (val === "current") root.removeAttribute(g.attr); else root.setAttribute(g.attr, val);
        opts.forEach((o) => o.classList.toggle("is-on", o.dataset[g.key] === val));
        try { localStorage.setItem("vs_" + g.key, val); } catch (e) {}
      };
      opts.forEach((o) => o.addEventListener("click", () => apply(o.dataset[g.key])));
      let saved = "current"; try { saved = localStorage.getItem("vs_" + g.key) || "current"; } catch (e) {}
      apply(saved);
    });
    const clk = panel.querySelector("[data-hv-clock]");
    if (clk) clk.addEventListener("change", () => root.classList.toggle("hv-clock-off", !clk.checked));
    const closeBtn = panel.querySelector("[data-tweaks-close]");
    if (closeBtn) closeBtn.addEventListener("click", () => { panel.hidden = true; tab.hidden = false; });
    tab.addEventListener("click", () => { panel.hidden = false; tab.hidden = true; });
    panel.hidden = false; tab.hidden = true;   // start open so it's discoverable
  })();

  /* DESCENT hero direction: a warm dusk veil that deepens as you scroll (only visible when data-hero=descent) */
  (function initDescent() {
    const veil = document.querySelector(".descent-veil");
    if (!veil || !hasGSAP) return;
    gsap.to(veil, { opacity: 1, ease: "none", scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: true } });
  })();

  /* nav active-section marker (used by the Index header direction — the current number fills ochre) */
  (function initNavActive() {
    const links = Array.from(document.querySelectorAll(".nav__links--left .nav__link[href^='#']"));
    if (!links.length || !("IntersectionObserver" in window)) return;
    const map = new Map();
    links.forEach((a) => { const t = document.querySelector(a.getAttribute("href")); if (t) map.set(t, a); });
    if (!map.size) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { links.forEach((l) => l.classList.remove("is-current")); const a = map.get(e.target); if (a) a.classList.add("is-current"); }
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    map.forEach((a, t) => obs.observe(t));
  })();

  /* slow push-in on the photo backgrounds as they scroll */
  gsap.utils.toArray(".hero__photo, .cta__photo, .suite__bg").forEach((photo) => {
    const host = photo.closest("section");
    gsap.fromTo(photo, { scale: 1.03 }, {
      scale: 1.14, ease: "none",
      scrollTrigger: { trigger: host, start: "top top", end: "bottom top", scrub: true },
    });
  });

  /* ============================================================
     AWWWARDS-LEVEL MOTION — time-of-day grade · pinned horizontal gallery
     ============================================================ */

  /* 1) Time-of-day grade REMOVED (Godwin: the scroll-darkening read off). The
     .day__tod overlays stay at their CSS default (opacity:0) so the Day photo shows clean. */

  /* 2) Pinned horizontal gallery — vertical scroll pans the photos sideways (desktop only) */
  (function horizontalGallery() {
    const pin = document.querySelector(".gallery__pin");
    const track = document.querySelector(".gallery__track");
    if (!pin || !track || window.matchMedia("(max-width: 900px)").matches) return;
    const dist = () => Math.max(0, track.scrollWidth - pin.clientWidth);
    gsap.to(track, {
      x: () => -dist(), ease: "none",
      scrollTrigger: {
        trigger: pin, start: "top top", end: () => "+=" + dist(),
        pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
      },
    });
  })();

  /* 024 · velocity-skew marquee — the marigold ticker shears + leans with scroll
     speed, then eases back. Skews the GROUPS (the track itself is CSS-translated),
     so it rides on top of the existing scroll without fighting it. */
  (function marqueeVelocity() {
    const groups = gsap.utils.toArray(".marquee__group");
    if (!groups.length || !hasGSAP) return;
    const setters = groups.map((g) => gsap.quickTo(g, "skewX", { duration: 0.5, ease: "power3" }));
    const clamp = gsap.utils.clamp(-14, 14);
    let vel = 0;
    ScrollTrigger.create({ onUpdate: (self) => { vel = self.getVelocity(); } });
    gsap.ticker.add(() => { const s = clamp(vel / 140); setters.forEach((fn) => fn(s)); vel *= 0.9; });
  })();

  /* ---------- Click-and-drag for the horizontal carousels ---------- */
  document.querySelectorAll("[data-drag]").forEach((track) => {
    let down = false, startX = 0, startScroll = 0, moved = 0;
    track.addEventListener("pointerdown", (e) => {
      down = true; moved = 0; track.classList.add("is-dragging");
      startX = e.clientX; startScroll = track.scrollLeft;
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
    });
    track.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX; moved = Math.abs(dx);
      track.scrollLeft = startScroll - dx;
    });
    const release = () => { down = false; track.classList.remove("is-dragging"); };
    track.addEventListener("pointerup", release);
    track.addEventListener("pointercancel", release);
    track.addEventListener("pointerleave", release);
    // don't trigger link clicks at the end of a drag
    track.addEventListener("click", (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  /* ---------- Facts: numbers count up as they scroll in ---------- */
  gsap.utils.toArray(".fact__num").forEach((el) => {
    const raw = el.textContent.trim();
    const target = parseFloat(raw.replace(/[^\d.]/g, ""));
    const suffix = raw.replace(/[\d.,]/g, "");          // keeps the "°" on 180°
    if (isNaN(target)) return;
    const o = { v: 0 };
    el.textContent = "0" + suffix;
    ScrollTrigger.create({
      trigger: el, start: "top 92%", once: true,
      onEnter: () => gsap.to(o, {
        v: target, duration: 1.4, ease: "power2.out",
        onUpdate: () => { el.textContent = Math.round(o.v) + suffix; },
      }),
    });
  });

  /* ---------- Magnetic pill buttons (skip touch) ---------- */
  if (!window.matchMedia("(hover: none)").matches) {
    document.querySelectorAll(".btn:not(.bk-submit)").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        gsap.to(btn, {
          x: (e.clientX - (r.left + r.width / 2)) * 0.18,
          y: (e.clientY - (r.top + r.height / 2)) * 0.2,
          duration: 0.45, ease: "power3.out",
        });
      });
      btn.addEventListener("pointerleave", () =>
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: "power3.out" }));
    });
  }

  /* ---------- Direction-aware button fill — the teak circle grows from where the cursor
     ENTERS the button and retracts toward where it LEAVES, so it follows your approach
     (and the cursor ring appears to seed it). Origin + a covering diameter → --fx/--fy/--fd;
     CSS animates the scale via .is-fill. Every .btn (incl. the booking CTA). ---------- */
  document.querySelectorAll(".btn").forEach((btn) => {
    const fill = btn.querySelector(".btn__fill");
    if (!fill) return;
    const origin = (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty("--fx", (e.clientX - r.left) + "px");
      btn.style.setProperty("--fy", (e.clientY - r.top) + "px");
      btn.style.setProperty("--fd", (Math.hypot(r.width, r.height) * 2.2) + "px");   // covers the button from any entry point
    };
    btn.addEventListener("pointerenter", (e) => { origin(e); btn.classList.add("is-fill"); });
    btn.addEventListener("pointerleave", (e) => { origin(e); btn.classList.remove("is-fill"); });
  });

  initDraw();
  initWipe();
  initHeader(lenis);

  /* ---------- Anchor links go through Lenis ---------- */
  if (lenis) {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        if (window.__snd && window.__snd.muteCues) window.__snd.muteCues(1700);   // flying past sections shouldn't fire a whoosh/chime cascade
        lenis.scrollTo(target, { offset: -20, duration: 1.4 });
      });
    });
  }

  /* ============================================================
     v2 — SECTION EFFECTS (Made With GSAP picks, applied per section)
     ============================================================ */

  /* §2 Lead — 004 word-slide: the statement assembles word-by-word from the right
     (per-line stagger, scrubbed to the section entering; no heavy pin). */
  (function leadWordReveal() {
    const para = document.querySelector(".lead__p[data-words]");
    if (!para || !hasGSAP) return;
    para.innerHTML = para.textContent.split(" ").map((w) => '<span class="word">' + w + "</span>").join(" ");
    const words = gsap.utils.toArray(para.querySelectorAll(".word"));
    gsap.set(words, { x: () => para.clientWidth });   // off the paragraph's right edge (clipped by overflow:hidden)
    const lines = [[]]; let li = 0;
    words.forEach((w, i) => { if (i > 0 && w.offsetTop !== words[i - 1].offsetTop) { lines.push([]); li++; } lines[li].push(w); });
    lines.forEach((lineWords) => {
      gsap.to(lineWords, { x: 0, stagger: 0.12, ease: "power1.inOut",
        scrollTrigger: { trigger: ".lead", start: "top 78%", end: "top 28%", scrub: true, invalidateOnRefresh: true } });
    });
  })();

  /* Experiences → 068 "postcard deck": the cards deal in with an alternating tilt +
     rise as the rail enters (on top of the existing drag-to-browse). */
  (function expPostcards() {
    const cards = gsap.utils.toArray(".exp-card");
    if (!cards.length) return;
    gsap.set(cards, { transformOrigin: "50% 100%" });
    gsap.fromTo(cards,
      { opacity: 0, y: 80, scale: 0.9, rotation: (i) => (i % 2 ? 6 : -6) },
      { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.9, ease: "back.out(1.4)",
        stagger: 0.12, scrollTrigger: { trigger: ".exp__track", start: "top 80%" } });
  })();

  /* "See for yourself" gallery: pans horizontally on scroll (horizontalGallery)
     with NO velocity skew — the shear sheared the cards into leaning parallelograms
     mid-scroll, which read as "glitching shapes." Clean upright photos now. */

  /* A day at Senja → 073-lite: the timeline stops deal in one after another. */
  (function timelineReveal() {
    const stops = gsap.utils.toArray(".timeline .tl");
    if (!stops.length) return;
    gsap.fromTo(stops, { opacity: 0, x: -50 },
      { opacity: 1, x: 0, duration: 0.7, ease: "power3.out", stagger: 0.14,
        scrollTrigger: { trigger: ".timeline", start: "top 80%" } });
  })();

  /* Footer → 050: the giant SENJA lockup rises in, then drifts on a slow parallax. */
  (function footerWordmark() {
    const lockup = document.querySelector(".footer__lockup");
    if (!lockup) return;
    // entrance uses y(px); parallax uses yPercent — separate transform sub-props so the two triggers don't fight (was the jitter)
    gsap.fromTo(lockup, { opacity: 0, y: 60 },
      { opacity: 1, y: 0, duration: 1.1, ease: "power3.out",
        scrollTrigger: { trigger: ".footer", start: "top 85%" } });
    gsap.fromTo(lockup, { yPercent: 10 }, { yPercent: -10, ease: "none",
      scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true } });
  })();

  /* Guest words → 087 marquee: the testimonial cards become a slow, velocity-reactive
     row instead of a static grid (desktop only; mobile keeps the readable stack). */
  (function testimonialsMarquee() {
    const wrap = document.querySelector(".testimonials");
    if (!wrap || window.matchMedia("(max-width: 760px)").matches) return;
    const cards = Array.from(wrap.children);
    if (cards.length < 2) return;
    const track = document.createElement("div");
    track.className = "tmarquee";
    cards.forEach((c) => track.appendChild(c));
    cards.forEach((c) => track.appendChild(c.cloneNode(true)));   // duplicate for a seamless loop
    wrap.appendChild(track);
    wrap.classList.add("is-marquee");
    // the .reveal fade only ran on the ORIGINALS — force EVERY card (incl. clones) visible so the row never shows empty shells
    track.querySelectorAll(".tcard").forEach((c) => { gsap.killTweensOf(c); c.classList.remove("reveal"); });
    gsap.set(track.querySelectorAll(".tcard"), { opacity: 1, y: 0 });   // cards stay upright — Godwin didn't want them tilted
    const half = () => track.scrollWidth / 2;
    const tl = gsap.to(track, { x: () => -half(), duration: half() / 38, ease: "none", repeat: -1 });
    let vel = 0;
    ScrollTrigger.create({ onUpdate: (self) => { vel = self.getVelocity(); } });
    gsap.ticker.add(() => { tl.timeScale(1 + gsap.utils.clamp(0, 5, Math.abs(vel) / 400)); vel *= 0.92; });
  })();

  /* Host-voiced cursor — a warm dot lerps to the pointer and, over a meaningful
     target, grows into an ochre disc with a HANDWRITTEN verb in the family's voice
     ("meet Wayan", "look closer", "drift through"). Desktop fine-pointer only,
     skipped for reduced-motion, steps aside over text fields. Off → CURSOR_ON=false. */
  (function initCursor() {
    const CURSOR_ON = true;
    if (!CURSOR_ON) return;
    if (!window.matchMedia("(hover: hover)").matches || !window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cur = document.createElement("div");
    cur.className = "v-cursor"; cur.setAttribute("aria-hidden", "true");
    const lbl = document.createElement("span"); lbl.className = "v-cursor__label"; cur.appendChild(lbl);
    document.body.appendChild(cur);
    document.documentElement.classList.add("has-cursor");
    gsap.set(cur, { xPercent: -50, yPercent: -50 });   // centre the pill on the point at any size
    const xTo = gsap.quickTo(cur, "x", { duration: 0.22, ease: "power3" });
    const yTo = gsap.quickTo(cur, "y", { duration: 0.22, ease: "power3" });
    const isField = (el) => el.closest && el.closest("input, textarea, select, [contenteditable]");
    // photos & special spots → a filled ochre PILL with a handwritten verb
    const LABELS = [
      [".hostnote__portrait", "meet Wayan"],
      [".gallery__item, .sides__media, .suite, .dining__media, .lead__media", "look closer"],
      [".tcard", "a kind word"],
      ["[data-drag], .exp__track", "drift through"],
      [".bk-submit", "ask us"],
    ];
    // links & buttons → a hollow ochre RING that reads "clickable"
    const RING = "a, button, .btn, .nav__link, .snd, .faq__q, summary, .bk-day, .bk-cal__nav, [data-exp-prev], [data-exp-next], [data-nav-toggle]";
    // ALL state runs off pointermove (no pointerover/out races): re-assert "is-on" every
    // move so a stray event can't strand it hidden, and recompute the MORPH only when the
    // element under the pointer changes.
    let lastEl = null;
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      xTo(e.clientX); yTo(e.clientY);
      cur.classList.add("is-on");
      if (e.target === lastEl) return;
      lastEl = e.target;
      const el = e.target;
      let mode = "none", text = "";
      if (el && el.closest) {
        if (isField(el)) mode = "field";
        else {
          for (let i = 0; i < LABELS.length; i++) { if (el.closest(LABELS[i][0])) { mode = "label"; text = LABELS[i][1]; break; } }
          if (mode === "none" && el.closest(RING)) mode = "ring";
        }
      }
      cur.classList.toggle("is-hidden", mode === "field");
      cur.classList.toggle("is-ring", mode === "ring");
      cur.classList.toggle("is-label", mode === "label");
      if (mode === "label" && text) lbl.textContent = text;
    }, { passive: true });
    // a tactile press — the cursor dips on mouse-down, springs back on release
    window.addEventListener("pointerdown", (e) => { if (!e.pointerType || e.pointerType === "mouse") gsap.to(cur, { scale: 0.78, duration: 0.12, ease: "power2.out" }); }, { passive: true });
    window.addEventListener("pointerup", () => gsap.to(cur, { scale: 1, duration: 0.22, ease: "back.out(2)" }), { passive: true });
    // hide when the pointer truly leaves the viewport; the next move brings it right back
    document.documentElement.addEventListener("mouseleave", () => cur.classList.remove("is-on"), { passive: true });
    document.documentElement.addEventListener("mouseenter", () => cur.classList.add("is-on"), { passive: true });
  })();

  window.addEventListener("resize", () => ScrollTrigger.refresh());
  ScrollTrigger.refresh();
})();
