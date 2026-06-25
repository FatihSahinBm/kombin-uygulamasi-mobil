import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Dimensions,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

const uriToBlob = (uri) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function (e) {
      console.log('xhr error:', e);
      reject(new Error("Görsel okunamadı (Network request failed)"));
    };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
};

export default function SocialScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPostModal, setNewPostModal] = useState(false);
  const [newImage, setNewImage] = useState(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [posting, setPosting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Pinterest Masonry states
  const [imageRatios, setImageRatios] = useState({});
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [savedPosts, setSavedPosts] = useState({});

  // Lens states
  const [lensModalVisible, setLensModalVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ust');
  const [imageHeight, setImageHeight] = useState(0);

  const toggleSavePost = async (postId) => {
    const isSaved = !!savedPosts[postId];
    
    // Optimistic UI update
    setSavedPosts(prev => ({
      ...prev,
      [postId]: !isSaved
    }));

    try {
      if (isSaved) {
        await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('post_saves')
          .insert([{ post_id: postId, user_id: currentUser.id }]);
      }
    } catch (err) {
      console.log('Error toggling save post:', err);
      // Revert state on error
      setSavedPosts(prev => ({
        ...prev,
        [postId]: isSaved
      }));
    }
  };

  // User Profile modal states
  const [viewingUserProfile, setViewingUserProfile] = useState(null);
  const [userProfilePosts, setUserProfilePosts] = useState([]);
  const [loadingUserProfile, setLoadingUserProfile] = useState(false);

  const renderAvatar = (avatarUrl, initial, size = 24) => {
    if (avatarUrl) {
      return (
        <Image 
          source={{ uri: avatarUrl }} 
          style={{ width: size, height: size, borderRadius: size / 2 }} 
          resizeMode="cover" 
        />
      );
    }
    return (
      <LinearGradient 
        colors={['#a855f7', '#6366f1']} 
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{initial}</Text>
      </LinearGradient>
    );
  };

  const loadPosts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Fetch saved posts for the current user
      if (user) {
        const { data: savesData } = await supabase
          .from('post_saves')
          .select('post_id')
          .eq('user_id', user.id);
        
        const savesMap = {};
        if (savesData) {
          savesData.forEach(s => {
            savesMap[s.post_id] = true;
          });
        }
        setSavedPosts(savesMap);
      }

      const { data, error } = await supabase
        .from('social_feed')
        .select(`
          *,
          users(name, avatar_url),
          post_likes(user_id)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // Tablo yoksa mock data göster
        const mockPosts = [
          { id: 1, description: '🌟 Bugünkü kombinim! Minimal tarz her zaman kazandırır.', created_at: new Date().toISOString(), profiles: { full_name: 'Kullanıcı' }, post_likes: [], image_url: null, tags: ['#casual', '#minimal'] },
          { id: 2, description: '🔥 Sokak modası vibes! Oversize hoodie + chunky sneaker', created_at: new Date().toISOString(), profiles: { full_name: 'FashionLover' }, post_likes: [], image_url: null, tags: ['#streetwear'] },
        ];
        setPosts(mockPosts);
      } else {
        let normalizedData = (data || []).map(post => ({
          ...post,
          image_url: post.image,
          description: post.tag,
          tags: post.tag?.match(/#[a-zA-Z0-9_]+/g) || [],
          profiles: {
            full_name: post.users?.name || 'Kullanıcı',
            avatar_url: post.users?.avatar_url
          }
        }));

        // ===== ÖZELLİK 5: AKILLl SIRALAMA ALGORTIMASİ =====
        if (user) {
          try {
            // 1. Kullanıcının takip ettikleri
            const { data: followingData } = await supabase
              .from('user_follows')
              .select('following_id')
              .eq('follower_id', user.id);
            const followingSet = new Set((followingData || []).map(f => f.following_id));

            // 2. Kullanıcının beğendiği postların hashtag'lerini topla
            const { data: likedPostsData } = await supabase
              .from('post_likes')
              .select('post_id')
              .eq('user_id', user.id)
              .limit(50);

            const likedPostIds = (likedPostsData || []).map(l => l.post_id);
            let preferredTagsSet = new Set();

            if (likedPostIds.length > 0) {
              const { data: likedPostsDetails } = await supabase
                .from('social_feed')
                .select('tag')
                .in('id', likedPostIds);

              (likedPostsDetails || []).forEach(p => {
                const hashtags = p.tag?.match(/#[a-zA-Z0-9_]+/g) || [];
                hashtags.forEach(tag => preferredTagsSet.add(tag.toLowerCase()));
              });
            }

            // 3. Her post için puan hesapla
            // Puan = (beğeni × 5) + (takip bonusu 50) + (hashtag eşleşme × 20) - (saat × 1.5)
            normalizedData = normalizedData.map(post => {
              const likeScore = (post.post_likes?.length || 0) * 5;
              const followBonus = followingSet.has(post.user_id) ? 50 : 0;

              const postTags = (post.tags || []).map(t => t.toLowerCase());
              const tagMatchCount = postTags.filter(t => preferredTagsSet.has(t)).length;
              const tagBonus = tagMatchCount * 20;

              const ageHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
              const timeDecay = ageHours * 1.5;

              const rankScore = likeScore + followBonus + tagBonus - timeDecay;
              return { ...post, _rankScore: rankScore };
            });

            // 4. Puana göre büyükten küçüğe sırala
            normalizedData.sort((a, b) => (b._rankScore || 0) - (a._rankScore || 0));
          } catch (rankErr) {
            console.log('Ranking error (non-fatal):', rankErr);
          }
        }
        // ==============================================

        setPosts(normalizedData);

        // Fetch image aspect ratios dynamically to avoid cropping
        normalizedData.forEach(post => {
          if (post.image_url) {
            Image.getSize(post.image_url, (imgW, imgH) => {
              if (imgW && imgH) {
                setImageRatios(prev => ({ ...prev, [post.id]: imgW / imgH }));
              }
            }, (err) => console.log('Get size error:', err));
          }
        });
      }
    } catch (e) {
      console.log('Social load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const loadUserProfile = async (userId) => {
    setLoadingUserProfile(true);
    setViewingUserProfile({ id: userId });
    try {
      // 1. Fetch profile details
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      // 2. Fetch posts
      const { data: feedPosts } = await supabase
        .from('social_feed')
        .select(`
          *,
          users(name, avatar_url),
          post_likes(user_id)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const normalized = (feedPosts || []).map(post => ({
        ...post,
        image_url: post.image,
        description: post.tag,
        tags: post.tag?.match(/#[a-zA-Z0-9_]+/g) || [],
        profiles: {
          full_name: post.users?.name || userData?.name || 'Kullanıcı',
          avatar_url: post.users?.avatar_url || userData?.avatar_url
        }
      }));

      // Fetch ratios for profile posts as well
      normalized.forEach(post => {
        if (post.image_url && !imageRatios[post.id]) {
          Image.getSize(post.image_url, (imgW, imgH) => {
            if (imgW && imgH) {
              setImageRatios(prev => ({ ...prev, [post.id]: imgW / imgH }));
            }
          });
        }
      });

      // 3. Check if following
      let followingStatus = false;
      if (currentUser && userId !== currentUser.id) {
        const { data: followData } = await supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
          .maybeSingle();
        followingStatus = !!followData;
      }

      setViewingUserProfile({
        id: userId,
        name: userData?.name || 'Kullanıcı',
        bio: userData?.bio || 'Kombin.AI üyesi',
        avatar_url: userData?.avatar_url,
        isFollowing: followingStatus
      });
      setUserProfilePosts(normalized);
    } catch (e) {
      console.log('Load user profile error:', e);
    } finally {
      setLoadingUserProfile(false);
    }
  };

  const handleProfileFollowToggle = async () => {
    if (!viewingUserProfile || !currentUser) return;
    const targetUserId = viewingUserProfile.id;
    const currentlyFollowing = viewingUserProfile.isFollowing;
    try {
      if (currentlyFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetUserId);
        setViewingUserProfile(prev => ({ ...prev, isFollowing: false }));
      } else {
        await supabase
          .from('user_follows')
          .insert([{ follower_id: currentUser.id, following_id: targetUserId }]);
        setViewingUserProfile(prev => ({ ...prev, isFollowing: true }));

        // Send follow notification
        try {
          await supabase.from('notifications').insert([{
            user_id: targetUserId,
            actor_id: currentUser.id,
            type: 'follow'
          }]);
        } catch (err) {
          console.log('Follow notification error:', err);
        }
      }
    } catch (e) {
      console.log('Follow toggle error:', e);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('İzin Gerekli', 'Galeri izni gerekiyor.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setNewImage(result.assets[0]);
  };

  const sharePost = async () => {
    if (!description && !newImage) { Alert.alert('Hata', 'Açıklama veya fotoğraf ekleyin.'); return; }
    setPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let imageUrl = null;

      if (newImage) {
        const ext = newImage.uri.split('.').pop();
        const fileName = `posts/${user.id}/${Date.now()}.${ext}`;
        
        const formData = new FormData();
        formData.append('file', {
          uri: newImage.uri,
          name: fileName.split('/').pop(),
          type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        });
        
        let uploadBucket = 'social_images';
        let { error: upErr } = await supabase.storage
          .from(uploadBucket)
          .upload(fileName, formData, { contentType: 'multipart/form-data' });
          
        if (upErr) {
          uploadBucket = 'social-images';
          const { error: retryError } = await supabase.storage
            .from(uploadBucket)
            .upload(fileName, formData, { contentType: 'multipart/form-data' });
          upErr = retryError;
        }

        if (!upErr) {
          const { data: urlData } = supabase.storage.from(uploadBucket).getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase.from('social_feed').insert({
        user_id: user.id,
        tag: description + (tags ? ' ' + tags : ''),
        image: imageUrl,
      });

      if (error) throw error;
      setNewPostModal(false);
      setDescription('');
      setTags('');
      setNewImage(null);
      loadPosts();
    } catch (e) {
      Alert.alert('Hata', e.message || 'Gönderi paylaşılırken hata oluştu.');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (post) => {
    const alreadyLiked = post.post_likes?.some(l => l.user_id === currentUser?.id);
    if (alreadyLiked) {
      await supabase.from('post_likes').delete()
        .eq('post_id', post.id).eq('user_id', currentUser?.id);
      
      const updateList = prev => prev.map(p => {
        if (p.id === post.id) {
          const updated = {
            ...p,
            post_likes: p.post_likes.filter(l => l.user_id !== currentUser?.id)
          };
          if (selectedPost && selectedPost.id === post.id) {
            setSelectedPost(updated);
          }
          return updated;
        }
        return p;
      });

      setPosts(updateList);
      setUserProfilePosts(updateList);
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUser?.id });
      
      const updateList = prev => prev.map(p => {
        if (p.id === post.id) {
          const updated = {
            ...p,
            post_likes: [...(p.post_likes || []), { user_id: currentUser?.id }]
          };
          if (selectedPost && selectedPost.id === post.id) {
            setSelectedPost(updated);
          }
          return updated;
        }
        return p;
      });

      setPosts(updateList);
      setUserProfilePosts(updateList);

      // Send notification
      try {
        if (post.user_id !== currentUser.id) {
          await supabase.from('notifications').insert([{
            user_id: post.user_id,
            actor_id: currentUser.id,
            type: 'like',
            post_id: post.id
          }]);
        }
      } catch (err) {
        console.log('Like notification error:', err);
      }
    }
  };

  const loadPostDetails = async (post) => {
    setLoadingComments(true);
    try {
      // 1. Get comments
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          id,
          text,
          created_at,
          user_id,
          users(name, avatar_url)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });
        
      if (!error && data) {
        setComments(data);
      } else {
        setComments([]);
      }

      // 2. Check follow status
      if (currentUser && post.user_id !== currentUser.id) {
        const { data: followData } = await supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', post.user_id)
          .maybeSingle();
        setIsFollowing(!!followData);
      }
    } catch (e) {
      console.log('Load comments error:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert([{ post_id: selectedPost.id, user_id: currentUser.id, text: newComment.trim() }])
        .select('id, text, created_at, user_id, users(name, avatar_url)');
      if (error) throw error;
      setComments(prev => [...prev, data[0]]);
      setNewComment('');
      
      // Send notification
      try {
        if (selectedPost.user_id !== currentUser.id) {
          await supabase.from('notifications').insert([{
            user_id: selectedPost.user_id,
            actor_id: currentUser.id,
            type: 'comment',
            post_id: selectedPost.id
          }]);
        }
      } catch (err) {
        console.log('Notification error:', err);
      }
    } catch (e) {
      Alert.alert('Hata', 'Yorum eklenemedi.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
      Alert.alert('Hata', 'Yorum silinemedi.');
    }
  };

  const handleFollowToggle = async () => {
    if (!selectedPost || !currentUser) return;
    try {
      if (isFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', selectedPost.user_id);
        setIsFollowing(false);
      } else {
        await supabase
          .from('user_follows')
          .insert([{ follower_id: currentUser.id, following_id: selectedPost.user_id }]);
        setIsFollowing(true);

        // Send follow notification
        try {
          await supabase.from('notifications').insert([{
            user_id: selectedPost.user_id,
            actor_id: currentUser.id,
            type: 'follow'
          }]);
        } catch (err) {
          console.log('Follow notification error:', err);
        }
      }
    } catch (e) {
      console.log('Follow error:', e);
    }
  };

  const handleDeletePost = async (postId, imageUrl) => {
    Alert.alert(
      'Gönderiyi Sil',
      'Bu gönderiyi kalıcı olarak silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('social_feed').delete().eq('id', postId);
              if (error) throw error;
              
              if (imageUrl) {
                try {
                  const urlParts = imageUrl.split('/');
                  const fileName = urlParts.slice(urlParts.indexOf('social_images') + 1).join('/');
                  if (fileName) {
                    await supabase.storage.from('social_images').remove([fileName]);
                  }
                } catch (storageErr) {
                  console.log('Storage delete error (non-fatal):', storageErr);
                }
              }
              
              setSelectedPost(null);
              loadPosts();
              Alert.alert('Başarılı', 'Gönderi silindi.');
            } catch (e) {
              Alert.alert('Hata', 'Gönderi silinemedi.');
            }
          }
        }
      ]
    );
  };

  const handleImagePress = (e) => {
    const { locationY } = e.nativeEvent;
    const yPct = locationY / (imageHeight || 400);
    
    let cat = 'ust';
    if (yPct < 0.38) cat = 'ust';
    else if (yPct < 0.72) cat = 'alt';
    else cat = 'ayakkabi';
    
    setSelectedCategory(cat);
    setLensModalVisible(true);
    setScanning(true);
    
    setTimeout(() => {
      setScanning(false);
    }, 800);
  };

  const handleAddToWardrobe = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const catNames = {
        'ust': 'Tarama Üst Giyim',
        'alt': 'Tarama Alt Giyim',
        'ayakkabi': 'Tarama Ayakkabı'
      };

      // Resolve category_id from categories table
      let categoryId = null;
      const { data: catDataArray } = await supabase
        .from('categories')
        .select('id')
        .eq('name', selectedCategory)
        .limit(1);
      
      if (catDataArray && catDataArray.length > 0) {
        categoryId = catDataArray[0].id;
      } else {
        const { data: newCat, error: catErr } = await supabase
          .from('categories')
          .insert([{ name: selectedCategory }])
          .select();
        if (!catErr && newCat) categoryId = newCat[0].id;
      }
      
      const { error } = await supabase.from('wardrobe').insert({
        user_id: user.id,
        name: catNames[selectedCategory] || 'Taranan Kıyafet',
        category_id: categoryId,
        image_url: selectedPost?.image_url,
      });
      
      if (error) throw error;
      Alert.alert('Başarılı', 'Kıyafet gardırobunuza eklendi!');
      setLensModalVisible(false);
    } catch (err) {
      console.log('Add to wardrobe error:', err);
      Alert.alert('Hata', 'Kıyafet gardıroba eklenemedi.');
    }
  };

  const handleOpenGoogleLens = () => {
    if (!selectedPost?.image_url) return;
    const googleLensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(selectedPost.image_url)}`;
    Linking.openURL(googleLensUrl).catch(err => {
      console.log('Linking error:', err);
      Alert.alert('Hata', 'Google Lens açılamadı.');
    });
  };

  const renderPostItem = (item) => {
    const liked = item.post_likes?.some(l => l.user_id === currentUser?.id);
    const name = item.profiles?.full_name || 'Kullanıcı';
    const initial = name[0]?.toUpperCase() || '?';
    const likeCount = item.post_likes?.length || 0;
    
    // Pinterest masonry dynamic aspect ratio
    const ratio = imageRatios[item.id] || 1;

    return (
      <TouchableOpacity 
        key={item.id?.toString()} 
        style={styles.postCard}
        activeOpacity={0.9}
        onPress={() => {
          setSelectedPost(item);
          loadPostDetails(item);
        }}
      >
        {/* Image / Image Wrapper (Pinterest style: border-radius 24px) */}
        <View style={styles.imageWrapper}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={[styles.postImage, { aspectRatio: ratio }]} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#1a1040', '#302b63']} style={[styles.postImagePlaceholder, { aspectRatio: 1 }]}>
              <Text style={styles.postPlaceholderEmoji}>✨</Text>
            </LinearGradient>
          )}
        </View>

        {/* Info Area below the image */}
        <View style={styles.postInfo}>
          {/* User Profile */}
          <TouchableOpacity 
            style={styles.postHeader}
            onPress={(e) => {
              e.stopPropagation();
              loadUserProfile(item.user_id);
            }}
          >
            {renderAvatar(item.profiles?.avatar_url, initial, 24)}
            <View style={styles.postMeta}>
              <Text style={styles.postUsername} numberOfLines={1}>{name}</Text>
              <Text style={styles.postDate}>
                {new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </TouchableOpacity>


        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f0c29', '#302b63']} style={styles.header}>
        <Text style={styles.headerTitle}>🔥 Sosyal Akış</Text>
        <Text style={styles.headerSub}>Topluluktan ilham al</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#a855f7" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPosts(); }} tintColor="#a855f7" />
          }
        >
          {posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📸</Text>
              <Text style={styles.emptyText}>Henüz gönderi yok</Text>
              <Text style={styles.emptySubtext}>İlk kombini sen paylaş!</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              <View style={styles.column}>
                {posts.filter((_, idx) => idx % 2 === 0).map(renderPostItem)}
              </View>
              <View style={styles.column}>
                {posts.filter((_, idx) => idx % 2 !== 0).map(renderPostItem)}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Share FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setNewPostModal(true)} activeOpacity={0.85}>
        <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.fabGradient}>
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* New Post Modal */}
      <Modal visible={newPostModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🌟 Kombin Paylaş</Text>

            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {newImage ? (
                <Image source={{ uri: newImage.uri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderIcon}>📷</Text>
                  <Text style={styles.imagePlaceholderText}>Fotoğraf Ekle</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Açıklama</Text>
              <TextInput
                style={[styles.formInput, { height: 80 }]}
                placeholder="Kombinin hakkında bir şeyler yaz..."
                placeholderTextColor="#6b7280"
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Hashtagler</Text>
              <TextInput
                style={styles.formInput}
                placeholder="#casual #streetwear"
                placeholderTextColor="#6b7280"
                value={tags}
                onChangeText={setTags}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setNewPostModal(false)}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={sharePost} disabled={posting}>
                <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.saveBtnGradient}>
                  {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Paylaş</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Post Detail Modal */}
      <Modal visible={!!selectedPost} animationType="slide" transparent>
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalContent}>
            
            {/* Scrollable Content (Image and details) */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
              {selectedPost && (
                <>
                  {/* Top Header Row: Close, Profile Info, Follow */}
                  <View style={styles.detailHeaderRow}>
                    <TouchableOpacity onPress={() => setSelectedPost(null)} style={styles.detailCloseBtn}>
                      <Ionicons name="close" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.detailUserContainer}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedPost(null);
                        loadUserProfile(selectedPost.user_id);
                      }}
                    >
                      {renderAvatar(selectedPost.profiles?.avatar_url, (selectedPost.profiles?.full_name || 'K')[0].toUpperCase(), 40)}
                      <Text style={styles.detailUsername}>@{selectedPost.profiles?.full_name || 'Kullanıcı'}</Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {currentUser && selectedPost.user_id !== currentUser.id && (
                        <TouchableOpacity 
                          style={[styles.followBtn, isFollowing && styles.followBtnActive]} 
                          onPress={handleFollowToggle}
                        >
                          <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                            {isFollowing ? 'Takibi Bırak' : 'Takip Et'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {currentUser && selectedPost.user_id === currentUser.id && (
                        <TouchableOpacity 
                          style={styles.deletePostBtn} 
                          onPress={() => handleDeletePost(selectedPost.id, selectedPost.image_url)}
                        >
                          <Text style={styles.deletePostBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Image (Original aspect ratio, not cropped) */}
                  {selectedPost.image_url ? (
                    <TouchableOpacity 
                      activeOpacity={0.95} 
                      onPress={handleImagePress}
                      onLayout={e => setImageHeight(e.nativeEvent.layout.height)}
                      style={[styles.detailImageWrapper, { aspectRatio: imageRatios[selectedPost.id] || 1, backgroundColor: 'transparent' }]}
                    >
                      <Image 
                        source={{ uri: selectedPost.image_url }} 
                        style={styles.detailImage} 
                        resizeMode="contain" 
                      />
                      {/* Hint Overlay */}
                      <View style={styles.lensHintOverlay}>
                        <Ionicons name="scan-circle-outline" size={15} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.lensHintText}>Kıyafeti Taramak İçin Resme Tıklayın</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.detailImageWrapper}>
                      <LinearGradient colors={['#1a1040', '#302b63']} style={styles.detailImagePlaceholder}>
                        <Text style={styles.detailPlaceholderEmoji}>✨</Text>
                      </LinearGradient>
                    </View>
                  )}

                  {/* Description & Tags */}
                  {selectedPost.description ? (
                    <View style={styles.detailBody}>
                      <Text style={styles.detailDesc}>{selectedPost.description}</Text>
                    </View>
                  ) : null}

                  {/* Comments list */}
                  <View style={styles.commentsContainer}>
                    <Text style={styles.commentsTitle}>Yorumlar</Text>
                    <View style={styles.commentsDivider} />
                    
                    {loadingComments ? (
                      <ActivityIndicator size="small" color="#a855f7" style={{ marginVertical: 20 }} />
                    ) : comments.length === 0 ? (
                      <Text style={styles.noCommentsText}>Henüz yorum yok. İlk yorumu sen yap!</Text>
                    ) : (
                      comments.map(comment => {
                        const commenterName = comment.users?.name || 'Kullanıcı';
                        const commenterInitial = commenterName[0]?.toUpperCase() || '?';
                        const isOwnComment = currentUser && comment.user_id === currentUser.id;
                        return (
                          <View key={comment.id} style={styles.commentItem}>
                            <TouchableOpacity 
                              activeOpacity={0.8}
                              onPress={() => {
                                setSelectedPost(null);
                                loadUserProfile(comment.user_id);
                              }}
                            >
                              {renderAvatar(comment.users?.avatar_url, commenterInitial, 32)}
                            </TouchableOpacity>
                            <View style={styles.commentInfo}>
                              <Text style={styles.commentAuthorText}>
                                <Text 
                                  style={styles.commentAuthor}
                                  onPress={() => {
                                    setSelectedPost(null);
                                    loadUserProfile(comment.user_id);
                                  }}
                                >
                                  {commenterName}
                                </Text>
                                <Text style={styles.commentText}>  {comment.text}</Text>
                              </Text>
                              <Text style={styles.commentTime}>
                                {new Date(comment.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric' })} {new Date(comment.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            {isOwnComment && (
                              <TouchableOpacity 
                                style={styles.commentDeleteBtn} 
                                onPress={() => handleDeleteComment(comment.id)}
                              >
                                <Text style={styles.commentDeleteText}>🗑️</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            {/* Bottom Actions Row & Comment Input */}
            <View style={styles.bottomAreaContainer}>
              <View style={styles.detailActionsRow}>
                {selectedPost && (
                  <>
                    <TouchableOpacity style={styles.detailLikeBtn} onPress={() => toggleLike(selectedPost)}>
                      {selectedPost.post_likes?.some(l => l.user_id === currentUser?.id) ? (
                        <Ionicons name="heart" size={24} color="#ef4444" />
                      ) : (
                        <Ionicons name="heart-outline" size={24} color="#fff" />
                      )}
                      <Text style={styles.detailActionCount}>{selectedPost.post_likes?.length || 0}</Text>
                    </TouchableOpacity>

                    <View style={styles.detailCommentBtn}>
                      <Ionicons name="chatbubble-outline" size={22} color="#fff" />
                    </View>

                    <TouchableOpacity style={styles.detailShareBtn} onPress={() => { /* silent share action */ }}>
                      <Ionicons name="share-outline" size={24} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.detailSaveBtn} onPress={() => toggleSavePost(selectedPost.id)}>
                      <Ionicons 
                        name={savedPosts[selectedPost.id] ? "bookmark" : "bookmark-outline"} 
                        size={24} 
                        color={savedPosts[selectedPost.id] ? "#ef4444" : "#fff"} 
                      />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {currentUser && selectedPost && (
                <View style={styles.addCommentContainer}>
                  {renderAvatar(currentUser.user_metadata?.avatar_url || currentUser.avatar_url, (currentUser.user_metadata?.full_name || 'K')[0].toUpperCase(), 36)}
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Yorum ekle..."
                    placeholderTextColor="#6b7280"
                    value={newComment}
                    onChangeText={setNewComment}
                  />
                  <TouchableOpacity 
                    style={styles.sendCommentBtn} 
                    onPress={handleAddComment}
                    disabled={!newComment.trim() || submittingComment}
                  >
                    {submittingComment ? (
                      <ActivityIndicator size="small" color="#6366f1" />
                    ) : (
                      <Ionicons name="send" size={16} color="#6366f1" />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Google Lens / Scan Results Modal */}
      <Modal visible={lensModalVisible} animationType="fade" transparent>
        <View style={styles.lensModalOverlay}>
          <View style={styles.lensModalContent}>
            
            {/* Title Row */}
            <View style={styles.lensModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="search-outline" size={20} color="#fff" />
                <Text style={styles.lensModalTitle}>Kıyafet Tarama Sonuçları</Text>
              </View>
              <TouchableOpacity onPress={() => setLensModalVisible(false)} style={styles.lensCloseBtn}>
                <Ionicons name="close" size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {scanning ? (
              <View style={styles.lensScanningContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.lensScanningText}>Kıyafet analiz ediliyor...</Text>
              </View>
            ) : (
              <View style={styles.lensResultsContainer}>
                
                {/* Wardrobe Card */}
                <View style={styles.lensCard}>
                  <View style={styles.lensCardLeft}>
                    <Text style={styles.lensCardTitle}>
                      {selectedCategory === 'ust' ? 'Üst Giyim' : selectedCategory === 'alt' ? 'Alt Giyim' : 'Ayakkabı'} Seçildi
                    </Text>
                    <Text style={styles.lensCardSubtitle}>Seçilen kombini gardırobuna ekle!</Text>
                  </View>
                  <TouchableOpacity style={styles.lensAddBtn} onPress={handleAddToWardrobe}>
                    <Text style={styles.lensAddBtnText}>+ Gardıroba Ekle</Text>
                  </TouchableOpacity>
                </View>

                {/* Google Lens Button */}
                <TouchableOpacity style={styles.lensSearchBtn} onPress={handleOpenGoogleLens} activeOpacity={0.9}>
                  <LinearGradient 
                    colors={['#4285f4', '#34a853']} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 0 }}
                    style={styles.lensSearchGradient}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="logo-google" size={18} color="#fff" />
                      <Text style={styles.lensSearchText}>Google Lens ile Ara</Text>
                    </View>
                    <Text style={styles.lensSearchBadgeText}>Fiyat + Birebir Ürün</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.lensFooterText}>
                  Yeni sekmede Google Lens açılır → aynı ürünü listeler → fiyatları gösterir
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* User Profile View Modal */}
      <Modal visible={!!viewingUserProfile} animationType="slide" transparent>
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalContent}>
            {/* Modal Header */}
            <View style={styles.detailModalHeader}>
              <TouchableOpacity onPress={() => setViewingUserProfile(null)} style={styles.detailCloseBtn}>
                <Text style={styles.detailCloseText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.detailHeaderTitle}>Kullanıcı Profili</Text>
              <View style={{ width: 40 }} />
            </View>

            {loadingUserProfile ? (
              <ActivityIndicator size="large" color="#a855f7" style={{ marginTop: 40 }} />
            ) : viewingUserProfile && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
                {/* Profile Header */}
                <View style={{ alignItems: 'center', marginVertical: 20 }}>
                  {renderAvatar(viewingUserProfile.avatar_url, (viewingUserProfile.name || 'K')[0].toUpperCase(), 80)}
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12 }}>{viewingUserProfile.name}</Text>
                  <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>{viewingUserProfile.bio}</Text>

                  {/* Follow button */}
                  {currentUser && viewingUserProfile.id !== currentUser.id && (
                    <TouchableOpacity 
                      style={[styles.followBtn, { marginTop: 16 }, viewingUserProfile.isFollowing && styles.followBtnActive]} 
                      onPress={handleProfileFollowToggle}
                    >
                      <Text style={[styles.followBtnText, viewingUserProfile.isFollowing && styles.followBtnTextActive]}>
                        {viewingUserProfile.isFollowing ? 'Takibi Bırak' : 'Takip Et'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Stats Row */}
                <View style={[styles.statsRow, { marginHorizontal: 20, marginBottom: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 12 }]}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{userProfilePosts.length}</Text>
                    <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>Gönderi</Text>
                  </View>
                </View>

                {/* Users Posts Grid */}
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 16 }}>Gönderiler</Text>
                {userProfilePosts.length === 0 ? (
                  <Text style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>Bu kullanıcının henüz gönderisi yok.</Text>
                ) : (
                  <View style={styles.gridContainer}>
                    <View style={styles.column}>
                      {userProfilePosts.filter((_, idx) => idx % 2 === 0).map(item => (
                        <TouchableOpacity 
                          key={item.id?.toString()} 
                          style={styles.postCard}
                          activeOpacity={0.9}
                          onPress={() => {
                            setViewingUserProfile(null);
                            setSelectedPost(item);
                            loadPostDetails(item);
                          }}
                        >
                          <View style={styles.imageWrapper}>
                            {item.image_url ? (
                              <Image source={{ uri: item.image_url }} style={[styles.postImage, { aspectRatio: imageRatios[item.id] || 1 }]} resizeMode="cover" />
                            ) : (
                              <LinearGradient colors={['#1a1040', '#302b63']} style={[styles.postImagePlaceholder, { aspectRatio: 1 }]}>
                                <Text style={styles.postPlaceholderEmoji}>✨</Text>
                              </LinearGradient>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.column}>
                      {userProfilePosts.filter((_, idx) => idx % 2 !== 0).map(item => (
                        <TouchableOpacity 
                          key={item.id?.toString()} 
                          style={styles.postCard}
                          activeOpacity={0.9}
                          onPress={() => {
                            setViewingUserProfile(null);
                            setSelectedPost(item);
                            loadPostDetails(item);
                          }}
                        >
                          <View style={styles.imageWrapper}>
                            {item.image_url ? (
                              <Image source={{ uri: item.image_url }} style={[styles.postImage, { aspectRatio: imageRatios[item.id] || 1 }]} resizeMode="cover" />
                            ) : (
                              <LinearGradient colors={['#1a1040', '#302b63']} style={[styles.postImagePlaceholder, { aspectRatio: 1 }]}>
                                <Text style={styles.postPlaceholderEmoji}>✨</Text>
                              </LinearGradient>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#a5b4fc', marginTop: 4 },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 10, paddingBottom: 100 },
  gridContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  column: { width: '48.5%' },
  postCard: {
    backgroundColor: 'transparent',
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
  },
  imageWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  postImage: { width: '100%' },
  postImagePlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  postPlaceholderEmoji: { fontSize: 36 },
  postInfo: { paddingVertical: 8, paddingHorizontal: 4 },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  postAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  postAvatarText: { color: '#fff', fontWeight: '800', fontSize: 10 },
  postMeta: { marginLeft: 8, flex: 1 },
  postUsername: { color: '#fff', fontWeight: '700', fontSize: 13 },
  postDate: { color: '#6b7280', fontSize: 10, marginTop: 1 },
  postActions: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 12 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeBtnIcon: { fontSize: 16 },
  likeCount: { color: '#9ca3af', fontWeight: '700', fontSize: 12 },
  likeCountActive: { color: '#ec4899' },
  commentBtn: {},
  commentBtnIcon: { fontSize: 16 },
  postBody: { paddingVertical: 4 },
  postDesc: { color: '#e5e7eb', fontSize: 12, lineHeight: 16 },
  postTags: { color: '#a855f7', fontSize: 11, marginTop: 2, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80, width: '100%' },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { color: '#9ca3af', fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
  },
  fabGradient: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#13111a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 20 },
  imagePicker: { alignSelf: 'center', marginBottom: 20 },
  imagePreview: { width: 140, height: 140, borderRadius: 16 },
  imagePlaceholder: {
    width: 140, height: 140, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', borderStyle: 'dashed',
  },
  imagePlaceholderIcon: { fontSize: 36, marginBottom: 4 },
  imagePlaceholderText: { color: '#9ca3af', fontSize: 13 },
  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#d1d5db', marginBottom: 6 },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#fff',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelBtnText: { color: '#9ca3af', fontWeight: '700' },
  saveBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  saveBtnGradient: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700' },

  // Detail Modal Styles
  detailModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  detailModalContent: { backgroundColor: '#13111a', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%', paddingBottom: 20 },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  detailUserContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginLeft: 10 },
  detailCloseBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18 },
  detailCloseText: { color: '#9ca3af', fontSize: 16, fontWeight: 'bold' },
  detailScrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  detailUsername: { color: '#fff', fontWeight: '800', fontSize: 16 },
  followBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  followBtnActive: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  followBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  followBtnTextActive: { color: '#9ca3af' },
  deletePostBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center', justifyContent: 'center' },
  deletePostBtnText: { fontSize: 16 },
  detailImageWrapper: { borderRadius: 24, overflow: 'hidden', backgroundColor: 'transparent', marginVertical: 10, width: '100%', maxHeight: 450, alignItems: 'center', justifyContent: 'center' },
  detailImage: { width: '100%', height: '100%' },
  detailImagePlaceholder: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  detailPlaceholderEmoji: { fontSize: 60 },
  detailBody: { marginVertical: 10 },
  detailDesc: { color: '#e5e7eb', fontSize: 15, lineHeight: 22 },
  commentsContainer: { borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingTop: 16, marginTop: 10 },
  commentsTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  commentsDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },
  noCommentsText: { color: '#6b7280', fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginVertical: 20 },
  commentItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  commentInfo: { flex: 1 },
  commentAuthorText: { fontSize: 14, lineHeight: 20, color: '#fff' },
  commentAuthor: { fontWeight: '800', color: '#fff' },
  commentText: { fontWeight: '400', color: '#d1d5db' },
  commentTime: { color: '#6b7280', fontSize: 11, marginTop: 4 },
  commentDeleteBtn: { padding: 4, alignSelf: 'center' },
  commentDeleteText: { fontSize: 14 },
  
  bottomAreaContainer: { borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingTop: 12, backgroundColor: '#13111a' },
  detailActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 20, marginBottom: 12 },
  detailLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailCommentBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailShareBtn: { flexDirection: 'row', alignItems: 'center' },
  detailSaveBtn: { flexDirection: 'row', alignItems: 'center' },
  detailActionIcon: { fontSize: 22 },
  detailActionCount: { color: '#fff', fontSize: 15, fontWeight: '700' },
  addCommentContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10, gap: 10 },
  commentInput: { flex: 1, backgroundColor: '#1a1824', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sendCommentBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(99, 102, 241, 0.1)', alignItems: 'center', justifyContent: 'center' },
  sendCommentBtnText: { color: '#6366f1', fontSize: 18, fontWeight: 'bold' },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  // Lens Styles
  lensHintOverlay: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 12, 41, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  lensHintText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  lensModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lensModalContent: {
    backgroundColor: '#1b1d28',
    borderRadius: 24,
    width: '90%',
    maxWidth: 360,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  lensModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 12,
  },
  lensModalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  lensCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensScanningContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  lensScanningText: {
    color: '#a5b4fc',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  lensResultsContainer: {
    width: '100%',
  },
  lensCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  lensCardLeft: {
    flex: 1,
    marginRight: 8,
  },
  lensCardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  lensCardSubtitle: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
  },
  lensAddBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  lensAddBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  lensSearchBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  lensSearchGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lensSearchText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  lensSearchBadgeText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '700',
  },
  lensFooterText: {
    color: '#6b7280',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 4,
  },
});
