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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

const STYLE_OPTIONS = [
  { key: 'casual', label: '👕 Günlük', color: ['#6366f1', '#8b5cf6'] },
  { key: 'business', label: '💼 İş', color: ['#0ea5e9', '#6366f1'] },
  { key: 'sport', label: '🏃 Sportif', color: ['#10b981', '#059669'] },
  { key: 'streetwear', label: '🧢 Sokak', color: ['#f59e0b', '#ef4444'] },
  { key: 'elegant', label: '🌹 Şık', color: ['#ec4899', '#a855f7'] },
];

const DAILY_OUTFIT_CACHE_KEY = 'daily_outfit_cache';

const StatCard = ({ icon, value, label, color }) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ============================================================
// ÖZELLİK 3A: Hava Durumu API Fonksiyonu
// ============================================================
const fetchWeather = async (city = 'Istanbul') => {
  const apiKey = process.env.EXPO_PUBLIC_WEATHER_API_KEY;
  if (!apiKey) return { temp: 20, condition: 'Güneşli', icon: '☀️' };
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&lang=tr&appid=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Hava durumu alınamadı');
    const data = await res.json();
    return {
      temp: Math.round(data.main.temp),
      condition: data.weather[0].description,
      icon: data.weather[0].icon
        ? `https://openweathermap.org/img/wn/${data.weather[0].icon}.png`
        : '🌤️',
      city: data.name,
    };
  } catch {
    return { temp: 20, condition: 'Bilinmiyor', icon: '🌤️' };
  }
};

// ============================================================
// ÖZELLİK 3B: Web projesinden port edilen yerel kombin algoritması
// (kombin-uygulamasi/js/api.js → generateOutfitIdea)
// ============================================================
const COLOR_MATRIX = {
  'siyah': { 'siyah': 3, 'beyaz': 5, 'gri': 4, 'kırmızı': 4, 'bej': 4, 'lacivert': 2, 'mavi': 3, 'yeşil': 3, 'sarı': 4, 'kahverengi': 1 },
  'beyaz': { 'siyah': 5, 'beyaz': 3, 'gri': 4, 'kırmızı': 4, 'bej': 4, 'lacivert': 5, 'mavi': 4, 'yeşil': 4, 'sarı': 3, 'kahverengi': 4 },
  'gri':   { 'siyah': 4, 'beyaz': 4, 'gri': 2, 'kırmızı': 3, 'bej': 2, 'lacivert': 4, 'mavi': 3, 'yeşil': 2, 'sarı': 3, 'kahverengi': 2 },
  'lacivert': { 'siyah': 2, 'beyaz': 5, 'gri': 4, 'kırmızı': 3, 'bej': 5, 'lacivert': 2, 'mavi': 4, 'yeşil': 2, 'sarı': 4, 'kahverengi': 3 },
  'bej':   { 'siyah': 4, 'beyaz': 4, 'gri': 2, 'kırmızı': 3, 'bej': 2, 'lacivert': 5, 'mavi': 4, 'yeşil': 4, 'sarı': 2, 'kahverengi': 4 },
  'kırmızı': { 'siyah': 4, 'beyaz': 4, 'gri': 3, 'kırmızı': 1, 'bej': 3, 'lacivert': 3, 'mavi': 2, 'yeşil': 1, 'sarı': 1, 'kahverengi': 2 },
  'yeşil': { 'siyah': 3, 'beyaz': 4, 'gri': 2, 'kırmızı': 1, 'bej': 4, 'lacivert': 2, 'mavi': 2, 'yeşil': 1, 'sarı': 2, 'kahverengi': 4 },
  'mavi':  { 'siyah': 3, 'beyaz': 4, 'gri': 3, 'kırmızı': 2, 'bej': 4, 'lacivert': 4, 'mavi': 2, 'yeşil': 2, 'sarı': 3, 'kahverengi': 3 },
  'sarı':  { 'siyah': 4, 'beyaz': 3, 'gri': 3, 'kırmızı': 1, 'bej': 2, 'lacivert': 4, 'mavi': 3, 'yeşil': 2, 'sarı': 1, 'kahverengi': 2 },
  'kahverengi': { 'siyah': 1, 'beyaz': 4, 'gri': 2, 'kırmızı': 2, 'bej': 4, 'lacivert': 3, 'mavi': 3, 'yeşil': 4, 'sarı': 2, 'kahverengi': 1 },
};

const getColorScore = (c1, c2) => {
  if (!c1 || !c2) return 1;
  let color1 = c1.toLowerCase();
  let color2 = c2.toLowerCase();
  if (color1.includes('kot')) color1 = 'mavi';
  if (color2.includes('kot')) color2 = 'mavi';
  const match1 = Object.keys(COLOR_MATRIX).find(k => color1.includes(k));
  const match2 = Object.keys(COLOR_MATRIX).find(k => color2.includes(k));
  if (match1 && match2) return COLOR_MATRIX[match1][match2] * 1.5;
  if (match1 && ['siyah', 'beyaz', 'gri', 'bej'].includes(match1)) return 4;
  if (match2 && ['siyah', 'beyaz', 'gri', 'bej'].includes(match2)) return 4;
  return 1;
};

const scoreItem = (item, temp, type) => {
  let score = 0;
  const attr = item.attributes || {};
  const sleeve = (attr.sleeve || '').toLowerCase();
  const texture = (attr.texture || '').toLowerCase();
  const leg = (attr.leg_length || '').toLowerCase();
  const neck = (attr.neckline || '').toLowerCase();

  if (temp > 25) {
    if (type === 'ust') {
      if (sleeve.includes('kısa')) score += 3;
      else if (sleeve.includes('kolsuz')) score += 5;
      else if (sleeve.includes('uzun')) score -= 5;
      if (texture.includes('keten') || texture.includes('ipek') || texture.includes('pamuk')) score += 3;
      else if (texture.includes('yün') || texture.includes('örgü') || texture.includes('deri')) score -= 5;
    } else if (type === 'alt') {
      if (leg.includes('şort') || leg.includes('kısa')) score += 5;
      else if (leg.includes('tam boy')) score -= 2;
      if (texture.includes('keten') || texture.includes('pamuk')) score += 3;
      else if (texture.includes('yün') || texture.includes('deri')) score -= 5;
    }
  } else if (temp > 15 && temp <= 25) {
    if (type === 'ust') {
      if (sleeve.includes('kısa') || sleeve.includes('uzun')) score += 2;
      if (texture.includes('pamuk') || texture.includes('kot') || texture.includes('keten')) score += 2;
      else if (texture.includes('yün')) score -= 2;
    } else if (type === 'alt') {
      if (leg.includes('tam boy') || leg.includes('bilek')) score += 3;
      if (leg.includes('şort')) score -= 2;
      if (texture.includes('kot') || texture.includes('pamuk')) score += 2;
    } else if (type === 'dis') {
      if (texture.includes('kot') || texture.includes('deri') || texture.includes('keten')) score += 3;
    }
  } else {
    if (type === 'ust') {
      if (sleeve.includes('uzun')) score += 5;
      else if (sleeve.includes('kısa')) score -= 3;
      else if (sleeve.includes('kolsuz')) score -= 5;
      if (texture.includes('yün') || texture.includes('örgü')) score += 4;
      else if (texture.includes('keten') || texture.includes('ipek') || texture.includes('saten')) score -= 4;
      if (neck.includes('balıkçı') || neck.includes('kapüşonlu')) score += 3;
    } else if (type === 'alt') {
      if (leg.includes('tam boy')) score += 4;
      else if (leg.includes('şort') || leg.includes('kısa')) score -= 5;
      if (texture.includes('yün') || texture.includes('kot') || texture.includes('deri')) score += 3;
      else if (texture.includes('keten')) score -= 3;
    } else if (type === 'dis') {
      if (texture.includes('yün') || texture.includes('deri') || texture.includes('kapitone')) score += 4;
    }
  }
  // Rastgelelik (her gün aynı kıyafet seçilmesin)
  score += Math.random() * 2;
  return score;
};

const generateLocalOutfit = (items, temp) => {
  const ust = items.filter(i => {
    const cat = (i.categories?.name || '').toLowerCase();
    return cat.includes('ust') || cat.includes('üst');
  });
  const alt = items.filter(i => {
    const cat = (i.categories?.name || '').toLowerCase();
    return cat.includes('alt');
  });
  const ayakkabi = items.filter(i => {
    const cat = (i.categories?.name || '').toLowerCase();
    return cat.includes('ayakkabi') || cat.includes('ayakkabı');
  });
  const dis = items.filter(i => {
    const cat = (i.categories?.name || '').toLowerCase();
    return cat.includes('dis') || cat.includes('dış') || cat.includes('ceket');
  });

  if (ust.length === 0 || alt.length === 0 || ayakkabi.length === 0) {
    return null; // Yetersiz veri
  }

  let best = { ust: ust[0], alt: alt[0], score: -999 };
  ust.forEach(u => {
    const uScore = scoreItem(u, temp, 'ust');
    alt.forEach(a => {
      const aScore = scoreItem(a, temp, 'alt');
      const cScore = getColorScore(u.colors?.name, a.colors?.name);
      const total = uScore + aScore + cScore;
      if (total > best.score) best = { ust: u, alt: a, score: total };
    });
  });

  let selectedShoe = ayakkabi[0];
  let bestShoeScore = -999;
  ayakkabi.forEach(shoe => {
    const s = scoreItem(shoe, temp, 'ayakkabi')
      + getColorScore(shoe.colors?.name, best.ust.colors?.name)
      + getColorScore(shoe.colors?.name, best.alt.colors?.name);
    if (s > bestShoeScore) { bestShoeScore = s; selectedShoe = shoe; }
  });

  let selectedDis = null;
  if (temp < 18 && dis.length > 0) {
    let bestDis = -999;
    dis.forEach(d => {
      const s = scoreItem(d, temp, 'dis') + getColorScore(d.colors?.name, best.ust.colors?.name);
      if (s > bestDis) { bestDis = s; selectedDis = d; }
    });
  }

  const pieces = [
    { name: best.ust.name, type: '👕 Üst Giyim', color: best.ust.colors?.name },
    { name: best.alt.name, type: '👖 Alt Giyim', color: best.alt.colors?.name },
    { name: selectedShoe.name, type: '👟 Ayakkabı', color: selectedShoe.colors?.name },
  ];
  if (selectedDis) pieces.push({ name: selectedDis.name, type: '🧥 Dış Giyim', color: selectedDis.colors?.name });

  return pieces;
};

// ============================================================
// MAIN SCREEN
// ============================================================
export default function DashboardScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wardrobeCount, setWardrobeCount] = useState(0);
  const [outfitCount, setOutfitCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('casual');

  // ÖZELLİK 3: Hava Durumu + Günün Kombini
  const [weather, setWeather] = useState(null);
  const [dailyOutfit, setDailyOutfit] = useState(null);
  const [loadingDailyOutfit, setLoadingDailyOutfit] = useState(false);

  const getTodayKey = () => new Date().toISOString().split('T')[0]; // "2024-06-25"

  // Günün Kombinini yükle (cache kontrolü + algoritma)
  const loadDailyOutfit = useCallback(async (currentUser, weatherData) => {
    if (!currentUser) return;
    setLoadingDailyOutfit(true);
    try {
      const todayKey = getTodayKey();
      const cacheRaw = await AsyncStorage.getItem(DAILY_OUTFIT_CACHE_KEY);
      if (cacheRaw) {
        const cache = JSON.parse(cacheRaw);
        // Bugün için cache var mı?
        if (cache.date === todayKey && cache.userId === currentUser.id && cache.outfit) {
          setDailyOutfit(cache.outfit);
          setLoadingDailyOutfit(false);
          return;
        }
      }

      // Cache yok veya eski — yeni kombin üret
      const { data: rawItems } = await supabase
        .from('wardrobe')
        .select('*, categories(name), colors(name)')
        .eq('user_id', currentUser.id);

      const temp = weatherData?.temp || 20;
      const outfit = generateLocalOutfit(rawItems || [], temp);

      if (outfit) {
        setDailyOutfit(outfit);
        // Cache'e kaydet
        await AsyncStorage.setItem(DAILY_OUTFIT_CACHE_KEY, JSON.stringify({
          date: todayKey,
          userId: currentUser.id,
          outfit,
        }));
      }
    } catch (e) {
      console.log('Daily outfit error:', e);
    } finally {
      setLoadingDailyOutfit(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);

      if (u) {
        // Profil
        let prof = null;
        try {
          const { data } = await supabase.from('users').select('*').eq('id', u.id).single();
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

        // ÖZELLİK 3: Hava durumu çek
        const userCity = prof?.city || 'Istanbul';
        const weatherData = await fetchWeather(userCity);
        setWeather(weatherData);

        // Günün kombini
        await loadDailyOutfit(u, weatherData);
      }
    } catch (e) {
      console.log('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadDailyOutfit]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const refreshDailyOutfit = async () => {
    // Cache'i temizle ve yeniden üret
    await AsyncStorage.removeItem(DAILY_OUTFIT_CACHE_KEY);
    await loadDailyOutfit(user, weather);
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

        {/* ÖZELLİK 3: Hava Durumu Kartı */}
        {weather && (
          <View style={styles.weatherCard}>
            <LinearGradient colors={['#0ea5e9', '#6366f1']} style={styles.weatherGradient}>
              <View style={styles.weatherLeft}>
                <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
                <Text style={styles.weatherCondition}>{weather.condition}</Text>
                {weather.city && <Text style={styles.weatherCity}>📍 {weather.city}</Text>}
              </View>
              <View style={styles.weatherRight}>
                {typeof weather.icon === 'string' && weather.icon.startsWith('http') ? (
                  <Image source={{ uri: weather.icon }} style={styles.weatherIconImg} />
                ) : (
                  <Text style={styles.weatherIconEmoji}>{weather.icon || '🌤️'}</Text>
                )}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ÖZELLİK 3: Günün Kombini Kartı */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>☀️ Günün Kombini</Text>
          <TouchableOpacity onPress={refreshDailyOutfit} disabled={loadingDailyOutfit}>
            <Text style={styles.refreshBtn}>{loadingDailyOutfit ? '...' : '🔄'}</Text>
          </TouchableOpacity>
        </View>

        {loadingDailyOutfit ? (
          <View style={styles.dailyOutfitLoading}>
            <ActivityIndicator color="#a855f7" />
            <Text style={styles.dailyOutfitLoadingText}>Kombin hesaplanıyor...</Text>
          </View>
        ) : dailyOutfit ? (
          <View style={styles.dailyOutfitCard}>
            <LinearGradient colors={['#1a1040', '#0f0c29']} style={styles.dailyOutfitGradient}>
              <Text style={styles.dailyOutfitTitle}>
                🌡️ {weather?.temp ? `${weather.temp}°C için önerilen kombin` : 'Bugünün kombini'}
              </Text>
              {dailyOutfit.map((piece, idx) => (
                <View key={idx} style={styles.dailyPieceRow}>
                  <Text style={styles.dailyPieceType}>{piece.type}</Text>
                  <Text style={styles.dailyPieceName}>{piece.name}</Text>
                  {piece.color ? <Text style={styles.dailyPieceColor}>{piece.color}</Text> : null}
                </View>
              ))}
              <TouchableOpacity
                style={styles.dailyOutfitBtn}
                onPress={() => navigation.navigate('Outfits')}
                activeOpacity={0.85}
              >
                <Text style={styles.dailyOutfitBtnText}>Farklı Kombin Oluştur →</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.dailyOutfitEmpty}>
            <Text style={styles.dailyOutfitEmptyIcon}>👗</Text>
            <Text style={styles.dailyOutfitEmptyText}>
              Günün kombinini görmek için gardırobuna en az 1 üst, 1 alt ve 1 ayakkabı ekle.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Wardrobe')}>
              <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.dailyOutfitAddBtn}>
                <Text style={styles.dailyOutfitAddBtnText}>+ Gardıroba Git</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

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
  header: { paddingTop: 60, paddingBottom: 28, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 14, color: '#a5b4fc', marginBottom: 2 },
  userName: { fontSize: 24, fontWeight: '800', color: '#fff' },
  avatarBtn: { shadowColor: '#a855f7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, padding: 14, alignItems: 'center',
    borderTopWidth: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2, fontWeight: '500' },
  content: { padding: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 14, marginTop: 8 },
  refreshBtn: { fontSize: 20 },

  // Hava Durumu Kartı
  weatherCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 20, shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  weatherGradient: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  weatherLeft: {},
  weatherTemp: { fontSize: 36, fontWeight: '900', color: '#fff' },
  weatherCondition: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize', marginTop: 2 },
  weatherCity: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  weatherRight: { alignItems: 'center' },
  weatherIconImg: { width: 64, height: 64 },
  weatherIconEmoji: { fontSize: 52 },

  // Günün Kombini
  dailyOutfitLoading: { alignItems: 'center', padding: 24, gap: 12 },
  dailyOutfitLoadingText: { color: '#9ca3af', fontSize: 13 },
  dailyOutfitCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' },
  dailyOutfitGradient: { padding: 20 },
  dailyOutfitTitle: { color: '#a5b4fc', fontSize: 13, fontWeight: '600', marginBottom: 14 },
  dailyPieceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10 },
  dailyPieceType: { fontSize: 15, minWidth: 110 },
  dailyPieceName: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 13 },
  dailyPieceColor: { color: '#9ca3af', fontSize: 11 },
  dailyOutfitBtn: { marginTop: 12, alignItems: 'flex-end' },
  dailyOutfitBtnText: { color: '#a855f7', fontWeight: '700', fontSize: 13 },
  dailyOutfitEmpty: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  dailyOutfitEmptyIcon: { fontSize: 40, marginBottom: 10 },
  dailyOutfitEmptyText: { color: '#9ca3af', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  dailyOutfitAddBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  dailyOutfitAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Action Grid
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  actionCard: {
    width: (width - 52) / 2, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  actionGradient: { padding: 18 },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  actionDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  // Style chips
  styleScroll: { marginBottom: 16 },
  styleChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100, marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  styleChipText: { color: '#9ca3af', fontWeight: '600', fontSize: 14 },
  styleChipActive: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100, marginRight: 10 },
  styleChipTextActive: { color: '#fff', fontWeight: '700', fontSize: 14 },

  generateBtn: {
    borderRadius: 16, overflow: 'hidden', marginTop: 4, marginBottom: 24,
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  generateBtnGradient: { paddingVertical: 18, alignItems: 'center' },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
