import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  RefreshControl,
  Dimensions,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

const BODY_TYPES = ['Dikdörtgen', 'Üçgen', 'Ters Üçgen', 'Kum Saati', 'Yuvarlak', 'Belirtmek İstemiyorum'];
const SKIN_TONES = ['Açık / Beyaz', 'Buğday / Kumral', 'Esmer / Zeytin', 'Koyu / Siyahi'];
const GENDERS = ['Erkek', 'Kadın', 'Belirtmek İstemiyorum'];

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

export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('kombinler'); // 'kombinler' or 'kaydedilenler'

  // Modals
  const [editModal, setEditModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [newPostModal, setNewPostModal] = useState(false);

  // Form states
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [editAvatar, setEditAvatar] = useState(null);
  const [newImage, setNewImage] = useState(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [posting, setPosting] = useState(false);

  // Counts & lists
  const [postCount, setPostCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [myPosts, setMyPosts] = useState([]);
  const [savedPostsList, setSavedPostsList] = useState([]);
  const [savedPostsMap, setSavedPostsMap] = useState({});
  const [imageRatios, setImageRatios] = useState({});
  const [settings, setSettings] = useState({ gender: 'Belirtmek İstemiyorum', age: '', bodyType: 'Belirtmek İstemiyorum', skinTone: 'Belirtmek İstemiyorum' });

  // Detail Modal states
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Lens states
  const [lensModalVisible, setLensModalVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ust');
  const [imageHeight, setImageHeight] = useState(0);

  const loadProfileData = useCallback(async () => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (!u) return;

      // 1. Profile details
      let prof = null;
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', u.id)
          .single();
        prof = data;
      } catch (err) {
        console.log('Profile fetch error:', err);
      }
      setProfile(prof);
      setEditName(prof?.name || u.user_metadata?.full_name || '');
      setEditBio(prof?.bio || '');

      // ÖZELLİK 4: Fiziksel özelliklerı Supabase'den yükle, yoksa AsyncStorage'dan çek
      try {
        const physicalFromDB = {
          gender: prof?.gender || null,
          age: prof?.age ? String(prof.age) : '',
          bodyType: prof?.body_type || null,
          skinTone: prof?.skin_tone || null,
        };
        const hasDBData = physicalFromDB.gender || physicalFromDB.bodyType || physicalFromDB.skinTone;
        if (hasDBData) {
          setSettings(prev => ({
            ...prev,
            gender: physicalFromDB.gender || prev.gender,
            age: physicalFromDB.age || prev.age,
            bodyType: physicalFromDB.bodyType || prev.bodyType,
            skinTone: physicalFromDB.skinTone || prev.skinTone,
          }));
        } else {
          // AsyncStorage fallback
          const stored = await AsyncStorage.getItem('physical_settings');
          if (stored) {
            setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
          }
        }
      } catch (settingsErr) {
        console.log('Settings load error:', settingsErr);
      }

      // 2. Fetch my posts
      const { data: myFeed, error: myFeedErr } = await supabase
        .from('social_feed')
        .select(`
          *,
          users(name, avatar_url),
          post_likes(user_id)
        `)
        .eq('user_id', u.id)
        .order('created_at', { ascending: false });

      if (!myFeedErr && myFeed) {
        const normalizedMy = myFeed.map(post => ({
          ...post,
          image_url: post.image,
          description: post.tag,
          tags: post.tag?.match(/#[a-zA-Z0-9_]+/g) || [],
          profiles: {
            full_name: post.users?.name || 'Kullanıcı',
            avatar_url: post.users?.avatar_url
          }
        }));
        setMyPosts(normalizedMy);
        setPostCount(normalizedMy.length);

        // Fetch image aspect ratios
        normalizedMy.forEach(post => {
          if (post.image_url && !imageRatios[post.id]) {
            Image.getSize(post.image_url, (imgW, imgH) => {
              if (imgW && imgH) {
                setImageRatios(prev => ({ ...prev, [post.id]: imgW / imgH }));
              }
            }, (err) => console.log('Get size error:', err));
          }
        });
      }

      // 3. Fetch saved posts
      const { data: savedData, error: savedError } = await supabase
        .from('post_saves')
        .select(`
          post_id,
          social_feed (
            id,
            user_id,
            image,
            tag,
            created_at,
            users(name, avatar_url),
            post_likes(user_id)
          )
        `)
        .eq('user_id', u.id);
      
      if (!savedError && savedData) {
        const normalizedSaved = savedData
          .filter(s => s.social_feed)
          .map(s => {
            const post = s.social_feed;
            return {
              ...post,
              image_url: post.image,
              description: post.tag,
              tags: post.tag?.match(/#[a-zA-Z0-9_]+/g) || [],
              profiles: {
                full_name: post.users?.name || 'Kullanıcı',
                avatar_url: post.users?.avatar_url
              }
            };
          });
        setSavedPostsList(normalizedSaved);

        const savesMap = {};
        normalizedSaved.forEach(post => {
          savesMap[post.id] = true;
        });
        setSavedPostsMap(savesMap);

        // Fetch ratios for saved posts
        normalizedSaved.forEach(post => {
          if (post.image_url && !imageRatios[post.id]) {
            Image.getSize(post.image_url, (imgW, imgH) => {
              if (imgW && imgH) {
                setImageRatios(prev => ({ ...prev, [post.id]: imgW / imgH }));
              }
            }, (err) => console.log('Get size error:', err));
          }
        });
      }

      // 4. Fetch followers and following count
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', u.id),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', u.id)
      ]);
      setFollowersCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);

    } catch (e) {
      console.log('Profile load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [imageRatios]);

  useEffect(() => {
    loadProfileData();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      let updatedAvatarUrl = avatarUrl;
      if (editAvatar) {
        const ext = editAvatar.uri.split('.').pop();
        const fileName = `posts/${user.id}/avatar_${Date.now()}.${ext}`;
        
        const formData = new FormData();
        formData.append('file', {
          uri: editAvatar.uri,
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

        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage.from(uploadBucket).getPublicUrl(fileName);
        updatedAvatarUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('users').update({
        name: editName,
        bio: editBio,
        avatar_url: updatedAvatarUrl,
      }).eq('id', user.id);
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: editName, avatar_url: updatedAvatarUrl } });
      setEditModal(false);
      setEditAvatar(null);
      loadProfileData();
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('İzin Gerekli', 'Galeri izni gerekiyor.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setEditAvatar(result.assets[0]);
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
      loadProfileData();
    } catch (e) {
      Alert.alert('Hata', e.message || 'Gönderi paylaşılırken hata oluştu.');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (post) => {
    const liked = post.post_likes?.some(l => l.user_id === user?.id);
    try {
      if (liked) {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
        const updatedLikes = (post.post_likes || []).filter(l => l.user_id !== user.id);
        const updatedPost = { ...post, post_likes: updatedLikes };
        setSelectedPost(updatedPost);
        setMyPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
        setSavedPostsList(prev => prev.map(p => p.id === post.id ? updatedPost : p));
      } else {
        await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
        const updatedLikes = [...(post.post_likes || []), { user_id: user.id }];
        const updatedPost = { ...post, post_likes: updatedLikes };
        setSelectedPost(updatedPost);
        setMyPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
        setSavedPostsList(prev => prev.map(p => p.id === post.id ? updatedPost : p));
      }
    } catch (err) {
      console.log('Error toggling like:', err);
    }
  };

  const toggleSavePost = async (postId) => {
    const isSaved = !!savedPostsMap[postId];
    setSavedPostsMap(prev => ({ ...prev, [postId]: !isSaved }));

    try {
      if (isSaved) {
        await supabase.from('post_saves').delete().eq('post_id', postId).eq('user_id', user.id);
        setSavedPostsList(prev => prev.filter(p => p.id !== postId));
      } else {
        await supabase.from('post_saves').insert([{ post_id: postId, user_id: user.id }]);
        loadProfileData();
      }
    } catch (err) {
      console.log('Error toggling save post:', err);
      setSavedPostsMap(prev => ({ ...prev, [postId]: isSaved }));
    }
  };

  const loadPostDetails = async (post) => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, text, created_at, user_id, users(name, avatar_url)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setComments(data);
      } else {
        setComments([]);
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
        .insert([{ post_id: selectedPost.id, user_id: user.id, text: newComment.trim() }])
        .select('id, text, created_at, user_id, users(name, avatar_url)');
      if (error) throw error;
      setComments(prev => [...prev, data[0]]);
      setNewComment('');
    } catch (e) {
      Alert.alert('Hata', 'Yorum eklenemedi.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
      Alert.alert('Hata', 'Yorum silinemedi.');
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
              loadProfileData();
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

  const logout = async () => {
    Alert.alert('Çıkış Yap', 'Çıkmak istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); } },
    ]);
  };

  const renderAvatar = (avatarUrl, initialStr, size = 24) => {
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
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{initialStr}</Text>
      </LinearGradient>
    );
  };

  const renderPostItem = (item) => {
    const ratio = imageRatios[item.id] || 1;
    const name = item.profiles?.full_name || 'Kullanıcı';
    const initialLetter = name[0]?.toUpperCase() || '?';

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
        <View style={styles.imageWrapper}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={[styles.postImage, { aspectRatio: ratio }]} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#1a1040', '#302b63']} style={[styles.postImagePlaceholder, { aspectRatio: 1 }]}>
              <Text style={styles.postPlaceholderEmoji}>✨</Text>
            </LinearGradient>
          )}
        </View>

        <View style={styles.postInfo}>
          <View style={styles.postHeader}>
            {renderAvatar(item.profiles?.avatar_url, initialLetter, 24)}
            <View style={styles.postMeta}>
              <Text style={styles.postUsername} numberOfLines={1}>{name}</Text>
              <Text style={styles.postDate}>
                {new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const displayName = profile?.name || profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Kullanıcı';
  const initial = displayName[0]?.toUpperCase() || '?';
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

  if (loading) return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#a855f7" />
    </View>
  );

  const displayPosts = activeTab === 'kombinler' ? myPosts : savedPostsList;

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfileData(); }} tintColor="#a855f7" />}
      >
        {/* Profile Header (Pinterest Layout from screenshot) */}
        <View style={styles.profileHeaderContainer}>
          {/* Avatar on the left */}
          <View style={styles.avatarWrapper}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: 90, height: 90, borderRadius: 45 }} resizeMode="cover" />
            ) : (
              <LinearGradient colors={['#5c5cf6', '#6366f1']} style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
            )}
          </View>

          {/* User Details on the right */}
          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{displayName}</Text>
            
            {/* Stats Row */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{postCount}</Text>
                <Text style={styles.statLabel}>Gönderi</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{followersCount}</Text>
                <Text style={styles.statLabel}>Takipçi</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{followingCount}</Text>
                <Text style={styles.statLabel}>Takip</Text>
              </View>
            </View>

            {/* Buttons Row */}
            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.pillButton} onPress={() => setEditModal(true)}>
                <Text style={styles.pillButtonText}>Profili Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pillButton} onPress={() => setSettingsModal(true)}>
                <Text style={styles.pillButtonText}>⚙️ Ayarlar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pillButton, styles.redButton]} onPress={() => setNewPostModal(true)}>
                <Text style={styles.redButtonText}>+ Paylaşım Yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Tab Selection */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'kombinler' && styles.tabButtonActive]} 
            onPress={() => setActiveTab('kombinler')}
          >
            <Text style={[styles.tabText, activeTab === 'kombinler' && styles.tabTextActive]}>KOMBİNLER</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'kaydedilenler' && styles.tabButtonActive]} 
            onPress={() => setActiveTab('kaydedilenler')}
          >
            <Text style={[styles.tabText, activeTab === 'kaydedilenler' && styles.tabTextActive]}>KAYDEDİLENLER</Text>
          </TouchableOpacity>
        </View>

        {/* Grid Content */}
        <View style={styles.gridContent}>
          {displayPosts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="camera-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyText}>Henüz paylaşım yok</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              <View style={styles.column}>
                {displayPosts.filter((_, idx) => idx % 2 === 0).map(renderPostItem)}
              </View>
              <View style={styles.column}>
                {displayPosts.filter((_, idx) => idx % 2 !== 0).map(renderPostItem)}
              </View>
            </View>
          )}
        </View>

        {/* App Info / Logout */}
        <View style={styles.bottomArea}>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
          </TouchableOpacity>
          <Text style={styles.appInfo}>Kombin.AI v1.0.1</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }} 
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              {/* Header Row with Close Button */}
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Profili Düzenle</Text>
                <TouchableOpacity onPress={() => { setEditModal(false); setEditAvatar(null); }} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              {/* Centered Avatar Picker with Camera Badge */}
              <View style={styles.editAvatarContainer}>
                <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={styles.editAvatarWrapper}>
                  {editAvatar ? (
                    <Image source={{ uri: editAvatar.uri }} style={styles.editAvatarImage} />
                  ) : avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.editAvatarImage} />
                  ) : (
                    <LinearGradient colors={['#5c5cf6', '#6366f1']} style={styles.editAvatarFallback}>
                      <Text style={styles.editAvatarInitial}>{initial}</Text>
                    </LinearGradient>
                  )}
                  <View style={styles.cameraIconBadge}>
                    <Ionicons name="camera" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>İsim</Text>
                <TextInput style={styles.formInput} value={editName} onChangeText={setEditName} placeholder="Adınız" placeholderTextColor="#6b7280" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Biyografi</Text>
                <TextInput style={[styles.formInput, { height: 80 }]} value={editBio} onChangeText={setEditBio} placeholder="Kendinden biraz bahset..." placeholderTextColor="#6b7280" multiline />
              </View>
              
              {/* Full Width Save Button */}
              <View style={styles.modalActionsSingle}>
                <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
                  <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.saveBtnGradient}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Settings Modal (Fiziksel Özellikler) */}
      <Modal visible={settingsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalContent, { marginTop: 60 }]}>
              <Text style={styles.modalTitle}>⚙️ Fiziksel Özellikler</Text>

              {[
                { label: 'Cinsiyet', key: 'gender', options: GENDERS },
                { label: 'Vücut Tipi', key: 'bodyType', options: BODY_TYPES },
                { label: 'Ten Rengi', key: 'skinTone', options: SKIN_TONES },
              ].map(field => (
                <View key={field.key} style={styles.formGroup}>
                  <Text style={styles.formLabel}>{field.label}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {field.options.map(opt => (
                      <TouchableOpacity key={opt} onPress={() => setSettings(p => ({ ...p, [field.key]: opt }))}>
                        {settings[field.key] === opt ? (
                          <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.settingsChipActive}>
                            <Text style={styles.settingsChipTextActive}>{opt}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={styles.settingsChip}>
                            <Text style={styles.settingsChipText}>{opt}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ))}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Yaş</Text>
                <TextInput
                  style={styles.formInput}
                  value={settings.age}
                  onChangeText={v => setSettings(p => ({ ...p, age: v }))}
                  placeholder="Yaşınız"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettingsModal(false)}>
                  <Text style={styles.cancelBtnText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={async () => {
                    try {
                      // ÖZELLİK 4: Supabase users tablosuna fiziksel özellikleri kaydet
                      if (user) {
                        await supabase.from('users').update({
                          gender: settings.gender,
                          age: settings.age ? parseInt(settings.age) : null,
                          body_type: settings.bodyType,
                          skin_tone: settings.skinTone,
                        }).eq('id', user.id);
                      }
                      // AsyncStorage yedek olarak da kaydet
                      await AsyncStorage.setItem('physical_settings', JSON.stringify(settings));
                      setSettingsModal(false);
                      Alert.alert('✅ Kaydedildi', 'Fiziksel özellikler kaydedildi. Günün kombini bir sonraki açılışta kişiselleştirilecek.');
                    } catch (err) {
                      console.log('Settings save error:', err);
                      // Supabase hata verse bile AsyncStorage'a kaydet
                      try {
                        await AsyncStorage.setItem('physical_settings', JSON.stringify(settings));
                      } catch {}
                      setSettingsModal(false);
                      Alert.alert('✅ Kaydedildi', 'Özellikler yerel olarak kaydedildi.');
                    }
                  }}
                >
                  <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.saveBtnGradient}>
                    <Text style={styles.saveBtnText}>Kaydet</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Share Post Modal */}
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
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
              {selectedPost && (
                <>
                  {/* Top Header Row */}
                  <View style={styles.detailHeaderRow}>
                    <TouchableOpacity onPress={() => setSelectedPost(null)} style={styles.detailCloseBtn}>
                      <Ionicons name="close" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                    
                    <View style={styles.detailUserContainer}>
                      {renderAvatar(selectedPost.profiles?.avatar_url, (selectedPost.profiles?.full_name || 'K')[0].toUpperCase(), 40)}
                      <Text style={styles.detailUsername}>@{selectedPost.profiles?.full_name || 'Kullanıcı'}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {user && selectedPost.user_id === user.id && (
                        <TouchableOpacity 
                          style={styles.deletePostBtn} 
                          onPress={() => handleDeletePost(selectedPost.id, selectedPost.image_url)}
                        >
                          <Text style={styles.deletePostBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Image */}
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

                  {/* Description */}
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
                        const isOwnComment = user && comment.user_id === user.id;
                        return (
                          <View key={comment.id} style={styles.commentItem}>
                            {renderAvatar(comment.users?.avatar_url, commenterInitial, 32)}
                            <View style={styles.commentInfo}>
                              <Text style={styles.commentAuthorText}>
                                <Text style={styles.commentAuthor}>{commenterName}</Text>
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
                      {selectedPost.post_likes?.some(l => l.user_id === user?.id) ? (
                        <Ionicons name="heart" size={24} color="#ef4444" />
                      ) : (
                        <Ionicons name="heart-outline" size={24} color="#fff" />
                      )}
                      <Text style={styles.detailActionCount}>{selectedPost.post_likes?.length || 0}</Text>
                    </TouchableOpacity>

                    <View style={styles.detailCommentBtn}>
                      <Ionicons name="chatbubble-outline" size={22} color="#fff" />
                    </View>

                    <TouchableOpacity style={styles.detailShareBtn} onPress={() => { /* silent */ }}>
                      <Ionicons name="share-outline" size={24} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.detailSaveBtn} onPress={() => toggleSavePost(selectedPost.id)}>
                      <Ionicons 
                        name={savedPostsMap[selectedPost.id] ? "bookmark" : "bookmark-outline"} 
                        size={24} 
                        color={savedPostsMap[selectedPost.id] ? "#ef4444" : "#fff"} 
                      />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {user && selectedPost && (
                <View style={styles.addCommentContainer}>
                  {renderAvatar(user.user_metadata?.avatar_url || user.avatar_url, (user.user_metadata?.full_name || 'K')[0].toUpperCase(), 36)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' },
  profileHeaderContainer: { flexDirection: 'row', padding: 24, alignItems: 'center' },
  avatarWrapper: {
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 14,
  },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 36 },
  userDetails: { flex: 1, marginLeft: 24 },
  displayName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  statsContainer: { flexDirection: 'row', gap: 20, marginVertical: 8 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 12, color: '#9ca3af', marginTop: 2, fontWeight: '500' },
  buttonsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  pillButton: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pillButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  redButton: { backgroundColor: '#e11d48', borderColor: '#e11d48' },
  redButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 },
  tabsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  tabButton: { paddingVertical: 12 },
  tabButtonActive: { borderBottomWidth: 2, borderBottomColor: '#fff' },
  tabText: { color: '#9ca3af', fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#fff' },
  gridContent: { padding: 12 },
  gridContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  column: { width: '48.5%' },
  postCard: { backgroundColor: 'transparent', borderRadius: 24, marginBottom: 20, overflow: 'hidden' },
  imageWrapper: { borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  postImage: { width: '100%' },
  postImagePlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  postPlaceholderEmoji: { fontSize: 36 },
  postInfo: { paddingVertical: 8, paddingHorizontal: 4 },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  postMeta: { marginLeft: 8, flex: 1 },
  postUsername: { color: '#fff', fontWeight: '700', fontSize: 13 },
  postDate: { color: '#6b7280', fontSize: 10, marginTop: 1 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, width: '100%', gap: 12 },
  emptyText: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
  bottomArea: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  logoutButton: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, width: '100%', alignItems: 'center', marginBottom: 16 },
  logoutButtonText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  appInfo: { color: '#4b5563', fontSize: 12 },

  // Edit / Settings Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#13111a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 20 },
  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#d1d5db', marginBottom: 6 },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#fff',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', textAlignVertical: 'top',
  },
  settingsChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  settingsChipText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  settingsChipActive: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, marginRight: 8 },
  settingsChipTextActive: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelBtnText: { color: '#9ca3af', fontWeight: '700' },
  saveBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  saveBtnGradient: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700' },

  // New Post picker
  imagePicker: { width: '100%', height: 200, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  imagePreview: { width: '100%', height: '100%', borderRadius: 16 },
  imagePlaceholder: { alignItems: 'center' },
  imagePlaceholderIcon: { fontSize: 36, marginBottom: 8 },
  imagePlaceholderText: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },

  // Detail Modal Styles
  detailModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  detailModalContent: { backgroundColor: '#13111a', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%', paddingBottom: 20 },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  detailUserContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginLeft: 10 },
  detailCloseBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18 },
  detailCloseText: { color: '#9ca3af', fontSize: 16, fontWeight: 'bold' },
  detailScrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  detailUsername: { color: '#fff', fontWeight: '800', fontSize: 16 },
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

  // Edit Profile styles
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalCloseBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16 },
  editAvatarContainer: { alignItems: 'center', marginVertical: 16 },
  editAvatarWrapper: { width: 100, height: 100, borderRadius: 50, position: 'relative' },
  editAvatarImage: { width: 100, height: 100, borderRadius: 50 },
  editAvatarFallback: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  editAvatarInitial: { color: '#fff', fontSize: 40, fontWeight: '800' },
  cameraIconBadge: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#13111a' },
  modalActionsSingle: { marginTop: 16 },

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
