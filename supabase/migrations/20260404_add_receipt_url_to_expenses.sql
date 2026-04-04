alter table if exists public.expenses
  add column if not exists receipt_url text;

comment on column public.expenses.receipt_url is
  'Public URL for original receipt image stored in Supabase Storage bucket receipts.';
