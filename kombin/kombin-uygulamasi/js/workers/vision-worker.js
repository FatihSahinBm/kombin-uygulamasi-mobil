import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2/dist/transformers.js';

// Sadece uzak repodan (HuggingFace CDN) model çekmesi için:
env.allowLocalModels = false;

// Singleton pattern ile modeli 1 kez yükle
class VisionPipeline {
    static task = 'zero-shot-image-classification';
    static model = 'Xenova/clip-vit-base-patch32';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { 
                progress_callback,
                device: 'webgpu' // Transformers.js v3, WebGPU'yu destekler. Desteklemiyorsa otomatik WASM'a geçer.
            }).catch(err => {
                console.warn("WebGPU başlatılamadı, WASM'a düşülüyor...", err);
                return pipeline(this.task, this.model, { progress_callback, device: 'wasm' });
            });
        }
        return this.instance;
    }
}

// Sınıflandırma ve Çeviri Sözlüğü (Daha iyi Prompt Engineering ile)
const transMap = {
    'a photo of a t-shirt': 'Tişört', 'a photo of long denim jeans': 'Kot Pantolon', 'a photo of a jacket': 'Ceket', 'a photo of a sweater': 'Kazak', 
    'a photo of a dress': 'Elbise', 'a photo of a button-down shirt': 'Gömlek', 'a photo of long fabric pants': 'Pantolon', 'a photo of a skirt': 'Etek', 'a photo of short summer shorts': 'Şort', 'a photo of athletic sweatpants': 'Eşofman',
    'a photo of a sneaker': 'Spor Ayakkabı', 'a photo of leather boots': 'Bot', 'a photo of summer sandals': 'Sandalet', 'a photo of formal leather shoes': 'Klasik Ayakkabı', 'a photo of a winter coat': 'Kaban', 'a photo of high heels': 'Topuklu Ayakkabı',
    'a photo of a hoodie': 'Kapüşonlu', 'a photo of a bag': 'Çanta', 'a photo of a hat': 'Şapka', 'a photo of a belt': 'Kemer', 'a photo of glasses': 'Gözlük',
    'black': 'Siyah', 'white': 'Beyaz', 'gray': 'Gri', 'red': 'Kırmızı', 'blue': 'Mavi', 'navy': 'Lacivert',
    'green': 'Yeşil', 'yellow': 'Sarı', 'brown': 'Kahverengi', 'beige': 'Bej', 'pink': 'Pembe', 'purple': 'Mor',
    'oversize fit': 'Oversize', 'slim fit': 'Slim Fit', 'regular fit': 'Regular', 'loose fit': 'Bol Kesim', 'baggy': 'Baggy (Çok Bol)', 'skinny fit': 'Skinny',
    'v-neck': 'V Yaka', 'crew neck': 'Bisiklet Yaka', 'polo collar': 'Polo Yaka', 'turtleneck': 'Balıkçı Yaka', 'hooded': 'Kapüşonlu',
    'short sleeve': 'Kısa Kol', 'long sleeve': 'Uzun Kol', 'sleeveless': 'Kolsuz',
    'full length': 'Tam Boy', 'ankle length': 'Bilek Boy', 'cropped': 'Kısa (Cropped)', 'shorts length': 'Şort Boyu',
    'denim': 'Kot (Denim)', 'leather': 'Deri', 'knitted': 'Örgü (Triko)', 'cotton': 'Pamuk', 'silk': 'İpek', 'satin': 'Saten', 'linen': 'Keten', 'wool': 'Yün',
    'casual': 'Günlük (Casual)', 'formal': 'Resmi (Formal)', 'streetwear': 'Sokak Stili', 'sporty': 'Sportif', 'elegant': 'Şık', 'vintage': 'Vintage'
};

// ──────────────────────────────────────────────────────────────────
// Belirli bir ana kategoriye göre detaylı analiz yapan yardımcı fonksiyon.
// "focusCategory" gönderildiğinde veya ön analiz "tek parça" bulduğunda çalışır.
// ──────────────────────────────────────────────────────────────────
async function analyzeForCategory(classifier, imageBase64, mainCat, analysisId) {
    const results = { mainCategory: mainCat };

    self.postMessage({ status: 'analyzing', message: 'Görselin detayları (Kalıp, Doku, Stil) çıkartılıyor... (Aşama 2)', analysisId });

    let dynamicClasses = {
        category: [],
        color: ['black', 'white', 'gray', 'red', 'blue', 'navy', 'green', 'yellow', 'brown', 'beige', 'pink', 'purple'],
        texture: ['denim', 'leather', 'knitted', 'cotton', 'silk', 'satin', 'linen', 'wool'],
        style: ['casual', 'formal', 'streetwear', 'sporty', 'elegant', 'vintage']
    };

    if (mainCat === 'top garment') {
        dynamicClasses.category = ['a photo of a t-shirt', 'a photo of a button-down shirt', 'a photo of a sweater'];
        dynamicClasses.fit = ['oversize fit', 'slim fit', 'regular fit', 'loose fit'];
        dynamicClasses.neckline = ['v-neck', 'crew neck', 'polo collar', 'turtleneck'];
        dynamicClasses.sleeve = ['short sleeve', 'long sleeve', 'sleeveless'];
    } else if (mainCat === 'outerwear') {
        dynamicClasses.category = ['a photo of a jacket', 'a photo of a hoodie', 'a photo of a winter coat'];
        dynamicClasses.fit = ['oversize fit', 'slim fit', 'regular fit', 'loose fit'];
        dynamicClasses.neckline = ['v-neck', 'turtleneck', 'hooded'];
        dynamicClasses.sleeve = ['long sleeve', 'sleeveless'];
    } else if (mainCat === 'bottom garment') {
        dynamicClasses.category = ['a photo of long denim jeans', 'a photo of long fabric pants', 'a photo of short summer shorts', 'a photo of a skirt', 'a photo of athletic sweatpants'];
        dynamicClasses.fit = ['skinny fit', 'slim fit', 'regular fit', 'loose fit', 'baggy'];
        dynamicClasses.leg_length = ['full length', 'ankle length', 'cropped', 'shorts length'];
    } else if (mainCat === 'footwear') {
        dynamicClasses.category = ['a photo of a sneaker', 'a photo of leather boots', 'a photo of summer sandals', 'a photo of formal leather shoes', 'a photo of high heels'];
    } else {
        dynamicClasses.category = ['a photo of a bag', 'a photo of a hat', 'a photo of a belt', 'a photo of glasses'];
    }

    // Seçilen dinamik özelliklerin Zero-Shot analizi
    for (const [key, labels] of Object.entries(dynamicClasses)) {
        if (labels.length > 0) {
            const output = await classifier(imageBase64, labels);
            if (output && output.length > 0) {
                let detectedLabel = output[0].label;
                results[key] = transMap[detectedLabel] || detectedLabel; 
            }
        }
    }

    return results;
}

// ──────────────────────────────────────────────────────────────────
// Sıralı Mesaj Kuyruğu (ONNX Runtime'ın çakışmasını engellemek için)
// ──────────────────────────────────────────────────────────────────
const messageQueue = [];
let isProcessingQueue = false;

self.addEventListener('message', (event) => {
    const { focusCategory } = event.data;
    
    // Eğer yeni gelen istek bir kırpma analizi ise (focusCategory varsa),
    // kuyruktaki diğer henüz işlenmemiş eski kırpma isteklerini temizleyerek kaynak tasarrufu yapalım.
    if (focusCategory) {
        for (let i = messageQueue.length - 1; i >= 0; i--) {
            if (messageQueue[i].focusCategory) {
                messageQueue.splice(i, 1);
            }
        }
    }
    
    messageQueue.push(event.data);
    processQueue();
});

async function processQueue() {
    if (isProcessingQueue) return;
    if (messageQueue.length === 0) return;

    isProcessingQueue = true;
    const taskData = messageQueue.shift();

    try {
        await handleMessage(taskData);
    } catch (err) {
        console.error("Queue process error:", err);
    } finally {
        isProcessingQueue = false;
        // Sıradaki isteği işle
        processQueue();
    }
}

async function handleMessage(data) {
    const { imageBase64, focusCategory, isCropped, analysisId } = data;
    if (!imageBase64) return;

    try {
        self.postMessage({ status: 'loading', message: 'Yapay zeka modeli yükleniyor... (Sadece ilk seferde vakit alır)', analysisId });
        
        let classifier = await VisionPipeline.getInstance(data => {
            if (data.status === 'progress') {
                self.postMessage({ status: 'progress', message: `Model Yükleniyor: %${Math.round(data.progress || 0)}`, analysisId });
            }
        });

        // ────────────────────────────────────────────────────────
        // DURUM 1: focusCategory gönderilmiş → Çoklu fotoğraftan
        //          kullanıcı bir parça seçti, direkt o parçayı analiz et.
        // ────────────────────────────────────────────────────────
        if (focusCategory) {
            self.postMessage({ status: 'analyzing', message: `Seçilen parça analiz ediliyor: ${focusCategory}...`, analysisId });
            const results = await analyzeForCategory(classifier, imageBase64, focusCategory, analysisId);
            self.postMessage({ status: 'complete', results, analysisId });
            return;
        }

        // Eğer kırpılmış parça ise (isCropped), tam kombin kontrolünü atla,
        // direkt tek parça analizine geç.
        if (isCropped) {
            self.postMessage({ status: 'analyzing', message: 'Görsel piksel piksel inceleniyor... (Aşama 1: Ana Kategori)', analysisId });

            const mainCategories = [
                'a photo of a top garment like a t-shirt or sweater', 
                'a photo of outerwear like a winter coat or leather jacket', 
                'a photo of a bottom garment like pants or shorts', 
                'a photo of footwear like shoes or boots', 
                'a photo of an accessory like a bag or hat'
            ];
            const mainCatOutput = await classifier(imageBase64, mainCategories);
            const mainCatRaw = mainCatOutput[0].label;
            
            let mainCat = 'top garment';
            if (mainCatRaw.includes('outerwear')) mainCat = 'outerwear';
            else if (mainCatRaw.includes('bottom garment')) mainCat = 'bottom garment';
            else if (mainCatRaw.includes('footwear')) mainCat = 'footwear';
            else if (mainCatRaw.includes('accessory')) mainCat = 'accessory';

            const results = await analyzeForCategory(classifier, imageBase64, mainCat, analysisId);
            self.postMessage({ status: 'complete', results, analysisId });
            return;
        }

        // ────────────────────────────────────────────────────────
        // DURUM 2: İlk yükleme – Ön Analiz (Tek parça mı, Tam kombin mi?)
        // ────────────────────────────────────────────────────────
        self.postMessage({ status: 'analyzing', message: 'Görsel inceleniyor... (Ön Analiz: Tek parça mı, tam kombin mi?)', analysisId });

        const outfitCheck = [
            'a photo of a single clothing item on a plain background',
            'a photo of a full outfit on a person showing multiple clothing items'
        ];
        const outfitOutput = await classifier(imageBase64, outfitCheck);
        const isFullOutfit = outfitOutput[0].label.includes('full outfit');

        if (isFullOutfit) {
            // ── Çoklu parça algılandı: hangi parçalar var kontrol et ──
            self.postMessage({ status: 'analyzing', message: 'Birden fazla parça algılandı, parçalar tespit ediliyor...', analysisId });

            // Her bir ana kategori için ayrı ayrı güven skoru al
            const categoryChecks = [
                { key: 'top garment', label: 'a photo of a top garment like a t-shirt or sweater', emoji: '👕', name: 'Üst Giyim', alwaysShow: true },
                { key: 'outerwear', label: 'a photo of outerwear like a winter coat or leather jacket', emoji: '🧥', name: 'Dış Giyim', alwaysShow: false },
                { key: 'bottom garment', label: 'a photo of a bottom garment like pants or shorts', emoji: '👖', name: 'Alt Giyim', alwaysShow: true },
                { key: 'footwear', label: 'a photo of footwear like shoes or boots', emoji: '👟', name: 'Ayakkabı', alwaysShow: true },
                { key: 'accessory', label: 'a photo of an accessory like a bag or hat', emoji: '🎒', name: 'Aksesuar', alwaysShow: false }
            ];

            // Tüm etiketleri tek seferde gönderip skorları alalım
            const allLabels = categoryChecks.map(c => c.label);
            const allOutput = await classifier(imageBase64, allLabels);
            
            // Tam kombin algılandıysa: Üst, Alt, Ayakkabı her zaman seçenek olarak sun.
            // Dış Giyim ve Aksesuar sadece belirli skor eşiğini geçerse ekle.
            const OPTIONAL_THRESHOLD = 0.08;
            const detectedParts = [];
            
            for (const check of categoryChecks) {
                const matchedOutput = allOutput.find(o => o.label === check.label);
                const score = matchedOutput ? matchedOutput.score : 0;
                
                if (check.alwaysShow || score >= OPTIONAL_THRESHOLD) {
                    detectedParts.push({
                        key: check.key,
                        name: check.name,
                        emoji: check.emoji,
                        score: score
                    });
                }
            }

            // Eğer 2 veya daha fazla parça algılandıysa çoklu seçim ekranını göster
            if (detectedParts.length >= 2) {
                self.postMessage({ 
                    status: 'multi-detect', 
                    detectedParts: detectedParts,
                    message: `Bu fotoğrafta ${detectedParts.length} farklı kıyafet parçası algılandı!`,
                    analysisId
                });
                return;
            }
        }

        // ────────────────────────────────────────────────────────
        // DURUM 3: Tek parça → Normal analiz akışı
        // ────────────────────────────────────────────────────────
        self.postMessage({ status: 'analyzing', message: 'Görsel piksel piksel inceleniyor... (Aşama 1: Ana Kategori)', analysisId });

        const mainCategories = [
            'a photo of a top garment like a t-shirt or sweater', 
            'a photo of outerwear like a winter coat or leather jacket', 
            'a photo of a bottom garment like pants or shorts', 
            'a photo of footwear like shoes or boots', 
            'a photo of an accessory like a bag or hat'
        ];
        const mainCatOutput = await classifier(imageBase64, mainCategories);
        const mainCatRaw = mainCatOutput[0].label;
        
        let mainCat = 'top garment';
        if (mainCatRaw.includes('outerwear')) mainCat = 'outerwear';
        else if (mainCatRaw.includes('bottom garment')) mainCat = 'bottom garment';
        else if (mainCatRaw.includes('footwear')) mainCat = 'footwear';
        else if (mainCatRaw.includes('accessory')) mainCat = 'accessory';

        const results = await analyzeForCategory(classifier, imageBase64, mainCat, analysisId);
        self.postMessage({ status: 'complete', results, analysisId });

    } catch (error) {
        console.error("Worker Hatası:", error);
        self.postMessage({ status: 'error', message: error.toString(), analysisId });
    }
}
