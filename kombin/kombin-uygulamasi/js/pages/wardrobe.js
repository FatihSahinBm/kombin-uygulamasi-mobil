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
        let activeAnalysisId = 0;
        let isAnalyzingCroppedAction = false; // Kırpma işlemi ile mi tetiklendi takibi

        // Canvas ile kırpma koordinatlarını okuyup görseli kesen fonksiyon
        const performCrop = () => {
            const img = document.getElementById('item-full-preview');
            const cropBox = document.getElementById('crop-box');
            const croppedPreview = document.getElementById('item-cropped-preview');
            if (!img || !cropBox || !currentImageBase64) return;

            const w = img.clientWidth;
            const h = img.clientHeight;
            if (w === 0 || h === 0) return;

            // Gerçek (natural) boyutlar
            const natW = img.naturalWidth;
            const natH = img.naturalHeight;

            // Ölçeklendirme oranları
            const scaleX = natW / w;
            const scaleY = natH / h;

            // Crop kutusunun görünür koordinatları
            const boxX = cropBox.offsetLeft;
            const boxY = cropBox.offsetTop;
            const boxW = cropBox.offsetWidth;
            const boxH = cropBox.offsetHeight;

            // Gerçek boyuta eşleme
            const cropX = Math.max(0, Math.floor(boxX * scaleX));
            const cropY = Math.max(0, Math.floor(boxY * scaleY));
            const cropW = Math.min(natW - cropX, Math.ceil(boxW * scaleX));
            const cropH = Math.min(natH - cropY, Math.ceil(boxH * scaleY));

            if (cropW <= 0 || cropH <= 0) return;

            const canvas = document.createElement('canvas');
            canvas.width = cropW;
            canvas.height = cropH;
            const ctx = canvas.getContext('2d');

            // Doğrudan yüklenmiş görsel elementini çizerek asenkron gecikmeyi önleriz
            ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const croppedData = canvas.toDataURL('image/jpeg', 0.9);
            currentCroppedBase64 = croppedData;
            if (croppedPreview) {
                croppedPreview.src = croppedData;
            }
        };

        // Kategoriye ve görsel boyutlarına göre varsayılan crop kutusu konumunu ayarlayan fonksiyon
        const resetCropBoxToDefault = (triggerAnalysis = true) => {
            const img = document.getElementById('item-full-preview');
            const cropBox = document.getElementById('crop-box');
            const wrapper = document.getElementById('cropper-wrapper');
            if (!img || !cropBox || !wrapper || !img.src) return;

            // Görsel yüklenene kadar bekle
            if (!img.complete || img.naturalWidth === 0) {
                img.onload = () => resetCropBoxToDefault(triggerAnalysis);
                return;
            }

            const w = img.clientWidth;
            const h = img.clientHeight;
            // Tarayıcının modal görünürlük geçişi nedeniyle boyut hesaplayamaması durumunda tekrar dene
            if (w === 0 || h === 0) {
                setTimeout(() => resetCropBoxToDefault(triggerAnalysis), 50);
                return;
            }

            // Crop alanı kapsayıcısını görsele tam oturt (dışarı taşmayı önler)
            wrapper.style.width = w + 'px';
            wrapper.style.height = h + 'px';

            const categorySelect = document.getElementById('itemCategory');
            const cat = categorySelect ? categorySelect.value : 'ust';

            // Varsayılan oranlar { x, y, w, h }
            let region = { x: 0.1, y: 0.1, w: 0.8, h: 0.4 }; // Üst Giyim
            if (cat === 'alt') {
                region = { x: 0.15, y: 0.4, w: 0.7, h: 0.45 }; // Alt Giyim
            } else if (cat === 'ayakkabi') {
                region = { x: 0.15, y: 0.7, w: 0.7, h: 0.25 }; // Ayakkabı
            } else if (cat === 'dis_giyim') {
                region = { x: 0.1, y: 0.05, w: 0.8, h: 0.5 }; // Dış Giyim
            } else if (cat === 'aksesuar') {
                region = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }; // Aksesuar
            }

            const boxX = Math.round(w * region.x);
            const boxY = Math.round(h * region.y);
            const boxW = Math.round(w * region.w);
            const boxH = Math.round(h * region.h);

            cropBox.style.left = boxX + 'px';
            cropBox.style.top = boxY + 'px';
            cropBox.style.width = boxW + 'px';
            cropBox.style.height = boxH + 'px';

            // Önizlemeyi güncelle
            performCrop();

            if (triggerAnalysis) {
                const mapCat = {
                    'ust': 'top garment',
                    'alt': 'bottom garment',
                    'dis_giyim': 'outerwear',
                    'ayakkabi': 'footwear',
                    'aksesuar': 'accessory'
                };
                const forcedCategory = mapCat[cat] || 'top garment';
                triggerAIAnalysis(forcedCategory);
            }
        };

        // Kırpılan bölgeyi yapay zeka analizine gönderen fonksiyon
        const triggerAIAnalysis = (forcedCategory = null, isCroppedAction = false) => {
            if (!currentCroppedBase64 || !visionWorker) return;
            isAnalyzingCroppedAction = isCroppedAction;

            let focusCategory = null;
            if (forcedCategory) {
                focusCategory = forcedCategory;
            } else if (!isCroppedAction) {
                const categorySelect = document.getElementById('itemCategory');
                const cat = categorySelect ? categorySelect.value : 'ust';
                const mapCat = {
                    'ust': 'top garment',
                    'alt': 'bottom garment',
                    'dis_giyim': 'outerwear',
                    'ayakkabi': 'footwear',
                    'aksesuar': 'accessory'
                };
                focusCategory = mapCat[cat] || 'top garment';
            }

            const statusText = document.getElementById('ai-status-text');
            const attrContainer = document.getElementById('ai-attributes-container');

            if (statusText) {
                statusText.style.display = 'block';
                statusText.textContent = 'Kıyafet seçilen bölgeye göre analiz ediliyor... 🤖';
            }
            if (attrContainer) {
                attrContainer.style.display = 'none';
            }

            // İstek sırasını takip edelim
            activeAnalysisId++;
            visionWorker.postMessage({ 
                imageBase64: currentCroppedBase64, 
                focusCategory: focusCategory,
                isCropped: isCroppedAction || !!forcedCategory,
                analysisId: activeAnalysisId 
            });
        };

        // Tüm görseli (kırpılmamış) yapay zeka analizine gönderen fonksiyon (Çoklu parça kontrolü için)
        const triggerFullImageAnalysis = () => {
            if (!currentImageBase64 || !visionWorker) return;
            isAnalyzingCroppedAction = false;

            const statusText = document.getElementById('ai-status-text');
            const attrContainer = document.getElementById('ai-attributes-container');

            if (statusText) {
                statusText.style.display = 'block';
                statusText.textContent = 'Görsel inceleniyor... (Ön Analiz) 🤖';
            }
            if (attrContainer) {
                attrContainer.style.display = 'none';
            }

            activeAnalysisId++;
            visionWorker.postMessage({ 
                imageBase64: currentImageBase64, 
                focusCategory: null,
                isCropped: false,
                analysisId: activeAnalysisId 
            });
        };

        // Sürükle ve Boyutlandır Olay Dinleyicileri Kurulumu
        const setupCropperEvents = () => {
            const cropBox = document.getElementById('crop-box');
            const img = document.getElementById('item-full-preview');
            if (!cropBox || !img) return;

            let isDragging = false;
            let isResizing = false;
            let activeHandle = null;
            let startX, startY, startLeft, startTop, startWidth, startHeight;

            const onDown = (e) => {
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                const handle = e.target.closest('.crop-handle');
                if (handle) {
                    isResizing = true;
                    if (handle.classList.contains('nw')) activeHandle = 'nw';
                    else if (handle.classList.contains('ne')) activeHandle = 'ne';
                    else if (handle.classList.contains('sw')) activeHandle = 'sw';
                    else if (handle.classList.contains('se')) activeHandle = 'se';
                } else if (e.target === cropBox) {
                    isDragging = true;
                }

                if (isDragging || isResizing) {
                    e.preventDefault();
                    startX = clientX;
                    startY = clientY;
                    startLeft = cropBox.offsetLeft;
                    startTop = cropBox.offsetTop;
                    startWidth = cropBox.offsetWidth;
                    startHeight = cropBox.offsetHeight;
                    
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                    document.addEventListener('touchmove', onMove, { passive: false });
                    document.addEventListener('touchend', onUp);
                }
            };

            const onMove = (e) => {
                if (!isDragging && !isResizing) return;
                e.preventDefault();

                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                const deltaX = clientX - startX;
                const deltaY = clientY - startY;

                const imgW = img.clientWidth;
                const imgH = img.clientHeight;

                if (isDragging) {
                    let newLeft = startLeft + deltaX;
                    let newTop = startTop + deltaY;

                    // Görsel dışına taşmayı engelle
                    newLeft = Math.max(0, Math.min(imgW - startWidth, newLeft));
                    newTop = Math.max(0, Math.min(imgH - startHeight, newTop));

                    cropBox.style.left = newLeft + 'px';
                    cropBox.style.top = newTop + 'px';
                } else if (isResizing) {
                    const minSize = 40; // Minimum crop boyutu
                    let newLeft = startLeft;
                    let newTop = startTop;
                    let newWidth = startWidth;
                    let newHeight = startHeight;

                    if (activeHandle === 'se') {
                        newWidth = Math.max(minSize, Math.min(imgW - startLeft, startWidth + deltaX));
                        newHeight = Math.max(minSize, Math.min(imgH - startTop, startHeight + deltaY));
                    } else if (activeHandle === 'sw') {
                        const maxLeft = startLeft + startWidth - minSize;
                        newLeft = Math.max(0, Math.min(maxLeft, startLeft + deltaX));
                        newWidth = startWidth + (startLeft - newLeft);
                        newHeight = Math.max(minSize, Math.min(imgH - startTop, startHeight + deltaY));
                    } else if (activeHandle === 'ne') {
                        const maxTop = startTop + startHeight - minSize;
                        newTop = Math.max(0, Math.min(maxTop, startTop + deltaY));
                        newHeight = startHeight + (startTop - newTop);
                        newWidth = Math.max(minSize, Math.min(imgW - startLeft, startWidth + deltaX));
                    } else if (activeHandle === 'nw') {
                        const maxLeft = startLeft + startWidth - minSize;
                        const maxTop = startTop + startHeight - minSize;
                        newLeft = Math.max(0, Math.min(maxLeft, startLeft + deltaX));
                        newWidth = startWidth + (startLeft - newLeft);
                        newTop = Math.max(0, Math.min(maxTop, startTop + deltaY));
                        newHeight = startHeight + (startTop - newTop);
                    }

                    cropBox.style.left = newLeft + 'px';
                    cropBox.style.top = newTop + 'px';
                    cropBox.style.width = newWidth + 'px';
                    cropBox.style.height = newHeight + 'px';
                }

                // Canlı önizleme
                performCrop();
            };

            const onUp = () => {
                if (isDragging || isResizing) {
                    isDragging = false;
                    isResizing = false;
                    activeHandle = null;

                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    document.removeEventListener('touchmove', onMove);
                    document.removeEventListener('touchend', onUp);

                    // Sürükleme bittiğinde AI analizi yap (auto-detect)
                    triggerAIAnalysis(null, true);
                }
            };

            cropBox.addEventListener('mousedown', onDown);
            cropBox.addEventListener('touchstart', onDown, { passive: false });
        };

        // Kategori değişim dinleyicisi
        const categorySelectDOM = document.getElementById('itemCategory');
        if (categorySelectDOM) {
            categorySelectDOM.addEventListener('change', () => {
                if (currentImageBase64) {
                    resetCropBoxToDefault(true);
                }
            });
        }

        // Sıralı kuyruktan bir sonraki parçayı işle (Çoklu algılama için)
        const processNextPart = async () => {
            if (pendingParts.length === 0) return;
            const part = pendingParts.shift();
            document.getElementById('modal-title').textContent = `${part.name} Ekle`;
            document.getElementById('editItemId').value = '';
            form.reset();

            // Kategori seçimi otomatik ayarla
            const catMap = {
                'top garment': 'ust',
                'bottom garment': 'alt',
                'outerwear': 'dis_giyim',
                'footwear': 'ayakkabi',
                'accessory': 'aksesuar'
            };
            const catSelect = document.getElementById('itemCategory');
            if (catSelect) {
                catSelect.value = catMap[part.key] || 'ust';
            }

            document.getElementById('ai-attributes-container').style.display = 'none';
            const statusText = document.getElementById('ai-status-text');
            statusText.style.display = 'block';
            statusText.textContent = `${part.emoji} ${part.name} kırpılıyor ve analiz ediliyor...`;
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
            
            // Önizlemeyi göster ve crop kutusunu etkinleştir
            const fullImg = document.getElementById('item-full-preview');
            fullImg.src = currentImageBase64;
            document.getElementById('wardrobe-image-preview-container').style.display = 'flex';
            
            const cropBox = document.getElementById('crop-box');
            if (cropBox) cropBox.style.display = 'block';

            // Varsayılan crop box yerleşimi ve analiz
            resetCropBoxToDefault(true);
        };
        
        // Modal etkileşimleri
        if (openModalBtn) openModalBtn.addEventListener('click', () => {
            document.getElementById('modal-title').textContent = "Kıyafet Ekle";
            document.getElementById('editItemId').value = "";
            form.reset();
            document.getElementById('ai-attributes-container').style.display = 'none';
            document.getElementById('ai-status-text').style.display = 'none';
            
            // Önizlemeleri temizle
            document.getElementById('item-full-preview').src = '';
            document.getElementById('item-cropped-preview').src = '';
            document.getElementById('wardrobe-image-preview-container').style.display = 'none';
            
            currentImageBase64 = null;
            currentImageFile = null;
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        });
        
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                // Önizlemeleri temizle
                document.getElementById('item-full-preview').src = '';
                document.getElementById('item-cropped-preview').src = '';
                document.getElementById('wardrobe-image-preview-container').style.display = 'none';
            }, 300);
        });

        // Kırpma alanını ve olay dinleyicilerini kur
        setupCropperEvents();

        // Verileri Yükle
        await this.loadItems(listContainer);

        // Filtreleme Dinleyicisi
        const filterSelect = document.getElementById('wardrobe-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.loadItems(listContainer, e.target.value);
            });
        }

        // Worker Tanımlaması (Computer Vision için)
        let visionWorker = null;
        if (window.Worker) {
            visionWorker = new Worker('js/workers/vision-worker.js', { type: 'module' });
            
            visionWorker.onmessage = (e) => {
                const { status, message, results, detectedParts, analysisId } = e.data;
                
                // Eski/gecikmeli isteklerden gelen sonuçları yok sayalım
                if (analysisId && analysisId !== activeAnalysisId) {
                    console.log(`Eski istek sonucu yok sayıldı (İstek ID: ${analysisId}, Güncel ID: ${activeAnalysisId})`);
                    return;
                }

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
                    
                    // Kategori Select elemanını güncelle
                    const categorySelect = document.getElementById('itemCategory');
                    let categoryChanged = false;
                    if (categorySelect && results.mainCategory) {
                        const reverseMap = {
                            'top garment': 'ust',
                            'bottom garment': 'alt',
                            'outerwear': 'dis_giyim',
                            'footwear': 'ayakkabi',
                            'accessory': 'aksesuar'
                        };
                        const targetValue = reverseMap[results.mainCategory] || 'ust';
                        if (categorySelect.value !== targetValue) {
                            categorySelect.value = targetValue;
                            categoryChanged = true;
                        }
                    }

                    // Kategori değiştiyse ve bu sürükleme işlemiyle tetiklenmediyse crop box'ı yeniden konumlandır
                    if (categoryChanged && !isAnalyzingCroppedAction) {
                        resetCropBoxToDefault(false);
                    }

                    // İsmi her zaman yeni algılanan kategoriyle güncelleyelim
                    const nameInput = document.getElementById('itemName');
                    if (results.category) nameInput.value = results.category;

                    // Ortak Özellikler (Renk vb.)
                    if (results.color) document.getElementById('itemColor').value = results.color;

                    // Önce tüm AI nitelik kutularını gizleyelim
                    const allAiContainers = [
                        'aiFitContainer',
                        'aiLegLengthContainer',
                        'aiNecklineContainer',
                        'aiSleeveContainer',
                        'aiTextureContainer',
                        'aiStyleContainer'
                    ];
                    allAiContainers.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = 'none';
                    });

                    // Hangi kategoride hangi kutuların gösterileceğini belirleyelim ve değerleri atayalım
                    const showAttr = (id, val) => {
                        const container = document.getElementById(id + 'Container');
                        const input = document.getElementById(id);
                        if (container && input) {
                            container.style.display = 'block';
                            input.value = val || '';
                        }
                    };

                    const mainCat = results.mainCategory;
                    if (mainCat === 'top garment' || mainCat === 'outerwear') {
                        showAttr('aiFit', results.fit);
                        showAttr('aiNeckline', results.neckline);
                        showAttr('aiSleeve', results.sleeve);
                    } else if (mainCat === 'bottom garment') {
                        showAttr('aiFit', results.fit);
                        showAttr('aiLegLength', results.leg_length);
                    }
                    // Genel özellikler (her zaman gösterilebilir)
                    showAttr('aiTexture', results.texture);
                    showAttr('aiStyle', results.style);

                } else if (status === 'error') {
                    statusText.textContent = 'Analiz Hatası: ' + message;
                }
            };
        }

        // Resim Seçildiğinde Önizle ve Kırp/Analiz Et
        const fileInputDOM = document.getElementById('itemImage');
        if (fileInputDOM && visionWorker) {
            fileInputDOM.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                currentImageFile = file;
                const reader = new FileReader();
                reader.onload = (event) => {
                    currentImageBase64 = event.target.result;
                    
                    // Görsel önizlemelerini güncelle ve crop kutusunu görünür kıl
                    const cropBox = document.getElementById('crop-box');
                    if (cropBox) cropBox.style.display = 'block';

                    document.getElementById('item-full-preview').src = currentImageBase64;
                    document.getElementById('wardrobe-image-preview-container').style.display = 'flex';
                    
                    // Varsayılan crop box yerleşimi (Analiz tetiklemeden)
                    resetCropBoxToDefault(false);

                    // Tüm görsel analizi başlat (Auto-detect & Multi-detect check için)
                    triggerFullImageAnalysis();
                };
                reader.readAsDataURL(file);
            });
        }

        // Sosyal akıştan "Gardıroba Ekle" ile gelindiyse görseli otomatik işle
        const pendingSocialImage = sessionStorage.getItem('pendingSocialImage');
        const pendingSocialCategory = sessionStorage.getItem('pendingSocialCategory');
        const pendingSocialLabel = sessionStorage.getItem('pendingSocialLabel');
        
        if (pendingSocialImage && visionWorker) {
            sessionStorage.removeItem('pendingSocialImage');
            if (pendingSocialCategory) sessionStorage.removeItem('pendingSocialCategory');
            if (pendingSocialLabel) sessionStorage.removeItem('pendingSocialLabel');

            // Modalı aç
            document.getElementById('modal-title').textContent = 'Kıyafet Ekle';
            document.getElementById('editItemId').value = '';
            form.reset();
            
            // Eğer kategori zaten biliniyorsa formda set et ve ismi doldur
            if (pendingSocialCategory) {
                document.getElementById('itemCategory').value = pendingSocialCategory;
                document.getElementById('itemName').value = pendingSocialLabel || '';
            }
            
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
                
                // Görsel önizlemelerini güncelle ve crop kutusunu görünür kıl
                const cropBox = document.getElementById('crop-box');
                if (cropBox) cropBox.style.display = 'block';

                document.getElementById('item-full-preview').src = base64;
                document.getElementById('wardrobe-image-preview-container').style.display = 'flex';
                
                // Varsayılan crop box yerleşimi (Analiz tetiklemeden)
                resetCropBoxToDefault(false);

                // Tüm görsel analizi başlat
                triggerFullImageAnalysis();
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
                currentCroppedBase64 = null;
                
                // Önizlemeleri temizle ve gizle
                document.getElementById('item-full-preview').src = '';
                document.getElementById('item-cropped-preview').src = '';
                document.getElementById('wardrobe-image-preview-container').style.display = 'none';
                
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
                    await this.loadItems(listContainer, document.getElementById('wardrobe-filter').value);
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

    async loadItems(container, filterCat = 'all') {
        if (!container) return;
        try {
            // Kullanıcı profilini her filtre değişiminde tekrar çekme
            if (!this._cachedUserId) {
                const tempUser = await api.getUserProfile();
                if (!tempUser) return;
                this._cachedUserId = tempUser.id;
            }

            let items = await api.getWardrobeItems(this._cachedUserId);
            
            // Filtreleme Mantığı
            if (filterCat !== 'all') {
                items = items.filter(item => {
                    const catName = item.categories?.name?.toLowerCase() || '';
                    if (filterCat === 'ust') return catName.includes('ust') || catName.includes('üst');
                    if (filterCat === 'alt') return catName.includes('alt') || catName.includes('pantolon') || catName.includes('şort');
                    if (filterCat === 'ayakkabi') return catName.includes('ayakkabi') || catName.includes('ayakkabı');
                    if (filterCat === 'dis_giyim') return catName.includes('dis') || catName.includes('dış') || catName.includes('ceket');
                    if (filterCat === 'aksesuar') return catName.includes('aksesuar');
                    return false;
                });
            }

            if (items.length === 0) {
                container.innerHTML = `<p style="grid-column: 1/-1; color: var(--text-muted);">Bu kategoride henüz kıyafetiniz yok.</p>`;
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

            container.innerHTML = items.map(item => `
                <div class="card wardrobe-item-card" data-item="${htmlEscape(JSON.stringify(item))}" style="display: flex; flex-direction: column; position: relative; overflow: hidden; border-radius: 12px; border: none; box-shadow: 0 4px 15px rgba(0,0,0,0.06); transition: transform 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                    
                    <button class="delete-item-btn" data-id="${item.id}" style="position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.9); border: none; color: #ff4d4f; font-size: 1.2rem; cursor: pointer; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.1); transition: all 0.2s; z-index: 10;" onmouseover="this.style.transform='scale(1.1)'; this.style.background='white';" onmouseout="this.style.transform='scale(1)'; this.style.background='rgba(255,255,255,0.9)';" title="Kıyafeti Sil">
                        &times;
                    </button>
                    
                    <div class="wardrobe-item-img-container" style="width: 100%; aspect-ratio: 4/5; background: #f8fafc; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none;">
                        ${item.image_url ?
                            `<img class="wardrobe-item-img" src="${item.image_url}" alt="${item.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">`
                            : 
                            `<div style="font-size: 3.5rem; opacity: 0.8;">${
                                (item.categories?.name?.toLowerCase().includes('ust') || item.categories?.name?.toLowerCase().includes('üst')) ? '👕' : 
                                (item.categories?.name?.toLowerCase().includes('alt')) ? '👖' : 
                                (item.categories?.name?.toLowerCase().includes('ayakkabi') || item.categories?.name?.toLowerCase().includes('ayakkabı')) ? '👟' : 
                                (item.categories?.name?.toLowerCase().includes('dis') || item.categories?.name?.toLowerCase().includes('dış') || item.categories?.name?.toLowerCase().includes('ceket')) ? '🧥' : '🎒'
                            }</div>`
                        }
                    </div>
                    
                    <div class="wardrobe-item-info" style="padding: 1rem; text-align: left; border-top: 1px solid var(--border-color); pointer-events: none;">
                        <p class="wardrobe-item-category" style="margin: 0 0 4px 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${formatCategory(item.categories?.name)}</p>
                        <h3 class="wardrobe-item-title" style="margin: 0; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name || "İsimsiz Seçim"}</h3>
                        <p class="wardrobe-item-color" style="margin: 5px 0 0 0; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 6px;">
                            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${item.colors?.name?.toLowerCase() === 'beyaz' ? '#f8fafc' : (item.colors?.name?.toLowerCase() === 'siyah' ? '#0f172a' : 'var(--primary-color)')}; border: 1px solid #cbd5e1;"></span>
                            ${item.colors?.name || "Belirtilmemiş"}
                        </p>
                    </div>

                </div>
            `).join('');

            // Event delegation: tüm kart ve silme tıklamalarını container üzerinde yönet
            container.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-item-btn');
                if (deleteBtn) {
                    e.stopPropagation();
                    ui.confirmDialog("Kıyafeti Sil?", "Bu kıyafeti gardırobundan kalıcı olarak silmek istediğine emin misin?", "Evet, Sil", async () => {
                        try {
                            await api.deleteWardrobeItem(deleteBtn.getAttribute('data-id'));
                            await this.loadItems(container, document.getElementById('wardrobe-filter')?.value || 'all');
                        } catch(err) {
                            console.error("Silme Hatası", err);
                            alert("Kıyafet silinirken hata oluştu! Eğer silinmiyorsa Veritabanınızda (Supabase) DELETE Politikası (Policy) eksik demektir.");
                        }
                    });
                    return;
                }

                const card = e.target.closest('.wardrobe-item-card');
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

                // Önce tüm nitelik kutularını gizle
                ['aiFit', 'aiLegLength', 'aiNeckline', 'aiSleeve', 'aiTexture', 'aiStyle'].forEach(id => {
                    const c = document.getElementById(id + 'Container');
                    const i = document.getElementById(id);
                    if (c) c.style.display = 'none';
                    if (i) i.value = '';
                });

                const showAttrEdit = (id, val) => {
                    const c = document.getElementById(id + 'Container');
                    const i = document.getElementById(id);
                    if (c && i) {
                        c.style.display = 'block';
                        i.value = val || '';
                    }
                };

                // Kategoriye göre sadece ilgili alanları göster
                const editCat = catSelect.value;
                if (editCat === 'ust' || editCat === 'dis_giyim') {
                    showAttrEdit('aiFit', attrs.fit);
                    showAttrEdit('aiNeckline', attrs.neckline);
                    showAttrEdit('aiSleeve', attrs.sleeve);
                } else if (editCat === 'alt') {
                    showAttrEdit('aiFit', attrs.fit);
                    showAttrEdit('aiLegLength', attrs.leg_length);
                }
                // Doku ve Stil her kategori için göster
                showAttrEdit('aiTexture', attrs.texture);
                showAttrEdit('aiStyle', attrs.style);

                // Düzenleme modunda görsel önizlemelerini doldur ve kırpma kutusunu gizle
                const previewContainer = document.getElementById('wardrobe-image-preview-container');
                const fullPreview = document.getElementById('item-full-preview');
                const croppedPreview = document.getElementById('item-cropped-preview');
                if (previewContainer && fullPreview && croppedPreview) {
                    if (itemData.image_url) {
                        previewContainer.style.display = 'flex';
                        fullPreview.src = itemData.image_url;
                        croppedPreview.src = itemData.image_url;
                        const cropBox = document.getElementById('crop-box');
                        if (cropBox) cropBox.style.display = 'none'; // Düzenlerken kutu gizlensin, yeni görsel yüklenince açılır
                    } else {
                        previewContainer.style.display = 'none';
                    }
                }

                const modal = document.getElementById('add-item-modal');
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('active'), 10);
            });

        } catch (error) {
            container.innerHTML = `<p style="grid-column: 1/-1; color: red;">Veriler çekilemedi.</p>`;
            console.error(error);
        }
    }
};
