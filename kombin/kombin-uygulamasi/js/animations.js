/**
 * Kombin.AI — Premium Animation Engine
 * Scroll Reveal · Magnetic Buttons · Parallax · Cursor Glow
 */

/* ─── 1. SCROLL REVEAL ─────────────────────────────────────────── */
export function initScrollReveal() {
  const els = document.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale');

  if (!els.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger delay based on sibling index
          const siblings = entry.target.parentElement
            ? [...entry.target.parentElement.children]
            : [];
          const idx = siblings.indexOf(entry.target);
          const delay = idx * 80;

          setTimeout(() => {
            entry.target.classList.add('revealed');
          }, delay);

          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  els.forEach((el) => observer.observe(el));
}

/* ─── 2. MAGNETIC BUTTONS ──────────────────────────────────────── */
export function initMagneticButtons() {
  const buttons = document.querySelectorAll('.btn-magnetic, .btn-primary, .btn-outline');

  buttons.forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const strength = 0.35;
      btn.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
      setTimeout(() => {
        btn.style.transition = '';
      }, 500);
    });
  });
}

/* ─── 3. PARALLAX ──────────────────────────────────────────────── */
export function initParallax() {
  const layers = document.querySelectorAll('[data-parallax]');
  if (!layers.length) return;

  let rafId = null;
  let mouseX = 0;
  let mouseY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        layers.forEach((el) => {
          const depth = parseFloat(el.dataset.parallax) || 10;
          el.style.transform = `translate(${mouseX * depth}px, ${mouseY * depth}px)`;
        });
        rafId = null;
      });
    }
  });
}

/* ─── 4. CURSOR GLOW ───────────────────────────────────────────── */
export function initCursorGlow() {
  // Only on non-touch devices
  if (window.matchMedia('(hover: none)').matches) return;

  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.appendChild(glow);

  let cx = -200;
  let cy = -200;
  let targetX = -200;
  let targetY = -200;

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  function animate() {
    cx += (targetX - cx) * 0.1;
    cy += (targetY - cy) * 0.1;
    glow.style.left = cx + 'px';
    glow.style.top = cy + 'px';
    requestAnimationFrame(animate);
  }
  animate();

  // Expand on hoverable elements
  document.querySelectorAll('a, button, [role="button"]').forEach((el) => {
    el.addEventListener('mouseenter', () => glow.classList.add('cursor-glow--expand'));
    el.addEventListener('mouseleave', () => glow.classList.remove('cursor-glow--expand'));
  });
}

/* ─── 5. FLOATING PARTICLES (Hero) ─────────────────────────────── */
export function initHeroParticles(containerId = 'heroParticles') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const COUNT = 18;
  const COLORS = ['#75aadb', '#a5d3b8', '#93c6e7', '#c4e0f9', '#b2dac5'];

  for (let i = 0; i < COUNT; i++) {
    const p = document.createElement('span');
    p.className = 'hero-particle';

    const size = Math.random() * 6 + 3;
    const x = Math.random() * 100;
    const delay = Math.random() * 8;
    const duration = Math.random() * 10 + 12;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    Object.assign(p.style, {
      width: size + 'px',
      height: size + 'px',
      left: x + '%',
      bottom: '-10px',
      background: color,
      animationDelay: delay + 's',
      animationDuration: duration + 's',
      opacity: Math.random() * 0.5 + 0.2,
    });

    container.appendChild(p);
  }
}

/* ─── 6. NAV SCROLL BLUR ────────────────────────────────────────── */
export function initNavScroll() {
  const nav = document.querySelector('nav, .navbar');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      nav.classList.add('nav-scrolled');
    } else {
      nav.classList.remove('nav-scrolled');
    }
  }, { passive: true });
}

/* ─── 7. STAGGER CARD ANIMATION ────────────────────────────────── */
export function initFeatureCards() {
  const cards = document.querySelectorAll('.feature-card');
  if (!cards.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const siblings = [...entry.target.parentElement.children];
          const idx = siblings.indexOf(entry.target);
          setTimeout(() => {
            entry.target.classList.add('card-revealed');
          }, idx * 120);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  cards.forEach((card) => observer.observe(card));
}

/* ─── INIT ALL ──────────────────────────────────────────────────── */
export function initAllAnimations() {
  initScrollReveal();
  initMagneticButtons();
  initParallax();
  initCursorGlow();
  initHeroParticles();
  initNavScroll();
  initFeatureCards();
}
