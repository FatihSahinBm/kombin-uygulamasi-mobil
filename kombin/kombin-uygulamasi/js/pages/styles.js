import { CONFIG } from '../config.js';
import { utils } from '../utils.js';
import { ui } from '../ui.js';
import { api } from '../api.js';

export const styles = {
    async init() {
        console.log("Stil Seçimi modülü yüklendi.");
        const galleryContainer = document.getElementById('styleGallery');
        const btnFinish = document.getElementById('btnFinish');
        const btnBackToAuth = document.getElementById('btnBackToAuth');
        
        let selectedStyles = [];

        try {
            const userProfile = await api.getUserProfile();
            if (userProfile && userProfile.preferences && userProfile.preferences.style) {
                // Style string format: "Dark Academia, Business Guy" vb.
                selectedStyles = userProfile.preferences.style.split(',').map(s => s.trim()).filter(s => s);
            }
        } catch(err) {
            console.log("Mevcut stiller yüklenemedi:", err);
        }

        const storedUserInfo = utils.getData(CONFIG.STORAGE_KEY_USERINFO) || {};
        const userGender = storedUserInfo.gender || 'erkek';

        const stylesDataErkek = [
            { id: 'dark-academia', name: 'Dark Academia', img: 'kombinFotoErkek/12. Dark Academia (2).png' },
            { id: 'business', name: 'Business Guy', img: 'kombinFotoErkek/Business Guy (2).png' },
            { id: 'clean-look', name: 'Clean Look', img: 'kombinFotoErkek/Clean Boy  Clean Look (2).png' },
            { id: 'e-boy', name: 'E Boy', img: 'kombinFotoErkek/E boy (2).png' },
            { id: 'minimalist', name: 'Minimalist', img: 'kombinFotoErkek/Minimalist (2).png' },
            { id: 'rock-rebel', name: 'Rock Rebel', img: 'kombinFotoErkek/Rock  Rebel (2).png' },
            { id: 'streetwear', name: 'Streetwear', img: 'kombinFotoErkek/Streetwear Boy (2).png' },
            { id: 'badboy', name: 'Bad Boy', img: 'kombinFotoErkek/badboy (2).png' },
            { id: 'gym-bro', name: 'Gym Bro', img: 'kombinFotoErkek/gym bro bo (2).png' },
            { id: 'oldmoney', name: 'Old Money', img: 'kombinFotoErkek/oldmany (2).png' },
            { id: 'softboy', name: 'Soft Boy', img: 'kombinFotoErkek/softboy (2).png' },
            { id: 'summer', name: 'Summer Boy', img: 'kombinFotoErkek/summer boy (2).png' }
        ];

        const stylesDataKadin = [
            { id: 'dark-academia', name: 'Dark Academia', img: 'erkek hali fotoğraflar/kombinFotoKız/Dark Academia.png' },
            { id: 'business', name: 'Business Casual', img: 'erkek hali fotoğraflar/kombinFotoKız/Business Casual.png' },
            { id: 'minimalist', name: 'Minimalist', img: 'erkek hali fotoğraflar/kombinFotoKız/Minimalist.png' },
            { id: 'streetwear', name: 'Streetwear', img: 'erkek hali fotoğraflar/kombinFotoKız/Streetwear.png' },
            { id: 'bohemian', name: 'Bohemian', img: 'erkek hali fotoğraflar/kombinFotoKız/Bohemian.png' },
            { id: 'y2k', name: 'Y2K', img: 'erkek hali fotoğraflar/kombinFotoKız/Y2K.png' },
            { id: 'soft-girl', name: 'Soft Girl', img: 'erkek hali fotoğraflar/kombinFotoKız/Soft Girl.png' },
            { id: 'gym-sporty', name: 'Gym Sporty', img: 'erkek hali fotoğraflar/kombinFotoKız/Gym Sporty.png' }
        ];

        const stylesData = userGender === 'kadin' ? stylesDataKadin : stylesDataErkek;

        if (btnBackToAuth) {
            btnBackToAuth.addEventListener('click', () => {
                window.location.href = 'onboarding.html';
            });
        }

        if (galleryContainer) {
            stylesData.forEach(style => {
                const card = document.createElement('div');
                card.className = 'style-card fade-in';
                if (selectedStyles.includes(style.name)) {
                    card.classList.add('selected');
                }
                card.dataset.id = style.id;
                card.dataset.name = style.name;

                card.innerHTML = `
                    <img src="${style.img}" alt="${style.name}" loading="lazy">
                    <div class="overlay">${style.name}</div>
                `;

                card.addEventListener('click', () => {
                    card.classList.toggle('selected');
                    if (card.classList.contains('selected')) {
                        if (!selectedStyles.includes(style.name)) selectedStyles.push(style.name);
                    } else {
                        selectedStyles = selectedStyles.filter(s => s !== style.name);
                    }
                    ui.setButtonState(btnFinish, selectedStyles.length > 0);
                });

                galleryContainer.appendChild(card);
            });
            
            // Eğer önceden seçilmiş varsa butonu hemen aktifleştir
            if (selectedStyles.length > 0) {
                ui.setButtonState(btnFinish, true);
            }
        }

        if (btnFinish) {
            btnFinish.addEventListener('click', async () => {
                if (selectedStyles.length === 0) return;

                const defaultText = btnFinish.innerHTML;
                btnFinish.innerHTML = 'Kaydınız yapılıyor...';
                ui.setButtonState(btnFinish, false);

                const storedUserInfo = utils.getData(CONFIG.STORAGE_KEY_USERINFO) || {};
                const finalData = { ...storedUserInfo, preferredStyles: selectedStyles };

                try {
                    // Tüm verileri (boy, kilo, tarz vb.) tek seferde preferences üzerinden gönderiyoruz
                    const resPref = await api.savePreferences(finalData);
                    
                    if(resPref.success) {
                        alert("Kaydınız başarıyla tamamlandı! Kilonuz, boyunuz, ten renginiz ve tarzınız analiz edildi.");
                        btnFinish.innerHTML = 'Tamamlandı! ✨';
                        window.location.href = 'dashboard.html';
                    }
                } catch (error) {
                    console.error("Kayıt sırasında hata:", error);
                    alert("Hata oluştu: " + error.message);
                    btnFinish.innerHTML = defaultText;
                    ui.setButtonState(btnFinish, true);
                }
            });
        }
    }
};
