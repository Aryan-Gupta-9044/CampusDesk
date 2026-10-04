-- =========================================================
-- CampusDesk V1 — Storage setup (buckets + access policies)
--
-- Run ONCE in the Supabase SQL Editor (safe to re-run).
-- Replaces the old storage_policies.sql: it creates the buckets for you,
-- so nothing has to be clicked together in Dashboard -> Storage.
--
--   avatars    PUBLIC   profile photos            2 MB   images only
--   documents  PRIVATE  ID proofs, certificates   10 MB  pdf/images/word/txt
--   receipts   PRIVATE  reserved for fee receipts 5 MB   (not used by the V1
--                       screens yet; created so the policies are in place)
--
-- Files are stored as "<user-id>/<file>", so the first folder is the owner.
-- =========================================================

-- ---------- 1. Buckets ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152,
    array['image/jpeg','image/png','image/webp','image/gif']),
  ('documents', 'documents', false, 10485760,
    array['application/pdf','image/jpeg','image/png','image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain']),
  ('receipts', 'receipts', false, 5242880,
    array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 2. Clear any earlier versions of these policies ----------
drop policy if exists "avatars are publicly readable"        on storage.objects;
drop policy if exists "users upload their own avatar"        on storage.objects;
drop policy if exists "users update their own avatar"        on storage.objects;
drop policy if exists "users delete their own avatar"        on storage.objects;
drop policy if exists "users access their own documents"     on storage.objects;
drop policy if exists "users upload their own documents"     on storage.objects;
drop policy if exists "users delete their own documents"     on storage.objects;
drop policy if exists "admin full access to documents"       on storage.objects;
drop policy if exists "users access their own receipts"      on storage.objects;
drop policy if exists "admin full access to receipts"        on storage.objects;

-- ---------- 3. avatars (public read, owner writes) ----------
create policy "avatars are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "users upload their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------- 4. documents (private: owner + admin only) ----------
create policy "users access their own documents"
on storage.objects for select
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users upload their own documents"
on storage.objects for insert
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- The Documents page has a delete (×) button; without this policy the
-- delete silently does nothing.
create policy "users delete their own documents"
on storage.objects for delete
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "admin full access to documents"
on storage.objects for all
using (bucket_id = 'documents' and public.is_admin())
with check (bucket_id = 'documents' and public.is_admin());

-- ---------- 5. receipts (private: owner reads, admin manages) ----------
create policy "users access their own receipts"
on storage.objects for select
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "admin full access to receipts"
on storage.objects for all
using (bucket_id = 'receipts' and public.is_admin())
with check (bucket_id = 'receipts' and public.is_admin());

-- ---------- 6. Check (read-only) ----------
-- select id, public, file_size_limit from storage.buckets order by id;
-- select policyname, cmd from pg_policies
--   where schemaname = 'storage' and tablename = 'objects' order by policyname;
