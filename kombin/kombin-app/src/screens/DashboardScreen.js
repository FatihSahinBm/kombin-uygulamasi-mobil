import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

const STYLE_OPTIONS = [
  { key: 'casual', label: '👕 Günlük', color: ['#6366f1', '#8b5cf6'] },
  { key: 'business', label: '💼 İş', color: ['#0ea5e9', '#6366f1'] },
  { key: 'sport', label: '🏃 Sportif', color: ['#10b981', '#059669'] },
  { key: 'streetwear', label: '🧢 Sokak', color: ['#f59e0b', '#ef4444'] },
  { key: 'elegant', label: '🌹 Şık', color: ['#ec4899', '#a855f7'] },
];

const StatCard = ({ icon, value, label, color }) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default function DashboardScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wardrobeCount, setWardrobeCount] = useState(0);
  const [outfitCount, setOutfitCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('casual');

  const loadData = useCallback(async () => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);

      if (u) {
        // Profil detayları (özellikle avatar_url için)
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

        // Gardırop sayısı
        const { count: wCount } = await supabase
          .from('wardrobe')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', u.id);
        setWardrobeCount(wCount || 0);

        // Kombin sayısı
        let oCount = 0;
        try {
          const { count } = await supabase
            .from('outfits')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', u.id);
          oCount = count || 0;
        } catch (err) {
          console.log('Outfits count fetch error:', err);
        }
        setOutfitCount(oCount);
      }
    } catch (e) {
      console.log('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi öğleden sonralar';
    return 'İyi akşamlar';
  };

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Kullanıcı';
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a855f7" />}
    >
      {/* Header */}
      <LinearGradient colors={['#0f0c29', '#302b63']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting()} 👋</Text>
            <Text style={styles.userName}>{displayName}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {displayName[0]?.toUpperCase() || '?'}
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard icon="👗" value={wardrobeCount} label="Kıyafet" color="#a855f7" />
          <StatCard icon="✨" value={outfitCount} label="Kombin" color="#6366f1" />
          <StatCard icon="❤️" value="0" label="Beğeni" color="#ec4899" />
        </View>
      </LinearGradient>

      {/* Main Content */}
      <View style={styles.content}>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Outfits')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.actionGradient}>
              <Text style={styles.actionIcon}>✨</Text>
              <Text style={styles.actionTitle}>Kombin Oluştur</Text>
              <Text style={styles.actionDesc}>Yapay zeka ile tasarla</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Wardrobe')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#0ea5e9', '#6366f1']} style={styles.actionGradient}>
              <Text style={styles.actionIcon}>👕</Text>
              <Text style={styles.actionTitle}>Gardırobum</Text>
              <Text style={styles.actionDesc}>{wardrobeCount} kıyafet</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Social')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#f59e0b', '#ef4444']} style={styles.actionGradient}>
              <Text style={styles.actionIcon}>🔥</Text>
              <Text style={styles.actionTitle}>Sosyal Akış</Text>
              <Text style={styles.actionDesc}>İlham al</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#10b981', '#059669']} style={styles.actionGradient}>
              <Text style={styles.actionIcon}>👤</Text>
              <Text style={styles.actionTitle}>Profilim</Text>
              <Text style={styles.actionDesc}>Ayarlar & tercihler</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Stil Seçici */}
        <Text style={styles.sectionTitle}>Bugünkü Tarzın</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.styleScroll}>
          {STYLE_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => setSelectedStyle(s.key)}
              activeOpacity={0.85}
            >
              {selectedStyle === s.key ? (
                <LinearGradient
                  colors={s.color}
                  style={styles.styleChipActive}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.styleChipTextActive}>{s.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.styleChip}>
                  <Text style={styles.styleChipText}>{s.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.generateBtn}
          onPress={() => navigation.navigate('Outfits', { defaultStyle: selectedStyle })}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#a855f7', '#6366f1']}
            style={styles.generateBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.generateBtnText}>
              {STYLE_OPTIONS.find(s => s.key === selectedStyle)?.label} Kombin Oluştur 🔮
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' },
  header: {
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { fontSize: 14, color: '#a5b4fc', marginBottom: 2 },
  userName: { fontSize: 24, fontWeight: '800', color: '#fff' },
  avatarBtn: { shadowColor: '#a855f7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2, fontWeight: '500' },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 14,
    marginTop: 8,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  actionCard: {
    width: (width - 52) / 2,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionGradient: { padding: 18 },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  actionDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  styleScroll: { marginBottom: 16 },
  styleChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  styleChipText: { color: '#9ca3af', fontWeight: '600', fontSize: 14 },
  styleChipActive: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    marginRight: 10,
  },
  styleChipTextActive: { color: '#fff', fontWeight: '700', fontSize: 14 },
  generateBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 24,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  generateBtnGradient: { paddingVertical: 18, alignItems: 'center' },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
