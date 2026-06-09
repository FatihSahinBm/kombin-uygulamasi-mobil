import { api } from '../api.js';
import { ui } from '../ui.js';
import { utils } from '../utils.js';

export const dashboard = {
    async init() {
        console.log("Redesigned Dashboard modülü yüklendi.");
        try {
            // Greeting text logic
            const greetingTextEl = document.getElementById('app-greeting-text');
            if (greetingTextEl) {
                const hour = new Date().getHours();
                let greeting = 'İyi akşamlar';
                if (hour < 12) greeting = 'Günaydın';
                else if (hour < 18) greeting = 'İyi günler';
                greetingTextEl.textContent = `${greeting} 👋`;
            }

            const user = await api.getUserProfile();
            ui.renderUserProfile(user);

            // Wardrobe count
            try {
                const wardrobe = await api.getWardrobeItems(user.id);
                ui.updateWardrobeCount(wardrobe.length, wardrobe);
            } catch (err) { 
                console.error("Gardırop yüklenemedi:", err); 
            }
            
            // Outfit count
            try {
                let outfitCount = await api.getOutfitsCount(user.id);
                if (outfitCount === 0) {
                    const history = utils.getData('kombin_history') || [];
                    outfitCount = history.length;
                }
                const appOutfitStat = document.getElementById('app-stat-outfit');
                if (appOutfitStat) appOutfitStat.textContent = outfitCount;
            } catch (err) {
                console.error("Kombin sayısı yüklenemedi:", err);
            }

            // Likes count
            try {
                const likedPosts = await api.getMyLikes();
                const likesCount = likedPosts ? likedPosts.length : 0;
                const appLikesStat = document.getElementById('app-stat-likes');
                if (appLikesStat) appLikesStat.textContent = likesCount;
            } catch (err) {
                console.error("Beğeni sayısı yüklenemedi:", err);
            }

            this.setupStyleChips();
        } catch (error) {
            console.error("Dashboard başlatılırken hata:", error);
        }
    },

    setupStyleChips() {
        const chips = document.querySelectorAll('.app-style-chip');
        const generateBtn = document.getElementById('app-generate-btn');
        const generateBtnText = document.getElementById('app-generate-btn-text');

        if (!chips.length) return;

        let activeStyle = 'casual';

        // Chip selection styles matching styles in React Native
        const styleDetails = {
            casual: { label: '👕 Günlük', activeClass: 'active-casual' },
            business: { label: '💼 İş', activeClass: 'active-business' },
            sport: { label: '🏃 Sportif', activeClass: 'active-sport' },
            streetwear: { label: '🧢 Sokak', activeClass: 'active-streetwear' },
            elegant: { label: '🌹 Şık', activeClass: 'active-elegant' }
        };

        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const styleKey = chip.getAttribute('data-style');
                if (!styleKey || !styleDetails[styleKey]) return;

                // Deactivate all chips
                chips.forEach(c => {
                    c.classList.remove('active');
                    const cKey = c.getAttribute('data-style');
                    if (cKey && styleDetails[cKey]) {
                        c.classList.remove(styleDetails[cKey].activeClass);
                    }
                });

                // Activate clicked chip
                chip.classList.add('active');
                chip.classList.add(styleDetails[styleKey].activeClass);

                activeStyle = styleKey;

                // Update button text
                if (generateBtnText) {
                    generateBtnText.textContent = `${styleDetails[styleKey].label} Kombin Oluştur 🔮`;
                }
            });
        });

        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                window.location.href = `outfits.html?style=${activeStyle}`;
            });
        }
    }
};
