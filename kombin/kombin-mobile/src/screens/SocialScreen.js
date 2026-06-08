import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

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

  const loadPosts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          profiles(full_name, avatar_url),
          post_likes(user_id)
        `)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        // Tablo yoksa mock data göster
        const mockPosts = [
          { id: 1, description: '🌟 Bugünkü kombiim! Minimal tarz her zaman kazandırır.', created_at: new Date().toISOString(), profiles: { full_name: 'Kullanıcı' }, post_likes: [], image_url: null, tags: ['#casual', '#minimal'] },
          { id: 2, description: '🔥 Sokak modası vibes! Oversize hoodie + chunky sneaker', created_at: new Date().toISOString(), profiles: { full_name: 'FashionLover' }, post_likes: [], image_url: null, tags: ['#streetwear'] },
        ];
        setPosts(mockPosts);
      } else {
        setPosts(data || []);
      }
    } catch (e) {
      console.log('Social load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

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
        const response = await fetch(newImage.uri);
        const blob = await response.blob();
        const { error: upErr } = await supabase.storage
          .from('social-images')
          .upload(fileName, blob, { contentType: `image/${ext}` });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('social-images').getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase.from('social_posts').insert({
        user_id: user.id,
        description,
        image_url: imageUrl,
        tags: tags ? tags.split(' ').filter(t => t.startsWith('#')) : [],
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
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUser?.id });
    }
    loadPosts();
  };

  const renderPost = ({ item }) => {
    const liked = item.post_likes?.some(l => l.user_id === currentUser?.id);
    const name = item.profiles?.full_name || 'Kullanıcı';
    const initial = name[0]?.toUpperCase() || '?';
    const likeCount = item.post_likes?.length || 0;

    return (
      <View style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.postAvatar}>
            <Text style={styles.postAvatarText}>{initial}</Text>
          </LinearGradient>
          <View style={styles.postMeta}>
            <Text style={styles.postUsername}>{name}</Text>
            <Text style={styles.postDate}>
              {new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>

        {/* Image */}
        {item.image_url && (
          <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
        )}

        {/* No image placeholder */}
        {!item.image_url && (
          <LinearGradient colors={['#1a1040', '#302b63']} style={styles.postImagePlaceholder}>
            <Text style={styles.postPlaceholderEmoji}>✨</Text>
          </LinearGradient>
        )}

        {/* Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.likeBtn} onPress={() => toggleLike(item)}>
            <Text style={[styles.likeBtnIcon, liked && styles.likeBtnIconActive]}>
              {liked ? '❤️' : '🤍'}
            </Text>
            <Text style={[styles.likeCount, liked && styles.likeCountActive]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commentBtn}>
            <Text style={styles.commentBtnIcon}>💬</Text>
          </TouchableOpacity>
        </View>

        {/* Description */}
        {item.description ? (
          <View style={styles.postBody}>
            <Text style={styles.postDesc}>{item.description}</Text>
            {item.tags && item.tags.length > 0 && (
              <Text style={styles.postTags}>{Array.isArray(item.tags) ? item.tags.join(' ') : item.tags}</Text>
            )}
          </View>
        ) : null}
      </View>
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
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={i => i.id?.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPosts(); }} tintColor="#a855f7" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📸</Text>
              <Text style={styles.emptyText}>Henüz gönderi yok</Text>
              <Text style={styles.emptySubtext}>İlk kombini sen paylaş!</Text>
            </View>
          }
        />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#a5b4fc', marginTop: 4 },
  list: { padding: 12, paddingBottom: 100 },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  postAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  postAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  postMeta: { marginLeft: 12 },
  postUsername: { color: '#fff', fontWeight: '700', fontSize: 15 },
  postDate: { color: '#6b7280', fontSize: 12, marginTop: 1 },
  postImage: { width: '100%', aspectRatio: 1 },
  postImagePlaceholder: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  postPlaceholderEmoji: { fontSize: 60 },
  postActions: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 16 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeBtnIcon: { fontSize: 22 },
  likeBtnIconActive: {},
  likeCount: { color: '#9ca3af', fontWeight: '700', fontSize: 15 },
  likeCountActive: { color: '#ec4899' },
  commentBtn: {},
  commentBtnIcon: { fontSize: 22 },
  postBody: { paddingHorizontal: 14, paddingBottom: 14 },
  postDesc: { color: '#e5e7eb', fontSize: 14, lineHeight: 20 },
  postTags: { color: '#a855f7', fontSize: 13, marginTop: 6, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
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
});
