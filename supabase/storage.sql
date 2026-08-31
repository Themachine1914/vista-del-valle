-- Bucket público para fotos de platos. El script `npm run db:storage`
-- también lo crea si las claves de servicio están en el entorno.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platos',
  'platos',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura pública de las fotos de la carta. Las subidas las hace el servidor
-- con la service role (bypasea RLS).
drop policy if exists "platos public read" on storage.objects;
create policy "platos public read"
on storage.objects
for select
to public
using (bucket_id = 'platos');
