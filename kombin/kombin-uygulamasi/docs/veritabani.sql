-- Supabase Veritabanı Tabloları (SQL)
-- Lütfen bu kodları kopyalayıp Supabase panelindeki SQL Editor kısmında çalıştırın.

-- 1. users tablosu
create table if not exists public.users (
  id uuid references auth.users not null primary key,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Herkes kendi bilgisine erişebilsin diye RLS (Row Level Security) ayarları
alter table public.users enable row level security;
create policy "Users can view own data." on public.users for select using (auth.uid() = id);
create policy "Users can update own data." on public.users for update using (auth.uid() = id);

-- 2. preferences tablosu
create table if not exists public.preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  style text,
  gender text,
  budget numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id) -- Her kullanıcının 1 preference'ı olsun
);
alter table public.preferences enable row level security;
create policy "Users can view own preferences." on public.preferences for select using (auth.uid() = user_id);
create policy "Users can update own preferences." on public.preferences for insert with check (auth.uid() = user_id);
create policy "Users can modify own preferences" on public.preferences for update using (auth.uid() = user_id);

-- 3. wardrobe tablosu
create table if not exists public.wardrobe (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null,
  color text not null,
  name text,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.wardrobe enable row level security;
create policy "Users can view own wardrobe." on public.wardrobe for select using (auth.uid() = user_id);
create policy "Users can insert own wardrobe items." on public.wardrobe for insert with check (auth.uid() = user_id);
create policy "Users can delete own wardrobe items." on public.wardrobe for delete using (auth.uid() = user_id);

-- 4. social_feed tablosu (Genel Paylaşılan Kombinler)
create table if not exists public.social_feed (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  user_name text,
  image text not null,
  likes integer default 0,
  tag text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Herkes görebilsin, ama sadece kendi verisini silebilir vb.
alter table public.social_feed enable row level security;
create policy "Everyone can view social feed." on public.social_feed for select using (true);
create policy "Users can insert own social feed." on public.social_feed for insert with check (auth.uid() = user_id);
create policy "Users can delete own social feed." on public.social_feed for delete using (auth.uid() = user_id);

-- 5. users tablosuna otomatik Auth tetikleyicisi
-- Kullanıcı Supabase'den kayıt (signUp) olduğunda users tablosuna bir satır eklenmesi için:
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger'ı oluşturuyoruz
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
