-- =========================================================
-- Storage RLS policies
-- Run AFTER creating the 'avatars' (public), 'documents' (private),
-- and 'receipts' (private) buckets in Dashboard -> Storage.
--
-- Convention: files are stored as "<user-id>/filename.ext" so a
-- user's own folder (named after their auth uid) is what's checked.
-- =========================================================

-- ---------- avatars (public read, owner writes) ----------
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
);

create policy "users delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------- documents (private: owner + admin only) ----------
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

create policy "admin full access to documents"
on storage.objects for all
using (bucket_id = 'documents' and is_admin())
with check (bucket_id = 'documents' and is_admin());

-- ---------- receipts (private: owner + admin only) ----------
create policy "users access their own receipts"
on storage.objects for select
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "admin full access to receipts"
on storage.objects for all
using (bucket_id = 'receipts' and is_admin())
with check (bucket_id = 'receipts' and is_admin());
