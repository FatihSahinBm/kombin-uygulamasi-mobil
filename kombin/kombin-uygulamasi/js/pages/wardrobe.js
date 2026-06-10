import { api } from '../api.js';
import { ui } from '../ui.js';

export const wardrobe = {
    _cachedUserId: null,

    async init() {
        console.log("Wardrobe modülü yüklendi.");

        const listContainer = document.getElementById('wardrobe-list');
        const modal = document.getElementById('add-item-modal');
        const openModalBtn = document.getElementById('add-wardrobe-btn');
        const closeModalBtn = document.getElementById('close-item-modal');
        const form = document.getElementById('wardrobe-form');

        // Çoklu Algılama Modalı Referansları
        const multiModal = document.getElementById('multi-detect-modal');
        const closeMultiBtn = document.getElementById('close-multi-modal');

        // Çoklu algılama modalı kapatma
        if (closeMultiBtn) closeMultiBtn.addEventListener('click', () => {
            multiModal.classList.remove('active');
            setTimeout(() => multiModal.style.display = 'none', 300);
        });

        // İki modal için tek window listener (her init'te birikmesini önler)
        window.addEventListener('click', (e) => {
            if (e.target === multiModal) {
                multiModal.classList.remove('active');
                setTimeout(() => multiModal.style.display = 'none', 300);
            }
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 300);
            }
        });

        // Yüklenen görselin base64 hali (çoklu parça akışında tekrar kullanmak için)
        let currentImageBase64 = null;
        let currentImageFile = null;
        let currentCroppedBase64 = null; // Kırpılmış görsel (çoklu algılamada kullanılır)
        let pendingParts = [];
        let selectedMultiParts = new Set();
        let allDetectedParts = [];

        // Canvas ile fotoğrafı kategoriye göre kırpma
        const cropImageForCategory = (base64, category) => {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const w = img.width, h = img.height;
                    // Kategoriye göre kırpma bölgeleri (y başlangıç %, yükseklik %)
                    // ÖNEMLİ: Bölgeler üst üste BİNMEMELİ, her parça kendi alanını görmeli
                    const regions = {
                        'top garment':    { sy: 0.05, sh: 0.33 },  // Üst: %5 - %38
                        'outerwear':      { sy: 0.03, sh: 0.40 },  // Dış: %3 - %43
                        'bottom garment': { sy: 0.40, sh: 0.32 },  // Alt: %40 - %72
                        'footwear':       { sy: 0.75, sh: 0.25 },  // Ayak: %75 - %100
                        'accessory':      { sy: 0, sh: 1 }
                    };
                    const r = regions[category] || { sy: 0, sh: 1 };
                    const cropY = Math.floor(h * r.sy);
                    const cropH = Math.floor(h * r.sh);
                    canvas.width = w;
                    canvas.height = cropH;
                    ctx.drawImage(img, 0, cropY, w, cropH, 0, 0, w, cropH);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                };
                img.src = base64;
            });
        };

        // Sıralı kuyruktan bir sonraki parçayı işle
        const processNextPart = async () => {
            if (pendingParts.length === 0) return;
            const part = pendingParts.shift();
            document.getElementById('modal-title').textContent = `${part.name} Ekle`;
            document.getElementById('editItemId').value = '';
            form.reset();
            document.getElementById('ai-attributes-container').style.display = 'none';
            const statusText = document.getElementById('ai-status-text');
            statusText.style.display = 'block';
            statusText.textContent = `${part.emoji} ${part.name} kırpılıyor ve analiz ediliyor...`;
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
            // Kırp ve worker'a gönder
            const croppedBase64 = await cropImageForCategory(currentImageBase64, part.key);
            currentCroppedBase64 = croppedBase64; // Kaydet (upload için de kullanılacak)
            visionWorker.postMessage({ imageBase64: croppedBase64, focusCategory: part.key });
        };
        
        // Modal etkileşimleri
        if (openModalBtn) openModalBtn.addEventListener('click', () => {
            document.getElementById('modal-title').textContent = "Kıyafet Ekle";
            document.getElementById('editItemId').value = "";
            form.reset();
            document.getElementById('ai-attributes-container').style.display = 'none';
            document.getElementById('ai-status-text').style.display = 'none';
            currentImageBase64 = null;
            currentImageFile = null;
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        });
        
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        });

        // Verileri Yükle
        await this.loadItems(listContainer);

        // Arama Dinleyicisi
        const searchInput = document.getElementById('wardrobe-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this._searchQuery = e.target.value.toLowerCase();
                this.renderFilteredItems(listContainer);
            });
        }

        // Kategori Çipleri Dinleyicisi
        const chipsContainer = document.getElementById('category-chips-container');
        if (chipsContainer) {
            const chips = chipsContainer.querySelectorAll('.app-category-chip');
            chips.forEach(chip => {
                chip.addEventListener('click', () => {
                    chips.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    this.renderFilteredItems(listContainer);
                });
            });
        }

        // Worker Tanımlaması (Computer Vision için)
        let visionWorker = null;
        if (window.Worker) {
            visionWorker = new Worker('js/workers/vision-worker.js', { type: 'module' });
            
            visionWorker.onmessage = (e) => {
                const { status, message, results, detectedParts } = e.data;
                const statusText = document.getElementById('ai-status-text');
                const attrContainer = document.getElementById('ai-attributes-container');

                if (status === 'loading' || status === 'progress' || status === 'analyzing') {
                    statusText.style.display = 'block';
                    statusText.textContent = message;

                // ── ÇOKLU PARÇA ALGILANDI ──
                } else if (status === 'multi-detect') {
                    statusText.style.display = 'none';
                    modal.classList.remove('active');
                    setTimeout(() => modal.style.display = 'none', 100);
                    
                    const previewImg = document.getElementById('multi-detect-preview');
                    if (previewImg && currentImageBase64) previewImg.src = currentImageBase64;
                    
                    allDetectedParts = detectedParts;
                    selectedMultiParts.clear();
                    const buttonsContainer = document.getElementById('multi-detect-buttons');
                    buttonsContainer.innerHTML = '';
                    const submitBtn = document.getElementById('multi-detect-submit');
                    submitBtn.style.display = 'none';
                    
                    detectedParts.forEach(part => {
                        const card = document.createElement('div');
                        card.dataset.key = part.key;
                        card.style.cssText = 'padding: 0.8rem 1.5rem; font-size: 1rem; border-radius: 12px; border: 2px solid #cbd5e1; background: white; color: var(--text-color); cursor: pointer; transition: all 0.25s; display: flex; align-items: center; gap: 8px; font-weight: 600; user-select: none;';
                        card.innerHTML = `<span style="font-size: 1.4rem;">${part.emoji}</span> ${part.name} <span class="check-mark" style="margin-left:auto; display:none; color: var(--primary-color); font-weight:bold;">✓</span>`;
                        
                        card.addEventListener('click', () => {
                            const check = card.querySelector('.check-mark');
                            if (selectedMultiParts.has(part.key)) {
                                selectedMultiParts.delete(part.key);
                                card.style.borderColor = '#cbd5e1';
                                card.style.background = 'white';
                                check.style.display = 'none';
                            } else {
                                selectedMultiParts.add(part.key);
                                card.style.borderColor = 'var(--primary-color)';
                                card.style.background = '#f0f4ff';
                                check.style.display = 'inline';
                            }
                            submitBtn.style.display = selectedMultiParts.size > 0 ? 'block' : 'none';
                            submitBtn.textContent = `🤖 Seçilenleri Analiz Et (${selectedMultiParts.size} parça)`;
                        });
                        buttonsContainer.appendChild(card);
                    });
                    
                    // "Seçilenleri Analiz Et" butonuna tıklama
                    submitBtn.onclick = () => {
                        pendingParts = allDetectedParts.filter(p => selectedMultiParts.has(p.key));
                        multiModal.classList.remove('active');
                        setTimeout(() => multiModal.style.display = 'none', 300);
                        processNextPart();
                    };
                    
                    multiModal.style.display = 'flex';
                    setTimeout(() => multiModal.classList.add('active'), 10);

                // ── TEK PARÇA ANALİZ SONUCU ──
                } else if (status === 'complete') {
                    statusText.style.display = 'none';
                    attrContainer.style.display = 'block';
                    
                    // Kategori bazlı form değişiklikleri
                    if (results.mainCategory) {
                        const sel = document.getElementById('itemCategory');
                        if (results.mainCategory === 'top garment') sel.value = 'ust';
                        else if (results.mainCategory === 'bottom garment') sel.value = 'alt';
                        else if (results.mainCategory === 'outerwear') sel.value = 'dis_giyim';
                        else if (results.mainCategory === 'footwear') sel.value = 'ayakkabi';
                        else sel.value = 'aksesuar';
                    }

                    // İsmi kategori adı yapalım default olarak (Eğer boşsa)
                    const nameInput = document.getElementById('itemName');
                    if (!nameInput.value && results.category) nameInput.value = results.category;

                    // Ortak Özellikler (Renk vb.)
                    if (results.color) document.getElementById('itemColor').value = results.color;

                    // Container Gösterimleri ve Value Atamaları
                    const setAttr = (id, val) => {
                        const container = document.getElementById(id + 'Container');
                        const input = document.getElementById(id);
                        if (container && input) {
                            if (val) {
                                container.style.display = 'block';
                                input.value = val;
                            } else {
                                container.style.display = 'none';
                                input.value = '';
                            }
                        }
                    };

                    setAttr('aiFit', results.fit);
                    setAttr('aiLegLength', results.leg_length);
                    setAttr('aiNeckline', results.neckline);
                    setAttr('aiSleeve', results.sleeve);
                    
                    // Her zaman gösterilebilecek genel özellikler
                    setAttr('aiTexture', results.texture);
                    setAttr('aiStyle', results.style);

                } else if (status === 'error') {
                    statusText.textContent = 'Analiz Hatası: ' + message;
                }
            };
        }

        // Resim Seçildiğinde Analizi Başlat
        const fileInputDOM = document.getElementById('itemImage');
        if (fileInputDOM && visionWorker) {
            fileInputDOM.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                currentImageFile = file;
                const reader = new FileReader();
                reader.onload = (event) => {
                    currentImageBase64 = event.target.result;
                    visionWorker.postMessage({ imageBase64: currentImageBase64 });
                };
                reader.readAsDataURL(file);
            });
        }

        // Sosyal akıştan "Gardıroba Ekle" ile gelindiyse görseli otomatik işle
        const pendingSocialImage = sessionStorage.getItem('pendingSocialImage');
        if (pendingSocialImage && visionWorker) {
            sessionStorage.removeItem('pendingSocialImage');

            // Modalı aç
            document.getElementById('modal-title').textContent = 'Kıyafet Ekle';
            document.getElementById('editItemId').value = '';
            form.reset();
            document.getElementById('ai-attributes-container').style.display = 'none';
            const statusText = document.getElementById('ai-status-text');
            statusText.style.display = 'block';
            statusText.textContent = 'Sosyal akıştaki görsel analiz ediliyor...';
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);

            // URL → base64 çevir (CORS için canvas yöntemi)
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                const base64 = canvas.toDataURL('image/jpeg', 0.9);
                currentImageBase64 = base64;
                visionWorker.postMessage({ imageBase64: base64 });
            };
            img.onerror = () => {
                statusText.textContent = 'Görsel yüklenemedi. Lütfen manuel seçin.';
            };
            img.src = pendingSocialImage;
        }

        // Sıfırla (Reset) Butonu İşlemi
        const resetBtn = document.getElementById('reset-form-btn');
        if (resetBtn && form) {
            resetBtn.addEventListener('click', () => {
                form.reset(); // İsim, Kategori, Renk ve File (Resim) inputlarını sıfırlar
                currentImageBase64 = null;
                currentImageFile = null;
                
                // Yapay Zeka sonuçlarını gizle ve temizle
                document.getElementById('ai-status-text').style.display = 'none';
                document.getElementById('ai-attributes-container').style.display = 'none';
                
                const aiDivs = ['aiFit', 'aiLegLength', 'aiNeckline', 'aiSleeve', 'aiTexture', 'aiStyle'];
                aiDivs.forEach(id => {
                    const inputEl = document.getElementById(id);
                    const containerEl = document.getElementById(id + 'Container');
                    if (inputEl) inputEl.value = '';
                    if (containerEl) containerEl.style.display = 'none';
                });
            });
        }

        // Form İşlemi (Kaydet)
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const saveBtn = document.getElementById('save-item-btn');
                const editId = document.getElementById('editItemId').value;
                const prevText = saveBtn.innerHTML;
                saveBtn.innerHTML = editId ? "Güncelleniyor..." : "Kaydediliyor...";
                saveBtn.disabled = true;

                // Her kelimenin ilk harfini büyük yapan (Title Case) yardımcı fonksiyon
                const toTitleCase = (str) => {
                    if (!str) return '';
                    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                };

                const nameInput = document.getElementById('itemName').value;
                const catInput = document.getElementById('itemCategory').value;
                const colorInput = document.getElementById('itemColor').value;
                const fileInput = document.getElementById('itemImage');

                // Verileri nizami (İlk Harfler Büyük) hale getir
                const formattedName = toTitleCase(nameInput);
                const formattedColor = toTitleCase(colorInput);

                // Yapay Zeka Özelliklerini Topla
                const aiAttributes = {
                    fit: document.getElementById('aiFit')?.value || null,
                    leg_length: document.getElementById('aiLegLength')?.value || null,
                    texture: document.getElementById('aiTexture')?.value || null,
                    neckline: document.getElementById('aiNeckline')?.value || null,
                    sleeve: document.getElementById('aiSleeve')?.value || null,
                    style: document.getElementById('aiStyle')?.value || null
                };

                try {
                    let imageUrl = null;
                    
                    // Base64'ü File nesnesine çeviren yardımcı
                    const base64ToFile = (base64, filename) => {
                        const arr = base64.split(',');
                        const mime = arr[0].match(/:(.*?);/)[1];
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while(n--) u8arr[n] = bstr.charCodeAt(n);
                        return new File([u8arr], filename, { type: mime });
                    };
                    
                    if (currentCroppedBase64) {
                        // Çoklu algılamadan gelindi: kırpılmış görseli yükle
                        saveBtn.innerHTML = "Kırpılmış Fotoğraf Yükleniyor...";
                        const croppedFile = base64ToFile(currentCroppedBase64, `cropped-${Date.now()}.jpg`);
                        imageUrl = await api.uploadImage(croppedFile);
                    } else if (fileInput && fileInput.files.length > 0) {
                        // Tek parça: normal dosyayı yükle
                        saveBtn.innerHTML = "Fotoğraf Yükleniyor...";
                        imageUrl = await api.uploadImage(fileInput.files[0]);
                    } else if (currentImageFile) {
                        saveBtn.innerHTML = "Fotoğraf Yükleniyor...";
                        imageUrl = await api.uploadImage(currentImageFile);
                    }
                    
                    saveBtn.innerHTML = editId ? "Güncelleniyor..." : "Kaydediliyor...";
                    const payload = {
                        name: formattedName,
                        category: catInput,
                        color: formattedColor,
                        attributes: aiAttributes
                    };
                    if (imageUrl) payload.image_url = imageUrl;

                    if (editId) {
                        await api.updateWardrobeItem(editId, payload);
                    } else {
                        await api.addWardrobeItem(payload);
                    }
                    
                    // Modalı Kapat
                    modal.classList.remove('active');
                    setTimeout(() => {
                        modal.style.display = 'none';
                        document.getElementById('ai-attributes-container').style.display = 'none';
                        document.getElementById('ai-status-text').style.display = 'none';
                    }, 300);
                    form.reset();
                    currentCroppedBase64 = null; // Sıfırla
                    
                    // Kuyrukta bekleyen parça varsa sıradakini işle
                    if (pendingParts.length > 0) {
                        setTimeout(() => processNextPart(), 400);
                    }
                    
                    // Listeyi Yenile
                    await this.loadItems(listContainer);
                } catch (error) {
                    alert("İşlem sırasında hata oluştu.");
                    console.error(error);
                } finally {
                    saveBtn.innerHTML = prevText;
                    saveBtn.disabled = false;
                }
            });
        }
    },

    async loadItems(container) {
        if (!container) return;
        try {
            if (!this._cachedUserId) {
                const tempUser = await api.getUserProfile();
                if (!tempUser) return;
                this._cachedUserId = tempUser.id;
            }

            this._cachedItems = await api.getWardrobeItems(this._cachedUserId);
            this.renderFilteredItems(container);

            // Event delegation: tüm kart ve silme tıklamalarını container üzerinde yönet (Yalnızca bir kez eklenir)
            if (!this._hasRegisteredEvents) {
                this._hasRegisteredEvents = true;
                container.addEventListener('click', (e) => {
                    const deleteBtn = e.target.closest('.delete-item-btn');
                    if (deleteBtn) {
                        e.stopPropagation();
                        ui.confirmDialog("Kıyafeti Sil?", "Bu kıyafeti gardırobundan kalıcı olarak silmek istediğine emin misin?", "Evet, Sil", async () => {
                            try {
                                await api.deleteWardrobeItem(deleteBtn.getAttribute('data-id'));
                                await this.loadItems(container);
                            } catch(err) {
                                console.error("Silme Hatası", err);
                                alert("Kıyafet silinirken hata oluştu! Eğer silinmiyorsa Veritabanınızda (Supabase) DELETE Politikası (Policy) eksik demektir.");
                            }
                        });
                        return;
                    }

                    const card = e.target.closest('.app-wardrobe-item-card');
                    if (!card) return;

                    const itemDataRaw = card.getAttribute('data-item');
                    if (!itemDataRaw) return;

                    const itemData = JSON.parse(itemDataRaw.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));

                    document.getElementById('modal-title').textContent = "Kıyafet Düzenle";
                    document.getElementById('editItemId').value = itemData.id;
                    document.getElementById('itemName').value = itemData.name || '';
                    document.getElementById('itemColor').value = itemData.colors?.name || '';

                    const catSelect = document.getElementById('itemCategory');
                    const catNameLower = itemData.categories?.name?.toLowerCase() || '';
                    if (catNameLower.includes('ust') || catNameLower.includes('üst')) catSelect.value = 'ust';
                    else if (catNameLower.includes('alt')) catSelect.value = 'alt';
                    else if (catNameLower.includes('ayakkabi') || catNameLower.includes('ayakkabı')) catSelect.value = 'ayakkabi';
                    else if (catNameLower.includes('dis') || catNameLower.includes('dış')) catSelect.value = 'dis_giyim';
                    else catSelect.value = 'aksesuar';

                    const attrs = itemData.attributes || {};
                    document.getElementById('ai-attributes-container').style.display = 'block';
                    document.getElementById('ai-status-text').style.display = 'none';

                    const setAttr = (id, val) => {
                        const c = document.getElementById(id + 'Container');
                        const i = document.getElementById(id);
                        if (c && i) {
                            if (val) { c.style.display = 'block'; i.value = val; }
                            else { c.style.display = 'none'; i.value = ''; }
                        }
                    };

                    setAttr('aiFit', attrs.fit);
                    setAttr('aiLegLength', attrs.leg_length);
                    setAttr('aiNeckline', attrs.neckline);
                    setAttr('aiSleeve', attrs.sleeve);
                    setAttr('aiTexture', attrs.texture);
                    setAttr('aiStyle', attrs.style);

                    const modal = document.getElementById('add-item-modal');
                    modal.style.display = 'flex';
                    setTimeout(() => modal.classList.add('active'), 10);
                });
            }

        } catch (error) {
            container.innerHTML = `<p style="grid-column: 1/-1; color: red;">Veriler çekilemedi.</p>`;
            console.error(error);
        }
    },

    renderFilteredItems(container) {
        if (!container || !this._cachedItems) return;
        
        let filtered = this._cachedItems;
        
        // Filter by category
        const activeChip = document.querySelector('.app-category-chip.active');
        const filterCat = activeChip ? activeChip.getAttribute('data-category') : 'all';
        
        if (filterCat !== 'all') {
            filtered = filtered.filter(item => {
                const catName = item.categories?.name?.toLowerCase() || '';
                if (filterCat === 'ust') return catName.includes('ust') || catName.includes('üst');
                if (filterCat === 'alt') return catName.includes('alt') || catName.includes('pantolon') || catName.includes('şort');
                if (filterCat === 'ayakkabi') return catName.includes('ayakkabi') || catName.includes('ayakkabı');
                if (filterCat === 'dis_giyim') return catName.includes('dis') || catName.includes('dış') || catName.includes('ceket');
                if (filterCat === 'aksesuar') return catName.includes('aksesuar');
                return false;
            });
        }
        
        // Filter by search query
        const searchQuery = this._searchQuery || '';
        if (searchQuery) {
            filtered = filtered.filter(item => 
                (item.name && item.name.toLowerCase().includes(searchQuery)) ||
                (item.colors?.name && item.colors.name.toLowerCase().includes(searchQuery)) ||
                (item.attributes?.brand && item.attributes.brand.toLowerCase().includes(searchQuery))
            );
        }
        
        // Update header count dynamically!
        const countEl = document.getElementById('wardrobe-count');
        if (countEl) {
            countEl.textContent = `${this._cachedItems.length} kıyafet`;
        }
        
        // Render
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="app-wardrobe-empty" style="grid-column: 1/-1; text-align: center; padding: 4rem 1.5rem; width: 100%;">
                    <span style="font-size: 4rem; display: block; margin-bottom: 1rem;">👗</span>
                    <h3 style="color: white; margin-bottom: 0.5rem; font-size: 1.2rem; font-weight: 700;">Kıyafet Bulunamadı</h3>
                    <p style="color: #9ca3af; font-size: 0.9rem;">Aramanıza veya filtreye uygun parça yok.</p>
                </div>
            `;
            return;
        }
        
        // HTML Encode helper to safely stringify item for JSON
        const htmlEscape = (str) => {
            return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        };

        // Kategorileri düzgün Türkçe isimlere çevirme
        const formatCategory = (cat) => {
            if (!cat) return 'Kategori Yok';
            const c = cat.toLowerCase();
            if (c === 'ust') return 'Üst Giyim';
            if (c === 'alt') return 'Alt Giyim';
            if (c === 'dis_giyim') return 'Dış Giyim';
            if (c === 'ayakkabi') return 'Ayakkabı';
            if (c === 'aksesuar') return 'Aksesuar';
            return cat;
        };
        
        container.innerHTML = filtered.map(item => `
            <div class="app-wardrobe-item-card" data-item="${htmlEscape(JSON.stringify(item))}">
                <button class="delete-item-btn" data-id="${item.id}" style="position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); border: none; color: #ff4d4f; font-size: 1.2rem; cursor: pointer; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='rgba(0,0,0,0.8)';" onmouseout="this.style.background='rgba(0,0,0,0.5)';" title="Kıyafeti Sil">
                    &times;
                </button>
                
                <div class="app-wardrobe-item-img-wrapper">
                    ${item.image_url ?
                        `<img src="${item.image_url}" alt="${item.name}" loading="lazy">`
                        : 
                        `<div class="app-wardrobe-item-placeholder">
                            ${
                                (item.categories?.name?.toLowerCase().includes('ust') || item.categories?.name?.toLowerCase().includes('üst')) ? '👕' : 
                                (item.categories?.name?.toLowerCase().includes('alt')) ? '👖' : 
                                (item.categories?.name?.toLowerCase().includes('ayakkabi') || item.categories?.name?.toLowerCase().includes('ayakkabı')) ? '👟' : 
                                (item.categories?.name?.toLowerCase().includes('dis') || item.categories?.name?.toLowerCase().includes('dış') || item.categories?.name?.toLowerCase().includes('ceket')) ? '🧥' : '🎒'
                            }
                        </div>`
                    }
                </div>
                
                <div class="app-wardrobe-item-info">
                    <h3 class="app-wardrobe-item-name" title="${item.name}">${item.name || "İsimsiz Seçim"}</h3>
                    ${item.attributes?.brand ? `<p class="app-wardrobe-item-brand">${item.attributes.brand}</p>` : ''}
                    <div class="app-wardrobe-tags">
                        <span class="app-wardrobe-tag">${formatCategory(item.categories?.name)}</span>
                        ${item.colors?.name ? `<span class="app-wardrobe-tag">${item.colors.name}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }
};
