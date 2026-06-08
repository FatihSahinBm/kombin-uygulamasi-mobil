# 📦 2. Bölüm: Obje Odaklı Yapı (Object Literal)

Bir önceki derste modülleri öğrendik. Şimdi ise bir modülün içindeki kodları nasıl daha derli toplu tutacağımızı göreceğiz. Projende neden her şey `authUI.init()` veya `onboarding.init()` şeklinde yazılmış, onu keşfedeceğiz.

## 🗃️ Nedir Bu Obje Yapısı?

Düşün ki bir **Akıllı Telefonun** var. Bu telefonun özellikleri ve yapabildiği işler var:
- **Özellikleri (Değişkenler):** Marka, Model, Renk...
- **Yaptığı İşler (Fonksiyonlar):** Ara(), MesajGönder(), FotoğrafÇek()...

JavaScript'te bunları tek bir "paket" içine koyabiliriz.

### 1. Basit Bir Obje Oluşturma

```javascript
const telefon = {
    marka: "Apple",
    model: "iPhone 15",
    
    ara: function() {
        console.log("Aranıyor...");
    },
    
    mesajGonder: function() {
        console.log("Mesaj iletildi!");
    }
};

// Kullanımı:
console.log(telefon.marka); // "Apple"
telefon.ara(); // "Aranıyor..."
```

---

## 🔍 Gerçek Örnek: Bizim Proje (`auth.js`)

Senin projedeki `js/pages/auth.js` dosyasına bakarsan (veya ben sana göstereyim), yapı tam olarak şöyledir:

```javascript
export const authUI = {
    init() {
        console.log("Auth UI modülü yüklendi.");
        // Sayfa hazırlık kodları burada...
    },
    
    tabDegistir(hedef) {
        // Tabları değiştirme kodları burada...
    }
};
```

### Neden Böyle Yapıyoruz?
1.  **Karışıklığı Önler:** Eğer `init()` isminde 10 sayfa için 10 tane fonksiyonumuz olsaydı hepsi birbirine karışırdı. Ama `authUI.init()` ve `dashboard.init()` diyerek hangisini çalıştırdığımızı netleştiriyoruz.
2.  **Düzen:** Her şey bir "kutu" içinde toplu durur.

---

## ✍️ SIRA SENDE (Alıştırma 2)

Hadi seninle bir **Garaj** objesi yapalım!

1.  **`oto.js`** adında bir dosya oluştur.
2.  İçine `garaj` isminde bir obje `export` et.
3.  Bu objenin içinde:
    *   `arabaMarkası` diye bir özellik olsun.
    *   `kapıyıAç()` diye bir fonksiyon olsun (içinde console.log olsun).
    *   `motoruÇalıştır()` diye bir fonksiyon olsun.
4.  Bu objeyi başka bir dosyada `import` et ve motoru çalıştır!

### Çözüm Kontrolü ✅
Harika! Mantık tamamen doğru. Sadece küçük bir sözdizimi (syntax) hatası var: `export` yaparken değişkenin türünü (`const` veya `let`) belirtmemiz gerekir. Ayrıca modern yazımı da ekleyelim.

**oto.js**
```javascript
export const garaj = {
    arabaMarkasi: 'BMW',
    
    // Klasik yöntem
    kapiyiac: function() {
        console.log('Kapı açıldı');
    },
    
    // Modern shorthand (kısa) yöntem ⭐
    motoruCalistir() {
        console.log('Motor çalıştı');
    }
};
```

**import.js**
```javascript
import { garaj } from './oto.js';

console.log('Araba markası: ' + garaj.arabaMarkasi);
garaj.kapiyiac();
garaj.motoruCalistir();
```

Süper! Obje yapısını kaptın. Şimdiyse bu kodları çok daha yakışıklı ve kısa yazmamızı sağlayan "Modern JS Gücü"ne geçiyoruz. 🚀


Bakalım garajdaki arabayı çalıştırabilecek miyiz? 🏎️💨

> [!TIP]
> Modern JS'de obje içindeki fonksiyonları `init: function() {}` yerine kısaca `init() {}` şeklinde yazabilirsin. Ben de öyle yapmanı tavsiye ederim!
