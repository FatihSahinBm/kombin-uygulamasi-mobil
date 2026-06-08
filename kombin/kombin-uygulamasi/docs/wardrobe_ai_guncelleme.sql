-- ==============================================================================
-- 1. YAPAY ZEKA GÜNCELLEMESİ (WARDROBE TABLOSU İÇİN)
-- ==============================================================================

-- 'wardrobe' tablosuna yapay zekanın bulduğu özellikleri (fit, doku, stil vb.) 
-- barındırması için JSONB türünde 'attributes' adlı yeni bir sütun ekliyoruz.
-- JSONB, NoSQL gibi çalışarak ileride sınırsız yeni özellik eklememize (Örn: Desen) olanak tanır.

ALTER TABLE public.wardrobe 
ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

-- Not: API yapısı güncellenmiştir ve JSONB sütunu otomatik olarak beslenmektedir.
-- Supabase SQL editöründe sadece bu komutu çalıştırmanız yeterlidir.
-- Ön bellekleri yenilemek için:
NOTIFY pgrst, 'reload schema';
