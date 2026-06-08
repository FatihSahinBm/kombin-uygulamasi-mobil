-- ============================================================
-- Sosyal Akış Normalizasyon Migration
-- Supabase SQL Editor'de çalıştırın.
-- ============================================================

-- 1. social_feed tablosuna post_images bucket için ayrı alan ekle
--    user_name sütununu kaldırıyoruz (users tablosundan JOIN ile gelecek)
--    likes sütununu kaldırıyoruz (post_likes tablosundan count ile gelecek)

ALTER TABLE public.social_feed
  DROP COLUMN IF EXISTS user_name,
  DROP COLUMN IF EXISTS likes;

-- 2. post_likes tablosu (beğeniler)
CREATE TABLE IF NOT EXISTS public.post_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    uuid REFERENCES public.social_feed(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(post_id, user_id)  -- Bir kullanıcı bir postu sadece bir kez beğenebilir
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes beğenileri görebilir"
  ON public.post_likes FOR SELECT USING (true);

CREATE POLICY "Kullanıcı kendi beğenisini ekleyebilir"
  ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kullanıcı kendi beğenisini silebilir"
  ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- 3. post_comments tablosu (yorumlar)
CREATE TABLE IF NOT EXISTS public.post_comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    uuid REFERENCES public.social_feed(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  text       text NOT NULL CHECK (char_length(text) > 0 AND char_length(text) <= 500),
  created_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes yorumları görebilir"
  ON public.post_comments FOR SELECT USING (true);

CREATE POLICY "Kullanıcı kendi yorumunu ekleyebilir"
  ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kullanıcı kendi yorumunu silebilir"
  ON public.post_comments FOR DELETE USING (auth.uid() = user_id);

-- 4. Performans için index'ler
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id    ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id    ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_social_feed_created   ON public.social_feed(created_at DESC);

-- 5. social_feed üzerinde UPDATE yetkisi (likes artık ayrı tabloda ama
--    ileride tag düzenleme gibi ihtiyaçlar olabilir)
CREATE POLICY "Kullanıcı kendi gönderisini güncelleyebilir"
  ON public.social_feed FOR UPDATE USING (auth.uid() = user_id);

-- 6. Storage bucket: sosyal paylaşım görselleri için ayrı bucket
--    Supabase Dashboard > Storage > New Bucket > "social_images" (public: true)
--    Aşağıdaki policy'leri SQL Editor'de çalıştırın:

INSERT INTO storage.buckets (id, name, public)
  VALUES ('social_images', 'social_images', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Sosyal görseller herkese açık"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'social_images');

CREATE POLICY "Oturum açık kullanıcı sosyal görsel yükleyebilir"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'social_images' AND auth.role() = 'authenticated');

CREATE POLICY "Kullanıcı kendi sosyal görselini silebilir"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'social_images' AND auth.uid()::text = (storage.foldername(name))[1]);
