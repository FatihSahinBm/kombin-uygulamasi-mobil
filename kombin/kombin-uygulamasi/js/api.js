import { CONFIG, supabase } from './config.js';
import { utils } from './utils.js';

/**
 * Supabase veya başka bir Backend ile iletişim kurulacak olan katman.
 */
export const api = {
    /**
     * Kullanıcıyı sisteme kaydeder
     * @param {Object} userData 
     * @returns {Promise}
     */
    async registerUser(userData) {
        if (!supabase) {
            console.warn("Supabase yapılandırılmamış, mock kullanılıyor.");
            return { success: true, data: userData };
        }
        const { data, error } = await supabase.from('users').insert([userData]).select();
        if (error) throw error;
        return { success: true, data: data[0] };
    },

    /**
     * Kullanıcının tercih ettiği stilleri ve bilgileri kaydeder
     * @param {Object} prefData 
     * @returns {Promise}
     */
    async savePreferences(prefData) {
        if (!supabase) {
            return { success: true, data: prefData };
        }
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) throw new Error("Kullanıcı oturumu bulunamadı!");

        // Yalnızca veritabani.sql içindeki tabloda yer alan sütunları eşleştiriyoruz
        // Aksi takdirde Supabase "column doesn't exist" ağ hatası fırlatır.
        const payload = { 
            user_id: userData.user.id, 
            style: prefData.preferredStyles ? prefData.preferredStyles.join(', ') : (prefData.style || null),
            gender: prefData.gender || null,
            budget: prefData.budget ? Number(prefData.budget) : null
        };
        
        const { data: existingPrefArray } = await supabase
            .from('preferences')
            .select('id')
            .eq('user_id', userData.user.id);

        let data, error;
        if (existingPrefArray && existingPrefArray.length > 0) {
            // Güncelleme
            const res = await supabase
                .from('preferences')
                .update(payload)
                .eq('user_id', userData.user.id)
                .select();
            data = res.data;
            error = res.error;
        } else {
            // Ekleme
            const res = await supabase
                .from('preferences')
                .insert([payload])
                .select();
            data = res.data;
            error = res.error;
        }
            
        if (error) throw error;

        // Ekstra bilgileri (boy, kilo vb.) Auth metadata içerisine kaydediyoruz
        await supabase.auth.updateUser({ data: prefData });

        return { success: true, data: data ? data[0] : null };
    },

    async getWeather(city = 'Istanbul') {
        if (!CONFIG.WEATHER_API_KEY) {
            console.warn("Weather API key eksik, mock veri döndürülüyor.");
            await utils.delay(500);
            return { temp: 21, condition: 'Güneşli', icon: '☀️', wind: 15 };
        }
        
        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&lang=tr&appid=${CONFIG.WEATHER_API_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Hava durumu API'den yanıt alınamadı.");
            
            const data = await res.json();
            return {
                temp: Math.round(data.main.temp),
                condition: data.weather[0].description,
                icon: `https://openweathermap.org/img/wn/${data.weather[0].icon}.png`, // Openweather Icon URL
                wind: data.wind ? data.wind.speed : 0
            };
        } catch (error) {
            console.error("Hava durumu verisi çekilemedi:", error);
            return { temp: "--", condition: "Veri Yok", icon: "☁️", wind: 0 }; // Fallback
        }
    },

    async getUserProfile() {
        if (!supabase) {
            await utils.delay(500); 
            return {
                id: 'u123',
                name: 'Ahmet',
                preferences: { style: 'casual' }
            };
        }
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return null;
        
        const { data, error } = await supabase.from('users').select('*, preferences(*)').eq('id', userData.user.id).single();
        if (error) {
            // Eğer profile tablosunda kayıt yoksa sadece auth bilgisini dönelim.
            return { id: userData.user.id, name: userData.user.user_metadata?.full_name || 'Kullanıcı', preferences: {} };
        }
        
        // Supabase foreign-key relation geri dönüşünü normalize edelim
        const prefs = Array.isArray(data.preferences) ? (data.preferences[0] || {}) : (data.preferences || {});
        
        return {
            ...data,
            preferences: prefs,
            metadata: userData.user.user_metadata || {}
        };
    },

    async updateUserProfile(updates) {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        
        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userData.user.id);
            
        if (error) throw error;
        
        // Auth metadatasını da güncelleyelim (sadece name değiştiyse)
        if (updates.name) {
            await supabase.auth.updateUser({
                data: { full_name: updates.name }
            });
        }
    },

    // --- Anasayfa Eklentileri ---
    
    async getWardrobeItems(userId) {
        if (!supabase) {
            await utils.delay(600);
            return [
                { id: 'w1', type: 'tshirt', color: 'beyaz', name: 'Beyaz Basic Tişört' },
                { id: 'w2', type: 'pants', color: 'mavi', name: 'Mavi Kot Pantolon' },
                { id: 'w3', type: 'shoes', color: 'beyaz', name: 'Beyaz Sneaker' },
                { id: 'w4', type: 'jacket', color: 'siyah', name: 'Siyah Deri Ceket' }
            ];
        }
        
        const { data, error } = await supabase
            .from('wardrobe')
            .select('*, categories(name), colors(name)')
            .eq('user_id', userId);
        if (error) throw error;
        return data;
    },

    async uploadImage(file, bucketName = 'wardrobe_images') {
        if (!supabase) return null;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");

        const fileExt = file.name.split('.').pop();
        const fileName = `${userData.user.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file);

        if (error) throw error;

        // Public URL alalım
        const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    },

    async addWardrobeItem(itemData) {
        if (!supabase) return { success: true };
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        
        let categoryId = null;
        if (itemData.category) {
            let { data: catDataArray } = await supabase.from('categories').select('id').eq('name', itemData.category).limit(1);
            let catData = catDataArray && catDataArray.length > 0 ? catDataArray[0] : null;
            
            if (!catData) {
                const { data: newCat, error: catErr } = await supabase.from('categories').insert([{ name: itemData.category }]).select();
                if (!catErr && newCat) categoryId = newCat[0].id;
            } else {
                categoryId = catData.id;
            }
        }

        let colorId = null;
        if (itemData.color) {
            let { data: colDataArray } = await supabase.from('colors').select('id').eq('name', itemData.color).limit(1);
            let colData = colDataArray && colDataArray.length > 0 ? colDataArray[0] : null;

            if (!colData) {
                const { data: newCol, error: colErr } = await supabase.from('colors').insert([{ name: itemData.color }]).select();
                if (!colErr && newCol) colorId = newCol[0].id;
            } else {
                colorId = colData.id;
            }
        }

        const payload = {
            user_id: userData.user.id,
            category_id: categoryId,
            color_id: colorId,
            name: itemData.name, 
            image_url: itemData.image_url || null,
            attributes: itemData.attributes || null
        };

        const { data, error } = await supabase.from('wardrobe').insert([payload]).select();
        if (error) throw error;
        return data ? data[0] : null;
    },

    async updateWardrobeItem(itemId, itemData) {
        if (!supabase) return { success: true };
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        
        let categoryId = null;
        if (itemData.category) {
            let { data: catDataArray } = await supabase.from('categories').select('id').eq('name', itemData.category).limit(1);
            let catData = catDataArray && catDataArray.length > 0 ? catDataArray[0] : null;
            if (!catData) {
                const { data: newCat } = await supabase.from('categories').insert([{ name: itemData.category }]).select();
                if (newCat) categoryId = newCat[0].id;
            } else categoryId = catData.id;
        }

        let colorId = null;
        if (itemData.color) {
            let { data: colDataArray } = await supabase.from('colors').select('id').eq('name', itemData.color).limit(1);
            let colData = colDataArray && colDataArray.length > 0 ? colDataArray[0] : null;
            if (!colData) {
                const { data: newCol } = await supabase.from('colors').insert([{ name: itemData.color }]).select();
                if (newCol) colorId = newCol[0].id;
            } else colorId = colData.id;
        }

        const payload = {
            category_id: categoryId,
            color_id: colorId,
            name: itemData.name, 
            attributes: itemData.attributes || null
        };
        
        if (itemData.image_url) {
            payload.image_url = itemData.image_url;
        }

        const { data, error } = await supabase
            .from('wardrobe')
            .update(payload)
            .eq('id', itemId)
            .eq('user_id', userData.user.id)
            .select();
            
        if (error) throw error;
        return data ? data[0] : null;
    },

    async deleteWardrobeItem(itemId) {
        if (!supabase) return { success: true };
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");

        // Güvenlik için sadece o kullanıcının IDsine sahipse siler
        const { error } = await supabase.from('wardrobe').delete().eq('id', itemId).eq('user_id', userData.user.id);
        if (error) throw error;
        return true;
    },

    async generateOutfitIdea(params) {
        if (!supabase) throw new Error("Supabase bağlantısı yok");
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");

        // 1. Kullanıcının Gardırobunu Çek
        const items = await this.getWardrobeItems(userData.user.id);
        
        // 2. Kategorilere Göre Grupla
        const ust = items.filter(i => {
            const cat = i.categories?.name?.toLowerCase() || '';
            return cat.includes('ust') || cat.includes('üst') || cat.includes('gömlek') || cat.includes('tişört') || cat.includes('kazak');
        });
        const alt = items.filter(i => {
            const cat = i.categories?.name?.toLowerCase() || '';
            return cat.includes('alt') || cat.includes('pantolon') || cat.includes('şort') || cat.includes('etek');
        });
        const ayakkabi = items.filter(i => {
            const cat = i.categories?.name?.toLowerCase() || '';
            return cat.includes('ayakkabi') || cat.includes('ayakkabı') || cat.includes('sneaker') || cat.includes('bot');
        });
        const dis = items.filter(i => {
            const cat = i.categories?.name?.toLowerCase() || '';
            return cat.includes('dis') || cat.includes('dış') || cat.includes('ceket') || cat.includes('mont') || cat.includes('kaban');
        });

        // 3. Yetersiz Veri Kontrolü
        if (ust.length === 0 || alt.length === 0 || ayakkabi.length === 0) {
            return {
                isError: true,
                title: "Yetersiz Gardırop Verisi ⚠️",
                description: "Sana özel kombin önerebilmemiz için gardırobuna en az 1 Üst Giyim, 1 Alt Giyim ve 1 Ayakkabı eklemelisin.",
                items: [],
                colorPalette: ["#cbd5e1"]
            };
        }

        // 4. Hava Durumu ve Akıllı Kombin Algoritması (Yapay Zeka Destekli Skorlama)
        let temp = parseFloat(params.weatherTemp) || 20;
        
        // --- 4.1. Tarz Bonusu (Kullanıcı Tercihleri) ---
        const userStyles = (params.style || '').toLowerCase();
        const getStyleBonus = (item) => {
            let bonus = 0;
            const name = (item.name || '').toLowerCase();
            const attr = item.attributes || {};
            const texture = (attr.texture || '').toLowerCase();
            const catName = (item.categories?.name || '').toLowerCase();

            if (userStyles.includes('streetwear')) {
                if (name.includes('oversize') || name.includes('kargo') || name.includes('kapüşon') || name.includes('sweat') || catName.includes('sneaker')) bonus += 5;
            }
            if (userStyles.includes('casual')) {
                if (name.includes('jean') || name.includes('kot') || name.includes('basic') || texture.includes('pamuk') || catName.includes('tişört')) bonus += 3;
            }
            if (userStyles.includes('elegant') || userStyles.includes('klasik')) {
                if (name.includes('gömlek') || name.includes('kumaş') || name.includes('ceket') || name.includes('blazer') || texture.includes('ipek') || texture.includes('keten')) bonus += 5;
            }
            if (userStyles.includes('sport')) {
                if (name.includes('eşofman') || name.includes('tayt') || name.includes('şort') || name.includes('spor') || catName.includes('sneaker')) bonus += 5;
            }
            return bonus;
        };

        const scoreItem = (item, temp, type) => {
            let score = 0;
            const attr = item.attributes || {};
            const sleeve = (attr.sleeve || '').toLowerCase();
            const texture = (attr.texture || '').toLowerCase();
            const neck = (attr.neckline || '').toLowerCase();
            const leg = (attr.leg_length || '').toLowerCase();

            // Sıcak Hava (T > 25)
            if (temp > 25) { 
                if (type === 'ust') {
                    if (sleeve.includes('kısa')) score += 3;
                    else if (sleeve.includes('kolsuz')) score += 5;
                    else if (sleeve.includes('uzun')) score -= 5;
                    
                    if (texture.includes('keten') || texture.includes('ipek') || texture.includes('pamuk')) score += 3;
                    else if (texture.includes('yün') || texture.includes('örgü') || texture.includes('deri')) score -= 5;
                } else if (type === 'alt') {
                    if (leg.includes('şort') || leg.includes('kısa')) score += 5;
                    else if (leg.includes('tam boy')) score -= 2;
                    
                    if (texture.includes('keten') || texture.includes('pamuk')) score += 3;
                    else if (texture.includes('yün') || texture.includes('deri')) score -= 5;
                }
            } 
            // Ilık Hava (15 < T <= 25)
            else if (temp > 15 && temp <= 25) { 
                if (type === 'ust') {
                    if (sleeve.includes('kısa') || sleeve.includes('uzun')) score += 2;
                    if (texture.includes('pamuk') || texture.includes('kot') || texture.includes('keten')) score += 2;
                    else if (texture.includes('yün')) score -= 2;
                } else if (type === 'alt') {
                    if (leg.includes('tam boy') || leg.includes('bilek')) score += 3;
                    if (leg.includes('şort')) score -= 2;
                    if (texture.includes('kot') || texture.includes('pamuk')) score += 2;
                } else if (type === 'dis') {
                    if (texture.includes('kot') || texture.includes('deri') || texture.includes('keten')) score += 3;
                }
            }
            // Soğuk Hava (T <= 15)
            else { 
                if (type === 'ust') {
                    if (sleeve.includes('uzun')) score += 5;
                    else if (sleeve.includes('kısa')) score -= 3;
                    else if (sleeve.includes('kolsuz')) score -= 5;

                    if (texture.includes('yün') || texture.includes('örgü')) score += 4;
                    else if (texture.includes('keten') || texture.includes('ipek') || texture.includes('saten')) score -= 4;

                    if (neck.includes('balıkçı') || neck.includes('kapüşonlu')) score += 3;
                } else if (type === 'alt') {
                    if (leg.includes('tam boy')) score += 4;
                    else if (leg.includes('şort') || leg.includes('kısa')) score -= 5;

                    if (texture.includes('yün') || texture.includes('kot') || texture.includes('deri')) score += 3;
                    else if (texture.includes('keten')) score -= 3;
                } else if (type === 'dis') {
                    if (texture.includes('yün') || texture.includes('deri') || texture.includes('kapitone')) score += 4;
                }
            }
            
            // Tarz Bonusu (Yapay Zeka Etkisi)
            score += getStyleBonus(item);

            // Aynı hava durumunda hep aynı kıyafeti önermemesi için ufak bir rastgelelik (0 - 2 arası puan)
            score += Math.random() * 2; 
            return score;
        };

        // --- 4.2. Renk Uyum Matrisi ---
        const colorMatrix = {
            'siyah': { 'siyah': 3, 'beyaz': 5, 'gri': 4, 'kırmızı': 4, 'bej': 4, 'lacivert': 2, 'mavi': 3, 'yeşil': 3, 'sarı': 4, 'kahverengi': 1 },
            'beyaz': { 'siyah': 5, 'beyaz': 3, 'gri': 4, 'kırmızı': 4, 'bej': 4, 'lacivert': 5, 'mavi': 4, 'yeşil': 4, 'sarı': 3, 'kahverengi': 4 },
            'gri':   { 'siyah': 4, 'beyaz': 4, 'gri': 2, 'kırmızı': 3, 'bej': 2, 'lacivert': 4, 'mavi': 3, 'yeşil': 2, 'sarı': 3, 'kahverengi': 2 },
            'lacivert': {'siyah': 2, 'beyaz': 5, 'gri': 4, 'kırmızı': 3, 'bej': 5, 'lacivert': 2, 'mavi': 4, 'yeşil': 2, 'sarı': 4, 'kahverengi': 3 },
            'bej':   { 'siyah': 4, 'beyaz': 4, 'gri': 2, 'kırmızı': 3, 'bej': 2, 'lacivert': 5, 'mavi': 4, 'yeşil': 4, 'sarı': 2, 'kahverengi': 4 },
            'kırmızı':{'siyah': 4, 'beyaz': 4, 'gri': 3, 'kırmızı': 1, 'bej': 3, 'lacivert': 3, 'mavi': 2, 'yeşil': 1, 'sarı': 1, 'kahverengi': 2 },
            'yeşil': { 'siyah': 3, 'beyaz': 4, 'gri': 2, 'kırmızı': 1, 'bej': 4, 'lacivert': 2, 'mavi': 2, 'yeşil': 1, 'sarı': 2, 'kahverengi': 4 },
            'mavi':  { 'siyah': 3, 'beyaz': 4, 'gri': 3, 'kırmızı': 2, 'bej': 4, 'lacivert': 4, 'mavi': 2, 'yeşil': 2, 'sarı': 3, 'kahverengi': 3 },
            'sarı':  { 'siyah': 4, 'beyaz': 3, 'gri': 3, 'kırmızı': 1, 'bej': 2, 'lacivert': 4, 'mavi': 3, 'yeşil': 2, 'sarı': 1, 'kahverengi': 2 },
            'kahverengi': {'siyah': 1, 'beyaz': 4, 'gri': 2, 'kırmızı': 2, 'bej': 4, 'lacivert': 3, 'mavi': 3, 'yeşil': 4, 'sarı': 2, 'kahverengi': 1}
        };

        const getColorScore = (c1, c2) => {
            if (!c1 || !c2) return 1; 
            let color1 = c1.toLowerCase();
            let color2 = c2.toLowerCase();
            
            if (color1.includes('kot')) color1 = 'mavi';
            if (color2.includes('kot')) color2 = 'mavi';

            const match1 = Object.keys(colorMatrix).find(k => color1.includes(k));
            const match2 = Object.keys(colorMatrix).find(k => color2.includes(k));

            if (match1 && match2) return colorMatrix[match1][match2] * 1.5; // Renk uyumu çok önemli, katsayıyı artırdık
            if (match1 && ['siyah', 'beyaz', 'gri', 'bej'].includes(match1)) return 4;
            if (match2 && ['siyah', 'beyaz', 'gri', 'bej'].includes(match2)) return 4;
            return 1;
        };

        // --- 4.3. Kombin Eşleştirme Motoru ---
        let bestCombination = { ust: ust[0], alt: alt[0], score: -999 };

        ust.forEach(u => {
            const uScore = scoreItem(u, temp, 'ust');
            alt.forEach(a => {
                const aScore = scoreItem(a, temp, 'alt');
                const cScore = getColorScore(u.colors?.name, a.colors?.name);
                
                // Üst puanı + Alt puanı + Renk Uyumu = Toplam Kombin Puanı
                const totalScore = uScore + aScore + cScore;
                if (totalScore > bestCombination.score) {
                    bestCombination = { ust: u, alt: a, score: totalScore };
                }
            });
        });

        let selectedUst = bestCombination.ust;
        let selectedAlt = bestCombination.alt;

        // Ayakkabı Seçimi (Üst ve Alt kıyafete en uygun rengi seç)
        let selectedAyakkabi = ayakkabi[0];
        let bestShoeScore = -999;
        
        ayakkabi.forEach(shoe => {
            const matchScoreUst = getColorScore(shoe.colors?.name, selectedUst.colors?.name);
            const matchScoreAlt = getColorScore(shoe.colors?.name, selectedAlt.colors?.name);
            const sScore = scoreItem(shoe, temp, 'ayakkabi');
            
            const totalShoeScore = sScore + matchScoreUst + matchScoreAlt;
            if (totalShoeScore > bestShoeScore) {
                bestShoeScore = totalShoeScore;
                selectedAyakkabi = shoe;
            }
        });

        // Dış Giyim Mantığı (Hava soğuksa ve kombine uygun renkte dış giyim varsa ekle)
        let selectedDis = null;
        if (temp < 18 && dis.length > 0) {
            let bestDisScore = -999;
            dis.forEach(d => {
                const dScore = scoreItem(d, temp, 'dis');
                const cScore = getColorScore(d.colors?.name, selectedUst.colors?.name); // Dış giyim genelde üst giyimle veya altla uyumlu olmalı
                const totalDisScore = dScore + cScore;
                if (totalDisScore > bestDisScore) {
                    bestDisScore = totalDisScore;
                    selectedDis = d;
                }
            });
        }

        let finalItems = [
            { name: selectedUst.name, type: "Üst Giyim", image_url: selectedUst.image_url, color: selectedUst.colors?.name, source: 'wardrobe' },
            { name: selectedAlt.name, type: "Alt Giyim", image_url: selectedAlt.image_url, color: selectedAlt.colors?.name, source: 'wardrobe' },
            { name: selectedAyakkabi.name, type: "Ayakkabı", image_url: selectedAyakkabi.image_url, color: selectedAyakkabi.colors?.name, source: 'wardrobe' }
        ];

        if (selectedDis) {
            finalItems.push({ name: selectedDis.name, type: "Dış Giyim", image_url: selectedDis.image_url, color: selectedDis.colors?.name, source: 'wardrobe' });
        }

        return {
            isError: false,
            title: `${temp}°C Hava İçin Yapay Zeka Önerin`,
            description: `Bugünkü hava durumuna (${params.weatherCondition}) ve kıyafetlerinin kumaş/kalıp özelliklerine göre sana özel en uygun algoritma ile seçildi.`,
            items: finalItems,
            colorPalette: [
                selectedUst.colors?.hex_code || "#475569", 
                selectedAlt.colors?.hex_code || "#94a3b8"
            ]
        };
    },

    async shareOutfit(outfitData) {
        if (!supabase) return { success: true };
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Kullanıcı oturumu bulunamadı!");

        const payload = {
            user_id: userData.user.id,
            image: outfitData.image || null,
            tag: outfitData.description || ('#' + (outfitData.style || 'kombinAI'))
        };

        const { data, error } = await supabase.from('social_feed').insert([payload]).select();
        if (error) throw error;
        return data[0];
    },

    async getCurrentUserId() {
        if (!supabase) return null;
        const { data: userData } = await supabase.auth.getUser();
        return userData?.user?.id || null;
    },

    async deleteSocialPost(postId, imageUrl) {
        if (!supabase) return { success: true };
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");

        if (imageUrl && imageUrl.includes('supabase')) {
            try {
                const urlParts = imageUrl.split('/');
                const fileName = urlParts[urlParts.length - 1];
                // Sosyal görseller social_images bucket'ında
                await supabase.storage.from('social_images').remove([fileName]);
            } catch (e) {
                console.warn("Görsel silinemedi (devam ediliyor):", e);
            }
        }

        let query = supabase.from('social_feed').delete().eq('id', postId);
        if (userData.user.email !== 'fatihsahinbm@gmail.com') {
            query = query.eq('user_id', userData.user.id);
        }

        const { error } = await query;

        if (error) throw error;
        return true;
    },

    async getSocialFeed(offset = 0, limit = 24) {
        if (!supabase) {
            await utils.delay(1000);
            return [
                { id: '1', user_id: 'u1', users: { name: 'Zeynep' }, image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400", tag: "#streetwear çok güzel olmuş", likes_count: 124, comments_count: 3, created_at: new Date().toISOString() },
                { id: '2', user_id: 'u2', users: { name: 'Can' }, image: "https://images.unsplash.com/photo-1434389678219-e7414d455447?w=400", tag: "#casual harika bir kombin", likes_count: 89, comments_count: 1, created_at: new Date().toISOString() },
                { id: '3', user_id: 'u3', users: { name: 'Elif' }, image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400", tag: "#elegant tarzım", likes_count: 256, comments_count: 7, created_at: new Date().toISOString() }
            ];
        }

        try {
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData?.user?.id || null;

            if (userId) {
                const { data, error } = await supabase
                    .rpc('get_explore_feed', { 
                        p_user_id: userId, 
                        p_limit: limit, 
                        p_offset: offset 
                    });

                if (error) {
                    console.error("Akıllı keşfet algoritması çağrılamadı, fallback kullanılıyor:", error);
                } else if (data) {
                    // Görülen gönderileri arka planda işaretleyelim
                    if (data.length > 0) {
                        const seenRecords = data.map(post => ({
                            user_id: userId,
                            post_id: post.id
                        }));
                        supabase.from('user_seen_posts').insert(seenRecords).then(({ error: seenErr }) => {
                            if (seenErr) console.warn("Görüldü kaydı eklenemedi:", seenErr);
                        });
                    }

                    // UI'daki nested 'users' yapısıyla uyumluluk için normalize edelim
                    return data.map(post => ({
                        ...post,
                        users: {
                            name: post.user_name || 'Kullanıcı',
                            avatar_url: post.user_avatar || null
                        }
                    }));
                }
            }
        } catch (err) {
            console.error("Keşfet algoritması başlatılamadı, fallback kullanılıyor:", err);
        }

        // Oturum açılmamışsa veya RPC hata verirse eski sıralama ile getir
        const { data, error } = await supabase
            .from('social_feed')
            .select(`
                id, user_id, image, tag, created_at,
                users(name, avatar_url),
                likes_count:post_likes(count),
                comments_count:post_comments(count)
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        return data.map(post => ({
            ...post,
            likes_count: post.likes_count?.[0]?.count ?? 0,
            comments_count: post.comments_count?.[0]?.count ?? 0
        }));
    },

    async clearSeenHistory() {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        const { error } = await supabase.rpc('clear_user_seen', { p_user_id: userData.user.id });
        if (error) console.error("Görüldü geçmişi temizlenirken hata:", error);
    },

    async likePost(postId) {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        const { error } = await supabase
            .from('post_likes')
            .insert([{ post_id: postId, user_id: userData.user.id }]);
        if (error) throw error;

        // Bildirim gönder
        try {
            const { data: postData } = await supabase.from('social_feed').select('user_id').eq('id', postId).single();
            if (postData && postData.user_id !== userData.user.id) {
                const { error: notifError } = await supabase.from('notifications').insert([{
                    user_id: postData.user_id,
                    actor_id: userData.user.id,
                    type: 'like',
                    post_id: postId
                }]);
                if (notifError) {
                    console.error("Bildirim insert hatası:", notifError);
                    alert("Bildirim oluşturulamadı (RLS veya Tablo Hatası): " + notifError.message);
                }
            }
        } catch (err) {
            console.error("Bildirim gönderilirken hata:", err);
        }
    },

    async unlikePost(postId) {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        const { error } = await supabase
            .from('post_likes')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', userData.user.id);
        if (error) throw error;
    },

    async getMyLikes() {
        if (!supabase) return [];
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return [];
        const { data, error } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', userData.user.id);
        if (error) return [];
        return data.map(l => l.post_id);
    },

    async getComments(postId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('post_comments')
            .select('id, text, created_at, users(name, avatar_url)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    },

    async addComment(postId, text) {
        if (!supabase) return null;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        const { data, error } = await supabase
            .from('post_comments')
            .insert([{ post_id: postId, user_id: userData.user.id, text }])
            .select('id, text, created_at, users(name, avatar_url)');
        if (error) throw error;

        // Bildirim gönder
        try {
            const { data: postData } = await supabase.from('social_feed').select('user_id').eq('id', postId).single();
            if (postData && postData.user_id !== userData.user.id) {
                const { error: notifError } = await supabase.from('notifications').insert([{
                    user_id: postData.user_id,
                    actor_id: userData.user.id,
                    type: 'comment',
                    post_id: postId
                }]);
                if (notifError) console.error("Yorum bildirimi insert hatası:", notifError);
            }
        } catch (err) {
            console.error("Bildirim gönderilirken hata:", err);
        }

        return data[0];
    },

    async deleteComment(commentId) {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        const { error } = await supabase
            .from('post_comments')
            .delete()
            .eq('id', commentId)
            .eq('user_id', userData.user.id);
        if (error) throw error;
    },

    async getUserPosts(userId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('social_feed')
            .select(`
                id, user_id, image, tag, created_at,
                users(name, avatar_url),
                likes_count:post_likes(count),
                comments_count:post_comments(count)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data.map(post => ({
            ...post,
            likes_count: post.likes_count?.[0]?.count ?? 0,
            comments_count: post.comments_count?.[0]?.count ?? 0
        }));
    },

    async followUser(targetUserId) {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        if (userData.user.id === targetUserId) throw new Error("Kendinizi takip edemezsiniz");
        
        const { error } = await supabase
            .from('user_follows')
            .insert([{ follower_id: userData.user.id, following_id: targetUserId }]);
        if (error && error.code !== '23505') throw error; // Ignore unique constraint error

        // Bildirim gönder
        if (!error || error.code === '23505') {
            try {
                const { error: notifError } = await supabase.from('notifications').insert([{
                    user_id: targetUserId,
                    actor_id: userData.user.id,
                    type: 'follow'
                }]);
                if (notifError) console.error("Takip bildirimi insert hatası:", notifError);
            } catch (err) {
                console.error("Bildirim gönderilirken hata:", err);
            }
        }
    },

    async unfollowUser(targetUserId) {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        
        const { error } = await supabase
            .from('user_follows')
            .delete()
            .eq('follower_id', userData.user.id)
            .eq('following_id', targetUserId);
        if (error) throw error;
    },

    async removeFollower(followerUserId) {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        
        const { error } = await supabase
            .from('user_follows')
            .delete()
            .eq('follower_id', followerUserId)
            .eq('following_id', userData.user.id);
        if (error) throw error;
    },

    async getFollowStats(userId) {
        if (!supabase) return { followers: 0, following: 0 };
        
        const [followersData, followingData] = await Promise.all([
            supabase.from('user_follows').select('id', { count: 'exact' }).eq('following_id', userId),
            supabase.from('user_follows').select('id', { count: 'exact' }).eq('follower_id', userId)
        ]);
        
        return {
            followers: followersData.count || 0,
            following: followingData.count || 0
        };
    },

    async getFollowersList(userId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('user_follows')
            .select(`
                follower_id,
                users!user_follows_follower_id_fkey (id, name, avatar_url)
            `)
            .eq('following_id', userId);
        if (error) throw error;
        return data.map(item => ({ 
            id: item.follower_id, 
            name: item.users?.name || 'Kullanıcı',
            avatar_url: item.users?.avatar_url || null
        }));
    },

    async getFollowingList(userId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('user_follows')
            .select(`
                following_id,
                users!user_follows_following_id_fkey (id, name, avatar_url)
            `)
            .eq('follower_id', userId);
        if (error) throw error;
        return data.map(item => ({ 
            id: item.following_id, 
            name: item.users?.name || 'Kullanıcı',
            avatar_url: item.users?.avatar_url || null
        }));
    },

    async checkIsFollowing(targetUserId) {
        if (!supabase) return false;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return false;
        
        const { data, error } = await supabase
            .from('user_follows')
            .select('id')
            .eq('follower_id', userData.user.id)
            .eq('following_id', targetUserId)
            .maybeSingle();
            
        return !!data;
    },

    async savePost(postId) {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        
        const { error } = await supabase
            .from('post_saves')
            .insert([{ post_id: postId, user_id: userData.user.id }]);
        if (error && error.code !== '23505') throw error; // Ignore unique constraint
    },

    async unsavePost(postId) {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Oturum bulunamadı");
        
        const { error } = await supabase
            .from('post_saves')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', userData.user.id);
        if (error) throw error;
    },

    async getMySaves() {
        if (!supabase) return [];
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return [];
        
        const { data, error } = await supabase
            .from('post_saves')
            .select('post_id')
            .eq('user_id', userData.user.id);
        if (error) return [];
        return data.map(s => s.post_id);
    },

    async getSavedPosts(userId) {
        if (!supabase) return [];
        
        const { data, error } = await supabase
            .from('post_saves')
            .select(`
                post_id,
                social_feed (
                    id, user_id, image, tag, created_at,
                    users(name, avatar_url),
                    likes_count:post_likes(count),
                    comments_count:post_comments(count)
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        return data.filter(s => s.social_feed).map(s => ({
            ...s.social_feed,
            likes_count: s.social_feed.likes_count?.[0]?.count ?? 0,
            comments_count: s.social_feed.comments_count?.[0]?.count ?? 0
        }));
    },

    // --- Bildirim Eklentileri ---
    async getNotifications() {
        if (!supabase) {
            await utils.delay(500);
            return [
                { id: '1', type: 'like', is_read: false, created_at: new Date().toISOString(), actor: { id: 'mock-actor-1', name: 'Ahmet', avatar_url: null }, post_id: '1', post: { id: '1', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400' } },
                { id: '2', type: 'comment', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString(), actor: { id: 'mock-actor-2', name: 'Ayşe', avatar_url: null }, post_id: '2', post: { id: '2', image: 'https://images.unsplash.com/photo-1434389678219-e7414d455447?w=400' } },
                { id: '3', type: 'follow', is_read: true, created_at: new Date(Date.now() - 86400000).toISOString(), actor: { id: 'mock-actor-3', name: 'Mehmet', avatar_url: null } }
            ];
        }

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return [];

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userData.user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error("Bildirimler alınamadı:", error);
            alert("Bildirimler yüklenirken Supabase Hatası: " + error.message);
            return [];
        }

        if (!data || data.length === 0) return [];

        // İlişkili verileri manuel çekme (Supabase join hatalarını önlemek için)
        const actorIds = [...new Set(data.map(n => n.actor_id))];
        const postIds = [...new Set(data.map(n => n.post_id).filter(Boolean))];

        const [ { data: actors }, { data: posts } ] = await Promise.all([
            supabase.from('users').select('id, name, avatar_url').in('id', actorIds),
            postIds.length > 0 ? supabase.from('social_feed').select('id, image').in('id', postIds) : { data: [] }
        ]);

        const actorMap = (actors || []).reduce((acc, a) => ({ ...acc, [a.id]: a }), {});
        const postMap = (posts || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

        return data.map(n => ({
            ...n,
            actor: actorMap[n.actor_id] || { name: 'Kullanıcı', avatar_url: null },
            post: n.post_id ? (postMap[n.post_id] || null) : null
        }));
    },

    async markNotificationsAsRead() {
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userData.user.id)
            .eq('is_read', false);

        if (error) console.error("Bildirimler okundu olarak işaretlenemedi:", error);
    },

    async markSingleNotificationAsRead(notificationId) {
        if (!supabase) return;
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) console.error("Bildirim okundu olarak işaretlenemedi:", error);
    },

    async getPostById(postId) {
        if (!supabase) {
            // Mock data fallback
            const mockFeed = [
                { id: '1', user_id: 'mock-id', tag: '#kombin #stil', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400', likes_count: 5 },
                { id: '2', user_id: 'other-id', tag: '#retro #casual', image: 'https://images.unsplash.com/photo-1434389678219-e7414d455447?w=400', likes_count: 12 }
            ];
            return mockFeed.find(p => p.id === postId) || null;
        }

        const { data, error } = await supabase
            .from('social_feed')
            .select('*')
            .eq('id', postId)
            .single();

        if (error) {
            console.error("Post çekilirken hata:", error);
            return null;
        }

        if (data) {
            // Kullanıcı profilini de çek
            const { data: userData } = await supabase.from('users').select('id, name, avatar_url').eq('id', data.user_id).single();
            data.users = userData || { name: 'Kullanıcı', avatar_url: null };
        }
        return data;
    },


    async generateOutfitFromAI(params = {}) {
        if (!supabase) throw new Error("Supabase bağlantısı yok");
        
        try {
            // supabase.functions.invoke kullanarak URL ve Yetkilendirme (Token) işlemlerini otomatik hallediyoruz.
            const { data, error } = await supabase.functions.invoke('generate-outfit', {
                method: 'POST',
                body: params
            });
            
            if (error) {
                // Supabase Edge Function hataları (400 vb) error.context.json() içinde gizli olabilir
                if (error.context && typeof error.context.json === 'function') {
                    try {
                        const errBody = await error.context.json();
                        throw new Error(errBody.error || "Edge Function Hatası");
                    } catch (e) {
                        throw error;
                    }
                }
                throw error;
            }
            
            if (data && data.error) {
                throw new Error(data.error);
            }
            
            const finalOutfit = data.outfit || data;
            console.log("Yapay Zeka Kombini:", finalOutfit);
            return finalOutfit;
        } catch (error) {
            console.error("Yapay Zeka Kombin Hatası:", error);
            throw error;
        }
    },

    // Her kıyafet için Gemini üzerinden dinamik Türk pazarı fiyat tahmini yapar
    async estimateItemPrices(items, maxBudget = 0) {
        if (!CONFIG.GEMINI_API_KEY) return {};

        const budgetNote = maxBudget > 0
            ? `Kullanıcının bütçe üst sınırı ${maxBudget} TL. Fiyatlar bu sınırı geçmemeli.`
            : 'Bütçe sınırı yok.';

        const itemList = items.map((it, i) => `${i + 1}. "${it.name}" (${it.type})`).join('\n');

        const prompt = `Sen Türk giyim pazarını çok iyi bilen bir fiyatlandırma uzmanısın.
Aşağıdaki kıyafetlerin her biri için 2025 yılı Türkiye perakende piyasasında orta segmentte (Zara, Mango, LC Waikiki üst segment, Defacto premium gibi mağazalar) gerçekçi TAHMİNİ bir satış fiyatı ver.
${budgetNote}

Kıyafet listesi:
${itemList}

Sadece şu JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "prices": [850, 1400, 2800]
}
Dizi sırası kıyafet listesiyle aynı olmalı. Değerler TL cinsinden tam sayı olmalı.`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            responseMimeType: 'application/json',
                            responseSchema: {
                                type: 'OBJECT',
                                properties: {
                                    prices: { type: 'ARRAY', items: { type: 'INTEGER' } }
                                },
                                required: ['prices']
                            }
                        }
                    })
                }
            );
            if (!response.ok) return {};
            const data = await response.json();
            const pricesArr = data.candidates?.[0]?.content?.parts?.[0]?.text
                ? JSON.parse(data.candidates[0].content.parts[0].text).prices
                : [];
            // item adı → fiyat haritası oluştur
            const map = {};
            items.forEach((it, i) => { if (pricesArr[i]) map[it.name] = pricesArr[i]; });
            return map;
        } catch (e) {
            console.warn('Fiyat tahmini alınamadı:', e);
            return {};
        }
    },

     async rateOutfit(imageBase64, imageMimeType) {
        // supabase.functions.invoke yerine direkt fetch kullanıyoruz (daha güvenilir)
        const SUPABASE_URL = CONFIG.SUPABASE_URL;
        const SUPABASE_KEY = CONFIG.SUPABASE_KEY;
        
        try {
            // Her resmi sıkıştır - Groq API için max 4MB, biz 1MB hedefliyoruz
            const imageSizeKB = Math.round((imageBase64.length * 3) / 4 / 1024);
            console.log(`[RateOutfit] Resim boyutu: ~${imageSizeKB} KB, sıkıştırılıyor...`);
            
            let finalBase64 = imageBase64;
            let finalMimeType = imageMimeType;
            
            try {
                const compressedResult = await this._compressImage(imageBase64, imageMimeType, 1200, 0.8);
                finalBase64 = compressedResult.base64;
                finalMimeType = compressedResult.mimeType;
                const newSizeKB = Math.round((finalBase64.length * 3) / 4 / 1024);
                console.log(`[RateOutfit] Sıkıştırılmış boyut: ~${newSizeKB} KB`);
            } catch (compErr) {
                console.warn('[RateOutfit] Sıkıştırma başarısız, orijinal resim kullanılıyor:', compErr);
            }
            
            console.log('[RateOutfit] Edge Function çağrılıyor (direkt fetch)...');
            
            const response = await fetch(`${SUPABASE_URL}/functions/v1/rate-outfit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                },
                body: JSON.stringify({ imageBase64: finalBase64, imageMimeType: finalMimeType })
            });
            
            const responseText = await response.text();
            console.log('[RateOutfit] HTTP Status:', response.status);
            console.log('[RateOutfit] Yanıt:', responseText.substring(0, 500));
            
            if (!response.ok) {
                throw new Error(`Edge Function HTTP ${response.status}: ${responseText}`);
            }
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                throw new Error(`Geçersiz JSON yanıtı: ${responseText.substring(0, 200)}`);
            }
            
            if (data && data.error) {
                console.error('[RateOutfit] API error:', data.error);
                throw new Error(data.error);
            }
            
            // Yanıtın geçerli olup olmadığını kontrol et
            if (data && typeof data.score === 'number' && Array.isArray(data.pros)) {
                console.log('[RateOutfit] ✅ Başarılı! Puan:', data.score);
                return data;
            }
            
            // Yanıt beklenmeyen formatta
            console.error('[RateOutfit] Beklenmeyen yanıt formatı:', data);
            throw new Error("Yapay zekadan beklenmeyen yanıt formatı");
        } catch (error) {
            console.error("[RateOutfit] ❌ Hata:", error.message);
            throw error; // Hatayı yukarıya fırlat - dashboard.js hata yönetimi yapıyor
        }
    },
    
    // Resmi sıkıştırma yardımcı fonksiyonu
    async _compressImage(base64Data, mimeType) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_DIM = 1024; // Maksimum boyut
                let { width, height } = img;
                
                if (width > MAX_DIM || height > MAX_DIM) {
                    const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressed = canvas.toDataURL('image/jpeg', 0.7);
                const compressedBase64 = compressed.split(',')[1];
                resolve({ base64: compressedBase64, mimeType: 'image/jpeg' });
            };
            img.onerror = reject;
            img.src = `data:${mimeType};base64,${base64Data}`;
        });
    },

    async getImageFromProxy(prompt) {
        if (!supabase) return null;
        
        try {
            const { data, error } = await supabase.functions.invoke('image-proxy', {
                method: 'POST',
                body: { prompt }
            });
            
            if (error) {
                console.warn('Image proxy hatası:', error);
                return null;
            }
            
            if (data && data.image) {
                return data.image; // data:image/jpeg;base64,... formatında
            }
            
            return null;
        } catch (err) {
            console.warn('Image proxy çağrı hatası:', err);
            return null;
        }
    }
};
