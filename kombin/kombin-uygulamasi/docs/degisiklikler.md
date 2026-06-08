# Kombin.AI - Mimari ve Yapısal Açıklamalar

Bu dosya, projeye entegre edilen teknolojileri, dosya mimarisini ve "Vanilla JS" ilkelerine uygun olarak sistemin nasıl düzenlendiğini detaylı bir şekilde açıklamaktadır.

## Neden Vanilla JS ve Modüler Mimari?
Proje gereksinimlerine göre React, Vue gibi framework kullanımı kısıtlanmıştır. "Vanilla JS (Saf JavaScript)" ile yazılım geliştirilirken yaşanabilecek en büyük sorun tüm kodun tek bir dosyada birikmesi (Spaghetti Code) durumudur. Bunu önlemek amacıyla **ES6 Module** yapısı (`import / export`) kullanılmıştır:
- Her JavaScript modülü kendi ayrı sorumluluğuna sahiptir.
- DOM manüpülasyonundan (`ui.js`), dış API veya veritabanı etkileşiminden (`api.js`) ve kimlik doğrulamadan (`auth.js`) sorumlu ayrı yapılar kurulmuştur.
- Bu yapı daha modülerdir ve bakım yapmayı kolaylaştırır. Bir hata alındığında (örneğin tasarım), veritabanı bağlamını kontrol etmeden sadece `ui.js` içerisinde sorun çözülebilir.

## 🗄️ Backend Bağlantısı: Supabase (PostgreSQL)

Projede veritabanı (Backend) olarak Supabase kullanılmıştır.

### 1. `config.js` İçinde Merkezi Yapılandırma
Sistemin Supabase'e erişebilmesi için gerekli olan URL (Supabase Project URL) ve KEY değerleri doğrudan fonksiyonların içine gömülmemelidir. Bu değerlerin `config.js` üzerinden yönetilmesi tercih edilmiştir:
*Neden Yaptım?* Şifre ve API keyleri tek bir merkez klasörde tutmak sistemin gelecekte farklı bir sunucuya taşınmasını veya anahtarın sıfırlanması durumunda hızlı bir yamanma yapılabilmesini sağlar. Eğer bu key `api.js` veya `auth.js` içlerine ayrı ayrı konsaydı bakımı oldukça zorlaşacaktı.

Aynı zamanda Supabase istemcisinin (`createClient`) import yolu `https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm` ES6 Module (ESM) formunda dahil edilmiştir. **Neden Yaptım?** Çünkü Vanilla JS içerisinde `import {} from ...` formatını kullanabilmek ve modern tarayıcı yeteneklerinden (CDN ile `<script type="module">` birleşimi) yararlanmak çok daha performanslı ve güvenlidir.

### 2. `auth.js` ile Kimlik Yönetimi
Başlangıçta localStorage (tarayıcı belleği) simülasyonu olarak kurulan auth sistemi, gerçek Supabase Auth metotlarına bağlanmıştır:
* `supabase.auth.signInWithPassword()` 
* `supabase.auth.signUp()`
*Neden Yaptım?* localStorage bazlı oturum sahte ve güvenliksizdir. Gerçek sistemdeki JWT tabanlı oturum yönetimi Supabase tarafından sağlanmalıdır. Modüler mimari korunduğu için localStorage kullanıldığından Supabase Auth'a geçiş sırasında projeye entegre edilmiş diğer bileşenler bu değişiklikten haberdar bile olmamıştır, böylece "separation of concerns (Sorumlulukların Ayrılığı)" ilkesi başarılı şekilde sağlanmıştır.

### 3. `api.js` Veritabanı ve Dış API Yönetimi
Kullanıcı verilerini `.insert()` komutlarıyla kaydetmek ve `.select()` komutlarıyla çağırmak için sahte veriler (mock data) geri plana çekilmiş, Supabase tabloları kullanılmaya başlanmıştır (örnek: `wardrobe`, `social_feed`, `preferences` tabloları).
*Neden Yaptım?* Modern web uygulamalarında veriler Backend'de saklanarak, kullanıcı farklı cihazlardan girdiği taktirde verilerini korumaya devam eder.

Ayrıca `delay(1000)` gibi Timeout simülasyonları eğer bağlantı sağlanırsa işlevsiz bırakılarak Supabase'in kendi döndürdüğü asenkron süreçlere (Promises: `await supabase.from(...)`) devredilmiştir.

## Supabase Kurulum Süreci
Supabase panelinizde oluşturacağınız projede:
1. `SQL Editor` menüsünden `docs/veritabani.sql` dosyasındaki kodları çalıştırarak ilişkisel (Relational) veritabanı tablolarını (`users`, `preferences`, vb.) oluşturmalısınız.
2. Sizin ilettiğiniz `sb_publishable_ZMODXb...` ile başlayan Anon key `config.js` içerisine eklenmiştir.
3. Eksik olan **Projeye ait URL** adresini (Örn: `https://xyz...supabase.co`) `config.js` dosyasına kopyalamanız gerekmektedir. 

## Önemli Kod Kalıpları
```javascript
// config.js içerisindeki kullanım örneği
export const supabase = CONFIG.SUPABASE_URL.includes("BURAYAYA") 
    ? null 
    : createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
```
Yukarıdaki kullanımda 'Fallback' (Geri dönüş) mimarisi tasarlandı. Eğer Supabase URL henüz sizin tarafınızdan eklenmemişse uygulama çökmez, bunun yerine `null` döner. `api.js` ve `auth.js` tarafında bu `null` varlığı kontrol edilerek sahte (mock) verilerle çalışmaya devam eder.

Bu mimari hem tam randımanlı profesyonel bir Vanilla JS uygulamasına olanak tanır, hem de "modülasyon, temiz kod, anlaşılırlık" prensiplerine harfiyen uyumludur.
