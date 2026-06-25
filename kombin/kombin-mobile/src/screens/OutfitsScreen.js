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
  Linking,
  Modal,
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

// ============================================================
// ÖZELLİK 1: Google Shopping URL oluşturucu
// ============================================================
const getGoogleShoppingUrl = (itemName, budgetMax) => {
  const query = encodeURIComponent(itemName);
  // udm=28: Doğrudan Google Alışveriş (Shopping) sekmesini açar.
  // ppr_max: Maksimum bütçe filtresini ekler.
  return `https://www.google.com/search?q=${query}&udm=28&tbs=mr:1,price:1,ppr_max:${budgetMax}`;
};

// Parça ismini temizle (emojileri ve parantez içini sil)
const cleanItemName = (line) => {
  return line
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '') // emojileri sil
    .replace(/\(.*?\)/g, '')               // parantez içini sil
    .replace(/^[\s\-–•:]+/, '')            // baştaki özel karakterleri sil
    .replace(/\s+/g, ' ')
    .trim();
};

// "✨ PARÇALAR:" bölümünü parse et → satır listesi döner
const parseParcalar = (outfitText) => {
  if (!outfitText) return [];
  const parcalarMatch = outfitText.match(/✨\s*PARÇALAR\s*:?([\s\S]*?)(?:\n💡|$)/i);
  if (!parcalarMatch) return [];
  const block = parcalarMatch[1];
  return block
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3);
};

// ============================================================
// ÖZELLİK 2: AI Outfit Scorer - Gemini'ye puan isteği gönder
// ============================================================
const scoreOutfitWithAI = async (outfitText) => {
  const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const prompt = `Sen bir moda eleştirmenisin. Bu kombini renk uyumu (colorHarmony), tarz bütünlüğü (styleCohesion) ve ortam/hava uygunluğu (occasionSuitability) açısından değerlendir.

Kombin Parçaları:
${outfitText}

Yanıtı kesinlikle aşağıdaki JSON formatında dön, başka hiçbir açıklama ekleme:
{
  "totalScore": 88,
  "categories": {
    "colorHarmony": { "score": 90, "comment": "Renkler dengeli." },
    "styleCohesion": { "score": 85, "comment": "Tarz bütünlüğü yüksek." },
    "occasionSuitability": { "score": 90, "comment": "Hava durumuna uygun." }
  },
  "suggestions": ["Şunu ekleyebilirsin", "Bunu değiştirebilirsin"]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!response.ok) throw new Error('Gemini API hatası');
  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Geçersiz JSON yanıtı');
  return JSON.parse(jsonMatch[0]);
};

// ============================================================
// Radial Score Dial component
// ============================================================
const ScoreDial = ({ score }) => {
  const getColor = (s) => {
    if (s >= 85) return ['#10b981', '#059669'];
    if (s >= 70) return ['#f59e0b', '#d97706'];
    return ['#ef4444', '#dc2626'];
  };
  return (
    <View style={scorerStyles.dialContainer}>
      <LinearGradient colors={getColor(score)} style={scorerStyles.dialCircle}>
        <Text style={scorerStyles.dialScore}>{score}</Text>
        <Text style={scorerStyles.dialLabel}>/ 100</Text>
      </LinearGradient>
      <Text style={scorerStyles.dialTitle}>AI Kombin Puanı</Text>
    </View>
  );
};

// ============================================================
// Progress Bar component
// ============================================================
const ScoreBar = ({ label, score, comment }) => (
  <View style={scorerStyles.barRow}>
    <View style={scorerStyles.barHeader}>
      <Text style={scorerStyles.barLabel}>{label}</Text>
      <Text style={scorerStyles.barScore}>{score}</Text>
    </View>
    <View style={scorerStyles.barBg}>
      <View style={[scorerStyles.barFill, { width: `${score}%` }]} />
    </View>
    <Text style={scorerStyles.barComment}>{comment}</Text>
  </View>
);

// ============================================================
// MAIN SCREEN
// ============================================================
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

  // Özellik 1: parse edilmiş parçalar
  const [parcalar, setParcalar] = useState([]);

  // Özellik 2: AI Scorer
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [scoreModalVisible, setScoreModalVisible] = useState(false);

  const generateOutfit = async () => {
    setGenerating(true);
    setResult(null);
    setParcalar([]);
    setScoreResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Giriş yapmanız gerekiyor.');

      // Gardırop öğelerini çek
      const { data: rawItems } = await supabase
        .from('wardrobe')
        .select('name, categories(name), colors(name), attributes')
        .eq('user_id', user.id)
        .limit(20);

      const wardrobeItems = (rawItems || []).map(item => ({
        name: item.name,
        category: item.categories?.name === 'ust' ? 'Üst Giyim' :
                  item.categories?.name === 'alt' ? 'Alt Giyim' :
                  item.categories?.name === 'ayakkabi' ? 'Ayakkabı' :
                  item.categories?.name === 'dis_giyim' ? 'Dış Giyim' :
                  item.categories?.name === 'aksesuar' ? 'Aksesuar' : (item.categories?.name || 'Üst Giyim'),
        color: item.colors?.name || '',
        brand: item.attributes?.brand || ''
      }));

      const prompt = `Sen bir moda uzmanısın. Aşağıdaki kriterlere göre Türkçe bir kombin önerisi yap:

Stil: ${STYLE_OPTIONS.find(s => s.key === style)?.label}
Bütçe: ${budgetMin}TL - ${budgetMax}TL
Kaynak: ${SOURCE_OPTIONS.find(s => s.key === source)?.label}
Renk Paleti: ${COLOR_OPTIONS.find(c => c.key === colorPalette)?.label}
${city ? `Şehir: ${city}` : ''}
${wardrobeItems?.length > 0 ? `\nGardırop: ${wardrobeItems.map(i => `${i.name} (${i.category}${i.color ? ', ' + i.color : ''})`).join(', ')}` : ''}

Lütfen şu formatta yanıt ver:
🎯 KOMBİN ADI: [kombin ismi]
✨ PARÇALAR:
[emoji] [parça adı ve kısa açıklama]
[emoji] [parça adı ve kısa açıklama]
[emoji] [parça adı ve kısa açıklama]
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
      try {
        await supabase.from('outfits').insert({
          user_id: user.id,
          style,
          source,
          color_palette: colorPalette,
          budget_min: parseInt(budgetMin),
          budget_max: parseInt(budgetMax),
          city: city || null,
          ai_result: outfitText,
        });
      } catch (dbErr) {
        console.log('Outfits table insert failed/skipped:', dbErr);
      }

      setResult(outfitText);
      // ÖZELLİK 1: PARÇALAR bölümünü parse et
      setParcalar(parseParcalar(outfitText));
    } catch (e) {
      console.log('Generate error:', e);
      Alert.alert('Hata', 'Kombin oluşturulurken bir hata oluştu.');
    } finally {
      setGenerating(false);
    }
  };

  // ÖZELLİK 2: Puanlama fonksiyonu
  const handleScoreOutfit = async () => {
    if (!result) return;
    setScoring(true);
    try {
      const score = await scoreOutfitWithAI(result);
      setScoreResult(score);
      setScoreModalVisible(true);
    } catch (e) {
      console.log('Score error:', e);
      Alert.alert('Hata', 'Kombin puanlanırken bir hata oluştu. API anahtarınızı kontrol edin.');
    } finally {
      setScoring(false);
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

        {/* ============================================================ */}
        {/* Result */}
        {/* ============================================================ */}
        {result && (
          <View style={styles.resultCard}>
            <LinearGradient colors={['#1a1040', '#0f0c29']} style={styles.resultGradient}>
              <Text style={styles.resultTitle}>🎉 Kombinin Hazır!</Text>

              {/* Kombinin parça olmayan kısmını göster (PARÇALAR bloğu ayrı render ediliyor) */}
              {(() => {
                // PARÇALAR öncesi (KOMBİN ADI)
                const beforeParcalar = result.split(/✨\s*PARÇALAR/i)[0];
                // PARÇALAR sonrası (STİL İPUCU, UYGUN HAVA)
                const afterParcalar = result.match(/(💡[\s\S]*)/);
                return (
                  <>
                    <Text style={styles.resultText}>{beforeParcalar.trim()}</Text>

                    {/* ÖZELLİK 1: PARÇALAR bölümü — her parça için satır + Satın Al butonu */}
                    {parcalar.length > 0 && (
                      <View style={styles.parcalarSection}>
                        <Text style={styles.parcalarTitle}>✨ PARÇALAR:</Text>
                        {parcalar.map((parcaLine, idx) => {
                          const cleanName = cleanItemName(parcaLine);
                          const shopUrl = getGoogleShoppingUrl(cleanName, budgetMax || '5000');
                          return (
                            <View key={idx} style={styles.parcaRow}>
                              <Text style={styles.parcaText} numberOfLines={2}>{parcaLine}</Text>
                              <TouchableOpacity
                                style={styles.shopBtnWrapper}
                                onPress={() => Linking.openURL(shopUrl).catch(() => Alert.alert('Hata', 'Tarayıcı açılamadı.'))}
                                activeOpacity={0.8}
                              >
                                <LinearGradient colors={['#f59e0b', '#ef4444']} style={styles.shopBtn}>
                                  <Text style={styles.shopBtnText}>🛒 Satın Al</Text>
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {afterParcalar && (
                      <Text style={[styles.resultText, { marginTop: 12 }]}>{afterParcalar[1]}</Text>
                    )}
                  </>
                );
              })()}

              {/* ÖZELLİK 2: Kombini Puanla Butonu */}
              <TouchableOpacity
                style={styles.scoreBtnWrapper}
                onPress={handleScoreOutfit}
                disabled={scoring}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.scoreBtnGradient}>
                  {scoring ? (
                    <View style={styles.generatingRow}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.scoreBtnText}>  Puanlanıyor...</Text>
                    </View>
                  ) : (
                    <Text style={styles.scoreBtnText}>⭐ Kombini AI ile Puanla</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}
      </View>

      {/* ============================================================ */}
      {/* ÖZELLİK 2: AI Scorer Modal */}
      {/* ============================================================ */}
      <Modal visible={scoreModalVisible} animationType="slide" transparent>
        <View style={scorerStyles.overlay}>
          <View style={scorerStyles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={scorerStyles.modalHeader}>
                <Text style={scorerStyles.modalTitle}>⭐ AI Kombin Analizi</Text>
                <TouchableOpacity onPress={() => setScoreModalVisible(false)}>
                  <Text style={scorerStyles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {scoreResult && (
                <>
                  {/* Dairesel Puan */}
                  <ScoreDial score={scoreResult.totalScore} />

                  {/* Progress Bars */}
                  <View style={scorerStyles.barsSection}>
                    <ScoreBar
                      label="🎨 Renk Uyumu"
                      score={scoreResult.categories?.colorHarmony?.score || 0}
                      comment={scoreResult.categories?.colorHarmony?.comment || ''}
                    />
                    <ScoreBar
                      label="👗 Tarz Bütünlüğü"
                      score={scoreResult.categories?.styleCohesion?.score || 0}
                      comment={scoreResult.categories?.styleCohesion?.comment || ''}
                    />
                    <ScoreBar
                      label="🌤️ Ortam Uygunluğu"
                      score={scoreResult.categories?.occasionSuitability?.score || 0}
                      comment={scoreResult.categories?.occasionSuitability?.comment || ''}
                    />
                  </View>

                  {/* Öneriler */}
                  {scoreResult.suggestions?.length > 0 && (
                    <View style={scorerStyles.suggestionsSection}>
                      <Text style={scorerStyles.suggestionsTitle}>💡 AI Önerileri</Text>
                      {scoreResult.suggestions.map((s, i) => (
                        <View key={i} style={scorerStyles.suggestionRow}>
                          <Text style={scorerStyles.suggestionBullet}>→</Text>
                          <Text style={scorerStyles.suggestionText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    style={scorerStyles.closeFullBtn}
                    onPress={() => setScoreModalVisible(false)}
                  >
                    <LinearGradient colors={['#a855f7', '#6366f1']} style={scorerStyles.closeFullBtnGradient}>
                      <Text style={scorerStyles.closeFullBtnText}>Kapat</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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

  // Result card
  resultCard: { marginTop: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' },
  resultGradient: { padding: 20 },
  resultTitle: { fontSize: 18, fontWeight: '800', color: '#a855f7', marginBottom: 14 },
  resultText: { color: '#e5e7eb', fontSize: 15, lineHeight: 24 },

  // PARÇALAR bölümü
  parcalarSection: { marginTop: 12 },
  parcalarTitle: { color: '#a855f7', fontWeight: '800', fontSize: 15, marginBottom: 10 },
  parcaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 10,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  parcaText: { flex: 1, color: '#e5e7eb', fontSize: 13, lineHeight: 18, marginRight: 8 },
  shopBtnWrapper: { borderRadius: 10, overflow: 'hidden', flexShrink: 0 },
  shopBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  shopBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Score button
  scoreBtnWrapper: { marginTop: 16, borderRadius: 14, overflow: 'hidden' },
  scoreBtnGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  scoreBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const scorerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#13111a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  closeBtn: { color: '#9ca3af', fontSize: 20, fontWeight: '700' },

  // Dial
  dialContainer: { alignItems: 'center', marginBottom: 28 },
  dialCircle: {
    width: 130, height: 130, borderRadius: 65,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 16,
  },
  dialScore: { fontSize: 40, fontWeight: '900', color: '#fff' },
  dialLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  dialTitle: { marginTop: 12, color: '#a5b4fc', fontWeight: '700', fontSize: 14 },

  // Bars
  barsSection: { marginBottom: 20 },
  barRow: { marginBottom: 16 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { color: '#e5e7eb', fontWeight: '700', fontSize: 13 },
  barScore: { color: '#a855f7', fontWeight: '800', fontSize: 13 },
  barBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#a855f7', borderRadius: 100 },
  barComment: { color: '#9ca3af', fontSize: 12, marginTop: 4, lineHeight: 16 },

  // Suggestions
  suggestionsSection: {
    backgroundColor: 'rgba(168,85,247,0.08)', borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
  suggestionsTitle: { color: '#a855f7', fontWeight: '800', fontSize: 14, marginBottom: 10 },
  suggestionRow: { flexDirection: 'row', marginBottom: 6 },
  suggestionBullet: { color: '#6366f1', fontWeight: '800', marginRight: 8, fontSize: 14 },
  suggestionText: { color: '#d1d5db', fontSize: 13, lineHeight: 20, flex: 1 },

  // Close button
  closeFullBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  closeFullBtnGradient: { paddingVertical: 14, alignItems: 'center' },
  closeFullBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
