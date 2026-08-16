-- ============================================================
-- LÓGICAS PXG V3.5 — IMAGENS DE CAPA / SUPABASE STORAGE
-- Rode UMA VEZ no SQL Editor do Supabase após a V3.4.
-- ============================================================

-- Campo opcional que guarda a URL pública da imagem.
alter table public.posts
  add column if not exists cover_image_url text;

-- Bucket público para capas das matérias.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública das capas.
drop policy if exists "post_images_public_read" on storage.objects;
create policy "post_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'post-images');

-- Somente administradores podem enviar/alterar/excluir capas.
drop policy if exists "post_images_admin_insert" on storage.objects;
create policy "post_images_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "post_images_admin_update" on storage.objects;
create policy "post_images_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'post-images' and public.is_admin())
with check (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "post_images_admin_delete" on storage.objects;
create policy "post_images_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'post-images' and public.is_admin());
