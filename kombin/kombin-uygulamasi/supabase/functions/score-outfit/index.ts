import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Oturum token'ı bulunamadı.");
    
    // Sadece oturumu doğrulamak için (isteğe bağlı ama güvenli)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error(`Kullanıcı doğrulanamadı.`);
    }

    let reqBody = {};
    try {
      reqBody = await req.json();
    } catch(e) {}

    const { outfitText } = reqBody;
    if (!outfitText) {
      throw new Error("Puanlanacak kombin bulunamadı (outfitText).");
    }

    const systemPrompt = `
Sen bir moda eleştirmenisin. Sana verilen kombini renk uyumu (colorHarmony), tarz bütünlüğü (styleCohesion) ve ortam/hava uygunluğu (occasionSuitability) açısından değerlendir.

Kombin:
${outfitText}

Yanıtı kesinlikle aşağıdaki JSON formatında dön, başka hiçbir açıklama ekleme:
{
  "totalScore": 88,
  "categories": {
    "colorHarmony": { "score": 90, "comment": "Renkler dengeli." },
    "styleCohesion": { "score": 85, "comment": "Tarz bütünlüğü yüksek." },
    "occasionSuitability": { "score": 90, "comment": "Hava durumuna uygun." }
  },
  "suggestions": ["Şunu ekleyebilirsin", "Bunu değiştirebilirsin"]
}
`;

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) throw new Error("Groq API Key eksik.");

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Sen sadece saf JSON dönen bir REST API sunucususun." },
          { role: "user", content: systemPrompt }
        ],
        temperature: 0.3, 
        response_format: { type: "json_object" } 
      })
    });

    const groqData = await groqResponse.json();
    if (!groqResponse.ok) {
      throw new Error(groqData.error?.message || "Groq API Hatası");
    }

    const aiContent = groqData.choices[0].message.content;
    const parsedScore = JSON.parse(aiContent);

    return new Response(JSON.stringify(parsedScore), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
