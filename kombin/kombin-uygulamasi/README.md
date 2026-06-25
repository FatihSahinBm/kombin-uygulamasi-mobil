# 🌟 Kombin.AI — Kişiselleştirilmiş Yapay Zeka Moda Stilisti

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?style=for-the-badge&logo=vercel)](https://kombinai.vercel.app/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla%20ES6-yellow?style=for-the-badge&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Supabase](https://img.shields.io/badge/Supabase-Backend%20as%20a%20Service-green?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Groq API](https://img.shields.io/badge/Groq%20API-Llama%204-orange?style=for-the-badge)](https://groq.com/)

**Kombin.AI**, kullanıcıların fiziksel özelliklerine, tarz tercihlerine, bütçelerine ve anlık yerel hava durumuna göre kişiselleştirilmiş kombin önerileri sunan, aynı zamanda yüklenen kıyafet kombinlerini yapay zeka ile puanlayan modern ve modüler bir web uygulamasıdır.

---

## 🚀 Öne Çıkan Özellikler

- **🧠 Günün Kombini (Gemini & Hava Durumu):** Seçtiğiniz şehrin anlık hava sıcaklığı, rüzgar durumu ve hava koşullarına (Weather API) göre Gemini API tarafından üretilen, tarzınıza ve bütçenize özel kombin önerileri.
- **🌟 AI Kombin Puanlayıcı (Groq Vision & Supabase):** Kombin fotoğraflarınızı yükleyin, yapay zeka tarz stilisti (`llama-4-scout`) renk uyumunu, parça kalıplarını ve aksesuarları analiz edip 10 üzerinden puanlasın; iyi yönlerini ve geliştirme önerilerini paylaşsın!
- **⚡ Akıllı Dolap & Otomatik Etiketleme (Zero-shot CLIP):** Gardırobunuza kıyafet eklerken tarayıcı içi çalışan CLIP modelimiz (`vision-worker.js`) resimdeki kıyafetin ana kategorisini, rengini, kumaş türünü ve kalıbını otomatik olarak algılar ve etiketler.
- **🌐 Sosyal Akış (Social Feed):** Puanladığınız kombinlerinizi toplulukla paylaşın, beğenin ve diğer kullanıcıların tarzlarından ilham alın.
- **📱 Responsive & Premium Tasarım:** CSS Grid ve Flexbox ile tasarlanmış, tamamen mobil uyumlu, modern renk paletine ve mikro animasyonlara sahip minimalist arayüz.

---

## 🛠️ Teknoloji Yığını

### **Frontend (İstemci)**
- **HTML5:** Semantik ve erişilebilir web yapısı.
- **Vanilla CSS:** CSS değişkenleri (`:root`), Grid/Flexbox düzenleri ve modern UI bileşenleri.
- **Vanilla JavaScript (ES6 Modules):** Webpack/Babel bağımlılığı olmadan doğrudan tarayıcıda çalışan modüler JS mimarisi.
- **Transformers.js (HuggingFace):** Tarayıcıda çalışan yerel CLIP modeli (`Xenova/clip-vit-base-patch32`) ile istemci tarafında resim sınıflandırma.

### **Backend & APIs (Sunucu)**
- **Supabase (BaaS):**
  - **Auth:** Kullanıcı kaydı ve oturum yönetimi.
  - **Database (PostgreSQL):** RLS (Row Level Security) politikalarıyla korunmuş güvenli veritabanı.
  - **Storage:** Gardırop ve sosyal akış resimlerinin saklandığı S3 uyumlu bucketlar.
  - **Edge Functions (Deno):** Groq API ve Image Proxy işlemlerini yürüten güvenli fonksiyonlar.
- **Groq API (`meta-llama/llama-4-scout-17b-16e-instruct`):** Kombin görsellerini analiz edip dinamik olarak puanlayan vizyon modeli.
- **Gemini API:** Kullanıcı tercihlerine ve hava durumuna göre detaylı kıyafet kombin önerileri ve fiyat tahminleri oluşturan metin modeli.
- **OpenWeatherMap API:** Şehre göre anlık rüzgar ve sıcaklık bilgilerini çeken hava durumu servisi.

---

## 📁 Proje Dosya Yapısı

Proje, **Tek Sorumluluk Prensibi (Single Responsibility)** esas alınarak modüler bir şekilde inşa edilmiştir:

```text
kombin-uygulamasi/
│
├── css/                     # Arayüz tasarımları ve stiller
│   └── style.css            # Ana CSS dosyası ve tasarım sistemi (değişkenler)
│
├── js/                      # JavaScript Modülleri (ES6 Modules)
│   ├── api.js               # Sunucu, Supabase, Gemini ve hava durumu istekleri
│   ├── config.js            # API Key ve genel yapılandırma sabitleri
│   ├── ui.js                # DOM manipülasyonu ve arayüz çizim fonksiyonları
│   ├── utils.js             # LocalStorage ve genel yardımcı fonksiyonlar
│   │
│   ├── pages/               # Sayfa bazlı özel JS kodları
│   │   └── dashboard.js     # Dashboard sayfasındaki rater ve hava durumu kontrolcüsü
│   │
│   └── workers/             # Arka plan işlemleri
│       └── vision-worker.js # İstemci tarafında CLIP modelini çalıştıran Web Worker
│
├── supabase/                # Supabase Yapılandırması ve Edge Functions
│   ├── config.toml          # Supabase yerel/uzak konfigurasyon dosyası
│   └── functions/           # Deno tabanlı Serverless Edge Functions
│       ├── rate-outfit/     # Görsel puanlayan Groq entegrasyonlu API
│       └── generate-outfit/ # Kombin önerisi üreten API
│
├── docs/                    # Proje dökümantasyonu ve SQL şemaları
│   ├── veritabani.sql       # Tablo şemaları ve trigger tanımları
│   └── Açıklamalar.md       # Detaylı dökümantasyon ve mimari açıklamalar
│
├── index.html               # Hoş geldiniz / Giriş sayfası
├── dashboard.html           # Ana Yönetim Paneli ve AI Kombin Puanlayıcı
├── wardrobe.html            # Gardırop Yönetimi (Otomatik Etiketleme özellikli)
├── social.html              # Sosyal Akış ve Gönderi Paylaşım Ekranı
├── profile.html             # Profil ve Tercih Düzenleme Ekranı
│
├── build-env.js             # Vercel deployment ve yerel geliştirme için env oluşturucu
└── package.json             # Bağımlılıklar ve Build scripti
```

---

## ⚙️ Kurulum ve Yerel Çalıştırma

Projeyi yerel makinenizde çalıştırmak için aşağıdaki adımları izleyin:

### **1. Depoyu Klonlayın**
```bash
git clone https://github.com/FatihSahinBm/kombin-uygulamasi.git
cd kombin-uygulamasi
```

### **2. Çevre Değişkenlerini Tanımlayın**
Projenin kök dizininde `.env` adında bir dosya oluşturun ve gerekli anahtarları girin:
```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_KEY=<your-anon-key>
GEMINI_API_KEY=<your-gemini-key>
WEATHER_API_KEY=<your-openweathermap-key>
```

### **3. Konfigürasyonu Derleyin**
Yerel geliştirme ortamı için `js/env.js` dosyasını otomatik oluşturmak adına build scriptini çalıştırın:
```bash
npm install
npm run build
```

### **4. Canlı Sunucu Başlatın**
Vanilla JS ES6 modüllerinin CORS hatası vermeden tarayıcıda çalışabilmesi için bir HTTP sunucusuna ihtiyaç vardır.
- VS Code kullanıyorsanız **Live Server** eklentisiyle `index.html` dosyasını açabilirsiniz.
- Veya Python kullanarak hızlıca sunucu ayağa kaldırabilirsiniz:
  ```bash
  python -m http.server 8000
  ```
  Tarayıcınızdan `http://localhost:8000` adresine gidin.

---

## ☁️ Supabase Edge Functions Dağıtımı (Deploy)

Uygulamanın çalışabilmesi için Edge Function'ların Supabase projenize deploy edilmesi ve gerekli API anahtarının tanımlanması gerekir.

### **1. Supabase CLI ile Giriş Yapın**
```bash
npx supabase login
```

### **2. Groq API Anahtarını Tanımlayın**
Puanlayıcının çalışması için Groq API anahtarınızı Supabase ortamına yükleyin:
```bash
npx supabase secrets set GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

### **3. Fonksiyonları Deploy Edin**
```bash
npx supabase functions deploy rate-outfit --no-verify-jwt
```

---

## 🔒 Güvenlik (RLS Politikaları)

Veritabanında bulunan hassas kullanıcı verilerini korumak amacıyla tüm tablolarda PostgreSQL **Row Level Security (RLS)** etkindir.
- Kullanıcılar sadece kendilerine ait gardırop öğelerini (`wardrobe`) ve tarz tercihlerini (`preferences`) görebilir/değiştirebilir.
- Sosyal akış (`social_feed`) herkes tarafından okunabilir ancak sadece ilgili gönderinin sahibi tarafından silinebilir.
- Detaylı SQL şemalarına ve politikalara [veritabani.sql](file:///c:/Projects/kombin-uygulamasi/docs/veritabani.sql) dosyasından göz atabilirsiniz.

---

## 📄 Lisans
Bu proje MIT lisansı altında korunmaktadır. Detaylar için dökümanları inceleyebilirsiniz.
