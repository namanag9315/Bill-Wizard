-- BillWizard currently uses client-side Supabase calls without mandatory auth.
-- These policies keep collaborative room actions working for anon + authenticated users.

do $$
begin
  if to_regclass('public.sessions') is not null then
    execute 'alter table public.sessions enable row level security';
    execute 'drop policy if exists "billwizard_public_select_sessions" on public.sessions';
    execute 'drop policy if exists "billwizard_public_insert_sessions" on public.sessions';
    execute 'drop policy if exists "billwizard_public_update_sessions" on public.sessions';
    execute 'drop policy if exists "billwizard_public_delete_sessions" on public.sessions';
    execute 'create policy "billwizard_public_select_sessions" on public.sessions for select using (true)';
    execute 'create policy "billwizard_public_insert_sessions" on public.sessions for insert with check (true)';
    execute 'create policy "billwizard_public_update_sessions" on public.sessions for update using (true) with check (true)';
    execute 'create policy "billwizard_public_delete_sessions" on public.sessions for delete using (true)';
  end if;

  if to_regclass('public.participants') is not null then
    execute 'alter table public.participants enable row level security';
    execute 'drop policy if exists "billwizard_public_select_participants" on public.participants';
    execute 'drop policy if exists "billwizard_public_insert_participants" on public.participants';
    execute 'drop policy if exists "billwizard_public_update_participants" on public.participants';
    execute 'drop policy if exists "billwizard_public_delete_participants" on public.participants';
    execute 'create policy "billwizard_public_select_participants" on public.participants for select using (true)';
    execute 'create policy "billwizard_public_insert_participants" on public.participants for insert with check (true)';
    execute 'create policy "billwizard_public_update_participants" on public.participants for update using (true) with check (true)';
    execute 'create policy "billwizard_public_delete_participants" on public.participants for delete using (true)';
  end if;

  if to_regclass('public.expenses') is not null then
    execute 'alter table public.expenses enable row level security';
    execute 'drop policy if exists "billwizard_public_select_expenses" on public.expenses';
    execute 'drop policy if exists "billwizard_public_insert_expenses" on public.expenses';
    execute 'drop policy if exists "billwizard_public_update_expenses" on public.expenses';
    execute 'drop policy if exists "billwizard_public_delete_expenses" on public.expenses';
    execute 'create policy "billwizard_public_select_expenses" on public.expenses for select using (true)';
    execute 'create policy "billwizard_public_insert_expenses" on public.expenses for insert with check (true)';
    execute 'create policy "billwizard_public_update_expenses" on public.expenses for update using (true) with check (true)';
    execute 'create policy "billwizard_public_delete_expenses" on public.expenses for delete using (true)';
  end if;

  if to_regclass('public.items') is not null then
    execute 'alter table public.items enable row level security';
    execute 'drop policy if exists "billwizard_public_select_items" on public.items';
    execute 'drop policy if exists "billwizard_public_insert_items" on public.items';
    execute 'drop policy if exists "billwizard_public_update_items" on public.items';
    execute 'drop policy if exists "billwizard_public_delete_items" on public.items';
    execute 'create policy "billwizard_public_select_items" on public.items for select using (true)';
    execute 'create policy "billwizard_public_insert_items" on public.items for insert with check (true)';
    execute 'create policy "billwizard_public_update_items" on public.items for update using (true) with check (true)';
    execute 'create policy "billwizard_public_delete_items" on public.items for delete using (true)';
  end if;

  if to_regclass('public.item_assignments') is not null then
    execute 'alter table public.item_assignments enable row level security';
    execute 'drop policy if exists "billwizard_public_select_item_assignments" on public.item_assignments';
    execute 'drop policy if exists "billwizard_public_insert_item_assignments" on public.item_assignments';
    execute 'drop policy if exists "billwizard_public_update_item_assignments" on public.item_assignments';
    execute 'drop policy if exists "billwizard_public_delete_item_assignments" on public.item_assignments';
    execute 'create policy "billwizard_public_select_item_assignments" on public.item_assignments for select using (true)';
    execute 'create policy "billwizard_public_insert_item_assignments" on public.item_assignments for insert with check (true)';
    execute 'create policy "billwizard_public_update_item_assignments" on public.item_assignments for update using (true) with check (true)';
    execute 'create policy "billwizard_public_delete_item_assignments" on public.item_assignments for delete using (true)';
  end if;

  if to_regclass('public.activity_logs') is not null then
    execute 'alter table public.activity_logs enable row level security';
    execute 'drop policy if exists "billwizard_public_select_activity_logs" on public.activity_logs';
    execute 'drop policy if exists "billwizard_public_insert_activity_logs" on public.activity_logs';
    execute 'drop policy if exists "billwizard_public_update_activity_logs" on public.activity_logs';
    execute 'drop policy if exists "billwizard_public_delete_activity_logs" on public.activity_logs';
    execute 'create policy "billwizard_public_select_activity_logs" on public.activity_logs for select using (true)';
    execute 'create policy "billwizard_public_insert_activity_logs" on public.activity_logs for insert with check (true)';
    execute 'create policy "billwizard_public_update_activity_logs" on public.activity_logs for update using (true) with check (true)';
    execute 'create policy "billwizard_public_delete_activity_logs" on public.activity_logs for delete using (true)';
  end if;
end $$;
