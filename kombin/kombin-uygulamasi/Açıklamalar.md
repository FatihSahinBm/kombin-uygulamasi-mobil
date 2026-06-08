# Kombin.AI - Geliştirici Notları ve Mimari Açıklamalar

Bu doküman, Kombin.AI projesinin temel yapısını, kullanılan teknolojilerin neden seçildiğini ve kritik fonksiyonların nasıl çalıştığını açıklamak için hazırlanmıştır.

## 🛠 Kullanılan Teknolojiler ve Nedenleri

Proje kurallarında framework kullanılması yasaklandığı için React veya Vue gibi modern kütüphaneler yerine **HTML, CSS ve Vanilla JS (Saf JavaScript)** kullanılmıştır.

### 1. Vanilla JavaScript (Modüler Yapı - ES6 Modules)
Tüm kodları tek bir `main.js` dosyasına yazmak "Spaghetti Code" adı verilen, yönetimi ve okunması çok zor bir yapıya neden olur. Bu projede **Tek Sorumluluk Prensibi (Single Responsibility Principle)** benimsenmiştir:
- **`main.js`:** Uygulamanın beyni. Başlangıç akışını kontrol eder ve diğer modülleri yönetir.
- **`api.js`:** Sadece veri çekme (Supabase, Gemini API, Weather API) işlemleriyle ilgilenir. Sunucu ile istemci arasında köprü kurar.
- **`ui.js`:** Sadece kullanıcı arayüzü (DOM) etkileşimlerinden sorumludur. Veriyi alır ve ekrana basar. Buton tıklamaları gibi görsel işleri yönetir.
- **`utils.js`:** Date formatlama, LocalStorage işlemleri gibi projede tekrar edebilecek küçük yardımcı fonksiyonları barındırır.
- **`config.js`:** API Key ve Base URL gibi sabit değişkenleri tek merkezden yönetmek için kullanılır.

*Neden böyle yaptık?* Yarın bir gün arayüz kütüphanesini (UI) değiştirmek istediğimizde `api.js` dosyasının hiç etkilenmemesi için bağımlılıkları birbirinden izole ettik.

### 2. Modern CSS (Grid Layout, Flexbox ve CSS Değişkenleri)
- Uygulamanın minimalist ve açık renkli olması istendi. Tasarım sistemini kolayca yönetebilmek (ve ileride dark mode ekleyebilmek) için `:root` içerisinde CSS Değişkenleri (`var(--primary-color)`) kullandık.
- Kartların konumlandırması için `grid-template-columns` (CSS Grid) kullanıldı. Bu sayede büyük ekranlarda 3 kolonlu bir dashboard arayüzü, mobil ekranlarda (media query ile) kolayca alt alta dizilen tek kolonlu yapıya (`1fr`) dönüştü.

### 3. HTML5 Semantic Yapı
Kod okunabilirliğini ve erişilebilirliği (Accessibility) artırmak için `<div>` yığınları yerine `<nav>`, `<main>`, `<section>` gibi semantik (anlamlı) HTML5 etiketleri kullanıldı.

---

## 🔍 Önemli Kod Satırları ve Fonksiyon Açıklamaları

### `main.js` -> `initApp()` Fonksiyonu
```javascript
const initApp = async () => {
    // 1. Kullanıcı bilgilerini çekme
    const user = await api.getUserProfile();
    ui.renderUserProfile(user);

    // 2. Günün Kombinini oluşturma (Bekleyerek)
    const dailyOutfit = await api.generateOutfitIdea({...});
    ui.renderDailyOutfit(dailyOutfit);
};
```
**Neden önemli?** Bu asenkron (`async/await`) bir fonksiyondur. İnternetten veri çekme işlemleri anında gerçekleşmez. `await` anahtar kelimesi kullanılarak programın "Profil bilgileri gelene kadar bekle, geldikten sonra bunu ekrana yazdır (`ui.renderUserProfile(user)`)" komutu işletilir. Veri gelmeden UI güncellenmeye çalışılırsa uygulama `undefined` hatası verir.

### `ui.js` -> `renderSocialFeed()` Fonksiyonu
```javascript
renderSocialFeed: (feedData) => {
    elements.socialFeedContainer.innerHTML = feedData.map(post => `
        <div class="feed-item">
            <img src="${post.image}" class="feed-img">
            <div class="feed-info">
                <span class="tag">${post.tag}</span>
            </div>
        </div>
    `).join('');
}
```
**Neden önemli?** Sunucudan gelen dizi şeklindeki veriyi (`feedData`) bir HTML döngüsüne sokmak için JavaScript'in `.map()` fonksiyonunu kullandık. Bu fonksiyon her bir gönderi için HTML String bloğu üretir. Sonrasında `.join('')` ile bu diziyi tek bir metin parçası haline getirip DOM'a basarız. En temiz DOM render tekniklerinden biridir.

### `api.js` -> `generateOutfitIdea()` Fonksiyonu
```javascript
generateOutfitIdea: async (params) => {
    await delay(2000); // Gerçek API call bekletmesi simülasyonu
    return {
        title: "Şık Kombin",
        items: ["Tişört", "Pantolon"]
    };
}
```
**Neden önemli?** Gerçek dünya uygulamasında buradaki `delay` yerine Supabase Edge Functions veya doğrudan Gemini REST API'ye atılacak bir `fetch()` isteği olacaktır. Bu katman şimdilik projenin kesintisiz tasarlanabilmesi için arayüze sanki gerçek bir servisten cevap geliyormuş gibi sahte (mock) veri döndürür.

### UI Tarafındaki Olay Dinleyicileri (Event Listeners)
Kombin Oluşturma formunun nasıl çalıştığı:
```javascript
elements.outfitForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Sayfanın yenilenmesini engeller (SPA mantığı)
    
    const formData = ui.getFormData(); // Form içi input verilerini obje olarak toplar
    ui.setButtonLoading(elements.generateBtn, true, "Bekleniyor"); // Yükleniyor ikonu aktif
    
    const result = await api.generateOutfitIdea(formData); // Veriyi yapay zekaya (Backend) aktar
    
    // İşlem bttiğinde modalı gizle
    elements.modal.classList.remove('active');
});
```
Formların varsayılan davranışı, butona basıldığında sayfayı yönlendirmek ve yenilemektir. Vanilla JS ile Modern Front-End mimarisi kurduğumuz için `e.preventDefault()` ile varsayılan yenilemeyi durdurup, arka planda API çağrısını (`AJAX` operasyonu) yönetiyoruz.
