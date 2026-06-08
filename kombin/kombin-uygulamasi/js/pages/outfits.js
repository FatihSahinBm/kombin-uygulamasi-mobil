import { api } from '../api.js';
import { ui } from '../ui.js';
import { utils } from '../utils.js';

export const outfits = {
    currentOutfit: null,
    
    async init() {
        console.log("Outfits modülü yüklendi.");
        
        const form = document.getElementById('outfit-page-form');
        const generateBtn = document.getElementById('generate-outfit-btn');
        const displayArea = document.getElementById('active-outfit-display');
        const actionsPanel = document.getElementById('outfit-actions');
        
        const btnSaveToWardrobe = document.getElementById('save-to-wardrobe-btn');
        const btnShareSocial = document.getElementById('share-social-btn');
        
        // 81 İli Yükle (Artık Datalist içine basılacak)
        ui.populateCities('outfit-city-list');
        
        // Şehri LS'den al (eğer dashboard'da falan seçildiyse eşleşsin)
        const storedCity = utils.getData('preferred_city') || 'Istanbul';
        const cityDropdown = document.getElementById('outfit-city');
        if (cityDropdown) cityDropdown.value = storedCity;
        
        this.renderHistory();

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const prevText = generateBtn.innerHTML;
                generateBtn.innerHTML = "✨ Hazırlanıyor...";
                generateBtn.disabled = true;
                
                const style = document.getElementById('style-select').value;
                const budgetMin = document.getElementById('budget-min')?.value || 0;
                const budgetMax = document.getElementById('budget-max')?.value || 5000;
                const source = document.getElementById('outfit-source')?.value || 'wardrobe';
                const colorPalette = document.getElementById('outfit-color-palette')?.value || '';
                
                if (source === 'mixed' && !this.mixedConfirmed) {
                    generateBtn.innerHTML = prevText;
                    generateBtn.disabled = false;
                    this.currentParams = { style, budgetMin, budgetMax, source, colorPalette, cityCode: document.getElementById('outfit-city')?.value || '' };
                    await this.openMixedModal();
                    return;
                }
                
                // If mixed source but already confirmed, use the fixed items
                const fixedItems = this.mixedConfirmed ? this.mixedSelectedItems : null;
                
                // Reset flag
                this.mixedConfirmed = false;

                const loadingMsg = source === 'wardrobe' 
                    ? 'Yapay Zeka Senin İçin Düşünüyor...' 
                    : '🔍 Yapay Zeka Sana Uygun Ürünler Arıyor...';
                displayArea.innerHTML = `<div class="spinner" style="margin: 3rem auto;"></div><p style="text-align:center;">${loadingMsg}</p>`;
                actionsPanel.style.display = 'none';
                
                let weatherCondition = 'Normal';
                let weatherTemp = '20';
                let weatherWind = 0;
                
                try {
                    // Kullanıcı tercihleri ve özelliklerini güvenli şekilde al
                    const userProfile = await api.getUserProfile();
                    
                    const cityCodeVal = document.getElementById('outfit-city')?.value || '';
                    if (cityCodeVal) {
                        const w = await api.getWeather(cityCodeVal); 
                        weatherCondition = w.condition || 'Yapay';
                        weatherTemp = w.temp || '20';
                        weatherWind = w.wind || 0;
                    }

                    const userGender = userProfile?.preferences?.gender || 'Bilinmiyor';
                    const uMeta = userProfile?.metadata || {};
                    const physicalTraits = `Cinsiyet: ${userGender}, Yaş: ${uMeta.age || 'Bilinmiyor'}, Boy: ${uMeta.height || '-'}cm, Kilo: ${uMeta.weight || '-'}kg, Vücut Tipi: ${uMeta.bodyType || 'Bilinmiyor'}, Ten: ${uMeta.skinTone || 'Bilinmiyor'}, Saç Rengi: ${uMeta.hairColor || 'Bilinmiyor'}, Göz Rengi: ${uMeta.eyeColor || 'Bilinmiyor'}`;

                    const params = {
                        style: style,
                        minBudget: budgetMin,
                        maxBudget: budgetMax,
                        source: source,
                        colorPalette: colorPalette,
                        weatherCondition: weatherCondition,
                        weatherTemp: weatherTemp,
                        weatherWind: weatherWind,
                        gender: userGender,
                        physicalTraits: physicalTraits,
                        fixedItems: fixedItems
                    };

                    let result;
                    
                    if (source === 'external' || source === 'mixed') {
                        const aiResponse = await api.generateOutfitFromAI(params);
                        result = {
                            title: "✨ Yapay Zeka Önerisi",
                            description: aiResponse.reasoning || "Bu kombin tamamen sizin profilinize ve kriterlerinize göre tasarlandı.",
                            items: [
                                { name: aiResponse.top, type: "Üst Giyim", source: "external", price: "AI", _scraped: false, image_prompt: aiResponse.top_prompt },
                                { name: aiResponse.bottom, type: "Alt Giyim", source: "external", price: "AI", _scraped: false, image_prompt: aiResponse.bottom_prompt },
                                { name: aiResponse.shoes, type: "Ayakkabı", source: "external", price: "AI", _scraped: false, image_prompt: aiResponse.shoes_prompt }
                            ]
                        };
                        // Dış giyim ve aksesuar AI tarafından dönerse ekle
                        if (aiResponse.outerwear) result.items.push({ name: aiResponse.outerwear, type: "Dış Giyim", source: "external", price: "AI", image_prompt: aiResponse.outerwear_prompt });
                        if (aiResponse.accessory) result.items.push({ name: aiResponse.accessory, type: "Aksesuar", source: "external", price: "AI", image_prompt: aiResponse.accessory_prompt });
                        
                        // Mixed modunda fixed (gardırop) öğelerini dışarıdan değil, gardıroptan geldiğini işaretleyelim
                        if (source === 'mixed' && fixedItems) {
                            result.items.forEach(item => {
                                // Find matching category
                                const fixedMatch = Object.entries(fixedItems).find(([cat, val]) => val && cat.toLowerCase() === item.type.toLowerCase());
                                if (fixedMatch) {
                                    item.source = 'wardrobe';
                                    item.name = fixedMatch[1].name;
                                    item.image_url = fixedMatch[1].image_url;
                                }
                            });
                        }
                    } else {
                        // Gardıroptan seçilirse eski yerel algoritmayı kullanmaya devam et
                        result = await api.generateOutfitIdea(params);
                    }
                    
                    this.currentOutfit = result;
                    
                    // DOM API kullanarak UI render etme numarasını kullanalım:
                    // Ama displayArea farklı element, bu yüzden renderLocal yapalım
                    this.renderLocalOutfit(displayArea, result);
                    
                    // Geçmişe ekle
                    this.saveToHistory(result);
                    this.renderHistory();

                    // Butonları göster
                    actionsPanel.style.display = 'flex';
                    btnSaveToWardrobe.disabled = false;
                    btnShareSocial.disabled = false;
                    btnSaveToWardrobe.innerHTML = "👕 Tüm Parçaları Gardıroba Ekle";
                    btnShareSocial.innerHTML = "🌟 Sosyal Akışta Paylaş";

                } catch (err) {
                    displayArea.innerHTML = `<p style="color:red; text-align:center;">Oluşturulurken hata: ${err.message}</p>`;
                } finally {
                    generateBtn.innerHTML = prevText;
                    generateBtn.disabled = false;
                }
            });
        }

        if (btnSaveToWardrobe) {
            btnSaveToWardrobe.addEventListener('click', async () => {
                if (!this.currentOutfit || !this.currentOutfit.items) return;
                
                btnSaveToWardrobe.innerHTML = "Kaydediliyor...";
                btnSaveToWardrobe.disabled = true;

                let successCount = 0;
                for (let part of this.currentOutfit.items) {
                    if (part.source === 'wardrobe') continue; // Zaten gardıroptan olanı ekleme
                    try {
                        await api.addWardrobeItem({
                            category: part.type,
                            name: part.name,
                            color: "Karışık (AI)"
                        });
                        successCount++;
                    } catch (e) {
                        console.error("Parça ekleme hatası", e);
                    }
                }
                btnSaveToWardrobe.innerHTML = `✅ ${successCount} Yeni Parça Gardırobuna Eklendi!`;
            });
        }

        if (btnShareSocial) {
            btnShareSocial.addEventListener('click', async () => {
                if (!this.currentOutfit) return;
                
                btnShareSocial.innerHTML = "Paylaşılıyor...";
                btnShareSocial.disabled = true;
                
                try {
                    await api.shareOutfit({
                        style: this.currentOutfit.style || "AIKombin",
                        description: this.currentOutfit.description || this.currentOutfit.title
                    });
                    btnShareSocial.innerHTML = "🎉 Akışta Paylaşıldı!";
                    setTimeout(() => window.location.href = 'social.html', 1500);
                } catch (e) {
                    btnShareSocial.innerHTML = "Hata Oluştu!";
                    console.error(e);
                }
            });
        }

        const btnClearAllHistory = document.getElementById('clear-all-history-btn');
        if (btnClearAllHistory) {
            btnClearAllHistory.addEventListener('click', () => {
                const history = utils.getData('kombin_history') || [];
                if (history.length === 0) return;
                
                ui.confirmDialog(
                    "Geçmişi Temizle", 
                    "Tüm geçmiş kombinlerinizi kalıcı olarak silmek istediğinize emin misiniz?", 
                    "Tümünü Sil", 
                    () => {
                        utils.saveData('kombin_history', []);
                        this.renderHistory();
                    }
                );
            });
        }
        
        this.setupMixedModalListeners();
    },
    
    mixedSelectedItems: { 'Üst Giyim': null, 'Alt Giyim': null, 'Ayakkabı': null, 'Dış Giyim': null, 'Aksesuar': null },
    userWardrobeItems: [],
    currentMixedCategory: 'Üst Giyim',
    mixedConfirmed: false,
    
    async openMixedModal() {
        const modal = document.getElementById('mixed-source-modal');
        if (!modal) return;
        
        this.mixedSelectedItems = { 'Üst Giyim': null, 'Alt Giyim': null, 'Ayakkabı': null, 'Dış Giyim': null, 'Aksesuar': null };
        this.currentMixedCategory = 'Üst Giyim';
        
        document.getElementById('mixed-selection-step').style.display = 'flex';
        document.getElementById('mixed-preview-step').style.display = 'none';
        
        modal.classList.add('active');
        
        try {
            const userId = await api.getCurrentUserId();
            this.userWardrobeItems = await api.getWardrobeItems(userId) || [];
            document.querySelectorAll('.mixed-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.mixed-tab[data-cat="Üst Giyim"]')?.classList.add('active');
            this.renderMixedCategory('Üst Giyim');
            this.updateMixedSummary();
        } catch (err) {
            console.error(err);
            document.getElementById('mixed-wardrobe-items').innerHTML = '<p style="color:red;">Gardırop yüklenemedi.</p>';
        }
    },
    
    setupMixedModalListeners() {
        const modal = document.getElementById('mixed-source-modal');
        if (!modal) return;
        
        document.getElementById('close-mixed-modal').addEventListener('click', () => modal.classList.remove('active'));
        
        document.querySelectorAll('.mixed-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.mixed-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentMixedCategory = e.target.getAttribute('data-cat');
                this.renderMixedCategory(this.currentMixedCategory);
            });
        });
        
        document.getElementById('mixed-complete-btn').addEventListener('click', () => this.showMixedPreview());
        document.getElementById('mixed-back-btn').addEventListener('click', () => {
            document.getElementById('mixed-selection-step').style.display = 'flex';
            document.getElementById('mixed-preview-step').style.display = 'none';
        });
        
        document.getElementById('mixed-confirm-btn').addEventListener('click', () => {
            modal.classList.remove('active');
            this.mixedConfirmed = true;
            // Submit form again automatically
            document.getElementById('generate-outfit-btn').click();
        });
    },
    
    renderMixedCategory(category) {
        const container = document.getElementById('mixed-wardrobe-items');
        
        const items = this.userWardrobeItems.filter(i => {
            const catName = i.categories?.name?.toLowerCase() || '';
            const c = category.toLowerCase();
            if (c.includes('üst') && (catName.includes('üst') || catName.includes('ust') || catName.includes('tişört') || catName.includes('gömlek') || catName.includes('kazak'))) return true;
            if (c.includes('alt') && (catName.includes('alt') || catName.includes('pantolon') || catName.includes('şort') || catName.includes('etek'))) return true;
            if (c.includes('ayakkabı') && (catName.includes('ayakkabı') || catName.includes('ayakkabi') || catName.includes('sneaker') || catName.includes('bot'))) return true;
            if (c.includes('dış') && (catName.includes('dış') || catName.includes('dis') || catName.includes('ceket') || catName.includes('mont') || catName.includes('kaban'))) return true;
            if (c.includes('aksesuar') && catName.includes('aksesuar')) return true;
            return false;
        });
        
        if (items.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem; grid-column: 1/-1;">Bu kategoride gardırobunuzda hiç ürün yok.</p>`;
            return;
        }
        
        container.innerHTML = items.map(item => {
            const isSelected = this.mixedSelectedItems[category] && this.mixedSelectedItems[category].id === item.id;
            const catName = item.categories?.name || 'Üst Giyim';
            const img = item.image_url || ui.getOutfitImage(item.name, catName);
            return `
            <div class="wardrobe-item ${isSelected ? 'selected-mixed-item' : ''}" data-id="${item.id}" style="cursor: pointer; border: 2px solid ${isSelected ? 'var(--primary-color)' : 'transparent'}; border-radius: 8px; padding: 0.5rem; text-align: center; position: relative; transition: all 0.2s;">
                <img src="${img}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 6px;">
                <p style="font-size: 0.8rem; margin-top: 0.5rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</p>
                ${isSelected ? `<div style="position: absolute; top: -5px; right: -5px; background: var(--primary-color); color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">✓</div>` : ''}
            </div>
            `;
        }).join('');
        
        container.querySelectorAll('.wardrobe-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.getAttribute('data-id');
                const clickedItem = items.find(i => i.id === id);
                
                // Toggle selection
                if (this.mixedSelectedItems[category] && this.mixedSelectedItems[category].id === id) {
                    this.mixedSelectedItems[category] = null;
                } else {
                    this.mixedSelectedItems[category] = clickedItem;
                }
                
                this.renderMixedCategory(category);
                this.updateMixedSummary();
            });
        });
    },
    
    updateMixedSummary() {
        const count = Object.values(this.mixedSelectedItems).filter(i => i !== null).length;
        const btn = document.getElementById('mixed-complete-btn');
        const summary = document.getElementById('mixed-selection-summary');
        
        if (count > 0) {
            btn.disabled = false;
            summary.innerHTML = `Toplam <b>${count}</b> parça seçildi.`;
        } else {
            btn.disabled = true;
            summary.innerHTML = `Hiçbir parça seçilmedi (En az 1 zorunlu).`;
        }
    },
    
    showMixedPreview() {
        document.getElementById('mixed-selection-step').style.display = 'none';
        document.getElementById('mixed-preview-step').style.display = 'flex';
        
        const list = document.getElementById('mixed-preview-list');
        const categories = ['Üst Giyim', 'Alt Giyim', 'Ayakkabı', 'Dış Giyim', 'Aksesuar'];
        
        list.innerHTML = categories.map(cat => {
            const item = this.mixedSelectedItems[cat];
            if (item) {
                const catName = item.categories?.name || 'Üst Giyim';
                const img = item.image_url || ui.getOutfitImage(item.name, catName);
                return `
                <li style="display: flex; align-items: center; gap: 1rem; background: var(--bg-color); padding: 0.8rem; border-radius: 8px;">
                    <div style="width: 50px; font-weight: bold; color: var(--text-muted); font-size: 0.85rem;">${cat}</div>
                    <img src="${img}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
                    <span style="font-weight: 500;">${item.name} <span style="font-size:0.7rem; background:var(--accent-color); color:white; padding:0.1rem 0.3rem; border-radius:3px;">Gardırop</span></span>
                </li>`;
            } else {
                return `
                <li style="display: flex; align-items: center; gap: 1rem; background: var(--bg-color); padding: 0.8rem; border-radius: 8px;">
                    <div style="width: 50px; font-weight: bold; color: var(--text-muted); font-size: 0.85rem;">${cat}</div>
                    <div style="width: 40px; height: 40px; border-radius: 4px; background: rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">✨</div>
                    <span style="color: var(--text-muted); font-style: italic; font-size: 0.9rem;">Yapay zeka tarafından belirlenecek...</span>
                </li>`;
            }
        }).join('');
    },

    renderLocalOutfit(container, outfit) {
        const uniqueId = Date.now();
        const visualItems = outfit.items.map((item, idx) => {
            const imgId = `ai-img-${uniqueId}-${idx}`;
            const imgUrl = item.image_url || ui.getOutfitImage(item.name, item.type, item.image_prompt);
            
            let actionHtml = '';
            let badgeHtml = '';
            
            if (item.source === 'external') {
                const storeHtml = item._store ? `<span style="font-size:0.7rem; color:var(--text-muted); opacity:0.7;">${item._store}</span>` : '';
                const scrapedBadge = item._scraped 
                    ? `<span style="font-size:0.6rem; background:#10b981; color:white; padding:0.15rem 0.3rem; border-radius:3px;">Gerçek Fiyat</span>` 
                    : `<span style="font-size:0.6rem; background:#f59e0b; color:white; padding:0.15rem 0.3rem; border-radius:3px;">Tahmini</span>`;
                actionHtml = `
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                        ${scrapedBadge}
                        <span style="font-weight:bold; color:var(--primary-color);">${item.price} TL</span>
                    </div>
                    ${storeHtml}
                    <a href="${item.productUrl || '#'}" target="_blank" class="btn btn-primary btn-sm" style="padding: 0.4rem 0.6rem; font-size: 0.8rem; text-decoration:none;">
                        🛒 Satın Al
                    </a>
                </div>`;
            } else {
                badgeHtml = ``;
                actionHtml = `
                <span style="font-size:0.85rem; font-weight: 500; background:var(--bg-color); border: 1px solid var(--border-color); color:var(--text-muted); padding:0.4rem 0.8rem; border-radius:4px; display:inline-flex; align-items:center; gap: 0.4rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a8 8 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/></svg> Gardırobumdan
                </span>`;
            }

            const initialContent = (item.source === 'wardrobe' && item.image_url) 
                ? `<img src="${item.image_url}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;" alt="Gardırop">`
                : `<div style="width:24px; height:24px; border:3px solid var(--primary-color); border-top-color:transparent; border-radius:50%; animation: spin 0.8s linear infinite;"></div>`;

            return { imgId, imgUrl, html: `
            <div style="display:flex; align-items:center; gap: 1rem; margin-bottom: 1rem; background: var(--bg-color); padding: 1rem; border-radius: 8px; border-left: 5px solid var(--accent-color);">
                <div id="${imgId}" style="width: 70px; height: 70px; border-radius: 8px; background: linear-gradient(135deg, #e0e7ff, #f0e6ff); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden;">
                    ${initialContent}
                </div>
                <div style="flex:1;">
                    <div style="display:flex; align-items:center;">
                        <span style="font-weight: bold; font-size: 1.1rem; color: var(--text-color);">${item.name}</span>
                        ${badgeHtml}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); opacity: 0.8; text-transform: uppercase;">${item.type === 'top' || item.type === 'Üst Giyim' ? 'Üst Giyim' : item.type === 'bottom' || item.type === 'Alt Giyim' ? 'Alt Giyim' : item.type === 'shoes' || item.type === 'Ayakkabı' ? 'Ayakkabı' : 'Diğer'}</div>
                </div>
                ${actionHtml}
            </div>` };
        });

        // Add spin animation if not already present
        if (!document.getElementById('ai-img-spin-style')) {
            const style = document.createElement('style');
            style.id = 'ai-img-spin-style';
            style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }

        container.innerHTML = `
            <div style="text-align: left; width: 100%;">
                <h3 style="color: var(--primary-color); margin-bottom: 0.5rem; font-size: 1.5rem;">${outfit.title}</h3>
                <p style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 2rem;">" ${outfit.description} "</p>
                <div style="display: flex; flex-direction: column;">
                    ${visualItems.map(v => v.html).join('')}
                </div>
            </div>
        `;

        // Resimleri Supabase proxy üzerinden yükle (tarayıcı engellemelerini atlatmak için)
        visualItems.forEach(({ imgId, imgUrl }) => {
            const wrapper = document.getElementById(imgId);
            if (!wrapper) return;
            
            // Eğer zaten gardırop görseli varsa tekrar yükleme yapma
            if (wrapper.querySelector('img')) return;
            
            // Sadece 'external' (dışarıdan) kaynaklı ürünler için yapay zeka görseli iste
            const item = outfit.items.find((_, i) => `ai-img-${uniqueId}-${i}` === imgId);
            const prompt = (item?.source === 'external') ? item?.image_prompt : null;
            
            if (prompt) {
                // Supabase Edge Function proxy üzerinden resmi al
                const supabaseUrl = typeof supabase !== 'undefined' ? supabase?.supabaseUrl : null;
                const supabaseKey = typeof supabase !== 'undefined' ? supabase?.supabaseKey : null;
                
                if (typeof api !== 'undefined' && api.getImageFromProxy) {
                    api.getImageFromProxy(prompt)
                        .then(dataUrl => {
                            if (dataUrl) {
                                wrapper.innerHTML = `<img src="${dataUrl}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;" alt="AI Görsel">`;
                            } else {
                                wrapper.innerHTML = '<span style="font-size:2rem;">👕</span>';
                            }
                        })
                        .catch(() => {
                            wrapper.innerHTML = '<span style="font-size:2rem;">👕</span>';
                        });
                } else {
                    // Fallback: direkt img tag dene
                    const img = new Image();
                    img.referrerPolicy = 'no-referrer';
                    img.style.cssText = 'width:70px; height:70px; object-fit:cover; border-radius:8px;';
                    img.onload = () => { wrapper.innerHTML = ''; wrapper.appendChild(img); };
                    img.onerror = () => { wrapper.innerHTML = '<span style="font-size:2rem;">👕</span>'; };
                    img.src = imgUrl;
                }
            } else if (imgUrl) {
                // Gardırop resmi veya başka URL - doğrudan yükle
                const img = new Image();
                img.style.cssText = 'width:70px; height:70px; object-fit:cover; border-radius:8px;';
                img.onload = () => { wrapper.innerHTML = ''; wrapper.appendChild(img); };
                img.onerror = () => { wrapper.innerHTML = '<span style="font-size:2rem;">👕</span>'; };
                img.src = imgUrl;
            }
        });

        const singleBtns = container.querySelectorAll('.single-add-btn');
        singleBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const itemName = e.target.getAttribute('data-name');
                const itemType = e.target.getAttribute('data-type');
                
                try {
                    e.target.disabled = true;
                    e.target.textContent = "Ekleniyor...";
                    await api.addWardrobeItem({
                        name: itemName,
                        category: itemType,
                        color: 'Belirtilen Parça'
                    });
                    
                    e.target.textContent = "✅";
                    e.target.style.backgroundColor = "var(--success-color)";
                    e.target.style.color = "white";
                    e.target.style.border = "none";
                } catch (err) {
                    console.error("Parça eklenemedi:", err);
                    e.target.textContent = "❌";
                }
            });
        });
    },

    saveToHistory(outfit) {
        let history = utils.getData('kombin_history') || [];
        // Yeni bir kopya
        history.unshift({ ...outfit, date: new Date().toISOString() });
        // Max 9 geçmiş tut
        if (history.length > 9) history = history.slice(0, 9);
        utils.saveData('kombin_history', history);
    },

    renderHistory() {
        const historyContainer = document.getElementById('history-container');
        if (!historyContainer) return;
        
        let history = utils.getData('kombin_history') || [];
        if (history.length === 0) {
             historyContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Daha önce oluşturduğunuz kombinler burada listelenecek.</p>';
             return;
        }
        
        historyContainer.innerHTML = history.map(item => {
             const d = new Date(item.date).toLocaleDateString();
             return `
             <div class="card" style="padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative; border: 1px solid var(--border-color);">
                 <button class="delete-history-btn" data-date="${item.date}" style="position: absolute; top: 8px; right: 8px; background: transparent; border: none; color: #ff4d4f; font-size: 1.2rem; cursor: pointer;" title="Kombini Sil">&times;</button>
                 <div style="cursor: pointer;" onclick="alert('Geçmiş Önizlemesi: \\n${item.title}\\n${item.description}')">
                     <h4 style="font-size:1rem; color: var(--primary-color); padding-right: 1.5rem;">${item.title}</h4>
                     <p style="font-size:0.8rem; color: var(--text-muted);">${d}</p>
                     <span style="font-size:0.8rem; display:block; margin-top:0.5rem; background: var(--bg-color); padding:0.3rem; border-radius:4px;">${item.items.length} Parça Seçilmiş</span>
                 </div>
             </div>
             `;
        }).join('');

        // Silme olayları
        const deleteBtns = historyContainer.querySelectorAll('.delete-history-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                ui.confirmDialog("Kombini Sil", "Bu kombini geçmişten silmek istediğine emin misin?", "Evet, Sil", async () => {
                    const targetDate = btn.getAttribute('data-date');
                    let currHistory = utils.getData('kombin_history') || [];
                    currHistory = currHistory.filter(c => c.date !== targetDate);
                    utils.saveData('kombin_history', currHistory);
                    this.renderHistory();
                });
            });
        });
    }
};
