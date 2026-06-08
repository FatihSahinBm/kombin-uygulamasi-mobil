# 🧩 6. Bölüm: Modern Liste İşlemleri (Array Methods)

Şu ana kadar değişkenleri, objeleri ve internetten veri çekmeyi öğrendik. Peki elimizde 100 tane kıyafet varsa ve biz sadece "Siyah" olanları bulmak istiyorsak? Veya tüm fiyatlara %20 indirim yapmak istiyorsak? 

Eskiden olsa `for` döngüsüyle uğraşırdık. Ama modern JavaScript'te bu işler için çok daha şık ve kısa yöntemler var: **Array Methods**.

---

## 🔍 1. `filter()` (Süzgeçten Geçirmek)

Bir dizideki elemanlardan sadece istediklerini seçip yeni bir dizi oluşturur. Senin projende "Kışlık kıyafetleri getir" demek için birebirdir.

```javascript
const kiyafetler = [
    { isim: "Kırmızı Kazak", mevsim: "Kış" },
    { isim: "Mavi Şort", mevsim: "Yaz" },
    { isim: "Siyah Mont", mevsim: "Kış" }
];

// Sadece Kışlık olanları alalım:
const kisliklar = kiyafetler.filter(urun => urun.mevsim === "Kış");

console.log(kisliklar); // [{isim: "Kırmızı Kazak"...}, {isim: "Siyah Mont"...}]
```

---

## 🎨 2. `map()` (Dönüştürmek)

Dizideki her elemanı alır, üzerine bir işlem yapar ve yeni bir dizi oluşturur. Genelde veriyi ekrana basılacak hale getirmek için kullanılır.

```javascript
const fiyatlar = [100, 200, 300];

// Her fiyata TL sembolü ekleyelim:
const etiketler = fiyatlar.map(fiyat => `${fiyat} TL`);

console.log(etiketler); // ["100 TL", "200 TL", "300 TL"]
```

---

## 🎯 3. `find()` (Aradığını Bulmak)

Dizi içinde bir şartı sağlayan **ilk** elemanı bulur. Eğer sadece bir tane ürünün detayına bakacaksan bunu kullanırsın.

```javascript
const urunler = [
    { id: 1, isim: "Gömlek" },
    { id: 2, isim: "Pantolon" }
];

const bulunanUrun = urunler.find(u => u.id === 2);
console.log(bulunanUrun.isim); // "Pantolon"
```

---

## ⚡ 4. Neden Bunları Kullanıyoruz?

1. **Okunabilirlik:** Kodun ne yaptığı isminden belli olur (`filter` diyorsan süzüyorsundur).
2. **Kısalık:** 10 satırlık `for` döngüsü yerine tek satırda işi bitirirsin.
3. **Immutability:** Orijinal diziyi bozmazlar, hep yeni bir sonuç verirler. Bu da hataları azaltır.

---

## ✍️ SIRA SENDE (Alıştırma 6)

Senin mağazadaki ürünlerle küçük bir simülasyon yapalım:

1. **`liste_test.js`** adında bir dosya oluştur.
2. Şöyle bir dizi tanımla:
   ```javascript
   const urunListesi = [
       { id: 1, ad: "Mavi Jean", fiyat: 400, stok: true },
       { id: 2, ad: "Beyaz Tişört", fiyat: 150, stok: false },
       { id: 3, ad: "Yeşil Ceket", fiyat: 800, stok: true },
       { id: 4, ad: "Siyah Bot", fiyat: 1200, stok: true }
   ];
   ```
3. **`filter`** kullanarak sadece stokta olan (`stok: true`) ürünleri `stoktakiler` değişkenine ata.
4. **`map`** kullanarak `stoktakiler` dizisindeki ürünlerin isimlerini büyük harfe çevirip yeni bir dizi yap (İpucu: `.toUpperCase()`).
5. **`find`** kullanarak fiyatı 800 olan ürünü bul ve konsola yazdır.

Hadi bakalım, dizilerle sihir yapma sırası sende! 🪄📊
