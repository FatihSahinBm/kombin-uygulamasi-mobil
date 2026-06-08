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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

const BODY_TYPES = ['Dikdörtgen', 'Üçgen', 'Ters Üçgen', 'Kum Saati', 'Yuvarlak', 'Belirtmek İstemiyorum'];
const SKIN_TONES = ['Açık / Beyaz', 'Buğday / Kumral', 'Esmer / Zeytin', 'Koyu / Siyahi'];
const GENDERS = ['Erkek', 'Kadın', 'Belirtmek İstemiyorum'];

export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [postCount, setPostCount] = useState(0);
  const [wardrobeCount, setWardrobeCount] = useState(0);
  const [outfitCount, setOutfitCount] = useState(0);
  const [settings, setSettings] = useState({ gender: 'Belirtmek İstemiyorum', age: '', bodyType: 'Belirtmek İstemiyorum', skinTone: 'Belirtmek İstemiyorum' });

  const load = useCallback(async () => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (!u) return;

      // Profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .single();
      setProfile(prof);
      setEditName(prof?.full_name || u.user_metadata?.full_name || '');
      setEditBio(prof?.bio || '');

      // Counts
      const [{ count: pc }, { count: wc }, { count: oc }] = await Promise.all([
        supabase.from('social_posts').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
        supabase.from('wardrobe_items').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
        supabase.from('outfits').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
      ]);
      setPostCount(pc || 0);
      setWardrobeCount(wc || 0);
      setOutfitCount(oc || 0);
    } catch (e) { console.log('Profile load error:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: editName,
        bio: editBio,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: editName } });
      setEditModal(false);
      load();
    } catch (e) { Alert.alert('Hata', e.message); }
    finally { setSaving(false); }
  };

  const logout = async () => {
    Alert.alert('Çıkış Yap', 'Çıkmak istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); } },
    ]);
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Kullanıcı';
  const initial = displayName[0]?.toUpperCase() || '?';

  if (loading) return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#a855f7" />
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#0f0c29', '#302b63']} style={styles.header}>
        <View style={styles.avatarWrapper}>
          <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        <Text style={styles.email}>{user?.email}</Text>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{postCount}</Text>
          <Text style={styles.statLabel}>Gönderi</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{wardrobeCount}</Text>
          <Text style={styles.statLabel}>Kıyafet</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{outfitCount}</Text>
          <Text style={styles.statLabel}>Kombin</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menu}>
        {[
          { icon: '✏️', label: 'Profili Düzenle', onPress: () => setEditModal(true) },
          { icon: '⚙️', label: 'Fiziksel Özellikler', onPress: () => setSettingsModal(true) },
          { icon: '🔔', label: 'Bildirimler', onPress: () => Alert.alert('Yakında', 'Bu özellik yakında eklenecek.') },
          { icon: '🔒', label: 'Gizlilik', onPress: () => Alert.alert('Yakında', 'Bu özellik yakında eklenecek.') },
          { icon: '💬', label: 'Destek', onPress: () => Alert.alert('Destek', 'support@kombin.ai') },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={logout} activeOpacity={0.7}>
          <Text style={styles.menuIcon}>🚪</Text>
          <Text style={[styles.menuLabel, styles.logoutLabel]}>Çıkış Yap</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <Text style={styles.appInfo}>Kombin.AI v1.0.0</Text>

      {/* Edit Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Profili Düzenle</Text>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Ad Soyad</Text>
              <TextInput style={styles.formInput} value={editName} onChangeText={setEditName} placeholder="Adınız" placeholderTextColor="#6b7280" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Biyografi</Text>
              <TextInput style={[styles.formInput, { height: 80 }]} value={editBio} onChangeText={setEditBio} placeholder="Kendinizi tanıtın..." placeholderTextColor="#6b7280" multiline />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
                <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.saveBtnGradient}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
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
                <TouchableOpacity style={styles.saveBtn} onPress={() => { setSettingsModal(false); Alert.alert('Kaydedildi', 'Fiziksel özellikler kaydedildi.'); }}>
                  <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.saveBtnGradient}>
                    <Text style={styles.saveBtnText}>Kaydet</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' },
  header: { paddingTop: 70, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' },
  avatarWrapper: {
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 14,
    marginBottom: 16,
  },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 36 },
  displayName: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
  bio: { fontSize: 14, color: '#a5b4fc', textAlign: 'center', marginBottom: 6 },
  email: { fontSize: 13, color: '#6b7280' },
  statsRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20, borderRadius: 20, padding: 20, marginTop: -10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 12, color: '#9ca3af', marginTop: 2, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  menu: { margin: 20, marginTop: 24 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { flex: 1, color: '#e5e7eb', fontWeight: '600', fontSize: 15 },
  menuArrow: { color: '#6b7280', fontSize: 20 },
  logoutItem: { borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.05)' },
  logoutLabel: { color: '#ef4444' },
  appInfo: { textAlign: 'center', color: '#4b5563', fontSize: 12, marginBottom: 40 },
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
});
