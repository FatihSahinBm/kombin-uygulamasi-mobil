# ⚡ 3. Bölüm: Modern JS Gücü (Arrow Functions & Template Literals)

Objeleri ve modülleri öğrendik. Şimdi ise kodumuzu daha okunabilir ve profesyonel gösteren iki önemli özelliği öğreneceğiz: **Arrow Functions** ve **Template Literals**. Projendeki `ui.js` dosyasının neden o kadar "temiz" göründüğünün sırrı burada!

---

## 🎨 1. Template Literals (Tırnaklardan Kurtulun!)

Eskiden değişkenleri metinlerle birleştirirken `+` işaretini kullanırdık ve her şey birbirine girerdi. Modern JS'de ise **Backtick** (`` ` ``) işaretini kullanıyoruz.

### Eski Yöntem (Karmaşık):
```javascript
const user = "Fatih";
const mesaj = "Hoş geldin " + user + ", bugün hava çok güzel!";
```

### Yeni Yöntem (Temiz):
```javascript
const user = "Fatih";
const mesaj = `Hoş geldin ${user}, bugün hava çok güzel!`;
```
> **Avantajı:** Metnin içine değişkenleri `${}` ile direkt gömebiliriz. Ayrıca alt satıra geçmek için `\n` kullanmamıza gerek kalmaz, direkt Enter'a basıp yazabiliriz!

---

## 🏹 2. Arrow Functions (Ok Fonksiyonları)

Fonksiyon yazmanın daha kısa ve havalı bir yolu. Artık `function` kelimesini her yere yazmamıza gerek yok.

### Klasik Fonksiyon:
```javascript
const merhabaDe = function(isim) {
    return `Merhaba ${isim}`;
};
```

### Arrow Function:
```javascript
const merhabaDe = (isim) => `Merhaba ${isim}`;
```
> **Püf Noktası:** Eğer fonksiyon tek bir iş yapıyorsa (tek satırsa), `{}` süslü parantezlere ve `return` kelimesine bile gerek kalmaz!

---

## 🔍 Gerçek Örnek: Bizim Proje (`ui.js`)

Senin projende HTML oluştururken şu yapıyı kullanıyoruz:

```javascript
export const ui = {
    renderUserCard(user) {
        return `
            <div class="card">
                <h3>${user.name}</h3>
                <button onclick="alert('${user.id}')">Detay</button>
            </div>
        `;
    }
};
```
Gördüğün gibi hem **Template Literals** (HTML'i olduğu gibi yazdık) hem de temiz bir yapı kullandık.

---

## ✍️ SIRA SENDE (Alıştırma 3)

Hadi bu iki gücü birleştirelim! 

1. **`hesapla.js`** adında bir dosya oluştur.
2. İçinde `islem` isminde bir obje olsun ve bunu `export` et.
3. Bu objenin içinde:
    *   `topla` adında bir **arrow function** olsun (iki sayı alıp toplasın).
    *   `ozetGoster` adında bir fonksiyon olsun. Bu fonksiyon; `urunAdi` ve `fiyat` bilgilerini alsın ve template literal kullanarak şu cümleyi dönsün: 
        `"Satın alınan ürün: [ürün adı], Toplam borcunuz: [fiyat] TL"`

Hadi bakalım, modern JS yazışını görelim! 💻✨

hesapla.js
export const islem={
    topla(sayi1,sayi2){
        console.log(sayi1+sayi2);
    },
    ozetGoster(urunAdi,fiyat){
        console.log(`satın alınan ürün: ${urunAdi}, toplam borcunuz: ${fiyat} tl`);
    }
}