import { authUI } from './pages/auth.js';
import { onboarding } from './pages/onboarding.js';
import { styles } from './pages/styles.js';
import { dashboard } from './pages/dashboard.js';
import { social } from './pages/social.js';
import { wardrobe } from './pages/wardrobe.js';
import { outfits } from './pages/outfits.js';
import { profile } from './pages/profile.js';

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';

    console.log(`%c[Router] Mevcut Sayfa: ${page}`, 'color: #75aadb; font-weight: bold;');

    try {
        switch (page) {
            case 'index.html':
            case 'login.html':
                authUI.init();
                break;
            case 'onboarding.html':
                onboarding.init();
                break;
            case 'styles.html':
                styles.init();
                break;
            case 'dashboard.html':
                dashboard.init();
                break;
            case 'social.html':
                social.init();
                break;
            case 'wardrobe.html':
                wardrobe.init();
                break;
            case 'outfits.html':
                outfits.init();
                break;
            case 'profile.html':
                profile.init();
                break;
            default:
                if (page === '' || path === '/') {
                    authUI.init();
                } else {
                    console.warn(`[Router] Bu sayfa için bir modül tanımlanmamış: ${page}`);
                }
                break;
        }
    } catch (error) {
        console.error(`[Router] ${page} modülü başlatılırken hata oluştu:`, error);
    }
});
