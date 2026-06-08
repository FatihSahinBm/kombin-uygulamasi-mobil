import { api } from '../api.js';
import { ui } from '../ui.js';
import { utils } from '../utils.js';

export const dashboard = {
    async init() {
        console.log("Dashboard modülü yüklendi.");
        try {
            const user = await api.getUserProfile();
            ui.renderUserProfile(user);

            // Bireysel hata yakalama blokları, biri çökerse diğeri etkilenmez
            try {
                const wardrobe = await api.getWardrobeItems(user.id);
                ui.updateWardrobeCount(wardrobe.length, wardrobe);
            } catch (err) { console.error("Gardırop yüklenemedi:", err); }
            
            try {
                const feed = await api.getSocialFeed();
                ui.renderSocialFeed(feed);
            } catch (err) { console.error("Sosyal akış yüklenemedi:", err); }

            // Şehirleri doldur
            ui.populateCities('dashboard-city-list');

            // Dinamik Şehir ve Günün Kombini Mantığı
            const citySelect = document.getElementById('dashboard-city-select');
            
            const loadDailyOutfit = async (city) => {
                try {
                    ui.getElements().weatherInfo.innerHTML = "Yükleniyor...";
                    const weather = await api.getWeather(city);
                    ui.renderWeather(weather);

                    const userStyle = (user && user.preferences && user.preferences.style) || 'casual';
                    const userGender = (user && user.preferences && user.preferences.gender) || 'Bilinmiyor';
                    
                    const uMeta = (user && user.metadata) || {};
                    const physicalTraits = `Cinsiyet: ${userGender}, Yaş: ${uMeta.age || 'Bilinmiyor'}, Boy: ${uMeta.height || '-'}cm, Kilo: ${uMeta.weight || '-'}kg, Vücut Tipi: ${uMeta.bodyType || 'Bilinmiyor'}, Ten: ${uMeta.skinTone || 'Bilinmiyor'}, Saç Rengi: ${uMeta.hairColor || 'Bilinmiyor'}, Göz Rengi: ${uMeta.eyeColor || 'Bilinmiyor'}`;

                    const dailyOutfitParams = { 
                        style: userStyle, 
                        gender: userGender,
                        budget: 3, 
                        weatherCondition: weather ? weather.condition : 'Normal',
                        weatherTemp: weather ? weather.temp : 20,
                        weatherWind: weather ? weather.wind : 0,
                        physicalTraits: physicalTraits
                    };
                    
                    const displayArea = document.getElementById('daily-outfit-display');
                    if (displayArea) displayArea.innerHTML = '<div class="spinner"></div><p>Rüzgara Göre Yeniden Kombinleniyor...</p>';
                    
                    const dailyOutfit = await api.generateOutfitIdea(dailyOutfitParams);
                    ui.renderDailyOutfit(dailyOutfit);
                } catch (err) {
                    console.error("Günün Kombini yüklenemedi:", err);
                    const displayArea = document.getElementById('daily-outfit-display');
                    if (displayArea) displayArea.innerHTML = '<p style="color:red;">Kombin yüklenemedi.</p>';
                    ui.getElements().weatherInfo.innerHTML = "Hata";
                }
            };

            if (citySelect) {
                // Şehri LS'den veya varsayılan tut
                const storedCity = utils.getData('preferred_city') || 'Istanbul';
                citySelect.value = storedCity;
                
                await loadDailyOutfit(citySelect.value);
                
                // Kullanıcı şehir değiştirdiğinde
                citySelect.addEventListener('change', async (e) => {
                    utils.saveData('preferred_city', e.target.value);
                    await loadDailyOutfit(e.target.value);
                });
            } else {
                await loadDailyOutfit('Istanbul');
            }

            this.setupEvents();
        } catch (error) {
            console.error("Dashboard başlatılırken hata:", error);
        }
    },

    setupEvents() {
        const elements = ui.getElements();

        // Mobil Menü
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');
        if (mobileMenuBtn && navLinks) {
            mobileMenuBtn.addEventListener('click', () => {
                const isOpen = navLinks.style.display === 'flex';
                if (isOpen) {
                    navLinks.style.display = 'none';
                } else {
                    navLinks.style.display = 'flex';
                    navLinks.style.flexDirection = 'column';
                    navLinks.style.position = 'absolute';
                    navLinks.style.top = '100%';
                    navLinks.style.left = '0';
                    navLinks.style.width = '100%';
                    navLinks.style.backgroundColor = 'var(--surface-color)';
                    navLinks.style.padding = '1rem';
                    navLinks.style.boxShadow = 'var(--shadow-md)';
                    navLinks.style.zIndex = '1000';
                }
            });
        }
    }
};
