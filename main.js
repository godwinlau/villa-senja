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
      if (y > 260 && y > lastY + 4) header.classList.add("is-hidden");
      else if (y < lastY - 4 || y < 260) header.classList.remove("is-hidden");
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
     Native horizontal scroll (so it works in every mode); arrows step one card,
     the progress bar tracks position, and the arrows disable at each end. */
  function initExpSlider() {
    const track = document.querySelector(".exp__track");
    if (!track) return;
    const prev = document.querySelector("[data-exp-prev]");
    const next = document.querySelector("[data-exp-next]");
    const fill = document.querySelector(".exp__progress-fill");
    const card = track.querySelector(".exp-card");
    const stepSize = () => {
      const cs = getComputedStyle(track);
      const gap = parseFloat(cs.columnGap || cs.gap) || 0;
      return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
    };
    const maxScroll = () => track.scrollWidth - track.clientWidth;
    const update = () => {
      const max = maxScroll();
      const p = max > 4 ? track.scrollLeft / max : 0;
      if (fill) fill.style.transform = "scaleX(" + Math.max(0.06, Math.min(1, p)).toFixed(3) + ")";
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
    };
    // Custom eased glide (native smooth-scroll + scroll-snap felt janky). A small
    // rAF tween with easeInOutCubic; snap is suspended mid-glide; targetIdx lets
    // rapid clicks stack and redirect cleanly from the current position.
    let animating = false, targetIdx = 0, raf = 0;
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const glideTo = (dest) => {
      cancelAnimationFrame(raf);
      const from = track.scrollLeft;
      const dist = dest - from;
      if (Math.abs(dist) < 1) return;
      const dur = 600;
      let startT = null;
      track.style.scrollSnapType = "none";
      animating = true;
      const frame = (now) => {
        if (startT === null) startT = now;
        const t = Math.min(1, (now - startT) / dur);
        track.scrollLeft = from + dist * easeInOut(t);
        if (t < 1) { raf = requestAnimationFrame(frame); }
        else { animating = false; track.style.scrollSnapType = ""; }
      };
      raf = requestAnimationFrame(frame);
    };
    const go = (dir) => {
      const step = stepSize();
      const maxIdx = Math.max(0, Math.round(maxScroll() / step));
      const base = animating ? targetIdx : Math.round(track.scrollLeft / step);
      targetIdx = Math.max(0, Math.min(maxIdx, base + dir));
      const dest = Math.min(maxScroll(), targetIdx * step);
      if (motionOff) track.scrollLeft = dest;
      else glideTo(dest);
    };
    if (prev) prev.addEventListener("click", () => go(-1));
    if (next) next.addEventListener("click", () => go(1));
    // Keyboard panning so the focusable track is operable without a pointer.
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "Home") { e.preventDefault(); motionOff ? (track.scrollLeft = 0) : glideTo(0); }
      else if (e.key === "End") { e.preventDefault(); motionOff ? (track.scrollLeft = maxScroll()) : glideTo(maxScroll()); }
    });
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
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
        note.hidden = false; note.textContent = "Now choose your check-out (2-night minimum).";
      } else {
        selWrap.hidden = true; summary.hidden = true; contact.hidden = true; submit.disabled = true;
        note.hidden = false; note.textContent = "Two-night minimum — pick your dates for a total.";
      }
    };

    const onPick = (d) => {
      let msg = null;
      if (!ci || co) { ci = d; co = null; }
      else if (d <= ci) { ci = d; co = null; }
      else if (Math.round((d - ci) / dayMs) < MIN) { msg = "Minimum stay is " + MIN + " nights — pick a later check-out."; }
      else if (rangeHasBlock(ci, d)) { ci = d; co = null; msg = "Those dates aren't free — starting again from there."; }
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
      if (!name) { note.hidden = false; note.textContent = "Please add your name."; if (nameEl) nameEl.focus(); return; }
      if (!email || !/.+@.+\..+/.test(email)) { note.hidden = false; note.textContent = "Please add a valid email."; if (emailEl) emailEl.focus(); return; }
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
      submit.querySelector(".btn__txt").textContent = "Enquiry sent";
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
  gsap.utils.toArray(".reveal:not(.sides__media)").forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1.1, ease: EASE,
        scrollTrigger: { trigger: el, start: "top 86%" } });
  });

  /* ---------- Images: a clip wipe in, then a slow crop drift ---------- */
  gsap.utils.toArray(".sides__media").forEach((el) => {
    const img = el.querySelector("img");
    gsap.fromTo(el,
      { clipPath: "inset(14% 11% 14% 11%)", opacity: 0 },
      { clipPath: "inset(0% 0% 0% 0%)", opacity: 1, duration: 1.5, ease: EASE,
        scrollTrigger: { trigger: el, start: "top 85%" } });
    if (img) {
      gsap.fromTo(img, { objectPosition: "50% 30%" },
        { objectPosition: "50% 70%", ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
    }
  });

  /* ---------- Hero: choreographed entrance (fromTo so it can be pre-hidden under
     the loader, then rise in as the gate doors open) ---------- */
  function playHeroIntro() {
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .fromTo(".hero .eyebrow", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9 }, 0.1)
      .fromTo(".hero__title .line__in", { yPercent: 110 }, { yPercent: 0, duration: 1.2, stagger: 0.14 }, 0.2)   // MASKED per-line rise (not a flat fade)
      .fromTo(".hero__sub", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.95 }, 0.7)
      .fromTo(".hero__cta", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.85 }, 0.9);
  }

  /* ---------- Loader: "through the gate, into senja" — two dusk-stone doors carry the
     lit candi bentar; the carved gate halves catch first light (base→finials), the
     wordmark rises, then the doors PART to uncover the REAL valley behind — one
     continuous move from dusk-shadow into golden hour, no separate splash. ---------- */
  function initLoader(done) {
    if (!loaderEl) { done(); return; }
    const lights = loaderEl.querySelectorAll(".loader__ghlight");
    const wm     = loaderEl.querySelector(".loader__mark-line");
    const dL     = loaderEl.querySelector(".loader__door--l");
    const dR     = loaderEl.querySelector(".loader__door--r");

    gsap.set(lights, { "--lit": "0%" });                              // gate halves start in shadow
    gsap.set(wm, { yPercent: 120 });                                 // wordmark masked below its baseline
    gsap.set([".hero .eyebrow", ".hero__sub", ".hero__cta"], { opacity: 0 });   // hero waits behind the doors
    gsap.set(".hero__title .line__in", { yPercent: 110 });

    gsap.timeline()
      // 1) first light climbs the carved gate — base first, finials last (left a beat ahead of right)
      .to(lights, { "--lit": "100%", duration: 1.5, ease: "power2.inOut", stagger: 0.1 }, 0.2)
      // 2) the wordmark rises at the gate's foot — masked, quiet
      .to(wm, { yPercent: 0, duration: 0.9, ease: "power3.out" }, "-=0.8")
      // a held breath before the gate opens
      .addLabel("open", "+=0.4")
      // 3) the gate OPENS — the two dusk-stone doors part on a heavy expo, uncovering the REAL valley
      .to(".loader__center", { opacity: 0, duration: 0.5, ease: "power1.in" }, "open")
      .to(dL, { xPercent: -100, duration: 1.4, ease: "expo.inOut" }, "open")
      .to(dR, { xPercent: 100,  duration: 1.4, ease: "expo.inOut" }, "open+=0.08")   // right door lags ~80ms
      // 4) hand off mid-open — the editorial lockup rises as the gap widens (uncovered, not popped)
      .add(done, "open+=0.7")
      .add(() => { loaderEl.style.display = "none"; }, "open+=1.6");
  }
  initLoader(playHeroIntro);

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
        lenis.scrollTo(target, { offset: -20, duration: 1.4 });
      });
    });
  }

  window.addEventListener("resize", () => ScrollTrigger.refresh());
  ScrollTrigger.refresh();
})();
