import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

const CATEGORIES = ['Tümü', 'Üst Giyim', 'Alt Giyim', 'Ayakkabı', 'Dış Giyim', 'Aksesuar'];

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

export default function WardrobeScreen() {
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState('Tümü');
  const [search, setSearch] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', brand: '', category: 'Üst Giyim', color: '', size: '' });
  const [newImage, setNewImage] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('wardrobe')
        .select('*, categories(name), colors(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const normalizedData = (data || []).map(item => ({
        ...item,
        category: item.categories?.name === 'ust' ? 'Üst Giyim' :
                  item.categories?.name === 'alt' ? 'Alt Giyim' :
                  item.categories?.name === 'ayakkabi' ? 'Ayakkabı' :
                  item.categories?.name === 'dis_giyim' ? 'Dış Giyim' :
                  item.categories?.name === 'aksesuar' ? 'Aksesuar' : (item.categories?.name || 'Üst Giyim'),
        color: item.colors?.name || '',
        brand: item.attributes?.brand || '',
        size: item.attributes?.size || '',
      }));

      setItems(normalizedData);
      setFiltered(normalizedData);
    } catch (e) {
      console.log('Wardrobe load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    let result = items;
    if (selectedCat !== 'Tümü') result = result.filter(i => i.category === selectedCat);
    if (search) result = result.filter(i =>
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.brand?.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [items, selectedCat, search]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeri erişim izni gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setNewImage(result.assets[0]);
  };

  const saveItem = async () => {
    if (!newItem.name) { Alert.alert('Hata', 'Kıyafet adı zorunludur.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let imageUrl = null;

      if (newImage) {
        const ext = newImage.uri.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        
        const formData = new FormData();
        formData.append('file', {
          uri: newImage.uri,
          name: fileName.split('/').pop(),
          type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        });
        
        let uploadBucket = 'wardrobe_images';
        let { error: uploadError } = await supabase.storage
          .from(uploadBucket)
          .upload(fileName, formData, { contentType: 'multipart/form-data' });
          
        if (uploadError) {
          uploadBucket = 'wardrobe-images';
          const { error: retryError } = await supabase.storage
            .from(uploadBucket)
            .upload(fileName, formData, { contentType: 'multipart/form-data' });
          uploadError = retryError;
        }

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from(uploadBucket).getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      // Resolve category_id
      const catMap = {
        'Üst Giyim': 'ust',
        'Alt Giyim': 'alt',
        'Ayakkabı': 'ayakkabi',
        'Dış Giyim': 'dis_giyim',
        'Aksesuar': 'aksesuar'
      };
      const dbCategoryName = catMap[newItem.category] || newItem.category.toLowerCase();
      
      let categoryId = null;
      let { data: catDataArray } = await supabase.from('categories').select('id').eq('name', dbCategoryName).limit(1);
      if (catDataArray && catDataArray.length > 0) {
        categoryId = catDataArray[0].id;
      } else {
        const { data: newCat, error: catErr } = await supabase.from('categories').insert([{ name: dbCategoryName }]).select();
        if (!catErr && newCat) categoryId = newCat[0].id;
      }

      // Resolve color_id
      let colorId = null;
      if (newItem.color) {
        const dbColorName = newItem.color.toLowerCase();
        let { data: colDataArray } = await supabase.from('colors').select('id').eq('name', dbColorName).limit(1);
        if (colDataArray && colDataArray.length > 0) {
          colorId = colDataArray[0].id;
        } else {
          const { data: newCol, error: colErr } = await supabase.from('colors').insert([{ name: dbColorName }]).select();
          if (!colErr && newCol) colorId = newCol[0].id;
        }
      }

      const { error } = await supabase.from('wardrobe').insert({
        user_id: user.id,
        category_id: categoryId,
        color_id: colorId,
        name: newItem.name,
        image_url: imageUrl,
        attributes: {
          brand: newItem.brand || '',
          size: newItem.size || '',
        }
      });

      if (error) throw error;
      setAddModal(false);
      setNewItem({ name: '', brand: '', category: 'Üst Giyim', color: '', size: '' });
      setNewImage(null);
      loadItems();
    } catch (e) {
      Alert.alert('Hata', e.message || 'Kıyafet eklenirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = (id) => {
    Alert.alert('Sil', 'Bu kıyafeti silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          await supabase.from('wardrobe').delete().eq('id', id);
          loadItems();
        }
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.itemCard} activeOpacity={0.85} onLongPress={() => deleteItem(item.id)}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.itemImage} />
      ) : (
        <LinearGradient colors={['#302b63', '#24243e']} style={[styles.itemImage, styles.itemPlaceholder]}>
          <Text style={styles.itemPlaceholderText}>
            {item.category === 'Üst Giyim' ? '👕' :
             item.category === 'Alt Giyim' ? '👖' :
             item.category === 'Ayakkabı' ? '👟' :
             item.category === 'Dış Giyim' ? '🧥' : '👓'}
          </Text>
        </LinearGradient>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        {item.brand ? <Text style={styles.itemBrand}>{item.brand}</Text> : null}
        <View style={styles.itemTags}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.category}</Text>
          </View>
          {item.color ? <View style={styles.tag}><Text style={styles.tagText}>{item.color}</Text></View> : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#0f0c29', '#302b63']} style={styles.header}>
        <Text style={styles.headerTitle}>👕 Gardırobum</Text>
        <Text style={styles.headerSub}>{items.length} kıyafet</Text>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Kıyafet ara..."
          placeholderTextColor="#6b7280"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c} onPress={() => setSelectedCat(c)}>
            {c === selectedCat ? (
              <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.catChipActive}>
                <Text style={styles.catChipTextActive}>{c}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.catChip}>
                <Text style={styles.catChipText}>{c}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color="#a855f7" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={i => i.id?.toString()}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadItems(); }} tintColor="#a855f7" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👗</Text>
              <Text style={styles.emptyText}>Gardırobunuz boş</Text>
              <Text style={styles.emptySubtext}>+ butonuna basarak kıyafet ekleyin</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setAddModal(true)} activeOpacity={0.85}>
        <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.fabGradient}>
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={addModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Kıyafet Ekle</Text>

            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {newImage ? (
                <Image source={{ uri: newImage.uri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderIcon}>📷</Text>
                  <Text style={styles.imagePlaceholderText}>Fotoğraf Seç</Text>
                </View>
              )}
            </TouchableOpacity>

            {[
              { key: 'name', label: 'Kıyafet Adı *', placeholder: 'Örn: Beyaz Tişört' },
              { key: 'brand', label: 'Marka', placeholder: 'Örn: Zara' },
              { key: 'color', label: 'Renk', placeholder: 'Örn: Beyaz' },
              { key: 'size', label: 'Beden', placeholder: 'Örn: M, 42' },
            ].map(f => (
              <View key={f.key} style={styles.formGroup}>
                <Text style={styles.formLabel}>{f.label}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={f.placeholder}
                  placeholderTextColor="#6b7280"
                  value={newItem[f.key]}
                  onChangeText={v => setNewItem(p => ({ ...p, [f.key]: v }))}
                />
              </View>
            ))}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CATEGORIES.filter(c => c !== 'Tümü').map(c => (
                  <TouchableOpacity key={c} onPress={() => setNewItem(p => ({ ...p, category: c }))}>
                    {newItem.category === c ? (
                      <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.catChipActive}>
                        <Text style={styles.catChipTextActive}>{c}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.catChip}>
                        <Text style={styles.catChipText}>{c}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveItem} disabled={saving}>
                <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.saveBtnGradient}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
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
  searchBar: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0a0a0f' },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  catScroll: { paddingHorizontal: 16, marginBottom: 8 },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  catChipText: { color: '#9ca3af', fontWeight: '600', fontSize: 13 },
  catChipActive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, marginRight: 8 },
  catChipTextActive: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { padding: 12, paddingBottom: 100 },
  row: { justifyContent: 'space-between', gap: 12 },
  itemCard: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18, overflow: 'hidden', marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  itemImage: { width: '100%', aspectRatio: 1 },
  itemPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemPlaceholderText: { fontSize: 40 },
  itemInfo: { padding: 12 },
  itemName: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  itemBrand: { color: '#9ca3af', fontSize: 12, marginBottom: 8 },
  itemTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { backgroundColor: 'rgba(168,85,247,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#a855f7', fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { color: '#9ca3af', fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5,
    shadowRadius: 16, elevation: 12,
  },
  fabGradient: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#13111a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 20 },
  imagePicker: { alignSelf: 'center', marginBottom: 20 },
  imagePreview: { width: 120, height: 120, borderRadius: 16 },
  imagePlaceholder: {
    width: 120, height: 120, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', borderStyle: 'dashed',
  },
  imagePlaceholderIcon: { fontSize: 32, marginBottom: 4 },
  imagePlaceholderText: { color: '#9ca3af', fontSize: 12 },
  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#d1d5db', marginBottom: 6 },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#fff',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
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
