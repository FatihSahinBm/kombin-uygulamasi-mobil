import { api } from '../api.js';
import { ui } from '../ui.js';
import { auth } from '../auth.js';

export const social = {
    feedData: [],
    currentUserId: null,
    currentUserEmail: null,
    myLikedPostIds: new Set(),
    mySavedPostIds: new Set(),
    _listenersAttached: false,
    currentPost: null,

    async renderComments(postId) {
        const commentsList = document.getElementById('comments-list');
        const commentsSection = document.getElementById('comments-section');
        if (!commentsList) return;
        commentsList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; text-align:center;">Yükleniyor...</p>';
        try {
            const comments = await api.getComments(postId);
            commentsList.innerHTML = '';

            if (comments.length === 0) {
                commentsList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.95rem; font-style: italic; text-align: center; margin-top: 2rem;">Henüz yorum yok. İlk yorumu sen yap!</p>';
                return;
            }

            comments.forEach(comment => {
                const uname = comment.users?.name || 'Kullanıcı';
                const avatarUrl = comment.users?.avatar_url || null;
                const isOwn = comment.user_id === this.currentUserId;
                const date = new Date(comment.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

                const avatarHtml = avatarUrl 
                    ? `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                    : `${uname.charAt(0).toUpperCase()}`;

                const commentDiv = document.createElement('div');
                commentDiv.className = 'comment-item';
                commentDiv.style.cssText = 'display:flex; gap:0.8rem; align-items:flex-start; margin-bottom:0.8rem;';
                commentDiv.innerHTML = `
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-color);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:0.85rem;flex-shrink:0;overflow:hidden;">${avatarHtml}</div>
                    <div style="flex:1;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <span style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-right:0.5rem;">${uname}</span>
                                <span style="font-size:0.95rem;color:var(--text-secondary);word-break:break-word;">${comment.text}</span>
                            </div>
                            ${isOwn ? `<button class="comment-delete-btn" data-id="${comment.id}" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1rem;padding:0.2rem;display:inline-flex;align-items:center;" title="Yorumu Sil"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
                        </div>
                        <div style="font-size:0.75rem;color:#94a3b8;margin-top:0.2rem;">${date}</div>
                    </div>
                `;

                if (isOwn) {
                    commentDiv.querySelector('.comment-delete-btn').addEventListener('click', async () => {
                        try {
                            await api.deleteComment(comment.id);
                            await this.renderComments(postId);
                        } catch (err) {
                            console.error("Yorum silinirken hata:", err);
                        }
                    });
                }

                commentsList.appendChild(commentDiv);
            });

            if (commentsSection) commentsSection.scrollTop = commentsSection.scrollHeight;
        } catch (err) {
            commentsList.innerHTML = '<p style="color:red;text-align:center;">Yorumlar yüklenemedi.</p>';
            console.error(err);
        }
    },

    showPostDetails(post) {
        if (!post) return;
        
        this.currentPost = post;
        
        const detailsModal = document.getElementById('post-details-modal');
        const detailImg = document.getElementById('detail-image');
        const detailUsername = document.getElementById('detail-username');
        const detailUserInitial = document.getElementById('detail-user-initial');
        const detailAvatarContainer = detailUserInitial ? detailUserInitial.parentElement : null;
        const detailDesc = document.getElementById('detail-description');
        const detailLikesCount = document.getElementById('detail-likes-count');
        const detailLikeBtn = document.getElementById('detail-like-btn');
        const detailDeleteBtn = document.getElementById('detail-delete-btn');
        const commentInput = document.getElementById('comment-input');
        
        if (!detailsModal || !detailImg) return;
        
        const uname = post.users?.name || 'Kullanıcı';
        const avatarUrl = post.users?.avatar_url || null;
        
        detailImg.src = post.image;
        detailUsername.textContent = '@' + uname;
        
        if (detailAvatarContainer) {
            if (avatarUrl) {
                detailAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                detailAvatarContainer.innerHTML = `<span id="detail-user-initial">${uname.charAt(0).toUpperCase()}</span>`;
            }
        }
        
        detailDesc.textContent = post.tag || '';

        // Beğeni durumu
        const liked = this.myLikedPostIds.has(post.id);
        detailLikesCount.textContent = post.likes_count || 0;
        detailLikeBtn.classList.toggle('liked', liked);
        detailLikeBtn.style.color = liked ? 'var(--accent-color)' : 'inherit';
        const heartSvg = detailLikeBtn.querySelector('svg');
        if (heartSvg) heartSvg.style.fill = liked ? 'var(--accent-color)' : 'none';

        detailLikeBtn.onclick = () => this._toggleLikeOnDetail(post, detailLikeBtn, detailLikesCount);

        // Detay Modalında Kaydetme Butonu
        const detailSaveBtn = document.getElementById('detail-save-btn');
        if (detailSaveBtn) {
            const saved = this.mySavedPostIds.has(post.id);
            const saveSvg = detailSaveBtn.querySelector('svg');
            if (saved) {
                detailSaveBtn.classList.add('saved');
                detailSaveBtn.style.color = '#e60023';
                if (saveSvg) { saveSvg.style.fill = '#e60023'; saveSvg.style.stroke = '#e60023'; }
            } else {
                detailSaveBtn.classList.remove('saved');
                detailSaveBtn.style.color = 'inherit';
                if (saveSvg) { saveSvg.style.fill = 'none'; saveSvg.style.stroke = 'currentColor'; }
            }
            
            detailSaveBtn.onclick = () => this._toggleSaveOnDetail(post, detailSaveBtn);
        }

        // Detay Modalında Takip Et Butonu
        const detailFollowBtn = document.getElementById('detail-follow-btn');
        const detailUnfollowBtn = document.getElementById('detail-unfollow-btn');
        
        if (detailFollowBtn && detailUnfollowBtn) {
            if (!this.currentUserId || post.user_id === this.currentUserId) {
                detailFollowBtn.style.display = 'none';
                detailUnfollowBtn.style.display = 'none';
            } else {
                api.checkIsFollowing(post.user_id).then(isFollowing => {
                    if (isFollowing) {
                        detailFollowBtn.style.display = 'none';
                        detailUnfollowBtn.style.display = 'inline-flex';
                    } else {
                        detailFollowBtn.style.display = 'inline-flex';
                        detailUnfollowBtn.style.display = 'none';
                    }
                }).catch(err => console.error("Takip durumu kontrol edilemedi", err));

                detailFollowBtn.onclick = async () => {
                    detailFollowBtn.disabled = true;
                    detailFollowBtn.textContent = '...';
                    try {
                        await api.followUser(post.user_id);
                        detailFollowBtn.style.display = 'none';
                        detailUnfollowBtn.style.display = 'inline-flex';
                    } catch(e) {
                        console.error(e);
                    } finally {
                        detailFollowBtn.disabled = false;
                        detailFollowBtn.textContent = 'Takip Et';
                    }
                };
                
                detailUnfollowBtn.onclick = async () => {
                    detailUnfollowBtn.disabled = true;
                    detailUnfollowBtn.textContent = '...';
                    try {
                        await api.unfollowUser(post.user_id);
                        detailUnfollowBtn.style.display = 'none';
                        detailFollowBtn.style.display = 'inline-flex';
                    } catch(e) {
                        console.error(e);
                    } finally {
                        detailUnfollowBtn.disabled = false;
                        detailUnfollowBtn.textContent = 'Takibi Bırak';
                    }
                };
            }
        }

        // Silme butonu göster/gizle
        if (detailDeleteBtn) {
            const isOwn = this.currentUserId && post.user_id === this.currentUserId;
            const isAdmin = this.currentUserEmail === 'fatihsahinbm@gmail.com';
            if (isOwn || isAdmin) {
                detailDeleteBtn.style.display = 'inline-flex';
                detailDeleteBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    this.confirmAndDelete(post.id, post.image);
                };
            } else {
                detailDeleteBtn.style.display = 'none';
            }
        }

        if (commentInput) commentInput.value = '';
        this.renderComments(post.id);
        detailsModal.classList.add('active');
    },

    async openPostById(postId) {
        if (!postId) return;
        let post = this.feedData.find(p => p.id === postId);
        if (!post) {
            post = await api.getPostById(postId);
        }
        if (post) {
            this.showPostDetails(post);
        }
    },

    async init() {
        console.log("Social modülü yüklendi.");
        const user = await auth.getCurrentUser();
        this.currentUserId = user ? user.id : null;
        this.currentUserEmail = user ? user.email : null;
        
        // Önce beğeni ve kaydetmeleri alalım, sonra feed'i yükleyelim ki
        // render ederken Set'ler dolu olsun.
        const [likedIds, savedIds] = await Promise.all([
            api.getMyLikes(),
            api.getMySaves()
        ]);
        this.myLikedPostIds = new Set(likedIds);
        this.mySavedPostIds = new Set(savedIds);
        
        await this.loadFeed();
        
        if (!this._listenersAttached) {
            this.setupEventListeners();
            this._listenersAttached = true;
        }

        // URL param kontrolü
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'new_post') {
            const modal = document.getElementById('add-post-modal');
            if (modal) modal.classList.add('active');
            
            // Parametreyi URL'den temizle (sayfa yenilendiğinde tekrar açılmasın diye)
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({path: cleanUrl}, '', cleanUrl);
        }

        const viewPostId = urlParams.get('post');
        if (viewPostId) {
            await this.openPostById(viewPostId);
            
            // Parametreyi URL'den temizle
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({path: cleanUrl}, '', cleanUrl);
        }
    },

    async loadFeed() {
        try {
            this.feedData = await api.getSocialFeed();
            ui.renderSocialFeed(this.feedData, this.currentUserId, this.mySavedPostIds, this.currentUserEmail, this.myLikedPostIds);
        } catch (error) {
            console.error("Sosyal akış yüklenirken hata:", error);
            const container = document.getElementById('social-feed-container');
            if (container) {
                container.innerHTML = '<p style="color:red; text-align:center;">Akış yüklenemedi. İnternet bağlantınızı kontrol edin.</p>';
            }
        }
    },

    confirmAndDelete(postId, postImage) {
        ui.confirmDialog(
            'Gönderiyi Sil',
            'Bu gönderiyi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
            'Evet, Sil',
            async () => {
                try {
                    await api.deleteSocialPost(postId, postImage);
                    const detailsModal = document.getElementById('post-details-modal');
                    if (detailsModal && detailsModal.classList.contains('active')) {
                        detailsModal.classList.remove('active');
                    }
                    await this.loadFeed();
                    if (ui.showToast) ui.showToast('Gönderi başarıyla silindi!', 'success');
                } catch (err) {
                    console.error("Silme hatası:", err);
                    if (ui.showToast) ui.showToast('Gönderi silinemedi.', 'error');
                }
            }
        );
    },

    setupEventListeners() {
        const addBtn = document.getElementById('add-post-btn');
        const modal = document.getElementById('add-post-modal');
        const closeBtn = document.getElementById('close-post-modal');
        const form = document.getElementById('add-post-form');
        const imageInput = document.getElementById('post-image');
        const imagePreview = document.getElementById('post-image-preview');
        const previewImg = imagePreview ? imagePreview.querySelector('img') : null;
        const submitBtn = document.getElementById('submit-post-btn');

        if (addBtn && modal) {
            addBtn.addEventListener('click', () => modal.classList.add('active'));
        }

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                if (form) form.reset();
                if (imagePreview) imagePreview.style.display = 'none';
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                if (form) form.reset();
                if (imagePreview) imagePreview.style.display = 'none';
            }
            if (e.target === document.getElementById('post-details-modal')) {
                document.getElementById('post-details-modal').classList.remove('active');
            }
        });

        if (imageInput && imagePreview && previewImg) {
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        previewImg.src = event.target.result;
                        imagePreview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                } else {
                    imagePreview.style.display = 'none';
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const file = imageInput.files[0];
                const desc = document.getElementById('post-description').value;
                if (!file || !desc) return;

                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = 'Paylaşılıyor...';
                submitBtn.disabled = true;

                try {
                    // Sosyal paylaşımlar için ayrı bucket kullan
                    const imageUrl = await api.uploadImage(file, 'social_images');
                    await api.shareOutfit({ description: desc, image: imageUrl, style: 'social' });

                    modal.classList.remove('active');
                    form.reset();
                    if (imagePreview) imagePreview.style.display = 'none';

                    await this.loadFeed();
                    ui.showToast('Gönderi başarıyla paylaşıldı!', 'success');
                } catch (err) {
                    console.error("Paylaşım hatası:", err);
                    ui.showToast('Gönderi paylaşılamadı.', 'error');
                } finally {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            });
        }

        // --- Detay Modalı ---
        const detailsModal = document.getElementById('post-details-modal');
        const closeDetailsBtn = document.getElementById('close-details-modal');
        const detailImg = document.getElementById('detail-image');
        const detailUserInitial = document.getElementById('detail-user-initial');
        const detailAvatarContainer = detailUserInitial ? detailUserInitial.parentElement : null;
        const detailUsername = document.getElementById('detail-username');
        const detailDesc = document.getElementById('detail-description');
        const detailLikeBtn = document.getElementById('detail-like-btn');
        const detailLikesCount = document.getElementById('detail-likes-count');
        const commentTriggerBtn = document.getElementById('detail-comment-trigger');
        const commentInput = document.getElementById('comment-input');
        const sendCommentBtn = document.getElementById('send-comment-btn');
        const commentsList = document.getElementById('comments-list');
        const commentsSection = document.getElementById('comments-section');
        const feedContainer = document.getElementById('social-feed-container');
        const detailDeleteBtn = document.getElementById('detail-delete-btn');

        let currentPost = null;

        // Yorumları DB'den çekip render et
        const renderComments = async (postId) => {
            await social.renderComments(postId);
        };

        if (commentTriggerBtn && commentInput) {
            commentTriggerBtn.addEventListener('click', () => commentInput.focus());
        }

        if (sendCommentBtn && commentInput && commentsList) {
            const addComment = async () => {
                const text = commentInput.value.trim();
                if (!text || !social.currentPost) return;

                sendCommentBtn.disabled = true;
                try {
                    await api.addComment(social.currentPost.id, text);
                    commentInput.value = '';
                    await renderComments(social.currentPost.id);
                } catch (err) {
                    console.error("Yorum eklenemedi:", err);
                    ui.showToast('Yorum eklenemedi.', 'error');
                } finally {
                    sendCommentBtn.disabled = false;
                }
            };

            sendCommentBtn.addEventListener('click', addComment);
            commentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); addComment(); }
            });
        }

        let clickTimeout = null;

        // Event delegation: feed kartı tıklamaları
        if (feedContainer) {
            feedContainer.addEventListener('click', (e) => {
                // Profil linkine tıklandıysa kart click'ini (modal) tetikleme
                const userLink = e.target.closest('.feed-user-link');
                if (userLink) {
                    e.stopPropagation();
                    return;
                }

                // Silme butonu
                const deleteBtn = e.target.closest('.pin-delete-btn');
                if (deleteBtn) {
                    e.stopPropagation();
                    this.confirmAndDelete(deleteBtn.getAttribute('data-post-id'), deleteBtn.getAttribute('data-post-image'));
                    return;
                }

                // Kaydet butonu
                const saveBtn = e.target.closest('.pin-save-btn');
                if (saveBtn) {
                    e.stopPropagation();
                    const postId = saveBtn.getAttribute('data-post-id');
                    const isCurrentlySaved = this.mySavedPostIds.has(postId);
                    
                    saveBtn.disabled = true;
                    saveBtn.textContent = '...';
                    
                    if (isCurrentlySaved) {
                        api.unsavePost(postId).then(() => {
                            this.mySavedPostIds.delete(postId);
                            saveBtn.classList.remove('saved');
                            saveBtn.textContent = 'Kaydet';
                        }).catch(err => {
                            console.error('Kaydedilenlerden silinemedi', err);
                            saveBtn.textContent = 'Kaydedildi';
                        }).finally(() => saveBtn.disabled = false);
                    } else {
                        api.savePost(postId).then(() => {
                            this.mySavedPostIds.add(postId);
                            saveBtn.classList.add('saved');
                            saveBtn.textContent = 'Kaydedildi';
                        }).catch(err => {
                            console.error('Kaydedilemedi', err);
                            saveBtn.textContent = 'Kaydet';
                        }).finally(() => saveBtn.disabled = false);
                    }
                    return;
                }

                // Paylaş butonu — native Web Share API, yoksa URL kopyala
                const shareBtn = e.target.closest('.pin-share-btn');
                if (shareBtn) {
                    e.stopPropagation();
                    const imgUrl = shareBtn.getAttribute('data-post-image');
                    if (navigator.share) {
                        navigator.share({ title: 'Kombin.AI', url: imgUrl || window.location.href })
                            .catch(() => {});
                    } else {
                        navigator.clipboard.writeText(imgUrl || window.location.href)
                            .then(() => ui.showToast && ui.showToast('Bağlantı kopyalandı!', 'success'))
                            .catch(() => {});
                    }
                    return;
                }

                // Beğeni butonu (feed kartındaki)
                const likeBtn = e.target.closest('.like-btn');
                if (likeBtn) {
                    e.stopPropagation();
                    this._toggleLikeOnCard(likeBtn, likeBtn.getAttribute('data-post-id'));
                    return;
                }

                if (e.target.closest('.comment-btn')) return;

                // Kart tıklaması → detay modalı aç (çift tıklamayla çakışmaması için geciktiriyoruz)
                const item = e.target.closest('.feed-item');
                if (item && detailsModal) {
                    if (clickTimeout) {
                        clearTimeout(clickTimeout);
                        clickTimeout = null;
                        return;
                    }

                    clickTimeout = setTimeout(() => {
                        clickTimeout = null;
                        const index = item.getAttribute('data-index');
                        const post = this.feedData[index];
                        if (!post) return;

                        social.showPostDetails(post);
                    }, 250);
                }
            });

            // Event delegation: feed kartı çift tıklamaları (beğenme aksiyonu)
            feedContainer.addEventListener('dblclick', async (e) => {
                const item = e.target.closest('.feed-item');
                if (item) {
                    const imgWrapper = e.target.closest('.feed-img-wrapper');
                    if (imgWrapper) {
                        const postId = item.getAttribute('data-post-id');
                        const likeBtn = item.querySelector('.pin-like-btn');
                        if (postId && likeBtn) {
                            const isLiked = this.myLikedPostIds.has(postId);
                            if (!isLiked) {
                                await this._toggleLikeOnCard(likeBtn, postId);
                            }
                            this._showHeartPopupAnimation(imgWrapper);
                        }
                    }
                }
            });
        }

        if (closeDetailsBtn && detailsModal) {
            closeDetailsBtn.addEventListener('click', () => detailsModal.classList.remove('active'));
        }

        // --- Lens: görsel tıklama → yerel CLIP worker ile analiz ---
        const scanningOverlay = document.getElementById('lens-scanning-overlay');
        const lensHint = document.getElementById('lens-hint');
        const lensModal = document.getElementById('lens-modal');
        const closeLensBtn = document.getElementById('close-lens-modal');
        const lensBody = document.getElementById('lens-modal-body');

        // Tıklanan Y% → beden bölgesi haritalaması (Google Lens mantığı)
        const getClickedRegion = (e) => {
            const rect = detailImg.getBoundingClientRect();
            const yPct = (e.clientY - rect.top) / rect.height;
            if (yPct < 0.38) return 'top garment';
            if (yPct < 0.72) return 'bottom garment';
            return 'footwear';
        };

        // Belirtilen beden bölgesine göre base64 görüntüyü kırpar
        const cropRegion = (fullBase64, region) => new Promise((resolve) => {
            const regionMap = {
                'top garment':    { sy: 0.05, sh: 0.35 },
                'outerwear':      { sy: 0.03, sh: 0.42 },
                'bottom garment': { sy: 0.38, sh: 0.34 },
                'footwear':       { sy: 0.72, sh: 0.28 },
                'accessory':      { sy: 0, sh: 1 }
            };
            const r = regionMap[region] || regionMap['top garment'];
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const srcY = Math.round(img.height * r.sy);
                const srcH = Math.round(img.height * r.sh);
                canvas.width = img.width;
                canvas.height = srcH;
                canvas.getContext('2d').drawImage(img, 0, srcY, img.width, srcH, 0, 0, img.width, srcH);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => resolve(fullBase64);
            img.src = fullBase64;
        });

        // Tam görseli çizer, tıklanan bölge dışını karartır → Google Lens seçim efekti
        const annotateRegion = (fullBase64, region) => new Promise((resolve) => {
            const regionMap = {
                'top garment':    { sy: 0.0,  sh: 0.38 },
                'outerwear':      { sy: 0.0,  sh: 0.45 },
                'bottom garment': { sy: 0.38, sh: 0.34 },
                'footwear':       { sy: 0.72, sh: 0.28 },
                'accessory':      { sy: 0.0,  sh: 1.0  }
            };
            const r = regionMap[region] || regionMap['top garment'];
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                // 1) Tam görseli çiz
                ctx.drawImage(img, 0, 0);

                const selY = Math.round(img.height * r.sy);
                const selH = Math.round(img.height * r.sh);

                // 2) Seçili bölge dışını yarı saydam siyahla karart
                ctx.fillStyle = 'rgba(0,0,0,0.52)';
                if (selY > 0) ctx.fillRect(0, 0, img.width, selY);                            // üst
                if (selY + selH < img.height) ctx.fillRect(0, selY + selH, img.width, img.height - selY - selH); // alt

                // 3) Seçili bölge etrafına parlak mavi çerçeve çiz
                ctx.strokeStyle = '#4285f4';
                ctx.lineWidth = Math.max(3, img.width * 0.005);
                ctx.strokeRect(2, selY + 2, img.width - 4, selH - 4);

                resolve(canvas.toDataURL('image/jpeg', 0.90));
            };
            img.onerror = () => resolve(fullBase64);
            img.src = fullBase64;
        });

        if (detailImg) {
            detailImg.style.cursor = 'crosshair';
            detailImg.addEventListener('click', async (e) => {
                if (!social.currentPost?.image) return;

                const clickedRegion = getClickedRegion(e);
                if (lensHint) lensHint.style.display = 'none';
                if (scanningOverlay) scanningOverlay.style.display = 'flex';

                try {
                    // Gardıroba ekle için kırpılmış görsel hazırla (arka planda)
                    const fullBase64 = await this._imageUrlToBase64(social.currentPost.image);
                    const croppedBase64 = await cropRegion(fullBase64, clickedRegion);

                    // Kırpılan görseli Supabase'e yükle (gardıroba ekle için)
                    const res = await fetch(croppedBase64);
                    const blob = await res.blob();
                    const file = new File([blob], `lens-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    const croppedPublicUrl = await api.uploadImage(file, 'social_images');

                    this._showLensResult(social.currentPost.image, croppedPublicUrl, clickedRegion, lensModal, lensBody);
                } catch (err) {
                    console.error('Lens hatası:', err);
                    if (ui.showToast) ui.showToast('Kıyafet analiz edilemedi.', 'error');
                } finally {
                    if (scanningOverlay) scanningOverlay.style.display = 'none';
                    if (lensHint) lensHint.style.display = 'block';
                }
            });
        }

        if (closeLensBtn && lensModal) {
            closeLensBtn.addEventListener('click', () => lensModal.classList.remove('active'));
        }
        window.addEventListener('click', (e) => {
            if (e.target === lensModal) lensModal.classList.remove('active');
        });
    },

    // Görseli CORS proxy üzerinden base64'e çevirir
    async _imageUrlToBase64(url) {
        // Canvas yöntemi: resmi img tag'e yükle, canvas'a çiz, base64 al
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Performans için max 512px'e küçült
                const maxSize = 512;
                const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
                canvas.width = Math.round(img.width * ratio);
                canvas.height = Math.round(img.height * ratio);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => reject(new Error('Görsel yüklenemedi'));
            img.src = url;
        });
    },

    _showLensResult(originalImageUrl, croppedPublicUrl, clickedRegion, lensModal, lensBody) {
        const catMap = {
            'top garment':    { label: 'Üst Giyim',  category: 'ust' },
            'outerwear':      { label: 'Dış Giyim',  category: 'dis_giyim' },
            'bottom garment': { label: 'Alt Giyim',  category: 'alt' },
            'footwear':       { label: 'Ayakkabı',   category: 'ayakkabi' },
            'accessory':      { label: 'Aksesuar',   category: 'aksesuar' },
        };
        const catInfo = catMap[clickedRegion] || catMap['top garment'];

        // Orijinal fotoğrafı olduğu gibi Google Lens'e gönder
        const googleLensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(originalImageUrl)}`;
        const shopBtnStyle = (bg) => `display:flex;align-items:center;gap:10px;padding:0.9rem 1.2rem;border-radius:12px;text-decoration:none;color:white;background:${bg};font-weight:600;font-size:0.95rem;transition:opacity 0.15s;`;

        lensBody.innerHTML = `
            <div style="margin-bottom:1.2rem;padding:1rem;background:var(--secondary-color);border-radius:12px;display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <div style="font-size:1.05rem;font-weight:700;">Kombin Seçildi</div>
                    <div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">Seçilen kombini gardırobuna ekle!</div>
                </div>
                <button id="lens-add-wardrobe-btn" style="background:var(--primary-color);color:white;border:none;border-radius:20px;padding:0.5rem 1.1rem;font-size:0.85rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0;margin-left:0.8rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Gardıroba Ekle
                </button>
            </div>

            <a href="${googleLensUrl}" target="_blank" rel="noopener"
                style="${shopBtnStyle('linear-gradient(135deg,#4285f4,#34a853)')};justify-content:center;font-size:1.05rem;padding:1rem 1.5rem;margin-bottom:0.5rem;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Google Lens ile Ara
                <span style="font-size:0.78rem;opacity:0.85;margin-left:auto;">Fiyat + Birebir Ürün</span>
            </a>
            <p style="font-size:0.78rem;color:var(--text-muted);text-align:center;margin-top:0.4rem;">
                Yeni sekmede Google Lens açılır → aynı ürünü listeler → fiyatları gösterir
            </p>
        `;

        lensModal.classList.add('active');

        document.getElementById('lens-add-wardrobe-btn')?.addEventListener('click', () => {
            sessionStorage.setItem('pendingSocialImage', originalImageUrl);
            sessionStorage.setItem('pendingSocialCategory', catInfo.category);
            sessionStorage.setItem('pendingSocialLabel', catInfo.label);
            window.location.href = 'wardrobe.html';
        });
    },

    async _toggleLikeOnCard(btn, postId) {
        const liked = this.myLikedPostIds.has(postId);
        const countEl = btn.querySelector('.like-count');
        const heartSvg = btn.querySelector('svg');
        try {
            if (liked) {
                await api.unlikePost(postId);
                this.myLikedPostIds.delete(postId);
                if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
                btn.classList.remove('liked');
                btn.style.color = 'inherit';
                if (heartSvg) {
                    heartSvg.setAttribute('fill', 'none');
                    heartSvg.setAttribute('stroke', 'currentColor');
                }
            } else {
                await api.likePost(postId);
                this.myLikedPostIds.add(postId);
                if (countEl) countEl.textContent = parseInt(countEl.textContent || 0) + 1;
                btn.classList.add('liked');
                btn.style.color = 'var(--accent-color)';
                if (heartSvg) {
                    heartSvg.setAttribute('fill', 'var(--accent-color)');
                    heartSvg.setAttribute('stroke', 'var(--accent-color)');
                }
            }

            // Eğer detay modalı aktifse ve açık olan post bu ise orayı da güncelle
            const detailsModal = document.getElementById('post-details-modal');
            if (detailsModal && detailsModal.classList.contains('active')) {
                const detailLikeBtn = document.getElementById('detail-like-btn');
                const detailLikesCount = document.getElementById('detail-likes-count');
                if (detailLikeBtn && detailLikesCount) {
                    const detailHeart = detailLikeBtn.querySelector('svg');
                    const likedNow = this.myLikedPostIds.has(postId);
                    detailLikeBtn.classList.toggle('liked', likedNow);
                    detailLikeBtn.style.color = likedNow ? 'var(--accent-color)' : 'inherit';
                    if (detailHeart) {
                        detailHeart.style.fill = likedNow ? 'var(--accent-color)' : 'none';
                        detailHeart.style.stroke = likedNow ? 'var(--accent-color)' : 'currentColor';
                    }
                    const currentCount = parseInt(detailLikesCount.textContent || 0);
                    detailLikesCount.textContent = likedNow ? currentCount + 1 : Math.max(0, currentCount - 1);
                }
            }
        } catch (err) {
            console.error("Beğeni hatası:", err);
        }
    },

    async _toggleLikeOnDetail(post, btn, countEl) {
        const liked = this.myLikedPostIds.has(post.id);
        const heartSvg = btn.querySelector('svg');
        try {
            if (liked) {
                await api.unlikePost(post.id);
                this.myLikedPostIds.delete(post.id);
                countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
                btn.classList.remove('liked');
                btn.style.color = 'inherit';
                if (heartSvg) { heartSvg.style.fill = 'none'; heartSvg.style.stroke = 'currentColor'; heartSvg.style.transform = 'scale(1)'; }
            } else {
                await api.likePost(post.id);
                this.myLikedPostIds.add(post.id);
                countEl.textContent = parseInt(countEl.textContent || 0) + 1;
                btn.classList.add('liked');
                btn.style.color = 'var(--accent-color)';
                if (heartSvg) { heartSvg.style.fill = 'var(--accent-color)'; heartSvg.style.stroke = 'var(--accent-color)'; heartSvg.style.transform = 'scale(1.15)'; }
            }

            // Grid'deki ilgili kartı da güncelle
            const cardLikeBtn = document.querySelector(`.pin-like-btn[data-post-id="${post.id}"]`);
            if (cardLikeBtn) {
                const cardHeart = cardLikeBtn.querySelector('svg');
                const likedNow = this.myLikedPostIds.has(post.id);
                cardLikeBtn.classList.toggle('liked', likedNow);
                cardLikeBtn.style.color = likedNow ? 'var(--accent-color)' : 'inherit';
                if (cardHeart) {
                    cardHeart.setAttribute('fill', likedNow ? 'var(--accent-color)' : 'none');
                    cardHeart.setAttribute('stroke', likedNow ? 'var(--accent-color)' : 'currentColor');
                }
            }
        } catch (err) {
            console.error("Beğeni hatası:", err);
        }
    },

    _showHeartPopupAnimation(container) {
        const heart = document.createElement('div');
        heart.className = 'heart-pop-animation';
        heart.innerHTML = `<svg width="90" height="90" viewBox="0 0 24 24" fill="#f43f5e" stroke="#ffffff" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
        container.appendChild(heart);
        setTimeout(() => {
            heart.remove();
        }, 850);
    },

    async _toggleSaveOnDetail(post, btn) {
        const saved = this.mySavedPostIds.has(post.id);
        const saveSvg = btn.querySelector('svg');
        try {
            if (saved) {
                await api.unsavePost(post.id);
                this.mySavedPostIds.delete(post.id);
                btn.classList.remove('saved');
                btn.style.color = 'inherit';
                if (saveSvg) { saveSvg.style.fill = 'none'; saveSvg.style.stroke = 'currentColor'; }
            } else {
                await api.savePost(post.id);
                this.mySavedPostIds.add(post.id);
                btn.classList.add('saved');
                btn.style.color = '#e60023';
                if (saveSvg) { saveSvg.style.fill = '#e60023'; saveSvg.style.stroke = '#e60023'; }
            }
            
            // Eğer varsa grid'deki pini de güncelle
            const gridSaveBtn = document.querySelector(`.pin-save-btn[data-post-id="${post.id}"]`);
            if (gridSaveBtn) {
                if (this.mySavedPostIds.has(post.id)) {
                    gridSaveBtn.classList.add('saved');
                    gridSaveBtn.textContent = 'Kaydedildi';
                } else {
                    gridSaveBtn.classList.remove('saved');
                    gridSaveBtn.textContent = 'Kaydet';
                }
            }
        } catch (err) {
            console.error("Kaydetme hatası:", err);
        }
    }
};
