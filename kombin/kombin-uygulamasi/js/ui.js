/**
 * UI manipülasyonları için fonksiyonları içerir.
 */
export const ui = {
    // --- Eski UI Fonksiyonları ---
    singleSelect(elements, targetElement) {
        elements.forEach(el => el.classList.remove('active'));
        if(targetElement) {
            targetElement.classList.add('active');
        }
    },

    toggleSelect(targetElement) {
        targetElement.classList.toggle('active');
    },

    setButtonState(buttonElement, isEnabled) {
        if (!buttonElement) return;
        buttonElement.disabled = !isEnabled;
    },

    // --- Anasayfa Eklentileri ---
    getElements() {
        return {
            userName: document.getElementById('user-name'),
            wardrobeCount: document.getElementById('wardrobe-count'),
            weatherInfo: document.getElementById('weather-info'),
            dailyOutfitDisplay: document.getElementById('daily-outfit-display'),
            socialFeedContainer: document.getElementById('social-feed-container'),
            
            modal: document.getElementById('create-outfit-modal'),
            openModalBtn: document.getElementById('create-outfit-trigger'),
            closeModalBtn: document.getElementById('close-modal'),
            outfitForm: document.getElementById('outfit-form'),
            generateBtn: document.getElementById('generate-btn')
        };
    },

    renderUserProfile(user) {
        const els = this.getElements();
        if(els.userName) els.userName.textContent = user.name;
    },

    renderWeather(weather) {
        const els = this.getElements();
        if(els.weatherInfo) {
            const windKm = weather.wind ? (weather.wind * 3.6).toFixed(1) : "0.0";
            if (weather.icon && weather.icon.startsWith('http')) {
                els.weatherInfo.innerHTML = `
                    <div style="display:flex; align-items:center; gap: 10px;">
                        <img src="${weather.icon}" alt="weather" style="width: 38px; height: 38px; object-fit: contain;">
                        <div style="display:flex; flex-direction:column; line-height:1.3; align-items:flex-start;">
                            <span style="font-size:1rem; color: var(--text-primary);">${weather.temp}°C, ${weather.condition}</span>
                            <span style="font-size:0.8rem; color: var(--text-secondary); font-weight: normal;">🌬️ Rüzgar: ${windKm} km/sa</span>
                        </div>
                    </div>
                `;
            } else {
                els.weatherInfo.innerHTML = `
                    <div style="display:flex; flex-direction:column; line-height:1.3;">
                        <span>${weather.temp}°C, ${weather.condition} ${weather.icon}</span>
                        <span style="font-size:0.8rem; color: var(--text-secondary); font-weight: normal;">🌬️ Rüzgar: ${windKm} km/sa</span>
                    </div>
                `;
            }
        }
    },

    updateWardrobeCount(count, items = []) {
        const els = this.getElements();
        if(els.wardrobeCount) {
            els.wardrobeCount.textContent = count;
            
            // Eğer liste varsa ana kaba bunu da yazdıralım (Dinamik Liste)
            let listHtml = '';
            if (items.length > 0) {
                listHtml = '<ul style="margin-top: 1rem; padding-left: 1.2rem; font-size: 0.85rem; color: var(--text-muted); text-align: left;">';
                items.slice(0, 4).forEach(item => { // İlk 4'ü göster
                    listHtml += `<li style="margin-bottom: 0.3rem;">${item.color ? item.color + ' ' : ''}${item.type || item.name}</li>`;
                });
                if (items.length > 4) listHtml += `<li>...ve ${items.length - 4} tane daha</li>`;
                listHtml += '</ul>';
            } else {
                listHtml = '<p style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted);">Henüz gardırobun boş. Yeni kıyafetler ekleyebilirsin!</p>';
            }

            // Stat container'ın parent'ına (card-body) ekleyelim
            const cardBody = els.wardrobeCount.closest('.card-body');
            if (cardBody) {
                // Eski logları silip tekrar ekliyoruz (tekrar oluşturmayı engellemek için list-container classlı bir div açalım)
                let listContainer = cardBody.querySelector('.wardrobe-list-container');
                if (!listContainer) {
                    listContainer = document.createElement('div');
                    listContainer.className = 'wardrobe-list-container';
                    cardBody.appendChild(listContainer);
                }
                listContainer.innerHTML = listHtml;
            }
        }
    },

    getOutfitImage(name, type, image_prompt) {
        let promptToUse = image_prompt;
        if (!promptToUse && name) {
            promptToUse = `a highly detailed product photo of a ${name}, flat lay on white background`;
        }
        
        if (promptToUse) {
            return `https://image.pollinations.ai/prompt/${encodeURIComponent(promptToUse)}?width=400&height=400&nologo=true`;
        }
        
        return 'https://via.placeholder.com/400x400.png?text=Gorsel+Yok';
    },

    renderDailyOutfit(outfit) {
        const els = this.getElements();

        if(els.dailyOutfitDisplay) {
            if (outfit.isError) {
                els.dailyOutfitDisplay.innerHTML = `
                    <div style="text-align: center; padding: 2rem; background: var(--surface-color); border-radius: 12px; border: 1px dashed var(--border-color);">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                        <h4 style="color: var(--primary-color); margin-bottom: 0.5rem; font-size: 1.2rem;">${outfit.title.replace(' ⚠️','')}</h4>
                        <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.4;">${outfit.description}</p>
                        <a href="wardrobe.html" class="btn btn-primary" style="margin-top: 1rem; display: inline-block; padding: 0.5rem 1rem;">Gardıroba Kıyafet Ekle</a>
                    </div>
                `;
                return;
            }

            const visualItems = outfit.items.map(item => {
                const imgStr = item.image_url || this.getOutfitImage(item.name, item.type, item.image_prompt);
                return `
                <div style="display:flex; align-items:center; gap: 1rem; margin-bottom: 1rem; background: var(--surface-color); padding: 0.5rem; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <img src="${imgStr}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px;" alt="${item.name}">
                    <div style="flex:1;">
                        <div style="font-weight: 600; font-size: 0.95rem;">${item.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">${item.type} <span style="text-transform:none; font-weight:normal;">(${item.color || 'Renk Yok'})</span></div>
                    </div>
                </div>`;
            }).join('');

            els.dailyOutfitDisplay.innerHTML = `
                <div style="text-align: left; width: 100%;">
                    <h4 style="color: var(--primary-color); margin-bottom: 0.5rem; font-size: 1.2rem;">${outfit.title}</h4>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">${outfit.description}</p>
                    <div style="display: flex; flex-direction: column;">
                        ${visualItems}
                    </div>
                </div>
            `;
            const dailyBtn = document.getElementById('daily-outfit-btn');
            if(dailyBtn) dailyBtn.removeAttribute('disabled');
        }
    },

    showDailyOutfitLoading() {
        const els = this.getElements();
        if(els.dailyOutfitDisplay) {
            els.dailyOutfitDisplay.innerHTML = `
                <div class="spinner"></div>
                <p>Yapay Zeka Senin İçin Düşünüyor...</p>
            `;
        }
    },

    renderSocialFeed(feedData, currentUserId = null, savedPostIds = new Set(), currentUserEmail = null, likedPostIds = new Set()) {
        const els = this.getElements();
        if(els.socialFeedContainer) {
            if (!feedData || feedData.length === 0) {
                els.socialFeedContainer.innerHTML = '<p style="color:var(--text-muted); padding: 1rem;">Henüz akışta paylaşım yok.</p>';
                return;
            }
            els.socialFeedContainer.innerHTML = feedData.map((post, index) => {
                // Normalizasyon sonrası kullanıcı adı users JOIN'den geliyor
                const userName = post.users?.name || post.user_name || 'Kullanıcı';
                const avatarUrl = post.users?.avatar_url || null;
                const userInitial = userName.charAt(0).toUpperCase();
                
                const avatarHtml = avatarUrl
                    ? `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                    : userInitial;
                
                const animDelay = (index % 10) * 0.05;
                const isOwn = currentUserId && post.user_id === currentUserId;
                const isAdmin = currentUserEmail === 'fatihsahinbm@gmail.com';
                const profileHref = post.user_id
                    ? `profile.html?user=${encodeURIComponent(post.user_id)}&name=${encodeURIComponent(userName)}`
                    : 'profile.html';
                const deleteBtn = (isOwn || isAdmin) ? `
                    <button class="pin-delete-btn" data-post-id="${post.id}" data-post-image="${post.image || ''}" title="Gönderiyi Sil"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                ` : '';
                const isSaved = savedPostIds.has(post.id);
                const isLiked = likedPostIds.has(post.id);
                return `
                <div class="feed-item" data-index="${index}" data-post-id="${post.id || ''}" style="animation: fadeInUp 0.6s ease-out ${animDelay}s both;">
                    <div class="feed-img-wrapper">
                        <img src="${post.image}" alt="Kombin" class="feed-img" loading="lazy">
                        <div class="feed-overlay"></div>
                        ${deleteBtn}
                        <button class="pin-save-btn ${isSaved ? 'saved' : ''}" data-post-id="${post.id}" title="Kaydet">${isSaved ? 'Kaydedildi' : 'Kaydet'}</button>
                        <button class="pin-like-btn like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}" title="Beğen" style="${isLiked ? 'color: var(--accent-color);' : ''}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? 'var(--accent-color)' : 'none'}" stroke="${isLiked ? 'var(--accent-color)' : 'currentColor'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                        </button>
                        <button class="pin-share-btn" data-post-id="${post.id}" data-post-image="${post.image || ''}" title="Paylaş">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        </button>
                    </div>
                    <div class="feed-info">
                        <div class="feed-user">
                            <a class="feed-user-link" href="${profileHref}" data-user-id="${post.user_id || ''}" style="display:inline-flex;align-items:center;gap:0.6rem;text-decoration:none;color:inherit;">
                                <div class="user-avatar" style="overflow:hidden;">${avatarHtml}</div>
                                <span class="username">${userName}</span>
                            </a>
                        </div>
                        <p class="feed-desc" title="${post.tag || '#kombin'}">${post.tag || '#kombin'}</p>
                    </div>
                </div>
            `}).join('');
        }
    },

    confirmDialog(title, text, confirmText, onConfirm) {
        const existing = document.getElementById('custom-confirm-modal');
        if (existing) existing.remove();

        const modalHtml = `
            <div class="modal active" id="custom-confirm-modal" style="display: flex; z-index: 9999;">
                <div class="modal-content" style="max-width: 400px; text-align: center; border-top: 4px solid #ff4d4f;">
                    <div class="modal-header" style="justify-content: center; border: none; padding-bottom: 0;">
                        <h2 style="color: var(--primary-color); font-size: 1.5rem; margin-top: 10px;">${title}</h2>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.95rem;">${text}</p>
                        <div style="display: flex; gap: 1rem; justify-content: center;">
                            <button class="btn btn-secondary" id="custom-cancel-btn" style="flex:1;">İptal</button>
                            <button class="btn btn-primary" id="custom-ok-btn" style="flex:1; background: #ff4d4f; border-color: #ff4d4f; color: white;">${confirmText}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('custom-confirm-modal');
        const closeModalFn = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        document.getElementById('custom-cancel-btn').onclick = closeModalFn;
        
        document.getElementById('custom-ok-btn').onclick = async () => {
            const okBtn = document.getElementById('custom-ok-btn');
            okBtn.innerHTML = "Onaylanıyor...";
            okBtn.disabled = true;
            document.getElementById('custom-cancel-btn').disabled = true;
            try {
                await onConfirm();
            } finally {
                closeModalFn();
            }
        };
    },

    populateCities(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const cities = [
            "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce"
        ];
        
        select.innerHTML = '';
        cities.forEach(city => {
            const val = city
                .replace(/İ/g, 'I').replace(/ı/g, 'i')
                .replace(/Ç/g, 'C').replace(/ç/g, 'c')
                .replace(/Ş/g, 'S').replace(/ş/g, 's')
                .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
                .replace(/Ü/g, 'U').replace(/ü/g, 'u')
                .replace(/Ö/g, 'O').replace(/ö/g, 'o');
            
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = city;
            select.appendChild(opt);
        });
    },

    toggleModal(show) {
        const els = this.getElements();
        if(els.modal) {
            if(show) {
                els.modal.classList.add('active');
                els.modal.style.display = 'flex';
            } else {
                els.modal.classList.remove('active');
                setTimeout(() => {
                    els.modal.style.display = 'none';
                }, 300);
            }
        }
    },
    
    setButtonLoading(btnElement, isLoading, originalText) {
        if (!btnElement) return;
        if(isLoading) {
            btnElement.disabled = true;
            btnElement.innerHTML = `<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; display: inline-block; margin: 0 5px 0 0;"></span> Bekleniyor...`;
        } else {
            btnElement.disabled = false;
            btnElement.innerHTML = originalText;
        }
    },

    getFormData() {
        const sourceInputs = document.getElementsByName('source');
        let selectedSource = 'scratch';
        for(let input of sourceInputs) {
            if(input.checked) selectedSource = input.value;
        }

        return {
            source: selectedSource,
            style: document.getElementById('style-select') ? document.getElementById('style-select').value : 'casual',
            budget: document.getElementById('budget-slider') ? document.getElementById('budget-slider').value : 3,
            useWeather: document.getElementById('use-weather') ? document.getElementById('use-weather').checked : true
        };
    }
};

// Automagically inject Dark Mode toggle into Navbars and set theme
(function setupTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    
    window.addEventListener('DOMContentLoaded', () => {
        const navLinks = document.querySelector('.nav-links');
        
        // --- MOBİL MENÜ ENJEKSİYONU VE İLİŞKİLENDİRİLMESİ ---
        const navContainer = document.querySelector('.nav-container');
        if (navContainer) {
            let mobileMenuBtn = navContainer.querySelector('.mobile-menu-btn');
            if (!mobileMenuBtn) {
                mobileMenuBtn = document.createElement('div');
                mobileMenuBtn.className = 'mobile-menu-btn';
                mobileMenuBtn.innerHTML = '☰';
                navContainer.appendChild(mobileMenuBtn);
            }
            
            if (navLinks) {
                mobileMenuBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const isOpen = navLinks.classList.toggle('mobile-active');
                    if (isOpen) {
                        navLinks.style.display = 'flex';
                        navLinks.style.flexDirection = 'column';
                        navLinks.style.position = 'absolute';
                        navLinks.style.top = '64px'; // height of navbar
                        navLinks.style.left = '0';
                        navLinks.style.width = '100%';
                        navLinks.style.backgroundColor = 'var(--surface-color)';
                        navLinks.style.padding = '1rem';
                        navLinks.style.boxShadow = 'var(--shadow-md)';
                        navLinks.style.zIndex = '1000';
                        navLinks.style.gap = '0.5rem';
                    } else {
                        navLinks.style.display = '';
                        navLinks.style.flexDirection = '';
                        navLinks.style.position = '';
                        navLinks.style.top = '';
                        navLinks.style.left = '';
                        navLinks.style.width = '';
                        navLinks.style.backgroundColor = '';
                        navLinks.style.padding = '';
                        navLinks.style.boxShadow = '';
                        navLinks.style.zIndex = '';
                        navLinks.style.gap = '';
                    }
                });
            }
        }

        if (navContainer && !document.getElementById('dark-mode-toggle')) {
            const navActions = document.createElement('div');
            navActions.className = 'nav-actions';
            
            navActions.innerHTML = `
                <a href="#" id="dark-mode-toggle" title="Tema Değiştir" class="nav-action-btn">${saved === 'dark' ? '☀️' : '🌙'}</a>
                <div class="notification-item">
                    <a href="#" id="notif-toggle" title="Bildirimler" class="nav-action-btn">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        <span id="notification-badge" style="display: none;">0</span>
                    </a>
                    <div id="notification-dropdown" class="notification-dropdown">
                        <div style="padding: 1rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                            <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">Bildirimler</h4>
                            <button id="mark-read-btn" style="background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 0.75rem; font-weight: 600;">Tümünü Okundu İşaretle</button>
                        </div>
                        <div id="notification-list-container">
                            <div class="spinner" style="margin: 2rem auto;"></div>
                        </div>
                    </div>
                </div>
            `;
            
            const mobileBtn = navContainer.querySelector('.mobile-menu-btn');
            if (mobileBtn) {
                navContainer.insertBefore(navActions, mobileBtn);
            } else {
                navContainer.appendChild(navActions);
            }

            // Bildirimleri Başlat
            setupNotifications();

            document.getElementById('dark-mode-toggle').addEventListener('click', (e) => {
                e.preventDefault();
                const current = document.documentElement.getAttribute('data-theme');
                if (current === 'dark') {
                    document.documentElement.removeAttribute('data-theme');
                    localStorage.setItem('theme', 'light');
                    e.target.textContent = '🌙';
                } else {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    localStorage.setItem('theme', 'dark');
                    e.target.textContent = '☀️';
                }
            });
        }
    });
})();

async function setupNotifications() {
    const toggle = document.getElementById('notif-toggle');
    const dropdown = document.getElementById('notification-dropdown');
    const badge = document.getElementById('notification-badge');
    const markReadBtn = document.getElementById('mark-read-btn');
    const listContainer = document.getElementById('notification-list-container');

    if (!toggle) return;

    const { api } = await import('./api.js');
    const { utils } = await import('./utils.js');

    const updateBadge = (notifications) => {
        const unreadCount = notifications.filter(n => !n.is_read).length;
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.display = 'flex';
            badge.classList.add('pulse-badge');
        } else {
            badge.style.display = 'none';
            badge.classList.remove('pulse-badge');
        }
    };

    const renderNotifications = (notifications) => {
        if (!notifications || notifications.length === 0) {
            listContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">Henüz bildirim yok.</div>';
            return;
        }

        listContainer.innerHTML = notifications.map(n => {
            const actorName = n.actor?.name || 'Bir kullanıcı';
            const userInitial = actorName.charAt(0).toUpperCase();
            const timeStr = utils.timeAgo ? utils.timeAgo(n.created_at) : new Date(n.created_at).toLocaleDateString();
            
            let actionText = '';
            if (n.type === 'like') actionText = 'gönderini beğendi.';
            else if (n.type === 'comment') actionText = 'gönderine yorum yaptı.';
            else if (n.type === 'follow') actionText = 'seni takip etmeye başladı.';

            const avatarHtml = n.actor?.avatar_url 
                ? `<img src="${n.actor.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">`
                : userInitial;

            const postPreview = n.post?.image 
                ? `<img src="${n.post.image}" class="notification-post-preview" alt="Post">`
                : '';

            return `
                <div class="notification-list-item ${n.is_read ? '' : 'unread'}" 
                     data-id="${n.id}" 
                     data-type="${n.type}" 
                     data-actor-id="${n.actor_id}" 
                     data-actor-name="${encodeURIComponent(actorName)}" 
                     data-post-id="${n.post_id || ''}">
                    <div class="notification-avatar">${avatarHtml}</div>
                    <div class="notification-content">
                        <b>${actorName}</b> ${actionText}
                        <div class="notification-time">${timeStr}</div>
                    </div>
                    ${postPreview}
                </div>
            `;
        }).join('');
    };

    const refreshNotifications = async () => {
        try {
            const notifications = await api.getNotifications();
            updateBadge(notifications);
            if (dropdown.classList.contains('active')) {
                renderNotifications(notifications);
            }
        } catch (err) {
            console.error("Bildirimler yenilenirken hata:", err);
        }
    };

    toggle.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isActive = dropdown.classList.toggle('active');
        if (isActive) {
            listContainer.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';
            const notifications = await api.getNotifications();
            renderNotifications(notifications);
        }
    });

    listContainer.addEventListener('click', async (e) => {
        const item = e.target.closest('.notification-list-item');
        if (!item) return;

        const notifId = item.getAttribute('data-id');
        const type = item.getAttribute('data-type');
        const actorId = item.getAttribute('data-actor-id');
        const actorName = decodeURIComponent(item.getAttribute('data-actor-name'));
        const postId = item.getAttribute('data-post-id');

        // 1) Mark single read in background
        if (item.classList.contains('unread')) {
            try {
                await api.markSingleNotificationAsRead(notifId);
                item.classList.remove('unread');
                // update badge locally
                const currentBadgeVal = parseInt(badge.textContent) || 0;
                if (currentBadgeVal > 1) {
                    badge.textContent = currentBadgeVal - 1;
                } else {
                    badge.style.display = 'none';
                    badge.classList.remove('pulse-badge');
                }
            } catch (err) {
                console.error("Bildirim okunamadı:", err);
            }
        }

        // 2) Close dropdown
        dropdown.classList.remove('active');

        // 3) Navigate
        if (type === 'follow') {
            window.location.href = `profile.html?user=${encodeURIComponent(actorId)}&name=${encodeURIComponent(actorName)}`;
        } else if ((type === 'like' || type === 'comment') && postId) {
            window.location.href = `social.html?post=${encodeURIComponent(postId)}`;
        }
    });

    markReadBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await api.markNotificationsAsRead();
        badge.style.display = 'none';
        badge.classList.remove('pulse-badge');
        const notifications = await api.getNotifications();
        renderNotifications(notifications);
    });

    // Sayfa dışına tıklayınca kapat
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !toggle.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // Periyodik kontrol (isteğe bağlı, her 30 saniyede bir)
    refreshNotifications();
    setInterval(refreshNotifications, 30000);
}
