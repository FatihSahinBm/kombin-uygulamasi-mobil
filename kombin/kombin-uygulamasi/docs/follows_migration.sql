-- ============================================================
-- Takip ve Takipçi (Follows) Sistemi Migration
-- Supabase SQL Editor'de çalıştırın.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_follows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(follower_id, following_id) -- Bir kullanıcı diğerini sadece 1 kez takip edebilir
);

-- RLS (Row Level Security) Aktifleştirme
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Politikalar
CREATE POLICY "Herkes takipleri görebilir"
  ON public.user_follows FOR SELECT USING (true);

CREATE POLICY "Kullanıcı kendi takibini oluşturabilir"
  ON public.user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Kullanıcı kendi takibini silebilir"
  ON public.user_follows FOR DELETE USING (auth.uid() = follower_id);

-- Performans için İndeksler
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);
