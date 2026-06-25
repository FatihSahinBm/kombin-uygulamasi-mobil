/**
 * KOMBIN.AI — APP PAGE ANIMATION CONTROLLER
 * Orchestrates all creative animations on post-login pages.
 * Include this on: dashboard.html, wardrobe.html, social.html, outfits.html, profile.html
 */

const KombinAppAnimations = {

    // ─── Scroll Reveal Observer ───────────────────────────────────────
    initScrollReveal() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-revealed');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );

        document.querySelectorAll('.stagger-children').forEach(el => observer.observe(el));
        document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
    },

    // ─── Page Entry Animation ────────────────────────────────────────
    initPageEntry() {
        const main = document.querySelector('main') || document.querySelector('.main-container');
        if (main) {
            main.classList.add('page-enter');
        }
    },

    // ─── Wardrobe Door Opening Intro ─────────────────────────────────
    initWardrobeDoor() {
        const overlay = document.createElement('div');
        overlay.id = 'wardrobe-door-overlay';
        overlay.innerHTML = `
            <div id="wardrobe-door-left">
                <div class="door-inner-icon">👔</div>
            </div>
            <div id="wardrobe-door-right">
                <div class="door-inner-icon">👗</div>
            </div>
        `;
        document.body.prepend(overlay);

        requestAnimationFrame(() => {
            setTimeout(() => {
                overlay.classList.add('door-open');

                setTimeout(() => {
                    if (overlay) {
                        overlay.classList.add('door-hidden');
                        if (overlay.parentNode) {
                            overlay.parentNode.removeChild(overlay);
                        }
                    }
                    KombinAppAnimations.animateWardrobeItemsDeferred();
                }, 1100);
            }, 500);
        });
    },

    // ─── Wardrobe Items Pop In (staggered) ───────────────────────────
    animateWardrobeItemsDeferred() {
        // Wait for JS to potentially load items
        setTimeout(() => {
            KombinAppAnimations.animateWardrobeItems();
        }, 400);
    },

    animateWardrobeItems() {
        const items = document.querySelectorAll('#wardrobe-list .card');
        items.forEach((item, i) => {
            item.style.opacity = '0';
            item.style.transform = 'scale(0.75) translateY(20px)';
            item.style.transition = 'none';
            setTimeout(() => {
                item.style.transition = `opacity 0.45s cubic-bezier(0.34,1.56,0.64,1), transform 0.45s cubic-bezier(0.34,1.56,0.64,1)`;
                item.style.opacity = '1';
                item.style.transform = 'scale(1) translateY(0)';
            }, 80 + i * 70);
        });
    },

    // ─── Social Feed — Cascade Items In ─────────────────────────────
    initSocialFeed() {
        const header = document.querySelector('main header');
        if (header) header.classList.add('feed-header-reveal');

        const feedContainer = document.getElementById('social-feed-container');
        if (!feedContainer) return;

        let revealed = new Set();
        const revealItem = (item, delay) => {
            if (revealed.has(item)) return;
            revealed.add(item);
            item.style.opacity = '0';
            item.style.transform = 'translateY(22px) scale(0.96)';
            item.style.transition = 'none';
            setTimeout(() => {
                item.style.transition = 'opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0) scale(1)';
            }, delay);
        };

        const feedObserver = new MutationObserver(() => {
            const items = feedContainer.querySelectorAll('.feed-item');
            items.forEach((item, i) => {
                revealItem(item, i * 55);
            });
        });

        feedObserver.observe(feedContainer, { childList: true, subtree: true });

        // Also check existing items
        const existing = feedContainer.querySelectorAll('.feed-item');
        existing.forEach((item, i) => revealItem(item, i * 55));
    },

    // ─── Outfits Page — AI Sparkle + Card Reveal ─────────────────────
    initOutfitsPage() {
        const cards = document.querySelectorAll('main .card');
        if (cards[0]) {
            cards[0].style.animation = 'outfitFormIn 0.65s cubic-bezier(0.16,1,0.3,1) 0.1s both';
        }
        if (cards[1]) {
            cards[1].style.animation = 'outfitResultIn 0.65s cubic-bezier(0.16,1,0.3,1) 0.25s both';
        }

        // Add sparkle to all primary buttons
        document.querySelectorAll('.btn-primary').forEach(btn => {
            btn.addEventListener('click', () => {
                KombinAppAnimations.createSparkles(btn);
            });
        });
    },

    // ─── Sparkle Particles on Button Click ───────────────────────────
    createSparkles(btn) {
        const colors = ['#75aadb', '#a5d3b8', '#f43f5e', '#febc2e', '#c084fc', '#93c6e7'];
        const rect = btn.getBoundingClientRect();

        for (let i = 0; i < 14; i++) {
            const particle = document.createElement('div');
            const size = 4 + Math.random() * 7;
            particle.style.cssText = `
                position: fixed;
                width: ${size}px;
                height: ${size}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
                left: ${rect.left + rect.width / 2}px;
                top: ${rect.top + rect.height / 2}px;
            `;

            const angle = (i / 14) * Math.PI * 2;
            const distance = 40 + Math.random() * 70;
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance;
            const duration = 550 + Math.random() * 350;

            document.body.appendChild(particle);

            particle.animate([
                { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
                { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)` }
            ], {
                duration,
                easing: 'cubic-bezier(0, 0.9, 0.57, 1)',
                fill: 'both'
            }).onfinish = () => particle.remove();
        }
    },

    // ─── Profile Page ────────────────────────────────────────────────
    initProfilePage() {
        // Delay to allow DOM to populate from JS
        setTimeout(() => {
            const avatar = document.getElementById('profile-avatar');
            const meta = document.querySelector('.profile-meta');
            const grid = document.getElementById('profile-grid');

            if (avatar) avatar.classList.add('profile-avatar-enter');
            if (meta) meta.classList.add('profile-meta-enter');
            if (grid) grid.classList.add('profile-grid-enter');

            // Trigger feed items animate
            if (grid) {
                const items = grid.querySelectorAll('.feed-item');
                items.forEach((item, i) => {
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(18px) scale(0.95)';
                    item.style.transition = 'none';
                    setTimeout(() => {
                        item.style.transition = 'opacity 0.45s cubic-bezier(0.16,1,0.3,1), transform 0.45s cubic-bezier(0.16,1,0.3,1)';
                        item.style.opacity = '1';
                        item.style.transform = 'none';
                    }, 100 + i * 60);
                });
            }
        }, 600);

        // Stats hover ripple
        document.querySelectorAll('.profile-stat').forEach(stat => {
            stat.addEventListener('click', (e) => {
                KombinAppAnimations.createRipple(stat, e);
            });
        });
    },

    // ─── Ripple on Click ─────────────────────────────────────────────
    createRipple(element, event) {
        const rect = element.getBoundingClientRect();
        const ripple = document.createElement('div');
        const size = Math.max(rect.width, rect.height) * 2.5;
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: rgba(117, 170, 219, 0.25);
            left: ${x}px;
            top: ${y}px;
            pointer-events: none;
            transform: scale(0);
            z-index: 1;
        `;
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);

        ripple.animate(
            [{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(1)', opacity: 0 }],
            { duration: 600, easing: 'ease-out' }
        ).onfinish = () => ripple.remove();
    },

    // ─── Dashboard ───────────────────────────────────────────────────
    initDashboard() {
        // Count-up for wardrobe stat
        const statEl = document.getElementById('wardrobe-count');
        if (statEl) {
            // Wait for JS to populate
            const origObserver = new MutationObserver(() => {
                const target = parseInt(statEl.textContent) || 0;
                if (target > 0) {
                    origObserver.disconnect();
                    KombinAppAnimations.countUp(statEl, 0, target, 900);
                }
            });
            origObserver.observe(statEl, { childList: true, characterData: true, subtree: true });
        }

        // Sparkle on CTA button
        const createBtn = document.getElementById('create-outfit-trigger');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                KombinAppAnimations.createSparkles(createBtn);
            });
        }

        // Pulse the daily outfit card on load
        const dailyHero = document.querySelector('.daily-hero');
        if (dailyHero) {
            dailyHero.style.animation = 'heroSlideIn 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both';
        }
    },

    // ─── Count Up Animation ───────────────────────────────────────────
    countUp(element, start, end, duration) {
        if (end === 0 || isNaN(end)) return;
        const startTime = performance.now();
        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            element.textContent = Math.floor(start + (end - start) * eased);
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    },

    // ─── Master Init ─────────────────────────────────────────────────
    init() {
        const pathname = window.location.pathname;

        // Always run
        KombinAppAnimations.initPageEntry();
        KombinAppAnimations.initScrollReveal();

        // Add ripple to all buttons
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                KombinAppAnimations.createSparkles(btn);
            });
        });

        // Page-specific
        if (pathname.includes('wardrobe')) {
            KombinAppAnimations.initWardrobeDoor();
        }
        if (pathname.includes('social')) {
            KombinAppAnimations.initSocialFeed();
        }
        if (pathname.includes('outfits')) {
            KombinAppAnimations.initOutfitsPage();
        }
        if (pathname.includes('profile')) {
            KombinAppAnimations.initProfilePage();
        }
        if (pathname.includes('dashboard')) {
            KombinAppAnimations.initDashboard();
        }

        // Feed animations on any page with social feed container
        if (document.getElementById('social-feed-container') && !pathname.includes('social')) {
            KombinAppAnimations.initSocialFeed();
        }

        // MutationObserver for wardrobe items on wardrobe page
        if (pathname.includes('wardrobe')) {
            const wardrobeList = document.getElementById('wardrobe-list');
            if (wardrobeList) {
                const wardrobeObserver = new MutationObserver(() => {
                    setTimeout(() => KombinAppAnimations.animateWardrobeItems(), 100);
                });
                wardrobeObserver.observe(wardrobeList, { childList: true });
            }
        }

        // Profile page: observe profile-grid for new items
        if (pathname.includes('profile')) {
            const profileGrid = document.getElementById('profile-grid');
            if (profileGrid) {
                const profileObserver = new MutationObserver(() => {
                    const items = profileGrid.querySelectorAll('.feed-item');
                    items.forEach((item, i) => {
                        if (item.style.opacity === '1') return;
                        item.style.opacity = '0';
                        item.style.transform = 'translateY(18px) scale(0.95)';
                        item.style.transition = 'none';
                        setTimeout(() => {
                            item.style.transition = 'opacity 0.45s cubic-bezier(0.16,1,0.3,1), transform 0.45s cubic-bezier(0.16,1,0.3,1)';
                            item.style.opacity = '1';
                            item.style.transform = 'none';
                        }, i * 60);
                    });
                });
                profileObserver.observe(profileGrid, { childList: true });
            }
        }
    }
};

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => KombinAppAnimations.init());
} else {
    KombinAppAnimations.init();
}
