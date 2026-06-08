# 🌟 Kombin.AI (Yapay Zeka Destekli Stil ve Gardırop Danışmanı)

Kombin.AI, kullanıcıların gardıroplarını dijitalleştirmelerine, hava durumuna ve kişisel tercihlerine (tarz, renk, yaş, bütçe vb.) göre yapay zeka destekli kombin önerileri almalarına ve stillerini diğer kullanıcılarla paylaşmalarına olanak tanıyan yeni nesil bir stil danışmanlığı platformudur.

Bu depo (repository), Kombin.AI projesinin hem **Web** hem de **Mobil (React Native/Expo)** sürümlerini içermektedir.

---

## 🛠️ Teknolojiler & Altyapı

Platform genelinde modern, hızlı ve ölçeklenebilir teknolojiler kullanılmıştır:

*   **Frontend (Web):** HTML5, Vanilla CSS3 (Custom Properties & Grid/Flexbox), JavaScript (Vanilla ES6+ - Modüler Yapı)
*   **Mobil Uygulama:** React Native, Expo Go, React Navigation (Bottom Tabs & Stack)
*   **Veritabanı & Backend (BaaS):** Supabase (PostgreSQL, Supabase Auth, Storage & Edge Functions)
*   **Yapay Zeka Entegrasyonu:** Gemini AI API (Kişiselleştirilmiş Kombin Önerileri ve Stil Analizi)
*   **Dış Servisler:** Weather API (Konuma göre anlık hava durumu takibi)

---

## 📁 Proje Yapısı

```text
kombin-uygulamasi-mobil/
│
└── kombin/
    ├── kombin-uygulamasi/   # 🌐 Vanilla JS & HTML/CSS Web Projesi
    │   ├── css/             # Sayfa stilleri ve bileşen tasarımları
    │   ├── js/              # Modüler JS yapısı (auth, api, ui, pages)
    │   ├── docs/            # SQL göç betikleri ve proje açıklamaları
    │   └── *.html           # Arayüz sayfaları (dashboard, wardrobe, social vb.)
    │
    ├── kombin-app/          # 📱 Mobil Uygulama (Expo - Gelişmiş Sürüm)
    │   ├── src/             # Ekranlar (Screens) ve veritabanı bağlayıcıları
    │   ├── App.js           # Ana uygulama yönlendirmesi
    │   └── package.json     # Mobil paket bağımlılıkları
    │
    └── kombin-mobile/       # 📱 Alternatif Mobil Sürüm (Expo)
        ├── src/             # Ekran tasarımları ve API bağlantıları
        └── App.js           # Mobil uygulama giriş noktası
```

---

## 🚀 Kurulum ve Çalıştırma

### 1. Web Uygulaması (`kombin-uygulamasi`)
Web sürümü, modern tarayıcılar ve Supabase backend entegrasyonu ile ek bir derleme (build) sürecine ihtiyaç duymadan doğrudan çalışır:

1.  `kombin/kombin-uygulamasi/js/config.js` dosyasını oluşturun veya mevcut yapılandırmayı kendi **Supabase** ve **API** anahtarlarınızla güncelleyin.
2.  Proje klasöründeki `index.html` dosyasını bir yerel sunucu ile (VS Code Live Server vb.) çalıştırın.

---

### 2. Mobil Uygulamalar (`kombin-app` & `kombin-mobile`)
Mobil uygulamalar **Expo Go** üzerinden çalıştırılacak şekilde yapılandırılmıştır:

1.  Bilgisayarınızda **Node.js**'in yüklü olduğundan emin olun.
2.  Telefonunuza **Expo Go** uygulamasını indirin (App Store / Google Play).
3.  İlgili klasöre gidin ve bağımlılıkları yükleyin:
    ```bash
    cd kombin/kombin-app   # ya da kombin-mobile
    npm install --legacy-peer-deps
    ```
4.  `.env.example` dosyasını `.env` olarak kopyalayarak kendi **Supabase**, **Gemini** ve **Weather API** anahtarlarınızı girin:
    ```env
    EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
    EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-key
    EXPO_PUBLIC_WEATHER_API_KEY=your-weather-key
    ```
5.  Uygulamayı başlatın:
    *   **Yerel ağda (Aynı Wi-Fi):** `npx expo start`
    *   **Tünel modunda (Tavsiye Edilen):** `npx expo start --tunnel`
6.  Terminalde oluşan **QR Kodu** Expo Go uygulaması ile taratarak uygulamanızı test edin.

---

## 🔐 Kimlik Doğrulama & Veritabanı Yapılandırması (Supabase)

Projenin tam fonksiyonel çalışması için Supabase üzerinde aşağıdaki yapılandırmaların tamamlanması önerilir:
1.  **Tablolar:** Kullanıcı profilleri, gardırop öğeleri (`wardrobe`), kombinler (`outfits`) ve sosyal etkileşim (`posts`, `likes`, `follows`) tablolarını oluşturun (şemalar için `kombin-uygulamasi/docs/veritabani.sql` dosyasını inceleyin).
2.  **Redirect URIs (OAuth/Google):** Supabase Dashboard üzerinde **Authentication** -> **URL Configuration** alanına mobil yönlendirme adreslerini ekleyin:
    *   `kombinapp://auth-callback`
    *   `exp://*`

---

## 🎨 Temel Özellikler

*   **Dijital Gardırop (Wardrobe):** Sahip olduğunuz kıyafetlerin fotoğraflarını çekip sisteme yükleyin, kategorilere (Üst Giyim, Alt Giyim, Ayakkabı vb.) ve renklere göre filtreleyin.
*   **Gemini AI Kombin Sihirbazı:** Gardırobunuzdaki kıyafetleri analiz ederek, o günkü hava durumuna ve gitmek istediğiniz ortama uygun mükemmel kombin önerileri üretir.
*   **Sosyal Stil Akışı (Social Feed):** En beğendiğiniz kombinleri paylaşın, diğer kullanıcıların stillerini inceleyin, beğenin ve takip edin.
*   **Kişiselleştirilmiş Profil:** Yaş, cinsiyet, tarz tercihleri ve bütçe bilgilerinizi girerek yapay zekanın sadece size özel öneriler sunmasını sağlayın.
