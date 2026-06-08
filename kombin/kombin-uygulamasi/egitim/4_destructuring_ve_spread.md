# 📦 4. Bölüm: JS'nin Sihirli Değnekleri (Destructuring & Spread)

Bu bölümde kod yazma hızını 2 katına çıkaracak ve objelerle/dizilerle çalışmayı çok daha keyifli hale getirecek iki süper özelliği öğreneceğiz: **Destructuring** (Seçip Çıkarma) ve **Spread** (Dağıtma/Kopyalama).

---

## ✂️ 1. Destructuring (Objeyi Parçalara Ayırmak)

Bir objenin içindeki verileri tek tek değişkenlere atamak yerine, onları tek hamlede "çekip alabiliriz".

### Eskiden (Uzun):
```javascript
const user = { ad: "Fatih", yas: 25, sehir: "İstanbul" };

const ad = user.ad;
const yas = user.yas;
```

### Şimdi (Kısa & Modern):
```javascript
const { ad, yas } = user;
console.log(ad); // Fatih
```
> **Neden Önemli?** Özellikle API'den gelen karmaşık verilerde sadece ihtiyacın olanı almak için harikadır!

---

## 🧂 2. Spread Operator (Üç Nokta Sihri - `...`)

Dizileri veya objeleri kopyalamak, birleştirmek veya üzerine bir şeyler eklemek için kullanılır.

### Dizileri Birleştirmek:
```javascript
const eskiKombinler = ["Jean", "Tişört"];
const yeniKombinler = ["Ceket", ...eskiKombinler];

console.log(yeniKombinler); // ["Ceket", "Jean", "Tişört"]
```

### Objeleri Kopyalamak:
```javascript
const ayarlar = { tema: "karanlık", ses: 10 };
const yeniAyarlar = { ...ayarlar, ses: 15 }; // Her şeyi kopyala, sadece sesi güncelle

console.log(yeniAyarlar); // { tema: "karanlık", ses: 15 }
```

---

## 🔍 Gerçek Örnek: Proje Verisi

Senin projende bir kıyafet listesini güncellerken spread operatörü çok işimize yarayacak:

```javascript
const gardrop = ["Mavi Gömlek", "Siyah Pantolon"];
const yeniHali = [...gardrop, "Beyaz Ayakkabı"]; // Yeni bir dizi oluşturduk
```

---

## ✍️ SIRA SENDE (Alıştırma 4)

Hadi bu özellikleri test edelim!

1. **`deneme.js`** adında bir dosya oluştur (veya `3. bölümdeki` gibi alta yaz :).
2. Şöyle bir objen olsun: 
   ```javascript
   const urun = { isim: "Siyah Ceket", fiyat: 500, beden: "L" };
   ```
3. **Destructuring** kullanarak bu objeden `isim` ve `fiyat` değişkenlerini tek satırda oluştur.
4. `spread` operatörünü kullanarak `yeniUrun` isminde bir obje oluştur. Bu obje `urun` objesinin tüm özelliklerine sahip olsun ama **fiyatı 600** olsun ve ek olarak `renk: "Siyah"` özelliği eklensin.
5. Sonuçları `console.log` ile yazdır.

deneme.js
const {isim,fiyat}=urun;
const yeniUrun={...urun,fiyat:600,renk:'siyah'};
console.log(yeniUrun);

Bakalım sihirli üç noktayı ve parçalamayı çözebilecek misin? 🪄✨
