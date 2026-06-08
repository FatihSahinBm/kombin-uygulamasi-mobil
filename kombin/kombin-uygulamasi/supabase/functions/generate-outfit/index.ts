import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// CORS ayarları (Frontend'den gelen istekleri kabul etmek için)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS ön-isteğini (OPTIONS) yanıtla
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Supabase Client'ı başlat (Kullanıcı doğrulaması için)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Oturum token'ı bulunamadı.");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    // 2. İsteği yapan kullanıcıyı token üzerinden doğrula
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error(`Kullanıcı doğrulanamadı. Hata: ${userError?.message || "Kullanıcı yok"}`);
    }
    const userId = user.id;

    // 3. İstek gövdesini (body) al (Hava durumu, fiziksel özellikler vb.)
    let reqBody = {};
    try {
      reqBody = await req.json();
    } catch(e) {
      // Body boş olabilir, sorun değil
    }

    const { weatherCondition = "Bilinmiyor", weatherTemp = "20", physicalTraits = "Belirtilmemiş", style = "", minBudget = 0, maxBudget = 5000, gender = "", colorPalette = "", fixedItems = null } = reqBody;

    // 4. Kullanıcı tercihlerini (preferences) çek
    const { data: preferences, error: prefError } = await supabaseClient
      .from("preferences")
      .select("gender, style, budget")
      .eq("user_id", userId)
      .single();

    if (prefError) console.error("Tercihler bulunamadı, varsayılanlar kullanılacak.");

    // 5. Kullanıcının gardırobunu çek (wardrobe)
    const { data: wardrobe, error: wardError } = await supabaseClient
      .from("wardrobe")
      .select("type, color, name")
      .eq("user_id", userId);

    // 6. Groq Llama 3 için Prompt oluştur
    const userStyle = style || preferences?.style || "Günlük / Rahat";
    const userGender = gender || preferences?.gender || "Belirtilmemiş";
    
    // Gardırop içeriğini metne dök
    let wardrobeContext = "Kullanıcının dolabında veri yok. Sen yepyeni kıyafetler öner.";
    if (fixedItems && Object.values(fixedItems).some(i => i !== null)) {
      const selected = [];
      Object.entries(fixedItems).forEach(([cat, item]) => {
          if (item) selected.push(`${cat} olarak: ${item.color} renkli ${item.name}`);
      });
      wardrobeContext = `KULLANICI KESİNLİKLE ŞU PARÇALARI KULLANMAK İSTİYOR:\n${selected.join('\n')}\nLütfen kombinin geri kalan eksik parçalarını sadece bu seçili parçalara uyumlu olacak şekilde tamamla. ASLA seçili parçaları değiştirme, çıktıda aynen kullan.`;
    } else if (wardrobe && wardrobe.length > 0) {
      const items = wardrobe.map(w => `${w.color} renkli ${w.type} (${w.name})`).join(", ");
      wardrobeContext = `Lütfen öncelikle kullanıcının dolabındaki şu kıyafetleri kullanmaya çalış: ${items}. Eğer eksik parça varsa dışarıdan uyumlu bir parça uydur.`;
    }

    const paletteInstruction = colorPalette 
      ? `Seçilen Renk Paleti: ${colorPalette}. Kombini KESİNLİKLE bu renklere uygun oluştur.`
      : `Renk zorunluluğu yok, renkleri serbestçe ve uyumlu seç.`;

    const systemPrompt = `
      Sen profesyonel ve zevkli bir moda stilistisin. Amacın, verilen bilgilere dayanarak kullanıcıya YENİ ama GİYİLEBİLİR bir kombin önermektir.
      
      Kullanıcı Bilgileri: Cinsiyet: ${userGender}, Tercih Edilen Stil: ${userStyle}.
      Fiziksel Özellikler: ${physicalTraits} (Vücut tipine uygun kesimler seç)
      Bütçe: ${minBudget} TL - ${maxBudget} TL
      Hava Durumu: ${weatherTemp}°C, ${weatherCondition}
      Gardırop Durumu: ${wardrobeContext}
      Renk Tercihi: ${paletteInstruction}

      GÖREV VE KURALLAR:
      1. Uyum: Kullanıcının cinsiyetine, fiziğine, tarzına ve hava durumuna %100 uygun bir kombin yap. Eğer kullanıcı bazı parçaları kesin seçmişse, onlara tam uyan eksik parçaları bul.
      2. Renk Teorisi (ÇOK ÖNEMLİ): ${colorPalette ? 'MÜMKÜN OLDUĞUNCA KULLANICININ SEÇTİĞİ RENK PALETİNDEKİ RENKLERİ KULLAN.' : 'Bir kombinde en fazla 3 ana renk kullan. Renkler birbiriyle uyumlu olmalı.'}
      3. Geçerli Renkler: Sadece gerçek, bilinen ve yaygın moda renklerini kullan (Örn: Siyah, Beyaz, Gri, Antrasit, Lacivert, Haki, Bej, Krem, Taba, Kahverengi, Bordo, Hardal). Saçma, uzun veya uydurma renk isimleri (Örn: "Enerjik mavi", "Oksijen rengi") KESİNLİKLE YASAKTIR.
      4. Kısa ve Net: Kıyafet isimleri vitrin adı gibi sade olmalı. Sadece rengi, materyali ve temel türü yaz (Örn: "Krem Keten Pantolon", "Haki Oversize Tişört"). Kullanıcının seçtiği parçaları aynen yaz.
      5. Çeşitlilik: Sürekli aynı şeyleri önerme ancak sırf farklı olmak için uyumsuz saçma parçaları da eşleştirme.
      6. Görsel İstemi (Image Prompt): Önerdiğin her parça için, bir yapay zeka resim çiziciye gönderilecek İNGİLİZCE detaylı bir prompt yaz. Prompt "a highly detailed realistic product photo of a [kıyafet tarifi], flat lay on white background" tarzında olmalı.

      Lütfen YALNIZCA aşağıdaki JSON formatında yanıt ver. Başka hiçbir açıklama veya markdown tırnağı (\`\`\`json) KULLANMA.
      
      {
        "outfit": {
          "top": "üst giyim önerisi (veya kullanıcının seçtiği parça)",
          "top_prompt": "a highly detailed realistic product photo of a [kıyafetin ingilizce tarifi], flat lay on white background",
          "bottom": "alt giyim önerisi (veya kullanıcının seçtiği parça)",
          "bottom_prompt": "a highly detailed realistic product photo of a [kıyafetin ingilizce tarifi], flat lay on white background",
          "shoes": "ayakkabı önerisi (veya kullanıcının seçtiği parça)",
          "shoes_prompt": "a highly detailed realistic product photo of a [ayakkabının ingilizce tarifi], isolated on white background",
          "outerwear": "dış giyim önerisi (hava soğuksa veya kullanıcı seçmişse, gerekliyse ekle, değilse yazma)",
          "outerwear_prompt": "a highly detailed realistic product photo of a [dış giyim ingilizce tarifi], flat lay on white background",
          "accessory": "aksesuar önerisi (gerekliyse veya kullanıcı seçmişse ekle, değilse yazma)",
          "accessory_prompt": "a highly detailed realistic product photo of a [aksesuar ingilizce tarifi], isolated on white background",
          "reasoning": "seçilen renklerin ve parçaların neden uyumlu olduğunun kısa açıklaması"
        }
      }
    `;

    // 7. Groq API'ye İstek At (Llama 3 modeli)
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) throw new Error("Groq API Key eksik.");

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Çok daha zeki ve Türkçe çevirisi mükemmel olan yeni model
        messages: [
          { role: "system", content: "Sen sadece saf JSON dönen bir REST API sunucususun." },
          { role: "user", content: systemPrompt }
        ],
        temperature: 0.70, // <--- BURAYI DÜŞÜRDÜK. Mantıklı sınırlar içinde kalması için.
        response_format: { type: "json_object" } 
      })
    });

    const groqData = await groqResponse.json();
    
    if (!groqResponse.ok) {
      throw new Error(groqData.error?.message || "Groq API Hatası");
    }

    // Llama 3'ün ürettiği JSON metnini ayrıştır
    const aiContent = groqData.choices[0].message.content;
    const parsedOutfit = JSON.parse(aiContent);

    // 7. Frontend'e JSON olarak gönder
    return new Response(JSON.stringify(parsedOutfit), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
}); 
