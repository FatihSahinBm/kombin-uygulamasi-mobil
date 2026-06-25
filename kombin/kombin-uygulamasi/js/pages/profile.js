import { api } from '../api.js';

export const profile = {
    async init() {
        console.log("Profile modülü yüklendi.");

        // URL'den başka kullanıcının profili mi görüntüleniyor?
        const params = new URLSearchParams(window.location.search);
        const viewUserId = params.get('user');
        const viewName = params.get('name');

        const isOwnProfile = !viewUserId;

        try {
            const currentUserId = await api.getCurrentUserId();
            const myLikedPostIds = new Set(await api.getMyLikes());
            const mySavedPostIds = new Set();
            try {
                const savedIds = await api.getMySaves();
                savedIds.forEach(id => mySavedPostIds.add(id));
            } catch (e) {
                console.warn("Kaydedilenler yüklenemedi:", e);
            }

            let targetUser, posts, wardrobeCount = 0;
            let savedPosts = [];
            let followStats = { followers: 0, following: 0 };
            let isFollowing = false;
            let currentUserProfile = null;

            if (isOwnProfile) {
                targetUser = await api.getUserProfile();
                if (!targetUser) { window.location.href = 'login.html'; return; }
                currentUserProfile = targetUser;
                const [userPosts, savedPostsData] = await Promise.all([
                    api.getUserPosts(targetUser.id),
                    api.getSavedPosts(targetUser.id)
                ]);
                posts = userPosts;
                savedPosts = savedPostsData;
                followStats = await api.getFollowStats(targetUser.id);
            } else {
                // Başka kullanıcının profili
                currentUserProfile = await api.getUserProfile();
                let fetchedData = null;
                const { supabase } = await import('../config.js');
                if (supabase) {
                    const res = await this._fetchOtherUser(viewUserId);
                    fetchedData = res.data;
                }
                
                targetUser = fetchedData || { id: viewUserId, name: viewName || 'Kullanıcı', metadata: {}, preferences: {} };
                if (viewName && (!targetUser.name || targetUser.name === 'Kullanıcı')) {
                    targetUser.name = viewName;
                }
                posts = await api.getUserPosts(viewUserId);
                followStats = await api.getFollowStats(viewUserId);
                isFollowing = await api.checkIsFollowing(viewUserId);
            }

            this._renderHeader(targetUser, posts.length, wardrobeCount, isOwnProfile, followStats, isFollowing);

            // Yorum yazan avatarını güncelle
            const commentAvatarEl = document.getElementById('profile-comment-avatar');
            if (commentAvatarEl && currentUserProfile) {
                const curName = currentUserProfile.name || 'Kullanıcı';
                const curAvatarUrl = currentUserProfile.avatar_url;
                commentAvatarEl.innerHTML = curAvatarUrl
                    ? `<img src="${curAvatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                    : `<span>${curName.charAt(0).toUpperCase()}</span>`;
            }

            this._renderGrid(posts, { currentUserId, myLikedPostIds, mySavedPostIds, emptyMessage: 'Henüz paylaşım yok' });

            const tabPosts = document.getElementById('tab-posts');
            const tabSaved = document.getElementById('tab-saved');

            if (isOwnProfile && tabSaved && tabPosts) {
                tabSaved.style.display = 'block';
                
                tabPosts.onclick = () => {
                    tabPosts.classList.add('active');
                    tabSaved.classList.remove('active');
                    this._renderGrid(posts, { currentUserId, myLikedPostIds, mySavedPostIds, emptyMessage: 'Henüz paylaşım yok' });
                };
                
                tabSaved.onclick = () => {
                    tabSaved.classList.add('active');
                    tabPosts.classList.remove('active');
                    this._renderGrid(savedPosts, { currentUserId, myLikedPostIds, mySavedPostIds, emptyMessage: 'Henüz kaydedilmiş gönderi yok' });
                };
            }

            if (isOwnProfile) {
                this._setupEditProfile(targetUser);
                this._setupSettings(targetUser);
            }

        } catch (err) {
            console.error("Profil yüklenirken hata:", err);
        }
    },

    async _fetchOtherUser(userId) {
        const { supabase } = await import('../config.js');
        const res = await supabase.from('users').select('*').eq('id', userId).single();
        if (res.error) console.error("Kullanıcı bilgisi çekilirken hata:", res.error.message);
        return res;
    },

    _renderHeader(user, postCount, wardrobeCount, isOwnProfile, followStats, isFollowing) {
        const name = user.name || user.email?.split('@')[0] || 'Kullanıcı';
        const meta = user.metadata || {};
        const prefs = user.preferences || {};
        const avatarUrl = user.avatar_url;

        const avatarEl = document.getElementById('profile-avatar');
        if (avatarUrl) {
            avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }

        document.getElementById('profile-username').textContent = name;
        
        let bioEl = document.getElementById('profile-bio');
        if (!bioEl) {
            bioEl = document.createElement('div');
            bioEl.id = 'profile-bio';
            bioEl.className = 'profile-bio';
            
            const statsContainer = document.querySelector('.profile-stats');
            if (statsContainer) {
                statsContainer.after(bioEl);
            } else {
                document.getElementById('profile-username').after(bioEl);
            }
        }
        bioEl.textContent = user.bio || '';
        if (!user.bio) bioEl.style.display = 'none';
        else bioEl.style.display = 'block';
        document.getElementById('stat-posts').textContent = postCount;
        
        const statFollowersEl = document.getElementById('stat-followers');
        const statFollowingEl = document.getElementById('stat-following');
        if (statFollowersEl) statFollowersEl.textContent = followStats?.followers || 0;
        if (statFollowingEl) statFollowingEl.textContent = followStats?.following || 0;

        const wardrobeEl = document.getElementById('stat-wardrobe');
        if (wardrobeEl) {
            wardrobeEl.textContent = wardrobeCount;
            const wardrobeStat = wardrobeEl.closest('.profile-stat');
            if (wardrobeStat) wardrobeStat.style.display = 'none';
        }

        // Profil etiketleri (stil, cinsiyet, yaş)
        const tags = [];
        if (prefs.style) prefs.style.split(',').forEach(s => s.trim() && tags.push(s.trim()));
        if (meta.gender === 'erkek') tags.push('Erkek');
        else if (meta.gender === 'kadin') tags.push('Kadın');
        if (meta.age) tags.push(meta.age + ' yaş');
        if (meta.bodyType && meta.bodyType !== 'unknown') tags.push(meta.bodyType);

        const tagsEl = document.getElementById('profile-tags');
        tagsEl.innerHTML = tags.map(t => `<span class="profile-tag">${t}</span>`).join('');

        // Aksiyon Butonları (Kendi profili mi, başkasının mı?)
        const btnEditProfile = document.getElementById('btn-edit-profile');
        const btnSettings = document.getElementById('btn-settings');
        const btnSharePost = document.getElementById('btn-share-post');
        const btnFollow = document.getElementById('btn-follow');
        const btnUnfollow = document.getElementById('btn-unfollow');

        if (isOwnProfile) {
            if (btnEditProfile) btnEditProfile.style.display = 'inline-flex';
            if (btnSettings) btnSettings.style.display = 'inline-flex';
            if (btnSharePost) btnSharePost.style.display = 'inline-flex';
            if (btnFollow) btnFollow.style.display = 'none';
            if (btnUnfollow) btnUnfollow.style.display = 'none';
        } else {
            if (btnEditProfile) btnEditProfile.style.display = 'none';
            if (btnSettings) btnSettings.style.display = 'none';
            if (btnSharePost) btnSharePost.style.display = 'none';
            
            if (isFollowing) {
                if (btnFollow) btnFollow.style.display = 'none';
                if (btnUnfollow) btnUnfollow.style.display = 'inline-flex';
            } else {
                if (btnFollow) btnFollow.style.display = 'inline-flex';
                if (btnUnfollow) btnUnfollow.style.display = 'none';
            }

            // Takip et / bırak olayları
            if (btnFollow) {
                btnFollow.onclick = async () => {
                    try {
                        btnFollow.disabled = true;
                        btnFollow.textContent = 'İşleniyor...';
                        await api.followUser(user.id);
                        let currentFollowers = parseInt(statFollowersEl?.textContent) || 0;
                        if (statFollowersEl) statFollowersEl.textContent = currentFollowers + 1;
                        btnFollow.style.display = 'none';
                        if (btnUnfollow) btnUnfollow.style.display = 'inline-flex';
                    } catch (e) {
                        console.error('Takip edilemedi:', e);
                        alert('Takip işlemi başarısız oldu.');
                    } finally {
                        btnFollow.disabled = false;
                        btnFollow.textContent = 'Takip Et';
                    }
                };
            }

            if (btnUnfollow) {
                btnUnfollow.onclick = async () => {
                    try {
                        btnUnfollow.disabled = true;
                        btnUnfollow.textContent = 'İşleniyor...';
                        await api.unfollowUser(user.id);
                        let currentFollowers = parseInt(statFollowersEl?.textContent) || 0;
                        if (statFollowersEl) statFollowersEl.textContent = Math.max(0, currentFollowers - 1);
                        btnUnfollow.style.display = 'none';
                        if (btnFollow) btnFollow.style.display = 'inline-flex';
                    } catch (e) {
                        console.error('Takip bırakılamadı:', e);
                        alert('Takip bırakma işlemi başarısız oldu.');
                    } finally {
                        btnUnfollow.disabled = false;
                        btnUnfollow.textContent = 'Takibi Bırak';
                    }
                };
            }
        }

        // Takip listesi modalleri
        const followModal = document.getElementById('follow-modal');
        const followModalTitle = document.getElementById('follow-modal-title');
        const followListContainer = document.getElementById('follow-list-container');
        const closeFollowModal = document.getElementById('close-follow-modal');
        const followSearchInput = document.getElementById('follow-search-input');

        let currentFollowList = [];
        let currentFollowType = '';

        const renderFollowList = (listToRender) => {
            if (listToRender.length === 0) {
                followListContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Kişi bulunamadı.</p>';
                return;
            }

            followListContainer.innerHTML = listToRender.map(item => {
                const avatarHtml = item.avatar_url
                    ? `<img src="${item.avatar_url}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
                    : item.name.charAt(0).toUpperCase();

                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.8rem 1rem; background: var(--bg-color); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                        <a href="profile.html?user=${item.id}&name=${encodeURIComponent(item.name)}" style="display:flex; align-items:center; gap: 1rem; text-decoration:none; color:inherit; flex: 1; overflow: hidden;">
                            <div style="width:42px; height:42px; border-radius:50%; background:var(--primary-color); color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size: 1.1rem; flex-shrink: 0; overflow: hidden;">
                                ${avatarHtml}
                            </div>
                            <strong style="font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; color: var(--text-primary);">${item.name}</strong>
                        </a>
                        ${isOwnProfile && currentFollowType === 'followers' ? `<button class="btn remove-follower-btn" data-id="${item.id}" style="padding: 0.4rem 0.9rem; font-size: 0.85rem; background: var(--secondary-color); color: var(--text-primary); border: none; border-radius: 20px; cursor: pointer; font-weight: 600; flex-shrink: 0; margin-left: 0.5rem;">Çıkar</button>` : ''}
                        ${isOwnProfile && currentFollowType === 'following' ? `<button class="btn unfollow-btn" data-id="${item.id}" style="padding: 0.4rem 0.9rem; font-size: 0.85rem; background: var(--secondary-color); color: var(--text-primary); border: none; border-radius: 20px; cursor: pointer; font-weight: 600; flex-shrink: 0; margin-left: 0.5rem;">Takibi Bırak</button>` : ''}
                    </div>
                `;
            }).join('');

            // Çıkarma butonu event listener'ları
            if (isOwnProfile && currentFollowType === 'followers') {
                followListContainer.querySelectorAll('.remove-follower-btn').forEach(btn => {
                    btn.onclick = async (e) => {
                        const followerId = e.target.getAttribute('data-id');
                        e.target.disabled = true;
                        e.target.textContent = '...';
                        try {
                            await api.removeFollower(followerId);
                            // Listeden kalıcı olarak sil
                            currentFollowList = currentFollowList.filter(u => String(u.id) !== String(followerId));
                            e.target.closest('div').remove();
                            let currentFollowers = parseInt(statFollowersEl?.textContent) || 0;
                            if (statFollowersEl) statFollowersEl.textContent = Math.max(0, currentFollowers - 1);
                            if (followListContainer.children.length === 0) {
                                followListContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Kimse yok.</p>';
                            }
                        } catch (err) {
                            console.error('Takipçi çıkarılamadı', err);
                            e.target.disabled = false;
                            e.target.textContent = 'Çıkar';
                        }
                    };
                });
            }

            // Takibi bırak butonu event listener'ları
            if (isOwnProfile && currentFollowType === 'following') {
                followListContainer.querySelectorAll('.unfollow-btn').forEach(btn => {
                    btn.onclick = async (e) => {
                        const followingId = e.target.getAttribute('data-id');
                        e.target.disabled = true;
                        e.target.textContent = '...';
                        try {
                            await api.unfollowUser(followingId);
                            // Listeden kalıcı olarak sil
                            currentFollowList = currentFollowList.filter(u => String(u.id) !== String(followingId));
                            e.target.closest('div').remove();
                            
                            const statFollowingEl = document.getElementById('stat-following');
                            let currentFollowing = parseInt(statFollowingEl?.textContent) || 0;
                            if (statFollowingEl) statFollowingEl.textContent = Math.max(0, currentFollowing - 1);
                            
                            if (followListContainer.children.length === 0) {
                                followListContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Kimse yok.</p>';
                            }
                        } catch (err) {
                            console.error('Takip bırakılamadı', err);
                            e.target.disabled = false;
                            e.target.textContent = 'Takibi Bırak';
                        }
                    };
                });
            }
        };

        if (followSearchInput) {
            followSearchInput.oninput = (e) => {
                const term = e.target.value.toLowerCase().trim();
                if (!term) {
                    renderFollowList(currentFollowList);
                } else {
                    const filtered = currentFollowList.filter(u => u.name.toLowerCase().includes(term));
                    renderFollowList(filtered);
                }
            };
        }

        const openFollowModal = async (type) => {
            if (!followModal) return;
            followModal.classList.add('active');
            currentFollowType = type;
            followModalTitle.textContent = type === 'followers' ? 'Takipçiler' : 'Takip Edilenler';
            followListContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Yükleniyor...</p>';
            if (followSearchInput) followSearchInput.value = '';
            
            try {
                const list = type === 'followers' 
                    ? await api.getFollowersList(user.id) 
                    : await api.getFollowingList(user.id);
                
                currentFollowList = list;
                renderFollowList(list);

            } catch (err) {
                console.error('Liste yüklenemedi', err);
                followListContainer.innerHTML = '<p style="text-align:center;color:#ef4444;">Hata oluştu.</p>';
            }
        };

        const statFollowersContainer = document.getElementById('stat-followers-container');
        const statFollowingContainer = document.getElementById('stat-following-container');

        if (statFollowersContainer) statFollowersContainer.onclick = () => openFollowModal('followers');
        if (statFollowingContainer) statFollowingContainer.onclick = () => openFollowModal('following');
        if (closeFollowModal) closeFollowModal.onclick = () => followModal.classList.remove('active');
        if (followModal) followModal.onclick = (e) => { if (e.target === followModal) followModal.classList.remove('active'); };

    },

    _renderGrid(posts, { currentUserId = null, myLikedPostIds = new Set(), mySavedPostIds = new Set(), emptyMessage = 'Henüz paylaşım yok' } = {}) {
        const grid = document.getElementById('profile-grid');
        const modal = document.getElementById('profile-post-modal');
        const closeBtn = document.getElementById('close-profile-post-modal');
        const detailImg = document.getElementById('profile-detail-image');
        const detailDesc = document.getElementById('profile-detail-description');
        const likeBtn = document.getElementById('profile-detail-like-btn');
        const likesCountEl = document.getElementById('profile-detail-likes-count');
        const commentsCountEl = document.getElementById('profile-detail-comments-count');
        const commentsListEl = document.getElementById('profile-comments-list');
        const commentInput = document.getElementById('profile-comment-input');
        const sendCommentBtn = document.getElementById('profile-send-comment-btn');
        const saveBtn = document.getElementById('profile-detail-save-btn');
        const deleteBtn = document.getElementById('profile-detail-delete-btn');
        const shareBtn = document.getElementById('profile-detail-share-btn');

        let currentPost = null;

        const setLikeUi = (liked) => {
            if (!likeBtn) return;
            likeBtn.classList.toggle('liked', liked);
            likeBtn.style.color = liked ? 'var(--accent-color)' : 'inherit';
            const heartSvg = likeBtn.querySelector('svg');
            if (heartSvg) heartSvg.style.fill = liked ? 'var(--accent-color)' : 'none';
        };

        const setSaveUi = (saved) => {
            if (!saveBtn) return;
            saveBtn.classList.toggle('saved', saved);
            saveBtn.style.color = saved ? '#e60023' : 'inherit';
            const saveSvg = saveBtn.querySelector('svg');
            if (saveSvg) {
                saveSvg.style.fill = saved ? '#e60023' : 'none';
                saveSvg.style.stroke = saved ? '#e60023' : 'currentColor';
            }
        };

        const renderComments = (comments) => {
            if (!commentsListEl) return;
            commentsListEl.innerHTML = '';
            if (!comments || comments.length === 0) {
                commentsListEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.95rem; font-style: italic; text-align: center; margin-top: 1.2rem;">Henüz yorum yok. İlk yorumu sen yap!</p>';
                return;
            }
            comments.forEach(c => {
                const uname = c.users?.name || 'Kullanıcı';
                const avatarUrl = c.users?.avatar_url || null;
                const isOwn = currentUserId && String(c.user_id) === String(currentUserId);
                const date = new Date(c.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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
                                <span style="font-size:0.95rem;color:var(--text-secondary);word-break:break-word;">${c.text || ''}</span>
                            </div>
                            ${isOwn ? `<button class="comment-delete-btn" data-id="${c.id}" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1rem;padding:0.2rem;display:inline-flex;align-items:center;" title="Yorumu Sil"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
                        </div>
                        <div style="font-size:0.75rem;color:#94a3b8;margin-top:0.2rem;">${date}</div>
                    </div>
                `;

                if (isOwn) {
                    const deleteBtn = commentDiv.querySelector('.comment-delete-btn');
                    if (deleteBtn) {
                        deleteBtn.onclick = async () => {
                            try {
                                await api.deleteComment(c.id);
                                const newComments = await loadComments(currentPost.id);
                                currentPost.comments_count = newComments.length;
                                if (commentsCountEl) commentsCountEl.textContent = `💬 ${currentPost.comments_count || 0}`;
                            } catch (err) {
                                console.error("Yorum silinirken hata:", err);
                            }
                        };
                    }
                }

                commentsListEl.appendChild(commentDiv);
            });
            const section = document.getElementById('profile-comments-section');
            if (section) section.scrollTop = section.scrollHeight;
        };

        const loadComments = async (postId) => {
            if (!commentsListEl) return [];
            commentsListEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.95rem; font-style: italic; text-align: center; margin-top: 1.2rem;">Yorumlar yükleniyor...</p>';
            try {
                const comments = await api.getComments(postId);
                renderComments(comments);
                return comments;
            } catch (err) {
                console.error('Yorumlar yüklenemedi:', err);
                commentsListEl.innerHTML = '<p style="color: #ef4444; font-size: 0.95rem; text-align: center; margin-top: 1.2rem;">Yorumlar yüklenemedi.</p>';
                return [];
            }
        };

        const closeModal = () => {
            if (!modal) return;
            modal.classList.remove('active');
            currentPost = null;
            if (detailImg) detailImg.src = '';
            if (detailDesc) detailDesc.textContent = '';
            if (commentsListEl) commentsListEl.innerHTML = '';
            if (commentInput) commentInput.value = '';
            const avatarEl = document.getElementById('profile-detail-avatar');
            const usernameLink = document.getElementById('profile-detail-username-link');
            if (avatarEl) avatarEl.innerHTML = '';
            if (usernameLink) usernameLink.textContent = '';
        };

        if (!posts || posts.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:4rem 1rem; color:var(--text-muted);">
                    <div style="font-size:2.5rem;margin-bottom:0.8rem;">📷</div>
                    <p style="font-weight:600;margin-bottom:0.3rem;">${emptyMessage}</p>
                </div>`;
            return;
        }

        grid.innerHTML = posts.map((post, index) => {
            const animDelay = (index % 10) * 0.05;
            return `
            <div class="feed-item" data-post-id="${post.id}" data-post-image="${post.image}" style="animation: fadeInUp 0.6s ease-out ${animDelay}s both; cursor:pointer;">
                <div class="feed-img-wrapper">
                    <img src="${post.image}" alt="Kombin" class="feed-img" loading="lazy">
                    <div class="feed-overlay" style="display:flex; align-items:center; justify-content:center;">
                        <span style="color:white; font-weight:700; font-size:0.9rem; text-shadow:0 1px 3px rgba(0,0,0,0.5);">♥ ${post.likes_count || 0} &nbsp; 💬 ${post.comments_count || 0}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        if (modal && closeBtn) {
            closeBtn.onclick = closeModal;
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        if (sendCommentBtn && commentInput) {
            const addComment = async () => {
                if (!currentPost) return;
                const text = (commentInput.value || '').trim();
                if (!text) return;
                try {
                    await api.addComment(currentPost.id, text);
                    commentInput.value = '';
                    const comments = await loadComments(currentPost.id);
                    currentPost.comments_count = comments.length;
                    if (commentsCountEl) commentsCountEl.textContent = `💬 ${currentPost.comments_count || 0}`;
                } catch (err) {
                    console.error('Yorum eklenemedi:', err);
                }
            };

            sendCommentBtn.onclick = addComment;
            commentInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addComment();
                }
            };
        }

        if (likeBtn) {
            likeBtn.onclick = async () => {
                if (!currentPost) return;
                if (!currentUserId) return;
                const postId = currentPost.id;
                const liked = myLikedPostIds.has(postId);
                try {
                    if (liked) {
                        await api.unlikePost(postId);
                        myLikedPostIds.delete(postId);
                        currentPost.likes_count = Math.max(0, (currentPost.likes_count || 0) - 1);
                    } else {
                        await api.likePost(postId);
                        myLikedPostIds.add(postId);
                        currentPost.likes_count = (currentPost.likes_count || 0) + 1;
                    }
                    setLikeUi(!liked);
                    if (likesCountEl) likesCountEl.textContent = currentPost.likes_count || 0;
                } catch (err) {
                    console.error('Beğeni güncellenemedi:', err);
                }
            };
        }

        if (saveBtn) {
            saveBtn.onclick = async () => {
                if (!currentPost) return;
                const postId = currentPost.id;
                const saved = mySavedPostIds.has(postId);
                try {
                    if (saved) {
                        await api.unsavePost(postId);
                        mySavedPostIds.delete(postId);
                    } else {
                        await api.savePost(postId);
                        mySavedPostIds.add(postId);
                    }
                    setSaveUi(!saved);
                    
                    // Eğer "Kaydedilenler" sekmesi aktifse, öğeyi grid'den de çıkarıp grid'i güncelleyelim.
                    const tabSaved = document.getElementById('tab-saved');
                    if (tabSaved && tabSaved.classList.contains('active')) {
                        const idx = posts.findIndex(p => String(p.id) === String(postId));
                        if (idx > -1) {
                            posts.splice(idx, 1);
                            setTimeout(() => {
                                const cellEl = grid.querySelector(`.feed-item[data-post-id="${postId}"]`);
                                if (cellEl) cellEl.remove();
                                if (posts.length === 0) {
                                    grid.innerHTML = `
                                        <div style="grid-column:1/-1; text-align:center; padding:4rem 1rem; color:var(--text-muted);">
                                            <div style="font-size:2.5rem;margin-bottom:0.8rem;">📷</div>
                                            <p style="font-weight:600;margin-bottom:0.3rem;">${emptyMessage}</p>
                                        </div>`;
                                }
                            }, 300);
                        }
                    }
                } catch (err) {
                    console.error('Kaydetme hatası:', err);
                }
            };
        }

        if (shareBtn) {
            shareBtn.onclick = () => {
                if (!currentPost) return;
                const shareUrl = `${window.location.origin}/social.html?post=${currentPost.id}`;
                navigator.clipboard.writeText(shareUrl);
                alert('Gönderi bağlantısı panoya kopyalandı!');
            };
        }

        // feed-item'a tıklayınca profilde modal aç
        grid.onclick = (e) => {
            const cell = e.target.closest('.feed-item');
            if (!cell) return;

            const postId = cell.getAttribute('data-post-id');
            const post = posts.find(p => String(p.id) === String(postId)) || null;
            if (!post || !modal || !detailImg) return;

            currentPost = post;
            detailImg.src = post.image;
            if (detailDesc) detailDesc.textContent = post.tag || post.description || '';
            if (likesCountEl) likesCountEl.textContent = post.likes_count || 0;
            if (commentsCountEl) commentsCountEl.textContent = `💬 ${post.comments_count || 0}`;
            setLikeUi(myLikedPostIds.has(post.id));
            setSaveUi(mySavedPostIds.has(post.id));

            // Silme butonu yetkisi
            if (deleteBtn) {
                const isOwn = currentUserId && String(post.user_id) === String(currentUserId);
                if (isOwn) {
                    deleteBtn.style.display = 'inline-flex';
                    deleteBtn.onclick = async (ev) => {
                        ev.stopPropagation();
                        if (confirm('Bu gönderiyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
                            try {
                                await api.deleteSocialPost(post.id, post.image);
                                closeModal();
                                window.location.reload();
                            } catch (err) {
                                console.error('Gönderi silinemedi:', err);
                                alert('Gönderi silinirken hata oluştu.');
                            }
                        }
                    };
                } else {
                    deleteBtn.style.display = 'none';
                }
            }

            // Kullanıcı avatar + isim
            const avatarEl = document.getElementById('profile-detail-avatar');
            const usernameLink = document.getElementById('profile-detail-username-link');
            if (avatarEl && usernameLink) {
                const userName = post.users?.name || post.user_name || 'Kullanıcı';
                const avatarUrl = post.users?.avatar_url || null;
                const userId = post.user_id || '';
                avatarEl.innerHTML = avatarUrl
                    ? `<img src="${avatarUrl}" alt="${userName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                    : `<span>${userName.charAt(0).toUpperCase()}</span>`;
                usernameLink.textContent = userName;
                usernameLink.href = userId
                    ? `profile.html?user=${encodeURIComponent(userId)}&name=${encodeURIComponent(userName)}`
                    : 'profile.html';
            }

            modal.classList.add('active');
            loadComments(post.id).then((comments) => {
                if (!currentPost || String(currentPost.id) !== String(post.id)) return;
                currentPost.comments_count = comments.length;
                if (commentsCountEl) commentsCountEl.textContent = `💬 ${currentPost.comments_count || 0}`;
            });
        };
    },

    _setupEditProfile(user) {
        const modal = document.getElementById('edit-profile-modal');
        const btnEditProfile = document.getElementById('btn-edit-profile');
        const closeBtn = document.getElementById('close-edit-profile-modal');
        const form = document.getElementById('edit-profile-form');
        const avatarInput = document.getElementById('profile-avatar-input');
        const avatarPreview = document.getElementById('edit-avatar-preview');
        const avatarInitial = document.getElementById('edit-avatar-initial');
        const nameInput = document.getElementById('profile-name-input');
        const bioInput = document.getElementById('profile-bio-input');
        const submitBtn = document.getElementById('submit-edit-profile-btn');

        const cropperContainer = document.getElementById('cropper-container');
        const cropperImage = document.getElementById('cropper-image');
        const cropCancelBtn = document.getElementById('crop-cancel-btn');
        const cropSaveBtn = document.getElementById('crop-save-btn');
        const nameGroup = document.getElementById('profile-name-group');

        let cropper = null;
        let croppedBlob = null;

        if (!modal || !btnEditProfile) return;

        btnEditProfile.onclick = (e) => {
            e.preventDefault();
            nameInput.value = user.name || '';
            bioInput.value = user.bio || '';
            croppedBlob = null; // Reset blob
            
            if (user.avatar_url) {
                avatarPreview.src = user.avatar_url;
                avatarPreview.style.display = 'block';
                avatarInitial.style.display = 'none';
            } else {
                avatarInitial.textContent = user.name ? user.name.charAt(0).toUpperCase() : '?';
                avatarPreview.style.display = 'none';
                avatarInitial.style.display = 'block';
            }
            
            modal.classList.add('active');
        };

        const closeModal = () => {
            modal.classList.remove('active');
            if (cropper) { cropper.destroy(); cropper = null; }
            cropperContainer.style.display = 'none';
        };

        if (closeBtn) closeBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        const resetCropperUI = () => {
            cropperContainer.style.display = 'none';
            document.getElementById('edit-avatar-preview-container').parentElement.style.display = 'inline-block';
            if (nameGroup) nameGroup.style.display = 'block';
            bioInput.parentElement.style.display = 'block';
            submitBtn.style.display = 'block';
            if (cropper) { cropper.destroy(); cropper = null; }
            avatarInput.value = '';
        };

        avatarInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    cropperImage.src = event.target.result;
                    cropperContainer.style.display = 'block';
                    
                    document.getElementById('edit-avatar-preview-container').parentElement.style.display = 'none';
                    if (nameGroup) nameGroup.style.display = 'none';
                    bioInput.parentElement.style.display = 'none';
                    submitBtn.style.display = 'none';

                    if (cropper) cropper.destroy();
                    cropper = new window.Cropper(cropperImage, {
                        aspectRatio: 1,
                        viewMode: 1,
                        dragMode: 'move',
                        autoCropArea: 1,
                        restore: false,
                        guides: true,
                        center: true,
                        highlight: false,
                        cropBoxMovable: false,
                        cropBoxResizable: false,
                        toggleDragModeOnDblclick: false,
                    });
                };
                reader.readAsDataURL(file);
            }
        };

        if (cropCancelBtn) cropCancelBtn.onclick = resetCropperUI;

        if (cropSaveBtn) {
            cropSaveBtn.onclick = () => {
                if (!cropper) return;
                const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
                if (!canvas) return;
                
                canvas.toBlob((blob) => {
                    croppedBlob = blob;
                    avatarPreview.src = canvas.toDataURL();
                    avatarPreview.style.display = 'block';
                    avatarInitial.style.display = 'none';
                    resetCropperUI();
                }, 'image/jpeg', 0.9);
            };
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Kaydediliyor...';

            try {
                const updates = {
                    name: nameInput.value.trim(),
                    bio: bioInput.value.trim()
                };

                if (croppedBlob) {
                    const file = new File([croppedBlob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    const avatarUrl = await api.uploadImage(file, 'social_images');
                    updates.avatar_url = avatarUrl;
                }

                await api.updateUserProfile(updates);
                
                user.name = updates.name;
                user.bio = updates.bio;
                if (updates.avatar_url) user.avatar_url = updates.avatar_url;

                closeModal();
                window.location.reload();
            } catch (err) {
                console.error("Profil güncellenemedi:", err);
                alert("Profil güncellenemedi. Lütfen tekrar deneyin.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        };
    },

    _setupSettings(user) {
        const modal = document.getElementById('settings-modal');
        const btnSettings = document.getElementById('btn-settings');
        const closeBtn = document.getElementById('close-settings-modal');
        const form = document.getElementById('settings-form');
        const submitBtn = document.getElementById('submit-settings-btn');

        if (!modal || !btnSettings) return;

        btnSettings.onclick = (e) => {
            e.preventDefault();
            const meta = user.metadata || {};
            
            if (meta.gender) document.getElementById('settings-gender').value = meta.gender;
            if (meta.age) document.getElementById('settings-age').value = meta.age;
            if (meta.height) document.getElementById('settings-height').value = meta.height;
            if (meta.weight) document.getElementById('settings-weight').value = meta.weight;
            if (meta.bodyType) document.getElementById('settings-bodyType').value = meta.bodyType;
            if (meta.skinTone) document.getElementById('settings-skinTone').value = meta.skinTone;
            if (meta.eyeColor) document.getElementById('settings-eyeColor').value = meta.eyeColor;
            if (meta.hairColor) document.getElementById('settings-hairColor').value = meta.hairColor;
            if (meta.hairType) document.getElementById('settings-hairType').value = meta.hairType;
            if (meta.faceShape) document.getElementById('settings-faceShape').value = meta.faceShape;
            if (meta.colorPattern) document.getElementById('settings-colorPattern').value = meta.colorPattern;

            modal.classList.add('active');
        };

        const closeModal = () => modal.classList.remove('active');
        if (closeBtn) closeBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Kaydediliyor...';

                try {
                    const prefData = {
                        gender: document.getElementById('settings-gender').value,
                        age: parseInt(document.getElementById('settings-age').value),
                        height: parseInt(document.getElementById('settings-height').value),
                        weight: parseInt(document.getElementById('settings-weight').value),
                        bodyType: document.getElementById('settings-bodyType').value,
                        skinTone: document.getElementById('settings-skinTone').value,
                        eyeColor: document.getElementById('settings-eyeColor').value,
                        hairColor: document.getElementById('settings-hairColor').value,
                        hairType: document.getElementById('settings-hairType').value,
                        faceShape: document.getElementById('settings-faceShape').value,
                        colorPattern: document.getElementById('settings-colorPattern').value,
                        style: user.preferences?.style || null,
                        budget: user.preferences?.budget || null
                    };

                    await api.savePreferences(prefData);
                    closeModal();
                    window.location.reload();
                } catch (err) {
                    console.error("Ayarlar kaydedilemedi:", err);
                    alert("Ayarlar güncellenirken bir hata oluştu.");
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            };
        }
    }
};
