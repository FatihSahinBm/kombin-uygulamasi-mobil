# 👕 Kombin App Mobile

**Kombin App**, kullanıcıların dolaplarındaki kıyafetleri analiz ederek en uyumlu kombinleri oluşturan, yapay zeka (AI) destekli akıllı bir moda ve stil asistanıdır. Web sürümündeki başarılı algoritmayı tamamen mobile (React Native / Expo) taşır.

---

## 🌟 Öne Çıkan Özellikler

### 1️⃣ Akıllı AI Puanlama Sistemi (Gemini AI)
Oluşturduğunuz her kombini Google Gemini AI altyapısıyla anında puanlayın.
- **Renk Uyumu**, **Trend Puanı** ve **Hava Durumu Uygunluğu** progress barlarla görselleştirilir.
- Dairesel puan kadranı ile kombininizin genel puanını (100 üzerinden) ve AI'ın sizin için hazırladığı kişisel stil tavsiyesini görün.

### 2️⃣ Günün Kombini & Hava Durumu
OpenWeatherMap API entegrasyonuyla bulunduğunuz bölgedeki (veya varsayılan) hava durumunu anlık çeker.
- Günün havasına (sıcaklık, yağmur/kar vb.) uygun kıyafetleri dolabınızdan seçer.
- Renk matrisi (COLOR_MATRIX) ve uyum algoritmalarıyla günün şık kombinini sizin için oluşturur.
- *AsyncStorage* ile günlük olarak önbelleklenir; aynı gün için gereksiz işlem yapılmaz (isteğe bağlı yenilenebilir).

### 3️⃣ Anında Satın Al (Google Shopping)
Oluşturulan kombinlerde eksik veya çok beğendiğiniz bir parça mı var?
- Kombini oluşturan parçaların yanındaki şık **"🛒 Satın Al"** butonuna dokunarak doğrudan Google Shopping'e yönlendirilin.
- Bütçenize göre (ayarlanabilir bütçe özelliği ile) filtrelenmiş şekilde aradığınız kıyafete anında ulaşın.

### 4️⃣ Fiziksel Özellik Senkronizasyonu
Size en uygun kıyafet kalıplarını ve renklerini önermek için fiziksel özelliklerinizi kaydeder.
- Yaş, cinsiyet, vücut tipi ve ten rengi bilgilerinizi **Supabase** üzerindeki profilinize otomatik senkronize eder.
- Eğer bağlantı sorunu olursa (veya misafir kullanıcıysanız) veriler *AsyncStorage* ile cihazda güvende tutulur.

### 5️⃣ Akıllı Sosyal Akış Algoritması
Sıradan bir sosyal medya akışı değil, sizin için en alakalı olanları öne çıkaran akıllı sıralama!
- `Puan = (beğeni × 5) + (takip bonusu 50) + (hashtag eşleşme × 20) - (saat × 1.5)` formülüyle çalışır.
- Gönderileri ne kadar yeni olduğuna, beğenisine ve sizinle ortak olan stil etiketlerine (hashtag) göre filtreler.

---

## 🚀 Kurulum ve Çalıştırma

Projeyi lokal ortamınızda çalıştırmak için aşağıdaki adımları izleyin.

### 1. Gereksinimler
- Node.js (v18 veya üzeri önerilir)
- Telefonunuzda **Expo Go** uygulaması (SDK 54 destekli) veya bir Android/iOS emülatörü

### 2. Projeyi Klonlayın
```bash
git clone https://github.com/FatihSahinBm/kombin-uygulamasi-mobil.git
cd kombin-uygulamasi-mobil/kombin/kombin-mobile
```

### 3. Çevre Değişkenleri (.env)
Proje dizininde bir `.env` dosyası oluşturun ve aşağıdaki değişkenleri tanımlayın:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
EXPO_PUBLIC_WEATHER_API_KEY=your_openweathermap_api_key
```

### 4. Bağımlılıkları Yükleyin
Proje **Expo SDK 54** altyapısıyla çalışmaktadır.
```bash
npm install
```
*(Paket uyuşmazlığı yaşarsanız `npx expo install --fix` komutuyla SDK'ya uygun paketleri hizalayabilirsiniz).*

### 5. Uygulamayı Başlatın
Aynı yerel ağda (Wi-Fi) bulunduğunuz telefonunuzla test etmek için:
```bash
npx expo start --lan
```
Çıkan QR kodunu telefonunuzun kamerası (iOS) veya Expo Go (Android) ile taratıp uygulamaya giriş yapabilirsiniz.

---

## 🛠️ Kullanılan Teknolojiler

- **Framework:** React Native / Expo (SDK 54)
- **Veritabanı & Kimlik Doğrulama:** Supabase
- **Yapay Zeka (AI):** Google Gemini API
- **Navigasyon:** React Navigation v7
- **Tasarım:** Expo Linear Gradient, React Native Vector Icons
- **Yerel Depolama:** AsyncStorage
- **Hava Durumu:** OpenWeatherMap API

---
*Bu proje şık, modern ve fonksiyonel bir mobil deneyim sağlamak üzere özel olarak tasarlanmıştır.* 🎨✨
