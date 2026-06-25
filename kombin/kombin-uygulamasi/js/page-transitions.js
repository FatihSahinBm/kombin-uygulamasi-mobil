/**
 * Kombin.AI — Sayfa Geçiş Sistemi
 * Clip-path wipe + fade ile sayfalar arası smooth geçiş
 */

const TRANSITION_DURATION = 420;

/* ─── Overlay oluştur ──────────────────────────────────────────── */
function createOverlay() {
  if (document.getElementById('pt-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'pt-overlay';
  overlay.innerHTML = `
    <div class="pt-logo">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
        <path d="M10 16 L16 10 L22 16 L16 22 Z" fill="rgba(255,255,255,0.9)"/>
      </svg>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #pt-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      clip-path: circle(0% at 50% 50%);
      transition: clip-path ${TRANSITION_DURATION}ms cubic-bezier(0.76, 0, 0.24, 1);
    }

    #pt-overlay.pt-enter {
      clip-path: circle(150% at 50% 50%);
      pointer-events: all;
    }

    #pt-overlay.pt-exit {
      clip-path: circle(0% at 50% 50%);
      pointer-events: none;
    }

    .pt-logo {
      opacity: 0;
      transform: scale(0.6) rotate(-10deg);
      transition: opacity 0.2s ease 0.1s, transform 0.3s cubic-bezier(0.34,1.56,0.64,1) 0.1s;
    }

    #pt-overlay.pt-enter .pt-logo {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);
}

/* ─── Geçiş çalıştır ───────────────────────────────────────────── */
function transitionTo(href, originEl) {
  const overlay = document.getElementById('pt-overlay');
  if (!overlay) {
    // Fallback: direkt git
    window.location.href = href;
    return;
  }

  // Origin element'in merkezini belirle
  let cx = 50, cy = 50;
  if (originEl) {
    const rect = originEl.getBoundingClientRect();
    cx = ((rect.left + rect.width / 2) / window.innerWidth * 100).toFixed(1);
    cy = ((rect.top + rect.height / 2) / window.innerHeight * 100).toFixed(1);
  }

  // Başlangıç konumu
  overlay.style.transition = 'none';
  overlay.style.clipPath = `circle(0% at ${cx}% ${cy}%)`;

  // Force reflow
  void overlay.offsetHeight;

  // Animasyonu başlat
  overlay.style.transition = `clip-path ${TRANSITION_DURATION}ms cubic-bezier(0.76, 0, 0.24, 1)`;
  overlay.style.clipPath = `circle(160% at ${cx}% ${cy}%)`;
  overlay.style.pointerEvents = 'all';

  // Yeni sayfaya geç
  setTimeout(() => {
    window.location.href = href;
  }, TRANSITION_DURATION - 40);
}

/* ─── Sayfa girişi (yeni sayfa yüklendiğinde) ──────────────────── */
function pageEnter() {
  const overlay = document.getElementById('pt-overlay');
  if (!overlay) return;

  overlay.classList.add('pt-enter');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.remove('pt-enter');
      overlay.classList.add('pt-exit');

      setTimeout(() => {
        overlay.classList.remove('pt-exit');
        overlay.style.clipPath = '';
      }, TRANSITION_DURATION);
    });
  });
}

/* ─── Link'leri yakala ─────────────────────────────────────────── */
function interceptLinks() {
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');

    // Dış link, hash, mailto, tel, javascript: → atla
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:') ||
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      anchor.target === '_blank' ||
      anchor.hasAttribute('data-no-transition') ||
      e.metaKey ||
      e.ctrlKey
    ) {
      return;
    }

    e.preventDefault();
    transitionTo(href, anchor);
  });
}

/* ─── Init ─────────────────────────────────────────────────────── */
export function initPageTransitions() {
  createOverlay();
  interceptLinks();

  // Sayfa yüklenince "giriş" animasyonu
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pageEnter);
  } else {
    pageEnter();
  }
}

// Auto-init if not used as module
if (typeof window !== 'undefined') {
  if (document.currentScript && !document.currentScript.type?.includes('module')) {
    document.addEventListener('DOMContentLoaded', initPageTransitions);
  }
}
