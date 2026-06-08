# 🌐 5. Bölüm: İnternetten Veri Çekme (Async/Await & Fetch)

Şimdiye kadar yazdığımız kodlar hep "sırayla" çalışıyordu. Ama internetten bir veri çekmek (örneğin hava durumunu öğrenmek) zaman alır. Eğer kodumuz o veriyi beklerken dursa, ekran donar ve kullanıcı hiçbir şeye tıklayamaz. İşte bu sorunu **asenkron (async)** programlama ile çözüyoruz.

---

## ⏳ 1. `async` ve `await` (Sabırlı Kodlar)

Bir fonksiyonun başına `async` yazdığında, ona "Senin içinde beklememiz gereken işler olabilir" demiş olursun. `await` ise "Şu veri gelene kadar burada dur ama tarayıcıyı dondurma" demektir.

### Basit Bir Örnek:
```javascript
async function veriGetir() {
    console.log("Veri isteniyor...");
    const veri = await baskaBirFonksiyon(); // Veri gelene kadar bekler
    console.log("Veri geldi:", veri);
}
```

---

## 🌍 2. Fetch API (İnterneti Aramak)

Tarayıcıda dış bir kaynaktan (API) veri almak için `fetch` kullanırız. 

### Senin Projendeki Hava Durumu (`api.js`):
Senin projenin içinde hava durumunu çekerken şu mantığı kullanıyoruz:

```javascript
async getWeather(city) {
    const res = await fetch(`https://api.openweathermap.org/...&q=${city}`);
    const data = await res.json(); // Gelen ham veriyi okunabilir JSON'a çeviriyoruz
    return data;
}
```

---

## 🛡️ 3. Try / Catch (Hata Yakalama)

İnternet bazen kesilebilir veya API hata verebilir. Kodun çökmemesi için "Deneyelim (try), hata olursa yakalayalım (catch)" mantığını kullanırız.

```javascript
try {
    const data = await fetch("...");
    // Her şey yolundaysa çalışır
} catch (error) {
    console.log("Eyvah, bir hata oldu!", error);
}
```

---

## 🔍 Gerçek Örnek: `api.js` İçindeki Yapı

Hadi öğrendiklerimizi birleştirelim. Senin `api.js` dosyasında şu meşhur yapıyı göreceksin:

```javascript
// Destructuring + Async + Template Literals + Try/Catch hepsi bir arada!
async function profilGetir() {
    try {
        const response = await fetch('/api/user/1');
        const { name, id } = await response.json(); // Destructuring ile veriyi aldık
        console.log(`Hoş geldin ${name}! (ID: ${id})`); // Template Literal
    } catch (err) {
        console.error("Profil yüklenemedi!");
    }
}
```

---

## ✍️ SIRA SENDE (Alıştırma 5)

Bu sefer gerçek hayata çok yakın bir görev veriyorum:

1. **`api_test.js`** adında bir dosya oluştur (veya alta ekle).
2. `getFakeData` adında bir **arrow function** oluştur ve bu **async** olsun.
3. Bu fonksiyon içinde `fetch` kullanarak şu adrese istek at: `https://jsonplaceholder.typicode.com/posts/1`
4. Gelen yanıtı `json()` formatına çevir.
5. **Destructuring** kullanarak gelen objenin içinden `title` ve `body` kısımlarını al.
6. `console.log` ile ekrana **template literal** kullanarak şu formatta yazdır:
   `"Başlık: [title] - İçerik: [body]"`
7. Tüm bu işlemi bir **try-catch** bloğu içine al ki hata olursa yakalansın.

Hadi bakalım, gerçek bir API ile ilk temasını görelim! 🚀🌐

api_test.js
async function getFakeDate(){
   try{
    const response= await fetch(`https://jsonplaceholder.typicode.com/posts/1`);
    const{title,body}=await response.json();
    console.log('basik: ${title}- içerik:${body}');
   }catch(err){
    console.log('eyvah bir hata oluştu',err);
   }
}
