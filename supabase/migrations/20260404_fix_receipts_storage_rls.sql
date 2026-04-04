-- Ensure receipts bucket exists and is usable by anon/authenticated clients.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update
set public = excluded.public,
    name = excluded.name;

drop policy if exists "billwizard_receipts_select" on storage.objects;
drop policy if exists "billwizard_receipts_insert" on storage.objects;
drop policy if exists "billwizard_receipts_update" on storage.objects;
drop policy if exists "billwizard_receipts_delete" on storage.objects;

create policy "billwizard_receipts_select"
on storage.objects
for select
using (bucket_id = 'receipts');

create policy "billwizard_receipts_insert"
on storage.objects
for insert
with check (bucket_id = 'receipts');

create policy "billwizard_receipts_update"
on storage.objects
for update
using (bucket_id = 'receipts')
with check (bucket_id = 'receipts');

create policy "billwizard_receipts_delete"
on storage.objects
for delete
using (bucket_id = 'receipts');
