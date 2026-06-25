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
                ui.renderSocialFeed(feed.slice(0, 4));
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
            this.setupAIRater();
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
    },

    setupAIRater() {
        const uploadZone = document.getElementById('ai-rater-upload-zone');
        const fileInput = document.getElementById('ai-rater-file-input');
        const previewContainer = document.getElementById('ai-rater-preview-container');
        const previewImg = document.getElementById('ai-rater-preview-img');
        const removeBtn = document.getElementById('ai-rater-remove-btn');
        const submitBtn = document.getElementById('ai-rater-submit-btn');
        const loadingState = document.getElementById('ai-rater-loading');
        const resultArea = document.getElementById('ai-rater-result');
        const resetBtn = document.getElementById('ai-rater-reset-btn');
        
        const scoreVal = document.getElementById('ai-rater-score');
        const prosList = document.getElementById('ai-rater-pros');
        const consList = document.getElementById('ai-rater-cons');
        const suggestionsList = document.getElementById('ai-rater-suggestions');
        
        const shareBtn = document.getElementById('ai-rater-share-btn');
        const addBtn = document.getElementById('ai-rater-add-btn');

        let selectedFile = null;
        let ratingResult = null;

        if (!uploadZone) return;

        // Click zone to open file dialog
        uploadZone.addEventListener('click', () => fileInput.click());

        // Handle Drag & Drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--primary-color)';
            uploadZone.style.background = 'rgba(99, 102, 241, 0.05)';
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.style.borderColor = 'var(--border-color)';
            uploadZone.style.background = 'rgba(117,170,219,0.02)';
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--border-color)';
            uploadZone.style.background = 'rgba(117,170,219,0.02)';
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });

        const handleFile = (file) => {
            if (!file.type.startsWith('image/')) {
                alert('Lütfen sadece resim dosyası yükleyin.');
                return;
            }
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                uploadZone.style.display = 'none';
                previewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        };

        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetRater();
        });

        const resetRater = () => {
            selectedFile = null;
            ratingResult = null;
            fileInput.value = '';
            previewImg.src = '';
            previewContainer.style.display = 'none';
            loadingState.style.display = 'none';
            resultArea.style.display = 'none';
            uploadZone.style.display = 'flex';
            
            // Restore button text
            shareBtn.innerHTML = '📤 Akışta Paylaş';
            shareBtn.disabled = false;
            addBtn.innerHTML = 'Dolaba Ekle';
            addBtn.disabled = false;
        };

        resetBtn.addEventListener('click', resetRater);

        // Submit to AI
        submitBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            previewContainer.style.display = 'none';
            loadingState.style.display = 'block';

            // Loading texts animation
            const loadingTexts = [
                "Yapay Zeka kombinin renk uyumunu inceliyor...",
                "Parçaların tarz uyumu analiz ediliyor...",
                "Aksesuar ve ayakkabı dengesi ölçülüyor...",
                "Moda kriterlerine göre 10 üzerinden puan hesaplanıyor..."
            ];
            let textIdx = 0;
            const textElement = document.getElementById('ai-rater-loading-text');
            const textInterval = setInterval(() => {
                textIdx = (textIdx + 1) % loadingTexts.length;
                if (textElement) textElement.textContent = loadingTexts[textIdx];
            }, 2500);

            try {
                // Convert to base64
                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = (err) => reject(err);
                    reader.readAsDataURL(selectedFile);
                });

                ratingResult = await api.rateOutfit(base64Data, selectedFile.type);

                // Render result
                scoreVal.textContent = ratingResult.score.toFixed(1);
                
                prosList.innerHTML = ratingResult.pros.map(p => `<li style="margin-bottom: 0.25rem;">${p}</li>`).join('');
                consList.innerHTML = ratingResult.cons.map(c => `<li style="margin-bottom: 0.25rem;">${c}</li>`).join('');
                suggestionsList.innerHTML = ratingResult.suggestions.map(s => `<li style="margin-bottom: 0.25rem;">${s}</li>`).join('');
                
                loadingState.style.display = 'none';
                resultArea.style.display = 'block';
            } catch (err) {
                console.error("Puanlama sırasında hata:", err);
                alert("Kombin puanlanırken bir hata oluştu: " + err.message);
                resetRater();
            } finally {
                clearInterval(textInterval);
            }
        });

        // Add to Wardrobe
        addBtn.addEventListener('click', async () => {
            if (!selectedFile || !ratingResult) return;
            addBtn.innerHTML = '⚡ Ekleniyor...';
            addBtn.disabled = true;

            try {
                // 1. Upload image to wardrobe_images bucket
                const imageUrl = await api.uploadImage(selectedFile, 'wardrobe_images');
                
                // 2. Add as item in wardrobe
                await api.addWardrobeItem({
                    category: 'Kombin',
                    name: `AI Puanlı Kombin (${ratingResult.score.toFixed(1)}/10)`,
                    color: 'Karışık',
                    image_url: imageUrl,
                    attributes: {
                        score: ratingResult.score,
                        ai_rated: true,
                        pros: ratingResult.pros,
                        cons: ratingResult.cons,
                        suggestions: ratingResult.suggestions
                    }
                });

                addBtn.innerHTML = '✅ Dolaba Eklendi';
                
                // Update wardrobe count on dashboard
                try {
                    const user = await api.getUserProfile();
                    const wardrobe = await api.getWardrobeItems(user.id);
                    ui.updateWardrobeCount(wardrobe.length, wardrobe);
                } catch(e) {
                    console.warn("Sayı güncellenemedi:", e);
                }
            } catch (err) {
                console.error("Gardıroba eklenirken hata:", err);
                alert("Gardıroba eklenirken hata oluştu: " + err.message);
                addBtn.innerHTML = 'Dolaba Ekle';
                addBtn.disabled = false;
            }
        });

        // Share to Social Feed
        shareBtn.addEventListener('click', async () => {
            if (!selectedFile || !ratingResult) return;
            shareBtn.innerHTML = '⚡ Paylaşılıyor...';
            shareBtn.disabled = true;

            try {
                // 1. Upload image to social_images
                const imageUrl = await api.uploadImage(selectedFile, 'social_images');

                // 2. Share
                await api.shareOutfit({
                    image: imageUrl,
                    description: `#AIKombinPuanı [Puan: ${ratingResult.score.toFixed(1)}/10] Yapay zeka bu kombine ${ratingResult.score.toFixed(1)} verdi! 🌟`
                });

                shareBtn.innerHTML = '✅ Akışta Paylaşıldı';
                
                // Refresh dashboard social feed slice if visible
                try {
                    const feed = await api.getSocialFeed();
                    ui.renderSocialFeed(feed.slice(0, 4));
                } catch(e) {
                    console.warn("Akış yenilenemedi:", e);
                }
            } catch (err) {
                console.error("Sosyal akışta paylaşılırken hata:", err);
                alert("Paylaşılırken hata oluştu: " + err.message);
                shareBtn.innerHTML = '📤 Akışta Paylaş';
                shareBtn.disabled = false;
            }
        });
    }
};
