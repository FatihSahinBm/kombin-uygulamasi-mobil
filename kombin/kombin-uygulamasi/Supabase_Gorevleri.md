# Supabase Kurulum ve Güncelleme Görevleri

Kombin.AI projesinin "Gardırop" bölümünü, statik çizimler (emojiler) yerine kullanıcıların kendi kıyafet fotoğraflarını yükleyebileceği gerçekçi bir sisteme geçiriyoruz. Bu geçişin veritabanı (backend) tarafında yapılması gerekenler aşağıda listelenmiştir.

## 1. Storage (Depolama) Kurulumu
Kullanıcı fotoğraflarını barındırmak için Supabase Storage kullanılacaktır.

- Supabase paneline girin ve sol menüden **Storage** sekmesine tıklayın.
- **New Bucket** diyerek yeni bir kova oluşturun.
- Bucket adı: `wardrobe_images`
- **Public bucket** seçeneğini KESİNLİKLE AÇIK yapın (fotoğrafların arayüzde gösterilebilmesi için public olmalıdır).
- (Opsiyonel) "Allowed MIME types" kısmını sadece `image/*` olarak sınırlandırabilirsiniz.
- (ÖNEMLİ) Storage klasörü için yetkilendirme politikası (Policy) oluşturun:
  - Yeni bir "Policy" ekleyerek resim yükleme ve okuma izinlerini ayarlayın.

## 2. Veritabanı Şeması Güncellemesi
Mevcut `wardrobe` tablosuna, yüklenen görsellerin URL'sini tutacak yeni bir sütun eklenmesi gerekmektedir.

Aşağıdaki SQL komutunu Supabase **SQL Editor** üzerinden çalıştırın:

```sql
-- wardrobe tablosuna image_url sütunu eklenmesi
ALTER TABLE wardrobe
ADD COLUMN image_url TEXT;
```

## 3. Bildirimler Sistemi Kurulumu (YENİ)
Beğeni, yorum ve takip bildirimlerini saklamak için yeni bir tablo oluşturulması gerekmektedir.

Aşağıdaki SQL komutunu Supabase SQL Editor üzerinden çalıştırın:

```sql
-- notifications tablosunun oluşturulması
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Bildirimi alacak kişi
  actor_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Eylemi yapan kişi
  type TEXT NOT NULL, -- 'like', 'comment', 'follow'
  post_id UUID REFERENCES social_feed(id) ON DELETE CASCADE, -- Opsiyonel (takip için boş kalır)
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) Politikalarını Etkinleştir
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Eski politikalar varsa temizle (Çakışmaları önlemek için)
DROP POLICY IF EXISTS "Kullanıcılar sadece kendi bildirimlerini görebilir" ON notifications;
DROP POLICY IF EXISTS "Kullanıcılar bildirimlerini güncelleyebilir (okundu işaretleme)" ON notifications;
DROP POLICY IF EXISTS "Bildirim oluşturma izni" ON notifications;

-- 1. Okuma İzni: Kullanıcılar sadece KENDİ (user_id) bildirimlerini görebilir
CREATE POLICY "Kullanıcılar sadece kendi bildirimlerini görebilir"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Güncelleme İzni: Kullanıcılar sadece kendi bildirimlerini "okundu" yapabilir
CREATE POLICY "Kullanıcılar bildirimlerini güncelleyebilir (okundu işaretleme)"
ON notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Ekleme İzni: Sisteme giriş yapmış herkes (başkasının gönderisine) bildirim oluşturabilir
CREATE POLICY "Bildirim oluşturma izni"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Silme İzni (İsteğe bağlı): Kullanıcılar kendi bildirimlerini silebilir
CREATE POLICY "Bildirim silme izni"
ON notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

## 4. RLS (Row Level Security) Kontrolü
Mevcut `wardrobe` tablosunun RLS politikalarının tam ve doğru olduğundan emin olun. (Kullanıcılar sadece kendi ekledikleri kıyafetleri silebilir ve güncelleyebilir olmalıdır).

```sql
-- Eğer daha önce DELETE politikası eklenmediyse bunu çalıştırın:
CREATE POLICY "Kullanıcılar kendi kıyafetlerini silebilir"
ON wardrobe FOR DELETE
USING (auth.uid() = user_id);

-- Eğer daha önce UPDATE politikası eklenmediyse bunu çalıştırın:
CREATE POLICY "Kullanıcılar kendi kıyafetlerini güncelleyebilir"
ON wardrobe FOR UPDATE
USING (auth.uid() = user_id);
```

---
**Özetle Backend Beklentisi:**
Bu işlemler tamamlandığında `wardrobe` tablosu `image_url` adında text türünde yeni bir sütuna sahip olacak ve Supabase Storage altında içi dışarıdan okunabilen (Public) `wardrobe_images` adında bir bucket bulunacaktır. Frontend tarafı fotoğrafı direkt bu bucket'a yükleyip public URL'sini `image_url` sütununa kaydedecektir.
