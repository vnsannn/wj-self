/* ============================================================
   William James — Interactions
   ============================================================ */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const enableCustomCursor = !prefersReducedMotion && !isCoarsePointer;

  /* ----------------------------------------------------------
     Footer year
     ---------------------------------------------------------- */
  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ----------------------------------------------------------
     Custom cursor (blob + trail)
     ---------------------------------------------------------- */
  const cursorDot = document.getElementById('cursorDot');
  const canvas = document.getElementById('cursorCanvas');

  if (enableCustomCursor && cursorDot && canvas) {
    const ctx = canvas.getContext('2d');
    let dpr = window.devicePixelRatio || 1;

    function resizeCanvas() {
      // Re-read DPR every resize — browser zoom changes it, and the
      // window's `resize` event fires on zoom, so we stay in sync.
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let mouseX = 0, mouseY = 0;
    let idle = false;
    let hovering = false;
    let idleTimer;
    const trail = [];
    const maxTrailLength = 25;

    const hoverTargets = document.querySelectorAll(
      'a, .me-card, .dual-ring, .dual-core, .book-cover-wrap, .about-portrait, .hero-image, .summary-visual'
    );

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      clearTimeout(idleTimer);
      idle = false;
      cursorDot.classList.remove('idle');
      idleTimer = setTimeout(() => {
        idle = true;
        cursorDot.classList.add('idle');
      }, 16);

      trail.unshift({ x: mouseX, y: mouseY });
      if (trail.length > maxTrailLength) trail.pop();
    });

    function drawTrail() {
      // Clear in native/physical coordinates (transform reset), not in
      // the DPR-scaled logical space. Under the DPR transform, calling
      // clearRect(0, 0, canvas.width, canvas.height) only clears a
      // logical rect of physical size (canvas.width*dpr, canvas.height*dpr).
      // When DPR < 1 (e.g. browser zoom below 100% on some Windows
      // setups), that under-clears the right/bottom edges — leaving a
      // painted-canvas effect exactly proportional to (1 - dpr). The
      // 20% right/bottom smear was DPR ≈ 0.8. Save/reset/restore keeps
      // the rest of the draw code in CSS-pixel space.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      cursorDot.style.left = mouseX + 'px';
      cursorDot.style.top = mouseY + 'px';

      if (trail.length > 0) {
        trail[0].x = mouseX;
        trail[0].y = mouseY;
      }

      if (trail.length >= 3) {
        const baseColor = hovering ? '160, 112, 64' : '139, 58, 58';

        // Draw the trail as a filled polygon "ribbon" instead of stroked
        // line segments. For each trail point we compute a perpendicular
        // normal and offset outward by half the local width, giving a
        // left-edge polyline and a right-edge polyline. Closing those
        // into a single filled shape yields:
        //   - smooth width transitions (no per-segment stepping)
        //   - no round caps at internal joints (so no "dots" at turns)
        //   - true taper: each point can have its own width
        // A round cap at the head is optional (an ellipse at trail[0]).
        const n = trail.length;

        // Precompute widths per point using the same taper curve.
        const width = (i, base) => {
          const progress = (n - 1 - i) / n; // 1 at head, ~0 at tail
          return base * Math.pow(progress, 0.6);
        };

        // Precompute unit normals at each point (perpendicular to the
        // local tangent). Endpoints use the adjacent segment's direction;
        // interior points average both neighbors for smoothness.
        const normals = new Array(n);
        for (let i = 0; i < n; i++) {
          let tx, ty;
          if (i === 0)         { tx = trail[1].x - trail[0].x;     ty = trail[1].y - trail[0].y; }
          else if (i === n-1)  { tx = trail[n-1].x - trail[n-2].x; ty = trail[n-1].y - trail[n-2].y; }
          else                 { tx = trail[i+1].x - trail[i-1].x; ty = trail[i+1].y - trail[i-1].y; }
          const len = Math.hypot(tx, ty) || 1;
          normals[i] = { x: -ty / len, y: tx / len };
        }

        const drawRibbon = (baseWidth, alpha) => {
          ctx.beginPath();
          // Left edge: head -> tail
          for (let i = 0; i < n; i++) {
            const w = width(i, baseWidth) / 2;
            const x = trail[i].x + normals[i].x * w;
            const y = trail[i].y + normals[i].y * w;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          // Right edge: tail -> head (closes the polygon)
          for (let i = n - 1; i >= 0; i--) {
            const w = width(i, baseWidth) / 2;
            ctx.lineTo(trail[i].x - normals[i].x * w, trail[i].y - normals[i].y * w);
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(${baseColor}, ${alpha})`;
          ctx.fill();
        };

        // Soft outer glow (wider, low alpha)
        drawRibbon(50, 0.10);
        // Main body
        drawRibbon(24, 0.65);

        // Round-cap the head for BOTH layers so neither ends in a flat
        // perpendicular line. Glow cap first (wide, low alpha) so the
        // main-body cap paints on top and blends.
        const glowHeadR = width(0, 50) / 2 + 1;
        ctx.beginPath();
        ctx.arc(trail[0].x, trail[0].y, glowHeadR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor}, 0.10)`;
        ctx.fill();

        const mainHeadR = width(0, 24) / 2 + 1;
        ctx.beginPath();
        ctx.arc(trail[0].x, trail[0].y, mainHeadR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor}, 0.65)`;
        ctx.fill();
      }

      // Decay trail from tip when idle. Popping 2 per frame drains
      // the full 25-point trail in ~200ms (was ~400ms at 1/frame).
      if (idle && trail.length > 1) {
        trail.pop();
        if (trail.length > 1) trail.pop();
      }
      requestAnimationFrame(drawTrail);
    }
    drawTrail();

    hoverTargets.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        hovering = true;
        cursorDot.classList.add('hovering');
      });
      el.addEventListener('mouseleave', () => {
        hovering = false;
        cursorDot.classList.remove('hovering');
      });
    });
  } else {
    // No custom cursor: drop the DOM nodes so they don't render.
    if (cursorDot) cursorDot.remove();
    if (canvas) canvas.remove();
  }

  /* ----------------------------------------------------------
     Nav + scroll sync
     ---------------------------------------------------------- */
  const nav = document.getElementById('mainNav');
  const aboutSection = document.getElementById('about');
  const navLinksContainer = document.getElementById('navLinks');
  const navIndicator = document.getElementById('navIndicator');
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('section[id]');

  // True while a click/keyboard-triggered smooth scroll is in flight.
  let isAnimating = false;

  // True when the in-flight nav STARTED from the hero-dock (morphing)
  // phase. Stays true for the whole guard window, even after the dock
  // has finished morphing into the content-header, so the underline
  // keeps snapping into place every frame instead of freezing at its
  // mid-morph position until the cleanup timer fires.
  let navSnapMode = false;

  function computeTransitionPoint() {
    return aboutSection ? aboutSection.offsetTop : Math.max(window.innerHeight * 0.72, 420);
  }
  let transitionPoint = computeTransitionPoint();
  function recalcTransitionPoint() { transitionPoint = computeTransitionPoint(); }

  function moveIndicator(link) {
    if (!link || !navIndicator || !navLinksContainer) return;
    const linkRect = link.getBoundingClientRect();
    const containerRect = navLinksContainer.getBoundingClientRect();
    navIndicator.style.left = (linkRect.left - containerRect.left) + 'px';
    navIndicator.style.width = linkRect.width + 'px';
  }

  function clearActiveState() {
    navLinks.forEach((link) => link.classList.remove('active'));
    if (navIndicator) navIndicator.style.width = '0px';
  }

  function syncNavToPosition() {
    if (window.scrollY < transitionPoint) {
      if (!isAnimating) clearActiveState();
      return null;
    }

    const marker = 120;
    let current = null;
    let currentTop = -Infinity;
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= marker && rect.bottom > marker && rect.top > currentTop) {
        current = section;
        currentTop = rect.top;
      }
    });

    if (!current) return null;

    if (!isAnimating) {
      navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === '#' + current.id));
      const activeLink = [...navLinks].find((link) => link.classList.contains('active'));
      if (activeLink) moveIndicator(activeLink);
    }
    return current.id;
  }

  function updateHeaderState() {
    // On mobile the nav is a plain top bar (see CSS). Skip all the
    // desktop dock↔header morphing / inline sizing. We still track
    // dark-section state so the hamburger stays legible.
    if (window.matchMedia('(max-width: 900px)').matches) {
      nav.classList.add('visible');
      nav.classList.remove('hero-dock');
      nav.classList.add('content-header');
      const dark = syncNavToPosition() === 'meself' || window.scrollY < transitionPoint;
      nav.classList.toggle('dark-header', dark);
      // Clear any inline styles the desktop path may have left behind.
      nav.style.cssText = '';
      return;
    }

    const progress = Math.min(Math.max(window.scrollY / transitionPoint, 0), 1);
    const isContentHeader = progress >= 1;
    const currentSectionId = isContentHeader ? syncNavToPosition() : null;
    const isDarkSection = currentSectionId === 'meself';
    const startWidth = Math.max((navLinksContainer?.scrollWidth || 280) + 56, 320);
    const viewportWidth = document.documentElement.clientWidth;

    nav.classList.add('visible');
    nav.classList.toggle('dark-header', Boolean(isDarkSection));

    if (!isContentHeader) {
      nav.classList.add('hero-dock');
      nav.classList.remove('content-header');
      const targetWidth = viewportWidth + 64;
      nav.style.width = `${startWidth + (targetWidth - startWidth) * progress}px`;
      nav.style.left = '50%';
      nav.style.right = 'auto';
      nav.style.top = `${22 * (1 - progress)}px`;
      const horizontalPadding = 16 + (48 * progress);
      nav.style.padding = `${8 + (4 * progress)}px ${horizontalPadding}px`;
      nav.style.justifyContent = 'center';
      nav.style.borderRadius = `${999 * (1 - progress)}px`;
      nav.style.transform = 'translateX(-50%)';
      if (!isAnimating) clearActiveState();
    } else {
      nav.style.width = `${viewportWidth + 64}px`;
      nav.style.left = '50%';
      nav.style.right = 'auto';
      nav.style.top = '0';
      nav.style.padding = '12px 64px';
      nav.style.borderRadius = '0';
      nav.style.transform = 'translateX(-50%)';
      nav.style.justifyContent = 'space-between';
      nav.classList.remove('hero-dock');
      nav.classList.add('content-header');

      if (!isAnimating && ![...navLinks].some((link) => link.classList.contains('active'))) {
        const aboutLink = nav.querySelector('.nav-links a[href="#about"]');
        if (aboutLink) {
          aboutLink.classList.add('active');
          moveIndicator(aboutLink);
        }
      }
    }

    // While a nav is in flight, snap the underline into place every
    // frame (with the CSS transition disabled) whenever we're in the
    // "morphing" snap mode. That covers:
    //   1. The dock still visibly resizing into the content-header.
    //   2. The dock JUST finished morphing but the scroll is still in
    //      flight — the nav-links container has settled at a new x/width
    //      so the underline's target position moved, and without this
    //      per-frame snap the underline would freeze at its stale
    //      mid-morph position until the cleanup timer fires.
    //
    // Stable-to-stable moves (both endpoints already in content-header)
    // don't enter snap mode, so CSS glides the underline normally.
    if (isAnimating && navSnapMode) {
      const activeLink = [...navLinks].find((link) => link.classList.contains('active'));
      if (activeLink) {
        navIndicator.style.transition = 'none';
        moveIndicator(activeLink);
      }
    }
  }

  let scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      updateHeaderState();
      scrollTicking = false;
    });
  }

  updateHeaderState();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    recalcTransitionPoint();
    updateHeaderState();
    const activeLink = document.querySelector('.nav-links a.active');
    if (activeLink) moveIndicator(activeLink);
  });

  // Re-measure once webfonts finish loading — hero can reflow.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      recalcTransitionPoint();
      updateHeaderState();
    });
  }

  /* ----------------------------------------------------------
     Reveal on scroll
     ---------------------------------------------------------- */
  const reveals = document.querySelectorAll('.reveal');
  if (prefersReducedMotion) {
    reveals.forEach((el) => el.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach((el) => observer.observe(el));
  }

  /* ----------------------------------------------------------
     Nav-driven navigation (click + arrow keys)
     ---------------------------------------------------------- */
  function navigateToSection(targetSection, targetLink) {
    if (!targetSection || isAnimating) return;
    isAnimating = true;

    // Snap mode is decided ONCE at click time based on the current
    // header state — and stays true for the full guard window if we
    // started from the morphing dock. That way even after the dock
    // settles into the content-header mid-scroll, updateHeaderState
    // keeps snapping the underline every frame instead of leaving it
    // frozen at its mid-morph position until the cleanup timer.
    const startedFromDock = !nav.classList.contains('content-header');
    navSnapMode = startedFromDock;

    if (targetLink) {
      navLinks.forEach((link) => link.classList.remove('active'));
      targetLink.classList.add('active');
      if (startedFromDock) {
        navIndicator.style.transition = 'none';
      }
      moveIndicator(targetLink);
    } else {
      // Hero or unlabeled target — clear active state.
      clearActiveState();
    }

    targetSection.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });

    const scrollDistance = Math.abs(window.pageYOffset - targetSection.offsetTop);
    const guardDuration = Math.min(Math.max(scrollDistance * 0.7, 400), 1000);
    setTimeout(() => {
      isAnimating = false;
      navSnapMode = false;
      if (!navIndicator) return;
      // Re-anchor once at the settled position, then restore the smooth
      // CSS transition so subsequent scroll-driven moves glide again.
      const activeLink = document.querySelector('.nav-links a.active');
      if (activeLink) moveIndicator(activeLink);
      // Force a reflow so any 'none' set above applies to the snap
      // before we clear it — otherwise clearing it in the same frame
      // can let the transition catch the tail of the movement.
      // eslint-disable-next-line no-unused-expressions
      navIndicator.offsetWidth;
      navIndicator.style.transition = '';
    }, guardDuration);
  }

  navLinks.forEach((link, index) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (isAnimating) return;
      const currentIndex = Array.from(navLinks).findIndex((l) => l.classList.contains('active'));
      if (currentIndex === index) return;
      const targetId = link.getAttribute('href').substring(1);
      const targetSection = document.getElementById(targetId);
      navigateToSection(targetSection, link);
    });
  });

  /* ----------------------------------------------------------
     Mobile hamburger menu
     ---------------------------------------------------------- */
  const hamburger = document.getElementById('navHamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuClose = document.getElementById('mobileMenuClose');
  const mobileMenuLinks = mobileMenu ? mobileMenu.querySelectorAll('a') : [];

  function openMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add('open');
    mobileMenu.setAttribute('aria-hidden', 'false');
    hamburger?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
  }
  function closeMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    hamburger?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  }

  hamburger?.addEventListener('click', () => {
    if (mobileMenu?.classList.contains('open')) closeMenu();
    else openMenu();
  });
  mobileMenuClose?.addEventListener('click', closeMenu);

  mobileMenuLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const targetSection = document.getElementById(targetId);
      closeMenu();
      // Small delay lets the overlay fade out before the scroll starts
      // so the destination isn't hidden behind the fading backdrop.
      setTimeout(() => {
        if (targetSection) {
          targetSection.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth'
          });
        }
      }, 200);
    });
  });

  // Close menu on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu?.classList.contains('open')) closeMenu();
  });

  // Keep the indicator hidden while the hero is active.
  if (window.scrollY < Math.max(window.innerHeight * 0.72, 420)) {
    clearActiveState();
  }

  // Scroll-position sync (only when not animating)
  const navObserver = new IntersectionObserver(
    () => {
      if (isAnimating) return;
      syncNavToPosition();
    },
    { threshold: 0.35 }
  );
  sections.forEach((sec) => navObserver.observe(sec));

  // Arrow-key navigation
  document.addEventListener('keydown', (e) => {
    if (isAnimating) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    // Don't hijack arrow keys while the user is typing in a form control.
    const active = document.activeElement;
    if (active && (active.matches('input, textarea, select, [contenteditable="true"]'))) return;

    const allSections = Array.from(document.querySelectorAll('section[id], .hero'));
    const currentSection = allSections.find((s) => {
      const rect = s.getBoundingClientRect();
      return rect.top >= -window.innerHeight / 2 && rect.top <= window.innerHeight / 2;
    });
    if (!currentSection) return;

    const currentIndex = allSections.indexOf(currentSection);
    let targetIndex = currentIndex;
    if (e.key === 'ArrowRight') targetIndex = Math.min(currentIndex + 1, allSections.length - 1);
    else if (e.key === 'ArrowLeft') targetIndex = Math.max(currentIndex - 1, 0);
    if (targetIndex === currentIndex) return;

    const targetSection = allSections[targetIndex];
    const targetId = targetSection.getAttribute('id');
    const targetLink = targetId
      ? Array.from(navLinks).find((l) => l.getAttribute('href') === '#' + targetId)
      : null;
    navigateToSection(targetSection, targetLink);
  });
})();
