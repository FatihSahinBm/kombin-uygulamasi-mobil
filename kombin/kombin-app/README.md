# 📱 Kombin.AI - Mobil Uygulama (Expo Go)

Bu proje, **Kombin.AI** web uygulamasının **Expo (React Native)** kullanılarak geliştirilmiş mobil sürümüdür. Yapay zeka destekli stil danışmanlığı, dijital gardırop yönetimi ve sosyal akış özelliklerini barındırır.

---

## 🚀 Başlangıç

Projeyi yerel bilgisayarınızda çalıştırmak ve kendi cihazınızda test etmek için aşağıdaki adımları izleyin:

### 1. Gereksinimler
* Bilgisayarınızda **Node.js** yüklü olmalıdır.
* Telefonunuzda **Expo Go** uygulaması yüklü olmalıdır:
  * [Google Play Store'dan İndir](https://play.google.com/store/apps/details?id=host.exp.exponent)
  * [App Store'dan İndir](https://apps.apple.com/app/expo-go/id982107779)

### 2. Kurulum
Proje klasörüne gidin ve gerekli tüm paketleri yükleyin:

```bash
cd kombin-app
npm install --legacy-peer-deps
```

### 3. Çevre Değişkenleri (.env)
Proje kök dizininde yer alan `.env.example` dosyasını kopyalayarak adını `.env` olarak değiştirin ve kendi API anahtarlarınızı girin:

```env
# Supabase Yapılandırması
EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Gemini Yapılandırması
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key

# Hava Durumu API Anahtarı
EXPO_PUBLIC_WEATHER_API_KEY=your-weather-api-key
```

> ⚠️ **ÖNEMLİ:** `.env` dosyası hassas API anahtarlarınızı barındırdığı için `.gitignore` dosyasına eklenmiştir. Asla Git havuzuna (GitHub vb.) gönderilmemelidir.

---

## 💻 Çalıştırma Komutları

Uygulamayı yerel ağınızda veya internet üzerinden tünelleyerek çalıştırmak için aşağıdaki komutları kullanın:

### Tünel Modunda Çalıştırma (Tavsiye Edilen - iOS/Android Desteği)
Telefonunuz ve bilgisayarınız aynı internet ağına bağlı olmasa bile çalışmasını sağlar. QR kodu telefon kameranızla taratarak uygulamayı başlatabilirsiniz:

```bash
npx expo start --tunnel
```

* **Önbelleği Temizleyerek Başlatmak İçin:**
  ```bash
  npx expo start --tunnel -c
  ```

### Yerel Ağda Çalıştırma (Aynı Wi-Fi Gerektirir)
```bash
npx expo start
```

---

## 🛠️ Proje Klasör Yapısı

```
kombin-app/
├── App.js                     # Ana uygulama dosyası (Navigasyon & Oturum Kontrolü)
├── app.json                   # Expo yapılandırma dosyası (İsim, ikonlar, scheme ayarları)
├── .env                       # Yerel çevre değişkenleri (Git'e gönderilmez)
├── .env.example               # Çevre değişkenleri şablonu (Git'e gönderilir)
├── .gitignore                 # Git tarafından yoksayılacak dosyalar listesi
└── src/
    ├── lib/
    │   └── supabase.js        # Supabase istemci bağlantısı
    └── screens/
        ├── LoginScreen.js     # Giriş / Kayıt ekranı (Google & E-posta girişi)
        ├── DashboardScreen.js # Ana sayfa (İstatistikler, stil ve aksiyonlar)
        ├── WardrobeScreen.js  # Gardırop (Fotoğraf yükleme ve kategori filtreleme)
        ├── OutfitsScreen.js   # Kombin Oluştur (Gemini AI entegrasyonu)
        ├── SocialScreen.js    # Sosyal Akış (Gönderiler ve beğeni sistemi)
        └── ProfileScreen.js   # Profil sayfası (Fiziksel özellikler ve ayarlar)
```

---

## 🔐 Google ile Giriş Yap Ayarı (Supabase)

Google ile giriş özelliğinin mobil uygulamada çalışması için:
1. **Supabase Dashboard** -> **Authentication** -> **URL Configuration** bölümüne gidin.
2. **Redirect URIs** alanına aşağıdaki iki adresi ekleyin:
   * `kombinapp://auth-callback`
   * `exp://*`
3. Değişiklikleri kaydedin.
