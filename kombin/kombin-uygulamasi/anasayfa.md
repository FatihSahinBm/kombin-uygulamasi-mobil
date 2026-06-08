🧩 GENEL YAPI
Minimalist, modern ve kullanıcı dostu bir ana sayfa tasarla.
Arayüz sade, anlaşılır ve hızlı kullanılabilir olmalı.

📌 ANA SAYFA BÖLÜMLERİ

🏠 ÜST NAVBAR
Logo (sol)
Menü:
Ana Sayfa
Gardırobum
Kombin Oluştur
Sosyal Akış
Profil
👋 KARŞILAMA ALANI
“Hoş geldin, [Kullanıcı Adı]”
Altında kısa açıklama:
“Bugün senin için mükemmel kombini oluşturalım”
⚡ ANA AKSİYON KARTI (KOMBİN OLUŞTUR)
Büyük ve dikkat çekici bir kart:

Buton: “Kombin Oluştur”

Tıklanınca modal veya yeni sayfa açılır ve şu seçenekleri sunar:

🔘 Sıfırdan kombin oluştur
🔘 Gardırobumdan kombin oluştur
🔘 Karma (AI + benim kıyafetlerim)

Ek seçenekler:

Bütçe seçimi (slider)
Kullanım amacı (günlük, iş, spor, özel gün)
Stil seçimi (dropdown)
Hava durumuna göre öneri (otomatik aktif – API ile)

Buton: “Kombini Oluştur”

👕 GARDIROP ÖZETİ
Küçük kart:
“Gardırobum”
Kullanıcının eklediği kıyafet sayısı
Buton: “Gardıroba Git”

İçerik mantığı:

Kullanıcı kıyafet ekleyebilir (tişört, pantolon, ayakkabı vs.)
Basit liste mantığı
🌤️ GÜNÜN KOMBİNİ
Kullanıcının konumuna göre (Google API / Weather API)
Otomatik önerilen kombin

İçerik:

Hava durumu (örnek: 18°C, güneşli)
Önerilen kombin kartı
“Detayları Gör” butonu
🔥 SOSYAL AKIŞ
Diğer kullanıcıların kombinleri
Kart yapısı:
Kombin görseli
Stil etiketi (#streetwear vb.)
Like butonu

🎨 TASARIM KURALLARI

Açık renkler (beyaz, açık gri, pastel tonlar)
Rounded card tasarımları
Soft shadow kullanımı
Grid layout (responsive)

⚙️ TEKNOLOJİ KURALLARI

HTML + CSS + Vanilla JS kullan
Kod modüler olsun

JS DOSYA YAPISI:

main.js → sayfa kontrolü
ui.js → DOM işlemleri
api.js → Gemini + hava durumu API
utils.js → yardımcı fonksiyonlar

🧠 AI ENTEGRASYONU
“Kombin Oluştur” butonuna basıldığında:

Kullanıcının:
stil tercihleri
renk seçimleri
bütçe
gardırop verileri (varsa)

Gemini API’ye gönderilir
ve kişiselleştirilmiş kombin döndürülür

🗄️ BACKEND (SUPABASE)
Tablolar:

users
wardrobe_items
preferences
outfits

İlişkiler:

user → wardrobe_items
user → preferences
user → outfits

🔁 KURAL
Kod:

Temiz
Modüler
Tek sorumluluk prensibi