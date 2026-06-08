# 🚀 1. Bölüm: Modüller (Import / Export)

Merhaba! JavaScript'in en temel ve en güçlü özelliklerinden biriyle başlıyoruz. Eğer UI (HTML/CSS) biliyorsan, her şeyi bir dosyada toplamanın ne kadar karmaşıklaştığını fark etmişsindir. Modüller, bu karmaşayı bitirmek için var.

## 📦 Nedir Bu Modüller?

Bir binayı (web sitesini) düşün. Eskiden bütün tuğlaları, camları ve kapıları aynı yere yığıp orada birleştiriyorduk. Modüller ise şöyle der:
- "Camları başka bir atölyede yapalım, lazım olunca buraya getirelim." (**Export**)
- "Burada kapıya ihtiyacım var, o atölyedeki kapıyı getir." (**Import**)

### 1. Dosyadan "Çıkarmak" (Export)

Bir dosyada bir değişkeni veya fonksiyonu diğer dosyaların kullanmasını istiyorsak başına `export` yazarız.

**Dosya: `mesajlar.js`**
```javascript
// Bu değişkeni "dışarı satıyoruz" (export ediyoruz)
export const selamlama = "Merhaba Kombinsever!";

// Bu fonksiyonu da "dışarı satıyoruz"
export function gunaydin() {
    console.log("Tarz dolu bir gün dilerim!");
}
```

### 2. Dosyaya "Getirmek" (Import)

Başka bir dosyada o "satışa çıkan" şeyleri kullanmak istiyorsak `import` yaparız.

**Dosya: `app.js`**
```javascript
// mesajlar.js dosyasından neleri alacağımızı söylüyoruz
import { selamlama, gunaydin } from './mesajlar.js';

console.log(selamlama); // Çıktı: Merhaba Kombinsever!
gunaydin(); // Çıktı: Tarz dolu bir gün dilerim!
```

---

## 🔍 Gerçek Örnek: Bizim Proje

Şimdi senin projen olan `main.js` dosyasına bakarsan (11. satırdasın şu an), en tepede şunları göreceksin:

```javascript
import { authUI } from './pages/auth.js';
import { onboarding } from './pages/onboarding.js';
```

Bu şu demek: "Kayıt ekranı (auth) ve İlk Tanıtım (onboarding) için gereken bütün akıllı kodları git kendi dosyalarından getir, ben burada (`main.js`) onları yöneteceğim."

---

## ✍️ SIRA SENDE (Alıştırma 1)

Seninle küçük bir "Mutfak" testi yapalım:

1.  **`mutfak.js`** adında bir dosya oluştur (benim için `/tmp/mutfak.js` olabilir veya senin çalışma alanında istediğin bir yer).
2.  İçine `export` kullanarak bir `yemek` değişkeni ve bir `pisir()` fonksiyonu yaz.
3.  **`sofra.js`** adında başka bir dosya oluştur.
4.  `mutfak.js`'den bu iki şeyi `import` et ve konsola yazdır!

Hadi bakalım, kodları bekliyorum! İstersen direkt buraya yaz, istersen dosyaları oluşturup söyle.
ben buraya yapımya  mutfak.js
export const yemek='menü tavuk sote ve pilav';
export function pisir(){
    console.log('afiyet olsun yemeginiz pişmiştir');
}
sofra.js 
import {yemek,pisir} from './mutfak.js';
console.log(yemek);
console.log(pisir);

> [!TIP]
> Unutma: `import` yaparken dosya yolunun başına mutlaka `./` koymalısın ve sonuna `.js` eklemelisin.
