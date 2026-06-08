import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

const STYLE_OPTIONS = [
  { key: 'casual', label: 'Günlük (Casual)', emoji: '👕' },
  { key: 'business', label: 'İş Odaklı (Business)', emoji: '💼' },
  { key: 'sport', label: 'Sportif', emoji: '🏃' },
  { key: 'streetwear', label: 'Sokak Modası', emoji: '🧢' },
  { key: 'elegant', label: 'Özel Gün (Şık)', emoji: '🌹' },
];

const SOURCE_OPTIONS = [
  { key: 'wardrobe', label: '👗 Gardırobumdan', desc: 'Mevcut kıyafetlerimi kullan' },
  { key: 'external', label: '🛍 Dışarıdan Alışveriş', desc: 'Yeni ürünler öner' },
  { key: 'mixed', label: '🔀 Karışık', desc: 'Her ikisini de kullan' },
];

const COLOR_OPTIONS = [
  { key: '', label: 'Fark Etmez' },
  { key: 'monochrome', label: '⚫ Monokrom' },
  { key: 'earth', label: '🤎 Toprak Tonları' },
  { key: 'pastel', label: '🩷 Pastel' },
  { key: 'dark', label: '🖤 Koyu' },
  { key: 'vibrant', label: '🌈 Canlı' },
];

export default function OutfitsScreen({ route }) {
  const defaultStyle = route?.params?.defaultStyle || 'casual';
  const [style, setStyle] = useState(defaultStyle);
  const [source, setSource] = useState('mixed');
  const [colorPalette, setColorPalette] = useState('');
  const [budgetMin, setBudgetMin] = useState('0');
  const [budgetMax, setBudgetMax] = useState('5000');
  const [city, setCity] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const generateOutfit = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Giriş yapmanız gerekiyor.');

      // Gardırop öğelerini çek
      const { data: wardrobeItems } = await supabase
        .from('wardrobe_items')
        .select('name, category, color, brand')
        .eq('user_id', user.id)
        .limit(20);

      const prompt = `Sen bir moda uzmanısın. Aşağıdaki kriterlere göre Türkçe bir kombin önerisi yap:

Stil: ${STYLE_OPTIONS.find(s => s.key === style)?.label}
Bütçe: ${budgetMin}TL - ${budgetMax}TL
Kaynak: ${SOURCE_OPTIONS.find(s => s.key === source)?.label}
Renk Paleti: ${COLOR_OPTIONS.find(c => c.key === colorPalette)?.label}
${city ? `Şehir: ${city}` : ''}
${wardrobeItems?.length > 0 ? `\nGardırop: ${wardrobeItems.map(i => `${i.name} (${i.category}${i.color ? ', ' + i.color : ''})`).join(', ')}` : ''}

Lütfen şu formatta yanıt ver:
🎯 KOMBİN ADI: [kombin ismi]
✨ PARÇALAR: [her parçayı yeni satırda - emoji ve açıklama ile]
💡 STİL İPUCU: [bir cümle stil tavsiyesi]
🌡️ UYGUN HAVA: [hangi hava koşuluna uygun]`;

      // Gemini API çağrısı
      const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      let outfitText;
      if (response.ok) {
        const aiData = await response.json();
        outfitText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
      }

      // Fallback mock data
      if (!outfitText) {
        const styleMap = {
          casual: { name: 'Rahat Günlük Kombin', pieces: ['👕 Beyaz basic tişört', '👖 Slim fit bej chino', '👟 Beyaz sneaker', '🧴 Minimal saat'] },
          business: { name: 'Profesyonel İş Kombini', pieces: ['👔 Açık mavi gömlek', '👔 Lacivert blazer ceket', '👖 Gri pantolon', '👞 Oxford deri ayakkabı'] },
          sport: { name: 'Sportif Aktivite Kombini', pieces: ['🎽 Nefes alabilir spor tişört', '🩲 Spor şort / eşofman altı', '👟 Koşu ayakkabısı', '🧢 Spor şapka'] },
          streetwear: { name: 'Sokak Modası Kombini', pieces: ['🧥 Oversize hoodie', '👖 Baggy jean', '👟 Chunky sneaker', '🧢 Snapback şapka'] },
          elegant: { name: 'Şık Özel Gün Kombini', pieces: ['👗 Midi elbise / takım elbise', '👠 Topuklu ayakkabı', '👜 Mini çanta', '💍 İnce aksesuar'] },
        };
        const m = styleMap[style] || styleMap.casual;
        outfitText = `🎯 KOMBİN ADI: ${m.name}\n✨ PARÇALAR:\n${m.pieces.join('\n')}\n💡 STİL İPUCU: Kombini tamamlamak için hafif bir parfüm seçmeyi unutma.\n🌡️ UYGUN HAVA: Her mevsim uygundur.`;
      }

      // Kombini kaydet
      await supabase.from('outfits').insert({
        user_id: user.id,
        style,
        source,
        color_palette: colorPalette,
        budget_min: parseInt(budgetMin),
        budget_max: parseInt(budgetMax),
        city: city || null,
        ai_result: outfitText,
      }).select().single();

      setResult(outfitText);
    } catch (e) {
      console.log('Generate error:', e);
      Alert.alert('Hata', 'Kombin oluşturulurken bir hata oluştu.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#0f0c29', '#302b63']} style={styles.header}>
        <Text style={styles.headerTitle}>✨ Kombin Oluştur</Text>
        <Text style={styles.headerSub}>Yapay zeka ile tarzını yarat</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Stil */}
        <Text style={styles.sectionTitle}>Tarz Seç</Text>
        {STYLE_OPTIONS.map(s => (
          <TouchableOpacity key={s.key} onPress={() => setStyle(s.key)} activeOpacity={0.85}>
            <View style={[styles.optionCard, style === s.key && styles.optionCardActive]}>
              <Text style={styles.optionEmoji}>{s.emoji}</Text>
              <Text style={[styles.optionLabel, style === s.key && styles.optionLabelActive]}>{s.label}</Text>
              {style === s.key && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        ))}

        {/* Kaynak */}
        <Text style={styles.sectionTitle}>Kombin Kaynağı</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceScroll}>
          {SOURCE_OPTIONS.map(s => (
            <TouchableOpacity key={s.key} onPress={() => setSource(s.key)} activeOpacity={0.85}>
              {s.key === source ? (
                <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.sourceChipActive}>
                  <Text style={styles.sourceChipTitleActive}>{s.label}</Text>
                  <Text style={styles.sourceChipDescActive}>{s.desc}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.sourceChip}>
                  <Text style={styles.sourceChipTitle}>{s.label}</Text>
                  <Text style={styles.sourceChipDesc}>{s.desc}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Bütçe */}
        <Text style={styles.sectionTitle}>Bütçe (TL)</Text>
        <View style={styles.budgetRow}>
          <TextInput
            style={styles.budgetInput}
            placeholder="Min"
            placeholderTextColor="#6b7280"
            value={budgetMin}
            onChangeText={setBudgetMin}
            keyboardType="numeric"
          />
          <Text style={styles.budgetSep}>—</Text>
          <TextInput
            style={styles.budgetInput}
            placeholder="Max"
            placeholderTextColor="#6b7280"
            value={budgetMax}
            onChangeText={setBudgetMax}
            keyboardType="numeric"
          />
        </View>

        {/* Şehir */}
        <Text style={styles.sectionTitle}>Şehir (isteğe bağlı)</Text>
        <TextInput
          style={styles.cityInput}
          placeholder="Hava durumu için şehir girin..."
          placeholderTextColor="#6b7280"
          value={city}
          onChangeText={setCity}
        />

        {/* Renk */}
        <Text style={styles.sectionTitle}>Renk Paleti</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
          {COLOR_OPTIONS.map(c => (
            <TouchableOpacity key={c.key} onPress={() => setColorPalette(c.key)}>
              {c.key === colorPalette ? (
                <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.colorChipActive}>
                  <Text style={styles.colorChipTextActive}>{c.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.colorChip}>
                  <Text style={styles.colorChipText}>{c.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Generate Button */}
        <TouchableOpacity style={styles.generateBtn} onPress={generateOutfit} disabled={generating} activeOpacity={0.85}>
          <LinearGradient colors={['#a855f7', '#6366f1']} style={styles.generateBtnGradient}>
            {generating ? (
              <View style={styles.generatingRow}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.generateBtnText}>  Oluşturuluyor...</Text>
              </View>
            ) : (
              <Text style={styles.generateBtnText}>🔮 Büyüyü Başlat</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Result */}
        {result && (
          <View style={styles.resultCard}>
            <LinearGradient colors={['#1a1040', '#0f0c29']} style={styles.resultGradient}>
              <Text style={styles.resultTitle}>🎉 Kombinin Hazır!</Text>
              <Text style={styles.resultText}>{result}</Text>
            </LinearGradient>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#a5b4fc', marginTop: 4 },
  content: { padding: 20, paddingBottom: 60 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12, marginTop: 20 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  optionCardActive: { borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)' },
  optionEmoji: { fontSize: 22, marginRight: 12 },
  optionLabel: { flex: 1, color: '#9ca3af', fontWeight: '600', fontSize: 15 },
  optionLabelActive: { color: '#fff' },
  checkmark: { color: '#a855f7', fontWeight: '800', fontSize: 18 },
  sourceScroll: { marginBottom: 4 },
  sourceChip: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 150,
  },
  sourceChipTitle: { color: '#9ca3af', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  sourceChipDesc: { color: '#6b7280', fontSize: 11 },
  sourceChipActive: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginRight: 10, minWidth: 150 },
  sourceChipTitleActive: { color: '#fff', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  sourceChipDescActive: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  budgetInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#fff',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  budgetSep: { color: '#9ca3af', fontSize: 18 },
  cityInput: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#fff',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  colorScroll: { marginBottom: 4 },
  colorChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  colorChipText: { color: '#9ca3af', fontWeight: '600', fontSize: 13 },
  colorChipActive: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, marginRight: 8 },
  colorChipTextActive: { color: '#fff', fontWeight: '700', fontSize: 13 },
  generateBtn: {
    borderRadius: 16, overflow: 'hidden', marginTop: 28,
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
  },
  generateBtnGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  generatingRow: { flexDirection: 'row', alignItems: 'center' },
  generateBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  resultCard: { marginTop: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' },
  resultGradient: { padding: 20 },
  resultTitle: { fontSize: 18, fontWeight: '800', color: '#a855f7', marginBottom: 14 },
  resultText: { color: '#e5e7eb', fontSize: 15, lineHeight: 24 },
});
