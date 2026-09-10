-- Self-service account deletion (§12: droit de suppression / Loi 25).
-- Deletes the auth.users row, which cascades to profiles, saved_colors,
-- color_names, votes and colors.discovered_by/proposed_by via
-- "on delete cascade"/"on delete set null" already declared on those
-- tables. Community content the user contributed (approved names, colors
-- other people rely on) is intentionally kept but detached from their
-- identity, rather than deleted outright, so the shared dataset stays
-- consistent for other users.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

comment on function public.delete_own_account is
  'Call via supabase.rpc("delete_own_account") from the authenticated client to fully erase an account and its private data.';
