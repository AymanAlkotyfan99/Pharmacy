/* Edit your invitation here. Dates without an offset use Damascus time (UTC+03:00). */
const graduationData = {
  name: "أيمن نعيم",
  title: "خريج صيدلة",
  subtitle: "Pharmacy Graduate",
  university: "الجامعة الخاصة السورية",
  classYear: "2026",
  date: "2026-09-28T18:00:00",
  eventDateText: "الاثنين 28 سبتمبر 2026",
  eventTimeText: "الساعة 6:00 مساءً",
  venue: "قاعة النخبة",
  city: "دمشق – سوريا",
  mapUrl: "https://maps.google.com"
};

(() => {
  "use strict";

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const state = {
    opening: false,
    entered: false,
    revealing: false,
    motionPaused: reducedMotion.matches,
    motionChosen: false,
    frame: 0,
    scrollDirty: true,
    cursorDirty: false,
    width: window.innerWidth,
    height: window.innerHeight,
    pointer: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    cursor: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    burstAt: 0,
    introTimers: [],
    revealObserver: null,
    parallaxElements: [],
    galleryItems: [],
    galleryIndex: 0,
    galleryTrigger: null,
    galleryVersion: 0,
    countdownTimer: 0
  };

  let canvas;
  let context;
  let particles = [];
  let burstParticles = [];
  let lastPaint = 0;
  let countdownUpdate = () => {};
  let cursorGlow;

  function bindInvitationData() {
    document.title = `${graduationData.name} | دعوة تخرّج الصيدلة ${graduationData.classYear}`;
    $$('[data-bind]').forEach(element => {
      const value = graduationData[element.dataset.bind];
      if (typeof value === "string") element.textContent = value;
    });
    $$('[data-year]').forEach(element => { element.textContent = graduationData.classYear; });
    const graduateImage = $("[data-graduate-image]");
    if (graduateImage) graduateImage.alt = `صورة الخريج ${graduationData.name}`;
    const monogram = $(".portrait-monogram");
    if (monogram) monogram.textContent = graduationData.name.trim().charAt(0);
    let safeMapUrl = "https://maps.google.com";
    try {
      const url = new URL(graduationData.mapUrl);
      if (url.protocol === "https:" || url.protocol === "http:") safeMapUrl = url.href;
    } catch { /* Keep the working map fallback for an invalid editable URL. */ }
    $$('[data-map-link]').forEach(link => {
      link.href = safeMapUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  }

  function initIntroCapsule() {
    const intro = $("#intro");
    const button = $("#capsule-button");
    const shell = $("#site-shell");
    if (!intro || !button) {
      enterMainSite(true);
      return;
    }
    document.body.classList.add("intro-active");
    if (shell) shell.inert = true;
    button.addEventListener("click", openCapsule);
    $$(".intro-skip").forEach(skip => skip.addEventListener("click", () => enterMainSite(true)));
  }

  function introStep(callback, delay) {
    state.introTimers.push(window.setTimeout(() => {
      if (!state.entered) callback();
    }, delay));
  }

  function openCapsule() {
    if (state.opening || state.entered) return;
    state.opening = true;
    const button = $("#capsule-button");
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-expanded", "true");
    }
    const status = $("#intro-status");
    if (status) status.textContent = "تُفتح الآن حكايةٌ من الشغف…";
    document.body.classList.add("is-opening");
    if (state.motionPaused) {
      introStep(() => enterMainSite(true), 180);
      return;
    }
    introStep(() => {
      document.body.classList.add("is-burst");
      state.burstAt = performance.now();
      requestFrame();
    }, 1900);
    introStep(() => enterMainSite(false), 2200);
    introStep(() => enterMainSite(true), 4200);
  }

  function enterMainSite(complete = true) {
    if (!state.revealing) {
      state.revealing = true;
      document.body.classList.add("is-entering");
      startObservingReveals();
    }
    if (!complete || state.entered) return;
    state.entered = true;
    state.introTimers.forEach(window.clearTimeout);
    state.introTimers = [];
    document.body.classList.add("site-ready");
    document.body.classList.remove("intro-active");
    const shell = $("#site-shell");
    if (shell) shell.inert = false;
    const intro = $("#intro");
    if (intro) {
      intro.setAttribute("aria-hidden", "true");
      intro.inert = true;
      window.setTimeout(() => { intro.hidden = true; }, state.motionPaused ? 0 : 650);
    }
    const heroTitle = $("#hero-title");
    if (heroTitle) heroTitle.focus({ preventScroll: true });
    state.scrollDirty = true;
    requestFrame();
  }

  function initRevealAnimations() {
    if (!("IntersectionObserver" in window)) return;
    state.revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        state.revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -20px 0px" });
  }

  function startObservingReveals() {
    $$(".reveal").forEach(element => {
      if (state.revealObserver) state.revealObserver.observe(element);
      else element.classList.add("is-visible");
    });
  }

  function initCountdown() {
    const units = {};
    $$('[data-countdown]').forEach(element => { units[element.dataset.countdown] = element; });
    if (!Object.keys(units).length) return;
    const rawDate = String(graduationData.date).trim();
    const explicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawDate);
    const target = new Date(explicitTimezone ? rawDate : `${rawDate}+03:00`).getTime();
    const message = $("#countdown-message");
    let finished = false;
    const changeTimers = new Map();
    const setNumber = (key, number) => {
      const element = units[key];
      if (!element) return;
      const text = String(number).padStart(2, "0");
      if (element.textContent === text) return;
      element.textContent = text;
      if (state.motionPaused || document.hidden) return;
      window.clearTimeout(changeTimers.get(element));
      element.classList.remove("is-changing");
      // The next paint separates updates without forcing synchronous layout.
      window.requestAnimationFrame(() => {
        element.classList.add("is-changing");
        changeTimers.set(element, window.setTimeout(() => element.classList.remove("is-changing"), 420));
      });
    };
    if (!Number.isFinite(target)) {
      Object.keys(units).forEach(key => { units[key].textContent = "—"; });
      if (message) message.textContent = "نترقّب معًا لحظة الفخر";
      return;
    }
    countdownUpdate = () => {
      const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setNumber("days", Math.floor(remaining / 86400));
      setNumber("hours", Math.floor(remaining / 3600) % 24);
      setNumber("minutes", Math.floor(remaining / 60) % 60);
      setNumber("seconds", remaining % 60);
      if (remaining === 0 && !finished) {
        finished = true;
        if (message) message.textContent = "لقد بدأت لحظة الفخر 🎓";
        $("#countdown-grid")?.classList.add("has-arrived");
      }
    };
    countdownUpdate();
    state.countdownTimer = window.setInterval(() => {
      if (!document.hidden && !finished) countdownUpdate();
    }, 1000);
  }

  function initParticles() {
    canvas = $("#ambient-canvas");
    if (!canvas) return;
    context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    const resizeParticles = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(state.width * ratio);
      canvas.height = Math.round(state.height * ratio);
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = state.width < 700 ? 42 : Math.min(90, Math.floor(state.width / 17));
      particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * state.width,
        y: Math.random() * state.height,
        radius: index % 7 === 0 ? 1.8 : 0.5 + Math.random() * 0.9,
        vx: (Math.random() - 0.5) * 0.095,
        vy: -0.035 - Math.random() * 0.065,
        phase: Math.random() * Math.PI * 2,
        molecule: index % 3 === 0,
        lavender: index % 8 === 0
      }));
      burstParticles = Array.from({ length: state.width < 700 ? 24 : 42 }, (_, index) => ({
        angle: index * 2.39996,
        speed: 55 + Math.random() * 180,
        size: 0.6 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2
      }));
      drawParticles(performance.now(), 0);
    };
    resizeParticles();
    window.addEventListener("resize", resizeParticles, { passive: true });
  }

  function drawParticles(time, delta) {
    if (!context) return;
    context.clearRect(0, 0, state.width, state.height);
    const drift = state.motionPaused ? 0 : Math.min(delta / 16.667, 3);
    particles.forEach((particle, index) => {
      particle.x += particle.vx * drift;
      particle.y += particle.vy * drift;
      if (particle.x < -10) particle.x = state.width + 10;
      if (particle.x > state.width + 10) particle.x = -10;
      if (particle.y < -10) particle.y = state.height + 10;
      const shimmer = 0.6 + Math.sin(time * 0.00045 + particle.phase) * 0.4;
      const color = particle.lavender ? "184,161,255" : "135,245,209";
      if (particle.molecule) {
        let connections = 0;
        for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
          const other = particles[otherIndex];
          if (!other.molecule) continue;
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 135) continue;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
          context.strokeStyle = `rgba(135,245,209,${(1 - distance / 135) * 0.095})`;
          context.lineWidth = 0.65;
          context.stroke();
          connections += 1;
          if (connections === 2) break;
        }
      }
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(${color},${0.16 + shimmer * 0.3})`;
      context.fill();
      if (particle.radius > 1.5) {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius * 3, 0, Math.PI * 2);
        context.fillStyle = `rgba(${color},${shimmer * 0.035})`;
        context.fill();
      }
    });
    const burstAge = (time - state.burstAt) / 1000;
    if (state.burstAt && burstAge >= 0 && burstAge < 2.4 && !state.motionPaused) {
      const fade = Math.max(0, 1 - burstAge / 2.4);
      burstParticles.forEach(particle => {
        const radius = particle.speed * (1 - Math.exp(-burstAge * 0.85));
        const angle = particle.angle + burstAge * 0.3;
        const x = state.width * 0.5 + Math.cos(angle) * radius;
        const y = state.height * 0.48 + Math.sin(angle) * radius * 0.7 - burstAge * 15;
        context.beginPath();
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fillStyle = `rgba(221,250,243,${fade * 0.65})`;
        context.fill();
      });
    }
  }

  function initMolecules() {
    const stage = $(".molecule-stage");
    if (!stage) return;
    const nodes = $$(".molecule-node", stage);
    const message = $("#molecule-message");
    const current = $("#molecule-current");
    let nodeTimer;
    const activate = node => {
      window.clearTimeout(nodeTimer);
      nodes.forEach(item => {
        const active = item === node;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      stage.classList.add("is-awake");
      if (current) current.textContent = node.dataset.value || node.textContent.trim();
      if (message) {
        message.textContent = "وهنا تبدأ الخطوة القادمة ✨";
        message.classList.add("is-visible");
      }
      nodeTimer = window.setTimeout(() => stage.classList.add("is-connected"), state.motionPaused ? 0 : 450);
    };
    nodes.forEach(node => {
      node.setAttribute("aria-pressed", "false");
      node.addEventListener("pointerenter", event => {
        if (event.pointerType === "mouse") activate(node);
      });
      node.addEventListener("focus", () => activate(node));
      node.addEventListener("click", () => activate(node));
    });
  }

  function initParallax() {
    $$(".gallery-item img").forEach(image => {
      if (!image.hasAttribute("data-parallax")) image.dataset.parallax = "0.035";
    });
    const portraitOrbit = $(".portrait-orbit");
    if (portraitOrbit && !portraitOrbit.hasAttribute("data-parallax")) portraitOrbit.dataset.parallax = "-0.045";
    state.parallaxElements = $$('[data-parallax]');
    const markDirty = () => {
      state.scrollDirty = true;
      requestFrame();
    };
    window.addEventListener("scroll", markDirty, { passive: true });
    window.addEventListener("resize", () => {
      state.width = window.innerWidth;
      state.height = window.innerHeight;
      markDirty();
    }, { passive: true });
  }

  function updateScrollEffects() {
    if (!state.scrollDirty) return;
    state.scrollDirty = false;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const available = document.documentElement.scrollHeight - state.height;
    const progress = available > 0 ? Math.max(0, Math.min(1, scrollTop / available)) : 0;
    const progressBar = $("#scroll-progress");
    if (progressBar) progressBar.style.transform = `scaleX(${progress})`;
    const journey = $(".journey");
    if (journey) {
      const rect = journey.getBoundingClientRect();
      const filled = Math.max(0, Math.min(1, (state.height * 0.78 - rect.top) / Math.max(1, rect.height * 0.8)));
      journey.style.setProperty("--journey-progress", filled.toFixed(3));
    }
    state.parallaxElements.forEach(element => {
      if (state.motionPaused) {
        element.style.setProperty("--parallax-y", "0px");
        return;
      }
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > state.height + 200) return;
      const strength = Math.max(-0.3, Math.min(0.3, Number(element.dataset.parallax) || 0.05));
      const offset = Math.max(-32, Math.min(32, (state.height / 2 - rect.top - rect.height / 2) * strength));
      element.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
    });
    $(".site-header")?.classList.toggle("is-scrolled", scrollTop > 35);
  }

  function watchImage(image) {
    const container = image.closest(".gallery-item, .graduate-image") || image.parentElement;
    const loaded = () => {
      if (!image.naturalWidth) return;
      image.hidden = false;
      container?.classList.remove("image-missing");
      container?.classList.add("image-loaded");
    };
    const missing = () => {
      image.hidden = true;
      container?.classList.remove("image-loaded");
      container?.classList.add("image-missing");
    };
    image.addEventListener("load", loaded);
    image.addEventListener("error", missing);
    if (image.complete) {
      if (image.naturalWidth) loaded();
      else missing();
    }
  }

  function initGallery() {
    state.galleryItems = $$(".gallery-item");
    $$(".gallery-item img, .graduate-image img").forEach(watchImage);
    state.galleryItems.forEach((item, index) => {
      item.addEventListener("click", () => openLightbox(index, item));
    });
  }

  function displayLightboxItem(index) {
    if (!state.galleryItems.length) return;
    state.galleryIndex = (index + state.galleryItems.length) % state.galleryItems.length;
    const item = state.galleryItems[state.galleryIndex];
    const media = $("#lightbox-media");
    if (!media) return;
    const version = ++state.galleryVersion;
    const caption = item.dataset.caption || $("img", item)?.alt || "لحظة من حكاية التخرّج";
    const captionElement = $("#lightbox-caption");
    const counterElement = $("#lightbox-counter");
    if (captionElement) captionElement.textContent = caption;
    if (counterElement) counterElement.textContent = `${String(state.galleryIndex + 1).padStart(2, "0")} / ${String(state.galleryItems.length).padStart(2, "0")}`;
    media.classList.remove("image-loaded", "image-missing", "is-changing");
    media.replaceChildren();
    const art = $(".gallery-art", item);
    if (art) {
      const clone = art.cloneNode(true);
      clone.classList.add("lightbox-artwork");
      clone.removeAttribute("id");
      $$('[id]', clone).forEach(element => element.removeAttribute("id"));
      clone.setAttribute("aria-hidden", "true");
      media.append(clone);
    }
    const source = item.dataset.image || $("img", item)?.getAttribute("src");
    if (source) {
      const image = new Image();
      image.className = "lightbox-image";
      image.alt = caption;
      image.decoding = "async";
      image.hidden = true;
      image.addEventListener("load", () => {
        if (version !== state.galleryVersion) return;
        image.hidden = false;
        media.classList.add("image-loaded");
        media.classList.remove("image-missing");
      });
      image.addEventListener("error", () => {
        if (version !== state.galleryVersion) return;
        image.remove();
        media.classList.add("image-missing");
      });
      media.append(image);
      image.src = source;
    } else media.classList.add("image-missing");
    window.requestAnimationFrame(() => {
      if (version === state.galleryVersion) media.classList.add("is-changing");
    });
  }

  function openLightbox(index, trigger) {
    const dialog = $("#lightbox");
    if (!dialog) return;
    state.galleryTrigger = trigger || document.activeElement;
    displayLightboxItem(index);
    document.body.classList.add("lightbox-open");
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
      $("#site-shell")?.setAttribute("inert", "");
    }
    $("#lightbox-close")?.focus({ preventScroll: true });
  }

  function closeLightbox() {
    const dialog = $("#lightbox");
    if (!dialog?.hasAttribute("open")) return;
    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      $("#site-shell")?.removeAttribute("inert");
      restoreAfterLightbox();
    }
  }

  function restoreAfterLightbox() {
    document.body.classList.remove("lightbox-open");
    state.galleryVersion += 1;
    state.galleryTrigger?.focus({ preventScroll: true });
    state.scrollDirty = true;
    requestFrame();
  }

  function initLightbox() {
    const dialog = $("#lightbox");
    if (!dialog) return;
    $("#lightbox-close")?.addEventListener("click", closeLightbox);
    $("#lightbox-next")?.addEventListener("click", () => displayLightboxItem(state.galleryIndex + 1));
    $("#lightbox-prev")?.addEventListener("click", () => displayLightboxItem(state.galleryIndex - 1));
    dialog.addEventListener("close", restoreAfterLightbox);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      closeLightbox();
    });
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside || !event.target.closest(".lightbox-panel")) closeLightbox();
    });
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        displayLightboxItem(state.galleryIndex + 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        displayLightboxItem(state.galleryIndex - 1);
      } else if (event.key === "Tab" && typeof dialog.showModal !== "function") {
        const controls = $$("button, [href], [tabindex]:not([tabindex='-1'])", dialog).filter(element => !element.disabled);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    });
    let touchStart = null;
    const media = $("#lightbox-media");
    media?.addEventListener("touchstart", event => {
      if (event.touches.length !== 1) { touchStart = null; return; }
      const touch = event.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    media?.addEventListener("touchend", event => {
      if (!touchStart || !event.changedTouches.length) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        displayLightboxItem(state.galleryIndex + (dx < 0 ? 1 : -1));
      }
      touchStart = null;
    }, { passive: true });
    media?.addEventListener("touchcancel", () => { touchStart = null; }, { passive: true });
  }

  function initCursorGlow() {
    cursorGlow = $("#cursor-glow");
    if (!cursorGlow) return;
    const updatePointerMode = () => {
      cursorGlow.hidden = !finePointer.matches || state.motionPaused;
    };
    updatePointerMode();
    finePointer.addEventListener?.("change", updatePointerMode);
    document.addEventListener("pointermove", event => {
      if (!finePointer.matches || state.motionPaused || event.pointerType === "touch") return;
      state.pointer.x = event.clientX;
      state.pointer.y = event.clientY;
      state.cursorDirty = true;
      cursorGlow.classList.add("is-visible");
      requestFrame();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => cursorGlow.classList.remove("is-visible"));
  }

  function initScrollProgress() {
    const backToTop = $("#back-to-top");
    if (backToTop && !backToTop.getAttribute("href")) {
      backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: state.motionPaused ? "instant" : "smooth" });
      });
    }
    const menuToggle = $("#menu-toggle");
    const nav = $("#site-nav");
    const closeMenu = () => {
      menuToggle?.setAttribute("aria-expanded", "false");
      menuToggle?.setAttribute("aria-label", "فتح قائمة التنقل");
      nav?.classList.remove("is-open");
      document.body.classList.remove("menu-open");
    };
    menuToggle?.addEventListener("click", () => {
      const open = menuToggle.getAttribute("aria-expanded") !== "true";
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "إغلاق قائمة التنقل" : "فتح قائمة التنقل");
      nav?.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
    });
    $$("a[href^='#']").forEach(link => {
      link.addEventListener("click", event => {
        const id = link.getAttribute("href").slice(1);
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        if (!state.entered && link.classList.contains("skip-link")) enterMainSite(true);
        closeMenu();
        target.scrollIntoView({ behavior: state.motionPaused ? "instant" : "smooth", block: "start" });
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      });
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && menuToggle?.getAttribute("aria-expanded") === "true") {
        closeMenu();
        menuToggle.focus();
      }
    });
    document.addEventListener("click", event => {
      if (nav && menuToggle && !nav.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
    });
  }

  function applyMotionPreference() {
    document.body.classList.toggle("motion-paused", state.motionPaused);
    const toggle = $("#motion-toggle");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(state.motionPaused));
      const label = state.motionPaused ? "تشغيل الحركة" : "إيقاف الحركة";
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
      const visibleLabel = $("[data-motion-label]", toggle);
      if (visibleLabel) visibleLabel.textContent = label;
    }
    if (cursorGlow) cursorGlow.hidden = !finePointer.matches || state.motionPaused;
    if (state.motionPaused && state.opening && !state.entered) enterMainSite(true);
    state.scrollDirty = true;
    drawParticles(performance.now(), 0);
    requestFrame();
  }

  function initVisibilityHandling() {
    $("#motion-toggle")?.addEventListener("click", () => {
      state.motionChosen = true;
      state.motionPaused = !state.motionPaused;
      applyMotionPreference();
    });
    reducedMotion.addEventListener?.("change", event => {
      if (!state.motionChosen) {
        state.motionPaused = event.matches;
        applyMotionPreference();
      }
    });
    document.addEventListener("visibilitychange", () => {
      document.body.classList.toggle("page-hidden", document.hidden);
      if (document.hidden) {
        window.cancelAnimationFrame(state.frame);
        state.frame = 0;
        lastPaint = 0;
      } else {
        countdownUpdate();
        state.scrollDirty = true;
        requestFrame();
      }
    });
    window.addEventListener("pagehide", () => {
      window.cancelAnimationFrame(state.frame);
      state.frame = 0;
    });
    window.addEventListener("pageshow", () => {
      countdownUpdate();
      state.scrollDirty = true;
      requestFrame();
    });
    applyMotionPreference();
  }

  function requestFrame() {
    if (!state.frame && !document.hidden) state.frame = window.requestAnimationFrame(animationFrame);
  }

  function animationFrame(time) {
    state.frame = 0;
    if (document.hidden) return;
    updateScrollEffects();
    if (state.cursorDirty && cursorGlow && !state.motionPaused) {
      state.cursor.x += (state.pointer.x - state.cursor.x) * 0.075;
      state.cursor.y += (state.pointer.y - state.cursor.y) * 0.075;
      cursorGlow.style.transform = `translate3d(${state.cursor.x.toFixed(1)}px, ${state.cursor.y.toFixed(1)}px, 0)`;
      state.cursorDirty = Math.abs(state.pointer.x - state.cursor.x) + Math.abs(state.pointer.y - state.cursor.y) > 0.5;
    }
    if (context && !state.motionPaused && time - lastPaint >= 32) {
      drawParticles(time, lastPaint ? time - lastPaint : 16.667);
      lastPaint = time;
    }
    if ((!state.motionPaused && context) || (state.cursorDirty && !state.motionPaused) || state.scrollDirty) requestFrame();
  }

  function init() {
    document.documentElement.classList.add("js");
    bindInvitationData();
    initRevealAnimations();
    initParallax();
    initParticles();
    initCountdown();
    initMolecules();
    initGallery();
    initLightbox();
    initCursorGlow();
    initScrollProgress();
    initVisibilityHandling();
    initIntroCapsule();
    requestFrame();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
