# Kombin Öneri Sistemi - Geliştirici Açıklamaları

Bu dosya, projede neden Vanilla JS, HTML ve CSS kullanıldığını ve yapısal kararların ardındaki sebepleri detaylı bir şekilde açıklamak amacıyla hazırlanmıştır.

## 1. Neden Vanilla JS, HTML ve CSS Tercih Edildi?
- **Proje Kurallarına Uygunluk:** Müşteri/Kullanıcı isteği doğrultusunda React veya Vue gibi bir framework kullanmaktan kaçınılmıştır. Bu sayede projenin sunucu bağımlılığı en aza indirilmiş, tarayıcıda doğrudan çalışabilen salt ve hızlı bir yapı oluşturulmuştur.
- **Performans ve Hız:** Vanilla JS ve Vanilla CSS, sanal DOM (Virtual DOM) overhead'i yaratmadığından, özellikle modern tarayıcılarda anında yüklenme ve çalışma tepkilerine (interaction) sahiptir.
- **Temiz Mimarinin Uygulanması (Modülerlik):** Vanilla JS kullanırken dahi **ES6 Modüllerini** (`type="module"`) kullanarak `main.js`, `api.js`, `ui.js` gibi dosyaları ayırdık. Bu, bakım (maintenance) maliyetini frameworklerdekine benzer bir şekilde (component based gibi) düşük tutmamızı sağlar.

## 2. Klasör ve Dosya Mimarisi Hakkında

### CSS Mimari Kararları
Bütün tasarımların tek bir CSS dosyasına boca edilmemesi amacıyla parçalandı.
- `style.css`: Tüm sayfalarda ortak olan renk paletleri (CSS Variable'lar), font (Inter) ve `body`, `container` gibi taşıyıcı elementleri içerir. Bu sayede açık ve ferah tasarım tek noktadan yönetilir.
- `components.css`: Spagetti kodun önüne geçmek için butonlar, cinsiyet seçim kartları (gender-card) gibi spesifik UI elementlerinin tasarım kodlarını barındırır.
- `gallery.css`: Fotoğraf galerisine özgü stiller.
- `form.css`: Form inputlarına özgü, focus/hover state'leri içeren CSS kuralları.

### JS Mimari Kararları (Fonksiyon Fonksiyon Açıklama)

#### `utils.js` Dosyasındaki LocalStorage Mantığı
Kullanıcı `index.html`'de cinsiyetini seçiyor, `styles.html`'de tarzını seçiyor. HTML sayfalar arası geçerken verilerin kaybolmasını engellemek için **LocalStorage** kullanmak şart oldu.
```javascript
// LocalStorage verilerine yazmak için yardımcı fonksiyon. "try-catch" bileşeni kullanarak tarayıcı güvenliği sorunlarını atlatıyoruz.
saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) { ... }
}
```

#### `ui.js` Dosyasındaki UI Yönetimi Mantığı
DOM manipülasyonu sağlayan işlemleri (örneğin buton aktif-pasif yapma, tıklandığında CSS sınıflarını (active, disabled vb.) ekleyip çıkarma) `main.js` içine yığmamak için oluşturuldu.
```javascript
// gender-card'lar içinden sadece birinin seçili kalmasını sağlar. Klasik radio-button mantığını custom div'lerle sağlamış oluruz.
singleSelect(elements, targetElement) {
    elements.forEach(el => el.classList.remove('active'));
    targetElement.classList.add('active');
}
```

#### `api.js` Dosyası ve Supabase Mock Yapısı
Proje isterinde *Supabase backend olarak kullanılacak* ibaresi vardı ancak *kullanıcı tabloları kendim tanımladım sen örnek ver* mantığı sunulmuştu. Supabase bağımlılığını direkt projeye yüklemek yerine, asenkron `async-await` metodlarını kullanan, sonradan içini `supabase.from('users').insert()` ile çok kolay doldurabileceğiniz Modüler mock nesneler yazdık.
```javascript
// İleride buraya supabase.storage çağrısı da eklenebilir. Gerçek bir asenkron çağrı gibi davranması kodun geleceğe hazır olduğunu gösterir.
async registerUser(userData) {
    console.log("Kullanıcı DB'ye eklendi (Mock API):", userData);
    return { success: true, data: userData };
}
```

#### `main.js` Dosyası (Sayfa Orkestrasyonu)
Tüm sayfalar aynı `main.js` modülünü çağırır. Peki hangi kodun nerede çalışacağını nasıl biliyor? Çünkü `window.location.pathname.split('/').pop()` fonksiyonuyla tarayıcıda hangi HTML sayfasında olduğumuzu kontrol ediyoruz.
- **index.html logic blok:** Eğer index'deysek cinsiyet kartlarına ClickListener ekler.
- **styles.html logic blok:** `kombinFotoErkek` içindeki fotoğraflar JSON objelerinden yaratılır. (İleride API'dan gelirse burası kolayca fetch requestine çevrilebilir).
- **register.html logic blok:** Forma Submit Listener eklenir. FormData kullanılarak `e.preventDefault()` ile formun sayfayı yenilemesi durdurulur, Object Entries ile veriler kolayca yakalanıp JSON verisi halinde saklanır.

## 3. Genel Kullanıcı Deneyimi (UI/UX)
- Tüm objelere `:hover` efekti eklendi ki bilgisayarlı kullanımı canlı olsun.
- Form alanlarında `box-shadow` odaklandığında (focus) ortaya çıkarak yazma isteği uyandırır.
- Butonlarda akıcı geçiş (`transtion: var(--transition-speed)`) kullanıldı. Ferah görüntü desteklendi ve yorucu göz alıcı renklerden kaçınılarak modern `Inter` font ailesi tercih edildi.
